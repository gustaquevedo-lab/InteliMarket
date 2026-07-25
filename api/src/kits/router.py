"""Kit router"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.kits import service
from api.src.kits.schemas import KitCreate, KitUpdate, KitResponse, KitPriceResponse

router = APIRouter(prefix="/api/v1/kits", tags=["kits"])


@router.post("", response_model=KitResponse)
async def create_kit(
    data: KitCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_kit(db, data)


@router.get("", response_model=list[KitResponse])
async def list_kits(
    activo: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_kits(db, user["company_id"], activo=activo)


@router.get("/{kit_id}", response_model=KitResponse)
async def get_kit(
    kit_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    kit = await service.get_kit(db, kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")
    return kit


@router.put("/{kit_id}", response_model=KitResponse)
async def update_kit(
    kit_id: str,
    data: KitUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    kit = await service.update_kit(db, kit_id, data)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")
    return kit


@router.delete("/{kit_id}")
async def delete_kit(
    kit_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    success = await service.delete_kit(db, kit_id)
    if not success:
        raise HTTPException(status_code=404, detail="Kit not found")
    return {"message": "Kit deleted"}


@router.get("/{kit_id}/price", response_model=KitPriceResponse)
async def calculate_kit_price(
    kit_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.calculate_kit_price(db, kit_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
