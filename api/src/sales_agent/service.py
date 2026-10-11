# Service layer for Gerente de Ventas IA
import uuid
import json
import logging
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from typing import Optional, Any
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from api.src.config import settings
from api.src.sales_agent.schemas import (
    SalesRentabilidadExecutive,
    PriceProposal,
    PriceTierScale,
    DailyActionItem,
    ActionOutcome,
    ChatMessageResponse,
    ParetoResponse,
    ParetoSummary,
    ParetoItem,
    MarginSimulationResponse,
    CategoryAdjustment,
    SkuAdjustment,
    SalesAgentSettingsResponse,
    BusinessRuleResponse,
)

logger = logging.getLogger("sales_agent_service")


def _to_dec(val) -> Decimal:
    if val is None:
        return Decimal("0")
    if isinstance(val, Decimal):
        return val
    return Decimal(str(val))


def round_retail_price(price: float) -> Decimal:
    """Redondea al punto de precio comercial natural de supermercado en Paraguay (PYG)."""
    if price < 5000:
        return Decimal(str(int(round(price / 50.0) * 50)))
    elif price < 20000:
        return Decimal(str(int(round(price / 100.0) * 100)))
    else:
        return Decimal(str(int(round(price / 500.0) * 500)))


def _get_period_clause(periodo_tipo: str = "mes_actual", fecha_desde: Optional[datetime] = None, fecha_hasta: Optional[datetime] = None) -> tuple[str, dict]:
    """Genera la clausula WHERE y parametros para el rango de fechas analizado."""
    now = datetime.now(timezone.utc)
    if periodo_tipo == "mes_anterior":
        first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_of_prev_month = first_of_this_month - timedelta(seconds=1)
        first_of_prev_month = last_of_prev_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return "s.fecha >= :f_desde AND s.fecha <= :f_hasta", {
            "f_desde": first_of_prev_month,
            "f_hasta": last_of_prev_month,
            "period_label": first_of_prev_month.strftime("%B %Y")
        }
    elif periodo_tipo == "ultimos_30_dias":
        f_desde = now - timedelta(days=30)
        return "s.fecha >= :f_desde AND s.fecha <= :f_hasta", {
            "f_desde": f_desde,
            "f_hasta": now,
            "period_label": "Últimos 30 Días"
        }
    elif periodo_tipo == "personalizado" and fecha_desde and fecha_hasta:
        return "s.fecha >= :f_desde AND s.fecha <= :f_hasta", {
            "f_desde": fecha_desde,
            "f_hasta": fecha_hasta,
            "period_label": f"{fecha_desde.strftime('%d/%m/%Y')} - {fecha_hasta.strftime('%d/%m/%Y')}"
        }
    else:
        # Mes en curso MTD (Default)
        first_day = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        meses_es = {1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
                    7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"}
        nombre_mes = f"{meses_es.get(now.month, now.strftime('%B'))} {now.year} MTD"
        return "s.fecha >= :f_desde AND s.fecha <= :f_hasta", {
            "f_desde": first_day,
            "f_hasta": now,
            "period_label": nombre_mes
        }


async def get_company_settings(db: AsyncSession, company_id: str) -> dict:
    """Obtiene las metas comerciales configurables de la empresa."""
    res = await db.execute(text("""
        SELECT target_margen_minimo_pct, target_margen_ideal_pct, metas_por_categoria
        FROM sales_agent_settings
        WHERE company_id = :cid
    """), {"cid": company_id})
    row = res.mappings().first()
    if row:
        return {
            "min_pct": float(row["target_margen_minimo_pct"] or 20.0),
            "ideal_pct": float(row["target_margen_ideal_pct"] or 24.0),
            "metas_por_categoria": dict(row["metas_por_categoria"] or {})
        }
    return {
        "min_pct": 20.0,
        "ideal_pct": 24.0,
        "metas_por_categoria": {
            "Carnicería": 24.0,
            "Bebidas": 16.0,
            "PARESA": 16.0,
            "Lácteos": 18.0,
            "Almacén": 22.0,
            "Verdulería": 28.0,
            "Fiambrería": 26.0
        }
    }


async def update_company_settings(
    db: AsyncSession,
    company_id: str,
    target_min: float,
    target_ideal: float,
    metas_por_categoria: Optional[dict[str, float]] = None
) -> dict:
    """Actualiza las metas comerciales configurables de la empresa."""
    metas_json = json.dumps(metas_por_categoria or {})
    await db.execute(text("""
        INSERT INTO sales_agent_settings (company_id, target_margen_minimo_pct, target_margen_ideal_pct, metas_por_categoria, updated_at)
        VALUES (:cid, :tmin, :tideal, CAST(:metas AS jsonb), NOW())
        ON CONFLICT (company_id) DO UPDATE
        SET target_margen_minimo_pct = EXCLUDED.target_margen_minimo_pct,
            target_margen_ideal_pct = EXCLUDED.target_margen_ideal_pct,
            metas_por_categoria = EXCLUDED.metas_por_categoria,
            updated_at = NOW();
    """), {
        "cid": company_id,
        "tmin": target_min,
        "tideal": target_ideal,
        "metas": metas_json
    })
    await db.commit()
    return {"success": True, "target_margen_minimo_pct": target_min, "target_margen_ideal_pct": target_ideal}


async def get_executive_analysis(
    db: AsyncSession,
    company_id: str,
    periodo_tipo: str = "mes_actual",
    fecha_desde: Optional[datetime] = None,
    fecha_hasta: Optional[datetime] = None
) -> SalesRentabilidadExecutive:
    """Calcula la rentabilidad real con datos de PostgreSQL sobre ventas confirmadas/completadas,
    evalúa el cumplimiento de metas y proyecta el cierre del período."""
    
    where_period, params = _get_period_clause(periodo_tipo, fecha_desde, fecha_hasta)
    params["cid"] = company_id
    period_label = params.get("period_label", "Período Actual")

    # Metas de la empresa
    cfg = await get_company_settings(db, company_id)
    target_min = cfg["min_pct"]
    target_ideal = cfg["ideal_pct"]
    metas_cats = cfg["metas_por_categoria"]

    # 1. Ventas y CMV del Período
    totales_query = await db.execute(text(f"""
        SELECT 
            COALESCE(SUM(si.total), 0) AS total_facturado,
            COALESCE(SUM(COALESCE(si.costo_unitario, p.costo_promedio, p.ultimo_costo, si.precio_unitario * 0.75) * si.cantidad), 0) AS total_cmv,
            COUNT(DISTINCT s.id) AS total_tickets,
            COUNT(DISTINCT p.id) AS total_skus,
            EXTRACT(DAY FROM CURRENT_DATE) AS dia_actual,
            EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')) AS dias_mes
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        JOIN sales s ON s.id = si.sale_id
        WHERE s.company_id = :cid AND s.estado IN ('completado', 'confirmado')
          AND {where_period}
    """), params)
    tot_row = totales_query.mappings().first()

    facturacion_total = _to_dec(tot_row["total_facturado"] if tot_row else 0).quantize(Decimal("1"))
    costo_total = _to_dec(tot_row["total_cmv"] if tot_row else 0).quantize(Decimal("1"))
    tickets_mes = int(tot_row["total_tickets"] or 0) if tot_row else 0
    dia_actual = float(tot_row["dia_actual"] or 15) if tot_row else 15.0
    dias_mes = float(tot_row["dias_mes"] or 31) if tot_row else 31.0

    ganancia_bruta = (facturacion_total - costo_total).quantize(Decimal("1"))
    margen_actual_pct = float(((ganancia_bruta / facturacion_total) * 100).quantize(Decimal("0.1"))) if facturacion_total > 0 else 0.0

    # Proyección lineal (run-rate para mes en curso)
    if periodo_tipo == "mes_actual":
        proyeccion_cierre_gs = Decimal(str(int(round((float(facturacion_total) / max(1.0, dia_actual)) * dias_mes))))
    else:
        proyeccion_cierre_gs = facturacion_total

    # Cálculo de Gaps en Guaraníes según metas
    meta_min_ganancia = (facturacion_total * Decimal(str(target_min / 100.0))).quantize(Decimal("1"))
    meta_ideal_ganancia = (facturacion_total * Decimal(str(target_ideal / 100.0))).quantize(Decimal("1"))

    gap_min_gs = max(Decimal("0"), meta_min_ganancia - ganancia_bruta).quantize(Decimal("1"))
    gap_ideal_gs = max(Decimal("0"), meta_ideal_ganancia - ganancia_bruta).quantize(Decimal("1"))

    estado_salud = "optimo" if margen_actual_pct >= target_ideal else "saludable" if margen_actual_pct >= target_min else "regular" if margen_actual_pct >= 15.0 else "critico"

    # 2. Desglose Real por Categoría
    cats_query = await db.execute(text(f"""
        SELECT 
            COALESCE(c.nombre, 'Almacén General') AS categoria,
            COUNT(si.id) AS transacciones,
            SUM(si.cantidad) AS unidades,
            SUM(si.total) AS facturacion,
            SUM(COALESCE(si.costo_unitario, p.costo_promedio, p.ultimo_costo, si.precio_unitario * 0.75) * si.cantidad) AS cmv
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        LEFT JOIN product_categories c ON c.id = p.categoria_id
        JOIN sales s ON s.id = si.sale_id
        WHERE s.company_id = :cid AND s.estado IN ('completado', 'confirmado')
          AND {where_period}
        GROUP BY c.nombre
        ORDER BY facturacion DESC
        LIMIT 15;
    """), params)

    depts = []
    for r in cats_query.mappings().all():
        cat_fact = _to_dec(r["facturacion"]).quantize(Decimal("1"))
        cat_cmv = _to_dec(r["cmv"]).quantize(Decimal("1"))
        cat_ganancia = cat_fact - cat_cmv
        cat_margen = float(((cat_ganancia / cat_fact) * 100).quantize(Decimal("0.1"))) if cat_fact > 0 else 0.0
        cat_name = str(r["categoria"])

        target_sug = metas_cats.get(cat_name, 22.0)
        if "CARNE" in cat_name.upper():
            target_sug = metas_cats.get(cat_name, 24.0)
            est_estado = "excelente" if cat_margen >= target_sug else "bueno"
            estrategia = f"Factura Gs. {int(cat_fact):,d} ({cat_margen}%). Ajustar cortes nobles para converger al {target_sug}%."
        elif "BEBIDA" in cat_name.upper() or "PARESA" in cat_name.upper() or "CERV" in cat_name.upper():
            target_sug = metas_cats.get(cat_name, 16.0)
            est_estado = "gancho"
            estrategia = f"Flujo masivo (Gs. {int(cat_fact):,d}). Sostener KVI y forzar combos con hielo/snacks."
        elif "VERDUR" in cat_name.upper() or "FRUT" in cat_name.upper():
            target_sug = metas_cats.get(cat_name, 28.0)
            est_estado = "bueno" if cat_margen >= 22.0 else "regular"
            estrategia = f"Perecedero fresco ({cat_margen}% margen). Calibrar rotación matutina y absorber mermas."
        else:
            est_estado = "excelente" if cat_margen >= target_sug else "regular"
            estrategia = f"Margen {cat_margen}% vs meta {target_sug}%. Oportunidad de venta cruzada en góndola."

        depts.append({
            "departamento": cat_name,
            "facturacion_gs": int(cat_fact),
            "margen_actual_pct": cat_margen,
            "target_sugerido_pct": target_sug,
            "estado": est_estado,
            "estrategia": estrategia,
        })

    # 3. Propuestas de Precios Cuantitativas (Con identificación de KVI)
    skus_query = await db.execute(text(f"""
        SELECT 
            p.id,
            p.nombre,
            COALESCE(c.nombre, 'General') AS categoria,
            ROUND(AVG(si.precio_unitario)) AS precio_venta_real,
            ROUND(AVG(COALESCE(si.costo_unitario, p.costo_promedio, p.ultimo_costo, p.precio_venta * 0.75))) AS costo_real,
            SUM(si.cantidad) AS cant_vendida,
            SUM(si.total) AS facturacion,
            COALESCE(kvi.es_gancho, false) AS es_gancho_db,
            COALESCE(kvi.motivo_gancho, '') AS motivo_gancho_db
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        LEFT JOIN product_categories c ON c.id = p.categoria_id
        LEFT JOIN company_kvi_products kvi ON kvi.product_id = p.id AND kvi.company_id = :cid
        JOIN sales s ON s.id = si.sale_id
        WHERE s.company_id = :cid AND s.estado IN ('completado', 'confirmado')
          AND {where_period}
        GROUP BY p.id, p.nombre, c.nombre, p.precio_venta, kvi.es_gancho, kvi.motivo_gancho
        ORDER BY facturacion DESC
        LIMIT 60;
    """), params)

    skus_rows = skus_query.mappings().all()
    sku_ids = [r["id"] for r in skus_rows]

    # Consultar escalas reales de sp_tiered_prices en PostgreSQL
    tiered_map: dict[uuid.UUID, list[dict]] = {}
    if sku_ids:
        t_query = await db.execute(text("""
            SELECT product_id, min_qty, precio_unitario
            FROM sp_tiered_prices
            WHERE product_id = ANY(:pids) AND activo = true
            ORDER BY product_id, min_qty ASC
        """), {"pids": sku_ids})
        for tr in t_query.mappings().all():
            pid = tr["product_id"]
            if pid not in tiered_map:
                tiered_map[pid] = []
            tiered_map[pid].append(dict(tr))

    propuestas: list[PriceProposal] = []
    p_idx = 1
    for row in skus_rows:
        p_id = row["id"]
        p_nombre = str(row["nombre"])
        p_cat = str(row["categoria"])
        p_actual = _to_dec(row["precio_venta_real"]).quantize(Decimal("1"))
        p_costo = _to_dec(row["costo_real"]).quantize(Decimal("1"))
        p_cant = _to_dec(row["cant_vendida"])
        es_gancho = bool(row["es_gancho_db"])

        m_actual_pct = float(((p_actual - p_costo) / p_actual * 100).quantize(Decimal("0.1"))) if p_actual > 0 else 0.0

        nombre_u = p_nombre.upper()
        if es_gancho:
            target_m = 0.12
            estrategia_tipo = "kvi_gancho"
            motivo = f"Producto Gancho protegido ({row['motivo_gancho_db'] or 'Atrae clientes'}). Mantener precio competitivo."
            p_sug = p_actual
        elif "BRAHMA" in nombre_u or "CERV" in nombre_u:
            target_m = 0.15
            estrategia_tipo = "kvi_gancho"
            motivo = f"KVI cervecero ({int(p_cant):,d} un vendidas). Ajuste al 15% de margen protege rotación."
            raw_sug = float(p_costo) / (1.0 - target_m)
            p_sug = round_retail_price(max(raw_sug, float(p_actual) * 1.02))
        elif "COCA" in nombre_u:
            target_m = 0.18
            estrategia_tipo = "recuperacion_gap"
            motivo = f"Gaseosa masiva ({int(p_cant):,d} un). Nivelación al 18% estándar."
            raw_sug = float(p_costo) / (1.0 - target_m)
            p_sug = round_retail_price(max(raw_sug, float(p_actual) * 1.02))
        elif "COSTILLA" in nombre_u or "CARNE" in nombre_u or "PALETA" in nombre_u or "VACIO" in nombre_u:
            target_m = 0.24
            estrategia_tipo = "margin_driver"
            motivo = f"Corte vacuno noble ({int(p_cant):,d} kg vendidas). Margen óptimo del 24%."
            raw_sug = float(p_costo) / (1.0 - target_m)
            p_sug = round_retail_price(max(raw_sug, float(p_actual) * 1.03))
        elif p_actual <= p_costo:
            target_m = 0.20
            estrategia_tipo = "recuperacion_gap"
            motivo = f"ALERTA: Fuga de margen (Precio venta <= Costo de reposición). Remarcar urgente."
            raw_sug = float(p_costo) / (1.0 - target_m)
            p_sug = round_retail_price(max(raw_sug, float(p_costo) * 1.15))
        else:
            target_m = 0.22
            estrategia_tipo = "recuperacion_gap"
            motivo = f"Ajuste para converger al objetivo global del {target_ideal}%."
            raw_sug = float(p_costo) / (1.0 - target_m)
            p_sug = round_retail_price(max(raw_sug, float(p_actual) * 1.03))

        m_sug_pct = float(((p_sug - p_costo) / p_sug * 100).quantize(Decimal("0.1"))) if p_sug > 0 else 0.0
        impacto_mes = ((p_sug - p_actual) * p_cant).quantize(Decimal("1"))

        escalas_list: list[PriceTierScale] = [
            PriceTierScale(min_qty=1, precio_unitario=p_actual, descuento_pct=0.0, descripcion="Minorista (1 un)")
        ]
        existing_tiers = tiered_map.get(p_id, [])
        if existing_tiers:
            for t in existing_tiers:
                t_qty = int(t["min_qty"])
                t_price = _to_dec(t["precio_unitario"]).quantize(Decimal("1"))
                desc = float((((p_actual - t_price) / p_actual) * 100).quantize(Decimal("0.1"))) if p_actual > 0 else 0.0
                desc_label = f"Pack ({t_qty} un)" if t_qty <= 4 else f"Mayorista ({t_qty}+ un)"
                escalas_list.append(PriceTierScale(min_qty=t_qty, precio_unitario=t_price, descuento_pct=max(0.0, desc), descripcion=desc_label))
        else:
            escalas_list.append(PriceTierScale(min_qty=3, precio_unitario=round_retail_price(float(p_actual) * 0.96), descuento_pct=4.0, descripcion="Pack x3 un"))
            escalas_list.append(PriceTierScale(min_qty=6, precio_unitario=round_retail_price(float(p_actual) * 0.90), descuento_pct=10.0, descripcion="Mayorista / Fardo x6 un"))

        propuestas.append(PriceProposal(
            id=f"prop-{p_idx}",
            product_id=p_id,
            nombre=p_nombre,
            categoria=p_cat,
            precio_actual=p_actual,
            costo_unitario=p_costo,
            margen_actual_pct=m_actual_pct,
            precio_sugerido=p_sug,
            margen_sugerido_pct=m_sug_pct,
            impacto_mensual_gs=impacto_mes,
            tipo_estrategia=estrategia_tipo,
            motivo=motivo,
            escalas_precio=escalas_list,
            estado="pendiente",
        ))
        p_idx += 1

    # 4. Plan de Acción Diario desde Base de Datos o Generación Inicial
    tasks_query = await db.execute(text("""
        SELECT id, titulo, descripcion, area, prioridad, estado, impacto_estimado, responsable_sugerido
        FROM sales_action_tasks
        WHERE company_id = :cid
        ORDER BY CASE prioridad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, created_at DESC
        LIMIT 10
    """), {"cid": company_id})
    task_rows = tasks_query.mappings().all()

    plan_diario: list[DailyActionItem] = []
    if task_rows:
        for t in task_rows:
            plan_diario.append(DailyActionItem(
                id=str(t["id"]),
                titulo=t["titulo"],
                area=t["area"],
                descripcion=t["descripcion"],
                impacto_esperado=t["impacto_estimado"] or "+Gs. 5.0M / mes",
                responsable_sugerido=t["responsable_sugerido"] or "Encargado de Área",
                prioridad=t["prioridad"],
                estado=t["estado"]
            ))
    else:
        seed_tasks = [
            ("Ajuste fino de precios en Carnicería (Cortes Nobles)", "Carnicería", "Remarcar Costilla de Primera y Cortes Nobles para converger al margen del 24%.", "+Gs. 8.9M / mes", "Jefe de Carnicería", "critica", "remarcacion"),
            ("Activar Combo Fin de Semana (Cerveza + Carbón + Costilla)", "Salón & POS", "Empaquetar pack de Brahma/Michelob con carbón vegetal de 3kg para capturar 26% de margen.", "+Gs. 4.8M / mes", "Encargado de Salón", "alta", "crear_combo"),
            ("Auditoría de recepción y escalas con PARESA (Coca-Cola)", "Compras & Proveedores", "Revisar escalas de compra por volumen alcanzado y bonificación por fardo.", "+Gs. 5.2M / mes", "Gerente de Compras", "alta", "alerta_whatsapp"),
            ("Control estricto de pesaje y rotación en Verdulería", "Verdulería", "Ajustar rotación matutina y pesaje en recepción para reducir merma oculta por debajo del 3.5%.", "+Gs. 3.1M / mes", "Encargado de Frescos", "media", "auditoria_stock"),
        ]
        for st in seed_tasks:
            t_id = uuid.uuid4()
            await db.execute(text("""
                INSERT INTO sales_action_tasks (id, company_id, titulo, area, descripcion, impacto_estimado, responsable_sugerido, prioridad, estado, tipo_accion)
                VALUES (:id, :cid, :tit, :area, :desc, :imp, :resp, :prio, 'pendiente', :tipo)
            """), {"id": t_id, "cid": company_id, "tit": st[0], "area": st[1], "desc": st[2], "imp": st[3], "resp": st[4], "prio": st[5], "tipo": st[6]})
            plan_diario.append(DailyActionItem(
                id=str(t_id),
                titulo=st[0],
                area=st[1],
                descripcion=st[2],
                impacto_esperado=st[3],
                responsable_sugerido=st[4],
                prioridad=st[5],
                estado="pendiente"
            ))
        await db.commit()

    # Resumen Ejecutivo Dinámico
    resumen = (
        f"En {period_label}, se registraron {tickets_mes:,d} tickets de venta confirmados "
        f"con una facturación de Gs. {int(facturacion_total):,d} y ganancia bruta de Gs. {int(ganancia_bruta):,d} (Margen Real: {margen_actual_pct}%). "
        f"Para alcanzar el margen mínimo del {target_min}% y la meta óptima del {target_ideal}%, el Gap mensual es de Gs. {int(gap_ideal_gs):,d}. "
        f"Se auditaron {len(propuestas)} SKUs con propuestas cuantitativas de margen y escalas por volumen de Ñemuha."
    )

    return SalesRentabilidadExecutive(
        margen_actual_pct=margen_actual_pct,
        margen_minimo_target_pct=target_min,
        margen_ideal_target_pct=target_ideal,
        facturacion_mes=facturacion_total,
        costo_ventas_mes=costo_total,
        ganancia_bruta_mes=ganancia_bruta,
        proyeccion_cierre_mes_gs=proyeccion_cierre_gs,
        tickets_mes=tickets_mes,
        gap_para_20_pct_gs=gap_min_gs,
        gap_para_24_pct_gs=gap_ideal_gs,
        estado_salud_margen=estado_salud,
        resumen_ejecutivo=resumen,
        rentabilidad_por_departamento=depts,
        pareto_resumen={
            "clase_a_pct": 80.0,
            "clase_b_pct": 15.0,
            "clase_c_pct": 5.0,
            "total_skus_activos": len(propuestas),
        },
        propuestas_precios=propuestas,
        plan_accion_diario=plan_diario,
    )


async def apply_price_proposal(
    db: AsyncSession,
    company_id: str,
    product_id: str,
    nuevo_precio: float,
    motivo: str = "Ajuste sugerido por Gerente de Ventas IA",
    escalas: Optional[list[dict]] = None
) -> dict:
    """Aplica de manera real y persistente el cambio de precio sugerido por la IA en la base de datos."""
    prod_query = await db.execute(text("""
        SELECT id, nombre, precio_venta, costo_promedio, ultimo_costo
        FROM products
        WHERE id = :pid AND company_id = :cid
    """), {"pid": product_id, "cid": company_id})
    prod = prod_query.mappings().first()
    if not prod:
        return {"success": False, "error": f"Producto {product_id} no encontrado en la empresa"}

    precio_anterior = _to_dec(prod["precio_venta"] or 0)
    nuevo_precio_dec = _to_dec(nuevo_precio).quantize(Decimal("1"))
    costo_momento = _to_dec(prod["costo_promedio"] or prod["ultimo_costo"] or (float(nuevo_precio_dec) * 0.75)).quantize(Decimal("1"))

    margen_ant_pct = float(((precio_anterior - costo_momento) / precio_anterior * 100).quantize(Decimal("0.1"))) if precio_anterior > 0 else 0.0
    margen_nuevo_pct = float(((nuevo_precio_dec - costo_momento) / nuevo_precio_dec * 100).quantize(Decimal("0.1"))) if nuevo_precio_dec > 0 else 0.0

    # 2. Actualizar precio_venta en products
    await db.execute(text("""
        UPDATE products
        SET precio_venta = :np, updated_at = NOW()
        WHERE id = :pid AND company_id = :cid
    """), {"np": nuevo_precio_dec, "pid": product_id, "cid": company_id})

    # 3. Sincronizar escalas en sp_tiered_prices
    await db.execute(text("""
        DELETE FROM sp_tiered_prices
        WHERE product_id = :pid AND company_id = :cid;
    """), {"pid": product_id, "cid": company_id})

    if escalas and len(escalas) > 0:
        for esc in escalas:
            min_q = int(esc.get("min_qty", 1))
            p_unit = _to_dec(esc.get("precio_unitario", nuevo_precio_dec)).quantize(Decimal("1"))
            await db.execute(text("""
                INSERT INTO sp_tiered_prices (id, company_id, product_id, min_qty, precio_unitario, activo, created_at, updated_at)
                VALUES (gen_random_uuid(), :cid, :pid, :mq, :pu, true, NOW(), NOW());
            """), {"cid": company_id, "pid": product_id, "mq": min_q, "pu": p_unit})
    else:
        p_pack = round_retail_price(float(nuevo_precio_dec) * 0.96)
        p_may = round_retail_price(float(nuevo_precio_dec) * 0.90)
        default_tiers = [(1, nuevo_precio_dec), (3, p_pack), (6, p_may)]
        for mq, pu in default_tiers:
            await db.execute(text("""
                INSERT INTO sp_tiered_prices (id, company_id, product_id, min_qty, precio_unitario, activo, created_at, updated_at)
                VALUES (gen_random_uuid(), :cid, :pid, :mq, :pu, true, NOW(), NOW());
            """), {"cid": company_id, "pid": product_id, "mq": mq, "pu": pu})

    # 4. Registrar auditoría en price_audit_log
    await db.execute(text("""
        INSERT INTO price_audit_log (id, company_id, product_id, precio_anterior, precio_nuevo, costo_unitario_momento, margen_anterior_pct, margen_nuevo_pct, motivo, aplicado_por, created_at)
        VALUES (gen_random_uuid(), :cid, :pid, :pa, :pn, :cm, :ma, :mn, :mot, 'gerente_ventas_ia', NOW())
    """), {
        "cid": company_id,
        "pid": product_id,
        "pa": precio_anterior,
        "pn": nuevo_precio_dec,
        "cm": costo_momento,
        "ma": margen_ant_pct,
        "mn": margen_nuevo_pct,
        "mot": motivo
    })

    await db.commit()
    logger.info(f"[Price Applied] {prod['nombre']}: Gs. {precio_anterior} -> Gs. {nuevo_precio_dec} (Margen: {margen_nuevo_pct}%)")

    return {
        "success": True,
        "product_id": product_id,
        "product_name": prod["nombre"],
        "precio_anterior": float(precio_anterior),
        "precio_nuevo": float(nuevo_precio_dec),
        "nuevo_margen_pct": margen_nuevo_pct,
        "motivo": motivo
    }


async def get_pareto_analysis(
    db: AsyncSession,
    company_id: str,
    periodo_tipo: str = "mes_actual",
    fecha_desde: Optional[datetime] = None,
    fecha_hasta: Optional[datetime] = None,
    metric_type: str = "facturacion",
    search: Optional[str] = None,
    categoria_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50
) -> ParetoResponse:
    """Calcula matemáticamente la clasificación ABC de Pareto 80/20 sobre la base de datos real."""
    where_period, params = _get_period_clause(periodo_tipo, fecha_desde, fecha_hasta)
    params["cid"] = company_id

    grand_totals_query = await db.execute(text(f"""
        SELECT 
            COALESCE(SUM(si.total), 0) AS total_facturacion,
            COALESCE(SUM(si.total - COALESCE(si.costo_unitario, p.costo_promedio, p.ultimo_costo, si.precio_unitario * 0.75) * si.cantidad), 0) AS total_ganancia
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        JOIN sales s ON s.id = si.sale_id
        WHERE s.company_id = :cid AND s.estado IN ('completado', 'confirmado')
          AND {where_period}
    """), params)
    gt_row = grand_totals_query.mappings().first()
    grand_fact = _to_dec(gt_row["total_facturacion"] if gt_row else 0)
    grand_gan = _to_dec(gt_row["total_ganancia"] if gt_row else 0)

    order_col = "facturacion DESC" if metric_type == "facturacion" else "ganancia_bruta DESC"
    target_grand = float(grand_fact if metric_type == "facturacion" else grand_gan) or 1.0

    pareto_query = await db.execute(text(f"""
        WITH sku_agg AS (
            SELECT 
                p.id AS product_id,
                p.codigo_barra,
                p.nombre,
                COALESCE(c.nombre, 'General') AS categoria,
                c.id AS categoria_id,
                SUM(si.cantidad) AS unidades_vendidas,
                SUM(si.total) AS facturacion,
                SUM(COALESCE(si.costo_unitario, p.costo_promedio, p.ultimo_costo, si.precio_unitario * 0.75) * si.cantidad) AS cmv,
                SUM(si.total) - SUM(COALESCE(si.costo_unitario, p.costo_promedio, p.ultimo_costo, si.precio_unitario * 0.75) * si.cantidad) AS ganancia_bruta
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            LEFT JOIN product_categories c ON c.id = p.categoria_id
            JOIN sales s ON s.id = si.sale_id
            WHERE s.company_id = :cid AND s.estado IN ('completado', 'confirmado')
              AND {where_period}
            GROUP BY p.id, p.codigo_barra, p.nombre, c.nombre, c.id
        ),
        ranked AS (
            SELECT 
                *,
                SUM(facturacion) OVER (ORDER BY {order_col} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS facturacion_acumulada,
                SUM(ganancia_bruta) OVER (ORDER BY {order_col} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ganancia_acumulada
            FROM sku_agg
        )
        SELECT * FROM ranked
        ORDER BY {order_col};
    """), params)

    all_rows = pareto_query.mappings().all()
    total_skus = len(all_rows)

    items: list[ParetoItem] = []
    clase_a_count = 0
    clase_b_count = 0
    clase_c_count = 0

    for r in all_rows:
        fact = _to_dec(r["facturacion"]).quantize(Decimal("1"))
        cmv = _to_dec(r["cmv"]).quantize(Decimal("1"))
        gan = _to_dec(r["ganancia_bruta"]).quantize(Decimal("1"))
        m_pct = float(((gan / fact) * 100).quantize(Decimal("0.1"))) if fact > 0 else 0.0

        if metric_type == "facturacion":
            val_acum = float(r["facturacion_acumulada"])
            part_pct = float((float(fact) / target_grand * 100))
            acum_pct = float((val_acum / target_grand * 100))
        else:
            val_acum = float(r["ganancia_acumulada"])
            part_pct = float((float(gan) / target_grand * 100))
            acum_pct = float((val_acum / target_grand * 100))

        if acum_pct <= 80.0 or (len(items) == 0):
            clase = "A"
            clase_a_count += 1
        elif acum_pct <= 95.0:
            clase = "B"
            clase_b_count += 1
        else:
            clase = "C"
            clase_c_count += 1

        items.append(ParetoItem(
            product_id=r["product_id"],
            codigo_barra=r["codigo_barra"],
            nombre=r["nombre"],
            categoria=r["categoria"],
            unidades_vendidas=_to_dec(r["unidades_vendidas"]).quantize(Decimal("1")),
            facturacion_total=fact,
            cmv_total=cmv,
            ganancia_bruta=gan,
            margen_bruto_pct=m_pct,
            participacion_pct=round(part_pct, 2),
            acumulado_pct=round(min(100.0, acum_pct), 2),
            clase=clase
        ))

    filtered = items
    if search:
        s_low = search.lower()
        filtered = [it for it in filtered if s_low in it.nombre.lower() or (it.codigo_barra and s_low in it.codigo_barra.lower())]
    if categoria_id:
        filtered = [it for it in filtered if it.categoria.lower() == categoria_id.lower()]

    start = (page - 1) * page_size
    paged = filtered[start:start + page_size]

    resumen = ParetoSummary(
        total_skus=total_skus,
        facturacion_total=grand_fact,
        ganancia_total=grand_gan,
        clase_a_skus=clase_a_count,
        clase_a_pct=round((clase_a_count / max(1, total_skus) * 100), 1),
        clase_b_skus=clase_b_count,
        clase_b_pct=round((clase_b_count / max(1, total_skus) * 100), 1),
        clase_c_skus=clase_c_count,
        clase_c_pct=round((clase_c_count / max(1, total_skus) * 100), 1),
    )

    return ParetoResponse(
        resumen=resumen,
        items=paged,
        total_items=len(filtered),
        page=page,
        page_size=page_size
    )


async def simulate_margin_elasticity(
    db: AsyncSession,
    company_id: str,
    periodo_tipo: str = "mes_actual",
    fecha_desde: Optional[datetime] = None,
    fecha_hasta: Optional[datetime] = None,
    ajustes_categoria: list[CategoryAdjustment] = None,
    ajustes_sku: list[SkuAdjustment] = None
) -> MarginSimulationResponse:
    """Simula el impacto de remarcaciones por categoría con elasticidad de demanda estimada."""
    base = await get_executive_analysis(db, company_id, periodo_tipo, fecha_desde, fecha_hasta)
    
    cat_map = {adj.categoria.upper(): adj.variacion_pct for adj in (ajustes_categoria or [])}
    sku_map = {adj.product_id: adj.nuevo_precio for adj in (ajustes_sku or [])}

    elasticidades = {
        "BEBIDAS": -0.7, "PARESA": -0.7, "CERVEZAS": -0.8, "LACTEOS": -0.6,
        "CARNICERIA": -0.3, "FIAMBRERIA": -0.35, "VERDULERIA": -0.4, "ALMACEN": -0.5
    }

    fact_base_total = float(base.facturacion_mes)
    costo_base_total = float(base.costo_ventas_mes)

    nueva_fact_total = 0.0
    nuevo_costo_total = 0.0
    desglose_cats = []

    for d in base.rentabilidad_por_departamento:
        cat_name = d["departamento"]
        f_cat = float(d["facturacion_gs"])
        m_actual = float(d["margen_actual_pct"])
        c_cat = f_cat * (1.0 - (m_actual / 100.0))

        delta_p_pct = cat_map.get(cat_name.upper(), 0.0) / 100.0
        elast = -0.5
        for k_el, v_el in elasticidades.items():
            if k_el in cat_name.upper():
                elast = v_el
                break

        delta_q_pct = elast * delta_p_pct
        nuevo_q_factor = max(0.2, 1.0 + delta_q_pct)

        nuevo_f_cat = f_cat * (1.0 + delta_p_pct) * nuevo_q_factor
        nuevo_c_cat = c_cat * nuevo_q_factor
        nueva_gan_cat = nuevo_f_cat - nuevo_c_cat
        nuevo_m_cat = (nueva_gan_cat / nuevo_f_cat * 100.0) if nuevo_f_cat > 0 else 0.0

        nueva_fact_total += nuevo_f_cat
        nuevo_costo_total += nuevo_c_cat

        desglose_cats.append({
            "departamento": cat_name,
            "variacion_precio_pct": round(delta_p_pct * 100, 1),
            "variacion_volumen_estimada_pct": round(delta_q_pct * 100, 1),
            "margen_actual_pct": m_actual,
            "margen_simulado_pct": round(nuevo_m_cat, 1),
            "ganancia_adicional_gs": int(nueva_gan_cat - (f_cat - c_cat))
        })

    for prop in base.propuestas_precios:
        if prop.product_id in sku_map:
            p_sug_custom = float(sku_map[prop.product_id])
            p_act = float(prop.precio_actual)
            cost = float(prop.costo_unitario)
            if p_act > 0:
                delta_p = (p_sug_custom - p_act) / p_act
                q_adj = max(0.5, 1.0 + (-0.4 * delta_p))
                diff_ganancia = ((p_sug_custom - cost) * q_adj) - (p_act - cost)
                nueva_fact_total += diff_ganancia

    nueva_ganancia_total = nueva_fact_total - nuevo_costo_total
    ganancia_base_total = fact_base_total - costo_base_total
    ganancia_adicional_gs = max(0.0, nueva_ganancia_total - ganancia_base_total)

    margen_simulado_pct = (nueva_ganancia_total / nueva_fact_total * 100.0) if nueva_fact_total > 0 else 0.0
    gap_actual_gs = float(base.gap_para_24_pct_gs)
    gap_restante_gs = max(0.0, gap_actual_gs - ganancia_adicional_gs)
    reduccion_gap_pct = min(100.0, (ganancia_adicional_gs / max(1.0, gap_actual_gs) * 100.0))

    return MarginSimulationResponse(
        margen_actual_pct=base.margen_actual_pct,
        margen_simulado_pct=round(margen_simulado_pct, 1),
        facturacion_base=_to_dec(int(fact_base_total)),
        facturacion_simulada=_to_dec(int(nueva_fact_total)),
        ganancia_adicional_gs=_to_dec(int(ganancia_adicional_gs)),
        gap_actual_gs=_to_dec(int(gap_actual_gs)),
        gap_restante_gs=_to_dec(int(gap_restante_gs)),
        reduccion_gap_pct=round(reduccion_gap_pct, 1),
        desglose_categorias=desglose_cats
    )


async def toggle_kvi_product(
    db: AsyncSession,
    company_id: str,
    product_id: str,
    es_gancho: bool,
    motivo: str = "Producto gancho / KVI protegido de subas",
    margen_techo_pct: float = 15.0
) -> dict:
    """Marca o desmarca un producto como Producto Gancho (KVI) para protegerlo contra aumentos de precio."""
    await db.execute(text("""
        INSERT INTO company_kvi_products (id, company_id, product_id, es_gancho, margen_techo_pct, motivo_gancho, created_at, updated_at)
        VALUES (gen_random_uuid(), :cid, :pid, :eg, :mt, :mot, NOW(), NOW())
        ON CONFLICT (company_id, product_id) DO UPDATE
        SET es_gancho = EXCLUDED.es_gancho,
            motivo_gancho = EXCLUDED.motivo_gancho,
            margen_techo_pct = EXCLUDED.margen_techo_pct,
            updated_at = NOW();
    """), {
        "cid": company_id,
        "pid": product_id,
        "eg": es_gancho,
        "mt": margen_techo_pct,
        "mot": motivo
    })
    await db.commit()
    return {"success": True, "product_id": product_id, "es_gancho": es_gancho, "motivo": motivo}


async def save_business_rule(
    db: AsyncSession,
    company_id: str,
    regla: str,
    categoria: str = "comercial",
    origen: str = "usuario_decision"
) -> dict:
    """Registra una regla de negocio aprendida por el Gerente IA en la base de datos."""
    rule_id = uuid.uuid4()
    await db.execute(text("""
        INSERT INTO company_business_rules (id, company_id, regla, categoria, origen, activa, confianza, created_at)
        VALUES (:id, :cid, :reg, :cat, :orig, true, 1.00, NOW())
    """), {
        "id": rule_id,
        "cid": company_id,
        "reg": regla,
        "cat": categoria,
        "orig": origen
    })
    await db.commit()
    return {"id": str(rule_id), "regla": regla, "categoria": categoria}


async def list_business_rules(db: AsyncSession, company_id: str) -> list[BusinessRuleResponse]:
    """Lista las reglas aprendidas por el agente en la empresa."""
    res = await db.execute(text("""
        SELECT id, regla, categoria, origen, activa, confianza, created_at
        FROM company_business_rules
        WHERE company_id = :cid AND activa = true
        ORDER BY created_at DESC
        LIMIT 30;
    """), {"cid": company_id})
    return [
        BusinessRuleResponse(
            id=r["id"],
            regla=r["regla"],
            categoria=r["categoria"],
            origen=r["origen"],
            activa=r["activa"],
            confianza=float(r["confianza"] or 1.0),
            created_at=r["created_at"]
        )
        for r in res.mappings().all()
    ]


async def update_action_task_status(
    db: AsyncSession,
    company_id: str,
    task_id: str,
    estado: str,
    motivo_descarte: Optional[str] = None,
    completado_por: Optional[str] = None
) -> dict:
    """Actualiza el estado de una tarea operativa del plan de acción diario. Si se descarta con motivo, aprende la regla."""
    await db.execute(text("""
        UPDATE sales_action_tasks
        SET estado = :st, motivo_descarte = :md, completado_por = :cp, updated_at = NOW()
        WHERE id = :tid AND company_id = :cid
    """), {
        "st": estado,
        "md": motivo_descarte,
        "cp": completado_por,
        "tid": task_id,
        "cid": company_id
    })
    
    if estado == "descartado" and motivo_descarte:
        await save_business_rule(
            db, company_id,
            f"Preferencia operativa: Tarea descartada con motivo: {motivo_descarte}",
            categoria="operaciones",
            origen="tarea_descartada"
        )

    await db.commit()
    return {"success": True, "task_id": task_id, "estado": estado}


async def execute_action_task(
    db: AsyncSession,
    company_id: str,
    task_id: str,
    tipo_accion: str,
    telefono_whatsapp: Optional[str] = None
) -> dict:
    """Ejecuta de forma directa 1-Click una acción operativa (alerta WhatsApp o aplicación de remarcación)."""
    task_query = await db.execute(text("""
        SELECT id, titulo, descripcion, payload_accion, area
        FROM sales_action_tasks
        WHERE id = :tid AND company_id = :cid
    """), {"tid": task_id, "cid": company_id})
    t_row = task_query.mappings().first()
    if not t_row:
        return {"success": False, "error": "Tarea no encontrada"}

    payload = dict(t_row["payload_accion"] or {})
    resultado_ejecucion = {}

    if tipo_accion == "alerta_whatsapp":
        dest_phone = telefono_whatsapp or payload.get("telefono") or "595981000000"
        clean_phone = "".join(c for c in dest_phone if c.isdigit())
        msg_text = (
            f"🚨 *Directiva del Gerente de Ventas IA - Extra Supermercado*\n\n"
            f"*Área:* {t_row['area']}\n"
            f"*Acción:* {t_row['titulo']}\n\n"
            f"{t_row['descripcion']}\n\n"
            f"Por favor confirmar recepción y ejecución en salón/góndola."
        )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                evo_url = f"{settings.evolution_api_url}/message/sendText/{settings.evolution_instance_name}"
                resp = await client.post(
                    evo_url,
                    headers={"apikey": settings.evolution_api_key},
                    json={"number": clean_phone, "text": msg_text}
                )
                resultado_ejecucion = {"whatsapp_status": resp.status_code, "sent_to": clean_phone}
        except Exception as e:
            logger.error(f"Error enviando directiva WhatsApp: {e}")
            resultado_ejecucion = {"whatsapp_error": str(e)}

    elif tipo_accion == "remarcacion":
        pid = payload.get("product_id")
        p_sug = payload.get("precio_sugerido")
        if pid and p_sug:
            res_apply = await apply_price_proposal(db, company_id, str(pid), float(p_sug), f"Ejecución 1-Click desde Tarea: {t_row['titulo']}")
            resultado_ejecucion = res_apply

    await db.execute(text("""
        UPDATE sales_action_tasks
        SET estado = 'completado', completado_por = 'ejecucion_1click', updated_at = NOW()
        WHERE id = :tid AND company_id = :cid
    """), {"tid": task_id, "cid": company_id})
    await db.commit()

    return {"success": True, "task_id": task_id, "tipo_accion": tipo_accion, "resultado": resultado_ejecucion}
