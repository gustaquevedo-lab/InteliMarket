from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.productividad import service
from api.src.productividad.schemas import (
    ProductivityRecordCreate, ProductivityTargetCreate,
    ComputeEfficiencyRequest, ComputeAllEfficiencyRequest,
)

router = APIRouter(
    prefix="/api/v1/productividad",
    tags=["productividad"],
    dependencies=[Depends(require_feature("productividad")), Depends(require_auth)],
)


# ── Productivity Records ─────────────────────────────────────────

@router.post("/records")
async def create_record(data: ProductivityRecordCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_record(db, user["company_id"], data)


@router.get("/records")
async def list_records(
    area: Optional[str] = Query(None), employee_id: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None), fecha_hasta: Optional[str] = Query(None),
    limit: int = Query(100), offset: int = Query(0),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_records(db, user["company_id"], area, employee_id, fecha_desde, fecha_hasta, limit, offset)


# ── Targets ──────────────────────────────────────────────────────

@router.post("/targets")
async def set_target(data: ProductivityTargetCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.set_target(db, user["company_id"], data)


@router.get("/targets")
async def list_targets(area: Optional[str] = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_targets(db, user["company_id"], area)


# ── Efficiency Computation ───────────────────────────────────────

@router.post("/efficiency/compute")
async def compute_efficiency(data: ComputeEfficiencyRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.compute_employee_efficiency(db, user["company_id"], data.employee_id, data.fecha_desde, data.fecha_hasta)
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/efficiency/compute-all")
async def compute_all_efficiencies(data: ComputeAllEfficiencyRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.compute_all_efficiencies(db, user["company_id"], data.fecha_desde, data.fecha_hasta)


@router.get("/efficiency/ranking")
async def get_ranking(
    area: Optional[str] = Query(None), limit: int = Query(20),
    order_by: str = Query("efficiency_pct"),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.get_ranking(db, user["company_id"], area, limit, order_by)


# ── Area Metrics ─────────────────────────────────────────────────

@router.get("/area-metrics")
async def get_area_metrics(
    fecha_desde: str = Query(...), fecha_hasta: str = Query(...),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.get_area_metrics(db, user["company_id"], fecha_desde, fecha_hasta)


@router.get("/weekly-trends")
async def get_weekly_trends(
    weeks: int = Query(8),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.get_weekly_trends(db, user["company_id"], weeks)


# ── Dashboard ────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    fecha_desde: str = Query(...), fecha_hasta: str = Query(...),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"], fecha_desde, fecha_hasta)
