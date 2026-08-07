"""Credit account schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class CreditAccountCreate(BaseModel):
    company_id: uuid.UUID
    customer_id: uuid.UUID
    limite_credito: float = 0
    dias_plazo: int = 30


class CreditAccountUpdate(BaseModel):
    limite_credito: Optional[float] = None
    dias_plazo: Optional[int] = None
    activo: Optional[bool] = None


class CreditAccountResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    limite_credito: float
    saldo_disponible: float
    saldo_utilizado: float
    dias_plazo: int
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class AuthorizeExcessRequest(BaseModel):
    monto: float
    motivo: str


class AuthorizeExcessResponse(BaseModel):
    authorization_id: uuid.UUID
    credit_account_id: uuid.UUID
    monto: float
    autorizado_por: uuid.UUID


class CreditPayment(BaseModel):
    monto: float
    referencia: Optional[str] = None
    observaciones: Optional[str] = None


class CreditMovementResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    credit_account_id: uuid.UUID
    customer_id: uuid.UUID
    tipo: str
    monto: float
    saldo_anterior: float
    saldo_nuevo: float
    referencia_type: Optional[str]
    referencia_id: Optional[uuid.UUID]
    observaciones: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
