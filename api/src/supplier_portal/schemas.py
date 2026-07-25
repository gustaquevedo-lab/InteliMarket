from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class SupplierRegisterRequest(BaseModel):
    supplier_id: str
    company_id: str
    email: str
    password: str = Field(min_length=6)
    nombre: str
    telefono: Optional[str] = None
    cargo: Optional[str] = None


class SupplierLoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer_supplier"


class SupplierProfileResponse(BaseModel):
    id: UUID
    supplier_id: UUID
    email: str
    nombre: str
    telefono: Optional[str]
    cargo: Optional[str]
    activo: bool


class PurchaseOrderSummary(BaseModel):
    id: UUID
    numero: str
    fecha: datetime
    estado: str
    total: float
    moneda: str
    item_count: int
    fecha_entrega_estimada: Optional[str]
    fecha_confirmacion_proveedor: Optional[datetime]


class PurchaseOrderItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    descripcion: Optional[str]
    cantidad: float
    precio_unitario: float
    total: float


class PurchaseOrderDetail(BaseModel):
    id: UUID
    numero: str
    fecha: datetime
    estado: str
    moneda: str
    subtotal: float
    total: float
    observaciones: Optional[str]
    condiciones_pago: Optional[str]
    dias_validez: int
    fecha_entrega_estimada: Optional[str]
    items: list[PurchaseOrderItemResponse]


class ConfirmOrderInput(BaseModel):
    fecha_despacho: Optional[str] = None
    observaciones: Optional[str] = None


class SupplierProductCatalogInput(BaseModel):
    product_id: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    precio: Decimal = Field(ge=0)
    stock_disponible: Optional[Decimal] = None
    unidad_medida: Optional[str] = None
    activo: bool = True


class SupplierProductResponse(BaseModel):
    id: UUID
    nombre: str
    descripcion: Optional[str]
    precio: float
    stock_disponible: float
    unidad_medida: Optional[str]
    activo: bool
    created_at: datetime


class DocumentCreateInput(BaseModel):
    tipo: str  # factura, remito, certificado, ficha_tecnica, otro
    nombre: str
    descripcion: Optional[str] = None
    filename: str
    file_url: str
    file_size: Optional[int] = None
    purchase_order_id: Optional[str] = None


class DocumentResponse(BaseModel):
    id: UUID
    tipo: str
    nombre: str
    descripcion: Optional[str]
    filename: str
    file_url: str
    file_size: Optional[int]
    purchase_order_id: Optional[UUID]
    estado: str
    created_at: datetime


class PaymentSummary(BaseModel):
    invoice_id: UUID
    numero: Optional[str]
    fecha: datetime
    total: float
    pagado: float
    saldo: float
    estado: str
