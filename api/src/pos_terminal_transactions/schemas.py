from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import uuid


class PosTerminalTransactionCreate(BaseModel):
    sale_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None
    tipo_operacion: str
    terminal_ip: Optional[str] = None
    punto_emision: Optional[str] = None
    factura_nro_provisional: Optional[str] = None
    bin: Optional[str] = None
    nsu: Optional[str] = None
    codigo_autorizacion: Optional[str] = None
    codigo_comercio: Optional[str] = None
    issuer_id: Optional[str] = None
    nombre_tarjeta: Optional[str] = None
    pan: Optional[str] = None
    mensaje_display: Optional[str] = None
    nombre_cliente: Optional[str] = None
    monto: Optional[float] = None
    monto_vuelto: Optional[float] = None
    monto_comision: Optional[float] = None
    monto_extraccion: Optional[float] = None
    saldo: Optional[float] = None
    moneda_alt: Optional[str] = None
    monto_alt: Optional[float] = None
    exitosa: bool = False
    verificado_automaticamente: bool = True
    error_message: Optional[str] = None
    raw_response: Optional[Any] = None


class PosTerminalTransactionUpdate(BaseModel):
    sale_id: Optional[uuid.UUID] = None


class PosTerminalTransactionResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    sale_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None
    tipo_operacion: str
    terminal_ip: Optional[str] = None
    punto_emision: Optional[str] = None
    factura_nro_provisional: Optional[str] = None
    bin: Optional[str] = None
    nsu: Optional[str] = None
    codigo_autorizacion: Optional[str] = None
    codigo_comercio: Optional[str] = None
    issuer_id: Optional[str] = None
    nombre_tarjeta: Optional[str] = None
    pan: Optional[str] = None
    mensaje_display: Optional[str] = None
    nombre_cliente: Optional[str] = None
    monto: Optional[float] = None
    monto_vuelto: Optional[float] = None
    monto_comision: Optional[float] = None
    monto_extraccion: Optional[float] = None
    saldo: Optional[float] = None
    moneda_alt: Optional[str] = None
    monto_alt: Optional[float] = None
    exitosa: bool
    verificado_automaticamente: bool
    error_message: Optional[str] = None
    raw_response: Optional[Any] = None
    created_at: datetime

    class Config:
        from_attributes = True
