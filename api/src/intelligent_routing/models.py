from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON, Date, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class RouteOptimization(Base):
    __tablename__ = "ir_route_optimizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    driver_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    vehicle_id = Column(UUID(as_uuid=True), nullable=True)
    date = Column(Date, nullable=False, index=True)
    total_stops = Column(Integer, default=0)
    total_distance_km = Column(Numeric(10, 2), nullable=True)
    total_duration_min = Column(Numeric(10, 2), nullable=True)
    optimized_distance_km = Column(Numeric(10, 2), nullable=True)
    optimized_duration_min = Column(Numeric(10, 2), nullable=True)
    saving_distance_pct = Column(Numeric(5, 2), nullable=True)
    saving_duration_pct = Column(Numeric(5, 2), nullable=True)
    algorithm = Column(String(30), default="nearest_neighbor_2opt")  # nearest_neighbor, nearest_neighbor_2opt, savings_algorithm
    constraints_applied = Column(JSON, nullable=True)  # {time_windows, capacity, temperature_zones}
    stops_order = Column(JSON, nullable=True)  # ordered list of stop_ids
    status = Column(String(20), default="completed")  # draft, completed, applied
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VehicleLoadConfig(Base):
    __tablename__ = "ir_vehicle_load_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    vehicle_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    max_volume_m3 = Column(Numeric(10, 2), nullable=True)
    max_weight_kg = Column(Numeric(10, 2), nullable=True)
    max_pallets = Column(Integer, nullable=True)
    temperature_min = Column(Numeric(5, 2), nullable=True)  # min celsius for refrigerated
    temperature_max = Column(Numeric(5, 2), nullable=True)
    has_refrigeration = Column(Boolean, default=False)
    preferred_order = Column(String(20), default="lifo")  # lifo, fifo, by_zone
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LoadOptimizationResult(Base):
    __tablename__ = "ir_load_optimization_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    vehicle_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    route_optimization_id = Column(UUID(as_uuid=True), ForeignKey("ir_route_optimizations.id"), nullable=True)
    total_volume_m3 = Column(Numeric(10, 2), nullable=True)
    total_weight_kg = Column(Numeric(10, 2), nullable=True)
    total_pallets = Column(Integer, nullable=True)
    utilization_volume_pct = Column(Numeric(5, 2), nullable=True)
    utilization_weight_pct = Column(Numeric(5, 2), nullable=True)
    load_order = Column(JSON, nullable=True)  # ordered list of {stop_id, product_id, qty, volume, weight}
    temperature_zones = Column(JSON, nullable=True)
    constraints_satisfied = Column(Boolean, default=True)
    warnings = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DynamicRerouteRequest(Base):
    __tablename__ = "ir_dynamic_reroute_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    driver_id = Column(UUID(as_uuid=True), nullable=True)
    route_optimization_id = Column(UUID(as_uuid=True), ForeignKey("ir_route_optimizations.id"), nullable=True)
    reason = Column(String(30), nullable=False)  # urgent_delivery, cancellation, address_change, traffic, breakdown
    new_stop_id = Column(UUID(as_uuid=True), nullable=True)
    cancel_stop_id = Column(UUID(as_uuid=True), nullable=True)
    original_order = Column(JSON, nullable=True)
    optimized_order = Column(JSON, nullable=True)
    extra_distance_km = Column(Numeric(10, 2), nullable=True)
    extra_duration_min = Column(Numeric(10, 2), nullable=True)
    status = Column(String(20), default="pending")  # pending, applied, rejected
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EtaPrediction(Base):
    __tablename__ = "ir_eta_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    origin_lat = Column(Numeric(10, 7), nullable=False)
    origin_lng = Column(Numeric(10, 7), nullable=False)
    dest_lat = Column(Numeric(10, 7), nullable=False)
    dest_lng = Column(Numeric(10, 7), nullable=False)
    distance_km = Column(Numeric(10, 2), nullable=False)
    base_duration_min = Column(Numeric(10, 2), nullable=False)
    traffic_factor = Column(Numeric(5, 2), default=1.0)
    zone_factor = Column(Numeric(5, 2), default=1.0)
    time_factor = Column(Numeric(5, 2), default=1.0)
    predicted_duration_min = Column(Numeric(10, 2), nullable=False)
    confidence_score = Column(Numeric(5, 2), nullable=True)
    zone = Column(String(100), nullable=True)
    hora_dia = Column(Time, nullable=True)
    dia_semana = Column(Integer, nullable=True)
    actual_duration_min = Column(Numeric(10, 2), nullable=True)
    error_min = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RouteEfficiencyMetric(Base):
    __tablename__ = "ir_route_efficiency_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    driver_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    vehicle_id = Column(UUID(as_uuid=True), nullable=True)
    date = Column(Date, nullable=False, index=True)
    total_stops = Column(Integer, default=0)
    completed_stops = Column(Integer, default=0)
    total_distance_km = Column(Numeric(10, 2), nullable=True)
    optimal_distance_km = Column(Numeric(10, 2), nullable=True)
    distance_efficiency_pct = Column(Numeric(5, 2), nullable=True)
    total_duration_min = Column(Numeric(10, 2), nullable=True)
    optimal_duration_min = Column(Numeric(10, 2), nullable=True)
    duration_efficiency_pct = Column(Numeric(5, 2), nullable=True)
    deliveries_per_hour = Column(Numeric(5, 2), nullable=True)
    avg_stop_duration_min = Column(Numeric(5, 2), nullable=True)
    total_volume_m3 = Column(Numeric(10, 2), nullable=True)
    total_weight_kg = Column(Numeric(10, 2), nullable=True)
    load_utilization_pct = Column(Numeric(5, 2), nullable=True)
    eta_accuracy_pct = Column(Numeric(5, 2), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
