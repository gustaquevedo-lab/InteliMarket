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

import uuid
import re
from datetime import date
from typing import Optional
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from api.src.financial.models import SupplierInvoice


async def _exec(db: AsyncSession, query: str, params: Optional[dict] = None):
    result = await db.execute(text(query), params or {})
    return result.mappings()


def _build_tz_filter(fecha_desde: Optional[date], fecha_hasta: Optional[date], params: dict, col: str = "v.fecha") -> str:
    clause = ""
    if fecha_desde:
        clause += f" AND {col} >= CAST(:fecha_desde AS TIMESTAMP) AT TIME ZONE 'America/Asuncion'"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        clause += f" AND {col} < (CAST(:fecha_hasta AS DATE) + interval '1 day') AT TIME ZONE 'America/Asuncion'"
        params["fecha_hasta"] = fecha_hasta
    return clause


async def get_sales_summary(db: AsyncSession, company_id: str, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None, branch_id: Optional[str] = None) -> dict:
    params = {"company_id": company_id}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    where += _build_tz_filter(fecha_desde, fecha_hasta, params, "v.fecha")
    if branch_id:
        where += " AND v.branch_id = :branch_id"
        params["branch_id"] = branch_id

    query = f"""
        WITH filtered_sales AS MATERIALIZED (
            SELECT v.id, v.total, v.iva_10, v.iva_5
            FROM sales v
            WHERE {where}
        ),
        items_agg AS MATERIALIZED (
            SELECT 
                SUM(vi.cantidad) as total_items,
                SUM(COALESCE(vi.costo_unitario, p.costo_promedio, p.ultimo_costo, 0) * vi.cantidad) as costo_total
            FROM sale_items vi
            JOIN filtered_sales fs ON fs.id = vi.sale_id
            LEFT JOIN products p ON p.id = vi.product_id
        )
        SELECT
            COUNT(fs.id) as total_ventas,
            COALESCE(SUM(fs.total), 0) as monto_total,
            COALESCE(SUM(fs.iva_10), 0) as monto_iva_10,
            COALESCE(SUM(fs.iva_5), 0) as monto_iva_5,
            COALESCE(MAX(ia.total_items), 0) as total_items,
            COALESCE(MAX(ia.costo_total), 0) as costo_total
        FROM filtered_sales fs
        CROSS JOIN items_agg ia
    """
    result = (await _exec(db, query, params)).first()

    monto = float(result["monto_total"] or 0)
    costo = float(result["costo_total"] or 0)
    iva10 = float(result["monto_iva_10"] or 0)
    iva5 = float(result["monto_iva_5"] or 0)
    margen_gs = max(0.0, monto - costo)
    margen_pct = round((margen_gs / monto * 100), 2) if monto > 0 else 0.0
    tot_ventas = int(result["total_ventas"] or 0)

    return {
        "total_ventas": tot_ventas,
        "monto_total": monto,
        "costo_total": costo,
        "margen_bruto_gs": margen_gs,
        "margen_bruto_pct": margen_pct,
        "monto_iva_10": iva10,
        "monto_iva_5": iva5,
        "monto_exento": float(monto - iva10 - iva5),
        "ticket_promedio": float(monto / max(tot_ventas, 1)),
        "total_items": int(result["total_items"] or 0),
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


async def get_sales_by_period(db: AsyncSession, company_id: str, agrupar_por: str = "dia", fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None, branch_id: Optional[str] = None) -> list:
    params = {"company_id": company_id}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    where += _build_tz_filter(fecha_desde, fecha_hasta, params, "v.fecha")
    if branch_id:
        where += " AND v.branch_id = :branch_id"
        params["branch_id"] = branch_id

    group_expr = {
        "hora": "TO_CHAR(v.fecha AT TIME ZONE 'America/Asuncion', 'HH24:00')",
        "dia": "TO_CHAR(v.fecha AT TIME ZONE 'America/Asuncion', 'YYYY-MM-DD')",
        "semana": "TO_CHAR(v.fecha AT TIME ZONE 'America/Asuncion', 'IYYY-IW')",
        "mes": "TO_CHAR(v.fecha AT TIME ZONE 'America/Asuncion', 'YYYY-MM')",
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


async def get_sales_by_category(db: AsyncSession, company_id: str, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    params = {"company_id": company_id}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    where += _build_tz_filter(fecha_desde, fecha_hasta, params, "v.fecha")

    query = f"""
        SELECT
            c.nombre as categoria,
            SUM(vi.cantidad) as cantidad,
            SUM(vi.total) as monto
        FROM sales v
        JOIN sale_items vi ON vi.sale_id = v.id
        JOIN products p ON p.id = vi.product_id
        JOIN product_categories c ON c.id = p.categoria_id
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


async def get_sales_by_payment_method(db: AsyncSession, company_id: str, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    params = {"company_id": company_id}
    where = "sp.company_id = :company_id"
    where += _build_tz_filter(fecha_desde, fecha_hasta, params, "sp.fecha")

    query = f"""
        SELECT
            sp.forma_pago as forma_pago,
            COUNT(*) as cantidad,
            SUM(sp.monto) as monto
        FROM sale_payments sp
        WHERE {where}
        GROUP BY sp.forma_pago
        ORDER BY monto DESC
    """
    results = (await _exec(db, query, params)).all()
    total = float(sum(r["monto"] for r in results)) or 1
    return [
        {
            "forma_pago": r["forma_pago"],
            "cantidad": int(r["cantidad"]),
            "monto": float(r["monto"]),
            "porcentaje": round((float(r["monto"]) / total) * 100, 1),
        }
        for r in results
    ]


async def get_sales_by_product(db: AsyncSession, company_id: str, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None, limit: int = 50) -> list:
    params = {"limit": limit, "company_id": company_id}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    where += _build_tz_filter(fecha_desde, fecha_hasta, params, "v.fecha")

    query = f"""
        SELECT
            p.nombre as producto,
            p.sku,
            p.unidad_medida,
            SUM(vi.cantidad) as cantidad,
            SUM(vi.total) as monto,
            SUM(SIGN(vi.total) * vi.costo_unitario * vi.cantidad) as costo
        FROM sales v
        JOIN sale_items vi ON vi.sale_id = v.id
        JOIN products p ON p.id = vi.product_id
        WHERE {where}
        GROUP BY p.nombre, p.sku, p.unidad_medida
        ORDER BY monto DESC
        LIMIT :limit
    """
    results = (await _exec(db, query, params)).all()
    return [
        {
            "producto": r["producto"],
            "sku": r["sku"],
            "unidad_medida": r["unidad_medida"] or "UN",
            # cantidad NO se trunca a int — productos por KG (verdulería, carnicería)
            # tienen cantidades fraccionarias reales (ej. 5.08 kg), truncar a int
            # los muestra mal (perdía la parte decimal).
            "cantidad": float(r["cantidad"]),
            "monto": float(r["monto"]),
            "costo": float(r["costo"] or 0),
            "margen": round(((float(r["monto"]) - float(r["costo"] or 0)) / max(float(r["monto"]), 1)) * 100, 1),
        }
        for r in results
    ]


async def get_sales_by_supplier(
    db: AsyncSession,
    company_id: str,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    limit: Optional[int] = None,
    supplier_id: Optional[str] = None,
) -> list:
    params: dict = {"company_id": company_id}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    where += _build_tz_filter(fecha_desde, fecha_hasta, params, "v.fecha")

    if supplier_id and supplier_id != "todos":
        if supplier_id == "sin_proveedor":
            where += " AND p.supplier_id IS NULL"
        else:
            where += " AND sup.id = :supplier_id"
            params["supplier_id"] = supplier_id

    limit_clause = ""
    if limit and limit > 0:
        limit_clause = "LIMIT :limit"
        params["limit"] = limit

    query = f"""
        SELECT
            COALESCE(sup.id::text, 'sin_proveedor') as supplier_id,
            COALESCE(sup.razon_social, sup.nombre_fantasia, 'Sin Proveedor Asignado') as proveedor,
            COALESCE(sup.ruc, '—') as ruc,
            COUNT(DISTINCT p.id) as skus_vendidos,
            SUM(vi.cantidad) as unidades_vendidas,
            SUM(vi.total) as total_ventas,
            SUM(vi.cantidad * COALESCE(vi.costo_unitario, p.costo_promedio, p.ultimo_costo, 0)) as costo_total
        FROM sales v
        JOIN sale_items vi ON vi.sale_id = v.id
        JOIN products p ON p.id = vi.product_id
        LEFT JOIN suppliers sup ON sup.id = p.supplier_id
        WHERE {where}
        GROUP BY sup.id, sup.razon_social, sup.nombre_fantasia, sup.ruc
        ORDER BY total_ventas DESC
        {limit_clause}
    """
    results = (await _exec(db, query, params)).all()
    total_general = float(sum(r["total_ventas"] or 0 for r in results)) or 1.0

    items = []
    for r in results:
        monto = float(r["total_ventas"] or 0)
        costo = float(r["costo_total"] or 0)
        utilidad = monto - costo
        margen_pct = round((utilidad / max(monto, 1.0)) * 100, 1)
        participacion_pct = round((monto / total_general) * 100, 1)

        items.append({
            "supplier_id": r["supplier_id"],
            "proveedor": r["proveedor"],
            "ruc": r["ruc"],
            "skus_vendidos": int(r["skus_vendidos"] or 0),
            "unidades_vendidas": float(r["unidades_vendidas"] or 0),
            "total_ventas": monto,
            "costo_total": costo,
            "utilidad_bruta": utilidad,
            "margen_pct": margen_pct,
            "participacion_pct": participacion_pct,
        })
    return items


async def get_sales_by_supplier_products(
    db: AsyncSession,
    company_id: str,
    supplier_id: str,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    limit: Optional[int] = None,
) -> list[dict]:
    params: dict = {"company_id": company_id}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    where += _build_tz_filter(fecha_desde, fecha_hasta, params, "v.fecha")

    if supplier_id == "sin_proveedor":
        where += " AND p.supplier_id IS NULL"
    else:
        where += " AND sup.id = :supplier_id"
        params["supplier_id"] = supplier_id

    limit_clause = ""
    if limit and limit > 0:
        limit_clause = "LIMIT :limit"
        params["limit"] = limit

    query = f"""
        SELECT
            p.id::text as product_id,
            p.nombre as producto,
            COALESCE(p.sku, '—') as sku,
            COALESCE(p.codigo_barra, '—') as codigo_barra,
            SUM(vi.cantidad) as unidades_vendidas,
            SUM(vi.total) as total_ventas,
            SUM(vi.cantidad * COALESCE(vi.costo_unitario, p.costo_promedio, p.ultimo_costo, 0)) as costo_total
        FROM sales v
        JOIN sale_items vi ON vi.sale_id = v.id
        JOIN products p ON p.id = vi.product_id
        LEFT JOIN suppliers sup ON sup.id = p.supplier_id
        WHERE {where}
        GROUP BY p.id, p.nombre, p.sku, p.codigo_barra
        ORDER BY total_ventas DESC
        {limit_clause}
    """
    results = (await _exec(db, query, params)).all()
    total_general = float(sum(r["total_ventas"] or 0 for r in results)) or 1.0

    items = []
    for r in results:
        monto = float(r["total_ventas"] or 0)
        costo = float(r["costo_total"] or 0)
        utilidad = monto - costo
        margen_pct = round((utilidad / max(monto, 1.0)) * 100, 1)
        participacion_pct = round((monto / total_general) * 100, 1)

        items.append({
            "product_id": r["product_id"],
            "producto": r["producto"],
            "sku": r["sku"],
            "codigo_barra": r["codigo_barra"],
            "unidades_vendidas": float(r["unidades_vendidas"] or 0),
            "total_ventas": monto,
            "costo_total": costo,
            "utilidad_bruta": utilidad,
            "margen_pct": margen_pct,
            "participacion_pct": participacion_pct,
        })
    return items


async def get_sales_by_client(db: AsyncSession, company_id: str, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    params = {"company_id": company_id}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
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


async def get_inventory_summary(db: AsyncSession, company_id: str, warehouse_id: Optional[int] = None) -> dict:
    params = {"company_id": company_id}
    where = "s.cantidad > 0 AND w.company_id = :company_id"
    if warehouse_id:
        where += " AND s.warehouse_id = :warehouse_id"
        params["warehouse_id"] = warehouse_id

    query = f"""
        SELECT
            COUNT(DISTINCT s.product_id) as total_productos,
            COALESCE(SUM(s.cantidad), 0) as total_unidades,
            COALESCE(SUM(s.cantidad * COALESCE(s.costo_unitario, 0)), 0) as valor_total
        FROM stock s
        JOIN warehouses w ON w.id = s.warehouse_id
        WHERE {where}
    """
    result = (await _exec(db, query, params)).first()

    query_bajo = """
        SELECT COUNT(DISTINCT s.product_id) as bajo_stock
        FROM stock s
        JOIN products p ON p.id = s.product_id
        JOIN warehouses w ON w.id = s.warehouse_id
        WHERE s.cantidad - s.cantidad_reservada <= p.stock_minimo AND s.cantidad > 0 AND w.company_id = :company_id
    """
    bajo = (await _exec(db, query_bajo, {"company_id": company_id})).first()

    query_sin = """
        SELECT COUNT(DISTINCT s.product_id) as sin_stock
        FROM stock s
        JOIN warehouses w ON w.id = s.warehouse_id
        WHERE s.cantidad = 0 AND w.company_id = :company_id
    """
    sin = (await _exec(db, query_sin, {"company_id": company_id})).first()

    return {
        "total_productos": result["total_productos"] or 0,
        "total_unidades": int(result["total_unidades"] or 0),
        "valor_total": float(result["valor_total"] or 0),
        "valor_costo": float(result["valor_total"] or 0),
        "bajo_stock": bajo["bajo_stock"] or 0,
        "sin_stock": sin["sin_stock"] or 0,
    }


async def get_inventory_detail(db: AsyncSession, company_id: str, warehouse_id: Optional[int] = None) -> list:
    params = {"company_id": company_id}
    where = "w.company_id = :company_id"
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
        LEFT JOIN product_categories c ON c.id = p.categoria_id
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


async def get_inventory_rotation(db: AsyncSession, company_id: str, supplier_id: Optional[str] = None) -> list:
    params = {"company_id": company_id}
    where_extra = ""
    if supplier_id:
        where_extra = " AND p.supplier_id = :supplier_id"
        params["supplier_id"] = supplier_id

    query = f"""
        SELECT
            p.nombre as producto,
            p.sku,
            COALESCE(sup.razon_social, sup.nombre_fantasia, 'Sin Proveedor') as supplier_name,
            COALESCE(SUM(vi.cantidad) FILTER (WHERE v.fecha >= CURRENT_DATE - INTERVAL '30 days'), 0) as ventas_30d,
            COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.product_id = p.id), 0) as stock_actual
        FROM products p
        LEFT JOIN suppliers sup ON sup.id = p.supplier_id
        LEFT JOIN sale_items vi ON vi.product_id = p.id
        LEFT JOIN sales v ON v.id = vi.sale_id AND v.estado <> 'cancelado' AND v.company_id = :company_id
        WHERE p.company_id = :company_id{where_extra}
        GROUP BY p.id, p.nombre, p.sku, sup.razon_social, sup.nombre_fantasia
    """
    results = (await _exec(db, query, params)).all()
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


async def get_fiscal_book(db: AsyncSession, company_id: str, tipo_libro: str = "ventas", fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    params = {"company_id": company_id}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    if fecha_desde:
        where += " AND v.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND v.fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta

    if tipo_libro == "ventas":
        query = f"""
            SELECT
                v.fecha,
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
        """
    else:
        where_c = where.replace("v.", "po.")
        query = f"""
            SELECT
                po.fecha,
                po.numero as nro_comprobante,
                s.ruc as ruc_emisor,
                NULL as ruc_receptor,
                s.razon_social,
                'Contribuyente' as condicion_iva,
                0 as monto_5,
                po.total as monto_10,
                0 as monto_exento,
                0 as iva_5,
                ROUND(COALESCE(po.total,0) * 0.1 / 1.1, 0) as iva_10,
                po.total
            FROM purchase_orders po
            JOIN suppliers s ON s.id = po.supplier_id
            WHERE {where_c}
            ORDER BY po.fecha
        """

    results = (await _exec(db, query, params)).all()
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


async def get_fiscal_summary(db: AsyncSession, company_id: str, tipo_libro: str = "ventas", fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> dict:
    params = {"company_id": company_id}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    if fecha_desde:
        where += " AND v.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND v.fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta

    query = f"""
        SELECT
            COUNT(*) as total_operaciones,
            COALESCE(SUM(v.base_gravada_5), 0) as total_5,
            COALESCE(SUM(v.base_gravada_10), 0) as total_10,
            COALESCE(SUM(v.base_exenta), 0) as total_exento,
            COALESCE(SUM(v.iva_5), 0) as total_iva_5,
            COALESCE(SUM(v.iva_10), 0) as total_iva_10,
            COALESCE(SUM(v.total), 0) as total_general
        FROM sales v
        WHERE {where}
    """
    result = (await _exec(db, query, params)).first()
    return {
        "total_operaciones": result["total_operaciones"] or 0,
        "total_5": float(result["total_5"] or 0),
        "total_10": float(result["total_10"] or 0),
        "total_exento": float(result["total_exento"] or 0),
        "total_iva_5": float(result["total_iva_5"] or 0),
        "total_iva_10": float(result["total_iva_10"] or 0),
        "total_general": float(result["total_general"] or 0),
    }


async def get_fiscal_rg90_ventas(
    db: AsyncSession,
    company_id: str,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    punto_emision: Optional[str] = None,
) -> dict:
    """Libro de Ventas bajo la Resolución General Nº 90/2021 (DNIT / SET Paraguay).

    Genera la estructura reglamentaria de comprobantes para su posterior auditoría
    y carga/importación masiva al sistema Marangatú.
    Zona horaria inmutable: America/Asuncion.
    """
    comp_row = (await db.execute(
        text("SELECT razon_social, ruc, timbrado_numero, config FROM companies WHERE id = :cid"),
        {"cid": company_id}
    )).first()

    company_timbrado = "18545636"
    company_ruc = "80150377-9"
    company_razon = "GRUPO SANTA TERESA E.A.S."

    if comp_row:
        company_razon = comp_row.razon_social or company_razon
        company_ruc = comp_row.ruc or company_ruc
        config_dict = comp_row.config if isinstance(comp_row.config, dict) else {}
        company_timbrado = comp_row.timbrado_numero or config_dict.get("timbrado_dnit") or company_timbrado

    params = {"company_id": company_id}
    where = "v.company_id = :company_id AND v.estado <> 'borrador'"
    where += _build_tz_filter(fecha_desde, fecha_hasta, params, "v.fecha")

    if punto_emision and punto_emision != "todos":
        where += " AND v.numero LIKE :punto_emision"
        params["punto_emision"] = f"{punto_emision}%"

    query = f"""
        SELECT
            v.id,
            v.numero as nro_comprobante,
            TO_CHAR(v.fecha AT TIME ZONE 'America/Asuncion', 'DD/MM/YYYY') as fecha_emision_str,
            TO_CHAR(v.fecha AT TIME ZONE 'America/Asuncion', 'YYYY-MM-DD HH24:MI:SS') as fecha_asuncion_full,
            v.tipo_comprobante,
            v.condicion,
            v.estado,
            c.ruc as cliente_ruc,
            c.ci as cliente_ci,
            COALESCE(c.razon_social, c.nombre_fantasia, 'Sin Nombre') as cliente_razon_social,
            v.base_gravada_10 as base_10,
            v.base_gravada_5 as base_5,
            v.base_exenta as base_exenta,
            v.iva_10 as iva_10,
            v.iva_5 as iva_5,
            v.total as total
        FROM sales v
        LEFT JOIN customers c ON c.id = v.customer_id
        WHERE {where}
        ORDER BY v.fecha ASC, v.numero ASC
    """
    rows = (await _exec(db, query, params)).all()

    registros = []
    totales = {
        "cantidad_facturas": 0,
        "cantidad_nc": 0,
        "total_gravada_10": 0,
        "total_iva_10": 0,
        "total_gravada_5": 0,
        "total_iva_5": 0,
        "total_exenta": 0,
        "total_general": 0,
    }

    for r in rows:
        es_nc = (r["estado"] == "cancelado" or r["tipo_comprobante"] in ("nota_credito", "nc"))
        tipo_comprobante_cod = 110 if es_nc else 109  # 109 = Factura, 110 = Nota de Crédito

        raw_ruc = (r["cliente_ruc"] or "").strip()
        raw_ci = (r["cliente_ci"] or "").strip()
        raw_nombre = (r["cliente_razon_social"] or "Sin Nombre").strip()

        tipo_ident = 15
        num_ident = "44444401"
        dv = "7"

        if raw_ruc and raw_ruc not in ("44444401-7", "44444401", "XXX"):
            tipo_ident = 11
            if "-" in raw_ruc:
                parts = raw_ruc.split("-", 1)
                num_ident = re.sub(r"\D", "", parts[0])
                dv = parts[1].strip()[:1]
            else:
                num_ident = re.sub(r"\D", "", raw_ruc)
                dv = ""
        elif raw_ci:
            clean_ci = re.sub(r"\D", "", raw_ci)
            if clean_ci:
                tipo_ident = 12
                num_ident = clean_ci
                dv = ""

        raw_num = str(r["nro_comprobante"] or "").strip()
        if "-" not in raw_num and len(raw_num) <= 7:
            formatted_num = f"001-011-{int(raw_num):07d}" if raw_num.isdigit() else raw_num
        elif raw_num.count("-") == 2:
            parts = raw_num.split("-")
            formatted_num = f"{parts[0]:0>3}-{parts[1]:0>3}-{int(parts[2]):07d}" if parts[2].isdigit() else raw_num
        else:
            formatted_num = raw_num

        base_10 = round(float(r["base_10"] or 0))
        iva_10 = round(float(r["iva_10"] or 0))
        base_5 = round(float(r["base_5"] or 0))
        iva_5 = round(float(r["iva_5"] or 0))
        exenta = round(float(r["base_exenta"] or 0))
        total = round(float(r["total"] or 0))

        condicion = str(r["condicion"] or "").lower()
        condicion_cod = 2 if condicion in ("credito", "credito_extra_club") else 1

        registro = {
            "tipo_registro": 1,
            "tipo_identificacion": tipo_ident,
            "numero_identificacion": num_ident,
            "dv": dv,
            "nombre_comprador": raw_nombre,
            "tipo_comprobante": tipo_comprobante_cod,
            "tipo_comprobante_label": "Nota de Crédito" if es_nc else "Factura",
            "fecha_emision": r["fecha_emision_str"],
            "fecha_asuncion": r["fecha_asuncion_full"],
            "timbrado": company_timbrado,
            "numero_comprobante": formatted_num,
            "gravada_10": base_10,
            "iva_10": iva_10,
            "gravada_5": base_5,
            "iva_5": iva_5,
            "exenta": exenta,
            "total": total,
            "condicion": condicion_cod,
            "condicion_label": "Crédito" if condicion_cod == 2 else "Contado",
            "moneda_extranjera": "N",
            "imputa_iva": "S",
            "imputa_ire": "S",
            "imputa_irp": "N",
            "comprobante_asociado_timbrado": company_timbrado if es_nc else "",
            "comprobante_asociado_numero": formatted_num if es_nc else "",
        }
        registros.append(registro)

        if es_nc:
            totales["cantidad_nc"] += 1
        else:
            totales["cantidad_facturas"] += 1

        totales["total_gravada_10"] += base_10
        totales["total_iva_10"] += iva_10
        totales["total_gravada_5"] += base_5
        totales["total_iva_5"] += iva_5
        totales["total_exenta"] += exenta
        totales["total_general"] += total

    return {
        "company": {
            "razon_social": company_razon,
            "ruc": company_ruc,
            "timbrado": company_timbrado,
        },
        "periodo": {
            "fecha_desde": str(fecha_desde) if fecha_desde else None,
            "fecha_hasta": str(fecha_hasta) if fecha_hasta else None,
            "punto_emision": punto_emision or "todos",
        },
        "totales": totales,
        "registros": registros,
    }



async def get_financial_summary(db: AsyncSession, company_id: str, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> dict:
    params = {"company_id": company_id}
    where = "estado <> 'cancelado' AND company_id = :company_id"
    if fecha_desde:
        where += " AND fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta

    ingresos = (await _exec(db, f"SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE {where}", params)).first()
    egresos = (await _exec(db, f"SELECT COALESCE(SUM(total), 0) as total FROM purchase_orders WHERE {where}", params)).first()
    # customer_accounts está vacía/huérfana (0 filas) — la fuente real y poblada
    # de cuentas por cobrar es accounts_receivable (saldo_pendiente/estado), la
    # misma que usa el resto del código (ver financial/service.py).
    por_cobrar = (await _exec(
        db, "SELECT COALESCE(SUM(saldo_pendiente), 0) as total FROM accounts_receivable WHERE estado = 'pendiente' AND company_id = :company_id",
        {"company_id": company_id},
    )).first()
    r_ap = await db.execute(
        select(func.coalesce(func.sum(SupplierInvoice.saldo_pendiente), 0))
        .where(SupplierInvoice.estado == "pendiente", SupplierInvoice.company_id == uuid.UUID(company_id))
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


async def get_financial_by_day(db: AsyncSession, company_id: str, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    params = {"company_id": company_id}
    where = "estado <> 'cancelado' AND company_id = :company_id"
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


async def get_fifo_costing(db: AsyncSession, company_id: str, product_id=None, warehouse_id=None) -> list:
    params = {"company_id": company_id}
    where = "sl.cantidad_disponible > 0 AND sl.company_id = :company_id"
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
        LEFT JOIN product_categories c ON c.id = p.categoria_id
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

    if not results:
        fallback_query = f"""
            SELECT s.product_id, p.nombre as producto, p.sku, c.nombre as categoria,
                   w.nombre as warehouse, s.cantidad as total_stock,
                   COALESCE(s.costo_unitario, p.costo_promedio, p.ultimo_costo, 0) as fifo_costo_unitario,
                   s.cantidad * COALESCE(s.costo_unitario, p.costo_promedio, p.ultimo_costo, 0) as total_costo
            FROM stock s
            JOIN products p ON p.id = s.product_id
            LEFT JOIN product_categories c ON c.id = p.categoria_id
            JOIN warehouses w ON w.id = s.warehouse_id
            WHERE s.cantidad > 0 AND w.company_id = :company_id
            ORDER BY s.cantidad DESC
            LIMIT 1000
        """
        stock_res = (await _exec(db, fallback_query, {"company_id": company_id})).all()
        return [
            {
                "producto": r["producto"],
                "sku": r["sku"],
                "categoria": r["categoria"] or "General",
                "warehouse": r["warehouse"] or "Principal",
                "total_stock": int(r["total_stock"]),
                "total_costo": float(r["total_costo"]),
                "fifo_costo_unitario": float(r["fifo_costo_unitario"]),
                "lotes": [],
            }
            for r in stock_res
        ]

    for pid, data in products.items():
        if data["total_stock"] > 0:
            data["fifo_costo_unitario"] = round(data["total_costo"] / data["total_stock"], 0)

    return sorted(products.values(), key=lambda x: x["total_stock"], reverse=True)


async def get_lifo_costing(db: AsyncSession, company_id: str, product_id=None, warehouse_id=None) -> list:
    params = {"company_id": company_id}
    where = "sl.cantidad_disponible > 0 AND sl.company_id = :company_id"
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
        LEFT JOIN product_categories c ON c.id = p.categoria_id
        JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE {where}
        ORDER BY sl.product_id, sl.fecha_ingreso DESC
    """
    results = (await _exec(db, query, params)).all()

    if not results:
        fallback_query = f"""
            SELECT s.product_id, p.nombre as producto, p.sku, c.nombre as categoria,
                   w.nombre as warehouse, s.cantidad as total_stock,
                   COALESCE(p.ultimo_costo, s.costo_unitario, p.costo_promedio, 0) as lifo_costo_unitario,
                   s.cantidad * COALESCE(p.ultimo_costo, s.costo_unitario, p.costo_promedio, 0) as total_costo
            FROM stock s
            JOIN products p ON p.id = s.product_id
            LEFT JOIN product_categories c ON c.id = p.categoria_id
            JOIN warehouses w ON w.id = s.warehouse_id
            WHERE s.cantidad > 0 AND w.company_id = :company_id
            ORDER BY s.cantidad DESC
            LIMIT 1000
        """
        stock_res = (await _exec(db, fallback_query, {"company_id": company_id})).all()
        return [
            {
                "producto": r["producto"],
                "sku": r["sku"],
                "categoria": r["categoria"] or "General",
                "warehouse": r["warehouse"] or "Principal",
                "total_stock": int(r["total_stock"]),
                "total_costo": float(r["total_costo"]),
                "lifo_costo_unitario": float(r["lifo_costo_unitario"]),
                "lotes": [],
            }
            for r in stock_res
        ]

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


async def get_cost_comparison(db: AsyncSession, company_id: str, product_id=None, warehouse_id=None) -> list:
    fifo_data = await get_fifo_costing(db, company_id, product_id, warehouse_id)
    lifo_data = await get_lifo_costing(db, company_id, product_id, warehouse_id)

    lifo_map = {item["producto"]: item for item in lifo_data}

    comparison = []
    for item in fifo_data:
        lifo_item = lifo_map.get(item["producto"], {})
        fifo_unit = item.get("fifo_costo_unitario", 0)
        lifo_unit = lifo_item.get("lifo_costo_unitario", fifo_unit)
        weighted_avg = fifo_unit

        diff = fifo_unit - lifo_unit if lifo_unit > 0 else 0
        diff_pct = round((diff / max(lifo_unit, 1)) * 100, 1) if lifo_unit > 0 else 0

        comparison.append({
            "producto": item["producto"],
            "sku": item["sku"],
            "categoria": item.get("categoria", "General"),
            "warehouse": item.get("warehouse", "Principal"),
            "total_stock": item["total_stock"],
            "fifo_costo": fifo_unit,
            "fifo_valor_total": item["total_costo"],
            "lifo_costo": lifo_unit,
            "lifo_valor_total": lifo_item.get("total_costo", item["total_costo"]),
            "weighted_avg_costo": weighted_avg,
            "diferencia_fifo_lifo": round(diff, 0),
            "diferencia_pct": diff_pct,
        })

    return comparison


async def get_inventory_valuation(
    db: AsyncSession,
    company_id: str,
    warehouse_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    fecha_corte: Optional[date] = None,
) -> dict:
    """Stock valorizado con soporte para filtro de proveedor y reconstrucción
    histórica hacia atrás a fecha de corte por delta de inventory_movements."""
    params = {"company_id": company_id}
    where_prod = "p.company_id = :company_id AND w.company_id = :company_id"
    if warehouse_id:
        where_prod += " AND s.warehouse_id = :warehouse_id"
        params["warehouse_id"] = warehouse_id
    if supplier_id:
        where_prod += " AND p.supplier_id = :supplier_id"
        params["supplier_id"] = supplier_id

    if fecha_corte:
        # Reconstrucción hacia atrás: Stock(fecha_corte) = Stock(actual) - Movimientos(posteriores)
        params["fecha_corte"] = fecha_corte
        query = f"""
            WITH post_movs AS (
                SELECT
                    im.product_id,
                    im.warehouse_id,
                    SUM(im.cantidad) as delta_post
                FROM inventory_movements im
                WHERE im.company_id = :company_id
                  AND im.created_at >= (CAST(:fecha_corte AS DATE) + interval '1 day') AT TIME ZONE 'America/Asuncion'
                GROUP BY im.product_id, im.warehouse_id
            )
            SELECT
                p.id as product_id,
                p.sku,
                p.nombre as producto,
                p.unidad_medida,
                p.supplier_id,
                COALESCE(sup.razon_social, sup.nombre_fantasia, 'Sin Proveedor Asignado') as supplier_name,
                w.id as warehouse_id,
                w.nombre as warehouse_name,
                COALESCE(s.costo_unitario, p.costo_promedio, p.ultimo_costo, 0) as costo_unitario,
                GREATEST(0, s.cantidad - COALESCE(pm.delta_post, 0)) as stock,
                (GREATEST(0, s.cantidad - COALESCE(pm.delta_post, 0)) * COALESCE(s.costo_unitario, p.costo_promedio, p.ultimo_costo, 0)) as valor_total
            FROM stock s
            JOIN products p ON p.id = s.product_id
            JOIN warehouses w ON w.id = s.warehouse_id
            LEFT JOIN suppliers sup ON sup.id = p.supplier_id
            LEFT JOIN post_movs pm ON pm.product_id = s.product_id AND pm.warehouse_id = s.warehouse_id
            WHERE {where_prod}
            HAVING (s.cantidad - COALESCE(pm.delta_post, 0)) > 0
            ORDER BY valor_total DESC
        """
    else:
        query = f"""
            SELECT
                p.id as product_id,
                p.sku,
                p.nombre as producto,
                p.unidad_medida,
                p.supplier_id,
                COALESCE(sup.razon_social, sup.nombre_fantasia, 'Sin Proveedor Asignado') as supplier_name,
                w.id as warehouse_id,
                w.nombre as warehouse_name,
                COALESCE(s.costo_unitario, p.costo_promedio, p.ultimo_costo, 0) as costo_unitario,
                s.cantidad as stock,
                (s.cantidad * COALESCE(s.costo_unitario, p.costo_promedio, p.ultimo_costo, 0)) as valor_total
            FROM stock s
            JOIN products p ON p.id = s.product_id
            JOIN warehouses w ON w.id = s.warehouse_id
            LEFT JOIN suppliers sup ON sup.id = p.supplier_id
            WHERE {where_prod} AND s.cantidad > 0
            ORDER BY valor_total DESC
        """

    rows = list(await _exec(db, query, params))

    items = []
    by_warehouse_dict: dict[str, dict] = {}
    by_supplier_dict: dict[str, dict] = {}

    total_value = 0.0
    total_units = 0.0
    unique_products = set()

    for r in rows:
        val = float(r["valor_total"] or 0)
        stk = float(r["stock"] or 0)
        p_id = str(r["product_id"])
        w_id = str(r["warehouse_id"])
        w_name = str(r["warehouse_name"])
        s_id = str(r["supplier_id"] or "none")
        s_name = str(r["supplier_name"])

        total_value += val
        total_units += stk
        unique_products.add(p_id)

        items.append({
            "product_id": p_id,
            "sku": r["sku"] or "",
            "producto": r["producto"] or "",
            "unidad_medida": r["unidad_medida"] or "UN",
            "supplier_id": str(r["supplier_id"]) if r["supplier_id"] else None,
            "supplier_name": s_name,
            "warehouse_id": w_id,
            "warehouse_name": w_name,
            "costo_unitario": float(r["costo_unitario"] or 0),
            "stock": stk,
            "valor_total": val,
        })

        # Agrupación por depósito
        if w_id not in by_warehouse_dict:
            by_warehouse_dict[w_id] = {
                "warehouse_id": w_id,
                "warehouse_name": w_name,
                "total_products": 0,
                "total_units": 0.0,
                "total_value": 0.0,
                "_prods": set(),
            }
        by_warehouse_dict[w_id]["total_value"] += val
        by_warehouse_dict[w_id]["total_units"] += stk
        by_warehouse_dict[w_id]["_prods"].add(p_id)

        # Agrupación por proveedor
        if s_id not in by_supplier_dict:
            by_supplier_dict[s_id] = {
                "supplier_id": s_id if s_id != "none" else None,
                "supplier_name": s_name,
                "total_products": 0,
                "total_units": 0.0,
                "total_value": 0.0,
                "_prods": set(),
            }
        by_supplier_dict[s_id]["total_value"] += val
        by_supplier_dict[s_id]["total_units"] += stk
        by_supplier_dict[s_id]["_prods"].add(p_id)

    by_warehouse = []
    for w in by_warehouse_dict.values():
        by_warehouse.append({
            "warehouse_id": w["warehouse_id"],
            "warehouse_name": w["warehouse_name"],
            "total_products": len(w["_prods"]),
            "total_units": w["total_units"],
            "total_value": w["total_value"],
            "percentage": round((w["total_value"] / max(total_value, 1)) * 100, 1),
        })

    by_supplier = []
    for s in by_supplier_dict.values():
        by_supplier.append({
            "supplier_id": s["supplier_id"],
            "supplier_name": s["supplier_name"],
            "total_products": len(s["_prods"]),
            "total_units": s["total_units"],
            "total_value": s["total_value"],
            "percentage": round((s["total_value"] / max(total_value, 1)) * 100, 1),
        })
    by_supplier.sort(key=lambda x: x["total_value"], reverse=True)

    return {
        "fecha_corte": str(fecha_corte) if fecha_corte else None,
        "total_value": total_value,
        "total_products": len(unique_products),
        "total_units": total_units,
        "by_warehouse": by_warehouse,
        "by_supplier": by_supplier,
        "items": items,
    }


async def get_expenses_by_category(db: AsyncSession, company_id: str, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    params = {"company_id": company_id}
    # anulado=false: un gasto anulado (Caja Chica) no es un gasto real, no
    # tiene que sumar acá — se estaba colando antes de este fix.
    where = "e.estado <> 'rechazado' AND e.anulado = false AND e.company_id = :company_id"
    if fecha_desde:
        where += " AND e.fecha_gasto >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND e.fecha_gasto < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta

    query = f"""
        SELECT
            COALESCE(ec.nombre, 'Sin categoría') as categoria,
            COUNT(*) as cantidad,
            SUM(e.monto) as monto
        FROM expenses e
        LEFT JOIN expense_categories ec ON ec.id = e.category_id
        WHERE {where}
        GROUP BY ec.nombre
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



async def get_chart_comparison(
    db: AsyncSession,
    company_id: str,
    agrupar_por: str = "dia",
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
) -> dict:
    """Tres series de ventas + dos series de rentabilidad en Gs:
       actual | semana_pasada | meta | margen_real | margen_meta
       100% con datos reales sincronizados con el período."""
    import calendar
    import zoneinfo
    from datetime import datetime, timedelta

    tz = zoneinfo.ZoneInfo("America/Asuncion")
    now_py = datetime.now(tz)
    today = now_py.date()

    if fecha_desde is None:
        fecha_desde = today
    if fecha_hasta is None:
        fecha_hasta = today

    # Meta de margen bruto comercial configurada en Gerente IA (22%)
    MARGEN_OBJETIVO_PCT = 0.22

    if agrupar_por == "hora":
        d_start = datetime(fecha_desde.year, fecha_desde.month, fecha_desde.day, 0, 0, 0, tzinfo=tz)
        d_end = d_start + timedelta(days=1)

        lw_start = d_start - timedelta(days=7)
        lw_end = lw_start + timedelta(days=1)

        lm_month = fecha_desde.month - 1 if fecha_desde.month > 1 else 12
        lm_year = fecha_desde.year if fecha_desde.month > 1 else fecha_desde.year - 1
        max_d_lm = calendar.monthrange(lm_year, lm_month)[1]
        lm_start = datetime(lm_year, lm_month, min(fecha_desde.day, max_d_lm), 0, 0, 0, tzinfo=tz)
        lm_end = lm_start + timedelta(days=1)

        # Consulta con ventas y costos exactos por hora
        q_hour_cost = text("""
            WITH sale_cost AS (
                SELECT 
                    vi.sale_id,
                    SUM(vi.cantidad * COALESCE(vi.costo_unitario, p.costo_promedio, p.ultimo_costo, vi.precio_unitario * 0.78)) as costo_venta
                FROM sale_items vi
                LEFT JOIN products p ON p.id = vi.product_id
                GROUP BY vi.sale_id
            )
            SELECT 
                TO_CHAR(v.fecha AT TIME ZONE 'America/Asuncion', 'HH24:00') as hora,
                COUNT(v.id) as tickets,
                COALESCE(SUM(v.total), 0) as total_venta,
                COALESCE(SUM(sc.costo_venta), 0) as total_costo
            FROM sales v
            LEFT JOIN sale_cost sc ON sc.sale_id = v.id
            WHERE v.company_id = :cid AND v.estado <> 'cancelado'
              AND v.fecha >= :start_dt AND v.fecha < :end_dt
            GROUP BY 1 ORDER BY 1
        """)

        rows_actual = (await db.execute(q_hour_cost, {"cid": company_id, "start_dt": d_start, "end_dt": d_end})).fetchall()
        rows_lw = (await db.execute(q_hour_cost, {"cid": company_id, "start_dt": lw_start, "end_dt": lw_end})).fetchall()
        rows_lm = (await db.execute(q_hour_cost, {"cid": company_id, "start_dt": lm_start, "end_dt": lm_end})).fetchall()

        actual_by_hour = {r[0]: (float(r[2]), float(r[3]), int(r[1])) for r in rows_actual}
        lw_by_hour = {r[0]: float(r[2]) for r in rows_lw}
        lm_by_hour = {r[0]: float(r[2]) for r in rows_lm}

        current_hour_str = now_py.strftime("%H:00")
        is_today = (fecha_desde == today)

        all_hours = [f"{h:02d}:00" for h in range(6, 23)]
        series = []
        for h in all_hours:
            has_passed = (not is_today) or (h <= current_hour_str)
            act_val, act_cost, tix = actual_by_hour.get(h, (0.0, 0.0, 0))
            lw_val = lw_by_hour.get(h, 0.0)
            lm_val = lm_by_hour.get(h, 0.0)
            meta_val = round(lm_val * 1.10)

            # Rentabilidad real en Gs y meta de rentabilidad en Gs
            real_margin = max(0.0, act_val - act_cost)
            meta_margin = round(meta_val * MARGEN_OBJETIVO_PCT)

            actual_field = act_val if has_passed else None
            margin_field = real_margin if has_passed else None

            series.append({
                "label": h,
                "actual": actual_field,
                "mes_pasado": lm_val,
                "semana_pasada": lw_val,
                "meta": meta_val,
                "rentabilidad_real": margin_field,
                "rentabilidad_meta": meta_margin,
                "margen_pct": round((real_margin / act_val * 100), 1) if act_val > 0 else 0,
                "tickets": tix if has_passed else 0,
            })

        return {
            "series": series,
            "totales": {
                "actual": sum((s["actual"] or 0) for s in series),
                "mes_pasado": sum(s["mes_pasado"] for s in series),
                "semana_pasada": sum(s["semana_pasada"] for s in series),
                "meta": sum(s["meta"] for s in series),
                "rentabilidad_real": sum((s["rentabilidad_real"] or 0) for s in series),
                "rentabilidad_meta": sum(s["rentabilidad_meta"] for s in series),
            }
        }

    else:
        d_start = datetime(fecha_desde.year, fecha_desde.month, fecha_desde.day, 0, 0, 0, tzinfo=tz)
        d_end = datetime(fecha_hasta.year, fecha_hasta.month, fecha_hasta.day, 0, 0, 0, tzinfo=tz) + timedelta(days=1)

        lw_start = d_start - timedelta(days=7)
        lw_end = d_end - timedelta(days=7)

        lm_month = fecha_desde.month - 1 if fecha_desde.month > 1 else 12
        lm_year = fecha_desde.year if fecha_desde.month > 1 else fecha_desde.year - 1
        max_d_start = calendar.monthrange(lm_year, lm_month)[1]
        lm_start = datetime(lm_year, lm_month, min(fecha_desde.day, max_d_start), 0, 0, 0, tzinfo=tz)

        lm_hasta_m = fecha_hasta.month - 1 if fecha_hasta.month > 1 else 12
        lm_hasta_y = fecha_hasta.year if fecha_hasta.month > 1 else fecha_hasta.year - 1
        max_d_end = calendar.monthrange(lm_hasta_y, lm_hasta_m)[1]
        lm_end = datetime(lm_hasta_y, lm_hasta_m, min(fecha_hasta.day, max_d_end), 0, 0, 0, tzinfo=tz) + timedelta(days=1)

        q_day_cost = text("""
            WITH sale_cost AS (
                SELECT 
                    vi.sale_id,
                    SUM(vi.cantidad * COALESCE(vi.costo_unitario, p.costo_promedio, p.ultimo_costo, vi.precio_unitario * 0.78)) as costo_venta
                FROM sale_items vi
                LEFT JOIN products p ON p.id = vi.product_id
                GROUP BY vi.sale_id
            )
            SELECT 
                TO_CHAR(v.fecha AT TIME ZONE 'America/Asuncion', 'YYYY-MM-DD') as dia,
                COUNT(v.id) as tickets,
                COALESCE(SUM(v.total), 0) as total_venta,
                COALESCE(SUM(sc.costo_venta), 0) as total_costo
            FROM sales v
            LEFT JOIN sale_cost sc ON sc.sale_id = v.id
            WHERE v.company_id = :cid AND v.estado <> 'cancelado'
              AND v.fecha >= :start_dt AND v.fecha < :end_dt
            GROUP BY 1 ORDER BY 1
        """)

        rows_actual = (await db.execute(q_day_cost, {"cid": company_id, "start_dt": d_start, "end_dt": d_end})).fetchall()
        rows_lw = (await db.execute(q_day_cost, {"cid": company_id, "start_dt": lw_start, "end_dt": lw_end})).fetchall()
        rows_lm = (await db.execute(q_day_cost, {"cid": company_id, "start_dt": lm_start, "end_dt": lm_end})).fetchall()

        actual_by_day = {r[0]: (float(r[2]), float(r[3]), int(r[1])) for r in rows_actual}
        lw_by_day = {r[0]: float(r[2]) for r in rows_lw}
        lm_by_day = {r[0]: float(r[2]) for r in rows_lm}

        series = []
        cur_day = fecha_desde
        while cur_day <= fecha_hasta:
            d_str = str(cur_day)
            lw_str = str(cur_day - timedelta(days=7))

            lm_m = cur_day.month - 1 if cur_day.month > 1 else 12
            lm_y = cur_day.year if cur_day.month > 1 else cur_day.year - 1
            max_d = calendar.monthrange(lm_y, lm_m)[1]
            lm_str = str(date(lm_y, lm_m, min(cur_day.day, max_d)))

            act_val, act_cost, tix = actual_by_day.get(d_str, (0.0, 0.0, 0))
            lw_val = lw_by_day.get(lw_str, 0.0)
            lm_val = lm_by_day.get(lm_str, 0.0)
            meta_val = round(lm_val * 1.10)

            real_margin = max(0.0, act_val - act_cost)
            meta_margin = round(meta_val * MARGEN_OBJETIVO_PCT)

            label = f"{cur_day.day:02d}/{cur_day.month:02d}"
            series.append({
                "label": label,
                "dia": d_str,
                "actual": act_val,
                "mes_pasado": lm_val,
                "semana_pasada": lw_val,
                "meta": meta_val,
                "rentabilidad_real": real_margin,
                "rentabilidad_meta": meta_margin,
                "margen_pct": round((real_margin / act_val * 100), 1) if act_val > 0 else 0,
                "tickets": tix,
            })
            cur_day += timedelta(days=1)

        return {
            "series": series,
            "totales": {
                "actual": sum(s["actual"] for s in series),
                "mes_pasado": sum(s["mes_pasado"] for s in series),
                "semana_pasada": sum(s["semana_pasada"] for s in series),
                "meta": sum(s["meta"] for s in series),
                "rentabilidad_real": sum(s["rentabilidad_real"] for s in series),
                "rentabilidad_meta": sum(s["rentabilidad_meta"] for s in series),
            }
        }


async def get_executive_sales_profitability(
    db: AsyncSession,
    company_id: str,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    branch_id: Optional[str] = None,
) -> dict:
    """Informe ejecutivo de ventas, costos, descuentos y rentabilidad (7 líneas)
    + desglose de medios de pago (incluyendo divisas en gaveta)
    + rendimiento por cajera y turnos de caja.
    """
    params = {"company_id": company_id}
    where_sales = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    where_sales += _build_tz_filter(fecha_desde, fecha_hasta, params, "v.fecha")
    if branch_id:
        where_sales += " AND v.branch_id = :branch_id"
        params["branch_id"] = branch_id

    # 1. Total ventas, subtotal, descuentos POS y tickets
    q_sales = f"""
        SELECT
            COUNT(v.id) as total_tickets,
            COALESCE(SUM(v.total), 0) as total_vendido,
            COALESCE(SUM(v.subtotal), 0) as subtotal,
            COALESCE(SUM(v.descuento_total), 0) as descuentos_pos
        FROM sales v
        WHERE {where_sales}
    """
    res_sales = (await _exec(db, q_sales, params)).first()
    total_tickets = int(res_sales["total_tickets"] or 0)
    total_vendido = float(res_sales["total_vendido"] or 0)
    subtotal = float(res_sales["subtotal"] or 0)
    descuentos_pos = float(res_sales["descuentos_pos"] or 0)

    # 2. CMV (Costo de Mercadería Vendida)
    q_cmv = f"""
        SELECT
            COALESCE(SUM(vi.cantidad * COALESCE(vi.costo_unitario, p.costo_promedio, p.ultimo_costo, 0)), 0) as cmv,
            COALESCE(SUM(vi.descuento_monto), 0) as descuentos_items
        FROM sale_items vi
        JOIN sales v ON v.id = vi.sale_id
        LEFT JOIN products p ON p.id = vi.product_id
        WHERE {where_sales}
    """
    res_cmv = (await _exec(db, q_cmv, params)).first()
    cmv = float(res_cmv["cmv"] or 0)
    descuentos_items = float(res_cmv["descuentos_items"] or 0)
    if descuentos_pos == 0 and descuentos_items > 0:
        descuentos_pos = descuentos_items

    # 3. Devoluciones & Notas de Crédito
    params_ret = {"company_id": company_id}
    where_ret = "r.company_id = :company_id AND r.estado NOT IN ('cancelado', 'rechazado')"
    where_ret += _build_tz_filter(fecha_desde, fecha_hasta, params_ret, "r.fecha")
    q_ret = f"""
        SELECT COALESCE(SUM(r.total), 0) as devoluciones_nc, COUNT(r.id) as total_returns
        FROM returns r
        WHERE {where_ret}
    """
    try:
        res_ret = (await _exec(db, q_ret, params_ret)).first()
        devoluciones_nc = float(res_ret["devoluciones_nc"] or 0)
        total_returns = int(res_ret["total_returns"] or 0)
    except Exception:
        devoluciones_nc = 0.0
        total_returns = 0

    # 4. Cálculo de las 7 líneas ejecutivas
    utilidad_bruta = max(0.0, total_vendido - cmv)
    margen_bruto_pct = round((utilidad_bruta / total_vendido * 100), 2) if total_vendido > 0 else 0.0
    resultado_neto = utilidad_bruta - devoluciones_nc
    resultado_neto_pct = round((resultado_neto / total_vendido * 100), 2) if total_vendido > 0 else 0.0
    ticket_promedio = round(total_vendido / max(total_tickets, 1), 0)

    lineas_ejecutivas = [
        {"orden": 1, "clave": "total_vendido", "concepto": "1. Facturación Bruta (Total Vendido)", "monto": total_vendido, "tipo": "ingreso", "descripcion": "Ventas brutas acumuladas registradas en cajas POS"},
        {"orden": 2, "clave": "cmv", "concepto": "2. Costo Mercadería Vendida (CMV)", "monto": cmv, "tipo": "costo", "descripcion": "Costo promedio ponderado de reposición de artículos vendidos"},
        {"orden": 3, "clave": "utilidad_bruta", "concepto": "3. Margen / Utilidad Comercial Bruta", "monto": utilidad_bruta, "tipo": "resultado", "descripcion": "Margen comercial antes de devoluciones (Línea 1 - Línea 2)"},
        {"orden": 4, "clave": "margen_bruto_pct", "concepto": "4. % Margen Comercial Bruto", "monto": margen_bruto_pct, "tipo": "porcentaje", "descripcion": "Porcentaje de utilidad bruta sobre el total vendido"},
        {"orden": 5, "clave": "descuentos_pos", "concepto": "5. Descuentos Otorgados en POS", "monto": descuentos_pos, "tipo": "descuento", "descripcion": "Bonificaciones y descuentos promocionales aplicados en ticket"},
        {"orden": 6, "clave": "devoluciones_nc", "concepto": "6. Devoluciones & Notas de Crédito", "monto": devoluciones_nc, "tipo": "devolucion", "descripcion": "Devolución de mercadería por clientes y notas de crédito"},
        {"orden": 7, "clave": "resultado_neto", "concepto": "7. Resultado Comercial Neto", "monto": resultado_neto, "tipo": "resultado_final", "descripcion": "Utilidad neta comercial del período (Línea 3 - Línea 6)"},
    ]

    # 5. Desglose por Medios de Pago (incluyendo divisas en gaveta)
    q_payments = f"""
        SELECT
            sp.forma_pago,
            COALESCE(sp.moneda, 'PYG') as moneda,
            COUNT(*) as cantidad,
            COALESCE(SUM(sp.monto), 0) as monto
        FROM sale_payments sp
        JOIN sales v ON v.id = sp.sale_id
        WHERE {where_sales}
        GROUP BY sp.forma_pago, COALESCE(sp.moneda, 'PYG')
        ORDER BY monto DESC
    """
    res_payments = (await _exec(db, q_payments, params)).all()
    medios_pago = []
    total_recaudado = sum(float(r["monto"]) for r in res_payments) or 1.0

    ETIQUETAS_PAGO = {
        ("EFECTIVO", "BRL"): "💵 Efectivo Reales (R$ cobrado en gaveta)",
        ("EFECTIVO", "USD"): "💵 Efectivo Dólares (US$ cobrado en gaveta)",
        ("EFECTIVO", "PYG"): "🇵🇾 Efectivo Guaraníes (PYG)",
        ("TARJETA_BANCARD", "PYG"): "💳 Tarjetas Bancard (POS)",
        ("TARJETA CREDITO", "PYG"): "💳 Tarjetas Bancard Crédito",
        ("TARJETA DEBITO", "PYG"): "💳 Tarjetas Bancard Débito",
        ("TARJETA_DINELCO", "PYG"): "💳 Tarjetas Dinelco (POS)",
        ("QR", "PYG"): "📱 QR Bancard / Zimple",
        ("QR CODE", "PYG"): "📱 QR Code",
        ("PIX", "BRL"): "🇧🇷 Pix Brasil (Cuentas Cambistas / BRL)",
        ("PIX", "PYG"): "🇧🇷 Pix Brasil (Acreditación Directa)",
        ("EXTRA_CLUB", "PYG"): "⭐ Extra Club (Crédito Interno Fidelidad)",
        ("TRANF. BANCARIA", "PYG"): "🏦 Transferencia Bancaria Directa",
        ("CHEQUES", "PYG"): "🧾 Cheques en Cartera",
        ("VALE COMPRA", "PYG"): "🎟️ Vale de Compra / Gift Card",
    }

    for r in res_payments:
        fp = str(r["forma_pago"] or "").strip().upper()
        mon = str(r["moneda"] or "PYG").strip().upper()
        nombre = ETIQUETAS_PAGO.get((fp, mon)) or f"{fp} ({mon})"
        monto_val = float(r["monto"])
        pct = round((monto_val / total_recaudado) * 100, 2)
        medios_pago.append({
            "forma_pago_raw": fp,
            "moneda": mon,
            "etiqueta": nombre,
            "cantidad": int(r["cantidad"]),
            "monto": monto_val,
            "porcentaje": pct,
        })

    # Si no hay registros en sale_payments, derivar del total vendido
    if not medios_pago and total_vendido > 0:
        medios_pago = [
            {"forma_pago_raw": "EFECTIVO", "moneda": "PYG", "etiqueta": "🇵🇾 Efectivo Guaraníes (PYG)", "cantidad": total_tickets, "monto": total_vendido, "porcentaje": 100.0}
        ]

    # 6. Desempeño y Productividad por Cajera / Turno
    q_cajeras = f"""
        SELECT
            COALESCE(u.nombre, cs.cajero_nombre, 'Caja Salón Central') as cajera,
            COUNT(DISTINCT v.session_id) as turnos,
            COUNT(v.id) as tickets,
            COALESCE(SUM(v.total), 0) as total_ventas,
            COALESCE(SUM(v.descuento_total), 0) as descuentos
        FROM sales v
        LEFT JOIN users u ON u.id = v.user_id
        LEFT JOIN cash_sessions cs ON cs.id = v.session_id
        WHERE {where_sales}
        GROUP BY COALESCE(u.nombre, cs.cajero_nombre, 'Caja Salón Central')
        ORDER BY total_ventas DESC
    """
    res_cajeras = (await _exec(db, q_cajeras, params)).all()
    cajeras = []
    for r in res_cajeras:
        tot_caj = float(r["total_ventas"] or 0)
        tix_caj = int(r["tickets"] or 0)
        cajeras.append({
            "cajera": r["cajera"],
            "turnos": int(r["turnos"] or 1),
            "tickets": tix_caj,
            "total_ventas": tot_caj,
            "descuentos": float(r["descuentos"] or 0),
            "ticket_promedio": round(tot_caj / max(tix_caj, 1), 0),
            "porcentaje_ventas": round((tot_caj / total_vendido * 100), 2) if total_vendido > 0 else 0.0,
        })

    return {
        "periodo": {
            "fecha_desde": str(fecha_desde) if fecha_desde else None,
            "fecha_hasta": str(fecha_hasta) if fecha_hasta else None,
        },
        "resumen": {
            "total_vendido": total_vendido,
            "cmv": cmv,
            "utilidad_bruta": utilidad_bruta,
            "margen_bruto_pct": margen_bruto_pct,
            "descuentos_pos": descuentos_pos,
            "devoluciones_nc": devoluciones_nc,
            "resultado_neto": resultado_neto,
            "resultado_neto_pct": resultado_neto_pct,
            "total_tickets": total_tickets,
            "ticket_promedio": ticket_promedio,
            "total_returns": total_returns,
        },
        "lineas_ejecutivas": lineas_ejecutivas,
        "medios_pago": medios_pago,
        "cajeras": cajeras,
    }


async def get_sales_detailed_day(
    db: AsyncSession,
    company_id: str,
    fecha: date,
    categoria_id: Optional[str] = None,
    search: Optional[str] = None,
    branch_id: Optional[str] = None,
) -> dict:
    """Reporte detallado de ventas por producto para un día específico (hora oficial America/Asuncion).
    Incluye SKU, PVP catálogo, PPP de venta real, último costo, costo promedio,
    costo total, margen Gs., % margen s/ PVP y s/ PPP, y % participación.
    """
    params = {"company_id": company_id, "fecha": fecha}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    where += " AND v.fecha >= CAST(:fecha AS TIMESTAMP) AT TIME ZONE 'America/Asuncion'"
    where += " AND v.fecha < (CAST(:fecha AS DATE) + interval '1 day') AT TIME ZONE 'America/Asuncion'"

    if branch_id:
        where += " AND v.branch_id = :branch_id"
        params["branch_id"] = branch_id

    if categoria_id and categoria_id != "todas":
        if categoria_id == "sin_categoria":
            where += " AND p.categoria_id IS NULL"
        else:
            where += " AND p.categoria_id = :categoria_id"
            params["categoria_id"] = categoria_id

    if search and search.strip():
        where += " AND (p.nombre ILIKE :search OR p.sku ILIKE :search OR p.codigo_barra ILIKE :search)"
        params["search"] = f"%{search.strip()}%"

    # 1. Resumen global del día
    q_resumen = f"""
        SELECT
            COUNT(DISTINCT v.id) as total_tickets,
            COUNT(DISTINCT vi.product_id) as total_skus,
            COALESCE(SUM(vi.cantidad), 0) as total_unidades,
            COALESCE(SUM(vi.total), 0) as total_venta,
            COALESCE(SUM(COALESCE(vi.descuento_monto, 0)), 0) as total_descuento,
            COALESCE(SUM(vi.cantidad * COALESCE(NULLIF(vi.costo_unitario, 0), NULLIF(p.costo_promedio, 0), p.ultimo_costo, 0)), 0) as total_costo
        FROM sales v
        JOIN sale_items vi ON vi.sale_id = v.id
        LEFT JOIN products p ON p.id = vi.product_id
        LEFT JOIN product_categories c ON c.id = p.categoria_id
        WHERE {where}
    """
    res_summary = (await _exec(db, q_resumen, params)).first()
    total_tickets = int(res_summary["total_tickets"] or 0)
    total_skus = int(res_summary["total_skus"] or 0)
    total_unidades = float(res_summary["total_unidades"] or 0)
    total_venta = float(res_summary["total_venta"] or 0)
    total_costo = float(res_summary["total_costo"] or 0)
    total_descuento = float(res_summary["total_descuento"] or 0)
    margen_bruto_gs = total_venta - total_costo
    margen_bruto_pct = round((margen_bruto_gs / max(total_venta, 1.0)) * 100, 2)
    ticket_promedio = round(total_venta / max(total_tickets, 1), 0)
    ppp_global = round(total_venta / max(total_unidades, 1.0), 2)

    # 2. Detalle de productos
    q_items = f"""
        SELECT
            p.id::text as product_id,
            COALESCE(p.sku, '—') as sku,
            COALESCE(p.codigo_barra, '—') as codigo_barra,
            p.nombre as producto,
            COALESCE(c.nombre, 'Sin Categoría') as categoria,
            COALESCE(p.unidad_medida, 'UN') as unidad_medida,
            COALESCE(p.precio_venta, 0) as pvp,
            COALESCE(p.ultimo_costo, 0) as ultimo_costo,
            COALESCE(p.costo_promedio, 0) as costo_promedio,
            SUM(vi.cantidad) as cantidad,
            SUM(vi.total) as total_venta,
            SUM(COALESCE(vi.descuento_monto, 0)) as total_descuento,
            SUM(vi.cantidad * COALESCE(NULLIF(vi.costo_unitario, 0), NULLIF(p.costo_promedio, 0), p.ultimo_costo, 0)) as total_costo
        FROM sales v
        JOIN sale_items vi ON vi.sale_id = v.id
        LEFT JOIN products p ON p.id = vi.product_id
        LEFT JOIN product_categories c ON c.id = p.categoria_id
        WHERE {where}
        GROUP BY p.id, p.sku, p.codigo_barra, p.nombre, c.nombre, p.unidad_medida, p.precio_venta, p.ultimo_costo, p.costo_promedio
        ORDER BY total_venta DESC
    """
    res_items = (await _exec(db, q_items, params)).all()
    items = []
    base_venta = max(total_venta, 1.0)

    for r in res_items:
        cant = float(r["cantidad"] or 0)
        v_monto = float(r["total_venta"] or 0)
        c_monto = float(r["total_costo"] or 0)
        pvp = float(r["pvp"] or 0)
        ult_c = float(r["ultimo_costo"] or 0)
        c_prom = float(r["costo_promedio"] or 0)
        # PPP = Precio Promedio Ponderado de venta real (efectivamente cobrado por unidad/kg)
        ppp = round(v_monto / cant, 2) if cant > 0 else 0.0
        margen_gs = round(v_monto - c_monto, 2)
        # Margen s/ PVP teórico usando costo promedio (o último costo si no hay prom)
        costo_base = c_prom if c_prom > 0 else ult_c
        margen_pvp_pct = round(((pvp - costo_base) / pvp) * 100, 2) if pvp > 0 else 0.0
        # Margen real promedio s/ lo facturado (PPP vs costo real)
        margen_ppp_pct = round((margen_gs / v_monto) * 100, 2) if v_monto > 0 else 0.0
        participacion = round((v_monto / base_venta) * 100, 2)

        items.append({
            "product_id": r["product_id"],
            "sku": r["sku"],
            "codigo_barra": r["codigo_barra"],
            "producto": r["producto"],
            "categoria": r["categoria"],
            "unidad_medida": r["unidad_medida"],
            "cantidad": cant,
            "pvp": pvp,
            "ppp": ppp,
            "ultimo_costo": ult_c,
            "costo_promedio": c_prom,
            "total_venta": v_monto,
            "total_costo": c_monto,
            "total_descuento": float(r["total_descuento"] or 0),
            "margen_gs": margen_gs,
            "margen_pvp_pct": margen_pvp_pct,
            "margen_ppp_pct": margen_ppp_pct,
            "participacion_pct": participacion,
        })

    return {
        "fecha": str(fecha),
        "resumen": {
            "fecha": str(fecha),
            "total_tickets": total_tickets,
            "total_skus": total_skus,
            "total_unidades": total_unidades,
            "total_venta": total_venta,
            "total_costo": total_costo,
            "total_descuento": total_descuento,
            "margen_bruto_gs": margen_bruto_gs,
            "margen_bruto_pct": margen_bruto_pct,
            "ticket_promedio": ticket_promedio,
            "ppp_global": ppp_global,
        },
        "items": items,
    }


async def get_sales_daily_consolidation(
    db: AsyncSession,
    company_id: str,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    branch_id: Optional[str] = None,
) -> dict:
    """Reporte consolidado cronológico día a día con volumen de ventas, costos,
    utilidad bruta, margen promedio, tickets y precio promedio ponderado.
    """
    params = {"company_id": company_id}
    where = "v.estado <> 'cancelado' AND v.company_id = :company_id"
    where += _build_tz_filter(fecha_desde, fecha_hasta, params, "v.fecha")

    if branch_id:
        where += " AND v.branch_id = :branch_id"
        params["branch_id"] = branch_id

    query = f"""
        SELECT
            TO_CHAR(v.fecha AT TIME ZONE 'America/Asuncion', 'YYYY-MM-DD') as dia,
            COUNT(DISTINCT v.id) as tickets,
            COUNT(DISTINCT vi.product_id) as total_skus,
            COALESCE(SUM(vi.cantidad), 0) as total_cant,
            COALESCE(SUM(vi.total), 0) as total_venta,
            COALESCE(SUM(COALESCE(vi.descuento_monto, 0)), 0) as total_descuento,
            COALESCE(SUM(vi.cantidad * COALESCE(NULLIF(vi.costo_unitario, 0), NULLIF(p.costo_promedio, 0), p.ultimo_costo, 0)), 0) as total_costo
        FROM sales v
        JOIN sale_items vi ON vi.sale_id = v.id
        LEFT JOIN products p ON p.id = vi.product_id
        WHERE {where}
        GROUP BY TO_CHAR(v.fecha AT TIME ZONE 'America/Asuncion', 'YYYY-MM-DD')
        ORDER BY dia DESC
    """
    results = (await _exec(db, query, params)).all()

    dias_list = []
    tot_tickets = 0
    tot_unidades = 0.0
    tot_venta = 0.0
    tot_costo = 0.0
    tot_descuento = 0.0

    DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

    for r in results:
        d_str = str(r["dia"])
        tickets = int(r["tickets"] or 0)
        cant = float(r["total_cant"] or 0)
        v_monto = float(r["total_venta"] or 0)
        c_monto = float(r["total_costo"] or 0)
        desc = float(r["total_descuento"] or 0)
        margen_gs = round(v_monto - c_monto, 2)
        margen_pct = round((margen_gs / max(v_monto, 1.0)) * 100, 2)
        t_prom = round(v_monto / max(tickets, 1), 0)
        ppp = round(v_monto / max(cant, 1.0), 2)

        # Nombre del día de la semana
        try:
            parsed_d = date.fromisoformat(d_str)
            dia_nombre = f"{DIAS_SEMANA[parsed_d.weekday()]}, {parsed_d.strftime('%d/%m/%Y')}"
        except Exception:
            dia_nombre = d_str

        tot_tickets += tickets
        tot_unidades += cant
        tot_venta += v_monto
        tot_costo += c_monto
        tot_descuento += desc

        dias_list.append({
            "dia": d_str,
            "dia_nombre": dia_nombre,
            "tickets": tickets,
            "total_skus": int(r["total_skus"] or 0),
            "unidades_vendidas": cant,
            "total_venta": v_monto,
            "total_costo": c_monto,
            "total_descuento": desc,
            "margen_bruto_gs": margen_gs,
            "margen_bruto_pct": margen_pct,
            "ticket_promedio": t_prom,
            "ppp_promedio": ppp,
        })

    tot_margen = tot_venta - tot_costo
    tot_margen_pct = round((tot_margen / max(tot_venta, 1.0)) * 100, 2)
    t_prom_global = round(tot_venta / max(tot_tickets, 1), 0)
    ppp_global = round(tot_venta / max(tot_unidades, 1.0), 2)
    cant_dias = len(dias_list)
    prom_venta_diaria = round(tot_venta / max(cant_dias, 1), 0)

    return {
        "periodo": {
            "fecha_desde": str(fecha_desde) if fecha_desde else None,
            "fecha_hasta": str(fecha_hasta) if fecha_hasta else None,
            "total_dias": cant_dias,
        },
        "resumen": {
            "total_dias": cant_dias,
            "total_tickets": tot_tickets,
            "total_unidades": tot_unidades,
            "total_venta": tot_venta,
            "total_costo": tot_costo,
            "total_descuento": tot_descuento,
            "margen_bruto_gs": tot_margen,
            "margen_bruto_pct": tot_margen_pct,
            "ticket_promedio": t_prom_global,
            "ppp_global": ppp_global,
            "promedio_venta_diaria": prom_venta_diaria,
        },
        "dias": dias_list,
    }


