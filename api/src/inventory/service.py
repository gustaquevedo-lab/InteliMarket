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


async def get_stock_by_warehouse(db: AsyncSession, warehouse_id: str) -> list[Stock]:
    result = await db.execute(select(Stock).where(Stock.warehouse_id == warehouse_id))
    return list(result.scalars().all())


async def get_low_stock(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        select(Stock, "p.nombre", "p.stock_minimo", "p.sku")
        .select_from(Stock)
        .join("products p", "Stock.product_id = p.id")
        .where(
            Stock.cantidad <= "p.stock_minimo",
            "p.company_id = :company_id",
        )
        .params(company_id=company_id)
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
) -> list[InventoryMovement]:
    query = select(InventoryMovement).where(InventoryMovement.company_id == company_id)
    if product_id:
        query = query.where(InventoryMovement.product_id == product_id)
    if warehouse_id:
        query = query.where(InventoryMovement.warehouse_id == warehouse_id)
    if tipo:
        query = query.where(InventoryMovement.tipo == tipo)
    query = query.order_by(InventoryMovement.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())
