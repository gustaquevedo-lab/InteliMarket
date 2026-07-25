from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, date, time
import uuid


class RouteStop(BaseModel):
    id: str
    lat: float
    lng: float
    priority: int = 0
    time_window_start: Optional[str] = None  # "HH:MM"
    time_window_end: Optional[str] = None
    service_time_min: int = 5
    volume_m3: float = 0
    weight_kg: float = 0
    temperature_required: Optional[float] = None
    zone: Optional[str] = None
    address: Optional[str] = None


class TSPOptimizeRequest(BaseModel):
    stops: list[RouteStop]
    driver_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    algorithm: str = "nearest_neighbor_2opt"
    constraints: Optional[dict] = None  # {time_windows, capacity, temperature_zones}
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None


class TSPOptimizeResponse(BaseModel):
    ordered_stops: list[dict]
    total_distance_km: float
    total_duration_min: float
    original_distance_km: float
    saving_distance_pct: float
    algorithm: str
    constraints_applied: list[str]
    segments: list[dict]  # [{from, to, distance_km, duration_min}]


class VehicleLoadOptimizeRequest(BaseModel):
    vehicle_id: uuid.UUID
    stops: list[RouteStop]
    load_order: Optional[str] = None  # lifo, fifo, by_zone


class VehicleLoadOptimizeResponse(BaseModel):
    total_volume_m3: float
    total_weight_kg: float
    total_pallets: int
    utilization_volume_pct: float
    utilization_weight_pct: float
    load_order: list[dict]
    temperature_zones: list[dict]
    constraints_satisfied: bool
    warnings: list[str]


class DynamicRerouteRequest(BaseModel):
    driver_id: Optional[uuid.UUID] = None
    route_optimization_id: Optional[str] = None
    reason: str
    current_stops: list[RouteStop]
    current_order: list[str]  # stop ids in current order
    new_stop: Optional[RouteStop] = None
    cancel_stop_id: Optional[str] = None


class DynamicRerouteResponse(BaseModel):
    optimized_order: list[dict]
    extra_distance_km: float
    extra_duration_min: float
    original_order: list[str]
    reason: str


class EtaPredictRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    zone: Optional[str] = None
    hora_dia: Optional[str] = None  # "HH:MM"
    dia_semana: Optional[int] = None  # 0=Monday


class EtaPredictResponse(BaseModel):
    distance_km: float
    base_duration_min: float
    traffic_factor: float
    zone_factor: float
    time_factor: float
    predicted_duration_min: float
    confidence_score: float


class RouteEfficiencyDashboard(BaseModel):
    total_routes: int
    avg_distance_efficiency: Optional[float]
    avg_duration_efficiency: Optional[float]
    avg_deliveries_per_hour: Optional[float]
    avg_load_utilization: Optional[float]
    avg_eta_accuracy: Optional[float]
    total_optimized_stops: int
    by_driver: list[dict]
    recent_routes: list[dict]
