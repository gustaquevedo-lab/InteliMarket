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


@router.get("/companies/{company_id}/customers/consolidated-debts")
async def list_consolidated_debts(
    company_id: str,
    search: str | None = Query(None),
    solo_con_deuda: bool = Query(False),
    solo_con_rechazados: bool = Query(False),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_consolidated_debts(
        db, company_id, search=search, solo_con_deuda=solo_con_deuda,
        solo_con_rechazados=solo_con_rechazados, limit=limit, offset=offset,
    )


@router.get("/companies/{company_id}/customers/{customer_id}/consolidated-debt")
async def get_customer_consolidated_debt(
    company_id: str,
    customer_id: str,
    db: AsyncSession = Depends(get_db),
):
    data = await service.get_customer_consolidated_debt(db, company_id, customer_id)
    if not data:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return data


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


@router.get("/companies/{company_id}/customers/{customer_id}/360")
async def get_customer_field_360(company_id: str, customer_id: str, db: AsyncSession = Depends(get_db)):
    from api.src.inteliforce.service import get_customer_360
    data = await get_customer_360(db, company_id, customer_id)
    if not data:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return data
