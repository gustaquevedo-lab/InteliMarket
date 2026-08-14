from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.returns.schemas import ReturnCreate, ReturnResponse, ReturnWithItems, ReturnApprove
from api.src.returns import service

router = APIRouter(prefix="/api/v1", tags=["returns"])


@router.post("/returns", response_model=ReturnResponse, status_code=status.HTTP_201_CREATED)
async def create_return(body: ReturnCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_return(db, body)


@router.get("/companies/{company_id}/returns", response_model=list[ReturnResponse])
async def list_returns(
    company_id: str,
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_returns(db, company_id, estado, limit=limit, offset=offset)


@router.get("/returns/motivos")
async def list_motivos():
    return service.RETURN_MOTIVOS


@router.get("/returns/{return_id}", response_model=ReturnWithItems)
async def get_return(return_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_return_with_items(db, return_id)
    if not result:
        raise HTTPException(status_code=404, detail="Devolución no encontrada")
    return result


@router.post("/returns/{return_id}/approve", response_model=ReturnResponse)
async def approve_return(return_id: str, body: ReturnApprove, db: AsyncSession = Depends(get_db)):
    result = await service.approve_return(db, return_id, body)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar la devolución")
    return result


@router.post("/returns/{return_id}/reject", response_model=ReturnResponse)
async def reject_return(
    return_id: str,
    motivo: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await service.reject_return(db, return_id, motivo)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo rechazar la devolución")
    return result
