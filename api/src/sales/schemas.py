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


class SaleCreate(BaseModel):
    company_id: UUID
    branch_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    emission_point_id: Optional[UUID] = None
    tipo_comprobante: str = "ticket"
    condicion: str = "contado"
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    items: list[SaleItemInput]
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None


class SaleResponse(BaseModel):
    id: UUID
    company_id: UUID
    branch_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    numero: str
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


class CashSessionCreate(BaseModel):
    cash_register_id: UUID
    user_id: UUID
    monto_apertura: Decimal = Decimal("0")


class CashSessionResponse(BaseModel):
    id: UUID
    cash_register_id: UUID
    user_id: UUID
    fecha_apertura: datetime
    monto_apertura: Decimal
    fecha_cierre: Optional[datetime] = None
    monto_cierre_esperado: Optional[Decimal] = None
    monto_cierre_real: Optional[Decimal] = None
    diferencia: Optional[Decimal] = None
    estado: str
    observaciones_cierre: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CashSessionClose(BaseModel):
    monto_cierre_real: Decimal
    observaciones: Optional[str] = None
