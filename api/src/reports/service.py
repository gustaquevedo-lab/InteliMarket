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
        WITH filtered_sales AS (
            SELECT v.id, v.total, v.iva_10, v.iva_5
            FROM sales v
            WHERE {where}
        ),
        items_agg AS (
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
            SUM(vi.costo_unitario * vi.cantidad) as costo
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


async def get_inventory_rotation(db: AsyncSession, company_id: str) -> list:
    query = """
        SELECT
            p.nombre as producto,
            p.sku,
            COALESCE(SUM(vi.cantidad) FILTER (WHERE v.fecha >= CURRENT_DATE - INTERVAL '30 days'), 0) as ventas_30d,
            COALESCE((SELECT SUM(s.cantidad) FROM stock s WHERE s.product_id = p.id), 0) as stock_actual
        FROM products p
        LEFT JOIN sale_items vi ON vi.product_id = p.id
        LEFT JOIN sales v ON v.id = vi.sale_id AND v.estado <> 'cancelado' AND v.company_id = :company_id
        WHERE p.company_id = :company_id
        GROUP BY p.id, p.nombre, p.sku
    """
    results = (await _exec(db, query, {"company_id": company_id})).all()
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


async def get_inventory_valuation(db: AsyncSession, company_id: str, warehouse_id: Optional[str] = None) -> dict:
    params = {"company_id": company_id}
    where = "s.cantidad > 0 AND w.company_id = :company_id"
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
        lm_start = datetime(lm_year, lm_month, min(fecha_desde.day, 28), 0, 0, 0, tzinfo=tz)
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
                "semana_pasada": sum(s["semana_pasada"] for s in series),
                "meta": sum(s["meta"] for s in series),
                "rentabilidad_real": sum((s["rentabilidad_real"] or 0) for s in series),
                "rentabilidad_meta": sum(s["rentabilidad_meta"] for s in series),
            }
        }

    else:
        num_days = (fecha_hasta - fecha_desde).days + 1
        d_start = datetime(fecha_desde.year, fecha_desde.month, fecha_desde.day, 0, 0, 0, tzinfo=tz)
        d_end = datetime(fecha_hasta.year, fecha_hasta.month, fecha_hasta.day, 0, 0, 0, tzinfo=tz) + timedelta(days=1)

        lw_start = d_start - timedelta(days=7)
        lw_end = d_end - timedelta(days=7)

        lm_month = fecha_desde.month - 1 if fecha_desde.month > 1 else 12
        lm_year = fecha_desde.year if fecha_desde.month > 1 else fecha_desde.year - 1
        lm_start = datetime(lm_year, lm_month, min(fecha_desde.day, 28), 0, 0, 0, tzinfo=tz)
        lm_end = lm_start + timedelta(days=num_days)

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
            lm_str = str(date(lm_y, lm_m, min(cur_day.day, 28)))

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
                "semana_pasada": sum(s["semana_pasada"] for s in series),
                "meta": sum(s["meta"] for s in series),
                "rentabilidad_real": sum(s["rentabilidad_real"] for s in series),
                "rentabilidad_meta": sum(s["rentabilidad_meta"] for s in series),
            }
        }
