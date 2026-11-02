"""Reports service — async database queries for all report types

Nota: consultas migradas a los nombres reales del esquema (modelos ORM):
  ventas→sales, ventas_items→sale_items, productos→products,
  categorias→product_categories, clientes→customers.
  Columnas: monto_total→total, monto_iva_10→iva_10, monto_iva_5→iva_5,
  monto_base_iva_10→base_gravada_10, monto_base_iva_5→base_gravada_5,
  monto_exento→base_exenta, cliente_id→customer_id, venta_id→sale_id,
  producto_id→product_id, precio_total→total, categoria_id→category_id,
  costo_promedio→costo_unitario, reservada→cantidad_reservada,
  anulado=false → estado <> 'cancelado'.
"""

from datetime import date, timedelta
from typing import Optional
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from api.src.financial.models import SupplierInvoice
from api.src.common.money import gs


async def _exec(db: AsyncSession, query: str, params: Optional[dict] = None):
    result = await db.execute(text(query), params or {})
    return result.mappings()


def margen_bruto(monto_total: float, iva: float, costo: float) -> dict:
    """Utilidad bruta = venta SIN IVA - costo. El costo de compra se guarda sin IVA,
    así que restarlo de la venta con IVA contaría el IVA como ganancia. Sin valores supuestos:
    si el costo supera la venta, el margen sale negativo."""
    monto_sin_iva = int(monto_total - iva)
    costo_total = int(gs(costo))
    margen = monto_sin_iva - costo_total
    pct = round(margen / monto_sin_iva * 100.0, 2) if monto_sin_iva else 0.0
    return {"monto_sin_iva": monto_sin_iva, "costo_total": costo_total, "margen_bruto_gs": margen, "margen_bruto_pct": pct}


_SIN_SUCURSAL = "00000000-0000-0000-0000-000000000000"
_CAMPOS_RESUMEN = ("total_ventas", "monto_total", "monto_iva_10", "monto_iva_5", "total_pagado", "saldo_pendiente",
                   "total_items", "costo_total", "items_sin_costo", "venta_lineas", "iva_lineas",
                   "ventas_sin_importe", "paresa_uc")
# Un mes cerrado entra al resumen guardado pasados estos dias: antes la reconciliacion
# con el legacy (ultimos 7 dias) todavia puede cambiarle lineas.
_DIAS_GRACIA = 10


def _inicio_mes(d: date) -> date:
    return d.replace(day=1)


def _mes_siguiente(d: date) -> date:
    return (d.replace(day=28) + timedelta(days=4)).replace(day=1)


def _tramo_cache(fecha_desde: Optional[date], fecha_hasta: Optional[date], hoy: date):
    """Meses completos [ini, fin) que salen del resumen guardado; ini None = desde el principio.
    None si el rango no contiene ningun mes cerrado completo."""
    ini = None if fecha_desde is None else (fecha_desde if fecha_desde.day == 1 else _mes_siguiente(fecha_desde))
    fin = _inicio_mes(hoy - timedelta(days=_DIAS_GRACIA))
    if fecha_hasta is not None:
        fin = min(fin, _inicio_mes(fecha_hasta + timedelta(days=1)))
    if ini is not None and ini >= fin:
        return None
    return ini, fin


def _where_ventas(company_id, desde, hasta_excl, branch_id):
    params = {}
    where = "v.estado <> 'cancelado'"
    if company_id:
        where += " AND v.company_id = :company_id"
        params["company_id"] = company_id
    if desde:
        where += " AND v.fecha >= :desde"
        params["desde"] = desde
    if hasta_excl:
        where += " AND v.fecha < :hasta_excl"
        params["hasta_excl"] = hasta_excl
    if branch_id:
        where += " AND v.branch_id = :branch_id"
        params["branch_id"] = branch_id
    return where, params


async def _resumen_por_mes(db: AsyncSession, company_id, desde, hasta_excl, branch_id) -> list:
    """Totales de ventas por (mes, sucursal) calculados en vivo."""
    where, params = _where_ventas(company_id, desde, hasta_excl, branch_id)
    query = f"""
        WITH filtered_sales AS (
            SELECT v.id, date_trunc('month', v.fecha)::date as mes, v.branch_id,
                   v.total, v.iva_10, v.iva_5, v.total_pagado, v.saldo, v.tipo_comprobante
            FROM sales v
            WHERE {where}
        ),
        sales_totals AS (
            SELECT mes, branch_id,
                COUNT(*) as total_ventas,
                COALESCE(SUM(total), 0) as monto_total,
                COALESCE(SUM(iva_10), 0) as monto_iva_10,
                COALESCE(SUM(iva_5), 0) as monto_iva_5,
                COALESCE(SUM(total_pagado), 0) as total_pagado,
                COALESCE(SUM(saldo), 0) as saldo_pendiente
            FROM filtered_sales
            GROUP BY mes, branch_id
        ),
        por_venta AS (
            -- una fila por venta: venta, IVA y costo de sus lineas
            SELECT
                fs.mes, fs.branch_id,
                fs.total as total_cab,
                SUM(ABS(vi.total)) as importe_lineas,
                SUM(vi.cantidad) as cantidad,
                SUM(vi.total) as venta,
                SUM(COALESCE(vi.iva_monto, 0)) as iva,
                SUM(
                    (CASE WHEN fs.tipo_comprobante = 'notacredito' OR vi.total < 0 THEN -1 ELSE 1 END) *
                    COALESCE(NULLIF(vi.costo_unitario, 0), NULLIF(p.costo_promedio, 0), NULLIF(p.ultimo_costo, 0), NULLIF(p.costo_landed, 0), 0) * vi.cantidad
                ) as costo,
                COUNT(*) FILTER (WHERE COALESCE(NULLIF(vi.costo_unitario, 0), NULLIF(p.costo_promedio, 0), NULLIF(p.ultimo_costo, 0), NULLIF(p.costo_landed, 0)) IS NULL) as sin_costo,
                -- cajas unitarias PARESA (las notas de credito restan)
                SUM(
                    (CASE WHEN fs.tipo_comprobante = 'notacredito' THEN -1 ELSE 1 END) * vi.cantidad * COALESCE(p.caja_unitaria_factor, 0)
                ) FILTER (WHERE sp.razon_social ILIKE '%PARAGUAY REFRESCOS%') as uc
            FROM sale_items vi
            JOIN filtered_sales fs ON fs.id = vi.sale_id
            LEFT JOIN products p ON p.id = vi.product_id
            LEFT JOIN suppliers sp ON sp.id = p.supplier_id
            GROUP BY vi.sale_id, fs.mes, fs.branch_id, fs.total
        ),
        items_totals AS (
            -- Utilidad: venta y costo de LAS MISMAS lineas. Se excluye solo la venta con total en la
            -- factura pero sin importe en ninguna linea (migradas antes de 2021: el legacy no guardaba
            -- el importe por linea). Las entregas sin cargo (total 0) si cuentan, con su costo.
            SELECT mes, branch_id,
                COALESCE(SUM(cantidad), 0) as total_items,
                COALESCE(SUM(venta) FILTER (WHERE NOT falta), 0) as venta_lineas,
                COALESCE(SUM(iva) FILTER (WHERE NOT falta), 0) as iva_lineas,
                COALESCE(SUM(costo) FILTER (WHERE NOT falta), 0) as costo_total,
                COUNT(*) FILTER (WHERE falta) as ventas_sin_importe,
                COALESCE(SUM(sin_costo), 0) as items_sin_costo,
                COALESCE(SUM(uc), 0) as paresa_uc
            FROM (SELECT *, (total_cab <> 0 AND importe_lineas = 0) as falta FROM por_venta) pv
            GROUP BY mes, branch_id
        )
        SELECT st.*,
            COALESCE(it.total_items, 0) as total_items,
            COALESCE(it.costo_total, 0) as costo_total,
            COALESCE(it.items_sin_costo, 0) as items_sin_costo,
            COALESCE(it.venta_lineas, 0) as venta_lineas,
            COALESCE(it.iva_lineas, 0) as iva_lineas,
            COALESCE(it.ventas_sin_importe, 0) as ventas_sin_importe,
            COALESCE(it.paresa_uc, 0) as paresa_uc
        FROM sales_totals st
        LEFT JOIN items_totals it ON it.mes = st.mes AND it.branch_id IS NOT DISTINCT FROM st.branch_id
    """
    return [dict(r) for r in (await _exec(db, query, params)).all()]


async def _resumen_guardado(db: AsyncSession, company_id, ini, fin, branch_id) -> list:
    """Filas de sales_summary_monthly para los meses [ini, fin). Los meses cuya firma
    (cantidad y total de ventas por sucursal) ya no coincide se recalculan y se guardan."""
    rango = " AND mes >= :ini" if ini else ""
    p = {"c": company_id, "fin": fin, **({"ini": ini} if ini else {})}
    firma = {}
    for r in (await _exec(db, f"""
        SELECT date_trunc('month', fecha)::date as mes, COALESCE(branch_id, CAST(:z AS uuid)) as b, COUNT(*) as n, SUM(total) as t
        FROM sales WHERE company_id = :c AND estado <> 'cancelado' AND fecha < :fin {rango.replace('mes', 'fecha')}
        GROUP BY 1, 2""", {**p, "z": _SIN_SUCURSAL})).all():
        firma.setdefault(r["mes"], set()).add((str(r["b"]), int(r["n"]), float(r["t"] or 0)))
    guardado, filas = {}, {}
    for r in (await _exec(db, f"SELECT * FROM sales_summary_monthly WHERE company_id = :c AND mes < :fin {rango}", p)).all():
        guardado.setdefault(r["mes"], set()).add((str(r["branch_id"]), int(r["total_ventas"]), float(r["monto_total"])))
        filas.setdefault(r["mes"], []).append(dict(r))
    viejos = sorted(m for m in set(firma) | set(guardado) if firma.get(m) != guardado.get(m))
    if viejos:
        nuevas = [f for f in await _resumen_por_mes(db, company_id, viejos[0], _mes_siguiente(viejos[-1]), None)
                  if f["mes"] in set(viejos)]
        try:
            await db.execute(text("DELETE FROM sales_summary_monthly WHERE company_id = :c AND mes = ANY(:m)"),
                             {"c": company_id, "m": viejos})
            for f in nuevas:
                f["branch_id"] = str(f["branch_id"] or _SIN_SUCURSAL)
                await db.execute(text(f"""
                    INSERT INTO sales_summary_monthly (company_id, mes, branch_id, {', '.join(_CAMPOS_RESUMEN)})
                    VALUES (:c, :mes, :branch_id, {', '.join(':' + k for k in _CAMPOS_RESUMEN)})
                    ON CONFLICT (company_id, mes, branch_id) DO NOTHING"""), {"c": company_id, **f})
            await db.commit()
        except Exception:
            await db.rollback()  # el reporte sale igual; se reintenta en la proxima consulta
        for m in viejos:
            filas.pop(m, None)
        for f in nuevas:
            filas.setdefault(f["mes"], []).append(f)
    todas = [f for fs in filas.values() for f in fs]
    if branch_id:
        todas = [f for f in todas if str(f["branch_id"]) == str(branch_id)]
    return todas


async def get_sales_summary(db: AsyncSession, company_id: Optional[str] = None, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None, branch_id: Optional[str] = None) -> dict:
    hasta_excl = fecha_hasta + timedelta(days=1) if fecha_hasta else None
    tramo = _tramo_cache(fecha_desde, fecha_hasta, date.today()) if company_id else None
    if tramo is None:
        filas = await _resumen_por_mes(db, company_id, fecha_desde, hasta_excl, branch_id)
    else:
        # meses cerrados del resumen guardado; los bordes (mes parcial, mes en curso) en vivo
        ini, fin = tramo
        filas = await _resumen_guardado(db, company_id, ini, fin, branch_id)
        if ini and fecha_desde and fecha_desde < ini:
            filas += await _resumen_por_mes(db, company_id, fecha_desde, ini, branch_id)
        if hasta_excl is None or fin < hasta_excl:
            filas += await _resumen_por_mes(db, company_id, fin, hasta_excl, branch_id)
    result = {k: sum(float(f[k] or 0) for f in filas) for k in _CAMPOS_RESUMEN}

    total_ventas = int(result["total_ventas"] or 0)
    monto_total = float(result["monto_total"] or 0)
    monto_iva_10 = float(result["monto_iva_10"] or 0)
    monto_iva_5 = float(result["monto_iva_5"] or 0)
    m = margen_bruto(float(result["venta_lineas"] or 0), float(result["iva_lineas"] or 0), float(result["costo_total"] or 0))
    costo_total, margen_bruto_gs, margen_bruto_pct = m["costo_total"], m["margen_bruto_gs"], m["margen_bruto_pct"]

    # meta del mes cargada en Metas PARESA
    meta = (await _exec(db, """
        SELECT i.meta FROM supplier_kpi_periods sk
        JOIN supplier_kpi_indicators i ON i.period_id = sk.id AND i.codigo = 'total_compra'
        JOIN suppliers sp ON sp.id = sk.supplier_id
        WHERE sk.company_id = :company_id AND sp.razon_social ILIKE '%PARAGUAY REFRESCOS%'
          AND sk.periodo = date_trunc('month', CAST(:mes AS date))::date
        LIMIT 1
    """, {"company_id": company_id, "mes": fecha_hasta or date.today()})).first() if company_id else None

    return {
        "total_ventas": total_ventas,
        "monto_total": monto_total,
        "monto_iva_10": monto_iva_10,
        "monto_iva_5": monto_iva_5,
        "monto_exento": float(monto_total - monto_iva_10 - monto_iva_5),
        "ticket_promedio": float(monto_total / max(total_ventas, 1)),
        "total_items": int(result["total_items"] or 0),
        "monto_sin_iva": m["monto_sin_iva"],
        "costo_total": costo_total,
        "items_sin_costo": int(result["items_sin_costo"] or 0),
        "ventas_sin_importe": int(result["ventas_sin_importe"] or 0),
        "paresa_uc": round(float(result["paresa_uc"] or 0)),
        "paresa_meta_uc": float(meta["meta"]) if meta and meta["meta"] else None,
        "margen_bruto_gs": margen_bruto_gs,
        "margen_bruto_pct": margen_bruto_pct,
        # OJO: total_pagado/saldo a nivel de venta no son confiables para
        # Casa Gonzalito — el legacy usa un campo MODOPAGO con codigos
        # internos (0, 153, 303, 803, 991...) sin tabla de referencia clara,
        # y RENDIDO esta en 0 para el 100% de las 2.24M ventas migradas.
        # Sumado da un "saldo pendiente" de ~1 billon de Gs, mayor incluso
        # que el total facturado — un numero fabricado, no real. NO usar
        # estos dos campos para mostrar cuentas por cobrar en la UI; el
        # saldo real y confiable esta en customer_accounts.saldo_actual
        # (ver accounts_receivable/service.py y financial summary).
        "total_pagado": float(result["total_pagado"] or 0),
        "saldo_pendiente": float(result["saldo_pendiente"] or 0),
    }


def _lineas_ejecutivas(r: dict) -> list:
    """Las 7 lineas del informe. Linea 1 es venta neta sin IVA (facturas menos notas de
    credito), asi que el resultado no vuelve a restar las NC."""
    return [
        {"orden": 1, "clave": "total_vendido", "concepto": "1. Ventas netas sin IVA", "monto": r["total_vendido"], "tipo": "ingreso", "descripcion": "Facturas menos notas de crédito, sin IVA"},
        {"orden": 2, "clave": "cmv", "concepto": "2. Costo Mercadería Vendida (CMV)", "monto": r["cmv"], "tipo": "costo", "descripcion": "Costo de las mismas líneas vendidas (sin IVA)"},
        {"orden": 3, "clave": "utilidad_bruta", "concepto": "3. Utilidad Bruta", "monto": r["utilidad_bruta"], "tipo": "resultado", "descripcion": "Línea 1 - Línea 2"},
        {"orden": 4, "clave": "margen_bruto_pct", "concepto": "4. % Margen Bruto", "monto": r["margen_bruto_pct"], "tipo": "porcentaje", "descripcion": "Utilidad bruta sobre ventas netas sin IVA"},
        {"orden": 5, "clave": "descuentos_pos", "concepto": "5. Descuentos otorgados", "monto": r["descuentos_pos"], "tipo": "descuento", "descripcion": "Descuentos en líneas de factura (ya restados en la línea 1)"},
        {"orden": 6, "clave": "devoluciones_nc", "concepto": "6. Notas de crédito", "monto": r["devoluciones_nc"], "tipo": "devolucion", "descripcion": "Total con IVA de las notas de crédito (ya restadas en la línea 1)"},
        {"orden": 7, "clave": "resultado_neto", "concepto": "7. Resultado Comercial", "monto": r["resultado_neto"], "tipo": "resultado_final", "descripcion": "Igual a la línea 3: descuentos y NC ya están restados"},
    ]


async def get_executive_sales_profitability(db: AsyncSession, company_id: str, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None, branch_id: Optional[str] = None) -> dict:
    """Informe ejecutivo: utilidad (del mismo resumen que el dashboard), cobro por medio de
    pago y ventas por vendedor. Solo datos registrados; vacio si no hay."""
    s = await get_sales_summary(db, company_id, fecha_desde, fecha_hasta, branch_id)
    where, params = _where_ventas(company_id, fecha_desde, fecha_hasta + timedelta(days=1) if fecha_hasta else None, branch_id)
    cab = (await _exec(db, f"""
        SELECT COUNT(*) FILTER (WHERE v.tipo_comprobante <> 'notacredito') as facturas,
               COALESCE(SUM(v.total) FILTER (WHERE v.tipo_comprobante <> 'notacredito'), 0) as facturado,
               COALESCE(-SUM(v.total) FILTER (WHERE v.tipo_comprobante = 'notacredito'), 0) as nc,
               COALESCE((SELECT SUM(vi.descuento_monto) FROM sale_items vi JOIN sales v ON v.id = vi.sale_id
                         WHERE {where} AND v.tipo_comprobante <> 'notacredito'), 0) as descuentos
        FROM sales v WHERE {where}""", params)).first()
    facturas, facturado = int(cab["facturas"] or 0), float(cab["facturado"] or 0)
    resumen = {
        "total_vendido": s["monto_sin_iva"],
        "cmv": s["costo_total"],
        "utilidad_bruta": s["margen_bruto_gs"],
        "margen_bruto_pct": s["margen_bruto_pct"],
        "descuentos_pos": float(cab["descuentos"] or 0),
        "devoluciones_nc": float(cab["nc"] or 0),
        "resultado_neto": s["margen_bruto_gs"],
        "resultado_neto_pct": s["margen_bruto_pct"],
        "total_tickets": facturas,
        "ticket_promedio": float(gs(facturado / facturas)) if facturas else 0.0,
    }

    # medios de pago registrados; si la venta no tiene pagos cargados (legacy), su condicion
    pagos = (await _exec(db, f"""
        SELECT COALESCE(UPPER(TRIM(sp.forma_pago)), UPPER(v.condicion), 'SIN DATO') as forma_pago,
               COALESCE(sp.moneda, 'PYG') as moneda, COUNT(DISTINCT v.id) as cantidad,
               COALESCE(SUM(COALESCE(sp.monto, v.total)), 0) as monto
        FROM sales v LEFT JOIN sale_payments sp ON sp.sale_id = v.id
        WHERE {where} AND v.tipo_comprobante <> 'notacredito'
        GROUP BY 1, 2 ORDER BY monto DESC""", params)).all()
    total_pagos = sum(float(p["monto"]) for p in pagos)
    etiquetas = {"CONTADO": "Contado (sin detalle de medio de pago)", "CREDITO": "Crédito (cuenta corriente)"}
    medios_pago = [{
        "forma_pago_raw": p["forma_pago"], "moneda": p["moneda"],
        "etiqueta": etiquetas.get(p["forma_pago"], f"{p['forma_pago'].title()} ({p['moneda']})"),
        "cantidad": int(p["cantidad"]), "monto": float(p["monto"]),
        "porcentaje": round(float(p["monto"]) / total_pagos * 100, 2) if total_pagos else 0.0,
    } for p in pagos]

    vend = (await _exec(db, f"""
        SELECT COALESCE(MAX(u.nombre), 'Vendedor ' || v.vendedor_codigo, 'Sin vendedor') as cajera,
               COUNT(*) as tickets, COALESCE(SUM(v.total), 0) as total_ventas
        FROM sales v
        LEFT JOIN track_seller_profiles t ON t.company_id = v.company_id AND t.codigo_vendedor = v.vendedor_codigo
        LEFT JOIN users u ON u.id = t.user_id
        WHERE {where} AND v.tipo_comprobante <> 'notacredito'
        GROUP BY v.vendedor_codigo ORDER BY total_ventas DESC""", params)).all()
    cajeras = [{
        "cajera": r["cajera"], "turnos": None, "tickets": int(r["tickets"]),
        "total_ventas": float(r["total_ventas"]), "descuentos": 0.0,
        "ticket_promedio": float(gs(float(r["total_ventas"]) / int(r["tickets"]))) if r["tickets"] else 0.0,
        "porcentaje_ventas": round(float(r["total_ventas"]) / facturado * 100, 2) if facturado else 0.0,
    } for r in vend]

    return {
        "periodo": {"fecha_desde": str(fecha_desde) if fecha_desde else None, "fecha_hasta": str(fecha_hasta) if fecha_hasta else None},
        "resumen": resumen,
        "lineas_ejecutivas": _lineas_ejecutivas(resumen),
        "medios_pago": medios_pago,
        "cajeras": cajeras,
    }


async def get_sales_by_period(db: AsyncSession, company_id: Optional[str] = None, agrupar_por: str = "dia", fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None, branch_id: Optional[str] = None) -> list:
    params = {}
    where = "v.estado <> 'cancelado'"
    if company_id:
        where += " AND v.company_id = :company_id"
        params["company_id"] = company_id
    if fecha_desde:
        where += " AND v.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND v.fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta
    if branch_id:
        where += " AND v.branch_id = :branch_id"
        params["branch_id"] = branch_id

    group_expr = {
        "hora": "TO_CHAR(v.fecha, 'HH24:00')",
        "dia": "TO_CHAR(v.fecha, 'YYYY-MM-DD')",
        "semana": "TO_CHAR(v.fecha, 'IYYY-IW')",
        "mes": "TO_CHAR(v.fecha, 'YYYY-MM')",
    }
    expr = group_expr.get(agrupar_por, group_expr["dia"])

    query = f"""
        SELECT
            {expr} as periodo,
            COUNT(*) as cantidad,
            COALESCE(SUM(v.total), 0) as monto,
            COALESCE(SUM(v.iva_10), 0) as iva_10
        FROM sales v
        WHERE {where}
        GROUP BY {expr}
        ORDER BY {expr}
    """
    results = (await _exec(db, query, params)).all()
    return [
        {
            "periodo": str(r["periodo"]),
            "cantidad": r["cantidad"],
            "monto": float(r["monto"]),
            "iva_10": float(r["iva_10"]),
            "items": 0,
        }
        for r in results
    ]


async def get_sales_by_category(db: AsyncSession, company_id: Optional[str] = None, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    params = {}
    where = "v.estado <> 'cancelado'"
    if company_id:
        where += " AND v.company_id = :company_id"
        params["company_id"] = company_id
    if fecha_desde:
        where += " AND v.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND v.fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta

    query = f"""
        SELECT
            c.nombre as categoria,
            SUM(vi.cantidad) as cantidad,
            SUM(vi.total) as monto
        FROM sales v
        JOIN sale_items vi ON vi.sale_id = v.id
        JOIN products p ON p.id = vi.product_id
        JOIN product_categories c ON c.id = p.category_id
        WHERE {where}
        GROUP BY c.nombre
        ORDER BY monto DESC
    """
    results = (await _exec(db, query, params)).all()
    total = float(sum(r["monto"] for r in results)) or 1
    return [
        {
            "categoria": r["categoria"],
            "cantidad": int(r["cantidad"]),
            "monto": float(r["monto"]),
            "porcentaje": round((float(r["monto"]) / total) * 100, 1),
        }
        for r in results
    ]


async def get_margin_summary(db: AsyncSession, company_id: str, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> dict:
    """Margen bruto del periodo: el mismo calculo que el dashboard (get_sales_summary)."""
    s = await get_sales_summary(db, company_id, fecha_desde, fecha_hasta)
    return {"monto": float(s["monto_sin_iva"]), "costo": s["costo_total"], "margen_pct": round(s["margen_bruto_pct"], 1)}

async def get_sales_by_product(db: AsyncSession, company_id: Optional[str] = None, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None, limit: int = 50) -> list:
    params = {"limit": limit}
    where = "v.estado <> 'cancelado'"
    if company_id:
        where += " AND v.company_id = :company_id"
        params["company_id"] = company_id
    if fecha_desde:
        where += " AND v.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND v.fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta

    query = f"""
        SELECT
            p.nombre as producto,
            p.sku,
            SUM(vi.cantidad) as cantidad,
            SUM(vi.total) as monto,
            SUM(COALESCE(vi.iva_monto, 0)) as iva,
            SUM(SIGN(vi.total) * vi.costo_unitario * vi.cantidad) as costo
        FROM sales v
        JOIN sale_items vi ON vi.sale_id = v.id
        JOIN products p ON p.id = vi.product_id
        WHERE {where}
        GROUP BY p.nombre, p.sku
        ORDER BY monto DESC
        LIMIT :limit
    """
    results = (await _exec(db, query, params)).all()
    return [
        {
            "producto": r["producto"],
            "sku": r["sku"],
            "cantidad": int(r["cantidad"]),
            "monto": float(r["monto"]),
            "costo": float(r["costo"] or 0),
            "margen": round(margen_bruto(float(r["monto"]), float(r["iva"] or 0), float(r["costo"] or 0))["margen_bruto_pct"], 1),
        }
        for r in results
    ]


async def get_chart_comparison(db: AsyncSession, company_id: Optional[str] = None, agrupar_por: str = "dia", fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    return await get_sales_by_period(db, company_id, agrupar_por, fecha_desde, fecha_hasta)


async def get_sales_by_client(db: AsyncSession, company_id: Optional[str] = None, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    params = {}
    where = "v.estado <> 'cancelado'"
    if fecha_desde:
        where += " AND v.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND v.fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta

    query = f"""
        SELECT
            c.razon_social as cliente,
            c.ruc,
            COUNT(*) as cantidad_compras,
            SUM(v.total) as monto_total,
            MAX(v.fecha) as ultima_compra
        FROM sales v
        JOIN customers c ON c.id = v.customer_id
        WHERE {where}
        GROUP BY c.razon_social, c.ruc
        ORDER BY monto_total DESC
    """
    results = (await _exec(db, query, params)).all()
    return [
        {
            "cliente": r["cliente"],
            "ruc": r["ruc"],
            "cantidad_compras": r["cantidad_compras"],
            "monto_total": float(r["monto_total"]),
            "ultima_compra": str(r["ultima_compra"]) if r["ultima_compra"] else None,
        }
        for r in results
    ]


async def get_inventory_summary(db: AsyncSession, company_id: Optional[str] = None, warehouse_id: Optional[int] = None) -> dict:
    params = {}
    where = "s.cantidad > 0"
    if warehouse_id:
        where += " AND s.warehouse_id = :warehouse_id"
        params["warehouse_id"] = warehouse_id

    query = f"""
        SELECT
            COUNT(DISTINCT s.product_id) as total_productos,
            COALESCE(SUM(s.cantidad), 0) as total_unidades,
            COALESCE(SUM(s.cantidad * COALESCE(s.costo_unitario, 0)), 0) as valor_total
        FROM stock s
        WHERE {where}
    """
    result = (await _exec(db, query, params)).first()

    query_bajo = """
        SELECT COUNT(DISTINCT s.product_id) as bajo_stock
        FROM stock s
        JOIN products p ON p.id = s.product_id
        WHERE s.cantidad - s.cantidad_reservada <= p.stock_minimo AND s.cantidad > 0
    """
    bajo = (await _exec(db, query_bajo)).first()

    query_sin = "SELECT COUNT(DISTINCT s.product_id) as sin_stock FROM stock s WHERE s.cantidad = 0"
    sin = (await _exec(db, query_sin)).first()

    return {
        "total_productos": result["total_productos"] or 0,
        "total_unidades": int(result["total_unidades"] or 0),
        "valor_total": float(result["valor_total"] or 0),
        "valor_costo": float(result["valor_total"] or 0),
        "bajo_stock": bajo["bajo_stock"] or 0,
        "sin_stock": sin["sin_stock"] or 0,
    }


async def get_inventory_detail(db: AsyncSession, company_id: Optional[str] = None, warehouse_id: Optional[int] = None) -> list:
    params = {}
    where = "1=1"
    if warehouse_id:
        where += " AND s.warehouse_id = :warehouse_id"
        params["warehouse_id"] = warehouse_id

    query = f"""
        SELECT
            p.nombre as producto,
            p.sku,
            c.nombre as categoria,
            w.nombre as warehouse,
            s.cantidad,
            s.cantidad_reservada as reservada,
            s.cantidad - s.cantidad_reservada as disponible,
            s.costo_unitario as costo_promedio,
            s.cantidad * COALESCE(s.costo_unitario, 0) as valor_total,
            CASE WHEN s.cantidad - s.cantidad_reservada <= p.stock_minimo THEN true ELSE false END as bajo_stock
        FROM stock s
        JOIN products p ON p.id = s.product_id
        LEFT JOIN product_categories c ON c.id = p.category_id
        JOIN warehouses w ON w.id = s.warehouse_id
        WHERE {where}
        ORDER BY p.nombre
    """
    results = (await _exec(db, query, params)).all()
    return [
        {
            "producto": r["producto"],
            "sku": r["sku"],
            "categoria": r["categoria"],
            "warehouse": r["warehouse"],
            "cantidad": r["cantidad"],
            "reservada": r["reservada"],
            "disponible": r["disponible"],
            "costo_unitario": float(r["costo_promedio"]) if r["costo_promedio"] else 0,
            "valor_total": float(r["valor_total"]) if r["valor_total"] else 0,
            "bajo_stock": r["bajo_stock"],
        }
        for r in results
    ]


async def get_inventory_rotation(db: AsyncSession, company_id: Optional[str] = None, supplier_id: Optional[str] = None) -> list:
    query = """
        SELECT
            p.nombre as producto,
            p.sku,
            COALESCE(SUM(vi.cantidad) FILTER (WHERE v.fecha >= CURRENT_DATE - INTERVAL '30 days'), 0) as ventas_30d,
            COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.product_id = p.id), 0) as stock_actual
        FROM products p
        LEFT JOIN sale_items vi ON vi.product_id = p.id
        LEFT JOIN sales v ON v.id = vi.sale_id AND v.estado <> 'cancelado'
        GROUP BY p.id, p.nombre, p.sku
    """
    results = (await _exec(db, query)).all()
    items = []
    for r in results:
        ventas_30d = int(r["ventas_30d"] or 0)
        stock = int(r["stock_actual"] or 0)
        if ventas_30d > 0:
            dias = round((stock / ventas_30d) * 30, 1)
            clasificacion = "A" if ventas_30d > 100 else "B" if ventas_30d > 30 else "C" if ventas_30d > 5 else "D"
        else:
            dias = 0.0
            clasificacion = "D"

        items.append({
            "producto": r["producto"],
            "sku": r["sku"],
            "ventas_30d": ventas_30d,
            "stock_actual": stock,
            "dias_inventario": dias,
            "clasificacion": clasificacion,
        })

    return sorted(items, key=lambda x: x["ventas_30d"], reverse=True)


def _sql_libro(tipo_libro: str, company_id, fecha_desde, fecha_hasta, resumen: bool = False):
    """SQL del libro IVA (o de su resumen) con bases e IVA guardados en cada comprobante.
    Ventas: sales. Compras: purchase_orders (desglose de la factura del proveedor, ver sync)."""
    a = "v" if tipo_libro == "ventas" else "po"
    params = {}
    where = f"{a}.estado <> 'cancelado'"
    if company_id:
        where += f" AND {a}.company_id = :company_id"
        params["company_id"] = company_id
    if fecha_desde:
        where += f" AND {a}.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += f" AND {a}.fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta
    tabla = "sales v" if tipo_libro == "ventas" else "purchase_orders po"

    if resumen:
        return f"""
            SELECT
                COUNT(*) as total_operaciones,
                COUNT(*) FILTER (WHERE {a}.base_gravada_10 IS NULL) as sin_desglose,
                COALESCE(SUM({a}.base_gravada_5), 0) as total_5,
                COALESCE(SUM({a}.base_gravada_10), 0) as total_10,
                COALESCE(SUM({a}.base_exenta), 0) as total_exento,
                COALESCE(SUM({a}.iva_5), 0) as total_iva_5,
                COALESCE(SUM({a}.iva_10), 0) as total_iva_10,
                COALESCE(SUM({a}.total), 0) as total_general
            FROM {tabla}
            WHERE {where}
        """, params

    if tipo_libro == "ventas":
        return f"""
            SELECT
                (v.fecha AT TIME ZONE 'America/Asuncion')::date as fecha,
                v.numero as nro_comprobante,
                NULL as ruc_emisor,
                c.ruc as ruc_receptor,
                c.razon_social,
                c.condicion_iva,
                v.base_gravada_5 as monto_5,
                v.base_gravada_10 as monto_10,
                v.base_exenta as monto_exento,
                v.iva_5 as iva_5,
                v.iva_10 as iva_10,
                v.total as total
            FROM sales v
            LEFT JOIN customers c ON c.id = v.customer_id
            WHERE {where}
            ORDER BY v.fecha
        """, params
    return f"""
        SELECT
            (po.fecha AT TIME ZONE 'America/Asuncion')::date as fecha,
            po.numero as nro_comprobante,
            s.ruc as ruc_emisor,
            NULL as ruc_receptor,
            s.razon_social,
            'Contribuyente' as condicion_iva,
            po.base_gravada_5 as monto_5,
            po.base_gravada_10 as monto_10,
            po.base_exenta as monto_exento,
            CASE WHEN po.base_gravada_10 IS NULL THEN NULL ELSE po.iva_5 END as iva_5,
            CASE WHEN po.base_gravada_10 IS NULL THEN NULL ELSE po.iva_10 END as iva_10,
            po.total
        FROM purchase_orders po
        JOIN suppliers s ON s.id = po.supplier_id
        WHERE {where}
        ORDER BY po.fecha
    """, params


def _num(x):
    return None if x is None else float(x)


def _fila_libro_compras(r) -> dict:
    """Una compra sin desglose fiscal guardado (legacy antes de 2016) sale con montos vacíos
    y sin_desglose=True: nunca se supone que todo es gravado 10%."""
    return {
        "fecha": str(r["fecha"]) if r["fecha"] else None,
        "nro_comprobante": r["nro_comprobante"],
        "ruc_emisor": r["ruc_emisor"],
        "ruc_receptor": r["ruc_receptor"],
        "razon_social": r["razon_social"],
        "condicion_iva": r["condicion_iva"],
        "monto_5": _num(r["monto_5"]),
        "monto_10": _num(r["monto_10"]),
        "monto_exento": _num(r["monto_exento"]),
        "iva_5": _num(r["iva_5"]),
        "iva_10": _num(r["iva_10"]),
        "total": float(r["total"] or 0),
        "sin_desglose": r["monto_10"] is None,
    }


async def get_fiscal_book(db: AsyncSession, company_id: Optional[str] = None, tipo_libro: str = "ventas", fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    query, params = _sql_libro(tipo_libro, company_id, fecha_desde, fecha_hasta)
    results = (await _exec(db, query, params)).all()
    if tipo_libro != "ventas":
        return [_fila_libro_compras(r) for r in results]
    return [
        {
            "fecha": str(r["fecha"]) if r["fecha"] else None,
            "nro_comprobante": r["nro_comprobante"],
            "ruc_emisor": r["ruc_emisor"],
            "ruc_receptor": r["ruc_receptor"],
            "razon_social": r["razon_social"],
            "condicion_iva": r["condicion_iva"],
            "monto_5": float(r["monto_5"] or 0),
            "monto_10": float(r["monto_10"] or 0),
            "monto_exento": float(r["monto_exento"] or 0),
            "iva_5": float(r["iva_5"] or 0),
            "iva_10": float(r["iva_10"] or 0),
            "total": float(r["total"] or 0),
        }
        for r in results
    ]


async def get_fiscal_summary(db: AsyncSession, company_id: Optional[str] = None, tipo_libro: str = "ventas", fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> dict:
    query, params = _sql_libro(tipo_libro, company_id, fecha_desde, fecha_hasta, resumen=True)
    result = (await _exec(db, query, params)).first()
    out = {
        "total_operaciones": result["total_operaciones"] or 0,
        "total_5": float(result["total_5"] or 0),
        "total_10": float(result["total_10"] or 0),
        "total_exento": float(result["total_exento"] or 0),
        "total_iva_5": float(result["total_iva_5"] or 0),
        "total_iva_10": float(result["total_iva_10"] or 0),
        "total_general": float(result["total_general"] or 0),
    }
    if tipo_libro != "ventas":
        out["sin_desglose"] = result["sin_desglose"] or 0
    return out


async def get_financial_summary(db: AsyncSession, company_id: Optional[str] = None, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> dict:
    params = {}
    where = "estado <> 'cancelado'"
    if fecha_desde:
        where += " AND fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta

    ingresos = (await _exec(db, f"SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE {where}", params)).first()
    # Egresos debe respetar el mismo rango de fechas que ingresos — antes sumaba
    # TODO purchase_orders sin filtro, lo que quedaba oculto con poco volumen pero
    # rompe por completo el resumen apenas hay historico real cargado (ej. el
    # conector incremental de Casa Gonzalito trae ~106K ordenes historicas).
    where_po = "estado <> 'cancelado'"
    if fecha_desde:
        where_po += " AND fecha >= :fecha_desde"
    if fecha_hasta:
        where_po += " AND fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
    egresos = (await _exec(db, f"SELECT COALESCE(SUM(total), 0) as total FROM purchase_orders WHERE {where_po}", params)).first()
    # Cuentas por cobrar: preferir accounts_receivable (detalle real por
    # documento, con vencimiento) cuando existe; si un tenant no tiene
    # accounts_receivable poblada, cae a customer_accounts.saldo_actual
    # (agregado, sin vencimiento). NO sumar ambas — Casa Gonzalito ahora
    # tiene las dos pobladas (el conector migra el detalle Y mantiene el
    # agregado como respaldo), sumarlas duplicaba el mismo saldo dos veces.
    por_cobrar = (await _exec(db, """
        SELECT
            CASE WHEN EXISTS (SELECT 1 FROM accounts_receivable WHERE estado = 'pendiente')
                THEN COALESCE((SELECT SUM(saldo_pendiente) FROM accounts_receivable WHERE estado = 'pendiente'), 0)
                ELSE COALESCE((SELECT SUM(saldo_actual) FROM customer_accounts WHERE saldo_actual > 0), 0)
            END AS total
    """)).first()
    r_ap = await db.execute(
        select(func.coalesce(func.sum(SupplierInvoice.saldo_pendiente), 0))
        .where(SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]))
    )
    por_pagar = {"total": r_ap.scalar()}

    ingresos_total = float(ingresos["total"] or 0)
    egresos_total = float(egresos["total"] or 0)

    return {
        "ingresos": ingresos_total,
        "egresos": egresos_total,
        "saldo": ingresos_total - egresos_total,
        "cuentas_por_cobrar": float(por_cobrar["total"] or 0),
        "cuentas_por_pagar": float(por_pagar["total"] or 0),
        "flujo_caja": ingresos_total - egresos_total,
    }


async def get_financial_by_day(db: AsyncSession, company_id: Optional[str] = None, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    params = {}
    where = "estado <> 'cancelado'"
    if fecha_desde:
        where += " AND fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta

    query = f"""
        SELECT
            DATE(fecha) as fecha,
            COALESCE(SUM(total), 0) as ingresos,
            0 as egresos,
            COALESCE(SUM(total), 0) as saldo
        FROM sales
        WHERE {where}
        GROUP BY DATE(fecha)
        ORDER BY fecha
    """
    results = (await _exec(db, query, params)).all()
    return [
        {
            "fecha": str(r["fecha"]) if r["fecha"] else None,
            "ingresos": float(r["ingresos"]),
            "egresos": float(r["egresos"]),
            "saldo": float(r["saldo"]),
        }
        for r in results
    ]


async def get_fifo_costing(db: AsyncSession, company_id: Optional[str] = None, product_id=None, warehouse_id=None) -> list:
    params = {}
    where = "sl.cantidad_disponible > 0"
    if product_id:
        where += " AND sl.product_id = :product_id"
        params["product_id"] = product_id
    if warehouse_id:
        where += " AND sl.warehouse_id = :warehouse_id"
        params["warehouse_id"] = warehouse_id

    query = f"""
        SELECT
            sl.product_id,
            p.nombre as producto,
            p.sku,
            c.nombre as categoria,
            w.nombre as warehouse,
            sl.id as lot_id,
            sl.cantidad_disponible,
            sl.costo_unitario,
            sl.costo_total,
            sl.fecha_ingreso,
            sl.referencia,
            sl.fecha_vencimiento
        FROM stock_lots sl
        JOIN products p ON p.id = sl.product_id
        LEFT JOIN product_categories c ON c.id = p.category_id
        JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE {where}
        ORDER BY sl.product_id, sl.fecha_ingreso ASC
    """
    results = (await _exec(db, query, params)).all()

    products = {}
    for r in results:
        pid = str(r["product_id"])
        if pid not in products:
            products[pid] = {
                "producto": r["producto"],
                "sku": r["sku"],
                "categoria": r["categoria"],
                "warehouse": r["warehouse"],
                "total_stock": 0,
                "total_costo": 0.0,
                "fifo_costo_unitario": 0.0,
                "lotes": [],
            }

        costo = float(r["costo_unitario"])
        cantidad = int(r["cantidad_disponible"])
        costo_total = float(r["costo_total"])

        products[pid]["total_stock"] += cantidad
        products[pid]["total_costo"] += costo_total
        products[pid]["lotes"].append({
            "lot_id": str(r["lot_id"]),
            "cantidad": cantidad,
            "costo_unitario": costo,
            "costo_total": costo_total,
            "fecha_ingreso": str(r["fecha_ingreso"]),
            "referencia": r["referencia"],
            "fecha_vencimiento": str(r["fecha_vencimiento"]) if r["fecha_vencimiento"] else None,
        })

    for pid, data in products.items():
        if data["total_stock"] > 0:
            data["fifo_costo_unitario"] = round(data["total_costo"] / data["total_stock"], 0)

    return sorted(products.values(), key=lambda x: x["total_stock"], reverse=True)


async def get_lifo_costing(db: AsyncSession, company_id: Optional[str] = None, product_id=None, warehouse_id=None) -> list:
    params = {}
    where = "sl.cantidad_disponible > 0"
    if product_id:
        where += " AND sl.product_id = :product_id"
        params["product_id"] = product_id
    if warehouse_id:
        where += " AND sl.warehouse_id = :warehouse_id"
        params["warehouse_id"] = warehouse_id

    query = f"""
        SELECT
            sl.product_id,
            p.nombre as producto,
            p.sku,
            c.nombre as categoria,
            w.nombre as warehouse,
            sl.id as lot_id,
            sl.cantidad_disponible,
            sl.costo_unitario,
            sl.costo_total,
            sl.fecha_ingreso,
            sl.referencia,
            sl.fecha_vencimiento
        FROM stock_lots sl
        JOIN products p ON p.id = sl.product_id
        LEFT JOIN product_categories c ON c.id = p.category_id
        JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE {where}
        ORDER BY sl.product_id, sl.fecha_ingreso DESC
    """
    results = (await _exec(db, query, params)).all()

    products = {}
    for r in results:
        pid = str(r["product_id"])
        if pid not in products:
            products[pid] = {
                "producto": r["producto"],
                "sku": r["sku"],
                "categoria": r["categoria"],
                "warehouse": r["warehouse"],
                "total_stock": 0,
                "total_costo": 0.0,
                "lifo_costo_unitario": 0.0,
                "lotes": [],
            }

        costo = float(r["costo_unitario"])
        cantidad = int(r["cantidad_disponible"])
        costo_total = float(r["costo_total"])

        products[pid]["total_stock"] += cantidad
        products[pid]["total_costo"] += costo_total
        products[pid]["lotes"].append({
            "lot_id": str(r["lot_id"]),
            "cantidad": cantidad,
            "costo_unitario": costo,
            "costo_total": costo_total,
            "fecha_ingreso": str(r["fecha_ingreso"]),
            "referencia": r["referencia"],
            "fecha_vencimiento": str(r["fecha_vencimiento"]) if r["fecha_vencimiento"] else None,
        })

    for pid, data in products.items():
        if data["total_stock"] > 0:
            data["lifo_costo_unitario"] = round(data["total_costo"] / data["total_stock"], 0)

    return sorted(products.values(), key=lambda x: x["total_stock"], reverse=True)


async def get_cost_comparison(db: AsyncSession, company_id: Optional[str] = None, product_id=None, warehouse_id=None) -> list:
    fifo_data = await get_fifo_costing(db, company_id, product_id, warehouse_id)
    lifo_data = await get_lifo_costing(db, company_id, product_id, warehouse_id)

    lifo_map = {item["producto"]: item for item in lifo_data}

    comparison = []
    for item in fifo_data:
        lifo_item = lifo_map.get(item["producto"], {})
        fifo_unit = item["fifo_costo_unitario"]
        lifo_unit = lifo_item.get("lifo_costo_unitario", 0)
        weighted_avg = item["fifo_costo_unitario"]

        diff = fifo_unit - lifo_unit if lifo_unit > 0 else 0
        diff_pct = round((diff / max(lifo_unit, 1)) * 100, 1) if lifo_unit > 0 else 0

        comparison.append({
            "producto": item["producto"],
            "sku": item["sku"],
            "categoria": item["categoria"],
            "warehouse": item["warehouse"],
            "total_stock": item["total_stock"],
            "fifo_costo": fifo_unit,
            "fifo_valor_total": item["total_costo"],
            "lifo_costo": lifo_unit,
            "lifo_valor_total": lifo_item.get("total_costo", 0),
            "weighted_avg_costo": weighted_avg,
            "diferencia_fifo_lifo": round(diff, 0),
            "diferencia_pct": diff_pct,
        })

    return comparison


async def get_inventory_valuation(db: AsyncSession, company_id: Optional[str] = None, warehouse_id: Optional[str] = None, supplier_id: Optional[str] = None, fecha_corte: Optional[date] = None) -> dict:
    params = {}
    where = "s.cantidad > 0"
    if warehouse_id:
        where += " AND s.warehouse_id = :warehouse_id"
        params["warehouse_id"] = warehouse_id

    query = f"""
        SELECT
            w.id as warehouse_id,
            w.nombre as warehouse_name,
            COUNT(DISTINCT s.product_id) as total_products,
            SUM(s.cantidad) as total_units,
            COALESCE(SUM(s.cantidad * COALESCE(s.costo_unitario, 0)), 0) as total_value
        FROM stock s
        JOIN warehouses w ON w.id = s.warehouse_id
        WHERE {where}
        GROUP BY w.id, w.nombre
        ORDER BY total_value DESC
    """
    rows = list(await _exec(db, query, params))

    total_value = sum(float(r["total_value"]) for r in rows)
    total_products = sum(int(r["total_products"]) for r in rows)
    total_units = sum(int(r["total_units"]) for r in rows)

    return {
        "total_value": total_value,
        "total_products": total_products,
        "total_units": total_units,
        "by_warehouse": [
            {
                "warehouse_id": str(r["warehouse_id"]),
                "warehouse_name": r["warehouse_name"],
                "total_products": int(r["total_products"]),
                "total_units": int(r["total_units"]),
                "total_value": float(r["total_value"]),
                "percentage": round((float(r["total_value"]) / max(total_value, 1)) * 100, 1),
            }
            for r in rows
        ],
    }


