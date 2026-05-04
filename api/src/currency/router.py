"""Currency API router"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from api.src.db import get_db
from api.src.currency.schemas import CurrencyResponse, ExchangeRateResponse
from api.src.currency import service

router = APIRouter(prefix="/api/v1", tags=["currency"])


@router.get("/companies/{company_id}/currencies", response_model=list[CurrencyResponse])
async def list_currencies(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_currencies(db, company_id)


@router.post("/companies/{company_id}/currencies/init")
async def init_currencies(company_id: UUID, db: AsyncSession = Depends(get_db)):
    await service.init_currencies(db, company_id)
    return {"message": "Monedas inicializadas"}


@router.get("/companies/{company_id}/exchange-rates", response_model=list[ExchangeRateResponse])
async def list_exchange_rates(
    company_id: str,
    moneda: str | None = Query(None),
    desde: str | None = Query(None),
    hasta: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date
    d_from = date.fromisoformat(desde) if desde else None
    d_to = date.fromisoformat(hasta) if hasta else None
    return await service.list_exchange_rates(db, company_id, moneda, d_from, d_to)


@router.post("/companies/{company_id}/exchange-rates/sync")
async def sync_bcp_rates(company_id: UUID, fecha: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    from datetime import date
    d = date.fromisoformat(fecha) if fecha else None
    rates = await service.sync_bcp_rates(db, company_id, d)
    return {"message": f"{len(rates)} tipos de cambio sincronizados", "rates": [r.moneda for r in rates]}
