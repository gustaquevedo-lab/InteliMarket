"""InteliEntregas schemas"""

from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime, timezone
from uuid import UUID
from decimal import Decimal


# ============================================================
# DRIVERS
# ============================================================

class DriverCreate(BaseModel):
    nombre: str
    ci: Optional[str] = None
    telefono: str
    email: Optional[str] = None
    pin: Optional[str] = None  # 4-6 digit PIN for driver app login
    licencia_numero: Optional[str] = None
    licencia_vencimiento: Optional[datetime] = None


class DriverUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    pin: Optional[str] = None
    status: Optional[str] = None
    activo: Optional[bool] = None


class DriverLoginRequest(BaseModel):
    telefono: str
    pin: str


class DriverLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DriverTokenData(BaseModel):
    driver_id: str
    company_id: str
    sub: str  # driver_id
    type: str = "driver_access"


class DriverResponse(BaseModel):
    id: UUID
    nombre: str
    ci: Optional[str]
    telefono: str
    email: Optional[str]
    status: str
    rating: Optional[Decimal]
    total_deliveries: int
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# VEHICLES
# ============================================================

class VehicleCreate(BaseModel):
    driver_id: Optional[UUID] = None
    tipo: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None
    patente: Optional[str] = None
    anio: Optional[int] = None
    capacidad_kg: Optional[Decimal] = None
    tiene_caja_termica: bool = False
    seguro_vencimiento: Optional[datetime] = None
    itv_vencimiento: Optional[datetime] = None


class VehicleResponse(BaseModel):
    id: UUID
    tipo: str
    marca: Optional[str]
    modelo: Optional[str]
    patente: Optional[str]
    tiene_caja_termica: bool
    seguro_vencimiento: Optional[datetime] = None
    itv_vencimiento: Optional[datetime] = None
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# DELIVERIES
# ============================================================

class DeliveryCreate(BaseModel):
    sale_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    branch_id: Optional[UUID] = None
    customer_nombre: str
    customer_telefono: Optional[str] = None
    customer_ci: Optional[str] = None
    direccion: str
    barrio: Optional[str] = None
    ciudad: Optional[str] = None
    referencia: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    prioridad: str = "normal"
    observaciones: Optional[str] = None
    instrucciones_entrega: Optional[str] = None
    scheduled_from: Optional[datetime] = None
    scheduled_to: Optional[datetime] = None
    costo_delivery: Decimal = Decimal("0")

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.scheduled_from and self.scheduled_to:
            diff = (self.scheduled_to - self.scheduled_from).total_seconds() / 3600
            if diff < 0:
                raise ValueError("scheduled_to debe ser posterior a scheduled_from")
            if diff > 2:
                raise ValueError("La ventana horaria máxima es de 2 horas")
        elif self.scheduled_from or self.scheduled_to:
            raise ValueError("Deben indicarse ambas fechas (scheduled_from y scheduled_to) para la ventana horaria")
        return self


class DeliveryAssign(BaseModel):
    driver_id: UUID
    vehicle_id: Optional[UUID] = None


class AutoAssignCandidate(BaseModel):
    driver_id: UUID
    driver_nombre: str
    driver_rating: float = 0
    driver_total_deliveries: int = 0
    vehicle_id: Optional[UUID] = None
    vehicle_tipo: Optional[str] = None
    vehicle_capacidad_kg: Optional[float] = None
    distance_km: Optional[float] = None
    score: float = 0


class AutoAssignResponse(BaseModel):
    delivery_id: UUID
    candidates: list[AutoAssignCandidate]


class DeliveryUpdateStatus(BaseModel):
    estado: str
    motivo_falla: Optional[str] = None


class DeliveryProofCreate(BaseModel):
    tipo: str
    url: Optional[str] = None
    codigo_confirmacion: Optional[str] = None
    nombre_recibio: Optional[str] = None
    relacion: Optional[str] = None
    observaciones: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None


class DeliveryResponse(BaseModel):
    id: UUID
    customer_nombre: str
    direccion: str
    barrio: Optional[str]
    ciudad: Optional[str]
    estado: str
    prioridad: str
    driver_id: Optional[UUID]
    route_id: Optional[UUID]
    tracking_code: Optional[str]
    scheduled_from: Optional[datetime] = None
    scheduled_to: Optional[datetime] = None
    costo_delivery: Decimal
    created_at: datetime
    delivered_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============================================================
# ROUTES
# ============================================================

class RouteCreate(BaseModel):
    driver_id: Optional[UUID] = None
    vehicle_id: Optional[UUID] = None
    nombre: str
    fecha: datetime
    observaciones: Optional[str] = None


class RouteAddDelivery(BaseModel):
    delivery_id: UUID
    orden: int


class RouteResponse(BaseModel):
    id: UUID
    nombre: str
    fecha: datetime
    estado: str
    total_stops: int
    completed_stops: int
    driver_id: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# TRACKING
# ============================================================

class TrackingEventCreate(BaseModel):
    delivery_id: UUID
    latitud: float
    longitud: float
    velocidad_kmh: Optional[Decimal] = None
    precision_m: Optional[float] = None
    bateria_pct: Optional[int] = None
    evento: str = "location"
    datos: Optional[dict] = None


class TrackingEventResponse(BaseModel):
    id: UUID
    delivery_id: UUID
    latitud: float
    longitud: float
    evento: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# ZONES
# ============================================================

class ZoneCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    costo_base: Decimal
    costo_km: Decimal = Decimal("0")
    tiempo_estimado_min: int = 30
    radio_km: Optional[Decimal] = None
    centro_lat: Optional[float] = None
    centro_lon: Optional[float] = None


class ZoneResponse(BaseModel):
    id: UUID
    nombre: str
    costo_base: Decimal
    costo_km: Decimal
    tiempo_estimado_min: int
    activo: bool

    class Config:
        from_attributes = True
