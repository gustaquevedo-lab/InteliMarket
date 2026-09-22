"""Schemas for Institutional Vouchers"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class VoucherCheckResponse(BaseModel):
    id: UUID
    convenio_nombre: str
    numero_vale: str
    codigo_barras: str
    monto_inicial: Decimal
    saldo_disponible: Decimal
    estado: str
    fecha_vencimiento: date
    es_valido: bool
    mensaje: str
    beneficiario_nombre: Optional[str] = None


class VoucherRedeemRequest(BaseModel):
    codigo_barras: str
    sale_id: Optional[UUID] = None
    caja_session_id: Optional[UUID] = None
    caja_numero: Optional[str] = None
    usuario_id: Optional[UUID] = None
    beneficiario_nombre: Optional[str] = None


class VoucherRedeemResponse(BaseModel):
    success: bool
    mensaje: str
    voucher_id: UUID
    convenio_nombre: str
    numero_vale: str
    monto_aplicado: Decimal
    saldo_restante: Decimal


class VoucherSeedUPRequest(BaseModel):
    total_vales: int = Field(default=75, ge=1, le=500)
    monto_por_vale: Decimal = Field(default=Decimal("100000"))
    fecha_vencimiento: date = Field(default=date(2026, 12, 31))
    factura_numero: Optional[str] = None


class VoucherItemSummary(BaseModel):
    id: UUID
    numero_vale: str
    codigo_barras: str
    monto_inicial: Decimal
    saldo_disponible: Decimal
    estado: str
    canjeado_at: Optional[datetime] = None
    canjeado_caja_numero: Optional[str] = None
    canjeado_en_sale_id: Optional[UUID] = None
    beneficiario_nombre: Optional[str] = None


class ConvenioSummaryResponse(BaseModel):
    convenio_nombre: str
    total_emitidos: int
    total_canjeados: int
    total_activos: int
    monto_total_emitido: Decimal
    monto_total_canjeado: Decimal
    monto_saldo_calle: Decimal
    factura_emision_numero: Optional[str] = None
    cliente_ruc: Optional[str] = None
    cliente_razon_social: Optional[str] = None
    vales: list[VoucherItemSummary]


class VoucherLinkInvoiceRequest(BaseModel):
    convenio_nombre: str = Field(default="Universidad del Pacífico")
    factura_numero: str = Field(..., min_length=3, max_length=50)


class VoucherBatchCreateRequest(BaseModel):
    convenio_nombre: str = Field(..., min_length=3)
    cliente_ruc: Optional[str] = None
    cliente_razon_social: Optional[str] = None
    total_vales: int = Field(ge=1, le=1000)
    monto_por_vale: Decimal = Field(gt=0)
    fecha_vencimiento: date
    factura_numero: Optional[str] = None
    prefijo_codigo: Optional[str] = None
