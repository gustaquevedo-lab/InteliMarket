"""Cumplimiento de indicadores por proveedor (ej. PARESA) y rebate asociado."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.supplier_kpis import service
from api.src.supplier_kpis.schemas import (
    PeriodCreate, PeriodUpdate, PeriodResponse, PeriodSummary,
    IndicatorCreate, IndicatorUpdate, IndicatorResponse,
)

router = APIRouter(prefix="/api/v1/supplier-kpis", tags=["supplier-kpis"])


@router.post("/periods", response_model=PeriodResponse)
async def create_period(data: PeriodCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_period(db, uuid.UUID(user["company_id"]), data)


@router.get("/periods", response_model=list[PeriodResponse])
async def list_periods(
    supplier_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_periods(db, uuid.UUID(user["company_id"]), supplier_id)


@router.get("/periods/{period_id}/summary", response_model=PeriodSummary)
async def get_period_summary(period_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    period = await service.get_period(db, period_id)
    if not period or str(period.company_id) != user["company_id"]:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    return await service.get_summary(db, period)


@router.patch("/periods/{period_id}", response_model=PeriodResponse)
async def update_period(period_id: uuid.UUID, data: PeriodUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    period = await service.get_period(db, period_id)
    if not period or str(period.company_id) != user["company_id"]:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    return await service.update_period(db, period, data)


@router.post("/periods/{period_id}/indicators", response_model=IndicatorResponse)
async def add_indicator(period_id: uuid.UUID, data: IndicatorCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    period = await service.get_period(db, period_id)
    if not period or str(period.company_id) != user["company_id"]:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    return await service.add_indicator(db, period_id, data)


@router.get("/periods/{period_id}/indicators", response_model=list[IndicatorResponse])
async def list_indicators(period_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    period = await service.get_period(db, period_id)
    if not period or str(period.company_id) != user["company_id"]:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    return await service.list_indicators(db, period_id)


@router.patch("/indicators/{indicator_id}", response_model=IndicatorResponse)
async def update_indicator(indicator_id: uuid.UUID, data: IndicatorUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    indicator = await service.get_indicator(db, indicator_id)
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    return await service.update_indicator(db, indicator, data)


@router.delete("/indicators/{indicator_id}")
async def delete_indicator(indicator_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    await service.delete_indicator(db, indicator_id)
    return {"ok": True}
