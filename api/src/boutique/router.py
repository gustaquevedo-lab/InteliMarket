"""API Router for Boutique module (bout_*).

~55 endpoints covering sizes, colors, categories, collections, products,
variants, stock movements, sales, returns, clienteling, loyalty,
markdown IA, AR metadata, cross-sell, events, and dashboard.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.auth.deps import get_current_user
from api.src.boutique import service as svc
from api.src.boutique.schemas import (
    SizeCreate, SizeUpdate, SizeOut,
    ColorCreate, ColorUpdate, ColorOut,
    CategoryCreate, CategoryUpdate, CategoryOut, CategorySimpleOut,
    CollectionCreate, CollectionUpdate, CollectionOut, CollectionItemBase,
    ProductCreate, ProductUpdate, ProductOut, VariantBase, VariantOut,
    SaleCreate, SaleOut, ReturnCreate, ReturnOut,
    ClientProfileBase, ClientProfileOut, InteractionCreate, InteractionOut,
    LoyaltyAccountOut, MarkdownRuleCreate, MarkdownRuleOut,
    ARMetadataOut, DashboardOut,
    EventCreate, EventGuestCreate,
)
from api.src.db import get_db

router = APIRouter(prefix="/api/v1/boutique", tags=["Boutique"])


def _company(user: dict) -> UUID:
    return user.get("company_id") or user.get("company")


# ==================== DASHBOARD ====================
@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.get_dashboard(db, _company(user))


# ==================== SIZES ====================
@router.get("/sizes", response_model=list[SizeOut])
async def list_sizes(categoria: str = None, activo: bool = None,
                     user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.list_sizes(db, _company(user), categoria, activo)

@router.get("/sizes/{size_id}", response_model=SizeOut)
async def get_size(size_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await svc.get_size(db, size_id, _company(user))
    if not r:
        from fastapi import HTTPException; raise HTTPException(404, "Size not found")
    return r

@router.post("/sizes", response_model=SizeOut, status_code=201)
async def create_size(data: SizeCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_size(db, data, _company(user))

@router.put("/sizes/{size_id}", response_model=SizeOut)
async def update_size(size_id: UUID, data: SizeUpdate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.update_size(db, size_id, data, _company(user))

@router.delete("/sizes/{size_id}")
async def delete_size(size_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.delete_size(db, size_id, _company(user))


# ==================== COLORS ====================
@router.get("/colors", response_model=list[ColorOut])
async def list_colors(familia: str = None, activo: bool = None,
                      user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.list_colors(db, _company(user), familia, activo)

@router.get("/colors/{color_id}", response_model=ColorOut)
async def get_color(color_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await svc.get_color(db, color_id, _company(user))
    if not r:
        from fastapi import HTTPException; raise HTTPException(404, "Color not found")
    return r

@router.post("/colors", response_model=ColorOut, status_code=201)
async def create_color(data: ColorCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_color(db, data, _company(user))

@router.put("/colors/{color_id}", response_model=ColorOut)
async def update_color(color_id: UUID, data: ColorUpdate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.update_color(db, color_id, data, _company(user))

@router.delete("/colors/{color_id}")
async def delete_color(color_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.delete_color(db, color_id, _company(user))


# ==================== CATEGORIES ====================
@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(activo: bool = None, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.list_categories(db, _company(user), activo)

@router.get("/categories/{cat_id}", response_model=CategoryOut)
async def get_category(cat_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await svc.get_category(db, cat_id, _company(user))
    if not r:
        from fastapi import HTTPException; raise HTTPException(404, "Category not found")
    return r

@router.post("/categories", response_model=CategorySimpleOut, status_code=201)
async def create_category(data: CategoryCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_category(db, data, _company(user))

@router.put("/categories/{cat_id}", response_model=CategorySimpleOut)
async def update_category(cat_id: UUID, data: CategoryUpdate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.update_category(db, cat_id, data, _company(user))

@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.delete_category(db, cat_id, _company(user))


# ==================== COLLECTIONS ====================
@router.get("/collections", response_model=list[CollectionOut])
async def list_collections(temporada: str = None, estado: str = None,
                           user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.list_collections(db, _company(user), temporada, estado)

@router.get("/collections/{col_id}", response_model=CollectionOut)
async def get_collection(col_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await svc.get_collection(db, col_id, _company(user))
    if not r:
        from fastapi import HTTPException; raise HTTPException(404, "Collection not found")
    return r

@router.post("/collections", response_model=CollectionOut, status_code=201)
async def create_collection(data: CollectionCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_collection(db, data, _company(user))

@router.put("/collections/{col_id}", response_model=CollectionOut)
async def update_collection(col_id: UUID, data: CollectionUpdate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.update_collection(db, col_id, data, _company(user))

@router.delete("/collections/{col_id}")
async def delete_collection(col_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.delete_collection(db, col_id, _company(user))


# ==================== PRODUCTS ====================
@router.get("/products")
async def list_products(categoria_id: UUID = None, genero: str = None, marca: str = None,
                        activo: bool = None, destacado: bool = None,
                        page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
                        user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items, total = await svc.list_products(db, _company(user), categoria_id, genero, marca, activo, destacado, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.get("/products/{product_id}", response_model=ProductOut)
async def get_product(product_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await svc.get_product(db, product_id, _company(user))
    if not r:
        from fastapi import HTTPException; raise HTTPException(404, "Product not found")
    return r

@router.post("/products", response_model=ProductOut, status_code=201)
async def create_product(data: ProductCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_product(db, data, _company(user))

@router.put("/products/{product_id}", response_model=ProductOut)
async def update_product(product_id: UUID, data: ProductUpdate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.update_product(db, product_id, data, _company(user))

@router.delete("/products/{product_id}")
async def delete_product(product_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.delete_product(db, product_id, _company(user))


# ==================== VARIANTS ====================
@router.post("/products/{product_id}/variants", response_model=VariantOut, status_code=201)
async def create_variant(product_id: UUID, data: VariantBase, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_variant(db, product_id, data, _company(user))

@router.post("/variants/{variant_id}/stock")
async def update_variant_stock(variant_id: UUID, delta: int = Query(...),
                               user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.update_variant_stock(db, variant_id, delta, _company(user))

@router.post("/variants/transfer")
async def transfer_stock(from_variant_id: UUID = Query(...), to_variant_id: UUID = Query(...), cantidad: int = Query(...),
                         user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.transfer_stock(db, from_variant_id, to_variant_id, cantidad, _company(user))


# ==================== SALES ====================
@router.get("/sales")
async def list_sales(customer_id: UUID = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
                     user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items, total = await svc.list_sales(db, _company(user), customer_id, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.get("/sales/{sale_id}", response_model=SaleOut)
async def get_sale(sale_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await svc.get_sale(db, sale_id, _company(user))
    if not r:
        from fastapi import HTTPException; raise HTTPException(404, "Sale not found")
    return r

@router.post("/sales", response_model=SaleOut, status_code=201)
async def create_sale(data: SaleCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_sale(db, data, _company(user))


# ==================== RETURNS ====================
@router.get("/returns")
async def list_returns(customer_id: UUID = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
                       user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items, total = await svc.list_returns(db, _company(user), customer_id, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("/returns", response_model=ReturnOut, status_code=201)
async def create_return(data: ReturnCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_return(db, data, _company(user))


# ==================== CLIENTELING ====================
@router.get("/client-profiles")
async def list_client_profiles(estilo: str = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
                                user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items, total = await svc.list_client_profiles(db, _company(user), estilo, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.get("/client-profiles/{customer_id}", response_model=ClientProfileOut)
async def get_client_profile(customer_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await svc.get_client_profile(db, customer_id, _company(user))
    if not r:
        from fastapi import HTTPException; raise HTTPException(404, "Client profile not found")
    return r

@router.put("/client-profiles/{customer_id}", response_model=ClientProfileOut)
async def upsert_client_profile(customer_id: UUID, data: ClientProfileBase,
                                 user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.upsert_client_profile(db, customer_id, data, _company(user))

@router.get("/interactions/{customer_id}")
async def list_interactions(customer_id: UUID, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
                            user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items, total = await svc.list_interactions(db, _company(user), customer_id, page, page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("/interactions", response_model=InteractionOut, status_code=201)
async def create_interaction(data: InteractionCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_interaction(db, data, _company(user))


# ==================== LOYALTY ====================
@router.get("/loyalty/config")
async def get_loyalty_config(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cfg = await svc.get_loyalty_config(db, _company(user))
    return cfg or {}

@router.post("/loyalty/config", status_code=201)
async def create_loyalty_config(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_loyalty_config(db, _company(user))

@router.get("/loyalty/accounts/{customer_id}", response_model=LoyaltyAccountOut)
async def get_loyalty_account(customer_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    acct = await svc.get_loyalty_account(db, customer_id, _company(user))
    if not acct:
        acct = await svc.upsert_loyalty_account(db, customer_id, _company(user))
    return acct

@router.post("/loyalty/accounts/{customer_id}/upsert", response_model=LoyaltyAccountOut)
async def upsert_loyalty_account(customer_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.upsert_loyalty_account(db, customer_id, _company(user))

@router.post("/loyalty/accounts/{customer_id}/recalculate-tier", response_model=LoyaltyAccountOut)
async def recalculate_tier(customer_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.recalculate_tier(db, customer_id, _company(user))

@router.post("/loyalty/accounts/{customer_id}/redeem")
async def redeem_points(customer_id: UUID, puntos: int = Query(...),
                        user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.redeem_points(db, customer_id, puntos, _company(user))


# ==================== MARKDOWN ====================
@router.get("/markdown/rules", response_model=list[MarkdownRuleOut])
async def list_markdown_rules(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.list_markdown_rules(db, _company(user))

@router.post("/markdown/rules", response_model=MarkdownRuleOut, status_code=201)
async def create_markdown_rule(data: MarkdownRuleCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.create_markdown_rule(db, data, _company(user))

@router.post("/markdown/rules/{rule_id}/apply")
async def apply_markdown(rule_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.apply_markdown(db, rule_id, _company(user))


# ==================== AR METADATA ====================
@router.get("/ar/{producto_id}", response_model=ARMetadataOut)
async def get_ar_metadata(producto_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await svc.get_ar_metadata(db, producto_id, _company(user))
    if not r:
        from fastapi import HTTPException; raise HTTPException(404, "AR metadata not found")
    return r

@router.put("/ar/{producto_id}", response_model=ARMetadataOut)
async def upsert_ar_metadata(producto_id: UUID, data: dict,
                              user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.upsert_ar_metadata(db, producto_id, data, _company(user))


# ==================== CROSS-SELL / RECOMMENDATIONS ====================
@router.get("/cross-sell/{producto_id}")
async def cross_sell(producto_id: UUID, limit: int = Query(6, ge=1, le=20),
                     user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.get_cross_sell(db, producto_id, _company(user), limit)

@router.get("/recommendations/{customer_id}")
async def recommendations(customer_id: UUID, limit: int = Query(8, ge=1, le=20),
                          user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.get_recommendations_for_client(db, customer_id, _company(user), limit)


# ==================== STOCK MOVEMENTS ====================
@router.get("/variants/{variant_id}/movements")
async def list_stock_movements(variant_id: UUID, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
                               user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select, func as sa_func
    from api.src.boutique.models import BoutiqueVariantStockMovement
    company_id = _company(user)
    q = select(BoutiqueVariantStockMovement).where(
        BoutiqueVariantStockMovement.variant_id == variant_id, BoutiqueVariantStockMovement.company_id == company_id)
    count_q = select(sa_func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(BoutiqueVariantStockMovement.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    r = await db.execute(q)
    items = r.scalars().all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ==================== GIFT WRAPPING ====================
@router.get("/gift-wrapping")
async def list_gift_wrapping_options(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from api.src.boutique.models import BoutiqueGiftWrappingOption
    company_id = _company(user)
    r = await db.execute(select(BoutiqueGiftWrappingOption).where(BoutiqueGiftWrappingOption.company_id == company_id, BoutiqueGiftWrappingOption.activo == True))
    return r.scalars().all()

@router.post("/gift-wrapping", status_code=201)
async def create_gift_wrapping_option(data: dict, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from api.src.boutique.models import BoutiqueGiftWrappingOption
    obj = BoutiqueGiftWrappingOption(company_id=_company(user), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


# ==================== CLIENT MEASUREMENTS ====================
@router.get("/measurements/{customer_id}")
async def get_measurements(customer_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from api.src.boutique.models import BoutiqueClientMeasurement
    r = await db.execute(
        select(BoutiqueClientMeasurement).where(
            BoutiqueClientMeasurement.customer_id == customer_id, BoutiqueClientMeasurement.company_id == _company(user))
        .order_by(BoutiqueClientMeasurement.fecha_tomada.desc()))
    return r.scalars().all()

@router.post("/measurements", status_code=201)
async def create_measurement(data: dict, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from api.src.boutique.models import BoutiqueClientMeasurement
    obj = BoutiqueClientMeasurement(company_id=_company(user), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


# ==================== EVENTS ====================
@router.get("/events")
async def list_events(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from api.src.boutique.models import BoutiqueEvent
    company_id = _company(user)
    r = await db.execute(select(BoutiqueEvent).where(BoutiqueEvent.company_id == company_id).order_by(BoutiqueEvent.fecha_inicio.desc()))
    return r.scalars().all()

@router.post("/events", status_code=201)
async def create_event(data: EventCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from api.src.boutique.models import BoutiqueEvent
    obj = BoutiqueEvent(company_id=_company(user), **data.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

@router.post("/events/{event_id}/guests", status_code=201)
async def add_event_guest(event_id: UUID, data: EventGuestCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from api.src.boutique.models import BoutiqueEventGuest
    obj = BoutiqueEventGuest(event_id=event_id, **data.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

@router.get("/events/{event_id}/guests")
async def list_event_guests(event_id: UUID, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from api.src.boutique.models import BoutiqueEventGuest
    r = await db.execute(select(BoutiqueEventGuest).where(BoutiqueEventGuest.event_id == event_id))
    return r.scalars().all()
