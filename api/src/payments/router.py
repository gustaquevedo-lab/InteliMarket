"""Payments API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from api.src.db import get_db
from api.src.payments.schemas import (
    PaymentMethodCreate, PaymentMethodResponse,
    PaymentCreate, PaymentResponse,
    WalletResponse, AccountResponse,
    FinancingResponse, InstallmentResponse,
)
from api.src.payments import service

router = APIRouter(prefix="/api/v1", tags=["payments"])


@router.post("/payment-methods", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_method(body: PaymentMethodCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_payment_method(db, body)


@router.get("/companies/{company_id}/payment-methods", response_model=list[PaymentMethodResponse])
async def list_payment_methods(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_payment_methods(db, company_id)


@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(body: PaymentCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_payment(db, body)


@router.get("/wallets/{company_id}/{customer_id}", response_model=WalletResponse)
async def get_wallet(company_id: str, customer_id: str, moneda: str = "PYG", db: AsyncSession = Depends(get_db)):
    wallet = await service.get_wallet(db, company_id, customer_id, moneda)
    if not wallet:
        wallet = await service.create_wallet(db, company_id, customer_id, moneda)
    return wallet


@router.get("/accounts/{customer_id}", response_model=AccountResponse)
async def get_account(customer_id: str, db: AsyncSession = Depends(get_db)):
    account = await service.get_account(db, customer_id)
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta corriente no encontrada")
    return account


@router.post("/financings", response_model=FinancingResponse, status_code=status.HTTP_201_CREATED)
async def create_financing(
    company_id: UUID,
    customer_id: UUID,
    sale_id: UUID,
    monto_financiado: int,
    cantidad_cuotas: int,
    tasa_interes_mensual: float | None = None,
    db: AsyncSession = Depends(get_db),
):
    from decimal import Decimal
    financing = await service.create_financing(
        db, company_id, customer_id, sale_id,
        Decimal(str(monto_financiado)), cantidad_cuotas,
        Decimal(str(tasa_interes_mensual)) if tasa_interes_mensual else None,
    )
    return financing


@router.post("/financings/installments/{installment_id}/pay", response_model=InstallmentResponse)
async def pay_installment(installment_id: str, payment_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await service.pay_installment(db, installment_id, payment_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo registrar el pago")
    return result
