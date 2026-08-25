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


async def list_all_company_variants(db: AsyncSession, company_id: str, product_id: str | None = None) -> list[dict]:
    from sqlalchemy import text
    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    where = "pv.company_id = :comp_id AND pv.activo = true"
    params = {"comp_id": comp_uuid}

    if product_id:
        where += " AND pv.product_id = :prod_id"
        params["prod_id"] = uuid.UUID(product_id) if isinstance(product_id, str) else product_id

    query = f"""
        SELECT pv.id, pv.product_id, pv.company_id, pv.tipo, pv.valor,
               pv.sku_variante, pv.codigo_barra, pv.precio_extra, pv.stock,
               pv.orden, pv.activo, pv.created_at, pv.updated_at,
               p.nombre as product_nombre, p.sku as product_sku, p.precio_venta as product_precio_base
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE {where}
        ORDER BY p.nombre ASC, pv.orden ASC, pv.valor ASC
    """
    res = await db.execute(text(query), params)
    return [dict(r._mapping) for r in res]

