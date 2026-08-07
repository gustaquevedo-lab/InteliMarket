"""Checks/pagares schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
import uuid


class CheckCreate(BaseModel):
    company_id: uuid.UUID
    customer_id: uuid.UUID
    tipo: str = "cheque"
    numero: str
    banco: Optional[str] = None
    titular: Optional[str] = None
    monto: Decimal
    moneda: str = "PYG"
    fecha_emision: Optional[date] = None
    fecha_vencimiento: date
    payment_id: Optional[uuid.UUID] = None
    accounts_receivable_id: Optional[uuid.UUID] = None
    observaciones: Optional[str] = None


class CheckResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    tipo: str
    numero: str
    banco: Optional[str] = None
    titular: Optional[str] = None
    monto: Decimal
    moneda: str
    fecha_emision: Optional[date] = None
    fecha_vencimiento: date
    estado: str
    payment_id: Optional[uuid.UUID] = None
    accounts_receivable_id: Optional[uuid.UUID] = None
    reemplaza_check_id: Optional[uuid.UUID] = None
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CheckChangeStatus(BaseModel):
    estado: str  # depositado | acreditado | rechazado
    motivo: Optional[str] = None
    user_id: Optional[uuid.UUID] = None


class CheckReplace(BaseModel):
    numero: str
    banco: Optional[str] = None
    titular: Optional[str] = None
    fecha_vencimiento: date
    user_id: Optional[uuid.UUID] = None


class CheckEventResponse(BaseModel):
    id: uuid.UUID
    check_id: uuid.UUID
    estado_anterior: Optional[str] = None
    estado_nuevo: str
    motivo: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
