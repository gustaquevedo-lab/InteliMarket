from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.accounts_receivable import service

router = APIRouter(prefix="/api/v1", tags=["accounts-receivable"])


@router.get("/companies/{company_id}/accounts-receivable")
async def list_receivables(
    company_id: str,
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_accounts_receivable(db, company_id, customer_id, estado, limit, offset)


@router.get("/companies/{company_id}/accounts-receivable/aging")
async def aging_report(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_aging_report(db, company_id)


@router.get("/companies/{company_id}/accounts-receivable/summary")
async def receivable_summary(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_receivable_summary(db, company_id)
