from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    customer_id: str
    company_id: str
    email: str
    password: str = Field(min_length=6)
    nombre: str
    telefono: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer_client"


class ClientUserResponse(BaseModel):
    id: UUID
    customer_id: UUID
    email: str
    nombre: str
    telefono: Optional[str]
    activo: bool
    created_at: datetime


class ClientDeviceCreate(BaseModel):
    push_token: str
    platform: str


class CartItemInput(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    descripcion: Optional[str] = None
    cantidad: Decimal = Field(default=1, ge=0.001)
    precio_unitario: Decimal = Field(default=0, ge=0)
    iva_tasa: Decimal = Field(default=10, ge=0)


class CartItemUpdate(BaseModel):
    cantidad: Decimal = Field(ge=0.001)


class CartItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    variant_id: Optional[UUID]
    descripcion: Optional[str]
    cantidad: float
    precio_unitario: float
    iva_tasa: float
    subtotal: float


class CartResponse(BaseModel):
    id: UUID
    items: list[CartItemResponse]
    total: float
    item_count: int


class AddressCreate(BaseModel):
    nombre: Optional[str] = None
    direccion: str
    ciudad: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    es_default: bool = False


class AddressUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    es_default: Optional[bool] = None


class AddressResponse(BaseModel):
    id: UUID
    nombre: Optional[str]
    direccion: str
    ciudad: Optional[str]
    latitud: Optional[float]
    longitud: Optional[float]
    es_default: bool
    created_at: datetime


class CheckoutInput(BaseModel):
    direccion_entrega: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    condicion: str = "contado"
    observaciones: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    descripcion: Optional[str]
    cantidad: float
    precio_unitario: float
    descuento_pct: float
    descuento_monto: float
    iva_tasa: float
    iva_monto: float
    total: float


class OrderResponse(BaseModel):
    id: UUID
    numero: Optional[str]
    estado: str
    subtotal: float
    descuento_total: float
    total: float
    saldo: float
    direccion_entrega: Optional[str]
    observaciones: Optional[str]
    delivery_id: Optional[UUID]
    items: list[OrderItemResponse]
    created_at: datetime


class ProductResponse(BaseModel):
    id: UUID
    sku: Optional[str]
    codigo_barra: Optional[str]
    nombre: str
    descripcion: Optional[str]
    categoria: Optional[str]
    precio: float
    iva_tasa: float
    stock_disponible: float
    imagen_url: Optional[str]
    unidad_medida: Optional[str]
    activo: bool


class CategoryResponse(BaseModel):
    id: UUID
    nombre: str
    product_count: int


class AccountResponse(BaseModel):
    id: UUID
    nombre: str
    email: str
    telefono: Optional[str]
    credito_limite: float
    credito_disponible: float
    saldo_actual: float
    loyalty_points: int


class PaymentInitInput(BaseModel):
    order_id: str


class PaymentInitResponse(BaseModel):
    checkout_url: Optional[str] = None
    qr_data: Optional[str] = None
    qr_image: Optional[str] = None
    transaction_id: Optional[str] = None


class FavoriteResponse(BaseModel):
    product_id: UUID
    created_at: datetime


class PromotionResponse(BaseModel):
    id: UUID
    nombre: str
    descripcion: Optional[str]
    tipo: str
    valor: float
    codigo_cupon: Optional[str]
    requiere_cupon: bool
    valido_hasta: Optional[datetime]
