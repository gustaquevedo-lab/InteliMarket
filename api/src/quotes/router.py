from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.quotes.schemas import (
    QuoteCreate, QuoteUpdate, QuoteResponse, QuoteWithItems, QuoteConvertToSale,
)
from api.src.quotes import service

router = APIRouter(prefix="/api/v1", tags=["quotes"])


@router.post("/quotes", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_quote(body: QuoteCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_quote(db, body)


@router.get("/quotes/{quote_id}", response_model=QuoteWithItems)
async def get_quote(quote_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_quote_with_items(db, quote_id)
    if not result:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return result


@router.get("/companies/{company_id}/quotes", response_model=list[QuoteResponse])
async def list_quotes(
    company_id: str,
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_quotes(db, company_id, customer_id, estado, limit=limit, offset=offset)


@router.put("/quotes/{quote_id}", response_model=QuoteResponse)
async def update_quote(quote_id: str, body: QuoteUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_quote(db, quote_id, body)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo actualizar la cotización")
    return result


@router.post("/quotes/{quote_id}/status")
async def change_quote_status(
    quote_id: str,
    estado: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await service.change_quote_status(db, quote_id, estado)
    if not result:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return result


@router.post("/quotes/{quote_id}/convert")
async def convert_quote_to_sale(
    quote_id: str,
    body: QuoteConvertToSale,
    db: AsyncSession = Depends(get_db),
):
    result = await service.convert_quote_to_sale(db, quote_id, body)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/quotes/expire")
async def expire_quotes(
    company_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    count = await service.expire_quotes(db, company_id)
    return {"expiradas": count}
