from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.delivery_integrations import service
from api.src.delivery_integrations.schemas import (
    IntegrationConfigCreate, IntegrationConfigUpdate, IntegrationConfigResponse,
    DeliveryOrderResponse, DeliveryOrderStatusUpdate,
    MenuSyncResponse, PlatformLogResponse, DashboardResponse, WebhookPayload,
)

router = APIRouter(
    prefix="/api/v1/delivery-integrations",
    tags=["delivery-integrations"],
    dependencies=[Depends(require_feature("delivery_integrations")), Depends(require_auth)],
)


# ========== INTEGRATION CONFIG ==========

@router.get("/config", response_model=list[IntegrationConfigResponse])
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_integrations(db, user["company_id"])


@router.get("/config/{platform}", response_model=IntegrationConfigResponse)
async def get_integration(
    platform: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_integration(db, user["company_id"], platform)
    if not result:
        raise HTTPException(status_code=404, detail="Integration not found")
    return result


@router.put("/config/{platform}", response_model=IntegrationConfigResponse)
async def upsert_integration(
    platform: str,
    data: IntegrationConfigCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.upsert_integration(db, user["company_id"], platform, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/config/{platform}", response_model=IntegrationConfigResponse)
async def update_integration(
    platform: str,
    data: IntegrationConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_integration(db, user["company_id"], platform, data)
    if not result:
        raise HTTPException(status_code=404, detail="Integration not found")
    return result


# ========== ORDERS ==========

@router.get("/orders", response_model=list[DeliveryOrderResponse])
async def list_orders(
    platform: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_orders(db, user["company_id"], platform, status, limit, offset)


@router.get("/orders/{order_id}", response_model=DeliveryOrderResponse)
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_order(db, user["company_id"], order_id)
    if not result:
        raise HTTPException(status_code=404, detail="Order not found")
    return result


@router.patch("/orders/{order_id}/status", response_model=DeliveryOrderResponse)
async def update_order_status(
    order_id: str,
    data: DeliveryOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        result = await service.update_order_status(db, user["company_id"], order_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Order not found")
    return result


# ========== WEBHOOK ==========

@router.post("/webhook/{platform}")
async def receive_webhook(
    platform: str,
    payload: WebhookPayload,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.process_webhook(db, user["company_id"], platform, payload.event, payload.data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== MENU SYNC ==========

@router.post("/sync-menu/{platform}", response_model=MenuSyncResponse)
async def trigger_menu_sync(
    platform: str,
    sync_type: str = Query("full"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.trigger_menu_sync(db, user["company_id"], platform, sync_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/menu-syncs", response_model=list[MenuSyncResponse])
async def list_menu_syncs(
    platform: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_menu_syncs(db, user["company_id"], platform, limit)


# ========== LOGS ==========

@router.get("/logs", response_model=list[PlatformLogResponse])
async def list_logs(
    platform: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_logs(db, user["company_id"], platform, event_type, limit, offset)


# ========== DASHBOARD ==========

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])
