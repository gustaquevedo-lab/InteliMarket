from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.customer360 import service
from api.src.customer360.schemas import (
    Customer360DashboardResponse,
)

router = APIRouter(
    prefix="/api/v1/customer360",
    tags=["customer360"],
    dependencies=[Depends(require_feature("customer360")), Depends(require_auth)],
)


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])


@router.post("/basket/compute/{customer_id}")
async def compute_basket(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.compute_basket_analysis(db, user["company_id"], customer_id)


@router.get("/basket/{customer_id}")
async def get_basket(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_basket_analysis(db, user["company_id"], customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Basket analysis not found — run compute first")
    return result


@router.post("/penetration/compute/{customer_id}")
async def compute_penetration(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.compute_penetration(db, user["company_id"], customer_id)


@router.get("/penetration/{customer_id}")
async def get_penetration(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_penetration(db, user["company_id"], customer_id)


@router.post("/churn/predict/{customer_id}")
async def predict_churn(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.predict_churn(db, user["company_id"], customer_id)


@router.get("/churn/{customer_id}")
async def get_churn(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_churn_prediction(db, user["company_id"], customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Churn prediction not found — run predict first")
    return result


@router.get("/churn/high-risk")
async def list_high_risk(
    min_score: float = Query(50),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_high_risk_churn(db, user["company_id"], min_score, limit)


@router.post("/lifecycle/compute/{customer_id}")
async def compute_lifecycle(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.compute_lifecycle(db, user["company_id"], customer_id)


@router.get("/lifecycle/{customer_id}")
async def get_lifecycle(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_lifecycle(db, user["company_id"], customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Lifecycle not found — run compute first")
    return result


@router.get("/recovery")
async def list_recovery(
    status: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_recovery_campaigns(db, user["company_id"], status, limit)


@router.post("/recovery/{campaign_id}/notify")
async def notify_recovery(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.notify_recovery(db, user["company_id"], campaign_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/recovery/{campaign_id}/redeem")
async def redeem_recovery(
    campaign_id: str,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.redeem_recovery(
            db, user["company_id"], campaign_id,
            data.get("sale_id", ""), data.get("amount", 0),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/bulk-compute")
async def bulk_compute(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.customers.models import Partner
    from sqlalchemy import select

    r = await db.execute(select(Partner).where(Partner.company_id == user["company_id"]))
    customers = r.scalars().all()

    results = {"basket": 0, "penetration": 0, "churn": 0, "lifecycle": 0}
    for c in customers:
        cid = str(c.id)
        try:
            await service.compute_basket_analysis(db, user["company_id"], cid)
            results["basket"] += 1
        except: pass
        try:
            await service.compute_penetration(db, user["company_id"], cid)
            results["penetration"] += 1
        except: pass
        try:
            await service.predict_churn(db, user["company_id"], cid)
            results["churn"] += 1
        except: pass
        try:
            await service.compute_lifecycle(db, user["company_id"], cid)
            results["lifecycle"] += 1
        except: pass

    await db.flush()
    return results
