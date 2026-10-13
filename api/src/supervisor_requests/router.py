from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.supervisor_requests.schemas import (
    SupervisorAuthRequestCreate, SupervisorAuthRequestResolve, SupervisorAuthRequestResponse,
)
from api.src.supervisor_requests import service

router = APIRouter(prefix="/api/v1/supervisor-requests", tags=["supervisor-requests"], dependencies=[Depends(require_auth)])


@router.post("", response_model=SupervisorAuthRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(body: SupervisorAuthRequestCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_request(db, body)


@router.get("", response_model=list[SupervisorAuthRequestResponse])
async def list_requests(
    company_id: str = Query(...),
    estado: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_requests(db, company_id, estado, limit)


@router.get("/{request_id}", response_model=SupervisorAuthRequestResponse)
async def get_request(request_id: str, db: AsyncSession = Depends(get_db)):
    req = await service.get_request(db, request_id)
    if not req:
        raise HTTPException(404, "Solicitud no encontrada")
    return req


@router.post("/{request_id}/resolve", response_model=SupervisorAuthRequestResponse)
async def resolve_request(request_id: str, body: SupervisorAuthRequestResolve, db: AsyncSession = Depends(get_db)):
    req = await service.resolve_request(db, request_id, body)
    if not req:
        raise HTTPException(400, "La solicitud ya fue resuelta o no existe")
    return req
