"""Customer API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.customers.schemas import CustomerCreate, CustomerUpdate, CustomerResponse
from api.src.customers import service

router = APIRouter(prefix="/api/v1", tags=["customers"])


@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(body: CustomerCreate, db: AsyncSession = Depends(get_db)):
    if body.ruc:
        existing = await service.get_customer_by_ruc(db, str(body.company_id), body.ruc)
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un cliente con ese RUC")
    return await service.create_customer(db, body)


@router.get("/companies/{company_id}/customers", response_model=list[CustomerResponse])
async def list_customers(
    company_id: str,
    search: str | None = Query(None),
    activo: bool | None = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_customers(db, company_id, search, activo, limit, offset)


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    customer = await service.get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return customer


@router.patch("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: str, body: CustomerUpdate, db: AsyncSession = Depends(get_db)):
    customer = await service.update_customer(db, customer_id, body)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return customer


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_customer(db, customer_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
