"""Product and category service with rich 360 view, stats and full data integration"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, text, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.products.models import Product, ProductCategory
from api.src.products.schemas import ProductCreate, ProductUpdate, CategoryCreate
from api.src.inventory.models import Stock, Warehouse, InventoryMovement
from api.src.purchases.models import PurchaseOrder, PurchaseOrderItem, Supplier
from api.src.promotions.models import Promotion
from api.src.sales.models import Sale, SaleItem
from api.src.customers.models import Customer
from api.src.pack_barcodes.models import ProductPackBarcode


# ═══════════════════════════════════════════════════════════════
#  CATEGORIAS
# ═══════════════════════════════════════════════════════════════

async def create_category(db: AsyncSession, data: CategoryCreate) -> ProductCategory:
    cat = ProductCategory(
        company_id=data.company_id,
        parent_id=data.parent_id,
        nombre=data.nombre,
        codigo=data.codigo,
        activo=True,
    )
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return cat


async def list_categories(db: AsyncSession, company_id: str) -> list[ProductCategory]:
    try:
        c_uuid = UUID(company_id)
    except ValueError:
        c_uuid = UUID("00000000-0000-0000-0000-000000000010")

    result = await db.execute(
        select(ProductCategory)
        .where(ProductCategory.company_id == c_uuid)
        .order_by(ProductCategory.nombre.asc())
    )
    return result.scalars().all()


async def get_category(db: AsyncSession, category_id: str) -> ProductCategory | None:
    try:
        cat_uuid = UUID(category_id)
    except ValueError:
        return None
    result = await db.execute(select(ProductCategory).where(ProductCategory.id == cat_uuid))
    return result.scalar_one_or_none()


# ═══════════════════════════════════════════════════════════════
#  PRODUCTOS
# ═══════════════════════════════════════════════════════════════

async def create_product(db: AsyncSession, data: ProductCreate) -> Product:
    product = Product(**data.model_dump())
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return product


async def get_product(db: AsyncSession, product_id: str) -> Product | None:
    try:
        p_uuid = UUID(product_id)
    except ValueError:
        return None
    result = await db.execute(
        select(Product).options(selectinload(Product.categoria)).where(Product.id == p_uuid)
    )
    return result.scalar_one_or_none()


async def get_product_by_sku(db: AsyncSession, company_id: str, sku: str) -> Product | None:
    try:
        c_uuid = UUID(company_id)
    except ValueError:
        return None
    result = await db.execute(
        select(Product).where(Product.company_id == c_uuid, Product.sku == sku).order_by(Product.activo.desc())
    )
    return result.scalars().first()


async def get_product_by_barcode(db: AsyncSession, company_id: str, barcode: str) -> Product | None:
    try:
        c_uuid = UUID(company_id)
    except ValueError:
        return None

    clean_bc = barcode.strip() if barcode else ""
    if not clean_bc:
        return None

    # 1. Búsqueda directa por código de barras principal
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.categoria))
        .where(Product.company_id == c_uuid, Product.codigo_barra == clean_bc)
        .order_by(Product.activo.desc())
    )
    prod = result.scalars().first()
    if prod:
        return prod

    # 2. Búsqueda por código alternativo EAN / Pack registrado
    pack_res = await db.execute(
        select(ProductPackBarcode).where(
            ProductPackBarcode.company_id == c_uuid,
            ProductPackBarcode.codigo_barra == clean_bc,
            ProductPackBarcode.activo == True
        )
    )
    pack = pack_res.scalars().first()
    if pack:
        prod_res = await db.execute(
            select(Product).options(selectinload(Product.categoria)).where(Product.id == pack.product_id)
        )
        matched = prod_res.scalar_one_or_none()
        if matched:
            return matched

    # 3. Tolerancia EAN-13 <-> UPC-A (variantes con y sin cero inicial)
    norm_bc = clean_bc.lstrip("0")
    if norm_bc:
        var_res = await db.execute(
            select(Product)
            .options(selectinload(Product.categoria))
            .where(
                Product.company_id == c_uuid,
                or_(
                    Product.codigo_barra == norm_bc,
                    Product.codigo_barra == "0" + norm_bc,
                )
            )
            .order_by(Product.activo.desc())
        )
        alt_prod = var_res.scalars().first()
        if alt_prod:
            return alt_prod

    return None


async def list_products(
    db: AsyncSession,
    company_id: str,
    categoria_id: Optional[str] = None,
    search: Optional[str] = None,
    activo: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    supplier_id: Optional[str] = None,
) -> list[Product]:
    try:
        c_uuid = UUID(company_id)
    except ValueError:
        c_uuid = UUID("00000000-0000-0000-0000-000000000010")

    query = (
        select(Product)
        .options(selectinload(Product.categoria))
        .where(Product.company_id == c_uuid)
    )

    if supplier_id:
        try:
            supp_uuid = UUID(supplier_id)
            query = (
                query.join(PurchaseOrderItem, PurchaseOrderItem.product_id == Product.id)
                .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id)
                .where(PurchaseOrder.supplier_id == supp_uuid)
                .distinct()
            )
        except ValueError:
            pass

    if categoria_id:
        try:
            cat_uuid = UUID(categoria_id)
            query = query.where(Product.categoria_id == cat_uuid)
        except ValueError:
            pass

    if activo is not None:
        query = query.where(Product.activo == activo)
    else:
        # Por defecto, servir únicamente productos activos para POS, catálogo y ventas
        query = query.where(Product.activo == True)

    if search and search.strip():
        tokens = [t.strip() for t in search.split() if t.strip()]
        if len(tokens) > 1:
            token_conds = []
            for t in tokens:
                token_conds.append(
                    or_(
                        Product.nombre.ilike(f"%{t}%"),
                        Product.sku.ilike(f"%{t}%"),
                        Product.codigo_barra.ilike(f"%{t}%"),
                        Product.id.in_(
                            select(ProductPackBarcode.product_id).where(
                                ProductPackBarcode.company_id == c_uuid,
                                ProductPackBarcode.activo == True,
                                ProductPackBarcode.codigo_barra.ilike(f"%{t}%"),
                            )
                        ),
                    )
                )
            query = query.where(and_(*token_conds))
        elif len(tokens) == 1:
            t = tokens[0]
            query = query.where(
                or_(
                    Product.nombre.ilike(f"%{t}%"),
                    Product.sku.ilike(f"%{t}%"),
                    Product.codigo_barra.ilike(f"%{t}%"),
                    Product.id.in_(
                        select(ProductPackBarcode.product_id).where(
                            ProductPackBarcode.company_id == c_uuid,
                            ProductPackBarcode.activo == True,
                            ProductPackBarcode.codigo_barra.ilike(f"%{t}%"),
                        )
                    ),
                )
            )

    # Filtrar productos con nombres válidos primero y activos con máxima prioridad
    query = query.order_by(Product.activo.desc(), Product.nombre.asc()).limit(limit).offset(offset)
    result = await db.execute(query)
    products = list(result.scalars().all())

    if products:
        p_ids = [p.id for p in products]

        # 1. Asociar Stock Físico Real y Disponible en lote
        stock_map_res = await db.execute(
            text("""
                SELECT product_id,
                       coalesce(sum(cantidad), 0) as stock_total,
                       coalesce(sum(cantidad - coalesce(cantidad_reservada, 0)), 0) as stock_disponible
                FROM stock
                WHERE product_id = ANY(:p_ids)
                GROUP BY product_id
            """),
            {"p_ids": p_ids}
        )
        stock_map = {r.product_id: (int(r.stock_total), int(r.stock_disponible)) for r in stock_map_res}
        for p in products:
            st, sd = stock_map.get(p.id, (0, 0))
            p.__dict__["stock_actual"] = st
            p.__dict__["stock_disponible"] = sd

        # 2. Asociar Proveedor (directo del producto o por órdenes de compra)
        direct_supp_ids = [p.supplier_id for p in products if getattr(p, "supplier_id", None)]
        suppliers_by_id = {}
        if direct_supp_ids:
            supp_rows = await db.execute(
                text("SELECT id, razon_social FROM suppliers WHERE id = ANY(:s_ids)"),
                {"s_ids": list(set(direct_supp_ids))}
            )
            suppliers_by_id = {r.id: r.razon_social for r in supp_rows}

        # Fallback para productos sin supplier_id asignado: buscar en purchase_orders
        missing_supp_pids = [p.id for p in products if not getattr(p, "supplier_id", None)]
        po_supp_map = {}
        if missing_supp_pids:
            po_supp_res = await db.execute(
                text("""
                    SELECT DISTINCT ON (poi.product_id) poi.product_id, po.supplier_id, s.razon_social as supplier_nombre
                    FROM purchase_order_items poi
                    JOIN purchase_orders po ON po.id = poi.purchase_order_id
                    JOIN suppliers s ON s.id = po.supplier_id
                    WHERE poi.product_id = ANY(:p_ids)
                    ORDER BY poi.product_id, poi.created_at DESC
                """),
                {"p_ids": missing_supp_pids}
            )
            po_supp_map = {r.product_id: (r.supplier_id, r.supplier_nombre) for r in po_supp_res}

        for p in products:
            if getattr(p, "supplier_id", None) and p.supplier_id in suppliers_by_id:
                p.__dict__["supplier_nombre"] = suppliers_by_id[p.supplier_id]
            elif p.id in po_supp_map:
                p.__dict__["supplier_id"] = po_supp_map[p.id][0]
                p.__dict__["supplier_nombre"] = po_supp_map[p.id][1]

    return products


async def annotate_products_with_promos(db: AsyncSession, company_id: str, products: list) -> None:
    """Anota en lote los productos con la promo vigente HOY (si la hay).
    Muta los objetos directamente -- Pydantic los lee via getattr (from_attributes=True).
    """
    if not products:
        return
    if products and hasattr(products[0], "company_id") and products[0].company_id:
        c_uuid = products[0].company_id
    else:
        try:
            c_uuid = UUID(str(company_id))
        except (ValueError, TypeError):
            c_uuid = UUID("00000000-0000-0000-0000-000000000010")

    try:
        from zoneinfo import ZoneInfo
        asuncion_tz = ZoneInfo("America/Asuncion")
    except Exception:
        asuncion_tz = None

    if asuncion_tz:
        today = datetime.now(asuncion_tz).date()
    else:
        today = date.today()
    # Python weekday(): 0=Lun..6=Dom -> convertir a 0=Dom..6=Sab del legacy
    sunday_dow = (today.weekday() + 1) % 7

    promo_rows = await db.execute(
        select(
            Promotion.producto_ids,
            Promotion.id,
            Promotion.nombre,
            Promotion.precio_fijo_promocional,
            Promotion.dias_semana,
        ).where(
            Promotion.company_id == c_uuid,
            Promotion.activo == True,
            Promotion.estado == "activa",
            Promotion.valido_desde <= today,
            Promotion.valido_hasta >= today,
            Promotion.precio_fijo_promocional != None,
        ).order_by(Promotion.precio_fijo_promocional.asc(), Promotion.valido_hasta.asc())
    )

    promo_map: dict[UUID, dict] = {}
    for pr in promo_rows.all():
        prod_ids_promo = pr.producto_ids or []
        dias = pr.dias_semana or []
        # Saltar si la promo no aplica hoy por dia de semana
        if dias and sunday_dow not in dias:
            continue
        for pid in prod_ids_promo:
            # Priorizar siempre la promoción con menor precio (mayor descuento al cliente)
            if pid not in promo_map or pr.precio_fijo_promocional < promo_map[pid]["precio"]:
                promo_map[pid] = {
                    "id": str(pr.id),
                    "nombre": pr.nombre,
                    "precio": pr.precio_fijo_promocional,
                    "dias": dias,
                }

    for p in products:
        info = promo_map.get(p.id)
        if info and info["precio"]:
            promo_p = info["precio"]
            p.__dict__["precio_promo"] = promo_p
            p.__dict__["en_promocion"] = True
            p.__dict__["promocion_id"] = info["id"]
            p.__dict__["promocion_nombre"] = info["nombre"]
            p.__dict__["promo_dias_semana"] = info["dias"]
            # Preservar precio regular si precio_venta ya está en promo o si falta
            if getattr(p, "precio_regular", None) is None or getattr(p, "precio_regular", None) <= promo_p:
                if p.precio_venta and p.precio_venta > promo_p:
                    p.__dict__["precio_regular"] = p.precio_venta
        else:
            p.__dict__["precio_promo"] = None
            p.__dict__["en_promocion"] = False
            p.__dict__["promocion_id"] = None
            p.__dict__["promocion_nombre"] = None
            p.__dict__["promo_dias_semana"] = None


async def get_products_stats(db: AsyncSession, company_id: str) -> dict:
    try:
        c_uuid = UUID(company_id)
    except ValueError:
        c_uuid = UUID("00000000-0000-0000-0000-000000000010")

    total_q = await db.execute(select(func.count(Product.id)).where(Product.company_id == c_uuid))
    total_productos = total_q.scalar() or 0

    activos_q = await db.execute(select(func.count(Product.id)).where(Product.company_id == c_uuid, Product.activo == True))
    activos = activos_q.scalar() or 0

    categorias_q = await db.execute(select(func.count(ProductCategory.id)).where(ProductCategory.company_id == c_uuid))
    total_categorias = categorias_q.scalar() or 0

    val_q = await db.execute(
        select(
            func.sum(Product.costo_promedio),
            func.avg(Product.precio_venta)
        ).where(Product.company_id == c_uuid)
    )
    val_row = val_q.first()

    # stock_bajo / quiebres eran constantes hardcodeadas (42 / 3051) --
    # calculadas de verdad ahora: stock total por producto (sumando todos
    # los depositos), comparado contra stock_minimo. LEFT JOIN (no INNER):
    # un producto que jamas tuvo una fila de stock tambien es quiebre, no
    # solo el que tiene una fila con cantidad <= 0.
    stock_por_producto = (
        select(Stock.product_id, func.sum(Stock.cantidad).label("total_stock"))
        .group_by(Stock.product_id)
        .subquery()
    )
    total_stock_expr = func.coalesce(stock_por_producto.c.total_stock, 0)
    quiebres_q = await db.execute(
        select(func.count()).select_from(Product)
        .outerjoin(stock_por_producto, stock_por_producto.c.product_id == Product.id)
        .where(Product.company_id == c_uuid, Product.activo == True, total_stock_expr <= 0)
    )
    quiebres = quiebres_q.scalar() or 0

    stock_bajo_q = await db.execute(
        select(func.count()).select_from(Product)
        .outerjoin(stock_por_producto, stock_por_producto.c.product_id == Product.id)
        .where(
            Product.company_id == c_uuid, Product.activo == True, Product.stock_minimo > 0,
            total_stock_expr > 0, total_stock_expr <= Product.stock_minimo,
        )
    )
    stock_bajo = stock_bajo_q.scalar() or 0

    pesables_q = await db.execute(
        select(func.count(Product.id)).where(Product.company_id == c_uuid, Product.activo == True, Product.unidad_medida == "KG")
    )
    total_pesables = pesables_q.scalar() or 0

    valorizado_q = await db.execute(
        select(func.sum(Stock.cantidad * func.coalesce(Stock.costo_unitario, 0)))
        .select_from(Stock).join(Product, Product.id == Stock.product_id)
        .where(Product.company_id == c_uuid)
    )
    total_valorizado_costo = float(valorizado_q.scalar() or 0)

    margen_q = await db.execute(
        select(func.avg((Product.precio_venta - Product.costo_promedio) / Product.precio_venta * 100))
        .where(Product.company_id == c_uuid, Product.activo == True, Product.precio_venta > 0)
    )
    margen_promedio_pct = round(float(margen_q.scalar() or 0), 1)

    return {
        "total_productos": total_productos,
        "activos": activos,
        "inactivos": total_productos - activos,
        "total_categorias": total_categorias,
        "precio_promedio": float(val_row[1] or 0) if val_row else 0.0,
        "stock_bajo": stock_bajo,
        "quiebres": quiebres,
        "total_pesables": total_pesables,
        "total_valorizado_costo": total_valorizado_costo,
        "margen_promedio_pct": margen_promedio_pct,
        "total_quiebres": quiebres,
        "total_bajos": stock_bajo,
    }


# ═══════════════════════════════════════════════════════════════
#  FICHA 360° COMPLETA Y CONECTADA
# ═══════════════════════════════════════════════════════════════

async def get_product_360(db: AsyncSession, product_id: str) -> dict | None:

    product = await get_product(db, product_id)
    if not product:
        return None

    p_uuid = UUID(product_id) if isinstance(product_id, str) else product_id

    # 0. Nombre de Categoría
    cat_nombre = product.categoria.nombre if product.categoria else "General / Almacén"

    # 1. Stock por Depósito
    stock_rows = await db.execute(
        text("""
            SELECT s.id, s.warehouse_id, s.cantidad, s.cantidad_reservada, s.costo_unitario,
                   w.nombre as warehouse_nombre, w.codigo as warehouse_codigo
            FROM stock s
            JOIN warehouses w ON w.id = s.warehouse_id
            WHERE s.product_id = :p_id
        """),
        {"p_id": p_uuid}
    )
    stocks = [dict(r._mapping) for r in stock_rows]

    if not stocks:
        w_rows = await db.execute(text("SELECT id as warehouse_id, nombre as warehouse_nombre, codigo as warehouse_codigo FROM warehouses WHERE activo = true LIMIT 5"))
        costo_u = float(product.costo_promedio or product.ultimo_costo or 0)
        stocks = [
            {
                "id": str(uuid.uuid4()),
                "warehouse_id": r.warehouse_id,
                "warehouse_nombre": r.warehouse_nombre,
                "warehouse_codigo": r.warehouse_codigo,
                "cantidad": 0,
                "cantidad_reservada": 0,
                "costo_unitario": costo_u,
            }
            for r in w_rows.all()
        ]

    total_stock = sum(float(s.get("cantidad") or 0) for s in stocks)
    total_reservado = sum(float(s.get("cantidad_reservada") or 0) for s in stocks)

    # 2. Últimas Compras
    purchase_rows = await db.execute(
        text("""
            SELECT po.id, po.numero, po.fecha, po.estado, poi.cantidad, poi.precio_unitario, poi.total,
                   s.razon_social as supplier_nombre, s.ruc as supplier_ruc
            FROM purchase_order_items poi
            JOIN purchase_orders po ON po.id = poi.purchase_order_id
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            WHERE poi.product_id = :p_id
            ORDER BY po.fecha DESC
            LIMIT 15
        """),
        {"p_id": p_uuid}
    )
    purchases = [dict(r._mapping) for r in purchase_rows]

    # 3. Últimas Ventas
    sale_rows = await db.execute(
        text("""
            SELECT sa.id, sa.numero, sa.fecha, sa.total as venta_total,
                   si.cantidad, si.precio_unitario, si.total as subtotal,
                   c.razon_social as customer_nombre
            FROM sale_items si
            JOIN sales sa ON sa.id = si.sale_id
            LEFT JOIN customers c ON c.id = sa.customer_id
            WHERE si.product_id = :p_id
            ORDER BY sa.fecha DESC
            LIMIT 15
        """),
        {"p_id": p_uuid}
    )
    sales = [dict(r._mapping) for r in sale_rows]

    # 4. Historial mensual de ventas para gráfico (6 meses)
    hist_v_rows = await db.execute(
        text("""
            SELECT
                TO_CHAR(sa.fecha AT TIME ZONE 'America/Asuncion', 'YYYY-MM') as mes,
                TO_CHAR(sa.fecha AT TIME ZONE 'America/Asuncion', 'Mon YY') as mes_label,
                COALESCE(SUM(si.cantidad), 0) as unidades,
                COALESCE(SUM(si.total), 0) as monto,
                COUNT(DISTINCT sa.id) as num_ventas
            FROM sale_items si
            JOIN sales sa ON sa.id = si.sale_id
            WHERE si.product_id = :p_id
              AND sa.fecha >= NOW() - INTERVAL '6 months'
            GROUP BY 1, 2
            ORDER BY 1 ASC
        """),
        {"p_id": p_uuid}
    )
    historial_ventas = [dict(r._mapping) for r in hist_v_rows]

    # 5. Historial mensual de costos para gráfico (6 meses)
    hist_c_rows = await db.execute(
        text("""
            SELECT
                TO_CHAR(po.fecha AT TIME ZONE 'America/Asuncion', 'YYYY-MM') as mes,
                TO_CHAR(po.fecha AT TIME ZONE 'America/Asuncion', 'Mon YY') as mes_label,
                ROUND(AVG(poi.precio_unitario), 0) as costo_promedio_mes,
                SUM(poi.cantidad) as unidades_compradas
            FROM purchase_order_items poi
            JOIN purchase_orders po ON po.id = poi.purchase_order_id
            WHERE poi.product_id = :p_id
              AND po.fecha >= NOW() - INTERVAL '6 months'
              AND po.estado != 'cancelada'
            GROUP BY 1, 2
            ORDER BY 1 ASC
        """),
        {"p_id": p_uuid}
    )
    historial_costos = [dict(r._mapping) for r in hist_c_rows]

    # 6. Rotación (30 días)
    v30_res = await db.execute(
        text("""
            SELECT COALESCE(SUM(si.cantidad), 0) as total_qty,
                   COALESCE(SUM(si.total), 0) as total_monto
            FROM sale_items si
            JOIN sales sa ON sa.id = si.sale_id
            WHERE si.product_id = :p_id AND sa.fecha >= NOW() - INTERVAL '30 days'
        """),
        {"p_id": p_uuid}
    )
    v30 = v30_res.first()
    ventas_30d_qty = float(v30.total_qty) if v30 else 0.0
    ventas_30d_monto = float(v30.total_monto) if v30 else 0.0
    demanda_diaria = round(ventas_30d_qty / 30.0, 2)
    autonomia_dias = round(total_stock / demanda_diaria, 1) if demanda_diaria > 0 else (999 if total_stock > 0 else 0)

    # 7. Kardex / Movimientos (últimos 50 movimientos con comprobante y desglose)
    mov_rows = await db.execute(
        text("""
            SELECT im.id, im.tipo, im.cantidad, im.costo_unitario, im.motivo, im.referencia_type,
                   im.referencia_id, im.created_at, w.nombre as warehouse_nombre,
                   s.numero as sale_numero, po.numero as po_numero
            FROM inventory_movements im
            LEFT JOIN warehouses w ON w.id = im.warehouse_id
            LEFT JOIN sales s ON s.id = im.referencia_id AND im.referencia_type = 'sale'
            LEFT JOIN purchase_orders po ON po.id = im.referencia_id AND (im.referencia_type = 'purchase_order' OR im.referencia_type = 'purchase')
            WHERE im.product_id = :p_id
            ORDER BY im.created_at DESC
            LIMIT 50
        """),
        {"p_id": p_uuid}
    )
    movements_raw = [dict(r._mapping) for r in mov_rows]

    def _tipo_mov_info(tipo_str: str, cant: float) -> tuple[str, str, bool]:
        t = (tipo_str or "").lower()
        if "venta" in t:
            return "Venta POS", "rose", False
        elif "compra" in t or "recepcion" in t:
            return "Recepción Compra", "emerald", True
        elif "devolucion" in t or "cancelacion_venta" in t:
            return "Devolución Cliente", "sky", True
        elif "cancelacion_recepcion" in t:
            return "Devolución a Proveedor", "amber", False
        elif "ajuste_positivo" in t:
            return "Ajuste Inventario (+)", "emerald", True
        elif "ajuste_negativo" in t or "merma" in t:
            return "Ajuste / Merma (-)", "rose", False
        elif "transferencia" in t:
            return "Transferencia Depósito", "violet", cant > 0
        return t.replace("_", " ").title() or "Movimiento", "slate", cant > 0

    costo_ref = float(product.costo_promedio or product.ultimo_costo or 0)
    movements = []
    total_entradas_kardex = 0.0
    total_salidas_kardex = 0.0

    for m in movements_raw:
        c = float(m.get("cantidad") or 0)
        c_u = float(m.get("costo_unitario") or 0)
        if c_u <= 0:
            c_u = costo_ref

        tipo_label, color_theme, es_entrada = _tipo_mov_info(m.get("tipo"), c)
        if es_entrada:
            total_entradas_kardex += abs(c)
        else:
            total_salidas_kardex += abs(c)

        comprobante = m.get("sale_numero") or m.get("po_numero") or None
        if not comprobante and m.get("referencia_id"):
            comprobante = f"REF #{str(m.get('referencia_id'))[:8].upper()}"

        movements.append({
            "id": str(m["id"]),
            "tipo": m.get("tipo") or "desconocido",
            "tipo_label": tipo_label,
            "color_theme": color_theme,
            "es_entrada": es_entrada,
            "cantidad": c,
            "cantidad_abs": abs(c),
            "costo_unitario": c_u,
            "costo_total": round(abs(c) * c_u, 0),
            "motivo": m.get("motivo"),
            "referencia_type": m.get("referencia_type"),
            "referencia_id": str(m.get("referencia_id")) if m.get("referencia_id") else None,
            "comprobante_numero": comprobante,
            "warehouse_nombre": m.get("warehouse_nombre") or "Depósito Central",
            "created_at": m["created_at"].isoformat() if m.get("created_at") else None,
        })

    # Si no había inventory_movements pero sí hay ventas, crear kardex sintético desde ventas
    if not movements and sales:
        for sa in sales:
            q = float(sa.get("cantidad") or 1)
            total_salidas_kardex += q
            movements.append({
                "id": str(sa.get("id")),
                "tipo": "salida_venta",
                "tipo_label": "Venta POS",
                "color_theme": "rose",
                "es_entrada": False,
                "cantidad": -q,
                "cantidad_abs": q,
                "costo_unitario": costo_ref,
                "costo_total": round(q * costo_ref, 0),
                "motivo": "Venta mostrador",
                "referencia_type": "sale",
                "referencia_id": str(sa.get("id")),
                "comprobante_numero": sa.get("numero") or "Ticket Venta",
                "warehouse_nombre": "Salón de Ventas",
                "created_at": sa.get("fecha").isoformat() if hasattr(sa.get("fecha"), "isoformat") else str(sa.get("fecha")),
            })

    # 8. Promociones aplicadas (vigentes e históricas)
    try:
        from zoneinfo import ZoneInfo
        hoy = datetime.now(ZoneInfo("America/Asuncion")).date()
    except Exception:
        hoy = date.today()

    promo_rows = await db.execute(
        text("""
            SELECT
                p.id, p.nombre, p.descripcion, p.tipo, p.valor,
                p.precio_fijo_promocional, p.aplica_a, p.estado,
                p.valido_desde, p.valido_hasta, p.dias_semana,
                p.origen, p.financiamiento, p.activo,
                p.costo_unitario_referencia,
                p.limite_por_compra, p.stock_limite_unidades, p.unidades_vendidas_promo
            FROM promotions p
            WHERE p.company_id = :company_id
              AND :p_id = ANY(p.producto_ids)
            ORDER BY p.valido_hasta DESC
            LIMIT 20
        """),
        {"company_id": product.company_id, "p_id": p_uuid}
    )
    promociones = []
    for pr in promo_rows.all():
        row = dict(pr._mapping)
        desde = row.get("valido_desde")
        hasta = row.get("valido_hasta")
        es_vigente = bool(row.get("activo") and row.get("estado") == "activa" and desde and hasta and desde <= hoy <= hasta)
        row["es_vigente_hoy"] = es_vigente
        precio_base = float(product.precio_venta or 0)
        precio_promo = float(row.get("precio_fijo_promocional") or 0)
        if precio_promo > 0 and precio_base > 0:
            row["ahorro_por_unidad"] = round(precio_base - precio_promo, 0)
            row["ahorro_pct"] = round((precio_base - precio_promo) / precio_base * 100, 1)
        else:
            row["ahorro_por_unidad"] = 0
            row["ahorro_pct"] = 0
        promociones.append(row)

    # 9. Códigos Alternativos (product_pack_barcodes)
    pack_rows = await db.execute(
        text("""
            SELECT id, codigo_barra, etiqueta, unidades_por_paquete, activo, created_at
            FROM product_pack_barcodes
            WHERE product_id = :p_id
            ORDER BY unidades_por_paquete ASC
        """),
        {"p_id": p_uuid}
    )
    codigos_alternativos = [dict(r._mapping) for r in pack_rows]

    # 10. Info del Proveedor vinculado al producto
    supplier_info = None
    if product.supplier_id:
        sup_row = await db.execute(
            text("""
                SELECT id, razon_social, ruc, telefono, email, contacto_nombre,
                       contacto_telefono, plazo_pago_dias, tipo_proveedor, rating,
                       moneda_default, ciudad, plazo_entrega_promedio, grupo
                FROM suppliers WHERE id = :sid
            """),
            {"sid": product.supplier_id}
        )
        sup = sup_row.first()
        if sup:
            supplier_info = dict(sup._mapping)

    # 11. Escalas de Precio Mayoristas (sp_tiered_prices)
    scale_rows = await db.execute(
        text("""
            SELECT id, min_qty, max_qty, precio_unitario, moneda, activo, created_at
            FROM sp_tiered_prices
            WHERE product_id = :p_id AND activo = true
            ORDER BY min_qty ASC
        """),
        {"p_id": p_uuid}
    )
    precio_base_un = float(product.precio_venta or 0)
    costo_prom_eval = float(product.costo_promedio or product.ultimo_costo or 0)
    escalas_precio = []
    for sr in scale_rows.all():
        s_dict = dict(sr._mapping)
        p_esc = float(s_dict.get("precio_unitario") or 0)
        min_q = int(s_dict.get("min_qty") or 1)
        max_q = s_dict.get("max_qty")
        ahorro_un = max(0.0, precio_base_un - p_esc) if precio_base_un > 0 else 0.0
        desc_pct = round((ahorro_un / precio_base_un * 100), 1) if precio_base_un > 0 else 0.0
        tot_min = round(min_q * p_esc, 0)
        mrg_esc = round(((p_esc - costo_prom_eval) / p_esc * 100), 1) if p_esc > 0 else 0.0
        mrk_esc = round(((p_esc - costo_prom_eval) / costo_prom_eval * 100), 1) if costo_prom_eval > 0 else 0.0

        escalas_precio.append({
            "id": str(s_dict["id"]),
            "min_qty": min_q,
            "max_qty": int(max_q) if max_q is not None else None,
            "precio_unitario": p_esc,
            "moneda": s_dict.get("moneda") or "PYG",
            "ahorro_por_unidad": ahorro_un,
            "descuento_pct": desc_pct,
            "total_minimo": tot_min,
            "margen_pct": mrg_esc,
            "markup_pct": mrk_esc,
        })

    # 12. Métricas Financieras y Estructura de Costos Detallada
    costo_prom = float(product.costo_promedio or 0)
    costo_ult = float(product.ultimo_costo or 0)
    costo_landed = float(getattr(product, "costo_landed", None) or 0)

    # Si uno es 0, sincronizar con el otro para no romper indicadores
    if costo_prom <= 0 and costo_ult > 0:
        costo_prom = costo_ult
    if costo_ult <= 0 and costo_prom > 0:
        costo_ult = costo_prom
    costo_principal = costo_prom if costo_prom > 0 else costo_ult

    precio = float(product.precio_venta or 0)
    precio_regular = float(getattr(product, "precio_regular", None) or precio)

    # Variación porcentual de Último Costo vs Costo Promedio (PPP)
    variacion_costo_pct = round(((costo_ult - costo_prom) / costo_prom * 100), 1) if costo_prom > 0 else 0.0

    # Margen sobre Costo Promedio
    margen_prom_monto = precio - costo_prom
    margen_prom_pct = round((margen_prom_monto / precio * 100), 1) if precio > 0 else 0.0
    markup_prom_pct = round((margen_prom_monto / costo_prom * 100), 1) if costo_prom > 0 else 0.0

    # Margen sobre Último Costo
    margen_ult_monto = precio - costo_ult
    margen_ult_pct = round((margen_ult_monto / precio * 100), 1) if precio > 0 else 0.0
    markup_ult_pct = round((margen_ult_monto / costo_ult * 100), 1) if costo_ult > 0 else 0.0

    valor_inventario_costo = total_stock * (costo_principal if costo_principal > 0 else precio * 0.7)
    valor_inventario_venta = total_stock * precio

    costos_estructura = {
        "costo_promedio": costo_prom,
        "ultimo_costo": costo_ult,
        "costo_landed": costo_landed,
        "metodo_costeo": getattr(product, "metodo_costeo", "PPP") or "PPP",
        "variacion_costo_pct": variacion_costo_pct,
        "margen_sobre_promedio_pct": margen_prom_pct,
        "margen_sobre_ultimo_pct": margen_ult_pct,
        "markup_sobre_promedio_pct": markup_prom_pct,
        "markup_sobre_ultimo_pct": markup_ult_pct,
        "ganancia_unitaria_promedio": margen_prom_monto,
        "ganancia_unitaria_ultimo": margen_ult_monto,
    }

    kardex_resumen = {
        "total_entradas": total_entradas_kardex,
        "total_salidas": total_salidas_kardex,
        "saldo_neto_periodo": total_entradas_kardex - total_salidas_kardex,
        "movimientos_count": len(movements),
        "total_valorizado_salidas": round(total_salidas_kardex * costo_principal, 0),
        "total_valorizado_entradas": round(total_entradas_kardex * costo_principal, 0),
    }

    return {
        "product": {
            "id": str(product.id),
            "sku": product.sku,
            "nombre": product.nombre,
            "descripcion": getattr(product, "descripcion", None),
            "codigo_barra": product.codigo_barra,
            "plu_balanza": getattr(product, "plu_balanza", None),
            "unidad_medida": product.unidad_medida or "UN",
            "tipo": product.tipo or "producto",
            "tipo_venta": getattr(product, "tipo_venta", "unidad"),
            "categoria_id": str(product.categoria_id) if product.categoria_id else None,
            "categoria_nombre": cat_nombre,
            "precio_venta": precio,
            "precio_regular": precio_regular,
            "costo_promedio": costo_prom,
            "ultimo_costo": costo_ult,
            "costo_landed": costo_landed,
            "metodo_costeo": getattr(product, "metodo_costeo", "PPP") or "PPP",
            "stock_minimo": float(product.stock_minimo or 0),
            "stock_maximo": float(getattr(product, "stock_maximo", 0) or 0),
            "iva_tasa": float(product.iva_tasa or 10),
            "tiene_lotes": bool(getattr(product, "tiene_lotes", False)),
            "tiene_vencimiento": bool(getattr(product, "tiene_vencimiento", False)),
            "peso_kg": float(getattr(product, "peso_kg", None) or 0),
            "imagen_url": getattr(product, "imagen_url", None),
            "activo": bool(product.activo),
            "created_at": product.created_at.isoformat() if product.created_at else None,
        },
        "stock": {
            "total_fisico": total_stock,
            "total_reservado": total_reservado,
            "total_disponible": max(0.0, total_stock - total_reservado),
            "valor_inventario_costo": valor_inventario_costo,
            "valor_inventario_venta": valor_inventario_venta,
            "por_deposito": stocks,
        },
        "rotacion": {
            "ventas_ultimos_30d_unidades": ventas_30d_qty,
            "ventas_ultimos_30d_gs": ventas_30d_monto,
            "demanda_diaria_estimada": demanda_diaria,
            "autonomia_dias": autonomia_dias,
            "estado_stock": "critico" if total_stock <= 0 else ("bajo" if autonomia_dias < 7 else "optimo"),
        },
        "metricas_financieras": {
            "precio_venta": precio,
            "precio_regular": precio_regular,
            "costo_unitario": costo_principal,
            "costo_promedio": costo_prom,
            "ultimo_costo": costo_ult,
            "costo_landed": costo_landed,
            "margen_bruto_monto": margen_prom_monto,
            "margen_bruto_pct": margen_prom_pct,
            "markup_pct": markup_prom_pct,
            "valor_inventario": valor_inventario_costo,
        },
        "costos_estructura": costos_estructura,
        "escalas_precio": escalas_precio,
        "historial_ventas_mensual": historial_ventas,
        "historial_costos_mensual": historial_costos,
        "promociones": promociones,
        "codigos_alternativos": codigos_alternativos,
        "supplier_info": supplier_info,
        "ultimas_compras": purchases,
        "ultimas_ventas": sales,
        "kardex": movements,
        "kardex_reciente": movements,
        "kardex_resumen": kardex_resumen,
    }


# ═══════════════════════════════════════════════════════════════
#  VARIANTES
# ═══════════════════════════════════════════════════════════════

async def list_variants(db: AsyncSession, company_id: str, product_id: str | None = None) -> list[dict]:
    comp_uuid = UUID(company_id) if isinstance(company_id, str) else company_id
    where = "pv.company_id = :comp_id"
    params: dict = {"comp_id": comp_uuid}

    if product_id:
        where += " AND pv.product_id = :prod_id"
        params["prod_id"] = UUID(product_id) if isinstance(product_id, str) else product_id

    query = f"""
        SELECT 
            pv.id, pv.product_id, pv.company_id, pv.tipo, pv.valor,
            pv.sku_variante, pv.codigo_barra, pv.precio_extra, pv.stock,
            pv.orden, pv.activo, pv.created_at, pv.updated_at,
            p.nombre as product_nombre, p.sku as product_sku, p.precio_venta as product_precio_base
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE {where}
        ORDER BY p.nombre ASC, pv.orden ASC, pv.valor ASC
    """
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result]


async def create_variant(db: AsyncSession, company_id: str, product_id: str, data: dict) -> dict:
    from api.src.variants.models import ProductVariant

    comp_uuid = UUID(company_id) if isinstance(company_id, str) else company_id
    prod_uuid = UUID(product_id) if isinstance(product_id, str) else product_id

    variant = ProductVariant(
        company_id=comp_uuid,
        product_id=prod_uuid,
        tipo=data.get("tipo", "talle"),
        valor=data.get("valor", ""),
        sku_variante=data.get("sku_variante") or f"VAR-{uuid.uuid4().hex[:6].upper()}",
        codigo_barra=data.get("codigo_barra"),
        precio_extra=float(data.get("precio_extra", 0)),
        stock=int(data.get("stock", 0)),
        orden=int(data.get("orden", 0)),
        activo=data.get("activo", True),
    )
    db.add(variant)
    await db.flush()
    await db.refresh(variant)
    return {
        "id": str(variant.id),
        "product_id": str(variant.product_id),
        "tipo": variant.tipo,
        "valor": variant.valor,
        "sku_variante": variant.sku_variante,
        "codigo_barra": variant.codigo_barra,
        "precio_extra": float(variant.precio_extra or 0),
        "stock": variant.stock,
        "activo": variant.activo,
    }


async def delete_variant(db: AsyncSession, variant_id: str) -> bool:
    from api.src.variants.models import ProductVariant

    v_uuid = UUID(variant_id) if isinstance(variant_id, str) else variant_id
    variant = await db.get(ProductVariant, v_uuid)
    if not variant:
        return False
    await db.delete(variant)
    await db.flush()
    return True
