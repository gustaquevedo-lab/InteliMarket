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
) -> list[dict]:
    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    query = select(ProductKit).where(ProductKit.company_id == comp_uuid)
    if activo is not None:
        query = query.where(ProductKit.activo == activo)
    query = query.order_by(ProductKit.nombre)
    result = await db.execute(query)
    kits = list(result.scalars().all())

    kits_data = []
    for kit in kits:
        items_result = await db.execute(select(KitItem).where(KitItem.kit_id == kit.id))
        items = list(items_result.scalars().all())

        total_costo = Decimal("0")
        total_precio_individual = Decimal("0")
        components = []
        for item in items:
            p = await db.get(Product, item.product_id)
            p_costo = Decimal(str(p.costo_promedio or p.ultimo_costo or 0)) if p else Decimal("0")
            p_precio = Decimal(str(p.precio_venta or 0)) if p else Decimal("0")
            qty = Decimal(str(item.cantidad))
            total_costo += p_costo * qty
            total_precio_individual += p_precio * qty
            components.append({
                "product_id": str(item.product_id),
                "nombre": p.nombre if p else "Producto",
                "sku": p.sku if p else "—",
                "cantidad": float(item.cantidad),
                "costo_unitario": float(p_costo),
                "precio_unitario": float(p_precio),
                "subtotal_costo": float(p_costo * qty),
                "subtotal_precio": float(p_precio * qty),
            })

        precio_kit = Decimal(str(kit.precio_venta or total_precio_individual))
        margen_monto = precio_kit - total_costo
        margen_pct = float(round((margen_monto / precio_kit * 100), 1)) if precio_kit > 0 else 0.0

        kits_data.append({
            "id": str(kit.id),
            "company_id": str(kit.company_id),
            "product_id": str(kit.product_id),
            "nombre": kit.nombre,
            "descripcion": kit.descripcion,
            "precio_venta": float(precio_kit),
            "costo_total": float(total_costo),
            "precio_individual_total": float(total_precio_individual),
            "margen_monto": float(margen_monto),
            "margen_pct": margen_pct,
            "ahorro_cliente_monto": float(max(Decimal("0"), total_precio_individual - precio_kit)),
            "activo": kit.activo,
            "items": components,
        })

    return kits_data


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
    total_costo = Decimal("0")
    components = []
    for item in items:
        product = await db.get(Product, item.product_id)
        price = Decimal(str(product.precio_venta or 0)) if product else Decimal("0")
        costo = Decimal(str(product.costo_promedio or product.ultimo_costo or 0)) if product else Decimal("0")
        qty = Decimal(str(item.cantidad))
        subtotal = price * qty
        subtotal_costo = costo * qty
        total += subtotal
        total_costo += subtotal_costo
        components.append({
            "product_id": str(item.product_id),
            "nombre": product.nombre if product else "Desconocido",
            "cantidad": float(item.cantidad),
            "precio_unitario": float(price),
            "costo_unitario": float(costo),
            "subtotal": float(subtotal),
        })

    precio_venta = Decimal(str(kit.precio_venta or total))
    margen_monto = precio_venta - total_costo
    margen_pct = float(round((margen_monto / precio_venta * 100), 1)) if precio_venta > 0 else 0.0

    return {
        "kit_id": str(kit.id),
        "nombre": kit.nombre,
        "precio_venta": float(precio_venta),
        "precio_calculado": float(total),
        "costo_total": float(total_costo),
        "margen_monto": float(margen_monto),
        "margen_pct": margen_pct,
        "diferencia": float(precio_venta - total),
        "items": components,
    }
