"""Caja (Cash Register) API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.caja.schemas import (
    CashRegisterCreate, CashRegisterUpdate, CashRegisterResponse,
    CashSessionCreate, CashSessionClose, CashSessionResponse,
)
from api.src.caja import service

router = APIRouter(prefix="/api/v1", tags=["caja"])


@router.get("/cash-registers", response_model=list[CashRegisterResponse])
async def list_registers(
    branch_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_registers(db, branch_id)


@router.get("/cash-registers/{register_id}", response_model=CashRegisterResponse)
async def get_register(register_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_register(db, register_id)
    if not result:
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    return result


@router.post("/cash-registers", response_model=CashRegisterResponse, status_code=status.HTTP_201_CREATED)
async def create_register(body: CashRegisterCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_register(db, body.model_dump())


@router.put("/cash-registers/{register_id}", response_model=CashRegisterResponse)
async def update_register(register_id: str, body: CashRegisterUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_register(db, register_id, body.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    return result


@router.delete("/cash-registers/{register_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_register(register_id: str, db: AsyncSession = Depends(get_db)):
    ok = await service.delete_register(db, register_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Caja no encontrada")


@router.get("/cash-registers/{register_id}/open-session")
async def get_open_session(register_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_open_session(db, register_id)
    return result


@router.get("/cash-sessions")
async def list_sessions(
    register_id: str | None = Query(None),
    user_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_sessions(db, register_id, user_id, estado, limit=limit, offset=offset)


@router.get("/cash-sessions/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_session_with_summary(db, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Sesi\u00f3n no encontrada")
    return result


@router.post("/cash-sessions", response_model=CashSessionResponse, status_code=status.HTTP_201_CREATED)
async def open_session(body: CashSessionCreate, db: AsyncSession = Depends(get_db)):
    try:
        return await service.open_session(db, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cash-sessions/{session_id}/close")
async def close_session(session_id: str, body: CashSessionClose, db: AsyncSession = Depends(get_db)):
    result = await service.close_session(db, session_id, body.monto_cierre_real, body.observaciones)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo cerrar la sesi\u00f3n")
    return result


@router.get("/cash-register-movements")
async def list_register_movements(company_id: str = Query(), tipo: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.list_register_movements(db, company_id, tipo)
