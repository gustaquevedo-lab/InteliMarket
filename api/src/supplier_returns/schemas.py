from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class SupplierReturnItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal = Field(ge=Decimal("0.001"))
    precio_unitario: Decimal = Field(ge=0)
    iva_tasa: Decimal = Field(default=10)
    motivo_detalle: Optional[str] = None
    condicion: str = "vencido"


class SupplierReturnItemResponse(BaseModel):
    id: UUID
    return_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal
    precio_unitario: Decimal
    iva_tasa: Decimal
    iva_monto: Decimal
    total: Decimal
    motivo_detalle: Optional[str] = None
    condicion: str
    created_at: datetime

    class Config:
        from_attributes = True


class SupplierReturnCreate(BaseModel):
    company_id: UUID
    supplier_id: UUID
    purchase_order_id: Optional[UUID] = None
    motivo: str
    motivo_detalle: Optional[str] = None
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    items: list[SupplierReturnItemInput]
    warehouse_id: Optional[UUID] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None


class SupplierReturnResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    purchase_order_id: Optional[UUID] = None
    numero: str
    fecha: datetime
    motivo: str
    motivo_detalle: Optional[str] = None
    estado: str
    moneda: str
    tipo_cambio: Decimal
    subtotal: Optional[Decimal] = None
    iva_10: Optional[Decimal] = None
    iva_5: Optional[Decimal] = None
    total: Optional[Decimal] = None
    supplier_invoice_id: Optional[UUID] = None
    warehouse_id: Optional[UUID] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    aprobado_por: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplierReturnWithItems(SupplierReturnResponse):
    items: list[SupplierReturnItemResponse] = []


class SupplierReturnApprove(BaseModel):
    aprobado_por: UUID
    warehouse_id: Optional[UUID] = None
