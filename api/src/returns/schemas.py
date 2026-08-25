from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class ReturnItemInput(BaseModel):
    sale_item_id: Optional[UUID] = None
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal = Field(ge=Decimal("0.001"))
    precio_unitario: Decimal = Field(ge=0)
    iva_tasa: Decimal = Field(default=10)
    motivo_detalle: Optional[str] = None
    condicion: str = "buen_estado"


class ReturnItemResponse(BaseModel):
    id: UUID
    return_id: UUID
    sale_item_id: Optional[UUID] = None
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
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


class ReturnCreate(BaseModel):
    company_id: UUID
    branch_id: Optional[UUID] = None
    sale_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    tipo: str = "devolucion"
    motivo: str
    motivo_detalle: Optional[str] = None
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    items: list[ReturnItemInput]
    warehouse_id: Optional[UUID] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None


class ReturnResponse(BaseModel):
    id: UUID
    company_id: UUID
    branch_id: Optional[UUID] = None
    sale_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_ruc: Optional[str] = None
    sale_numero: Optional[str] = None
    numero: str
    fecha: datetime
    tipo: str
    motivo: str
    motivo_detalle: Optional[str] = None
    estado: str
    moneda: str
    tipo_cambio: Decimal
    subtotal: Optional[Decimal] = None
    iva_10: Optional[Decimal] = None
    iva_5: Optional[Decimal] = None
    total: Optional[Decimal] = None
    nota_credito_id: Optional[UUID] = None
    nota_credito_numero: Optional[str] = None
    nota_credito_error: Optional[str] = None
    warehouse_id: Optional[UUID] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    aprobado_por: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReturnWithItems(ReturnResponse):
    items: list[ReturnItemResponse] = []


class ReturnApprove(BaseModel):
    aprobado_por: UUID
    warehouse_id: Optional[UUID] = None
