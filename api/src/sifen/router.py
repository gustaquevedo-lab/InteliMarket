"""SIFEN API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.sifen.schemas import TimbradoCreate, TimbradoResponse, SifenResponseRecord, SifenSendRequest, CdcQueryResponse
from api.src.sifen import service
from api.src.sifen.qr_service import create_qr_response, generate_qr_base64

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


@router.get("/responses", response_model=list[SifenResponseRecord])
async def list_all_responses(
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from api.src.sifen.models import SifenResponse as SifenResponseModel
    query = select(SifenResponseModel).order_by(SifenResponseModel.fecha_envio.desc()).limit(limit).offset(offset)
    if estado:
        query = query.where(SifenResponseModel.estado == estado)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/companies/{company_id}/responses", response_model=list[SifenResponseRecord])
async def list_responses(
    company_id: str,
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_sifen_responses(db, company_id, estado, limit, offset)


@router.get("/qr/{cdc}")
async def get_qr_image(cdc: str, size: int = Query(256, ge=128, le=512)):
    return create_qr_response(cdc, size)


@router.get("/qr/{cdc}/base64")
async def get_qr_base64(cdc: str):
    data = generate_qr_base64(cdc)
    return {"cdc": cdc, "qr_base64": data, "qr_data_url": f"data:image/png;base64,{data}"}


@router.post("/retry/{sale_id}")
async def retry_sifen(sale_id: str, db: AsyncSession = Depends(get_db)):
    """Retry sending a sale to SIFEN."""
    result = await service.send_sale_to_sifen(db, sale_id)
    return result


@router.get("/responses/{response_id}", response_model=SifenResponseRecord)
async def get_response(response_id: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from api.src.sifen.models import SifenResponse as SifenResponseModel
    result = await db.execute(select(SifenResponseModel).where(SifenResponseModel.id == response_id))
    response = result.scalar_one_or_none()
    if not response:
        raise HTTPException(404, "Respuesta SIFEN no encontrada")
    return response

