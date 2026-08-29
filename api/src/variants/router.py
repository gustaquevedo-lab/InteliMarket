"""Variant router"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.variants import service
from api.src.variants.schemas import VariantCreate, VariantUpdate, VariantResponse

router = APIRouter(prefix="/api/v1/variants", tags=["variants"])


@router.post("", response_model=VariantResponse)
async def create_variant(data: VariantCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_variant(db, data)


@router.get("", response_model=list[VariantResponse])
async def list_all_variants(limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_all_variants(db, limit=limit, offset=offset)


@router.get("/product/{product_id}", response_model=list[VariantResponse])
async def list_variants(product_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_variants(db, product_id)


@router.get("/{variant_id}", response_model=VariantResponse)
async def get_variant(variant_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    variant = await service.get_variant(db, variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    return variant


@router.patch("/{variant_id}", response_model=VariantResponse)
async def update_variant(variant_id: str, data: VariantUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    variant = await service.update_variant(db, variant_id, data)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    return variant


@router.delete("/{variant_id}")
async def delete_variant(variant_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    success = await service.delete_variant(db, variant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Variant not found")
    return {"message": "Variant deleted"}
