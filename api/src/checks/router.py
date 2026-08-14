"""Checks/pagares router"""

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.checks import service
from api.src.checks.schemas import (
    CheckCreate, CheckResponse, CheckChangeStatus, CheckReplace, CheckEventResponse,
)

router = APIRouter(prefix="/api/v1/checks", tags=["checks"])


@router.post("", response_model=CheckResponse)
async def create_check(
    data: CheckCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    data.company_id = user["company_id"]
    return await service.create_check(db, data)


@router.get("", response_model=list[CheckResponse])
async def list_checks(
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    tipo: str | None = Query(None),
    search: str | None = Query(None),
    vigente_only: bool = Query(False),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_checks(
        db, user["company_id"], customer_id, estado, tipo, search, vigente_only, fecha_desde, fecha_hasta, limit=limit, offset=offset
    )


@router.get("/summary")
async def get_summary(
    vigente_only: bool = Query(False),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_checks_summary(db, user["company_id"], vigente_only, fecha_desde, fecha_hasta)


@router.get("/cartera")
async def get_cartera(
    dias: int = Query(30, le=180),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_cartera(db, user["company_id"], dias=dias)


@router.get("/{check_id}", response_model=CheckResponse)
async def get_check(check_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    check = await service.get_check(db, check_id)
    if not check:
        raise HTTPException(status_code=404, detail="Cheque/pagare no encontrado")
    return check


@router.get("/{check_id}/events", response_model=list[CheckEventResponse])
async def get_events(check_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_events(db, check_id)


@router.post("/{check_id}/status", response_model=CheckResponse)
async def change_status(
    check_id: str, data: CheckChangeStatus, db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    result = await service.change_check_status(db, check_id, data)
    if not result:
        raise HTTPException(status_code=400, detail="Transicion de estado invalida")
    return result


@router.post("/{check_id}/replace", response_model=CheckResponse)
async def replace_check(
    check_id: str, data: CheckReplace, db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    result = await service.replace_check(db, check_id, data)
    if not result:
        raise HTTPException(status_code=400, detail="Solo se puede reemplazar un cheque/pagare rechazado")
    return result
