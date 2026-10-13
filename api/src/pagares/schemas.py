from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date, datetime
import uuid


class PagareCreate(BaseModel):
    company_id: str
    customer_id: str
    receivable_account_id: Optional[str] = None
    numero_pagare: str
    monto_original: Decimal
    fecha_emision: date
    fecha_vencimiento: date
    motivo: Optional[str] = None
    cobrador_id: Optional[str] = None


class PagarePayInput(BaseModel):
    monto: Decimal
    fecha: date
    observaciones: Optional[str] = None


class PagareProtestInput(BaseModel):
    motivo: str


class PagareResponse(BaseModel):
    id: str
    company_id: str
    customer_id: str
    receivable_account_id: Optional[str] = None
    numero_pagare: str
    monto_original: Decimal
    saldo_pendiente: Decimal
    fecha_emision: date
    fecha_vencimiento: date
    motivo: Optional[str] = None
    estado: str
    cobrador_id: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
