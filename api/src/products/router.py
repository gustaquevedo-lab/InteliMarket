"""Product and category API router"""

import logging
import uuid
from datetime import datetime

from typing import Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form, Body
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.products.schemas import (
    ProductCreate, ProductUpdate, ProductResponse, PaginatedProductResponse,
    CategoryCreate, CategoryResponse, CategorySafeDeletePayload,
    RepresentativeCreate, RepresentativeUpdate, RepresentativeResponse,
    SupplierRepresentativesPayload,
    ProductSectionCreate, ProductSectionUpdate, ProductSectionResponse,
    ProductBrandCreate, ProductBrandUpdate, ProductBrandResponse,
    AssignSupplierRequest, AssignSupplierBatchRequest, ToggleProductActiveRequest,
)
from api.src.products import service
from api.src.products.service import annotate_products_with_promos

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["products"], dependencies=[Depends(require_auth)])


DEFAULT_COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")


def _get_company_uuid(user: dict, explicit: Optional[uuid.UUID] = None) -> uuid.UUID:
    if explicit:
        return explicit
    if user:
        raw = user.get("company_id")
        if raw:
            try:
                return uuid.UUID(str(raw))
            except (ValueError, TypeError):
                pass
    return DEFAULT_COMPANY_ID


# Categories
@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_category(db, body)


@router.get("/companies/{company_id}/categories", response_model=list[CategoryResponse])
async def list_categories(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_categories(db, company_id)


@router.get("/categories/{category_id}/product-count")
async def get_category_product_count(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    count = await service.count_category_products(db, category_id)
    return {"category_id": category_id, "product_count": count}


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: uuid.UUID,
    reassign_to_id: Optional[uuid.UUID] = Query(None),
    company_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user, company_id)
    return await service.safe_delete_category(
        db, category_id=category_id, company_id=cid, reassign_to_id=reassign_to_id
    )


@router.post("/categories/{category_id}/safe-delete")
async def safe_delete_category(
    category_id: uuid.UUID,
    payload: Optional[CategorySafeDeletePayload] = None,
    company_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user, company_id)
    reassign_to_id = payload.reassign_to_id if payload else None
    return await service.safe_delete_category(
        db, category_id=category_id, company_id=cid, reassign_to_id=reassign_to_id
    )


# ═══════════════════════════════════════════════════════════════
#  REPRESENTANTES
# ═══════════════════════════════════════════════════════════════

@router.get("/representatives", response_model=list[RepresentativeResponse])
async def list_representatives(
    company_id: Optional[uuid.UUID] = Query(None),
    supplier_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user, company_id)
    return await service.get_representatives(db, company_id=cid, supplier_id=supplier_id)


@router.post("/representatives", response_model=RepresentativeResponse, status_code=status.HTTP_201_CREATED)
async def create_representative(
    body: RepresentativeCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = body.company_id or _get_company_uuid(user)
    return await service.create_representative(db, company_id=cid, data=body)


@router.put("/representatives/{id}", response_model=RepresentativeResponse)
@router.patch("/representatives/{id}", response_model=RepresentativeResponse)
async def update_representative(
    id: uuid.UUID,
    body: RepresentativeUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user)
    return await service.update_representative(db, rep_id=id, company_id=cid, data=body)


@router.delete("/representatives/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_representative(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user)
    await service.delete_representative(db, rep_id=id, company_id=cid)


# ═══════════════════════════════════════════════════════════════
#  VINCULACIÓN PROVEEDORES - REPRESENTANTES
# ═══════════════════════════════════════════════════════════════

@router.get("/suppliers/{supplier_id}/representatives", response_model=list[RepresentativeResponse])
async def get_supplier_representatives(
    supplier_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_supplier_representatives(db, supplier_id=supplier_id)


@router.post("/suppliers/{supplier_id}/representatives", response_model=list[RepresentativeResponse])
@router.put("/suppliers/{supplier_id}/representatives", response_model=list[RepresentativeResponse])
async def assign_supplier_representatives(
    supplier_id: uuid.UUID,
    body: Union[list[uuid.UUID], SupplierRepresentativesPayload],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if isinstance(body, list):
        rep_ids = body
    elif isinstance(body, SupplierRepresentativesPayload):
        rep_ids = body.representative_ids
    else:
        rep_ids = []
    return await service.assign_supplier_representatives(db, supplier_id=supplier_id, representative_ids=rep_ids)


@router.delete("/suppliers/{supplier_id}/representatives/{rep_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_supplier_representative(
    supplier_id: uuid.UUID,
    rep_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    await service.remove_supplier_representative(db, supplier_id=supplier_id, representative_id=rep_id)


# ═══════════════════════════════════════════════════════════════
#  SECCIONES DE PRODUCTOS
# ═══════════════════════════════════════════════════════════════

@router.get("/product-sections", response_model=list[ProductSectionResponse])
async def list_product_sections(
    company_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user, company_id)
    return await service.get_sections(db, company_id=cid)


@router.post("/product-sections", response_model=ProductSectionResponse, status_code=status.HTTP_201_CREATED)
async def create_product_section(
    body: ProductSectionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = body.company_id or _get_company_uuid(user)
    return await service.create_section(db, company_id=cid, data=body)


@router.put("/product-sections/{id}", response_model=ProductSectionResponse)
@router.patch("/product-sections/{id}", response_model=ProductSectionResponse)
async def update_product_section(
    id: uuid.UUID,
    body: ProductSectionUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user)
    return await service.update_section(db, section_id=id, company_id=cid, data=body)


@router.delete("/product-sections/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_section(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user)
    await service.delete_section(db, section_id=id, company_id=cid)


# ═══════════════════════════════════════════════════════════════
#  MARCAS DE PRODUCTOS
# ═══════════════════════════════════════════════════════════════

@router.get("/product-brands", response_model=list[ProductBrandResponse])
async def list_product_brands(
    company_id: Optional[uuid.UUID] = Query(None),
    representative_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user, company_id)
    return await service.get_brands(db, company_id=cid, representative_id=representative_id)


@router.post("/product-brands", response_model=ProductBrandResponse, status_code=status.HTTP_201_CREATED)
async def create_product_brand(
    body: ProductBrandCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = body.company_id or _get_company_uuid(user)
    return await service.create_brand(db, company_id=cid, data=body)


@router.put("/product-brands/{id}", response_model=ProductBrandResponse)
@router.patch("/product-brands/{id}", response_model=ProductBrandResponse)
async def update_product_brand(
    id: uuid.UUID,
    body: ProductBrandUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user)
    return await service.update_brand(db, brand_id=id, company_id=cid, data=body)


@router.delete("/product-brands/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_brand(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_company_uuid(user)
    await service.delete_brand(db, brand_id=id, company_id=cid)


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


@router.get("/products/next-sku")
async def get_next_sku(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
):
    next_sku = await service.get_next_sku(db, company_id)
    return {"next_sku": next_sku}


@router.get("/products/check-barcode")
async def check_barcode(
    barcode: str = Query(...),
    exclude_product_id: str | None = Query(None),
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
):
    clean = barcode.strip()
    if not clean:
        return {"exists": False}
    existing = await service.get_product_by_barcode(db, company_id, clean)
    if existing and (not exclude_product_id or str(existing.id) != exclude_product_id):
        return {
            "exists": True,
            "product": {
                "id": str(existing.id),
                "sku": existing.sku,
                "nombre": existing.nombre,
                "activo": bool(existing.activo),
            }
        }
    return {"exists": False}


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductCreate, db: AsyncSession = Depends(get_db)):
    if body.sku and body.sku.strip().upper() not in ("", "AUTO"):
        existing = await service.get_product_by_sku(db, str(body.company_id), body.sku)
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un producto con ese SKU")

    if body.codigo_barra and body.codigo_barra.strip():
        clean_bc = body.codigo_barra.strip()
        existing_bc = await service.get_product_by_barcode(db, str(body.company_id), clean_bc)
        if existing_bc:
            estado_txt = "Activo" if existing_bc.activo else "Inactivo"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un producto con el código de barras '{clean_bc}': SKU {existing_bc.sku} - \"{existing_bc.nombre}\" ({estado_txt}). No está permitido crear productos con códigos de barra duplicados."
            )

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
    updated_since: datetime | None = Query(None),
    solo_promociones: bool = Query(False),
    limit: int | None = Query(None, ge=1),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    products = await service.list_products(
        db, company_id, categoria_id, search, activo, limit, offset,
        supplier_id=supplier_id, tipo_producto=tipo_producto, include_inactive=include_inactive,
        updated_since=updated_since, solo_promociones=solo_promociones,
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
    updated_since: datetime | None = Query(None),
    solo_promociones: bool = Query(False),
    limit: int | None = Query(None, ge=1),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    products = await service.list_products(
        db, company_id, categoria_id, search, activo, limit, offset,
        supplier_id=supplier_id, tipo_producto=tipo_producto, include_inactive=include_inactive,
        updated_since=updated_since, solo_promociones=solo_promociones,
    )
    await annotate_products_with_promos(db, company_id, products)
    return products


@router.get("/companies/{company_id}/products/paginated", response_model=PaginatedProductResponse)
async def list_products_paginated(
    company_id: str,
    categoria_id: str | None = Query(None),
    supplier_id: str | None = Query(None),
    search: str | None = Query(None),
    activo: bool | None = Query(None),
    tipo_producto: str | None = Query(None),
    include_inactive: bool = Query(False),
    updated_since: datetime | None = Query(None),
    solo_promociones: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    result = await service.list_products_paginated(
        db, company_id, categoria_id, search, activo, limit, offset,
        supplier_id=supplier_id, tipo_producto=tipo_producto, include_inactive=include_inactive,
        updated_since=updated_since, solo_promociones=solo_promociones,
    )
    await annotate_products_with_promos(db, company_id, result["items"])
    return result


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


async def validate_can_inactivate_product(db: AsyncSession, product_id: str, user: dict) -> None:
    """Valida que la inactivación de un producto cumpla con las reglas estrictas de negocio:
    1. Atribución exclusiva de Administración y Gerencia.
    2. En ningún caso se puede inactivar un producto con stock (positivo o negativo).
    """
    user_rol = (user.get("rol") or "").lower()
    is_admin_or_gerencia = bool(
        user.get("is_superadmin") or
        user_rol in ("admin", "administrador", "gerente", "gerencia", "administracion")
    )
    if not is_admin_or_gerencia:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactivar un producto es de exclusiva atribución de Administración y Gerencia."
        )

    try:
        p_uuid = uuid.UUID(str(product_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID de producto inválido")

    # Verificar stock en depósitos (ni positivo ni negativo)
    stock_check = await db.execute(
        text("""
            SELECT COALESCE(SUM(cantidad), 0) AS total_stock,
                   COALESCE(SUM(ABS(cantidad)), 0) AS abs_stock
            FROM stock
            WHERE product_id = :p_id
        """),
        {"p_id": p_uuid}
    )
    stock_row = stock_check.first()
    total_stock = int(stock_row.total_stock) if stock_row and stock_row.total_stock is not None else 0
    abs_stock = int(stock_row.abs_stock) if stock_row and stock_row.abs_stock is not None else 0

    if abs_stock != 0 or total_stock != 0:
        sign_str = f"+{total_stock}" if total_stock > 0 else str(total_stock)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede inactivar un producto con stock pendiente ({sign_str} unidades). En ningún caso se permite inactivar productos con stock positivo o negativo; el inventario debe estar en cero."
        )


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    body: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    dump = body.model_dump(exclude_unset=True)
    is_admin = bool(
        user.get("is_superadmin") or
        (user.get("rol") or "").lower() in ("admin", "administrador", "gerente", "gerencia", "administracion")
    )
    user_id = uuid.UUID(str(user["id"]))
    tenant_id = uuid.UUID(str(user.get("tenant_id") or "00000000-0000-0000-0000-000000000001"))

    # Validación de inactivación de producto
    if "activo" in dump and dump["activo"] is False:
        await validate_can_inactivate_product(db, product_id, user)

    # Validación de permiso para modificar precios de costo
    cost_fields = {"costo_promedio", "ultimo_costo", "costo_landed"}
    if any(k in dump for k in cost_fields):
        if not is_admin:
            from api.src.rbac import service as rbac_service
            has_cost_perm = await rbac_service.check_permission(db, user_id, tenant_id, "products:edit_cost")
            if not has_cost_perm:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tenés permiso para modificar precios de costo (products:edit_cost)"
                )

    # Validación de permiso para modificar precios de venta
    if "precio_venta" in dump:
        if not is_admin:
            from api.src.rbac import service as rbac_service
            has_price_perm = await rbac_service.check_permission(db, user_id, tenant_id, "products:edit_price")
            if not has_price_perm:
                has_update = await rbac_service.check_permission(db, user_id, tenant_id, "products:update")
                if not has_update:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="No tenés permiso para modificar precios de venta (products:edit_price)"
                    )

    product = await service.update_product(db, product_id, body)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if "precio_venta" in dump:
        try:
            from api.src.integrations.scales import service as scales_service
            await scales_service.auto_sync_product(db, product.company_id, product)
        except Exception as e:
            logger.warning("Auto PLU sync failed for product %s: %s", product_id, e)
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    await validate_can_inactivate_product(db, product_id, user)
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


# ── Asignación de Proveedores (Herramienta & API) ───────────────────────────

@router.post("/products/assign-supplier")
async def assign_supplier_endpoint(
    body: AssignSupplierRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Asigna o desvincula un proveedor a un producto."""
    return await service.assign_product_supplier(db, body.product_id, body.supplier_id)


@router.post("/products/assign-supplier-batch")
async def assign_supplier_batch_endpoint(
    body: AssignSupplierBatchRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Asigna proveedores a múltiples productos en lote."""
    return await service.assign_product_supplier_batch(db, [a.model_dump() for a in body.assignments])


@router.get("/products/unassigned-suppliers")
async def get_unassigned_suppliers_endpoint(
    company_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Retorna productos sin proveedor asignado, lista de proveedores y sugerencias."""
    cid = company_id or str(_get_company_uuid(user))
    return await service.get_unassigned_supplier_catalog(db, cid)


# Subrouter sin dependencia forzosa para uso interno / reportes interactivos HTML
tool_router = APIRouter(prefix="/api/v1/products-tool", tags=["products-tool"])


@tool_router.get("/unassigned")
async def tool_get_unassigned(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene catálogo de productos sin proveedor para el gestor interactivo."""
    return await service.get_unassigned_supplier_catalog(db, company_id)


@tool_router.post("/assign")
async def tool_assign_supplier(
    body: AssignSupplierRequest,
    db: AsyncSession = Depends(get_db),
):
    """Asigna proveedor desde la herramienta HTML."""
    return await service.assign_product_supplier(db, body.product_id, body.supplier_id)


@tool_router.post("/assign-batch")
async def tool_assign_supplier_batch(
    body: AssignSupplierBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Asigna proveedores en lote desde la herramienta HTML."""
    return await service.assign_product_supplier_batch(db, [a.model_dump() for a in body.assignments])


@router.post("/products/toggle-active")
async def toggle_active_endpoint(
    body: ToggleProductActiveRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Activa o inactiva un producto en la base de datos."""
    return await service.toggle_product_active(db, body.product_id, body.activo)


@tool_router.post("/toggle-active")
async def tool_toggle_active(
    body: ToggleProductActiveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Activa o inactiva un producto desde la herramienta HTML."""
    return await service.toggle_product_active(db, body.product_id, body.activo)


