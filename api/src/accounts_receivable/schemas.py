from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class AccountsReceivableResponse(BaseModel):
    id: UUID
    company_id: UUID
    customer_id: UUID
    sale_id: Optional[UUID] = None
    numero_documento: Optional[str] = None
    fecha_emision: datetime
    fecha_vencimiento: Optional[date] = None
    moneda: str
    monto_original: Decimal
    saldo_pendiente: Decimal
    tipo: str
    estado: str
    dias_mora: Optional[int] = None
    ultimo_pago: Optional[datetime] = None
    notas_cobranza: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgingBucket(BaseModel):
    rango: str
    monto: Decimal
    cantidad: int
    porcentaje: Decimal


class CustomerAging(BaseModel):
    customer_id: UUID
    customer_name: str
    saldo_total: Decimal
    current: Decimal
    days_1_30: Decimal
    days_31_60: Decimal
    days_61_90: Decimal
    days_91_plus: Decimal
    total_documentos: int


class PaymentAllocationInput(BaseModel):
    sale_id: UUID
    monto: Decimal = Field(gt=0)


class ReceivableAllocationInput(BaseModel):
    accounts_receivable_id: UUID
    monto: Decimal = Field(gt=0)


class ReceivablePaymentCreate(BaseModel):
    customer_id: UUID
    monto_total: Decimal = Field(gt=0)
    moneda: str = "PYG"
    forma_pago: Optional[str] = None
    referencia: Optional[str] = None
    fecha: Optional[date] = None
    observaciones: Optional[str] = None
    allocations: list[ReceivableAllocationInput] = Field(min_length=1)


class ReceivablePaymentResponse(BaseModel):
    id: UUID
    company_id: UUID
    customer_id: UUID
    monto_total: Decimal
    moneda: str
    forma_pago: Optional[str] = None
    referencia: Optional[str] = None
    fecha: date
    observaciones: Optional[str] = None
    registrado_por: Optional[UUID] = None
    created_at: datetime
    allocations: list[dict] = []

    class Config:
        from_attributes = True
