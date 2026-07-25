"""Caja (Cash Register) schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class CashRegisterCreate(BaseModel):
    branch_id: UUID
    nombre: str
    tipo: str = "principal"


class CashRegisterUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    activo: Optional[bool] = None


class CashRegisterResponse(BaseModel):
    id: UUID
    branch_id: UUID
    nombre: str
    tipo: str
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CashSessionCreate(BaseModel):
    cash_register_id: UUID
    user_id: UUID
    monto_apertura: Decimal = Decimal("0")


class CashSessionResponse(BaseModel):
    id: UUID
    cash_register_id: UUID
    user_id: UUID
    fecha_apertura: datetime
    monto_apertura: Decimal
    fecha_cierre: Optional[datetime] = None
    monto_cierre_esperado: Optional[Decimal] = None
    monto_cierre_real: Optional[Decimal] = None
    diferencia: Optional[Decimal] = None
    estado: str
    observaciones_cierre: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CashSessionClose(BaseModel):
    monto_cierre_real: Decimal
    observaciones: Optional[str] = None


class CashSessionSummary(BaseModel):
    id: UUID
    cash_register_id: UUID
    cash_register_nombre: Optional[str] = None
    user_id: UUID
    fecha_apertura: datetime
    monto_apertura: Decimal
    fecha_cierre: Optional[datetime] = None
    monto_cierre_esperado: Optional[Decimal] = None
    monto_cierre_real: Optional[Decimal] = None
    diferencia: Optional[Decimal] = None
    estado: str
    observaciones_cierre: Optional[str] = None
    total_ventas: int = 0
    total_cobrado: Decimal = Decimal("0")
    total_efectivo: Decimal = Decimal("0")
    total_tarjeta: Decimal = Decimal("0")
    total_transferencia: Decimal = Decimal("0")

    class Config:
        from_attributes = True
