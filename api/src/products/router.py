"""Product and category API router"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.products.schemas import (
    ProductCreate, ProductUpdate, ProductResponse,
    CategoryCreate, CategoryResponse,
)
from api.src.products import service
from api.src.products.service import annotate_products_with_promos

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["products"], dependencies=[Depends(require_auth)])


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


@router.get("/products", response_model=list[ProductResponse])
async def list_products_direct(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    categoria_id: str | None = Query(None),
    supplier_id: str | None = Query(None),
    search: str | None = Query(None),
    activo: bool | None = Query(None),
    limit: int = Query(100, le=20000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    products = await service.list_products(db, company_id, categoria_id, search, activo, limit, offset, supplier_id=supplier_id)
    await annotate_products_with_promos(db, company_id, products)
    return products


@router.get("/companies/{company_id}/products", response_model=list[ProductResponse])
async def list_products(
    company_id: str,
    categoria_id: str | None = Query(None),
    supplier_id: str | None = Query(None),
    search: str | None = Query(None),
    activo: bool | None = Query(None),
    limit: int = Query(100, le=20000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    products = await service.list_products(db, company_id, categoria_id, search, activo, limit, offset, supplier_id=supplier_id)
    await annotate_products_with_promos(db, company_id, products)
    return products


@router.get("/companies/{company_id}/products/stats")
async def get_products_stats(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_products_stats(db, company_id)


@router.get("/products/{product_id}/360")
async def get_product_360(product_id: str, db: AsyncSession = Depends(get_db)):
    data = await service.get_product_360(db, product_id)
    if not data:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return data


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    product = await service.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    await annotate_products_with_promos(db, str(product.company_id), [product])
    return product


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, body: ProductUpdate, db: AsyncSession = Depends(get_db)):
    product = await service.update_product(db, product_id, body)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if "precio_venta" in body.model_dump(exclude_unset=True):
        try:
            from api.src.integrations.scales import service as scales_service
            await scales_service.auto_sync_product(db, product.company_id, product)
        except Exception as e:
            logger.warning("Auto PLU sync failed for product %s: %s", product_id, e)
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_product(db, product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Producto no encontrado")


# Product Variants
@router.get("/companies/{company_id}/variants")
async def list_all_variants(
    company_id: str,
    product_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_variants(db, company_id, product_id)


@router.get("/products/{product_id}/variants")
async def list_product_variants(
    product_id: str,
    company_id: str = "00000000-0000-0000-0000-000000000010",
    db: AsyncSession = Depends(get_db),
):
    return await service.list_variants(db, company_id, product_id)


@router.post("/products/{product_id}/variants", status_code=status.HTTP_201_CREATED)
async def create_variant(
    product_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.create_variant(
            db,
            company_id=body.get("company_id", "00000000-0000-0000-0000-000000000010"),
            product_id=product_id,
            data=body,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_variant(
    variant_id: str,
    db: AsyncSession = Depends(get_db),
):
    deleted = await service.delete_variant(db, variant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Variante no encontrada")

