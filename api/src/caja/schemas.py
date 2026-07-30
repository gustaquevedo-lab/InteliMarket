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


class CashRegisterResponse(BaseModel):
    id: UUID
    branch_id: Optional[UUID] = None
    nombre: str
    codigo: str
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
    register_id: UUID
    user_id: UUID
    fecha_apertura: datetime
    monto_apertura: Decimal
    fecha_cierre: Optional[datetime] = None
    monto_cierre: Optional[Decimal] = None
    estado: str
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CashSessionClose(BaseModel):
    monto_cierre_real: Decimal
    observaciones: Optional[str] = None
