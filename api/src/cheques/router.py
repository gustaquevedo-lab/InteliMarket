from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.cheques import service
from api.src.cheques.schemas import (
    ChequeCreate, ChequeResponse, ChequeEstadoUpdate, ChequeHistorialResponse, ChequeDashboard,
)

router = APIRouter(prefix="/api/v1/cheques", tags=["cheques"])


@router.get("", response_model=list[ChequeResponse])
async def list_cheques(
    estado: str | None = Query(None),
    supplier_id: str | None = Query(None),
    vencidos: bool | None = Query(None),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_cheques(db, user["company_id"], estado, supplier_id, vencidos, fecha_desde, fecha_hasta, limit, offset)


@router.get("/export/excel")
async def export_cheques_excel(
    estado: str | None = Query(None),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.cheques.export_service import export_cheques_excel as build_excel

    cheques = await service.list_cheques(db, user["company_id"], estado, None, None, fecha_desde, fecha_hasta, limit=10000, offset=0)
    xlsx_bytes = build_excel(cheques, fecha_desde, fecha_hasta)
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=cheques.xlsx", "Content-Length": str(len(xlsx_bytes))},
    )


@router.get("/export/pdf")
async def export_cheques_pdf(
    estado: str | None = Query(None),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.financial.ap_pdf_reports import generate_cheques_pdf
    from api.src.financial.router import _get_company_info

    cheques = await service.list_cheques(db, user["company_id"], estado, None, None, fecha_desde, fecha_hasta, limit=10000, offset=0)
    company = await _get_company_info(db, user["company_id"])
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = generate_cheques_pdf(company, cheques, fecha_desde, fecha_hasta, generated_by)
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=cheques.pdf", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/dashboard", response_model=ChequeDashboard)
async def get_dashboard(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_dashboard(db, user["company_id"])


@router.post("", response_model=ChequeResponse, status_code=201)
async def create_cheque(data: ChequeCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    cheque = await service.create_cheque(db, user["company_id"], data, user.get("id") or user.get("sub"), user.get("user_nombre"))
    enriched = await service._enrich_with_supplier_names(db, [cheque])
    return enriched[0]


@router.get("/{cheque_id}/historial", response_model=list[ChequeHistorialResponse])
async def get_historial(cheque_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_historial(db, cheque_id)


@router.patch("/{cheque_id}/estado", response_model=ChequeResponse)
async def update_estado(cheque_id: str, data: ChequeEstadoUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        cheque = await service.update_estado(
            db, cheque_id, data.estado, data.notas,
            user.get("id") or user.get("sub"), user.get("user_nombre"),
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    enriched = await service._enrich_with_supplier_names(db, [cheque])
    return enriched[0]
