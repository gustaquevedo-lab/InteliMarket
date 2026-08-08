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
