from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class OrderItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal = Field(ge=Decimal("0.001"))
    precio_unitario: Decimal = Field(ge=0)
    descuento_pct: Decimal = Field(default=0, ge=0, le=100)
    iva_tasa: Decimal = Field(default=10)


class OrderItemResponse(BaseModel):
    id: UUID
    order_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal
    cantidad_pendiente: Optional[Decimal] = None
    cantidad_facturada: Decimal
    cantidad_entregada: Decimal
    precio_unitario: Decimal
    descuento_pct: Decimal
    iva_tasa: Decimal
    iva_monto: Decimal
    total: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class SalesOrderCreate(BaseModel):
    company_id: UUID
    branch_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    fecha_entrega_solicitada: Optional[date] = None
    prioridad: str = "normal"
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    condicion: str = "contado"
    items: list[OrderItemInput]
    observaciones: Optional[str] = None
    direccion_entrega: Optional[str] = None
    vendedor_id: Optional[UUID] = None
    user_id: Optional[UUID] = None


class SalesOrderUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    fecha_entrega_solicitada: Optional[date] = None
    prioridad: Optional[str] = None
    items: Optional[list[OrderItemInput]] = None
    observaciones: Optional[str] = None
    direccion_entrega: Optional[str] = None


class CustomerSummary(BaseModel):
    id: UUID
    razon_social: str
    ruc: Optional[str] = None
    ci: Optional[str] = None

    class Config:
        from_attributes = True


class SalesOrderResponse(BaseModel):
    id: UUID
    company_id: UUID
    branch_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    customer: Optional[CustomerSummary] = None
    numero: str
    fecha: datetime
    fecha_entrega_solicitada: Optional[date] = None
    fecha_entrega_estimada: Optional[date] = None
    estado: str
    prioridad: str
    moneda: str
    tipo_cambio: Decimal
    condicion: str
    subtotal: Optional[Decimal] = None
    descuento_total: Optional[Decimal] = None
    total: Optional[Decimal] = None
    observaciones: Optional[str] = None
    direccion_entrega: Optional[str] = None
    vendedor_id: Optional[UUID] = None
    aprobado_por: Optional[UUID] = None
    user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesOrderWithItems(SalesOrderResponse):
    items: list[OrderItemResponse] = []
