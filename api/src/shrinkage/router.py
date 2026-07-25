from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.shrinkage import service
from api.src.shrinkage.schemas import ComputeShrinkageRequest, ResolveAlertRequest

router = APIRouter(
    prefix="/api/v1/shrinkage",
    tags=["shrinkage"],
    dependencies=[Depends(require_feature("shrinkage")), Depends(require_auth)],
)


# ── Compute ──────────────────────────────────────────────────────

@router.post("/compute")
async def compute_shrinkage(data: ComputeShrinkageRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.compute_shrinkage(db, user["company_id"], data.fecha, data.categories)


# ── Records ──────────────────────────────────────────────────────

@router.get("/records")
async def list_records(
    fecha_desde: str = Query(...), fecha_hasta: str = Query(...),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_records(db, user["company_id"], fecha_desde, fecha_hasta, category)


# ── Alerts ───────────────────────────────────────────────────────

@router.get("/alerts")
async def list_alerts(
    category: Optional[str] = Query(None), is_resolved: Optional[bool] = Query(None),
    min_severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_alerts(db, user["company_id"], category, is_resolved, min_severity)


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, data: ResolveAlertRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.resolve_alert(db, user["company_id"], alert_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result


# ── Recommendations ──────────────────────────────────────────────

@router.get("/recommendations")
async def list_recommendations(
    category: Optional[str] = Query(None), is_applied: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_recommendations(db, user["company_id"], category, is_applied)


@router.post("/recommendations/{rec_id}/apply")
async def apply_recommendation(rec_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.apply_recommendation(db, user["company_id"], rec_id)
    if not result:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return result


# ── Dashboard ────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    fecha: str = Query(...),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"], fecha)
