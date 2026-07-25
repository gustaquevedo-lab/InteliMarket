"""SIFEN Avanzado API — Distribuidora invoices, IVA books, retention books, DGR, e-Kuatia, CDC"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.sifen_avanzado.schemas import (
    DistribuidoraInvoiceRequest, DistribuidoraInvoiceResponse,
    IvaBookResponse, RetentionBookResponse,
    DgrVehicleCreate, DgrVehicleUpdate, DgrVehicleResponse,
    DgrReportResponse,
    EkuatiaDocumentCreate, EkuatiaDocumentResponse,
    CdcValidationRequest, CdcValidationResponse,
    BatchCdcValidationRequest,
    SifenAvanzadoDashboard,
)
from api.src.sifen_avanzado import service

router = APIRouter(prefix="/api/v1/sifen-avanzado", tags=["sifen-avanzado"])


# ── DISTRIBUIDORA INVOICE ────────────────────────────────────────────────────

@router.post("/invoices/distribuidora", response_model=DistribuidoraInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def send_distribuidora_invoice(body: DistribuidoraInvoiceRequest, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.send_distribuidora_invoice(db, body, user_id)


# ── IVA BOOKS ────────────────────────────────────────────────────────────────

@router.get("/iva-books/{tipo}", response_model=IvaBookResponse)
async def get_iva_book(
    tipo: str,
    company_id: str = Query(),
    periodo: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    if tipo not in ("ventas", "compras"):
        raise HTTPException(status_code=400, detail="Tipo debe ser 'ventas' o 'compras'")
    return await service.get_iva_book(db, company_id, tipo, periodo)


@router.get("/iva-books/{tipo}/export")
async def export_iva_book_csv(
    tipo: str,
    company_id: str = Query(),
    periodo: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    if tipo not in ("ventas", "compras"):
        raise HTTPException(status_code=400, detail="Tipo debe ser 'ventas' o 'compras'")
    csv_content = await service.export_iva_book_csv(db, company_id, tipo, periodo)
    return StreamingResponse(
        csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=iva_{tipo}_{periodo}.csv"},
    )


# ── RETENTION BOOK ───────────────────────────────────────────────────────────

@router.get("/retention-books", response_model=RetentionBookResponse)
async def get_retention_book(
    company_id: str = Query(),
    periodo: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_retention_book(db, company_id, periodo)


@router.get("/retention-books/export")
async def export_retention_book_csv(
    company_id: str = Query(),
    periodo: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    csv_content = await service.export_retention_book_csv(db, company_id, periodo)
    return StreamingResponse(
        csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=retenciones_{periodo}.csv"},
    )


# ── DGR VEHICLES ─────────────────────────────────────────────────────────────

@router.get("/dgr/vehicles", response_model=list[DgrVehicleResponse])
async def list_dgr_vehicles(
    company_id: str = Query(),
    activo: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_dgr_vehicles(db, company_id, activo)


@router.post("/dgr/vehicles", response_model=DgrVehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_dgr_vehicle(body: DgrVehicleCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_dgr_vehicle(db, body)


@router.put("/dgr/vehicles/{vehicle_id}", response_model=DgrVehicleResponse)
async def update_dgr_vehicle(vehicle_id: str, body: DgrVehicleUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_dgr_vehicle(db, vehicle_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    return result


@router.post("/dgr/reports", response_model=dict)
async def generate_dgr_report(
    company_id: str = Query(),
    periodo: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    return await service.generate_dgr_report(db, company_id, periodo)


@router.get("/dgr/reports", response_model=list[DgrReportResponse])
async def list_dgr_reports(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.list_dgr_reports(db, company_id)


# ── e-KUATIA DOCUMENTS ───────────────────────────────────────────────────────

@router.get("/ekuatia/documents", response_model=list[EkuatiaDocumentResponse])
async def list_ekuatia_documents(
    company_id: str = Query(),
    sale_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_ekuatia_documents(db, company_id, sale_id)


@router.post("/ekuatia/documents", response_model=EkuatiaDocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_ekuatia_document(body: EkuatiaDocumentCreate, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.create_ekuatia_document(db, body, user_id)


@router.post("/ekuatia/documents/{doc_id}/verify", response_model=EkuatiaDocumentResponse)
async def verify_ekuatia_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.verify_ekuatia_document(db, doc_id)
    if not result:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return result


# ── CDC VALIDATION ───────────────────────────────────────────────────────────

@router.post("/cdc/validate", response_model=CdcValidationResponse)
async def validate_cdc(body: CdcValidationRequest, db: AsyncSession = Depends(get_db)):
    return await service.validate_cdc(db, body.company_id, body.sale_id, body.cdc)


@router.post("/cdc/batch-validate", response_model=list[dict])
async def batch_validate_cdc(body: BatchCdcValidationRequest, db: AsyncSession = Depends(get_db)):
    return await service.batch_validate_cdc(db, body)


# ── DASHBOARD ────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=SifenAvanzadoDashboard)
async def get_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_dashboard(db, company_id)
