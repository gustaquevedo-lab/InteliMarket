"""Conector Ñemuha — disparo manual de sync y consulta de historial"""

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.config import settings
from api.src.db import get_db
from api.src.nemuha_connector import service
from api.src.nemuha_connector.models import NemuhaSyncRun
from api.src.nemuha_connector.schemas import NemuhaSyncRunResponse, TriggerSyncRequest

router = APIRouter(prefix="/api/v1/nemuha-connector", tags=["nemuha-connector"])


def _require_intellizapp_key(x_api_key: str = Header(...)) -> None:
    if not settings.intellizapp_api_key or x_api_key != settings.intellizapp_api_key:
        raise HTTPException(status_code=401, detail="API key inválida")


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


@router.get("/ticket/{numero_ticket}", dependencies=[Depends(_require_intellizapp_key)])
async def get_ticket(numero_ticket: str):
    """Consulta puntual en vivo contra la base legacy — para IntelliZapp (segmentación de marketing)."""
    detail = await service.get_ticket_detail(numero_ticket)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Ticket {numero_ticket} no encontrado")
    return detail
