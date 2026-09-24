"""Fixed Assets (Activos Fijos) API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.fixed_assets.schemas import FixedAssetCreate, FixedAssetRetire, FixedAssetResponse
from api.src.fixed_assets import service

router = APIRouter(prefix="/api/v1/fixed-assets", tags=["fixed-assets"], dependencies=[Depends(require_auth)])


@router.post("", response_model=FixedAssetResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(body: FixedAssetCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_asset(db, user["company_id"], body)


@router.get("", response_model=list[FixedAssetResponse])
async def list_assets(estado: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_assets(db, user["company_id"], estado)


@router.get("/{asset_id}", response_model=FixedAssetResponse)
async def get_asset(asset_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.get_asset(db, user["company_id"], asset_id)
    if not result:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    return result


@router.post("/{asset_id}/retire", response_model=FixedAssetResponse)
async def retire_asset(asset_id: str, body: FixedAssetRetire, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.retire_asset(db, user["company_id"], asset_id, body.motivo, body.fecha_baja)
    if not result:
        raise HTTPException(status_code=400, detail="Activo no encontrado o ya dado de baja")
    return result


@router.post("/post-depreciation")
async def post_monthly_depreciation(periodo: str = Query(..., description="YYYY-MM"), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.post_monthly_depreciation(db, user["company_id"], periodo, user.get("id"))
