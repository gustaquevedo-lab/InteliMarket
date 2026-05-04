"""Purchase schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class SupplierCreate(BaseModel):
    company_id: UUID
    tipo_persona: str = "juridica"
    ruc: Optional[str] = Field(default=None, max_length=15)
    ci: Optional[str] = Field(default=None, max_length=20)
    razon_social: str = Field(min_length=2, max_length=255)
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    plazo_pago_dias: int = 0


class SupplierUpdate(BaseModel):
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    plazo_pago_dias: Optional[int] = None
    activo: Optional[bool] = None


class SupplierResponse(BaseModel):
    id: UUID
    company_id: UUID
    tipo_persona: str
    ruc: Optional[str] = None
    ci: Optional[str] = None
    razon_social: str
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    plazo_pago_dias: int
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class POItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal = Field(ge=Decimal("0.001"))
    precio_unitario: Decimal = Field(ge=0)
    descuento_pct: Decimal = Field(default=0, ge=0, le=100)
    iva_tasa: Optional[Decimal] = None


class POCreate(BaseModel):
    company_id: UUID
    supplier_id: UUID
    fecha_entrega_estimada: Optional[datetime] = None
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    items: list[POItemInput]
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None


class POResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    numero: str
    fecha: datetime
    fecha_entrega_estimada: Optional[datetime] = None
    estado: str
    moneda: str
    tipo_cambio: Decimal
    subtotal: Optional[Decimal] = None
    descuento_total: Optional[Decimal] = None
    iva_10: Optional[Decimal] = None
    iva_5: Optional[Decimal] = None
    total: Optional[Decimal] = None
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReceiptItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    cantidad_ordenada: Optional[Decimal] = None
    cantidad_recibida: Decimal = Field(ge=Decimal("0.001"))
    costo_unitario: Decimal = Field(ge=0)
    batch_id: Optional[UUID] = None


class ReceiptCreate(BaseModel):
    company_id: UUID
    purchase_order_id: Optional[UUID] = None
    warehouse_id: UUID
    proveedor_ref: Optional[str] = None
    items: list[ReceiptItemInput]
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None


class ReceiptResponse(BaseModel):
    id: UUID
    company_id: UUID
    purchase_order_id: Optional[UUID] = None
    warehouse_id: UUID
    numero: str
    fecha: datetime
    proveedor_ref: Optional[str] = None
    estado: str
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
