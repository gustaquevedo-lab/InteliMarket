"""Sales targets — motor de forecast estadistico (baseline mensual por linea).

No integra clima/mercado/indicadores externos (decision explicita del
usuario: "estadistico puro sobre datos reales + vos ajustas" via un %
manual antes de publicar). Estacionalidad mes-del-ano + tendencia
interanual sobre hasta 14 anos de sale_items reales, mismo estilo que
demand_forecast/service.py (media/tendencia/desvio con tratamiento de
outliers via desviacion estandar) pero con periodo=12 (mes del ano) en
vez de dia-de-semana, que es lo que corresponde para metas mensuales.
"""

import statistics
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def recalculate_baseline(db: AsyncSession, company_id: str) -> dict:
    # Venta real mensual por linea, ultimos 14 anos. SIGN(si.total) sobre
    # cantidad: mismo ajuste de notas de credito ya aplicado en el resto
    # del modulo (sale_items.cantidad no lleva signo, solo total).
    sales_rows = (await db.execute(text("""
        SELECT p.linea_id, EXTRACT(year FROM s.fecha)::int AS anio, EXTRACT(month FROM s.fecha)::int AS mes,
               SUM(si.total) AS monto, SUM(SIGN(si.total) * si.cantidad) AS unidades
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.company_id = :company_id AND s.estado <> 'anulado' AND p.linea_id IS NOT NULL
        GROUP BY p.linea_id, anio, mes
    """), {"company_id": company_id})).all()

    # objetivos legacy (unidades) por linea+mes, como referencia cruzada —
    # el mes se saca de CICLO (YYYYMM).
    obj_rows = (await db.execute(text("""
        SELECT linea_nombre, SUBSTRING(ciclo, 5, 2)::int AS mes, AVG(cantidad) AS promedio
        FROM legacy_objetivos_reference
        WHERE company_id = :company_id AND linea_nombre IS NOT NULL
        GROUP BY linea_nombre, mes
    """), {"company_id": company_id})).all()

    lineas = (await db.execute(text(
        "SELECT id, nombre FROM product_lines WHERE company_id = :company_id"
    ), {"company_id": company_id})).all()
    nombre_por_id = {str(r.id): r.nombre for r in lineas}
    id_por_nombre = {r.nombre: str(r.id) for r in lineas}

    objetivo_ref = defaultdict(dict)  # linea_id -> {mes: promedio_unidades_legacy}
    for row in obj_rows:
        lid = id_por_nombre.get(row.linea_nombre)
        if lid:
            objetivo_ref[lid][row.mes] = float(row.promedio or 0)

    # Agrupar por (linea, mes) -> lista de (anio, monto, unidades)
    por_linea_mes = defaultdict(list)
    for row in sales_rows:
        if row.linea_id is None:
            continue
        por_linea_mes[(str(row.linea_id), row.mes)].append(
            (row.anio, float(row.monto or 0), float(row.unidades or 0))
        )

    inserts = []
    for (linea_id, mes), puntos in por_linea_mes.items():
        puntos.sort(key=lambda p: p[0])
        montos = [p[1] for p in puntos]
        unidades = [p[2] for p in puntos]

        promedio_gs = statistics.mean(montos)
        promedio_unidades = statistics.mean(unidades)
        desvio_gs = statistics.stdev(montos) if len(montos) >= 2 else 0.0

        # Tendencia: mitad reciente vs mitad antigua de los anos disponibles
        # para este mes (simple, robusto con pocos puntos — no requiere
        # regresion lineal completa para el objetivo de este modulo).
        tendencia_pct = 0.0
        if len(montos) >= 4:
            mitad = len(montos) // 2
            antiguo = statistics.mean(montos[:mitad])
            reciente = statistics.mean(montos[mitad:])
            if antiguo > 0:
                tendencia_pct = ((reciente - antiguo) / antiguo) * 100
        # cap: con una base "antigua" cercana a cero el % explota (varias
        # lineas nuevas pasan de casi 0 a montos reales) y desborda la
        # columna NUMERIC(6,3) — un +/-999% ya no aporta info adicional
        # como senial de tendencia, se recorta.
        tendencia_pct = max(-999.0, min(999.0, tendencia_pct))

        objetivo_legacy = objetivo_ref.get(linea_id, {}).get(mes)

        inserts.append({
            "company_id": company_id, "linea_id": linea_id, "mes": mes,
            "promedio_gs": round(promedio_gs), "promedio_unidades": round(promedio_unidades, 2),
            "tendencia_pct": round(tendencia_pct, 3), "desvio_gs": round(desvio_gs),
            "objetivo_legacy": round(objetivo_legacy) if objetivo_legacy else None,
        })

    if inserts:
        await db.execute(text("""
            INSERT INTO sales_target_history_baseline
              (company_id, product_line_id, mes, promedio_gs, promedio_unidades, tendencia_pct, desvio_gs, objetivo_legacy_ref_gs)
            VALUES (:company_id, :linea_id, :mes, :promedio_gs, :promedio_unidades, :tendencia_pct, :desvio_gs, :objetivo_legacy)
            ON CONFLICT (company_id, product_line_id, mes) DO UPDATE SET
              promedio_gs = EXCLUDED.promedio_gs, promedio_unidades = EXCLUDED.promedio_unidades,
              tendencia_pct = EXCLUDED.tendencia_pct, desvio_gs = EXCLUDED.desvio_gs,
              objetivo_legacy_ref_gs = EXCLUDED.objetivo_legacy_ref_gs, calculado_at = now()
        """), inserts)

    return {"lineas_procesadas": len(por_linea_mes), "combinaciones_linea_mes": len(inserts)}
