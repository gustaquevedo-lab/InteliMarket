from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.comerciales import service
from api.src.comerciales.schemas import OpportunityUpdate

router = APIRouter(
    prefix="/api/v1/comerciales",
    tags=["comerciales"],
    dependencies=[Depends(require_feature("comerciales")), Depends(require_auth)],
)


@router.post("/detect-all")
async def detect_all(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.detect_all(db, user["company_id"])


@router.post("/detect-churn")
async def detect_churn(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.detect_churn(db, user["company_id"])


@router.post("/detect-dormant")
async def detect_dormant(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.detect_dormant_products(db, user["company_id"])


@router.post("/detect-cross-sell")
async def detect_cross_sell(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.generate_cross_sell_opportunities(db, user["company_id"])


@router.post("/detect-credit-potential")
async def detect_credit_potential(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.detect_credit_potential(db, user["company_id"])


@router.post("/detect-up-sell")
async def detect_up_sell(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.detect_up_sell_opportunities(db, user["company_id"])


@router.get("/opportunities")
async def list_opportunities(
    opportunity_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_opportunities(db, user["company_id"], opportunity_type, status, priority, limit, offset)


@router.patch("/opportunities/{opp_id}")
async def update_opportunity(
    opp_id: str,
    data: OpportunityUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_opportunity(db, user["company_id"], opp_id, data.status)
    if not result:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return result


@router.get("/affinity")
async def get_affinity(
    product_id: str = Query(...),
    limit: int = Query(10),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_product_affinity(db, user["company_id"], product_id, limit)


@router.post("/affinity/compute")
async def compute_affinity(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.compute_affinity(db, user["company_id"])


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])
