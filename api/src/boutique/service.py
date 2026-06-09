"""Business logic for Boutique module.

CRUD operations, variant matrix management, AI markdown, clienteling,
loyalty engine, cross-selling, and dashboard KPIs.
"""
import math
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, Depends
from sqlalchemy import select, func as sa_func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from api.src.boutique.models import (
    BoutiqueCollection, BoutiqueCollectionItem,
    BoutiqueSize, BoutiqueColor, BoutiqueCategory,
    BoutiqueProduct, BoutiqueProductVariant,
    BoutiqueVariantStockMovement,
    BoutiqueSale, BoutiqueSaleItem,
    BoutiqueReturn, BoutiqueReturnItem,
    BoutiqueClientProfile, BoutiqueClientInteraction, BoutiqueClientDocument,
    BoutiqueLoyaltyConfig, BoutiqueLoyaltyTier, BoutiqueLoyaltyAccount,
    BoutiqueMarkdownRule, BoutiqueMarkdownItem,
    BoutiqueProductARMetadata, BoutiqueGiftWrappingOption,
    BoutiqueClientMeasurement, BoutiqueEvent, BoutiqueEventGuest,
)
from api.src.boutique.schemas import (
    SizeCreate, SizeUpdate,
    ColorCreate, ColorUpdate,
    CategoryCreate, CategoryUpdate,
    CollectionCreate, CollectionUpdate, CollectionItemBase,
    ProductCreate, ProductUpdate, VariantBase,
    SaleCreate, ReturnCreate,
    ClientProfileBase, InteractionCreate,
    MarkdownRuleCreate,
)
from api.src.db import get_db


# ============================================================
# SIZES
# ============================================================
async def list_sizes(db: AsyncSession, company_id: UUID, categoria: str = None, activo: bool = None):
    q = select(BoutiqueSize).where(BoutiqueSize.company_id == company_id)
    if categoria:
        q = q.where(BoutiqueSize.categoria == categoria)
    if activo is not None:
        q = q.where(BoutiqueSize.activo == activo)
    q = q.order_by(BoutiqueSize.orden)
    r = await db.execute(q)
    return r.scalars().all()

async def get_size(db: AsyncSession, size_id: UUID, company_id: UUID):
    r = await db.execute(select(BoutiqueSize).where(BoutiqueSize.id == size_id, BoutiqueSize.company_id == company_id))
    return r.scalar_one_or_none()

async def create_size(db: AsyncSession, data: SizeCreate, company_id: UUID):
    obj = BoutiqueSize(**data.model_dump(), company_id=company_id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

async def update_size(db: AsyncSession, size_id: UUID, data: SizeUpdate, company_id: UUID):
    obj = await get_size(db, size_id, company_id)
    if not obj:
        raise HTTPException(404, "Size not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj

async def delete_size(db: AsyncSession, size_id: UUID, company_id: UUID):
    obj = await get_size(db, size_id, company_id)
    if not obj:
        raise HTTPException(404, "Size not found")
    await db.delete(obj)
    await db.commit()
    return {"ok": True}


# ============================================================
# COLORS
# ============================================================
async def list_colors(db: AsyncSession, company_id: UUID, familia: str = None, activo: bool = None):
    q = select(BoutiqueColor).where(BoutiqueColor.company_id == company_id)
    if familia:
        q = q.where(BoutiqueColor.familia == familia)
    if activo is not None:
        q = q.where(BoutiqueColor.activo == activo)
    q = q.order_by(BoutiqueColor.orden)
    r = await db.execute(q)
    return r.scalars().all()

async def get_color(db: AsyncSession, color_id: UUID, company_id: UUID):
    r = await db.execute(select(BoutiqueColor).where(BoutiqueColor.id == color_id, BoutiqueColor.company_id == company_id))
    return r.scalar_one_or_none()

async def create_color(db: AsyncSession, data: ColorCreate, company_id: UUID):
    obj = BoutiqueColor(**data.model_dump(), company_id=company_id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

async def update_color(db: AsyncSession, color_id: UUID, data: ColorUpdate, company_id: UUID):
    obj = await get_color(db, color_id, company_id)
    if not obj:
        raise HTTPException(404, "Color not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj

async def delete_color(db: AsyncSession, color_id: UUID, company_id: UUID):
    obj = await get_color(db, color_id, company_id)
    if not obj:
        raise HTTPException(404, "Color not found")
    await db.delete(obj)
    await db.commit()
    return {"ok": True}


# ============================================================
# CATEGORIES
# ============================================================
async def list_categories(db: AsyncSession, company_id: UUID, activo: bool = None):
    q = select(BoutiqueCategory).where(BoutiqueCategory.company_id == company_id)
    if activo is not None:
        q = q.where(BoutiqueCategory.activo == activo)
    q = q.order_by(BoutiqueCategory.nivel, BoutiqueCategory.orden)
    r = await db.execute(q.options(joinedload(BoutiqueCategory.children)))
    return r.unique().scalars().all()

async def get_category(db: AsyncSession, cat_id: UUID, company_id: UUID):
    r = await db.execute(
        select(BoutiqueCategory).where(
            BoutiqueCategory.id == cat_id, BoutiqueCategory.company_id == company_id
        ).options(joinedload(BoutiqueCategory.children))
    )
    return r.unique().scalar_one_or_none()

async def create_category(db: AsyncSession, data: CategoryCreate, company_id: UUID):
    nivel = 0
    if data.parent_id:
        parent = await get_category(db, data.parent_id, company_id)
        if parent:
            nivel = parent.nivel + 1
    obj = BoutiqueCategory(**data.model_dump(exclude={"nivel"}), company_id=company_id, nivel=nivel)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

async def update_category(db: AsyncSession, cat_id: UUID, data: CategoryUpdate, company_id: UUID):
    obj = await get_category(db, cat_id, company_id)
    if not obj:
        raise HTTPException(404, "Category not found")
    upd = data.model_dump(exclude_unset=True)
    if "parent_id" in upd and upd["parent_id"] != obj.parent_id:
        if upd["parent_id"] is None:
            upd["nivel"] = 0
        else:
            parent = await get_category(db, upd["parent_id"], company_id)
            if parent:
                upd["nivel"] = parent.nivel + 1
    for k, v in upd.items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj

async def delete_category(db: AsyncSession, cat_id: UUID, company_id: UUID):
    obj = await get_category(db, cat_id, company_id)
    if not obj:
        raise HTTPException(404, "Category not found")
    await db.delete(obj)
    await db.commit()
    return {"ok": True}


# ============================================================
# COLLECTIONS
# ============================================================
async def list_collections(db: AsyncSession, company_id: UUID, temporada: str = None, estado: str = None):
    q = select(BoutiqueCollection).where(BoutiqueCollection.company_id == company_id)
    if temporada:
        q = q.where(BoutiqueCollection.temporada == temporada)
    if estado:
        q = q.where(BoutiqueCollection.estado == estado)
    q = q.order_by(BoutiqueCollection.anio.desc(), BoutiqueCollection.nombre)
    r = await db.execute(q.options(selectinload(BoutiqueCollection.items)))
    return r.scalars().all()

async def get_collection(db: AsyncSession, col_id: UUID, company_id: UUID):
    r = await db.execute(
        select(BoutiqueCollection).where(BoutiqueCollection.id == col_id, BoutiqueCollection.company_id == company_id)
        .options(selectinload(BoutiqueCollection.items))
    )
    return r.scalar_one_or_none()

async def create_collection(db: AsyncSession, data: CollectionCreate, company_id: UUID):
    items_data = data.items or []
    obj = BoutiqueCollection(**data.model_dump(exclude={"items"}), company_id=company_id)
    db.add(obj)
    await db.flush()
    for i in items_data:
        item = BoutiqueCollectionItem(collection_id=obj.id, company_id=company_id, **i.model_dump())
        db.add(item)
    await db.commit()
    await db.refresh(obj)
    return obj

async def update_collection(db: AsyncSession, col_id: UUID, data: CollectionUpdate, company_id: UUID):
    obj = await get_collection(db, col_id, company_id)
    if not obj:
        raise HTTPException(404, "Collection not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj

async def delete_collection(db: AsyncSession, col_id: UUID, company_id: UUID):
    obj = await get_collection(db, col_id, company_id)
    if not obj:
        raise HTTPException(404, "Collection not found")
    await db.delete(obj)
    await db.commit()
    return {"ok": True}


# ============================================================
# PRODUCTS + VARIANTS
# ============================================================
async def list_products(db: AsyncSession, company_id: UUID, categoria_id: UUID = None,
                        genero: str = None, marca: str = None, activo: bool = None,
                        destacado: bool = None, page: int = 1, page_size: int = 20):
    q = select(BoutiqueProduct).where(BoutiqueProduct.company_id == company_id)
    if categoria_id:
        q = q.where(BoutiqueProduct.categoria_id == categoria_id)
    if genero:
        q = q.where(BoutiqueProduct.genero == genero)
    if marca:
        q = q.where(BoutiqueProduct.marca.ilike(f"%{marca}%"))
    if activo is not None:
        q = q.where(BoutiqueProduct.activo == activo)
    if destacado is not None:
        q = q.where(BoutiqueProduct.destacado == destacado)
    # count
    count_q = select(sa_func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(BoutiqueProduct.nombre).offset((page - 1) * page_size).limit(page_size)
    r = await db.execute(q.options(selectinload(BoutiqueProduct.variantes).selectinload(BoutiqueProductVariant.size),
                                    selectinload(BoutiqueProduct.variantes).selectinload(BoutiqueProductVariant.color)))
    items = r.scalars().all()
    return items, total

async def get_product(db: AsyncSession, product_id: UUID, company_id: UUID):
    r = await db.execute(
        select(BoutiqueProduct).where(BoutiqueProduct.id == product_id, BoutiqueProduct.company_id == company_id)
        .options(selectinload(BoutiqueProduct.variantes).selectinload(BoutiqueProductVariant.size),
                 selectinload(BoutiqueProduct.variantes).selectinload(BoutiqueProductVariant.color),
                 selectinload(BoutiqueProduct.categoria))
    )
    return r.scalar_one_or_none()

async def create_product(db: AsyncSession, data: ProductCreate, company_id: UUID):
    variants_data = data.variantes or []
    obj = BoutiqueProduct(**data.model_dump(exclude={"variantes"}), company_id=company_id)
    db.add(obj)
    await db.flush()
    for v in variants_data:
        variant = BoutiqueProductVariant(product_id=obj.id, **v.model_dump())
        db.add(variant)
    await db.commit()
    await db.refresh(obj)
    return obj

async def update_product(db: AsyncSession, product_id: UUID, data: ProductUpdate, company_id: UUID):
    obj = await get_product(db, product_id, company_id)
    if not obj:
        raise HTTPException(404, "Product not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj

async def delete_product(db: AsyncSession, product_id: UUID, company_id: UUID):
    obj = await get_product(db, product_id, company_id)
    if not obj:
        raise HTTPException(404, "Product not found")
    await db.delete(obj)
    await db.commit()
    return {"ok": True}


# ============================================================
# VARIANTS (individual CRUD)
# ============================================================
async def create_variant(db: AsyncSession, product_id: UUID, data: VariantBase, company_id: UUID):
    prod = await get_product(db, product_id, company_id)
    if not prod:
        raise HTTPException(404, "Product not found")
    obj = BoutiqueProductVariant(product_id=product_id, **data.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

async def update_variant_stock(db: AsyncSession, variant_id: UUID, delta: int, company_id: UUID):
    r = await db.execute(
        select(BoutiqueProductVariant).where(BoutiqueProductVariant.id == variant_id)
        .options(selectinload(BoutiqueProductVariant.producto))
    )
    variant = r.scalar_one_or_none()
    if not variant:
        raise HTTPException(404, "Variant not found")
    if variant.stock_actual + delta < 0:
        raise HTTPException(400, "Insufficient stock")
    variant.stock_actual += delta
    movement = BoutiqueVariantStockMovement(
        company_id=company_id,
        variant_id=variant_id,
        tipo="ajuste",
        cantidad=delta,
        stock_resultante=variant.stock_actual,
    )
    db.add(movement)
    await db.commit()
    await db.refresh(variant)
    return variant

async def transfer_stock(db: AsyncSession, from_variant_id: UUID, to_variant_id: UUID,
                          cantidad: int, company_id: UUID):
    if cantidad <= 0:
        raise HTTPException(400, "Cantidad debe ser positiva")
    from_v = (await db.execute(select(BoutiqueProductVariant).where(BoutiqueProductVariant.id == from_variant_id))).scalar_one_or_none()
    to_v = (await db.execute(select(BoutiqueProductVariant).where(BoutiqueProductVariant.id == to_variant_id))).scalar_one_or_none()
    if not from_v or not to_v:
        raise HTTPException(404, "Variant not found")
    if from_v.stock_actual < cantidad:
        raise HTTPException(400, "Insufficient stock in source variant")
    from_v.stock_actual -= cantidad
    to_v.stock_actual += cantidad
    m1 = BoutiqueVariantStockMovement(company_id=company_id, variant_id=from_variant_id,
                                       tipo="egreso", cantidad=-cantidad, stock_resultante=from_v.stock_actual,
                                       referencia_tipo="transferencia", referencia_id=str(to_variant_id))
    m2 = BoutiqueVariantStockMovement(company_id=company_id, variant_id=to_variant_id,
                                       tipo="ingreso", cantidad=cantidad, stock_resultante=to_v.stock_actual,
                                       referencia_tipo="transferencia", referencia_id=str(from_variant_id))
    db.add_all([m1, m2])
    await db.commit()
    return {"from": from_v, "to": to_v}


# ============================================================
# SALES
# ============================================================
async def create_sale(db: AsyncSession, data: SaleCreate, company_id: UUID):
    obj = BoutiqueSale(**data.model_dump(exclude={"items"}), company_id=company_id)
    db.add(obj)
    await db.flush()
    for i_data in data.items:
        item = BoutiqueSaleItem(sale_id=obj.id, **i_data.model_dump())
        db.add(item)
        # update variant stock
        if i_data.variant_id:
            r = await db.execute(select(BoutiqueProductVariant).where(BoutiqueProductVariant.id == i_data.variant_id))
            v = r.scalar_one_or_none()
            if v:
                v.stock_actual -= i_data.cantidad
                movement = BoutiqueVariantStockMovement(
                    company_id=company_id, variant_id=i_data.variant_id,
                    tipo="egreso", cantidad=-i_data.cantidad, stock_resultante=v.stock_actual,
                    referencia_tipo="venta", referencia_id=str(obj.id))
                db.add(movement)
                # accumulate loyalty points
                acct_r = await db.execute(
                    select(BoutiqueLoyaltyAccount).where(BoutiqueLoyaltyAccount.customer_id == data.customer_id,
                                                          BoutiqueLoyaltyAccount.company_id == company_id))
                acct = acct_r.scalar_one_or_none()
                if acct:
                    config_r = await db.execute(select(BoutiqueLoyaltyConfig).where(BoutiqueLoyaltyConfig.company_id == company_id))
                    config = config_r.scalar_one_or_none()
                    if config and config.activo:
                        puntos_ganados = int(i_data.precio_unitario * i_data.cantidad * config.puntos_por_guarani)
                        acct.puntos_acumulados += puntos_ganados
                        acct.puntos_disponibles += puntos_ganados
                        acct.gasto_total += i_data.precio_unitario * i_data.cantidad
    await db.commit()
    await db.refresh(obj)
    return obj

async def list_sales(db: AsyncSession, company_id: UUID, customer_id: UUID = None,
                     page: int = 1, page_size: int = 20):
    q = select(BoutiqueSale).where(BoutiqueSale.company_id == company_id)
    if customer_id:
        q = q.where(BoutiqueSale.customer_id == customer_id)
    count_q = select(sa_func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(BoutiqueSale.fecha.desc()).offset((page - 1) * page_size).limit(page_size)
    r = await db.execute(q)
    return r.scalars().all(), total

async def get_sale(db: AsyncSession, sale_id: UUID, company_id: UUID):
    r = await db.execute(
        select(BoutiqueSale).where(BoutiqueSale.id == sale_id, BoutiqueSale.company_id == company_id)
        .options(selectinload(BoutiqueSale.items))
    )
    return r.scalar_one_or_none()


# ============================================================
# RETURNS
# ============================================================
async def create_return(db: AsyncSession, data: ReturnCreate, company_id: UUID):
    obj = BoutiqueReturn(**data.model_dump(exclude={"items"}), company_id=company_id, estado="pendiente")
    db.add(obj)
    await db.flush()
    total_reintegro = Decimal(0)
    for i_data in data.items:
        item = BoutiqueReturnItem(return_id=obj.id, **i_data.model_dump())
        db.add(item)
        # revert stock
        if i_data.variant_id:
            r = await db.execute(select(BoutiqueProductVariant).where(BoutiqueProductVariant.id == i_data.variant_id))
            v = r.scalar_one_or_none()
            if v:
                v.stock_actual += i_data.cantidad
                movement = BoutiqueVariantStockMovement(
                    company_id=company_id, variant_id=i_data.variant_id,
                    tipo="ingreso", cantidad=i_data.cantidad, stock_resultante=v.stock_actual,
                    referencia_tipo="devolucion", referencia_id=str(obj.id))
                db.add(movement)
        # find sale item for price
        if i_data.sale_item_id:
            si_r = await db.execute(select(BoutiqueSaleItem).where(BoutiqueSaleItem.id == i_data.sale_item_id))
            si = si_r.scalar_one_or_none()
            if si:
                total_reintegro += si.precio_unitario * i_data.cantidad - si.descuento_item
    obj.total_reintegro = total_reintegro
    await db.commit()
    await db.refresh(obj)
    return obj

async def list_returns(db: AsyncSession, company_id: UUID, customer_id: UUID = None, page: int = 1, page_size: int = 20):
    q = select(BoutiqueReturn).where(BoutiqueReturn.company_id == company_id)
    if customer_id:
        q = q.where(BoutiqueReturn.customer_id == customer_id)
    count_q = select(sa_func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(BoutiqueReturn.fecha.desc()).offset((page - 1) * page_size).limit(page_size)
    r = await db.execute(q)
    return r.scalars().all(), total


# ============================================================
# CLIENTELING
# ============================================================
async def get_client_profile(db: AsyncSession, customer_id: UUID, company_id: UUID):
    r = await db.execute(
        select(BoutiqueClientProfile).where(
            BoutiqueClientProfile.customer_id == customer_id, BoutiqueClientProfile.company_id == company_id))
    return r.scalar_one_or_none()

async def upsert_client_profile(db: AsyncSession, customer_id: UUID, data: ClientProfileBase, company_id: UUID):
    existing = await get_client_profile(db, customer_id, company_id)
    if existing:
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(existing, k, v)
        obj = existing
    else:
        obj = BoutiqueClientProfile(customer_id=customer_id, company_id=company_id, **data.model_dump())
        db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

async def list_client_profiles(db: AsyncSession, company_id: UUID, estilo: str = None, page: int = 1, page_size: int = 20):
    q = select(BoutiqueClientProfile).where(BoutiqueClientProfile.company_id == company_id)
    if estilo:
        q = q.where(BoutiqueClientProfile.estilo == estilo)
    count_q = select(sa_func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(BoutiqueClientProfile.total_gastado.desc()).offset((page - 1) * page_size).limit(page_size)
    r = await db.execute(q)
    return r.scalars().all(), total

async def create_interaction(db: AsyncSession, data: InteractionCreate, company_id: UUID):
    obj = BoutiqueClientInteraction(**data.model_dump(), company_id=company_id)
    db.add(obj)
    # update last visit
    profile = await get_client_profile(db, data.customer_id, company_id)
    if profile:
        profile.ultima_visita = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(obj)
    return obj

async def list_interactions(db: AsyncSession, company_id: UUID, customer_id: UUID, page: int = 1, page_size: int = 20):
    q = select(BoutiqueClientInteraction).where(
        BoutiqueClientInteraction.company_id == company_id, BoutiqueClientInteraction.customer_id == customer_id)
    count_q = select(sa_func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(BoutiqueClientInteraction.fecha.desc()).offset((page - 1) * page_size).limit(page_size)
    r = await db.execute(q)
    return r.scalars().all(), total


# ============================================================
# LOYALTY
# ============================================================
async def get_loyalty_config(db: AsyncSession, company_id: UUID):
    r = await db.execute(
        select(BoutiqueLoyaltyConfig).where(BoutiqueLoyaltyConfig.company_id == company_id)
        .options(selectinload(BoutiqueLoyaltyConfig.tiers)))
    return r.scalar_one_or_none()

async def create_loyalty_config(db: AsyncSession, company_id: UUID):
    config = BoutiqueLoyaltyConfig(company_id=company_id)
    db.add(config)
    await db.flush()
    tiers = [
        BoutiqueLoyaltyTier(config_id=config.id, codigo="bronze", nombre="Bronce", nivel=1, gasto_minimo_acumulado=0, multiplicador_puntos=1, descuento_percent=0),
        BoutiqueLoyaltyTier(config_id=config.id, codigo="silver", nombre="Plata", nivel=2, gasto_minimo_acumulado=Decimal("500000"), multiplicador_puntos=1.5, descuento_percent=5, beneficio_envio_gratis=True),
        BoutiqueLoyaltyTier(config_id=config.id, codigo="gold", nombre="Oro", nivel=3, gasto_minimo_acumulado=Decimal("2000000"), multiplicador_puntos=2, descuento_percent=10, beneficio_envio_gratis=True, beneficio_acceso_anticipado=True),
        BoutiqueLoyaltyTier(config_id=config.id, codigo="platinum", nombre="Platino", nivel=4, gasto_minimo_acumulado=Decimal("8000000"), multiplicador_puntos=3, descuento_percent=15, beneficio_envio_gratis=True, beneficio_acceso_anticipado=True, beneficio_gift_wrapping_gratis=True),
    ]
    db.add_all(tiers)
    await db.commit()
    return config

async def get_loyalty_account(db: AsyncSession, customer_id: UUID, company_id: UUID):
    r = await db.execute(
        select(BoutiqueLoyaltyAccount).where(
            BoutiqueLoyaltyAccount.customer_id == customer_id, BoutiqueLoyaltyAccount.company_id == company_id)
        .options(selectinload(BoutiqueLoyaltyAccount.tier)))
    return r.scalar_one_or_none()

async def upsert_loyalty_account(db: AsyncSession, customer_id: UUID, company_id: UUID):
    existing = await get_loyalty_account(db, customer_id, company_id)
    if existing:
        return existing
    cfg = await get_loyalty_config(db, company_id)
    if not cfg:
        cfg = await create_loyalty_config(db, company_id)
    tier_id = None
    if cfg.tiers:
        tier_id = min(cfg.tiers, key=lambda t: t.nivel).id
    obj = BoutiqueLoyaltyAccount(customer_id=customer_id, company_id=company_id, tier_id=tier_id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

async def recalculate_tier(db: AsyncSession, customer_id: UUID, company_id: UUID):
    acct = await get_loyalty_account(db, customer_id, company_id)
    if not acct:
        return None
    cfg = await get_loyalty_config(db, company_id)
    if not cfg or not cfg.tiers:
        return acct
    sorted_tiers = sorted(cfg.tiers, key=lambda t: t.nivel, reverse=True)
    best_tier = sorted_tiers[-1]
    for t in sorted_tiers:
        if t.gasto_minimo_acumulado and acct.gasto_total >= t.gasto_minimo_acumulado:
            best_tier = t
            break
    if acct.tier_id != best_tier.id:
        acct.tier_id = best_tier.id
        await db.commit()
        await db.refresh(acct)
    return acct

async def redeem_points(db: AsyncSession, customer_id: UUID, puntos: int, company_id: UUID):
    acct = await get_loyalty_account(db, customer_id, company_id)
    if not acct:
        raise HTTPException(404, "Loyalty account not found")
    if acct.puntos_disponibles < puntos:
        raise HTTPException(400, "Insufficient points")
    cfg = await get_loyalty_config(db, company_id)
    valor = Decimal(puntos) * cfg.guarani_por_punto if cfg else Decimal(puntos) * 100
    acct.puntos_canjeados += puntos
    acct.puntos_disponibles -= puntos
    await db.commit()
    return {"puntos_canjeados": puntos, "valor_guarani": valor}


# ============================================================
# MARKDOWN IA
# ============================================================
async def list_markdown_rules(db: AsyncSession, company_id: UUID):
    r = await db.execute(
        select(BoutiqueMarkdownRule).where(BoutiqueMarkdownRule.company_id == company_id)
        .order_by(BoutiqueMarkdownRule.prioridad.desc()))
    return r.scalars().all()

async def create_markdown_rule(db: AsyncSession, data: MarkdownRuleCreate, company_id: UUID):
    obj = BoutiqueMarkdownRule(**data.model_dump(), company_id=company_id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

async def apply_markdown(db: AsyncSession, rule_id: UUID, company_id: UUID):
    r = await db.execute(select(BoutiqueMarkdownRule).where(BoutiqueMarkdownRule.id == rule_id, BoutiqueMarkdownRule.company_id == company_id))
    rule = r.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    today = date.today()
    q = select(BoutiqueProductVariant).join(BoutiqueProduct).where(BoutiqueProduct.company_id == company_id)
    if rule.categoria_id:
        q = q.where(BoutiqueProduct.categoria_id == rule.categoria_id)
    if rule.temporada:
        coll_q = select(BoutiqueCollection.id).where(
            BoutiqueCollection.temporada == rule.temporada, BoutiqueCollection.estado == "activa",
            BoutiqueCollection.company_id == company_id)
        coll_ids = (await db.execute(coll_q)).scalars().all()
        if coll_ids:
            coll_items_q = select(BoutiqueCollectionItem.producto_id).where(
                BoutiqueCollectionItem.collection_id.in_(coll_ids))
            prod_ids = (await db.execute(coll_items_q)).scalars().all()
            if prod_ids:
                q = q.where(BoutiqueProduct.id.in_(prod_ids))
    variants = (await db.execute(q.options(selectinload(BoutiqueProductVariant.producto)))).scalars().all()
    applied = []
    for v in variants:
        # skip if already has markdown
        existing_r = await db.execute(
            select(BoutiqueMarkdownItem).where(BoutiqueMarkdownItem.variant_id == v.id,
                                                BoutiqueMarkdownItem.activo == True, BoutiqueMarkdownItem.company_id == company_id))
        if existing_r.scalar_one_or_none():
            continue
        precio_original = v.producto.precio_base + v.precio_sobrecargo
        if precio_original <= 0:
            continue
        # calculate markdown %
        percent = rule.descuento_minimo or Decimal(5)
        days_left = None
        if rule.tipo == "fin_temporada" and rule.dias_antes_fin_temporada:
            # find active collections
            coll_r = await db.execute(
                select(BoutiqueCollection).where(BoutiqueCollection.estado == "activa",
                                                  BoutiqueCollection.company_id == company_id))
            collections = coll_r.scalars().all()
            for c in collections:
                if c.fecha_fin:
                    remaining = (c.fecha_fin - today).days
                    if 0 <= remaining <= (rule.dias_antes_fin_temporada or 999):
                        days_left = remaining
                        break
            if days_left is not None and rule.dias_antes_fin_temporada and rule.dias_antes_fin_temporada > 0:
                progress = 1 - (days_left / rule.dias_antes_fin_temporada)
                percent = rule.descuento_minimo + (rule.descuento_maximo - rule.descuento_minimo) * Decimal(str(progress))
        elif rule.tipo == "exceso_stock" and rule.factor_rotacion_minimo and v.stock_minimo > 0:
            ratio = Decimal(v.stock_actual) / Decimal(v.stock_minimo)
            if ratio > rule.factor_rotacion_minimo:
                excess_ratio = min((ratio - rule.factor_rotacion_minimo) / ratio, Decimal(1))
                percent = rule.descuento_minimo + (rule.descuento_maximo - rule.descuento_minimo) * excess_ratio
        else:
            continue
        percent = min(percent, rule.descuento_maximo)
        percent = max(percent, rule.descuento_minimo)
        precio_markdown = precio_original * (1 - percent / Decimal(100))
        mi = BoutiqueMarkdownItem(
            company_id=company_id, rule_id=rule_id, variant_id=v.id, producto_id=v.product_id,
            descuento_aplicado=percent, precio_original=precio_original,
            precio_markdown=precio_markdown, fecha_inicio=today, activo=True, aplicado_automaticamente=True)
        db.add(mi)
        applied.append({"variant_id": str(v.id), "sku": v.sku, "original": float(precio_original),
                        "markdown": float(precio_markdown), "percent": float(percent)})
    await db.commit()
    return {"rule": rule.codigo, "applied": len(applied), "items": applied}


# ============================================================
# AR METADATA
# ============================================================
async def get_ar_metadata(db: AsyncSession, producto_id: UUID, company_id: UUID):
    r = await db.execute(
        select(BoutiqueProductARMetadata).where(
            BoutiqueProductARMetadata.producto_id == producto_id, BoutiqueProductARMetadata.company_id == company_id))
    return r.scalar_one_or_none()

async def upsert_ar_metadata(db: AsyncSession, producto_id: UUID, data: dict, company_id: UUID):
    existing = await get_ar_metadata(db, producto_id, company_id)
    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        obj = existing
    else:
        obj = BoutiqueProductARMetadata(producto_id=producto_id, company_id=company_id, **data)
        db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


# ============================================================
# CROSS-SELL / RECOMMENDATIONS
# ============================================================
async def get_cross_sell(db: AsyncSession, producto_id: UUID, company_id: UUID, limit: int = 6):
    """Cross-sell by same category + different color family + different gender complement."""
    r = await db.execute(
        select(BoutiqueProduct).where(BoutiqueProduct.id == producto_id, BoutiqueProduct.company_id == company_id))
    product = r.scalar_one_or_none()
    if not product:
        return []
    q = select(BoutiqueProduct).where(
        BoutiqueProduct.company_id == company_id, BoutiqueProduct.activo == True,
        BoutiqueProduct.id != producto_id)
    if product.categoria_id:
        q = q.where(BoutiqueProduct.categoria_id == product.categoria_id)
    q = q.order_by(sa_func.random()).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()

async def get_recommendations_for_client(db: AsyncSession, customer_id: UUID, company_id: UUID, limit: int = 8):
    """Recommend products based on client preferences."""
    profile = await get_client_profile(db, customer_id, company_id)
    if not profile:
        return []
    q = select(BoutiqueProduct).where(BoutiqueProduct.company_id == company_id, BoutiqueProduct.activo == True)
    if profile.genero_preferido:
        q = q.where(BoutiqueProduct.genero == profile.genero_preferido)
    if profile.marcas_preferidas:
        q = q.where(BoutiqueProduct.marca.in_(profile.marcas_preferidas))
    q = q.order_by(sa_func.random()).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


# ============================================================
# DASHBOARD
# ============================================================
async def get_dashboard(db: AsyncSession, company_id: UUID):
    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # counts
    r = await db.execute(select(sa_func.count(BoutiqueProduct.id)).where(BoutiqueProduct.company_id == company_id))
    total_productos = r.scalar() or 0
    r = await db.execute(select(sa_func.count(BoutiqueProductVariant.id)).join(BoutiqueProduct).where(BoutiqueProduct.company_id == company_id))
    total_variantes = r.scalar() or 0
    r = await db.execute(
        select(sa_func.count(BoutiqueSale.id)).where(BoutiqueSale.company_id == company_id, BoutiqueSale.fecha >= first_of_month))
    total_ventas_mes = r.scalar() or 0
    r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(BoutiqueSale.total), 0)).where(
            BoutiqueSale.company_id == company_id, BoutiqueSale.fecha >= first_of_month))
    total_ingresos_mes = r.scalar() or Decimal(0)
    r = await db.execute(select(sa_func.count(sa_func.distinct(BoutiqueSale.customer_id))).where(BoutiqueSale.company_id == company_id))
    total_clientes = r.scalar() or 0
    r = await db.execute(
        select(sa_func.count(BoutiqueReturn.id)).where(BoutiqueReturn.company_id == company_id, BoutiqueReturn.fecha >= first_of_month))
    devoluciones_mes = r.scalar() or 0
    r = await db.execute(
        select(sa_func.count(BoutiqueProductVariant.id)).join(BoutiqueProduct).where(
            BoutiqueProduct.company_id == company_id, BoutiqueProductVariant.stock_actual <= BoutiqueProductVariant.stock_minimo))
    productos_bajo_stock = r.scalar() or 0
    r = await db.execute(select(sa_func.count(BoutiqueMarkdownItem.id)).where(
        BoutiqueMarkdownItem.company_id == company_id, BoutiqueMarkdownItem.activo == True))
    variantes_con_markdown = r.scalar() or 0
    r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(BoutiqueLoyaltyAccount.puntos_acumulados), 0)).where(
            BoutiqueLoyaltyAccount.company_id == company_id))
    loyalty_puntos_emitidos = r.scalar() or 0
    return {
        "total_productos": total_productos,
        "total_variantes": total_variantes,
        "total_ventas_mes": total_ventas_mes,
        "total_ingresos_mes": total_ingresos_mes,
        "total_clientes": total_clientes,
        "devoluciones_mes": devoluciones_mes,
        "productos_bajo_stock": productos_bajo_stock,
        "variantes_con_markdown": variantes_con_markdown,
        "loyalty_puntos_emitidos": loyalty_puntos_emitidos,
    }
