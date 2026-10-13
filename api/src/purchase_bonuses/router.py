import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.purchase_bonuses import service
from api.src.purchase_bonuses.schemas import BonusScaleCreate, BonusScaleUpdate, BonusScaleResponse, BonusSuggestion

router = APIRouter(prefix="/api/v1/purchase-bonus-scales", tags=["purchase-bonuses"])


@router.post("", response_model=BonusScaleResponse)
async def create_scale(data: BonusScaleCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_scale(db, user["company_id"], data)


@router.get("", response_model=list[BonusScaleResponse])
async def list_scales(
    supplier_id: uuid.UUID | None = Query(None),
    product_id: uuid.UUID | None = Query(None),
    activo: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_scales(
        db, user["company_id"],
        str(supplier_id) if supplier_id else None,
        str(product_id) if product_id else None,
        activo,
    )


@router.get("/suggest", response_model=BonusSuggestion)
async def suggest(
    supplier_id: uuid.UUID = Query(...),
    product_id: uuid.UUID = Query(...),
    cantidad: Decimal = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    scale_id, cantidad_bonificada = await service.suggest_bonus(
        db, user["company_id"], str(supplier_id), str(product_id), cantidad,
    )
    return BonusSuggestion(scale_id=scale_id, cantidad_bonificada_sugerida=cantidad_bonificada)


@router.patch("/{scale_id}", response_model=BonusScaleResponse)
async def update_scale(scale_id: uuid.UUID, data: BonusScaleUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    scale = await service.get_scale(db, str(scale_id))
    if not scale or str(scale.company_id) != user["company_id"]:
        raise HTTPException(status_code=404, detail="Escala no encontrada")
    return await service.update_scale(db, scale, data)


@router.delete("/{scale_id}")
async def delete_scale(scale_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    scale = await service.get_scale(db, str(scale_id))
    if not scale or str(scale.company_id) != user["company_id"]:
        raise HTTPException(status_code=404, detail="Escala no encontrada")
    await service.delete_scale(db, str(scale_id))
    return {"ok": True}
