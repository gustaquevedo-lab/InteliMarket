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

from datetime import date
from typing import Optional
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from api.src.financial.models import SupplierInvoice


async def _exec(db: AsyncSession, query: str, params: Optional[dict] = None):
    result = await db.execute(text(query), params or {})
    return result.mappings()


async def get_sales_summary(db: AsyncSession, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None, branch_id: Optional[str] = None) -> dict:
    params = {}
    where = "v.estado <> 'cancelado'"
    if fecha_desde:
        where += " AND v.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND v.fecha < CAST(:fecha_hasta AS date) + interval '1 day'"
        params["fecha_hasta"] = fecha_hasta
    if branch_id:
        where += " AND v.branch_id = :branch_id"
        params["branch_id"] = branch_id

    query = f"""
        SELECT
            COUNT(*) as total_ventas,
            COALESCE(SUM(v.total), 0) as monto_total,
            COALESCE(SUM(v.iva_10), 0) as monto_iva_10,
            COALESCE(SUM(v.iva_5), 0) as monto_iva_5,
            COALESCE(SUM(v.total_pagado), 0) as total_pagado,
            COALESCE(SUM(v.saldo), 0) as saldo_pendiente,
            COALESCE((SELECT SUM(vi.cantidad) FROM sale_items vi JOIN sales v2 ON v2.id = vi.sale_id WHERE {where.replace('v.', 'v2.')}), 0) as total_items
        FROM sales v
        WHERE {where}
    """
    result = (await _exec(db, query, params)).first()

    return {
        "total_ventas": result["total_ventas"] or 0,
        "monto_total": float(result["monto_total"] or 0),
        "monto_iva_10": float(result["monto_iva_10"] or 0),
        "monto_iva_5": float(result["monto_iva_5"] or 0),
        "monto_exento": float((result["monto_total"] or 0) - (result["monto_iva_10"] or 0) - (result["monto_iva_5"] or 0)),
        "ticket_promedio": float((result["monto_total"] or 0) / max(result["total_ventas"], 1)),
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


async def get_sales_by_period(db: AsyncSession, agrupar_por: str = "dia", fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None, branch_id: Optional[str] = None) -> list:
    params = {}
    where = "v.estado <> 'cancelado'"
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
        "dia": "DATE(v.fecha)",
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


async def get_sales_by_category(db: AsyncSession, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
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


async def get_margin_summary(db: AsyncSession, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> dict:
    """Margen bruto real del periodo: (monto - costo) / monto, en base al
    costo_unitario cargado en cada sale_item — no una aproximacion inventada."""
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
            COALESCE(SUM(vi.total), 0) as monto,
            COALESCE(SUM(vi.costo_unitario * vi.cantidad), 0) as costo
        FROM sales v
        JOIN sale_items vi ON vi.sale_id = v.id
        WHERE {where}
    """
    r = (await _exec(db, query, params)).first()
    monto = float(r["monto"] or 0)
    costo = float(r["costo"] or 0)
    return {
        "monto": monto,
        "costo": costo,
        "margen_pct": round(((monto - costo) / max(monto, 1)) * 100, 1) if monto > 0 else 0.0,
    }


async def get_sales_by_product(db: AsyncSession, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None, limit: int = 50) -> list:
    params = {"limit": limit}
    where = "v.estado <> 'cancelado'"
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
            SUM(vi.costo_unitario * vi.cantidad) as costo
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
            "margen": round(((float(r["monto"]) - float(r["costo"] or 0)) / max(float(r["monto"]), 1)) * 100, 1),
        }
        for r in results
    ]


async def get_sales_by_client(db: AsyncSession, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
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


async def get_inventory_summary(db: AsyncSession, warehouse_id: Optional[int] = None) -> dict:
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


async def get_inventory_detail(db: AsyncSession, warehouse_id: Optional[int] = None) -> list:
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


async def get_inventory_rotation(db: AsyncSession) -> list:
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


async def get_fiscal_book(db: AsyncSession, tipo_libro: str = "ventas", fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
    params = {}
    where = "v.estado <> 'cancelado'"
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


async def get_fiscal_summary(db: AsyncSession, tipo_libro: str = "ventas", fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> dict:
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


async def get_financial_summary(db: AsyncSession, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> dict:
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
    # Cuentas por cobrar: el modelo de AR difiere por vertical/ETL. Algunos
    # tenants (ej. conector Ñemuha) pueblan accounts_receivable a nivel
    # documento; otros (ej. migración Casa Gonzalito) solo agregan el saldo
    # en customer_accounts.saldo_actual y dejan accounts_receivable vacía.
    # Se suman ambas fuentes — en la práctica solo una está poblada por tenant.
    por_cobrar = (await _exec(db, """
        SELECT
            COALESCE((SELECT SUM(saldo_pendiente) FROM accounts_receivable WHERE estado = 'pendiente'), 0)
            + COALESCE((SELECT SUM(saldo_actual) FROM customer_accounts WHERE saldo_actual > 0), 0)
        AS total
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


async def get_financial_by_day(db: AsyncSession, fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None) -> list:
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


async def get_fifo_costing(db: AsyncSession, product_id=None, warehouse_id=None) -> list:
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


async def get_lifo_costing(db: AsyncSession, product_id=None, warehouse_id=None) -> list:
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


async def get_cost_comparison(db: AsyncSession, product_id=None, warehouse_id=None) -> list:
    fifo_data = await get_fifo_costing(db, product_id, warehouse_id)
    lifo_data = await get_lifo_costing(db, product_id, warehouse_id)

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


async def get_inventory_valuation(db: AsyncSession, warehouse_id: Optional[str] = None) -> dict:
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
