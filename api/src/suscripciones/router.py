from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.suscripciones import service
from api.src.suscripciones.schemas import (
    SubscriptionPlanCreate, SubscriptionPlanUpdate, SubscriptionPlanResponse,
    GeneratedOrderResponse, DashboardResponse,
)

router = APIRouter(
    prefix="/api/v1/suscripciones",
    tags=["suscripciones"],
    dependencies=[Depends(require_feature("suscripciones")), Depends(require_auth)],
)


# ========== PLANS ==========

@router.post("/plans", response_model=SubscriptionPlanResponse)
async def create_plan(
    data: SubscriptionPlanCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.create_plan(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/plans", response_model=list[SubscriptionPlanResponse])
async def list_plans(
    status: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_plans(db, user["company_id"], status, customer_id, limit, offset)


@router.get("/plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def get_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_plan(db, user["company_id"], plan_id)
    if not result:
        raise HTTPException(status_code=404, detail="Plan not found")
    return result


@router.put("/plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def update_plan(
    plan_id: str,
    data: SubscriptionPlanUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_plan(db, user["company_id"], plan_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Plan not found")
    return result


@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.delete_plan(db, user["company_id"], plan_id)
    if not result:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"status": "ok"}


# ========== PLAN ACTIONS ==========

@router.post("/plans/{plan_id}/skip", response_model=SubscriptionPlanResponse)
async def skip_next_generation(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.skip_next_generation(db, user["company_id"], plan_id)
    if not result:
        raise HTTPException(status_code=404, detail="Plan not found")
    return result


@router.post("/plans/{plan_id}/pause", response_model=SubscriptionPlanResponse)
async def pause_plan(
    plan_id: str,
    reason: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.pause_plan(db, user["company_id"], plan_id, reason)
    if not result:
        raise HTTPException(status_code=404, detail="Plan not found")
    return result


@router.post("/plans/{plan_id}/resume", response_model=SubscriptionPlanResponse)
async def resume_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.resume_plan(db, user["company_id"], plan_id)
    if not result:
        raise HTTPException(status_code=404, detail="Plan not found")
    return result


@router.post("/plans/{plan_id}/generate-order", response_model=GeneratedOrderResponse)
async def generate_order(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.generate_order_from_plan(db, user["company_id"], plan_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== GENERATED ORDERS ==========

@router.get("/generated-orders", response_model=list[GeneratedOrderResponse])
async def list_generated_orders(
    plan_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_generated_orders(db, user["company_id"], plan_id, status, limit, offset)


# ========== BULK GENERATION ==========

@router.post("/generate-due")
async def generate_all_due(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.generate_all_due(db, user["company_id"])


# ========== PRODUCTS REFERENCE ==========

@router.get("/available-products")
async def list_available_products():
    return service.AVAILABLE_PRODUCTS


# ========== DASHBOARD ==========

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])
