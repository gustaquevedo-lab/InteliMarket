"""Inteliforce schemas"""

from pydantic import BaseModel
from typing import Optional, Any
from decimal import Decimal
from datetime import date, datetime
import uuid


class AuthExchangeRequest(BaseModel):
    api_key: str
    cedula: str


class AuthExchangeResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    sales_rep_id: uuid.UUID
    nombre: str
    rol: str


class MeResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    cedula: Optional[str] = None
    rama: Optional[str] = None
    rol: str
    supervisor_id: Optional[uuid.UUID] = None
    activo: bool


class RouteStopResponse(BaseModel):
    customer_id: uuid.UUID
    razon_social: str
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    orden_visita: int
    route_id: uuid.UUID
    route_nombre: str


class TopProduct(BaseModel):
    product_id: uuid.UUID
    nombre: str
    cantidad_total: float
    ultima_compra: Optional[date] = None


class SuggestedProduct(BaseModel):
    product_id: uuid.UUID
    nombre: str
    sku: str
    precio_venta: float
    motivo: str  # "no_compra_hace_X_dias" | "nunca_comprado_top_linea"
    linea_nombre: Optional[str] = None


class Customer360Response(BaseModel):
    customer_id: uuid.UUID
    razon_social: str
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    credito_limite: float
    credito_usado: float
    saldo_disponible: float
    dias_plazo: Optional[int] = None
    cuentas_por_cobrar_pendiente: float
    documentos_vencidos: int
    cheques_en_cartera: float
    ultimas_compras: list[dict]
    top_productos: list[TopProduct] = []
    sugerencias: list[SuggestedProduct] = []


class MobileOrderItem(BaseModel):
    product_id: uuid.UUID
    cantidad: Decimal
    precio_unitario: Decimal
    descuento_pct: Decimal = Decimal("0")
    iva_tasa: Decimal = Decimal("10")


class MobileOrderCreate(BaseModel):
    customer_id: uuid.UUID
    condicion: str = "contado"
    items: list[MobileOrderItem]
    observaciones: Optional[str] = None
    credit_authorization_id: Optional[uuid.UUID] = None


class ProductSearchResult(BaseModel):
    id: uuid.UUID
    sku: str
    nombre: str
    precio_venta: float
    stock: float
    unidad_medida: str
    linea_nombre: Optional[str] = None


class TargetLineBreakdown(BaseModel):
    product_line_id: Optional[uuid.UUID] = None
    nombre: str
    meta_gs: float
    venta_gs: float
    pct_gs: float
    meta_unidades: float
    unidades: float
    pct_unidades: float
    cumplido: bool


class SyncRecord(BaseModel):
    record_type: str  # tracking_log | visit | attendance
    convex_id: str
    employee_convex_id: Optional[str] = None
    recorded_at: Optional[datetime] = None
    payload: dict[str, Any]


class SyncRequest(BaseModel):
    records: list[SyncRecord]


class SyncResponse(BaseModel):
    received: int
    upserted: int


# ── Auth directa (sin SueldOK) ────────────────────────────────────────────────

class DirectLoginRequest(BaseModel):
    cedula: str
    pin: str
    company_id: uuid.UUID


class SetPinRequest(BaseModel):
    cedula: str
    api_key: str  # usa la service key como autorización de bootstrap
    pin: str


# ── Dispositivo FCM ───────────────────────────────────────────────────────────

class RegisterDeviceRequest(BaseModel):
    fcm_token: str
    platform: str = "android"
    app_version: Optional[str] = None


# ── Visitas ───────────────────────────────────────────────────────────────────

class CheckInRequest(BaseModel):
    customer_id: uuid.UUID
    lat: float
    lng: float
    accuracy: float  # metros — se usa para validar rango ajustado
    offline_at: Optional[datetime] = None  # timestamp real si vino offline


class CheckOutRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    notas: Optional[str] = None
    estado: str = "cerrada"  # cerrada | sin_pedido


class VisitResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    estado: str
    checkin_at: datetime
    checkout_at: Optional[datetime] = None
    notas: Optional[str] = None
    sale_id: Optional[uuid.UUID] = None


# ── Incidencias ───────────────────────────────────────────────────────────────

class IncidentCreate(BaseModel):
    tipo: str  # quiebre | producto_danado | falta_espacio | competencia | otro
    descripcion: str
    urgencia: str = "normal"
    producto_id: Optional[uuid.UUID] = None


class IncidentResponse(BaseModel):
    id: uuid.UUID
    tipo: str
    descripcion: str
    urgencia: str
    created_at: datetime


# ── Lotes y vencimientos ──────────────────────────────────────────────────────

class LotExpiryUpsert(BaseModel):
    product_id: uuid.UUID
    lote: Optional[str] = None
    fecha_vencimiento: date
    cantidad_unidades: Optional[int] = None


class LotExpiryResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_nombre: Optional[str] = None
    lote: Optional[str] = None
    fecha_vencimiento: date
    cantidad_unidades: Optional[int] = None
    dias_para_vencer: int
    updated_at: datetime


# ── Media ─────────────────────────────────────────────────────────────────────

class MediaResponse(BaseModel):
    id: uuid.UUID
    tipo: str
    url: str
    filename: Optional[str] = None
    size_bytes: Optional[int] = None
    created_at: datetime
