import uuid
from datetime import datetime, timezone

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.kiosk.models import KioskBanner
from api.src.kiosk.schemas import KioskBannerCreate, KioskBannerUpdate, PriceScaleTier
from api.src.products.models import Product
from api.src.smart_pricing.models import TieredPrice


async def lookup_product(db: AsyncSession, company_id: str, code: str) -> dict | None:
    """Match exacto por codigo de barra o SKU -- nunca aproximado. Un
    verificador de precios en salon no puede mostrar "el que mas se parece",
    tiene que mostrar el producto correcto o avisar que no lo encontro."""
    cid = uuid.UUID(company_id)
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.categoria))
        .where(
            Product.company_id == cid,
            Product.activo == True,
            or_(Product.codigo_barra == code, Product.sku == code),
        )
        .limit(1)
    )
    product = result.scalar_one_or_none()
    if not product:
        return None

    tiers_result = await db.execute(
        select(TieredPrice)
        .where(TieredPrice.company_id == cid, TieredPrice.product_id == product.id, TieredPrice.activo == True)
        .order_by(TieredPrice.min_qty.asc())
    )
    escalas = [
        PriceScaleTier(min_qty=t.min_qty, max_qty=t.max_qty, precio_unitario=float(t.precio_unitario), moneda=t.moneda or "PYG")
        for t in tiers_result.scalars().all()
    ]

    from api.src.promotions.service import resolve_product_promotions

    base_price = float(product.precio_venta or 0)
    promo_info = await resolve_product_promotions(db, company_id, str(product.id), base_price, 1.0)

    effective_price = promo_info.precio_promocional if promo_info.en_promocion else base_price

    return {
        "id": product.id,
        "nombre": product.nombre,
        "sku": product.sku,
        "codigo_barra": product.codigo_barra,
        "precio_venta": effective_price,
        "imagen_url": product.imagen_url,
        "categoria_nombre": product.categoria.nombre if product.categoria else None,
        "tipo_venta": product.tipo_venta,
        "escalas": escalas,
        "en_promocion": promo_info.en_promocion,
        "precio_regular": promo_info.precio_regular,
        "precio_promocional": promo_info.precio_promocional,
        "ahorro_unitario": promo_info.ahorro_unitario,
        "ahorro_porcentaje": promo_info.ahorro_porcentaje,
        "badge_promo": promo_info.badge,
        "promocion_nombre": promo_info.promocion_nombre,
        "limite_por_compra": promo_info.limite_por_compra,
        "valido_hasta": promo_info.valido_hasta,
        "mensaje_dias": promo_info.mensaje_dias,
        "es_activo_hoy": promo_info.es_activo_hoy,
    }


async def create_banner(db: AsyncSession, company_id: str, data: KioskBannerCreate) -> KioskBanner:
    banner = KioskBanner(company_id=uuid.UUID(company_id), **data.model_dump())
    db.add(banner)
    await db.commit()
    await db.refresh(banner)
    return banner


async def list_banners(db: AsyncSession, company_id: str) -> list[KioskBanner]:
    result = await db.execute(
        select(KioskBanner).where(KioskBanner.company_id == uuid.UUID(company_id)).order_by(KioskBanner.orden, KioskBanner.created_at)
    )
    return list(result.scalars().all())


async def list_active_banners(db: AsyncSession, company_id: str) -> list[KioskBanner]:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(KioskBanner)
        .where(
            KioskBanner.company_id == uuid.UUID(company_id),
            KioskBanner.activo == True,
            or_(KioskBanner.fecha_inicio.is_(None), KioskBanner.fecha_inicio <= now),
            or_(KioskBanner.fecha_fin.is_(None), KioskBanner.fecha_fin >= now),
        )
        .order_by(KioskBanner.orden, KioskBanner.created_at)
    )
    return list(result.scalars().all())


async def get_banner(db: AsyncSession, banner_id: str) -> KioskBanner | None:
    result = await db.execute(select(KioskBanner).where(KioskBanner.id == uuid.UUID(banner_id)))
    return result.scalar_one_or_none()


async def update_banner(db: AsyncSession, banner_id: str, data: KioskBannerUpdate) -> KioskBanner | None:
    banner = await get_banner(db, banner_id)
    if not banner:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(banner, key, value)
    await db.commit()
    await db.refresh(banner)
    return banner


async def set_banner_image(db: AsyncSession, banner_id: str, imagen_url: str) -> KioskBanner | None:
    banner = await get_banner(db, banner_id)
    if not banner:
        return None
    banner.imagen_url = imagen_url
    await db.commit()
    await db.refresh(banner)
    return banner


async def delete_banner(db: AsyncSession, banner_id: str) -> bool:
    banner = await get_banner(db, banner_id)
    if not banner:
        return False
    await db.delete(banner)
    await db.commit()
    return True
