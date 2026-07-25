"""Conector Ñemuha — disparo manual de sync y consulta de historial"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.nemuha_connector import service
from api.src.nemuha_connector.models import NemuhaSyncRun
from api.src.nemuha_connector.schemas import NemuhaSyncRunResponse, TriggerSyncRequest

router = APIRouter(prefix="/api/v1/nemuha-connector", tags=["nemuha-connector"])


@router.post("/sync", response_model=NemuhaSyncRunResponse)
async def trigger_sync(body: TriggerSyncRequest, db: AsyncSession = Depends(get_db)):
    run = await service.run_sync(db, str(body.company_id), body.since)
    return run


@router.get("/runs", response_model=list[NemuhaSyncRunResponse])
async def list_runs(company_id: str = Query(), limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NemuhaSyncRun)
        .where(NemuhaSyncRun.company_id == company_id)
        .order_by(NemuhaSyncRun.started_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
