"""Variant service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from api.src.variants.models import ProductVariant
from api.src.variants.schemas import VariantCreate, VariantUpdate


async def create_variant(db: AsyncSession, data: VariantCreate) -> ProductVariant:
    variant = ProductVariant(**data.model_dump())
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return variant


async def list_all_variants(db: AsyncSession, limit: int = 100, offset: int = 0) -> list[ProductVariant]:
    query = select(ProductVariant).where(ProductVariant.activo == True).order_by(ProductVariant.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def list_variants(db: AsyncSession, product_id: str) -> list[ProductVariant]:
    query = select(ProductVariant).where(
        ProductVariant.product_id == uuid.UUID(product_id),
        ProductVariant.activo == True,
    ).order_by(ProductVariant.orden, ProductVariant.valor)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_variant(db: AsyncSession, variant_id: str) -> ProductVariant | None:
    result = await db.execute(select(ProductVariant).where(ProductVariant.id == uuid.UUID(variant_id)))
    return result.scalar_one_or_none()


async def update_variant(db: AsyncSession, variant_id: str, data: VariantUpdate) -> ProductVariant | None:
    variant = await get_variant(db, variant_id)
    if not variant:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(variant, key, value)
    await db.commit()
    await db.refresh(variant)
    return variant


async def delete_variant(db: AsyncSession, variant_id: str) -> bool:
    variant = await get_variant(db, variant_id)
    if not variant:
        return False
    await db.delete(variant)
    await db.commit()
    return True


async def update_variant_stock(db: AsyncSession, variant_id: str, delta: int) -> ProductVariant | None:
    variant = await get_variant(db, variant_id)
    if not variant:
        return None
    variant.stock += delta
    await db.commit()
    await db.refresh(variant)
    return variant
