from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.forecast_avanzado import service
from api.src.forecast_avanzado.schemas import HolidayCreate, ExternalFactorCreate, CalibrateRequest, ForecastRequest

router = APIRouter(
    prefix="/api/v1/forecast-avanzado",
    tags=["forecast-avanzado"],
    dependencies=[Depends(require_feature("forecast_avanzado")), Depends(require_auth)],
)


# ── Calibrate ────────────────────────────────────────────────────

@router.post("/calibrate")
async def calibrate(data: CalibrateRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.calibrate_model(db, user["company_id"], data)


# ── Forecast ─────────────────────────────────────────────────────

@router.post("/forecast")
async def generate_forecast(data: ForecastRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.generate_forecast(
        db, user["company_id"], data.target_type, data.target_id,
        data.target_name, data.days, data.include_decomposition,
    )


# ── Holidays ─────────────────────────────────────────────────────

@router.get("/holidays")
async def list_holidays(
    year: Optional[int] = Query(None), category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    await service.ensure_holidays(db, user["company_id"])
    return await service.list_holidays(db, user["company_id"], year, category)


@router.post("/holidays")
async def create_holiday(data: HolidayCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_holiday(db, user["company_id"], data)


# ── External Factors ─────────────────────────────────────────────

@router.get("/factors")
async def list_factors(
    factor_type: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None), fecha_hasta: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_external_factors(db, user["company_id"], factor_type, fecha_desde, fecha_hasta)


@router.post("/factors")
async def create_factor(data: ExternalFactorCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_external_factor(db, user["company_id"], data)


# ── Configs ──────────────────────────────────────────────────────

@router.get("/configs")
async def list_configs(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_configs(db, user["company_id"])


# ── Dashboard ────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_dashboard(db, user["company_id"])
