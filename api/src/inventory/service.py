"""Inventory service with costing logic"""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
import uuid

from api.src.inventory.models import (
    Warehouse, Stock, InventoryMovement,
    StockTransfer, StockTransferItem,
    InventoryAdjustment, InventoryAdjustmentItem,
)
from api.src.inventory.schemas import (
    WarehouseCreate, MovementCreate, TransferCreate, AdjustmentCreate,
)
from api.src.products.models import Product


async def create_warehouse(db: AsyncSession, data: WarehouseCreate) -> Warehouse:
    warehouse = Warehouse(**data.model_dump())
    db.add(warehouse)
    await db.flush()
    await db.refresh(warehouse)
    return warehouse


async def list_warehouses(db: AsyncSession, company_id: str) -> list[Warehouse]:
    result = await db.execute(
        select(Warehouse).where(Warehouse.company_id == company_id, Warehouse.activo == True)
    )
    return list(result.scalars().all())


async def get_stock(db: AsyncSession, warehouse_id: str, product_id: str) -> Stock | None:
    result = await db.execute(
        select(Stock).where(Stock.warehouse_id == warehouse_id, Stock.product_id == product_id)
    )
    return result.scalar_one_or_none()


async def get_stock_by_warehouse(db: AsyncSession, warehouse_id: str) -> list[dict]:
    # El frontend siempre esperó s.product?.nombre / s.product?.sku (y
    # s.warehouse?.nombre), pero este endpoint nunca devolvió esa relación
    # -- StockResponse solo tenía product_id crudo. Resultado: en Inventario
    # nunca se veían nombres de producto, solo el ID, en toda la pantalla.
    result = await db.execute(
        select(Stock, Product, Warehouse)
        .join(Product, Stock.product_id == Product.id)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
        .where(Stock.warehouse_id == warehouse_id)
    )
    rows = result.all()
    return [
        {
            "id": s.id,
            "warehouse_id": s.warehouse_id,
            "product_id": s.product_id,
            "variant_id": s.variant_id,
            "cantidad": s.cantidad,
            "cantidad_reservada": s.cantidad_reservada,
            "costo_unitario": s.costo_unitario,
            "updated_at": s.updated_at,
            "nombre": p.nombre,
            "sku": p.sku,
            "costo_promedio": p.costo_promedio,
            "product": {
                "id": p.id, "sku": p.sku, "nombre": p.nombre, "categoria_id": p.categoria_id,
                "codigo_barra": p.codigo_barra, "unidad_medida": p.unidad_medida,
                "precio_venta": p.precio_venta, "costo_promedio": p.costo_promedio,
                "activo": p.activo, "created_at": p.created_at, "updated_at": p.updated_at,
            },
            "warehouse": {"id": w.id, "nombre": w.nombre, "codigo": w.codigo, "company_id": w.company_id, "activo": w.activo},
        }
        for s, p, w in rows
    ]


async def get_stock_by_product(db: AsyncSession, company_id: str, product_id: str) -> dict:
    """Stock real (no stock_minimo) de un producto, sumado en todos los
    depositos de la empresa -- usado por Consulta de Precios en el POS,
    que antes no mostraba stock en absoluto."""
    result = await db.execute(
        select(Stock.cantidad, Stock.cantidad_reservada, Warehouse.nombre)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
        .where(Stock.product_id == product_id, Warehouse.company_id == company_id)
    )
    rows = result.all()
    total = sum(r[0] for r in rows)
    reservado = sum(r[1] for r in rows)
    return {
        "product_id": product_id,
        "cantidad_total": total,
        "cantidad_reservada": reservado,
        "cantidad_disponible": total - reservado,
        "por_deposito": [{"nombre": r[2], "cantidad": r[0]} for r in rows],
    }


async def get_stock_map(db: AsyncSession, company_id: str) -> dict:
    """Mapa liviano product_id -> cantidad disponible, sumado en todos los
    depositos de la empresa. Usado por la grilla del POS -- antes esa
    pantalla mostraba stock_minimo (el umbral de reposicion) etiquetado
    como si fuera el stock real, con un fallback fijo de 36 si faltaba."""
    result = await db.execute(
        select(Stock.product_id, Stock.cantidad, Stock.cantidad_reservada)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
        .where(Warehouse.company_id == company_id)
    )
    totals: dict[str, int] = {}
    for product_id, cantidad, reservada in result.all():
        totals[str(product_id)] = totals.get(str(product_id), 0) + (cantidad - reservada)
    return totals


async def get_low_stock(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        select(Stock, Product.nombre, Product.stock_minimo, Product.sku)
        .join(Product, Stock.product_id == Product.id)
        .where(
            Stock.cantidad <= Product.stock_minimo,
            Product.company_id == company_id,
        )
    )
    rows = result.fetchall()
    return [
        {
            "product_id": str(row[0].product_id),
            "warehouse_id": str(row[0].warehouse_id),
            "nombre": row[1],
            "sku": row[3],
            "cantidad_actual": row[0].cantidad,
            "stock_minimo": row[2],
        }
        for row in rows
    ]


async def record_movement(db: AsyncSession, data: MovementCreate) -> InventoryMovement:
    movement = InventoryMovement(**data.model_dump())
    db.add(movement)

    stock = await get_stock(db, str(data.warehouse_id), str(data.product_id))
    if not stock:
        stock = Stock(
            warehouse_id=data.warehouse_id,
            product_id=data.product_id,
            variant_id=data.variant_id,
            cantidad=0,
            costo_unitario=data.costo_unitario,
        )
        db.add(stock)
        await db.flush()

    new_qty = stock.cantidad + data.cantidad
    stock.cantidad = new_qty

    if data.cantidad > 0 and data.costo_unitario:
        old_cost = stock.costo_unitario or 0
        old_qty = stock.cantidad - data.cantidad
        if old_qty + data.cantidad > 0:
            stock.costo_unitario = (old_cost * old_qty + data.costo_unitario * data.cantidad) / (old_qty + data.cantidad)

    stock.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(movement)
    return movement


async def create_transfer(db: AsyncSession, data: TransferCreate, user_id: uuid.UUID | None = None) -> StockTransfer:
    transfer_code = f"TRF-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    transfer = StockTransfer(
        company_id=data.company_id,
        codigo=transfer_code,
        warehouse_origen_id=data.warehouse_origen_id,
        warehouse_destino_id=data.warehouse_destino_id,
        observaciones=data.observaciones,
        user_id_envio=user_id,
    )
    db.add(transfer)
    await db.flush()

    for item_data in data.items:
        item = StockTransferItem(
            transfer_id=transfer.id,
            product_id=uuid.UUID(item_data["product_id"]) if isinstance(item_data["product_id"], str) else item_data["product_id"],
            variant_id=uuid.UUID(item_data["variant_id"]) if item_data.get("variant_id") and isinstance(item_data["variant_id"], str) else item_data.get("variant_id"),
            cantidad_enviada=item_data["cantidad"],
        )
        db.add(item)

    await db.flush()
    await db.refresh(transfer)
    return transfer


async def complete_transfer(db: AsyncSession, transfer_id: str, user_id: uuid.UUID | None = None) -> StockTransfer | None:
    transfer = await db.execute(select(StockTransfer).where(StockTransfer.id == uuid.UUID(transfer_id)))
    transfer_obj = transfer.scalar_one_or_none()
    if not transfer_obj or transfer_obj.estado != "pendiente":
        return None

    items_result = await db.execute(select(StockTransferItem).where(StockTransferItem.transfer_id == transfer_obj.id))
    items = items_result.scalars().all()

    for item in items:
        src_stock = await get_stock(db, str(transfer_obj.warehouse_origen_id), str(item.product_id))
        if src_stock:
            src_stock.cantidad -= item.cantidad_enviada

        dest_stock = await get_stock(db, str(transfer_obj.warehouse_destino_id), str(item.product_id))
        if not dest_stock:
            dest_stock = Stock(
                warehouse_id=transfer_obj.warehouse_destino_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                cantidad=0,
                costo_unitario=src_stock.costo_unitario if src_stock else None,
            )
            db.add(dest_stock)
            await db.flush()
        dest_stock.cantidad += item.cantidad_enviada
        item.cantidad_recibida = item.cantidad_enviada

    transfer_obj.estado = "completada"
    transfer_obj.fecha_recepcion = datetime.now(timezone.utc)
    transfer_obj.user_id_recepcion = user_id

    await db.flush()
    await db.refresh(transfer_obj)
    return transfer_obj


async def create_adjustment(db: AsyncSession, data: AdjustmentCreate, user_id: uuid.UUID | None = None) -> InventoryAdjustment:
    adj_code = f"ADJ-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    adjustment = InventoryAdjustment(
        company_id=data.company_id,
        warehouse_id=data.warehouse_id,
        codigo=adj_code,
        motivo=data.motivo,
        observaciones=data.observaciones,
        user_id=user_id,
    )
    db.add(adjustment)
    await db.flush()

    for item_data in data.items:
        diff = item_data["cantidad_fisica"] - item_data["cantidad_sistema"]
        item = InventoryAdjustmentItem(
            adjustment_id=adjustment.id,
            product_id=uuid.UUID(item_data["product_id"]) if isinstance(item_data["product_id"], str) else item_data["product_id"],
            variant_id=uuid.UUID(item_data["variant_id"]) if item_data.get("variant_id") and isinstance(item_data["variant_id"], str) else item_data.get("variant_id"),
            cantidad_sistema=item_data["cantidad_sistema"],
            cantidad_fisica=item_data["cantidad_fisica"],
            diferencia=diff,
            costo_unitario=item_data.get("costo_unitario"),
        )
        db.add(item)

    await db.flush()
    await db.refresh(adjustment)
    return adjustment


async def approve_adjustment(db: AsyncSession, adjustment_id: str, user_id: uuid.UUID | None = None) -> InventoryAdjustment | None:
    result = await db.execute(select(InventoryAdjustment).where(InventoryAdjustment.id == uuid.UUID(adjustment_id)))
    adjustment = result.scalar_one_or_none()
    if not adjustment or adjustment.estado != "pendiente":
        return None

    items_result = await db.execute(select(InventoryAdjustmentItem).where(InventoryAdjustmentItem.adjustment_id == adjustment.id))
    items = items_result.scalars().all()

    for item in items:
        if item.diferencia != 0:
            movement = InventoryMovement(
                company_id=adjustment.company_id,
                warehouse_id=adjustment.warehouse_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                tipo="ajuste",
                cantidad=item.diferencia,
                costo_unitario=item.costo_unitario,
                referencia_type="adjustment",
                referencia_id=adjustment.id,
                motivo=f"Ajuste {adjustment.codigo}: {adjustment.motivo}",
                user_id=user_id,
            )
            db.add(movement)

            stock = await get_stock(db, str(adjustment.warehouse_id), str(item.product_id))
            if stock:
                stock.cantidad = item.cantidad_fisica
                stock.updated_at = datetime.now(timezone.utc)

    adjustment.estado = "aprobado"
    adjustment.aprobado_por = user_id
    adjustment.fecha_aprobacion = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(adjustment)
    return adjustment


async def list_movements(
    db: AsyncSession,
    company_id: str,
    product_id: str | None = None,
    warehouse_id: str | None = None,
    tipo: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    from sqlalchemy import text
    import uuid

    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    where = "im.company_id = :comp_id"
    params: dict = {"comp_id": comp_uuid, "limit": limit, "offset": offset}

    if product_id:
        where += " AND im.product_id = :prod_id"
        params["prod_id"] = uuid.UUID(product_id) if isinstance(product_id, str) else product_id
    if warehouse_id:
        where += " AND im.warehouse_id = :wh_id"
        params["wh_id"] = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id
    if tipo:
        where += " AND im.tipo = :tipo"
        params["tipo"] = tipo

    query = f"""
        SELECT 
            im.id, im.company_id, im.warehouse_id, im.product_id, im.variant_id,
            im.tipo, im.cantidad, im.costo_unitario, im.referencia_type, im.referencia_id,
            im.motivo, im.user_id, im.created_at,
            p.nombre as product_nombre, p.sku as product_sku,
            w.nombre as warehouse_nombre, w.codigo as warehouse_codigo
        FROM inventory_movements im
        LEFT JOIN products p ON p.id = im.product_id
        LEFT JOIN warehouses w ON w.id = im.warehouse_id
        WHERE {where}
        ORDER BY im.created_at DESC
        LIMIT :limit OFFSET :offset
    """
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result]


async def list_adjustments(
    db: AsyncSession,
    company_id: str,
    warehouse_id: str | None = None,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    import uuid
    from sqlalchemy import text
    
    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    where = "a.company_id = :comp_id"
    params: dict = {"comp_id": comp_uuid, "limit": limit, "offset": offset}
    
    if warehouse_id:
        where += " AND a.warehouse_id = :wh_id"
        params["wh_id"] = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id
    if estado:
        where += " AND a.estado = :estado"
        params["estado"] = estado
        
    query = f"""
        SELECT 
            a.id, a.codigo, a.motivo, a.estado, a.observaciones, a.created_at, a.fecha_aprobacion,
            w.nombre as warehouse_nombre, w.codigo as warehouse_codigo,
            COUNT(ai.id) as total_items,
            COALESCE(SUM(ai.diferencia), 0) as diferencia_unidades,
            COALESCE(SUM(ai.diferencia * COALESCE(ai.costo_unitario, p.costo_promedio, 0)), 0) as diferencia_valorizada_gs
        FROM inventory_adjustments a
        LEFT JOIN warehouses w ON w.id = a.warehouse_id
        LEFT JOIN inventory_adjustment_items ai ON ai.adjustment_id = a.id
        LEFT JOIN products p ON p.id = ai.product_id
        WHERE {where}
        GROUP BY a.id, a.codigo, a.motivo, a.estado, a.observaciones, a.created_at, a.fecha_aprobacion, w.nombre, w.codigo
        ORDER BY a.created_at DESC
        LIMIT :limit OFFSET :offset
    """
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result]


async def record_quick_merma(
    db: AsyncSession,
    company_id: str,
    warehouse_id: str,
    product_id: str,
    cantidad: float,
    motivo: str,
    observaciones: str = "",
    user_id: uuid.UUID | None = None,
) -> dict:
    import uuid
    from datetime import datetime, timezone
    
    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    wh_uuid = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id
    prod_uuid = uuid.UUID(product_id) if isinstance(product_id, str) else product_id
    
    product = await db.get(Product, prod_uuid)
    if not product:
        raise ValueError("Producto no encontrado")
        
    costo = float(product.costo_promedio or product.ultimo_costo or 0)
    
    # 1. Crear ajuste tipo merma
    adj_code = f"MRM-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    adjustment = InventoryAdjustment(
        company_id=comp_uuid,
        warehouse_id=wh_uuid,
        codigo=adj_code,
        motivo=f"Merma: {motivo}",
        estado="aprobado",
        observaciones=observaciones,
        user_id=user_id,
        aprobado_por=user_id,
        fecha_aprobacion=datetime.now(timezone.utc),
    )
    db.add(adjustment)
    await db.flush()
    
    # 2. Obtener stock actual
    stock = await get_stock(db, warehouse_id, product_id)
    stock_actual = stock.cantidad if stock else 0
    nuevo_stock = max(0, stock_actual - int(cantidad))
    
    # 3. Item de ajuste
    adj_item = InventoryAdjustmentItem(
        adjustment_id=adjustment.id,
        product_id=prod_uuid,
        cantidad_sistema=stock_actual,
        cantidad_fisica=nuevo_stock,
        diferencia=-int(cantidad),
        costo_unitario=costo,
    )
    db.add(adj_item)
    
    # 4. Movimiento Kardex
    movement = InventoryMovement(
        company_id=comp_uuid,
        warehouse_id=wh_uuid,
        product_id=prod_uuid,
        tipo="merma",
        cantidad=-int(cantidad),
        costo_unitario=costo,
        referencia_type="adjustment",
        referencia_id=adjustment.id,
        motivo=f"Merma ({motivo}): {observaciones}",
        user_id=user_id,
    )
    db.add(movement)
    
    # 5. Actualizar stock
    if stock:
        stock.cantidad = nuevo_stock
        stock.updated_at = datetime.now(timezone.utc)
    else:
        stock = Stock(
            warehouse_id=wh_uuid,
            product_id=prod_uuid,
            cantidad=nuevo_stock,
            costo_unitario=costo,
        )
        db.add(stock)
        
    await db.flush()
    return {
        "id": str(adjustment.id),
        "codigo": adjustment.codigo,
        "product_nombre": product.nombre,
        "cantidad_merma": cantidad,
        "costo_unitario": costo,
        "impacto_financiero_gs": cantidad * costo,
        "stock_restante": nuevo_stock,
    }


async def get_inventory_stats(db: AsyncSession, company_id: str) -> dict:
    from sqlalchemy import text
    import uuid
    
    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    
    row = await db.execute(
        text("""
            WITH inv_agg AS (
                SELECT 
                    COUNT(DISTINCT s.product_id) as total_skus_almacenados,
                    COALESCE(SUM(s.cantidad), 0) as total_unidades_fisicas,
                    COALESCE(SUM(s.cantidad_reservada), 0) as total_unidades_reservadas,
                    COALESCE(SUM(s.cantidad * COALESCE(s.costo_unitario, p.costo_promedio, p.ultimo_costo, 0)), 0) as valor_total_costo,
                    COALESCE(SUM(s.cantidad * COALESCE(p.precio_venta, 0)), 0) as valor_total_venta_proyectada,
                    COUNT(s.product_id) FILTER (WHERE s.cantidad <= 0) as total_quiebres,
                    COUNT(s.product_id) FILTER (WHERE s.cantidad > 0 AND s.cantidad <= COALESCE(p.stock_minimo, 5)) as total_bajos
                FROM stock s
                JOIN products p ON p.id = s.product_id
                WHERE p.company_id = :comp_id AND p.activo = true
            ),
            mermas_agg AS (
                SELECT 
                    COALESCE(COUNT(im.id), 0) as cant_mermas_mes,
                    COALESCE(SUM(ABS(im.cantidad) * COALESCE(im.costo_unitario, 0)), 0) as monto_mermas_mes_gs
                FROM inventory_movements im
                WHERE im.company_id = :comp_id 
                  AND im.tipo = 'merma'
                  AND im.created_at >= NOW() - INTERVAL '30 days'
            )
            SELECT * FROM inv_agg, mermas_agg;
        """),
        {"comp_id": comp_uuid}
    )
    res = row.first()
    return {
        "total_skus_almacenados": int(res.total_skus_almacenados or 0) if res else 0,
        "total_unidades_fisicas": float(res.total_unidades_fisicas or 0) if res else 0,
        "total_unidades_reservadas": float(res.total_unidades_reservadas or 0) if res else 0,
        "valor_total_costo": float(res.valor_total_costo or 0) if res else 0.0,
        "valor_total_venta_proyectada": float(res.valor_total_venta_proyectada or 0) if res else 0.0,
        "total_quiebres": int(res.total_quiebres or 0) if res else 0,
        "total_bajos": int(res.total_bajos or 0) if res else 0,
        "cant_mermas_mes": int(res.cant_mermas_mes or 0) if res else 0,
        "monto_mermas_mes_gs": float(res.monto_mermas_mes_gs or 0) if res else 0.0,
    }


async def get_lots_expiries(
    db: AsyncSession,
    company_id: str,
    warehouse_id: str | None = None,
    estado: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    from sqlalchemy import text
    from datetime import datetime, timezone, timedelta
    import uuid

    comp_id = uuid.UUID(company_id) if isinstance(company_id, str) else company_id

    # 1. Query KPIs for lots
    kpis_q = await db.execute(text("""
        SELECT 
            COUNT(*) as total_lotes,
            COALESCE(SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW() AND cantidad_disponible > 0 THEN 1 ELSE 0 END), 0) as vencidos,
            COALESCE(SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento >= NOW() AND fecha_vencimiento <= NOW() + INTERVAL '7 days' AND cantidad_disponible > 0 THEN 1 ELSE 0 END), 0) as critico_7d,
            COALESCE(SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento > NOW() + INTERVAL '7 days' AND fecha_vencimiento <= NOW() + INTERVAL '30 days' AND cantidad_disponible > 0 THEN 1 ELSE 0 END), 0) as alerta_30d,
            COALESCE(SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento <= NOW() + INTERVAL '30 days' AND cantidad_disponible > 0 THEN costo_unitario * cantidad_disponible ELSE 0 END), 0) as valor_en_riesgo,
            COALESCE(SUM(CASE WHEN cantidad_disponible > 0 THEN costo_unitario * cantidad_disponible ELSE 0 END), 0) as valor_total_stock
        FROM stock_lots
        WHERE company_id = :comp_id AND cantidad_disponible > 0
    """), {"comp_id": comp_id})
    k_row = kpis_q.fetchone()

    # 2. Query individual lots
    query_str = """
        SELECT 
            sl.id,
            sl.referencia,
            sl.warehouse_id,
            sl.product_id,
            COALESCE(p.nombre, 'Producto ' || SUBSTRING(sl.product_id::text, 1, 8)) as product_nombre,
            COALESCE(p.codigo_barra, p.sku, '') as product_codigo,
            COALESCE(cat.nombre, 'General') as categoria,
            sl.cantidad as cantidad_inicial,
            sl.cantidad_disponible,
            sl.costo_unitario,
            (sl.costo_unitario * sl.cantidad_disponible) as costo_total_disponible,
            sl.fecha_ingreso,
            sl.fecha_vencimiento,
            CASE 
                WHEN sl.fecha_vencimiento IS NULL THEN 9999
                ELSE EXTRACT(DAY FROM sl.fecha_vencimiento - NOW())::int
            END as dias_restantes,
            CASE 
                WHEN sl.fecha_vencimiento IS NULL THEN 'sin_vencimiento'
                WHEN sl.fecha_vencimiento < NOW() THEN 'vencido'
                WHEN sl.fecha_vencimiento <= NOW() + INTERVAL '7 days' THEN 'critico_7d'
                WHEN sl.fecha_vencimiento <= NOW() + INTERVAL '30 days' THEN 'alerta_30d'
                ELSE 'vigente'
            END as estado_vencimiento
        FROM stock_lots sl
        LEFT JOIN products p ON sl.product_id = p.id
        LEFT JOIN product_categories cat ON p.categoria_id = cat.id
        WHERE sl.company_id = :comp_id AND sl.cantidad_disponible > 0
    """
    params: dict = {"comp_id": comp_id, "limit": limit, "offset": offset}
    if warehouse_id:
        query_str += " AND sl.warehouse_id = :wh_id"
        params["wh_id"] = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id

    if estado == "vencido":
        query_str += " AND sl.fecha_vencimiento IS NOT NULL AND sl.fecha_vencimiento < NOW()"
    elif estado == "critico_7d":
        query_str += " AND sl.fecha_vencimiento IS NOT NULL AND sl.fecha_vencimiento >= NOW() AND sl.fecha_vencimiento <= NOW() + INTERVAL '7 days'"
    elif estado == "alerta_30d":
        query_str += " AND sl.fecha_vencimiento IS NOT NULL AND sl.fecha_vencimiento > NOW() + INTERVAL '7 days' AND sl.fecha_vencimiento <= NOW() + INTERVAL '30 days'"
    elif estado == "vigente":
        query_str += " AND (sl.fecha_vencimiento IS NULL OR sl.fecha_vencimiento > NOW() + INTERVAL '30 days')"

    query_str += """
        ORDER BY 
            CASE 
                WHEN sl.fecha_vencimiento IS NULL THEN 2 
                ELSE 1 
            END,
            sl.fecha_vencimiento ASC
        LIMIT :limit OFFSET :offset
    """

    res = await db.execute(text(query_str), params)
    lots = []
    for r in res.fetchall():
        lots.append({
            "id": str(r.id),
            "referencia": r.referencia or "LOTE-STD",
            "warehouse_id": str(r.warehouse_id),
            "product_id": str(r.product_id),
            "product_nombre": r.product_nombre,
            "product_codigo": r.product_codigo,
            "categoria": r.categoria.strip() if r.categoria else "General",
            "cantidad_inicial": int(r.cantidad_inicial or 0),
            "cantidad_disponible": int(r.cantidad_disponible or 0),
            "costo_unitario": float(r.costo_unitario or 0),
            "costo_total_disponible": float(r.costo_total_disponible or 0),
            "fecha_ingreso": r.fecha_ingreso.isoformat() if r.fecha_ingreso else None,
            "fecha_vencimiento": r.fecha_vencimiento.isoformat() if r.fecha_vencimiento else None,
            "dias_restantes": int(r.dias_restantes),
            "estado_vencimiento": r.estado_vencimiento,
        })

    return {
        "kpis": {
            "total_lotes": int(k_row.total_lotes or 0) if k_row else 0,
            "vencidos": int(k_row.vencidos or 0) if k_row else 0,
            "critico_7d": int(k_row.critico_7d or 0) if k_row else 0,
            "alerta_30d": int(k_row.alerta_30d or 0) if k_row else 0,
            "valor_en_riesgo": float(k_row.valor_en_riesgo or 0) if k_row else 0.0,
            "valor_total_stock": float(k_row.valor_total_stock or 0) if k_row else 0.0,
        },
        "lots": lots,
    }
