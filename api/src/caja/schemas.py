"""Caja (Cash Register) schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class CashRegisterCreate(BaseModel):
    branch_id: Optional[UUID] = None
    nombre: str
    codigo: str


class CashRegisterUpdate(BaseModel):
    nombre: Optional[str] = None
    codigo: Optional[str] = None
    activo: Optional[bool] = None
    cash_drop_threshold: Optional[Decimal] = None
    diferencia_maxima_tolerada: Optional[Decimal] = None


class CashRegisterResponse(BaseModel):
    id: UUID
    branch_id: Optional[UUID] = None
    nombre: str
    codigo: str
    activo: bool
    cash_drop_threshold: Optional[float] = None
    diferencia_maxima_tolerada: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CashSessionCreate(BaseModel):
    cash_register_id: UUID
    user_id: UUID
    cajero_nombre: Optional[str] = None
    monto_apertura: Decimal = Decimal("0")


class CashSessionResponse(BaseModel):
    id: UUID
    register_id: UUID
    user_id: UUID
    cajero_nombre: Optional[str] = None
    fecha_apertura: datetime
    monto_apertura: float
    fecha_cierre: Optional[datetime] = None
    monto_cierre: Optional[float] = None
    estado: str
    ultimo_cash_drop_at: Optional[datetime] = None
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CashSessionClose(BaseModel):
    monto_cierre_real: Decimal
    monto_cierre_usd: Decimal = Decimal("0")
    monto_cierre_brl: Decimal = Decimal("0")
    observaciones: Optional[str] = None


class CashDropCreate(BaseModel):
    monto: Decimal = Decimal("0")
    monto_usd: Decimal = Decimal("0")
    monto_brl: Decimal = Decimal("0")
    observaciones: Optional[str] = None


class ConfirmCashDropRequest(BaseModel):
    confirmado_por: UUID
    confirmado_por_nombre: str
    monto_confirmado_pyg: Optional[Decimal] = None
    monto_confirmado_usd: Optional[Decimal] = None
    monto_confirmado_brl: Optional[Decimal] = None


class RejectCashDropRequest(BaseModel):
    motivo: str


class ConfirmHandoffRequest(BaseModel):
    recibido_por: UUID
    recibido_por_nombre: str
    monto_confirmado_pyg: Optional[Decimal] = None
    monto_confirmado_usd: Optional[Decimal] = None
    monto_confirmado_brl: Optional[Decimal] = None


class DepositVaultEntriesRequest(BaseModel):
    entry_ids: list[UUID]
    bank_transaction_id: Optional[UUID] = None


class RejectVaultDepositRequest(BaseModel):
    motivo: str
