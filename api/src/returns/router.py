from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.returns.schemas import ReturnCreate, ReturnResponse, ReturnWithItems, ReturnApprove
from api.src.returns import service, pdf_reports

router = APIRouter(prefix="/api/v1", tags=["returns"], dependencies=[Depends(require_auth)])


async def _get_company_info(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        text("SELECT razon_social, nombre_fantasia, ruc, direccion, ciudad, logo_url FROM companies WHERE id = :cid"),
        {"cid": company_id},
    )
    row = result.first()
    if not row:
        return {
            "razon_social": "GRUPO SANTA TERESA E.A.S.",
            "nombre_fantasia": "Extra Supermercado Mayorista",
            "ruc": "80150377-9",
            "direccion": "Av. San Blas km 3.5",
            "ciudad": "Ciudad del Este",
            "logo_url": None,
        }
    return dict(row._mapping)


@router.post("/returns", response_model=ReturnResponse, status_code=status.HTTP_201_CREATED)
async def create_return(body: ReturnCreate, db: AsyncSession = Depends(get_db)):
    try:
        return await service.create_return(db, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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


@router.get("/returns/{return_id}/pdf")
async def export_customer_return_pdf_endpoint(
    return_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """
    Genera el Acta Oficial de Devolución de Cliente (RMA) en PDF A4.
    Diseño premium de Extra Supermercado Mayorista con casillas de control,
    desglose fiscal, comprobante de venta y firmas de auditoría.
    """
    cid = user.get("company_id")
    ret_data = await service.get_return_pdf_data(db, return_id, cid)
    if not ret_data:
        raise HTTPException(status_code=404, detail="Devolución no encontrada")

    company = await _get_company_info(db, str(ret_data.get("company_id") or cid))
    user_name = user.get("nombre") or user.get("email") or "Atención al Cliente"
    pdf_bytes = pdf_reports.generate_customer_return_pdf(company, ret_data, generated_by=user_name)
    numero = ret_data.get("numero") or f"DEV_{return_id[:8]}"
    filename = f"Reporte_Devolucion_{numero}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@router.get("/returns/{return_id}/nota-credito/pdf")
async def export_customer_return_nota_credito_pdf_endpoint(
    return_id: str,
    copy: str = Query("ORIGINAL: CLIENTE"),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """
    Genera la Nota de Crédito Oficial A4 aprobada por la SET / DNIT en PDF.
    Diseño legal con desglose tributario, identificación de factura que modifica,
    subtotales por tasa, liquidación del IVA, total en letras y casillas de firma.
    """
    cid = user.get("company_id")
    ret_data = await service.get_return_pdf_data(db, return_id, cid)
    if not ret_data:
        raise HTTPException(status_code=404, detail="Devolución no encontrada")

    company = await _get_company_info(db, str(ret_data.get("company_id") or cid))
    pdf_bytes = pdf_reports.generate_nota_credito_pdf(company, ret_data, copy_type=copy)
    nc_num = ret_data.get("nota_credito_numero") or ret_data.get("numero") or f"NC_{return_id[:8]}"
    clean_num = str(nc_num).replace("/", "_").replace(" ", "_").replace(":", "_")
    filename = f"Nota_Credito_{clean_num}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


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

