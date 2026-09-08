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
    bank_account_id: Optional[UUID] = None
    destino_fondos: Optional[str] = "boveda"
    caja_session_id: Optional[UUID] = None
    cheque_numero: Optional[str] = None
    cheque_banco: Optional[str] = None
    cheque_librador: Optional[str] = None
    cheque_ruc: Optional[str] = None
    cheque_fecha_emision: Optional[date] = None
    cheque_fecha_cobro: Optional[date] = None
    allocations: list[ReceivableAllocationInput] = Field(min_length=1)


class ReceivableGlobalPaymentCreate(BaseModel):
    customer_id: UUID
    monto_total: Decimal = Field(gt=0)
    moneda: str = "PYG"
    forma_pago: Optional[str] = "efectivo"
    referencia: Optional[str] = None
    fecha: Optional[date] = None
    observaciones: Optional[str] = None
    bank_account_id: Optional[UUID] = None
    destino_fondos: Optional[str] = "boveda"
    caja_session_id: Optional[UUID] = None
    cheque_numero: Optional[str] = None
    cheque_banco: Optional[str] = None
    cheque_librador: Optional[str] = None
    cheque_ruc: Optional[str] = None
    cheque_fecha_emision: Optional[date] = None
    cheque_fecha_cobro: Optional[date] = None
    # Si viene None o vacío, se aplica en cascada FIFO a todas las facturas pendientes
    # Si viene con IDs, se aplica en cascada FIFO sólo a las facturas seleccionadas
    accounts_receivable_ids: Optional[list[UUID]] = None


class CorporateRemissionCreate(BaseModel):
    empresa_vinculada_nombre: str
    periodo_mes: str
    fecha_corte: Optional[date] = None
    accounts_receivable_ids: Optional[list[UUID]] = None
    notas: Optional[str] = None


class CorporateRemissionPayInput(BaseModel):
    monto: Decimal = Field(gt=0)
    forma_pago: str = "transferencia"
    bank_account_id: Optional[UUID] = None
    destino_fondos: Optional[str] = "banco"
    referencia: Optional[str] = None
    fecha_pago: Optional[date] = None
    notas: Optional[str] = None



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


class ReceiptVerificationResponse(BaseModel):
    valido: bool = True
    payment_id: UUID
    numero_recibo: str
    fecha: date
    fecha_hora_emision: datetime
    monto_total: Decimal
    moneda: str
    forma_pago: Optional[str] = None
    referencia: Optional[str] = None
    observaciones: Optional[str] = None
    cliente: dict
    empresa: dict
    allocations: list[dict]

