"""Sales API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.sales.schemas import SaleCreate, SaleResponse, SaleWithItems, CashSessionCreate, CashSessionResponse, CashSessionClose
from api.src.sales import service

router = APIRouter(prefix="/api/v1", tags=["sales"])


@router.post("/sales", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(body: SaleCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_sale(db, body)


@router.get("/companies/{company_id}/sales", response_model=list[SaleResponse])
async def list_sales(
    company_id: str,
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_sales(db, company_id, customer_id, estado, limit=limit, offset=offset)


@router.get("/sales/{sale_id}", response_model=SaleResponse)
async def get_sale(sale_id: str, db: AsyncSession = Depends(get_db)):
    sale = await service.get_sale(db, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale


@router.get("/companies/{company_id}/sales/today")
async def sales_today(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_sales_today(db, company_id)


@router.post("/cash-sessions", response_model=CashSessionResponse, status_code=status.HTTP_201_CREATED)
async def open_cash_session(body: CashSessionCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_cash_session(db, body)


@router.post("/cash-sessions/{session_id}/close", response_model=CashSessionResponse)
async def close_cash_session(session_id: str, body: CashSessionClose, db: AsyncSession = Depends(get_db)):
    result = await service.close_cash_session(db, session_id, body)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo cerrar la caja")
    return result
