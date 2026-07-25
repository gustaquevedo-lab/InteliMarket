from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.promotions import service
from api.src.promotions.schemas import (
    PromotionCreate, PromotionUpdate, PromotionResponse,
    ValidateCartInput, CalculatePromoResponse,
)

router = APIRouter(
    prefix="/api/v1/promotions",
    tags=["promotions"],
)


@router.get("", response_model=list[PromotionResponse])
async def list_promotions(
    activo: Optional[bool] = Query(None),
    tipo: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_promotions(db, user["company_id"], activo, tipo)


@router.get("/{promo_id}", response_model=PromotionResponse)
async def get_promotion(
    promo_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_promotion(db, promo_id)
    if not result:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    return result


@router.post("", response_model=PromotionResponse, status_code=status.HTTP_201_CREATED)
async def create_promotion(
    data: PromotionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_promotion(db, user["company_id"], data)


@router.put("/{promo_id}", response_model=PromotionResponse)
async def update_promotion(
    promo_id: str,
    data: PromotionUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_promotion(db, promo_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    return result


@router.delete("/{promo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promotion(
    promo_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_promotion(db, promo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")


@router.post("/calculate", response_model=CalculatePromoResponse)
async def calculate_promotions(
    data: ValidateCartInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.calculate_applicable(db, user["company_id"], data)


@router.get("/{promo_id}/usage", response_model=list[dict])
async def list_promotion_usage(
    promo_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_usage(db, user["company_id"], promo_id, limit, offset)
