from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.discounts.schemas import DiscountCreate, DiscountUpdate, DiscountResponse
from api.src.discounts import service

router = APIRouter(prefix="/api/v1", tags=["discounts"])


@router.post("/discounts", response_model=DiscountResponse, status_code=status.HTTP_201_CREATED)
async def create_discount(body: DiscountCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_discount(db, body)


@router.get("/discounts/{discount_id}", response_model=DiscountResponse)
async def get_discount(discount_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_discount(db, discount_id)
    if not result:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")
    return result


@router.get("/companies/{company_id}/discounts", response_model=list[DiscountResponse])
async def list_discounts(
    company_id: str,
    activo: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_discounts(db, company_id, activo)


@router.put("/discounts/{discount_id}", response_model=DiscountResponse)
async def update_discount(discount_id: str, body: DiscountUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_discount(db, discount_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")
    return result


@router.delete("/discounts/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_discount(discount_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_discount(db, discount_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")
