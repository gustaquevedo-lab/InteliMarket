"""Tracking — Models for real-time seller tracking, geofencing, performance metrics."""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class SellerProfile(Base):
    """Extended profile for sales reps with real-time tracking fields."""
    __tablename__ = "track_seller_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    photo_url = Column(String(500))
    phone_battery_level = Column(Integer, server_default="100", comment="0-100 battery percentage")
    phone_updated_at = Column(DateTime(timezone=True))

    status = Column(String(20), nullable=False, server_default="offline")
    # online, offline, busy, idle

    last_lat = Column(Numeric(10, 7))
    last_lng = Column(Numeric(10, 7))
    last_location_updated = Column(DateTime(timezone=True))
    last_speed_kmh = Column(Numeric(6, 2), server_default="0")

    is_active = Column(Boolean, server_default="true")

    telefono = Column(String(30))
    zona_asignada = Column(String(100))
    codigo_vendedor = Column(String(20))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tracking_points = relationship("SellerGPSTracking", back_populates="seller", cascade="all, delete-orphan",
                                    order_by="SellerGPSTracking.recorded_at.desc()")


class SellerGPSTracking(Base):
    """GPS ping history for each seller — breadcrumb trail."""
    __tablename__ = "track_gps_points"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    seller_id = Column(UUID(as_uuid=True), ForeignKey("track_seller_profiles.id"), nullable=False, index=True)

    lat = Column(Numeric(10, 7), nullable=False)
    lng = Column(Numeric(10, 7), nullable=False)
    battery_level = Column(Integer, comment="0-100 at time of ping")
    speed_kmh = Column(Numeric(6, 2))
    accuracy_meters = Column(Integer)
    altitude_meters = Column(Numeric(8, 2))

    recorded_at = Column(DateTime(timezone=True), nullable=False, index=True,
                         comment="Timestamp from the device")
    received_at = Column(DateTime(timezone=True), server_default=func.now(),
                         comment="Timestamp when server received the ping")

    seller = relationship("SellerProfile", back_populates="tracking_points")


class RouteInstance(Base):
    """A specific route execution for a seller on a given day (one instance per day)."""
    __tablename__ = "track_route_instances"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    route_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    seller_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    fecha = Column(DateTime(timezone=True), nullable=False, comment="Date of this route execution")
    status = Column(String(20), nullable=False, server_default="planned")
    # planned, in_progress, completed, cancelled

    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    total_traveled_km = Column(Numeric(8, 2), server_default="0")

    notas = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    stops = relationship("RouteStopVisit", back_populates="route_instance", cascade="all, delete-orphan",
                          order_by="RouteStopVisit.planned_order")


class RouteStopVisit(Base):
    """A planned stop within a route instance — what happened at the customer."""
    __tablename__ = "track_route_stops"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    instance_id = Column(UUID(as_uuid=True), ForeignKey("track_route_instances.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    planned_order = Column(Integer, server_default="0")
    planned_arrival = Column(DateTime(timezone=True))

    actual_arrival = Column(DateTime(timezone=True))
    actual_departure = Column(DateTime(timezone=True))

    status = Column(String(20), nullable=False, server_default="pending")
    # pending, in_progress, completed, missed, cancelled, rescheduled

    result = Column(String(30))
    # order_taken, payment_collected, delivery, no_answer, rescheduled, no_sale, visit_only
    no_answer_count = Column(Integer, server_default="0", comment="Consecutive no-answers")

    order_amount = Column(Numeric(15, 2), server_default="0")
    products_count = Column(Integer, server_default="0")
    payment_collected = Column(Numeric(15, 2), server_default="0")

    checkin_lat = Column(Numeric(10, 7), comment="GPS at check-in")
    checkin_lng = Column(Numeric(10, 7))
    checkout_lat = Column(Numeric(10, 7), comment="GPS at check-out")
    checkout_lng = Column(Numeric(10, 7))
    distance_from_customer_meters = Column(Integer, comment="GPS proximity check at check-in")

    customer_rating = Column(Integer, comment="1-5 star rating by seller")
    notas = Column(String(1000))
    fotos_url = Column(JSON)
    firma_url = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    route_instance = relationship("RouteInstance", back_populates="stops")


class GeofenceZone(Base):
    """Restricted, preferred, or watch zones for seller tracking with time-based enforcement."""
    __tablename__ = "track_geofence_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    nombre = Column(String(100), nullable=False)
    descripcion = Column(String(500))
    zone_type = Column(String(20), nullable=False, server_default="restricted")
    # restricted, preferred, watch, off_limits

    geometry_type = Column(String(20), nullable=False, server_default="polygon")
    # polygon, circle

    coordinates = Column(JSON, nullable=False, comment="Polygon [[lng,lat],[lng,lat]] or circle {lat,lng,radius_m}")
    color = Column(String(7), server_default="#ef4444")

    active_start_time = Column(String(5), server_default="00:00", comment="HH:MM format")
    active_end_time = Column(String(5), server_default="23:59", comment="HH:MM format")
    active_days = Column(JSON, comment="[0,1,2,3,4,5,6] 0=Sunday")

    alert_on_entry = Column(Boolean, server_default="true")
    alert_on_exit = Column(Boolean, server_default="false")
    notify_supervisor = Column(Boolean, server_default="true")

    severity = Column(String(10), server_default="medium")
    # low, medium, high, critical

    is_active = Column(Boolean, server_default="true")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    alerts = relationship("GeofenceAlert", back_populates="zone", cascade="all, delete-orphan",
                           order_by="GeofenceAlert.detected_at.desc()")


class GeofenceAlert(Base):
    """Alert record when a seller enters/exits a geofence zone."""
    __tablename__ = "track_geofence_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    zone_id = Column(UUID(as_uuid=True), ForeignKey("track_geofence_zones.id"), nullable=False, index=True)
    seller_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    gps_point_id = Column(UUID(as_uuid=True), ForeignKey("track_gps_points.id"))

    event_type = Column(String(20), nullable=False)
    # entry, exit, inside_duration

    lat = Column(Numeric(10, 7))
    lng = Column(Numeric(10, 7))

    detected_at = Column(DateTime(timezone=True), nullable=False)
    acknowledged_at = Column(DateTime(timezone=True))
    resolved_at = Column(DateTime(timezone=True))

    status = Column(String(20), nullable=False, server_default="active")
    # active, acknowledged, resolved, false_alarm

    acknowledged_by = Column(UUID(as_uuid=True))
    notas = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    zone = relationship("GeofenceZone", back_populates="alerts")


class SellerPerformanceMetric(Base):
    """Pre-calculated performance metrics per seller for daily/weekly/monthly periods."""
    __tablename__ = "track_seller_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    seller_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    period_type = Column(String(10), nullable=False)
    # daily, weekly, monthly
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)

    total_visits = Column(Integer, server_default="0")
    completed_visits = Column(Integer, server_default="0")
    missed_visits = Column(Integer, server_default="0")
    no_answer_count = Column(Integer, server_default="0")

    total_orders = Column(Integer, server_default="0")
    total_amount = Column(Numeric(15, 2), server_default="0")
    total_payment_collected = Column(Numeric(15, 2), server_default="0")

    total_traveled_km = Column(Numeric(8, 2), server_default="0")
    total_work_hours = Column(Numeric(6, 2), server_default="0")
    productive_hours = Column(Numeric(6, 2), server_default="0")

    orders_per_hour = Column(Numeric(8, 2), server_default="0")
    amount_per_hour = Column(Numeric(12, 2), server_default="0")
    visits_per_hour = Column(Numeric(8, 2), server_default="0")

    avg_visit_duration_minutes = Column(Integer, server_default="0")
    avg_travel_between_visits_minutes = Column(Integer, server_default="0")
    avg_customer_rating = Column(Numeric(3, 2), server_default="0")

    performance_score = Column(Integer, comment="0-100 composite score")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # Ensure unique per seller + period
        None,
    )
