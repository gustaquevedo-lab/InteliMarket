"""Sales schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class SaleItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal = Field(ge=Decimal("0.001"))
    precio_unitario: Decimal = Field(ge=0)
    descuento_pct: Decimal = Field(default=0, ge=0, le=100)
    iva_tasa: Decimal = Field(default=10)
    costo_unitario: Optional[Decimal] = None


class SalePaymentInput(BaseModel):
    forma_pago: str
    monto: Decimal = Field(gt=0)
    moneda: str = "PYG"


class SaleCreate(BaseModel):
    company_id: UUID
    branch_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    emission_point_id: Optional[UUID] = None
    punto_emision: Optional[str] = None
    tipo_comprobante: str = "ticket"
    condicion: str = "contado"
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    items: list[SaleItemInput]
    payments: list[SalePaymentInput] = []
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    recibo_html: Optional[str] = None
    recibo_escpos_b64: Optional[str] = None
    admin_override_credito: bool = False


class SaleResponse(BaseModel):
    id: UUID
    company_id: UUID
    branch_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    recibo_html: Optional[str] = None
    recibo_escpos_b64: Optional[str] = None
    numero: str
    numero_interno: Optional[str] = None
    fecha: datetime
    tipo_comprobante: str
    condicion: str
    moneda: str
    tipo_cambio: Decimal
    estado: str
    subtotal: Decimal
    descuento_total: Decimal
    base_gravada_10: Decimal
    base_gravada_5: Decimal
    base_exenta: Decimal
    iva_10: Decimal
    iva_5: Decimal
    total: Decimal
    total_pagado: Decimal
    saldo: Optional[Decimal] = None
    cdc: Optional[str] = None
    sifen_estado: Optional[str] = None
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SaleWithItems(SaleResponse):
    items: list[dict] = []


class SaleUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    observaciones: Optional[str] = None
    items: Optional[list[SaleItemInput]] = None


class SaleAddPayment(BaseModel):
    payment_method_id: UUID
    monto: Decimal = Field(gt=0)
    referencia: Optional[str] = None
    user_id: Optional[UUID] = None


class SaleLinkQuote(BaseModel):
    quote_id: UUID


class SaleLinkOrder(BaseModel):
    order_id: UUID


class SaleAttachTicket(BaseModel):
    recibo_escpos_b64: str
