from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.schedule import service
from api.src.schedule.schemas import (
    ShiftTemplateCreate, ShiftPlanCreate, TimeClockEntryCreate,
    ShiftSwapCreate, ShiftCostConfigCreate,
)

router = APIRouter(
    prefix="/api/v1/schedule",
    tags=["schedule"],
    dependencies=[Depends(require_feature("schedule")), Depends(require_auth)],
)


# ── Shift Templates ──────────────────────────────────────────────

@router.post("/templates")
async def create_template(data: ShiftTemplateCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_template(db, user["company_id"], data)


@router.get("/templates")
async def list_templates(
    area: Optional[str] = Query(None), activo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_templates(db, user["company_id"], area, activo)


@router.put("/templates/{template_id}")
async def update_template(template_id: str, data: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.update_template(db, user["company_id"], template_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Template not found")
    return result


# ── Shift Plans ──────────────────────────────────────────────────

@router.post("/plans")
async def create_plan(data: ShiftPlanCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_plan(db, user["company_id"], data)


@router.get("/plans")
async def list_plans(
    area: Optional[str] = Query(None), fecha: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None), status: Optional[str] = Query(None),
    limit: int = Query(100), offset: int = Query(0),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_plans(db, user["company_id"], area, fecha, employee_id, status, limit, offset)


@router.patch("/plans/{plan_id}/status")
async def update_plan_status(plan_id: str, data: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.update_plan_status(db, user["company_id"], plan_id, data.get("status", ""))
    if not result:
        raise HTTPException(status_code=404, detail="Plan not found")
    return result


@router.post("/plans/generate-weekly")
async def generate_weekly(data: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.generate_weekly_plan(db, user["company_id"], data.get("start_date", ""))


# ── Time Clock ───────────────────────────────────────────────────

@router.post("/clock")
async def clock_in_out(employee_id: str = Body(...), data: TimeClockEntryCreate = Body(...), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.clock_in_out(db, user["company_id"], employee_id, data)


@router.get("/clock/today/{employee_id}")
async def get_today_entries(employee_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_today_entries(db, user["company_id"], employee_id)


# ── Shift Swaps ──────────────────────────────────────────────────

@router.post("/swaps")
async def request_swap(data: ShiftSwapCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.request_swap(db, user["company_id"], user["id"], data)


@router.get("/swaps")
async def list_swaps(status: Optional[str] = Query(None), limit: int = Query(50), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_swaps(db, user["company_id"], status, limit)


@router.post("/swaps/{swap_id}/approve")
async def approve_swap(swap_id: str, data: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.approve_swap(db, user["company_id"], swap_id, data.get("approved_by", user["id"]))
    if not result:
        raise HTTPException(status_code=404, detail="Swap not found")
    return result


# ── Cost Config ──────────────────────────────────────────────────

@router.get("/cost-configs")
async def get_cost_configs(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_or_init_cost_configs(db, user["company_id"])


@router.put("/cost-configs/{config_id}")
async def update_cost_config(config_id: str, data: ShiftCostConfigCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.update_cost_config(db, user["company_id"], config_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Config not found")
    return result


# ── Dashboard ────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    fecha_desde: str = Query(...), fecha_hasta: str = Query(...),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"], fecha_desde, fecha_hasta)


@router.get("/hours-summary")
async def get_hours_summary(
    fecha_desde: str = Query(...), fecha_hasta: str = Query(...),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.compute_hours_summary(db, user["company_id"], fecha_desde, fecha_hasta)
