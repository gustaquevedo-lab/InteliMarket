"""Credit account schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class CreditAccountCreate(BaseModel):
    company_id: uuid.UUID
    customer_id: uuid.UUID
    limite_credito: float = 0


class CreditAccountUpdate(BaseModel):
    limite_credito: Optional[float] = None
    activo: Optional[bool] = None


class CreditAccountResponse(BaseModel):
    id: str
    company_id: str
    customer_id: str
    limite_credito: float
    saldo_disponible: float
    saldo_utilizado: float
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CreditPayment(BaseModel):
    monto: float
    referencia: Optional[str] = None
    observaciones: Optional[str] = None


class CreditMovementResponse(BaseModel):
    id: str
    company_id: str
    credit_account_id: str
    customer_id: str
    tipo: str
    monto: float
    saldo_anterior: float
    saldo_nuevo: float
    referencia_type: Optional[str]
    referencia_id: Optional[str]
    observaciones: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
