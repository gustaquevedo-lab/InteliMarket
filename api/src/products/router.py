"""Product and category API router"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
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
@router.post("/products/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    product_id: str | None = Form(None),
    sku: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Sube una imagen de producto desde el equipo local, la valida, optimiza
    (redimensión a máx 1000x1000 con LANCZOS, corrección EXIF y compresión WebP/PNG)
    y la guarda en /uploads/products/. Retorna la URL servida por el servidor.
    """
    import io
    import time
    import uuid
    import re
    from pathlib import Path
    from PIL import Image, ImageOps

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    try:
        image = Image.open(io.BytesIO(content))
        image = ImageOps.exif_transpose(image)
    except Exception as img_err:
        raise HTTPException(status_code=400, detail=f"Formato de imagen inválido: {str(img_err)}")

    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        image = image.convert("RGBA")
    else:
        image = image.convert("RGB")

    try:
        image.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
    except Exception:
        pass

    upload_dir = Path("uploads/products")
    upload_dir.mkdir(parents=True, exist_ok=True)

    clean_id = re.sub(r"[^a-zA-Z0-9_\-]", "", (product_id or sku or "prod"))[:30]
    filename = f"prod_{clean_id}_{int(time.time())}_{uuid.uuid4().hex[:6]}.webp"
    file_path = upload_dir / filename

    try:
        image.save(file_path, format="WEBP", quality=88, method=6)
    except Exception:
        filename = f"prod_{clean_id}_{int(time.time())}_{uuid.uuid4().hex[:6]}.png"
        file_path = upload_dir / filename
        image.save(file_path, format="PNG", optimize=True)

    image_url = f"/uploads/products/{filename}"

    if product_id:
        try:
            await service.update_product(db, product_id, ProductUpdate(imagen_url=image_url))
        except Exception as e:
            logger.warning("No se pudo actualizar imagen_url directo en producto %s: %s", product_id, e)

    return {"url": image_url, "filename": filename}


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
    tipo_producto: str | None = Query(None),
    include_inactive: bool = Query(False),
    limit: int = Query(100, le=20000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    products = await service.list_products(
        db, company_id, categoria_id, search, activo, limit, offset,
        supplier_id=supplier_id, tipo_producto=tipo_producto, include_inactive=include_inactive,
    )
    await annotate_products_with_promos(db, company_id, products)
    return products


@router.get("/companies/{company_id}/products", response_model=list[ProductResponse])
async def list_products(
    company_id: str,
    categoria_id: str | None = Query(None),
    supplier_id: str | None = Query(None),
    search: str | None = Query(None),
    activo: bool | None = Query(None),
    tipo_producto: str | None = Query(None),
    include_inactive: bool = Query(False),
    limit: int = Query(100, le=20000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    products = await service.list_products(
        db, company_id, categoria_id, search, activo, limit, offset,
        supplier_id=supplier_id, tipo_producto=tipo_producto, include_inactive=include_inactive,
    )
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

