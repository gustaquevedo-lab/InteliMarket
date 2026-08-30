"""SIFEN API router — InteliFact Engine Integration for Casa Gonzalito."""

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import io

from api.src.db import get_db
from api.src.sifen.schemas import TimbradoCreate, TimbradoResponse, SifenResponseRecord, SifenSendRequest
from api.src.sifen import service
from api.src.sifen.client import sifen_client
from api.src.sifen.qr_service import create_qr_response, generate_qr_base64

router = APIRouter(prefix="/api/v1/sifen", tags=["sifen"])


@router.get("/invoices")
async def list_invoices(
    search: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List electronic invoices with full CDC, customer and tax details."""
    return await service.list_sifen_invoices(db, search, estado, limit, offset)


@router.get("/credit-notes")
async def list_credit_notes(
    search: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List electronic credit notes with CDC and reference details."""
    return await service.list_credit_notes(db, search, limit, offset)


@router.get("/kude/{identifier}")
async def get_kude_document(identifier: str, db: AsyncSession = Depends(get_db)):
    """Fetch official KuDE details for invoice or credit note by ID, CDC, or number."""
    doc = await service.get_kude_data(db, identifier)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento KuDE no encontrado")
    return doc


@router.get("/kude/{identifier}/pdf")
async def download_kude_pdf(identifier: str, db: AsyncSession = Depends(get_db)):
    """Generate and stream official KuDE PDF from InteliFact engine."""
    doc = await service.get_kude_data(db, identifier)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento KuDE no encontrado")

    try:
        pdf_bytes = await sifen_client.generate_pdf(
            sale={
                "id": identifier,
                "numero": doc["documento_numero"],
                "fecha": doc["fecha_emision"],
                "moneda": doc["moneda"],
                "subtotal": doc["subtotal"],
                "total": doc["total"],
                "total_iva10": doc["iva_10"],
                "total_iva5": doc["iva_5"],
                "items": doc["items"],
            },
            company=doc["emisor"],
            customer=doc["receptor"],
            items=doc["items"],
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="kude-{doc["documento_numero"]}.pdf"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF KuDE: {str(e)}")


@router.get("/telemetry")
async def get_telemetry_status():
    """Proxy telemetry queue status from InteliFact local engine (:3000)."""
    try:
        return await sifen_client.get_telemetry_status()
    except Exception as e:
        return {
            "success": False,
            "telemetry": {
                "endpoint": "http://dev-server/api/v1/telemetry/ingest",
                "pendingEvents": 0,
                "sentEvents": 0,
                "status": "offline_buffer",
                "error": str(e),
            },
        }


@router.post("/telemetry/flush")
async def flush_telemetry():
    """Trigger manual flush of telemetry queue towards dev-server."""
    try:
        return await sifen_client.flush_telemetry()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error vaciando cola de telemetría: {str(e)}")


@router.post("/timbrados", response_model=TimbradoResponse, status_code=status.HTTP_201_CREATED)
async def create_timbrado(body: TimbradoCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_timbrado(db, body)


@router.get("/timbrados", response_model=list[TimbradoResponse])
async def list_timbrados_default(company_id: str = Query("00000000-0000-0000-0000-000000000010"), db: AsyncSession = Depends(get_db)):
    return await service.list_timbrados(db, company_id)


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
