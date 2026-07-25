"""E-commerce schemas — sync + storefront"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


# ── Auth ────────────────────────────────────────────────────────

class EcommerceRegister(BaseModel):
    customer_id: str
    email: str
    password: str
    nombre: str
    telefono: Optional[str] = None
    direccion_envio: Optional[str] = None


class EcommerceLogin(BaseModel):
    email: str
    password: str


class EcommerceToken(BaseModel):
    access_token: str
    token_type: str = "bearer_ecommerce"
    customer: dict


class EcommerceCustomerResponse(BaseModel):
    id: UUID
    email: str
    nombre: str
    telefono: Optional[str]
    direccion_envio: Optional[str]
    activo: bool
    created_at: datetime


# ── Cart ────────────────────────────────────────────────────────

class CartItemCreate(BaseModel):
    product_id: str
    cantidad: float = Field(gt=0)


class CartItemUpdate(BaseModel):
    cantidad: float = Field(gt=0)


class CartItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_nombre: Optional[str]
    cantidad: float
    precio_unitario: float
    moneda: str
    subtotal: float

    class Config:
        from_attributes = True


class CartResponse(BaseModel):
    id: UUID
    customer_id: UUID
    moneda: str
    items: list[CartItemResponse]
    total: float

    class Config:
        from_attributes = True


# ── Checkout ────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    metodo_pago: str = Field(..., pattern="^(pagopar|kuapay|bancard|transferencia)$")
    direccion_envio: Optional[str] = None
    notas: Optional[str] = None


class CheckoutResponse(BaseModel):
    order_id: UUID
    numero: str
    total: float
    metodo_pago: str
    pago_url: Optional[str] = None


# ── Orders ──────────────────────────────────────────────────────

class OrderItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_nombre: Optional[str]
    cantidad: float
    precio_unitario: float
    subtotal: float

    class Config:
        from_attributes = True


class OrderPaymentResponse(BaseModel):
    id: UUID
    metodo: str
    monto: float
    estado: str
    referencia_externa: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: UUID
    numero: str
    estado: str
    moneda: str
    subtotal: float
    descuento: float
    total: float
    metodo_pago: Optional[str]
    pago_estado: str
    direccion_envio: Optional[str]
    notas: Optional[str]
    items: list[OrderItemResponse]
    payments: list[OrderPaymentResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    id: UUID
    numero: str
    estado: str
    total: float
    moneda: str
    metodo_pago: Optional[str]
    pago_estado: str
    items_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Dashboard ──────────────────────────────────────────────────

class EcommerceDashboard(BaseModel):
    total_orders: int
    pending_orders: int
    last_order: Optional[OrderResponse]
    recent_orders: list[OrderListResponse]


# ── Sync (existing) ─────────────────────────────────────────────

class EcommerceSyncStart(BaseModel):
    tipo: str = Field(..., pattern="^(catalogo|precios|stock|pedidos)$")
    full_sync: bool = False


class EcommerceSyncResult(BaseModel):
    sync_id: UUID
    tipo: str
    productos_procesados: int
    errores: list[str]


class EcommerceSyncLogResponse(BaseModel):
    id: UUID
    company_id: UUID
    tipo: str
    estado: str
    productos_count: int
    errores_count: int
    resultado: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
