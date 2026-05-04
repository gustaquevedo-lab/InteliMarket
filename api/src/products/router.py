"""Product and category API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.products.schemas import (
    ProductCreate, ProductUpdate, ProductResponse,
    CategoryCreate, CategoryResponse,
)
from api.src.products import service

router = APIRouter(prefix="/api/v1", tags=["products"])


# Categories
@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_category(db, body)


@router.get("/companies/{company_id}/categories", response_model=list[CategoryResponse])
async def list_categories(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_categories(db, company_id)


# Products
@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductCreate, db: AsyncSession = Depends(get_db)):
    existing = await service.get_product_by_sku(db, str(body.company_id), body.sku)
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un producto con ese SKU")
    return await service.create_product(db, body)


@router.get("/companies/{company_id}/products", response_model=list[ProductResponse])
async def list_products(
    company_id: str,
    category_id: str | None = Query(None),
    search: str | None = Query(None),
    activo: bool | None = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_products(db, company_id, category_id, search, activo, limit, offset)


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    product = await service.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, body: ProductUpdate, db: AsyncSession = Depends(get_db)):
    product = await service.update_product(db, product_id, body)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_product(db, product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
