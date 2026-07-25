"""Mobile router — mobile companion API"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.mobile import service
from api.src.mobile.schemas import (
    InventoryCountInput, InventoryCountResult,
    ReceiveRemitInput, ReceiveRemitResult,
    ApproveSuggestionInput, MobileDashboard,
)

router = APIRouter(prefix="/api/v1/mobile", tags=["mobile"])


@router.get("/dashboard", response_model=MobileDashboard)
async def dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_mobile_dashboard(db, user["company_id"])


@router.post("/inventory-count", response_model=InventoryCountResult)
async def inventory_count(
    data: InventoryCountInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.count_inventory(db, user["company_id"], data.model_dump(), user["id"])
    return InventoryCountResult(**result)


@router.post("/receive-remit", response_model=ReceiveRemitResult)
async def receive_remit(
    data: ReceiveRemitInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.receive_remit(db, user["company_id"], data.model_dump(), user["id"])
    if result["errores"] and result["procesados"] == 0:
        raise HTTPException(status_code=400, detail=result["errores"])
    return ReceiveRemitResult(**result)


@router.post("/approve-suggestions")
async def approve_suggestions(
    data: ApproveSuggestionInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.approve_suggestions(db, user["company_id"], data.model_dump())

