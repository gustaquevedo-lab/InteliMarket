"""SIFEN API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.sifen.schemas import TimbradoCreate, TimbradoResponse, SifenResponseRecord, SifenSendRequest, CdcQueryResponse
from api.src.sifen import service

router = APIRouter(prefix="/api/v1/sifen", tags=["sifen"])


@router.post("/timbrados", response_model=TimbradoResponse, status_code=status.HTTP_201_CREATED)
async def create_timbrado(body: TimbradoCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_timbrado(db, body)


@router.get("/companies/{company_id}/timbrados", response_model=list[TimbradoResponse])
async def list_timbrados(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_timbrados(db, company_id)


@router.post("/send", response_model=dict)
async def send_to_sifen(body: SifenSendRequest, db: AsyncSession = Depends(get_db)):
    result = await service.send_sale_to_sifen(db, str(body.sale_id))
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Error enviando a SIFEN"))
    return result


@router.get("/cdc/{cdc}")
async def query_cdc(cdc: str, db: AsyncSession = Depends(get_db)):
    result = await service.query_cdc(db, cdc)
    if not result.get("valido"):
        raise HTTPException(status_code=400, detail=result.get("mensaje", "CDC invalido"))
    return result


@router.get("/companies/{company_id}/responses", response_model=list[SifenResponseRecord])
async def list_responses(
    company_id: str,
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_sifen_responses(db, company_id, estado, limit, offset)
