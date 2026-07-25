from decimal import Decimal
from datetime import datetime, timezone
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.returns.models import Return, ReturnItem
from api.src.returns.schemas import ReturnCreate, ReturnApprove
from api.src.inventory.models import Stock, InventoryMovement


RETURN_MOTIVOS = [
    "producto_defectuoso", "producto_equivocado", "vencimiento",
    "dano_transporte", "cliente_insatisfecho", "error_venta",
    "devolucion_voluntaria", "garantia", "otro",
]

RETURN_CONDITIONS = ["buen_estado", "defectuoso", "danado", "vencido", "incompleto"]


async def generate_return_number(db: AsyncSession, company_id: str) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(Return).where(Return.company_id == company_id).order_by(Return.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"DEV-{date_part}-{seq:06d}"


async def create_return(db: AsyncSession, data: ReturnCreate) -> Return:
    numero = await generate_return_number(db, str(data.company_id))

    subtotal = Decimal("0")
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")
    total = Decimal("0")

    return_obj = Return(
        company_id=data.company_id,
        branch_id=data.branch_id,
        sale_id=data.sale_id,
        customer_id=data.customer_id,
        numero=numero,
        tipo=data.tipo,
        motivo=data.motivo,
        motivo_detalle=data.motivo_detalle,
        estado="pendiente",
        moneda=data.moneda,
        tipo_cambio=data.tipo_cambio,
        observaciones=data.observaciones,
        warehouse_id=data.warehouse_id,
        user_id=data.user_id,
    )
    db.add(return_obj)
    await db.flush()

    for item_data in data.items:
        iva_tasa = Decimal(str(item_data.iva_tasa))
        base = Decimal(str(item_data.precio_unitario)) * Decimal(str(item_data.cantidad))
        if iva_tasa == Decimal("0"):
            iva_monto = Decimal("0")
            item_total = base
        else:
            iva_monto = (base * iva_tasa / Decimal("100")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
            item_total = base + iva_monto

        item = ReturnItem(
            return_id=return_obj.id,
            sale_item_id=item_data.sale_item_id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            descripcion=item_data.descripcion,
            cantidad=item_data.cantidad,
            precio_unitario=item_data.precio_unitario,
            iva_tasa=item_data.iva_tasa,
            iva_monto=iva_monto,
            total=item_total,
            motivo_detalle=item_data.motivo_detalle,
            condicion=item_data.condicion,
        )
        db.add(item)

        subtotal += base
        if iva_tasa == Decimal("10"):
            iva_10 += iva_monto
        elif iva_tasa == Decimal("5"):
            iva_5 += iva_monto
        total += item_total

    return_obj.subtotal = subtotal
    return_obj.iva_10 = iva_10
    return_obj.iva_5 = iva_5
    return_obj.total = total

    await db.flush()
    await db.refresh(return_obj)
    return return_obj


async def get_return(db: AsyncSession, return_id: str) -> Return | None:
    result = await db.execute(select(Return).where(Return.id == uuid.UUID(return_id)))
    return result.scalar_one_or_none()


async def get_return_with_items(db: AsyncSession, return_id: str) -> dict | None:
    return_obj = await get_return(db, return_id)
    if not return_obj:
        return None
    items_result = await db.execute(select(ReturnItem).where(ReturnItem.return_id == return_obj.id))
    items = items_result.scalars().all()
    return {**{c.name: getattr(return_obj, c.name) for c in return_obj.__table__.columns}, "items": items}


async def list_returns(
    db: AsyncSession, company_id: str, estado: str | None = None, limit: int = 50, offset: int = 0,
) -> list[Return]:
    query = select(Return).where(Return.company_id == company_id)
    if estado:
        query = query.where(Return.estado == estado)
    query = query.order_by(Return.fecha.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def approve_return(db: AsyncSession, return_id: str, data: ReturnApprove) -> Return | None:
    return_obj = await get_return(db, return_id)
    if not return_obj or return_obj.estado != "pendiente":
        return None

    return_obj.estado = "aprobado"
    return_obj.aprobado_por = data.aprobado_por
    return_obj.fecha_aprobacion = datetime.now(timezone.utc)
    if data.warehouse_id:
        return_obj.warehouse_id = data.warehouse_id

    warehouse_id = str(data.warehouse_id or return_obj.warehouse_id or "")

    items_result = await db.execute(select(ReturnItem).where(ReturnItem.return_id == return_obj.id))
    for item in items_result.scalars().all():
        qty = int(item.cantidad)
        stock_result = await db.execute(
            select(Stock).where(
                Stock.product_id == item.product_id,
                Stock.warehouse_id == warehouse_id,
            ).limit(1)
        )
        stock = stock_result.scalar_one_or_none()
        if stock:
            stock.cantidad += qty
            stock.updated_at = datetime.now(timezone.utc)
        else:
            stock = Stock(
                company_id=return_obj.company_id,
                warehouse_id=warehouse_id,
                product_id=item.product_id,
                cantidad=qty,
            )
            db.add(stock)

        movement = InventoryMovement(
            company_id=return_obj.company_id,
            warehouse_id=warehouse_id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            tipo="entrada_devolucion",
            cantidad=qty,
            referencia_type="return",
            referencia_id=return_obj.id,
            user_id=data.aprobado_por,
        )
        db.add(movement)

    return_obj.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(return_obj)
    return return_obj


async def reject_return(db: AsyncSession, return_id: str, motivo: str) -> Return | None:
    return_obj = await get_return(db, return_id)
    if not return_obj or return_obj.estado != "pendiente":
        return None
    return_obj.estado = "rechazado"
    return_obj.observaciones = (return_obj.observaciones or "") + f"\nRechazo: {motivo}"
    return_obj.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(return_obj)
    return return_obj
