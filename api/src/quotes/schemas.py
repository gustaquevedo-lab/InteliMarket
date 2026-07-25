from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class QuoteItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal = Field(ge=Decimal("0.001"))
    precio_unitario: Decimal = Field(ge=0)
    descuento_pct: Decimal = Field(default=0, ge=0, le=100)
    iva_tasa: Decimal = Field(default=10)


class QuoteItemResponse(BaseModel):
    id: UUID
    quote_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal
    precio_unitario: Decimal
    descuento_pct: Decimal
    iva_tasa: Decimal
    iva_monto: Decimal
    total: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class QuoteCreate(BaseModel):
    company_id: UUID
    customer_id: UUID
    branch_id: Optional[UUID] = None
    valido_hasta: Optional[date] = None
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    items: list[QuoteItemInput]
    observaciones: Optional[str] = None
    condiciones_pago: Optional[str] = None
    user_id: Optional[UUID] = None


class QuoteUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    valido_hasta: Optional[date] = None
    moneda: Optional[str] = None
    tipo_cambio: Optional[Decimal] = None
    items: Optional[list[QuoteItemInput]] = None
    observaciones: Optional[str] = None
    condiciones_pago: Optional[str] = None


class QuoteResponse(BaseModel):
    id: UUID
    company_id: UUID
    customer_id: UUID
    branch_id: Optional[UUID] = None
    numero: str
    fecha: datetime
    valido_hasta: Optional[date] = None
    estado: str
    moneda: str
    tipo_cambio: Decimal
    subtotal: Optional[Decimal] = None
    descuento_total: Optional[Decimal] = None
    base_gravada_10: Optional[Decimal] = None
    base_gravada_5: Optional[Decimal] = None
    base_exenta: Optional[Decimal] = None
    iva_10: Optional[Decimal] = None
    iva_5: Optional[Decimal] = None
    total: Optional[Decimal] = None
    observaciones: Optional[str] = None
    condiciones_pago: Optional[str] = None
    user_id: Optional[UUID] = None
    sale_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QuoteWithItems(QuoteResponse):
    items: list[QuoteItemResponse] = []


class QuoteConvertToSale(BaseModel):
    branch_id: Optional[UUID] = None
    emission_point_id: Optional[UUID] = None
    tipo_comprobante: str = "factura"
    condicion: str = "contado"
    user_id: Optional[UUID] = None
