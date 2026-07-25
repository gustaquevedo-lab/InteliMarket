"""Kit service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from decimal import Decimal
import uuid

from api.src.kits.models import ProductKit, KitItem
from api.src.kits.schemas import KitCreate, KitUpdate
from api.src.products.models import Product


async def create_kit(db: AsyncSession, data: KitCreate) -> ProductKit:
    kit = ProductKit(
        company_id=data.company_id,
        product_id=data.product_id,
        nombre=data.nombre,
        descripcion=data.descripcion,
        precio_venta=data.precio_venta,
    )
    db.add(kit)
    await db.flush()

    for item_data in data.items:
        item = KitItem(
            kit_id=kit.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            cantidad=item_data.cantidad,
        )
        db.add(item)

    await db.commit()
    await db.refresh(kit)
    return kit


async def list_kits(
    db: AsyncSession,
    company_id: str,
    activo: Optional[bool] = None,
) -> list[ProductKit]:
    query = select(ProductKit).where(ProductKit.company_id == company_id)
    if activo is not None:
        query = query.where(ProductKit.activo == activo)
    query = query.order_by(ProductKit.nombre)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_kit(db: AsyncSession, kit_id: str) -> ProductKit | None:
    result = await db.execute(select(ProductKit).where(ProductKit.id == uuid.UUID(kit_id)))
    return result.scalar_one_or_none()


async def update_kit(db: AsyncSession, kit_id: str, data: KitUpdate) -> ProductKit | None:
    kit = await get_kit(db, kit_id)
    if not kit:
        return None

    update_data = data.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in update_data.items():
        setattr(kit, key, value)

    if data.items is not None:
        existing = await db.execute(select(KitItem).where(KitItem.kit_id == kit.id))
        for item in existing.scalars().all():
            await db.delete(item)

        for item_data in data.items:
            item = KitItem(
                kit_id=kit.id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                cantidad=item_data.cantidad,
            )
            db.add(item)

    await db.commit()
    await db.refresh(kit)
    return kit


async def delete_kit(db: AsyncSession, kit_id: str) -> bool:
    kit = await get_kit(db, kit_id)
    if not kit:
        return False
    await db.delete(kit)
    await db.commit()
    return True


async def calculate_kit_price(db: AsyncSession, kit_id: str) -> dict:
    kit = await get_kit(db, kit_id)
    if not kit:
        return {"error": "Kit not found"}

    items_result = await db.execute(select(KitItem).where(KitItem.kit_id == kit.id))
    items = list(items_result.scalars().all())

    total = Decimal("0")
    components = []
    for item in items:
        product_result = await db.execute(select(Product).where(Product.id == item.product_id))
        product = product_result.scalar_one_or_none()
        price = Decimal(str(product.precio)) if product and product.precio else Decimal("0")
        qty = Decimal(str(item.cantidad))
        subtotal = price * qty
        total += subtotal
        components.append({
            "product_id": str(item.product_id),
            "nombre": product.nombre if product else "Desconocido",
            "cantidad": int(item.cantidad),
            "precio_unitario": int(price),
            "subtotal": int(subtotal),
        })

    return {
        "kit_id": str(kit.id),
        "nombre": kit.nombre,
        "precio_venta": int(kit.precio_venta) if kit.precio_venta else None,
        "precio_calculado": int(total),
        "diferencia": int((kit.precio_venta or total) - total),
        "items": components,
    }
