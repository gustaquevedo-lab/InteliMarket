"""Payment schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class PaymentMethodCreate(BaseModel):
    company_id: UUID
    tipo: str
    nombre: str = Field(min_length=1, max_length=100)
    moneda: str = "PYG"
    config: Optional[dict] = None


class PaymentMethodResponse(BaseModel):
    id: UUID
    company_id: UUID
    tipo: str
    nombre: str
    moneda: str
    activo: bool
    config: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentAllocationInput(BaseModel):
    sale_id: UUID
    monto_asignado: Decimal = Field(gt=0)


class PaymentCreate(BaseModel):
    company_id: UUID
    tipo: str
    payment_method_id: UUID
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    monto: Decimal = Field(gt=0)
    referencia: Optional[str] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    allocations: Optional[list[PaymentAllocationInput]] = None


class PaymentResponse(BaseModel):
    id: UUID
    company_id: UUID
    tipo: str
    payment_method_id: UUID
    moneda: str
    tipo_cambio: Decimal
    monto: Decimal
    monto_pyg: Optional[Decimal] = None
    fecha: datetime
    referencia: Optional[str] = None
    estado: str
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WalletResponse(BaseModel):
    id: UUID
    customer_id: UUID
    saldo: Decimal
    moneda: str
    updated_at: datetime

    class Config:
        from_attributes = True


class AccountResponse(BaseModel):
    id: UUID
    customer_id: UUID
    moneda: str
    limite_credito: Decimal
    saldo_actual: Decimal
    dias_plazo: int
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FinancingResponse(BaseModel):
    id: UUID
    company_id: UUID
    customer_id: UUID
    sale_id: UUID
    monto_financiado: Decimal
    tasa_interes_mensual: Optional[Decimal] = None
    cantidad_cuotas: int
    monto_cuota: Decimal
    moneda: str
    fecha_primera_cuota: date
    estado: str
    created_at: datetime

    class Config:
        from_attributes = True


class InstallmentResponse(BaseModel):
    id: UUID
    financing_id: UUID
    numero_cuota: int
    fecha_vencimiento: date
    monto: Decimal
    monto_pagado: Decimal
    estado: str
    fecha_pago: Optional[datetime] = None

    class Config:
        from_attributes = True
