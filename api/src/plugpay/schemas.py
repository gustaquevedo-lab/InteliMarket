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
    customer_cpf: Optional[str] = None
    customer_cpf_cnpj: Optional[str] = None
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


class PlugpayTransactionItem(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    sale_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None
    tipo_operacion: str
    id_transacao: Optional[str] = None
    referencia_interna: Optional[str] = None
    qr_code_id: Optional[str] = None
    value_brl: Optional[float] = None
    numero_cuotas: Optional[int] = None
    moneda_origen: Optional[str] = None
    monto_origen: Optional[float] = None
    exitosa: bool
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlugpayTransactionListResponse(BaseModel):
    ok: bool = True
    items: list[PlugpayTransactionItem]
    total: int
    limit: int
    offset: int


class PlugpaySummaryResponse(BaseModel):
    ok: bool = True
    total_transacciones: int = 0
    total_exitosas: int = 0
    total_fallidas: int = 0
    tasa_exito_pct: float = 0.0
    volumen_pix_brl: float = 0.0
    volumen_pix_pyg: float = 0.0
    volumen_parcelado_brl: float = 0.0
    volumen_parcelado_pyg: float = 0.0
    total_volumen_brl: float = 0.0
    total_volumen_pyg: float = 0.0
    transacciones_con_venta: int = 0

