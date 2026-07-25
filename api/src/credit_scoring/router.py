from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.credit_scoring import service
from api.src.credit_scoring.schemas import (
    EvaluateCustomerRequest, UpdateLimitRequest,
    BlockCustomerRequest, UnblockCustomerRequest,
)

router = APIRouter(
    prefix="/api/v1/credit-scoring",
    tags=["credit-scoring"],
    dependencies=[Depends(require_feature("credit_scoring")), Depends(require_auth)],
)


@router.post("/evaluate/{customer_id}")
async def evaluate_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.evaluate_customer(db, user["company_id"], customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")
    return result


@router.post("/evaluate-bulk")
async def bulk_evaluate(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.bulk_evaluate(db, user["company_id"])


@router.get("/scores/{customer_id}")
async def get_credit_score(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_credit_score(db, user["company_id"], customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Credit score not found for customer")
    return result


@router.get("/scores")
async def list_credit_scores(
    risk_level: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_credit_scores(db, user["company_id"], risk_level, status, limit, offset)


@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_summary(db, user["company_id"])


@router.get("/alerts")
async def get_alerts(
    alert_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_alerts(db, user["company_id"], alert_type, severity, limit, offset)


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.resolve_alert(db, user["company_id"], alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result


@router.post("/alerts/resolve-bulk")
async def bulk_resolve_alerts(
    alert_ids: list[str],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.bulk_resolve_alerts(db, user["company_id"], alert_ids)


@router.patch("/limit")
async def update_credit_limit(
    data: UpdateLimitRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_credit_limit(db, user["company_id"], data, user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Customer credit score not found")
    return result


@router.post("/block")
async def block_customer(
    data: BlockCustomerRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.block_customer(db, user["company_id"], str(data.customer_id), data.reason, user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Customer credit score not found")
    return result


@router.post("/unblock")
async def unblock_customer(
    data: UnblockCustomerRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.unblock_customer(db, user["company_id"], str(data.customer_id), data.reason, user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Customer credit score not found")
    return result


@router.get("/events")
async def get_events(
    customer_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_events(db, user["company_id"], customer_id, event_type, limit, offset)


@router.get("/dashboard")
async def get_portfolio_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_portfolio_dashboard(db, user["company_id"])
