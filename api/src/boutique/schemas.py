"""Pydantic schemas for Boutique module."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# --- Shared ---
class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list


# --- Sizes ---
class SizeBase(BaseModel):
    codigo: str
    nombre: str
    categoria: Optional[str] = None
    orden: Optional[int] = 0
    medida_referencia_cm: Optional[Decimal] = None
    activo: Optional[bool] = True

class SizeCreate(SizeBase): pass
class SizeUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    orden: Optional[int] = None
    medida_referencia_cm: Optional[Decimal] = None
    activo: Optional[bool] = None

class SizeOut(SizeBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    class Config: from_attributes = True


# --- Colors ---
class ColorBase(BaseModel):
    codigo: str
    nombre: str
    hex: Optional[str] = None
    familia: Optional[str] = None
    es_basico: Optional[bool] = False
    orden: Optional[int] = 0
    activo: Optional[bool] = True

class ColorCreate(ColorBase): pass
class ColorUpdate(BaseModel):
    nombre: Optional[str] = None
    hex: Optional[str] = None
    familia: Optional[str] = None
    es_basico: Optional[bool] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None

class ColorOut(ColorBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    class Config: from_attributes = True


# --- Categories ---
class CategoryBase(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    parent_id: Optional[UUID] = None
    nivel: Optional[int] = 0
    activo: Optional[bool] = True
    imagen_url: Optional[str] = None
    orden: Optional[int] = 0

class CategoryCreate(CategoryBase): pass
class CategoryUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    parent_id: Optional[UUID] = None
    activo: Optional[bool] = None
    imagen_url: Optional[str] = None
    orden: Optional[int] = None

class CategoryOut(CategoryBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    children: Optional[list["CategoryOut"]] = []
    class Config: from_attributes = True

class CategorySimpleOut(CategoryBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    class Config: from_attributes = True


# --- Collections ---
class CollectionItemBase(BaseModel):
    producto_id: UUID
    orden: Optional[int] = 0
    destacado: Optional[bool] = False

class CollectionBase(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    temporada: str
    anio: int
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[str] = "borrador"
    imagen_url: Optional[str] = None

class CollectionCreate(CollectionBase):
    items: Optional[list[CollectionItemBase]] = []

class CollectionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    temporada: Optional[str] = None
    anio: Optional[int] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[str] = None
    imagen_url: Optional[str] = None

class CollectionOut(CollectionBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True


# --- Products ---
class VariantBase(BaseModel):
    size_id: Optional[UUID] = None
    color_id: Optional[UUID] = None
    sku: str
    ean: Optional[str] = None
    precio_sobrecargo: Optional[Decimal] = 0
    stock_actual: Optional[int] = 0
    stock_minimo: Optional[int] = 0
    activo: Optional[bool] = True

class VariantOut(VariantBase):
    id: UUID
    stock_disponible: Optional[int] = 0
    precio_final: Optional[Decimal] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class ProductBase(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    categoria_id: Optional[UUID] = None
    tipo_producto: Optional[str] = "indumentaria"
    genero: Optional[str] = None
    marca: Optional[str] = None
    material: Optional[str] = None
    cuidados: Optional[str] = None
    precio_base: Decimal
    costo_promedio: Optional[Decimal] = None
    moneda: Optional[str] = "PYG"
    imagen_principal: Optional[str] = None
    imagenes_adicionales: Optional[list] = []
    tags: Optional[list[str]] = []
    activo: Optional[bool] = True
    destacado: Optional[bool] = False
    incluye_gift_wrapping: Optional[bool] = False
    gift_wrapping_surcharge: Optional[Decimal] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

class ProductCreate(ProductBase):
    variantes: Optional[list[VariantBase]] = []

class ProductUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria_id: Optional[UUID] = None
    tipo_producto: Optional[str] = None
    genero: Optional[str] = None
    marca: Optional[str] = None
    material: Optional[str] = None
    cuidados: Optional[str] = None
    precio_base: Optional[Decimal] = None
    costo_promedio: Optional[Decimal] = None
    moneda: Optional[str] = None
    imagen_principal: Optional[str] = None
    imagenes_adicionales: Optional[list] = None
    tags: Optional[list[str]] = None
    activo: Optional[bool] = None
    destacado: Optional[bool] = None
    incluye_gift_wrapping: Optional[bool] = None
    gift_wrapping_surcharge: Optional[Decimal] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

class ProductOut(ProductBase):
    id: UUID
    company_id: UUID
    variantes: Optional[list[VariantOut]] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True


# --- Sales ---
class SaleItemCreate(BaseModel):
    producto_id: UUID
    variant_id: Optional[UUID] = None
    cantidad: int
    precio_unitario: Decimal
    descuento_item: Optional[Decimal] = 0

class SaleCreate(BaseModel):
    codigo: str
    customer_id: UUID
    fecha: Optional[datetime] = None
    subtotal: Decimal
    descuento: Optional[Decimal] = 0
    impuesto: Optional[Decimal] = 0
    total: Decimal
    moneda: Optional[str] = "PYG"
    tipo_venta: Optional[str] = "tienda"
    incluye_gift_wrapping: Optional[bool] = False
    gift_wrapping_fee: Optional[Decimal] = 0
    notas: Optional[str] = None
    external_order_id: Optional[UUID] = None
    items: list[SaleItemCreate]

class SaleOut(BaseModel):
    id: UUID
    company_id: UUID
    codigo: str
    customer_id: UUID
    fecha: datetime
    subtotal: Decimal
    descuento: Decimal
    impuesto: Decimal
    total: Decimal
    moneda: str
    tipo_venta: str
    created_at: datetime
    class Config: from_attributes = True


# --- Returns ---
class ReturnItemCreate(BaseModel):
    sale_item_id: Optional[UUID] = None
    variant_id: UUID
    cantidad: int
    motivo: Optional[str] = None

class ReturnCreate(BaseModel):
    codigo: str
    sale_id: Optional[UUID] = None
    customer_id: UUID
    motivo: str
    tipo_reintegro: Optional[str] = None
    notas: Optional[str] = None
    items: list[ReturnItemCreate]

class ReturnOut(BaseModel):
    id: UUID
    codigo: str
    customer_id: UUID
    fecha: datetime
    motivo: str
    estado: str
    total_reintegro: Optional[Decimal] = None
    created_at: datetime
    class Config: from_attributes = True


# --- Clienteling ---
class ClientProfileBase(BaseModel):
    tipo_cliente: Optional[str] = "regular"
    genero_preferido: Optional[str] = None
    talla_preferida_id: Optional[UUID] = None
    color_preferido_id: Optional[UUID] = None
    marcas_preferidas: Optional[list[str]] = []
    estilo: Optional[str] = None
    temporada_preferida: Optional[str] = None
    cumpleanos: Optional[date] = None
    aniversario: Optional[date] = None
    notas_estilista: Optional[str] = None

class ClientProfileOut(ClientProfileBase):
    id: UUID
    customer_id: UUID
    total_gastado: Decimal
    total_compras: int
    ultima_visita: Optional[datetime] = None
    created_at: datetime
    class Config: from_attributes = True

class InteractionCreate(BaseModel):
    customer_id: UUID
    tipo: str
    canal: Optional[str] = None
    notas: Optional[str] = None
    proximo_seguimiento: Optional[date] = None

class InteractionOut(BaseModel):
    id: UUID
    customer_id: UUID
    tipo: str
    fecha: datetime
    canal: Optional[str] = None
    notas: Optional[str] = None
    created_at: datetime
    class Config: from_attributes = True


# --- Loyalty ---
class LoyaltyAccountOut(BaseModel):
    id: UUID
    customer_id: UUID
    tier_id: Optional[UUID] = None
    puntos_acumulados: int
    puntos_canjeados: int
    puntos_disponibles: int
    gasto_total: Decimal
    class Config: from_attributes = True


# --- Markdown ---
class MarkdownRuleBase(BaseModel):
    codigo: str
    nombre: str
    tipo: str
    temporada: Optional[str] = None
    categoria_id: Optional[UUID] = None
    descuento_maximo: Optional[Decimal] = 70
    descuento_minimo: Optional[Decimal] = 5
    dias_antes_fin_temporada: Optional[int] = None
    factor_rotacion_minimo: Optional[Decimal] = None
    activo: Optional[bool] = True
    prioridad: Optional[int] = 0

class MarkdownRuleCreate(MarkdownRuleBase): pass
class MarkdownRuleOut(MarkdownRuleBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    class Config: from_attributes = True


# --- AR Metadata ---
class ARMetadataOut(BaseModel):
    id: UUID
    producto_id: UUID
    modelo_3d_url: Optional[str] = None
    glb_url: Optional[str] = None
    usdz_url: Optional[str] = None
    talles_disponibles_ar: Optional[list[str]] = []
    proveedor_ar: Optional[str] = None
    class Config: from_attributes = True


# --- Events ---
class EventCreate(BaseModel):
    codigo: str
    nombre: str
    tipo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: Optional[datetime] = None
    ubicacion: Optional[str] = None
    capacidad_maxima: Optional[int] = None
    invitados: Optional[int] = 0
    estado: Optional[str] = "borrador"
    imagen_url: Optional[str] = None

class EventOut(EventCreate):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class EventGuestCreate(BaseModel):
    customer_id: UUID
    confirmado: Optional[bool] = False
    asistio: Optional[bool] = False
    acompanantes: Optional[int] = 1
    notas: Optional[str] = None

class EventGuestOut(BaseModel):
    id: UUID
    event_id: UUID
    customer_id: UUID
    confirmado: Optional[bool] = False
    asistio: Optional[bool] = False
    acompanantes: Optional[int] = 1
    notas: Optional[str] = None
    created_at: datetime
    class Config: from_attributes = True


# --- Dashboard ---
class DashboardOut(BaseModel):
    total_productos: int
    total_variantes: int
    total_ventas_mes: int
    total_ingresos_mes: Decimal
    total_clientes: int
    devoluciones_mes: int
    productos_bajo_stock: int
    variantes_con_markdown: int
    loyalty_puntos_emitidos: int
