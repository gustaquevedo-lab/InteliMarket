from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.pygdiario import service
from api.src.pygdiario.schemas import (
    DailyPnlCreate, ComputeDailyPnlRequest,
    PnlAdjustmentCreate, PnlBudgetCreate,
)

router = APIRouter(
    prefix="/api/v1/pyg-diario",
    tags=["pyg-diario"],
    dependencies=[Depends(require_feature("pyg_diario")), Depends(require_auth)],
)


# ── Compute ──────────────────────────────────────────────────────

@router.post("/compute")
async def compute_daily_pnl(data: ComputeDailyPnlRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.compute_daily_pnl(db, user["company_id"], data.fecha, data.departments)


# ── PnL Entries ──────────────────────────────────────────────────

@router.get("/entries")
async def list_pnl(
    fecha_desde: str = Query(...), fecha_hasta: str = Query(...),
    department: Optional[str] = Query(None), limit: int = Query(100),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_pnl(db, user["company_id"], fecha_desde, fecha_hasta, department, limit)


@router.post("/entries")
async def create_pnl_entry(data: DailyPnlCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_pnl_entry(db, user["company_id"], data)


# ── Adjustments ──────────────────────────────────────────────────

@router.post("/adjustments")
async def add_adjustment(data: PnlAdjustmentCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        return await service.add_adjustment(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/adjustments")
async def list_adjustments(
    pnl_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_adjustments(db, user["company_id"], pnl_id)


# ── Budgets ──────────────────────────────────────────────────────

@router.post("/budgets")
async def set_budget(data: PnlBudgetCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.set_budget(db, user["company_id"], data)


@router.get("/budgets")
async def list_budgets(
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_budgets(db, user["company_id"], department)


# ── Dashboard ────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    fecha: str = Query(...),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"], fecha)
