from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import uuid


class ComplianceCheckResponse(BaseModel):
    ok: bool
    data: Optional[Any] = None
    error_message: Optional[str] = None


class PixCreateRequest(BaseModel):
    monto: float
    moneda: str = "PYG"
    customer_cpf_cnpj: str
    sale_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None


class PixQuoteRequest(BaseModel):
    monto: float
    moneda: str = "PYG"


class CalcularParceladoRequest(BaseModel):
    monto: float
    moneda: str = "PYG"
    cuotas: int


class StartParceladoRequest(BaseModel):
    monto: float
    moneda: str = "PYG"
    cuotas: int
    customer_cpf: str
    customer_phone: str
    sale_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None


class PlugpayTransactionResponse(BaseModel):
    ok: bool
    data: Optional[Any] = None
    error_message: Optional[str] = None
    transaction_log_id: Optional[uuid.UUID] = None
