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
    monto_apertura_usd: Decimal = Decimal("0")
    monto_apertura_brl: Decimal = Decimal("0")


class CashSessionResponse(BaseModel):
    id: UUID
    register_id: UUID
    user_id: UUID
    cajero_nombre: Optional[str] = None
    fecha_apertura: datetime
    monto_apertura: float
    monto_apertura_usd: Optional[float] = 0.0
    monto_apertura_brl: Optional[float] = 0.0
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


class CashSessionPause(BaseModel):
    motivo: Optional[str] = "Relevo / Salida a Almuerzo"


class CashSessionResume(BaseModel):
    cash_register_id: Optional[UUID] = None
    punto_emision: Optional[str] = None


class CashSessionFondoUpdate(BaseModel):
    monto_apertura: Decimal = Decimal("0")
    monto_apertura_brl: Decimal = Decimal("0")
    monto_apertura_usd: Decimal = Decimal("0")
    motivo: Optional[str] = None


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


class VoidCashDropRequest(BaseModel):
    anulado_por: UUID
    anulado_por_nombre: str
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


class CreateTreasuryRemittanceRequest(BaseModel):
    item_ids: list[UUID]  # IDs de los VaultEntry o drops/handoffs a incluir
    observaciones: Optional[str] = None


class ReceiveTreasuryRemittanceRequest(BaseModel):
    observaciones: Optional[str] = None


class DepositVaultToBankRequest(BaseModel):
    entry_ids: list[UUID]
    bank_account_id: UUID
    numero_boleta: str
    transportadora: Optional[str] = None
    fecha_deposito: Optional[str] = None
    observaciones: Optional[str] = None


class TreasuryRemittanceItemResponse(BaseModel):
    id: UUID
    remittance_id: UUID
    tipo_sobre: str
    referencia_id: Optional[UUID] = None
    vault_entry_id: Optional[UUID] = None
    caja_codigo: Optional[str] = None
    caja_nombre: Optional[str] = None
    cajero_nombre: Optional[str] = None
    monto_pyg: Decimal
    monto_usd: Decimal
    monto_brl: Decimal
    ticket_numero: Optional[str] = None
    verificado_tesoreria: bool
    observaciones: Optional[str] = None
    created_at: datetime


class TreasuryRemittanceResponse(BaseModel):
    id: UUID
    company_id: UUID
    numero: str
    supervisor_id: UUID
    supervisor_nombre: str
    tesorero_id: Optional[UUID] = None
    tesorero_nombre: Optional[str] = None
    estado: str
    total_sobres: int
    total_pyg: Decimal
    total_usd: Decimal
    total_brl: Decimal
    fecha_envio: datetime
    fecha_recepcion: Optional[datetime] = None
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TreasuryRemittanceDetailResponse(TreasuryRemittanceResponse):
    items: list[TreasuryRemittanceItemResponse]

