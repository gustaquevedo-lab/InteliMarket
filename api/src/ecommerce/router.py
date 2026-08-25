"""E-commerce router — Super Extra live catalog, cart, checkout, orders"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.ecommerce import service
from api.src.ecommerce.auth import require_ecommerce_customer

router = APIRouter(
    prefix="/api/v1/ecommerce",
    tags=["ecommerce"],
)

DEFAULT_COMPANY_ID = "00000000-0000-0000-0000-000000000010"


# ═══════════════════════════════════════════════════════════════════
#  AUTH CLIENTES TIENDA ONLINE
# ═══════════════════════════════════════════════════════════════════

@router.post("/auth/register")
async def register(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        data["company_id"] = data.get("company_id") or DEFAULT_COMPANY_ID
        return await service.register_customer(db, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/auth/login")
async def login(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        data["company_id"] = data.get("company_id") or DEFAULT_COMPANY_ID
        return await service.login_customer(db, data)
    except ValueError as e:
        raise HTTPException(401, str(e))


@router.get("/auth/me")
async def me(
    customer: dict = Depends(require_ecommerce_customer),
):
    return customer


# ═══════════════════════════════════════════════════════════════════
#  CATALOGO PUBLICO SUPER EXTRA
# ═══════════════════════════════════════════════════════════════════

@router.get("/catalog")
async def get_catalog(
    search: str = Query(""),
    category_id: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_catalog(db, DEFAULT_COMPANY_ID, search, category_id or None, page, per_page)


@router.get("/catalog/{product_id}")
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.get_product_detail(db, DEFAULT_COMPANY_ID, product_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db),
):
    return await service.get_categories(db, DEFAULT_COMPANY_ID)


# ═══════════════════════════════════════════════════════════════════
#  CARRITO
# ═══════════════════════════════════════════════════════════════

@router.get("/cart")
async def get_cart(
    db: AsyncSession = Depends(get_db),
    customer: dict = Depends(require_ecommerce_customer),
):
    return await service.get_cart(db, customer["id"], customer["company_id"])


@router.post("/cart/items")
async def add_to_cart(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    customer: dict = Depends(require_ecommerce_customer),
):
    try:
        return await service.add_to_cart(
            db,
            customer["id"],
            customer["company_id"],
            data["product_id"],
            data.get("cantidad", 1),
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
