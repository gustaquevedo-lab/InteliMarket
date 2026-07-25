"""Tracking — Pydantic schemas for seller tracking, geofencing, performance."""

from datetime import datetime, time
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ─── Seller Profile ───────────────────────────────────────────

class SellerProfileCreate(BaseModel):
    user_id: UUID
    telefono: Optional[str] = None
    zona_asignada: Optional[str] = None
    codigo_vendedor: Optional[str] = None
    photo_url: Optional[str] = None


class SellerProfileUpdate(BaseModel):
    telefono: Optional[str] = None
    zona_asignada: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: Optional[bool] = None


class SellerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; user_id: UUID; company_id: UUID
    photo_url: Optional[str]
    phone_battery_level: int; phone_updated_at: Optional[datetime]
    status: str
    last_lat: Optional[Decimal]; last_lng: Optional[Decimal]
    last_location_updated: Optional[datetime]; last_speed_kmh: Optional[Decimal]
    is_active: bool
    telefono: Optional[str]; zona_asignada: Optional[str]
    codigo_vendedor: Optional[str]


# ─── Seller + User combined for map display ──────────────────

class SellerWithUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; user_id: UUID; company_id: UUID
    photo_url: Optional[str]
    phone_battery_level: int; status: str
    last_lat: Optional[Decimal]; last_lng: Optional[Decimal]
    last_location_updated: Optional[datetime]; last_speed_kmh: Optional[Decimal]
    is_active: bool
    telefono: Optional[str]; zona_asignada: Optional[str]
    codigo_vendedor: Optional[str]
    user_nombre: str = ""
    user_email: str = ""


# ─── GPS Tracking ─────────────────────────────────────────────

class GPSTrackingCreate(BaseModel):
    lat: Decimal
    lng: Decimal
    battery_level: Optional[int] = None
    speed_kmh: Optional[Decimal] = None
    accuracy_meters: Optional[int] = None
    altitude_meters: Optional[Decimal] = None
    recorded_at: Optional[datetime] = None


class GPSTrackingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; seller_id: UUID
    lat: Decimal; lng: Decimal
    battery_level: Optional[int]; speed_kmh: Optional[Decimal]
    accuracy_meters: Optional[int]
    recorded_at: datetime; received_at: datetime


# ─── Route Instance ───────────────────────────────────────────

class RouteInstanceCreate(BaseModel):
    route_id: UUID
    seller_id: UUID
    fecha: datetime
    notas: Optional[str] = None


class RouteInstanceUpdate(BaseModel):
    status: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    total_traveled_km: Optional[Decimal] = None
    notas: Optional[str] = None


class RouteStopVisitCreate(BaseModel):
    customer_id: UUID
    planned_order: int = 0
    planned_arrival: Optional[datetime] = None
    status: str = "pending"


class RouteStopVisitComplete(BaseModel):
    status: str = "completed"
    result: Optional[str] = None
    actual_arrival: Optional[datetime] = None
    actual_departure: Optional[datetime] = None
    order_amount: Decimal = Decimal("0")
    products_count: int = 0
    payment_collected: Decimal = Decimal("0")
    checkin_lat: Optional[Decimal] = None
    checkin_lng: Optional[Decimal] = None
    checkout_lat: Optional[Decimal] = None
    checkout_lng: Optional[Decimal] = None
    distance_from_customer_meters: Optional[int] = None
    customer_rating: Optional[int] = None
    notas: Optional[str] = None
    fotos_url: Optional[list[str]] = None
    firma_url: Optional[str] = None


class RouteStopVisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; instance_id: UUID; customer_id: UUID
    planned_order: int
    planned_arrival: Optional[datetime]
    actual_arrival: Optional[datetime]; actual_departure: Optional[datetime]
    status: str; result: Optional[str]
    order_amount: Decimal; products_count: int
    payment_collected: Decimal
    checkin_lat: Optional[Decimal]; checkin_lng: Optional[Decimal]
    distance_from_customer_meters: Optional[int]
    customer_rating: Optional[int]
    notas: Optional[str]; fotos_url: Optional[list]
    firma_url: Optional[str]; created_at: datetime


class RouteInstanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; route_id: UUID; seller_id: UUID; company_id: UUID
    fecha: datetime; status: str
    started_at: Optional[datetime]; ended_at: Optional[datetime]
    total_traveled_km: Optional[Decimal]
    notas: Optional[str]; created_at: datetime


# ─── Geofence Zones ───────────────────────────────────────────

class GeofenceZoneCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    zone_type: str = "restricted"
    geometry_type: str = "polygon"
    coordinates: list | dict
    color: str = "#ef4444"
    active_start_time: str = "00:00"
    active_end_time: str = "23:59"
    active_days: Optional[list[int]] = None
    alert_on_entry: bool = True
    alert_on_exit: bool = False
    notify_supervisor: bool = True
    severity: str = "medium"


class GeofenceZoneUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    zone_type: Optional[str] = None
    coordinates: Optional[list | dict] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    severity: Optional[str] = None


class GeofenceZoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; company_id: UUID
    nombre: str; descripcion: Optional[str]
    zone_type: str; geometry_type: str
    coordinates: list | dict; color: str
    active_start_time: str; active_end_time: str
    active_days: Optional[list]; severity: str
    alert_on_entry: bool; alert_on_exit: bool
    notify_supervisor: bool; is_active: bool
    created_at: datetime


# ─── Geofence Alerts ──────────────────────────────────────────

class GeofenceAlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; zone_id: UUID; seller_id: UUID
    gps_point_id: Optional[UUID]
    event_type: str
    lat: Optional[Decimal]; lng: Optional[Decimal]
    detected_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]
    status: str; notas: Optional[str]
    created_at: datetime


class GeofenceAlertAck(BaseModel):
    acknowledged_by: UUID
    notas: Optional[str] = None


# ─── Performance Metrics ──────────────────────────────────────

class SellerPerformanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; seller_id: UUID; company_id: UUID
    period_type: str; period_start: datetime; period_end: datetime
    total_visits: int; completed_visits: int; missed_visits: int
    no_answer_count: int
    total_orders: int; total_amount: Decimal
    total_payment_collected: Decimal
    total_traveled_km: Decimal; total_work_hours: Decimal
    productive_hours: Decimal
    orders_per_hour: Decimal; amount_per_hour: Decimal
    visits_per_hour: Decimal
    avg_visit_duration_minutes: int
    avg_travel_between_visits_minutes: int
    avg_customer_rating: Decimal
    performance_score: Optional[int]


# ─── Dashboard / Live Map ─────────────────────────────────────

class LiveMapSeller(BaseModel):
    seller_id: UUID
    user_id: UUID
    nombre: str
    photo_url: Optional[str]
    status: str
    lat: Optional[Decimal]
    lng: Optional[Decimal]
    battery_level: int
    speed_kmh: Optional[Decimal]
    last_updated: Optional[datetime]
    current_route_id: Optional[UUID]
    current_route_name: Optional[str]


class LiveMapData(BaseModel):
    sellers: list[LiveMapSeller]
    geofence_zones: list[GeofenceZoneResponse]
    active_alerts: list[GeofenceAlertResponse]
    today_visits: int
    today_completed: int
    today_orders: int
    today_amount: Decimal
