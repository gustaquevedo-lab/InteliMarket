"""Purchases API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.purchases.schemas import (
    SupplierCreate, SupplierUpdate, SupplierResponse,
    POCreate, POResponse,
    ReceiptCreate, ReceiptResponse,
)
from api.src.purchases import service

router = APIRouter(prefix="/api/v1", tags=["purchases"])


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(body: SupplierCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_supplier(db, body)


@router.get("/companies/{company_id}/suppliers", response_model=list[SupplierResponse])
async def list_suppliers(company_id: str, search: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.list_suppliers(db, company_id, search)


@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(supplier_id: str, db: AsyncSession = Depends(get_db)):
    supplier = await service.get_supplier(db, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return supplier


@router.patch("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(supplier_id: str, body: SupplierUpdate, db: AsyncSession = Depends(get_db)):
    supplier = await service.get_supplier(db, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    await db.flush()
    await db.refresh(supplier)
    return supplier


@router.post("/purchase-orders", response_model=POResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(body: POCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_purchase_order(db, body)


@router.get("/companies/{company_id}/purchase-orders", response_model=list[POResponse])
async def list_purchase_orders(
    company_id: str,
    supplier_id: str | None = Query(None),
    estado: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_purchase_orders(db, company_id, supplier_id, estado)


@router.post("/purchase-orders/{po_id}/confirm", response_model=POResponse)
async def confirm_purchase_order(po_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.confirm_purchase_order(db, po_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo confirmar la orden")
    return result


@router.post("/purchase-receipts", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(body: ReceiptCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_receipt(db, body)


@router.get("/companies/{company_id}/purchase-receipts", response_model=list[ReceiptResponse])
async def list_receipts(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_receipts(db, company_id)
