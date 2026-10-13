from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.accounts_payable import service

router = APIRouter(prefix="/api/v1", tags=["accounts-payable"])


@router.get("/companies/{company_id}/accounts-payable")
async def list_payables(
    company_id: str,
    supplier_id: str | None = Query(None),
    estado: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_accounts_payable(db, company_id, supplier_id, estado, search, limit, offset)


@router.get("/companies/{company_id}/accounts-payable/aging")
async def aging_report(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_ap_aging_report(db, company_id)


@router.get("/companies/{company_id}/accounts-payable/summary")
async def receivable_summary(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_ap_summary(db, company_id)


@router.get("/companies/{company_id}/accounts-payable/documents/{document_id}")
async def payable_document_detail(company_id: str, document_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_ap_document_detail(db, company_id, document_id)


@router.post("/companies/{company_id}/accounts-payable/payment")
async def create_payment(company_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    return await service.create_ap_payment_order(db, company_id, body)
