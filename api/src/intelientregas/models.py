"""InteliEntregas models — delivery management foundation"""

from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Numeric, Integer, Enum as SAEnum,
    ForeignKey, Index, Float
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import enum

from api.src.db import Base


# ============================================================
# ENUMS
# ============================================================

class DeliveryStatus(str, enum.Enum):
    pending = "pending"
    assigned = "assigned"
    picked_up = "picked_up"
    in_transit = "in_transit"
    delivered = "delivered"
    failed = "failed"
    cancelled = "cancelled"


class DeliveryPriority(str, enum.Enum):
    normal = "normal"
    high = "high"
    urgent = "urgent"


class VehicleType(str, enum.Enum):
    moto = "moto"
    bicicleta = "bicicleta"
    auto = "auto"
    furgoneta = "furgoneta"


class DriverStatus(str, enum.Enum):
    available = "available"
    on_delivery = "on_delivery"
    offline = "offline"
    inactive = "inactive"


class ProofType(str, enum.Enum):
    photo = "photo"
    signature = "signature"
    code = "code"


# ============================================================
# DRIVERS / RIDERS
# ============================================================

class Driver(Base):
    __tablename__ = "intelientregas_drivers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    ci = Column(String(20), unique=True)
    telefono = Column(String(20), nullable=False)
    email = Column(String(100))
    pin_hash = Column(String(255))  # For driver mobile app login
    licencia_numero = Column(String(50))
    licencia_vencimiento = Column(DateTime(timezone=True))
    status = Column(SAEnum(DriverStatus), default=DriverStatus.available, server_default="available", index=True)
    rating = Column(Numeric(3, 2), default=0)
    total_deliveries = Column(Integer, default=0)
    activo = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_intelientregas_drivers_company", "company_id"),
        Index("ix_intelientregas_drivers_status", "status"),
    )


# ============================================================
# VEHICLES
# ============================================================

class Vehicle(Base):
    __tablename__ = "intelientregas_vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_drivers.id"), nullable=True)
    tipo = Column(SAEnum(VehicleType), nullable=False)
    marca = Column(String(50))
    modelo = Column(String(50))
    color = Column(String(30))
    patente = Column(String(20), unique=True)
    anio = Column(Integer)
    capacidad_kg = Column(Numeric(8, 2))
    tiene_caja_termica = Column(Boolean, default=False, server_default="false")
    seguro_vencimiento = Column(DateTime(timezone=True), nullable=True)
    itv_vencimiento = Column(DateTime(timezone=True), nullable=True)
    activo = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_intelientregas_vehicles_company", "company_id"),
        Index("ix_intelientregas_vehicles_driver", "driver_id"),
    )


# ============================================================
# DELIVERY ORDERS
# ============================================================

class Delivery(Base):
    __tablename__ = "intelientregas_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_drivers.id"), nullable=True, index=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_vehicles.id"), nullable=True)
    route_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_routes.id"), nullable=True, index=True)

    # Customer info
    customer_nombre = Column(String(200), nullable=False)
    customer_telefono = Column(String(20))
    customer_ci = Column(String(20))

    # Delivery address
    direccion = Column(Text, nullable=False)
    barrio = Column(String(100))
    ciudad = Column(String(100))
    referencia = Column(Text)
    latitud = Column(Float)
    longitud = Column(Float)

    # Delivery details
    estado = Column(SAEnum(DeliveryStatus), default=DeliveryStatus.pending, server_default="pending", index=True)
    prioridad = Column(SAEnum(DeliveryPriority), default=DeliveryPriority.normal, server_default="normal")
    observaciones = Column(Text)
    instrucciones_entrega = Column(Text)

    # Time tracking
    scheduled_from = Column(DateTime(timezone=True))
    scheduled_to = Column(DateTime(timezone=True))
    assigned_at = Column(DateTime(timezone=True))
    picked_up_at = Column(DateTime(timezone=True))
    in_transit_at = Column(DateTime(timezone=True))
    delivered_at = Column(DateTime(timezone=True))
    failed_at = Column(DateTime(timezone=True))

    # Delivery result
    motivo_falla = Column(String(200))
    costo_delivery = Column(Numeric(15, 0), default=0)
    cobrado = Column(Boolean, default=False, server_default="false")

    # External tracking
    tracking_code = Column(String(20), unique=True, index=True)
    external_order_id = Column(String(100))

    activo = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_intelientregas_deliveries_company_estado", "company_id", "estado"),
        Index("ix_intelientregas_deliveries_driver", "driver_id", "estado"),
        Index("ix_intelientregas_deliveries_route", "route_id"),
        Index("ix_intelientregas_deliveries_created", "created_at"),
    )


# ============================================================
# ROUTES
# ============================================================

class Route(Base):
    __tablename__ = "intelientregas_routes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_drivers.id"), nullable=True, index=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_vehicles.id"), nullable=True)
    nombre = Column(String(100), nullable=False)
    fecha = Column(DateTime(timezone=True), nullable=False, index=True)
    estado = Column(String(20), default="planificada", server_default="planificada", index=True)
    total_stops = Column(Integer, default=0)
    completed_stops = Column(Integer, default=0)
    distancia_km = Column(Numeric(8, 2))
    duracion_estimada_min = Column(Integer)
    observaciones = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_intelientregas_routes_company_fecha", "company_id", "fecha"),
        Index("ix_intelientregas_routes_driver", "driver_id"),
    )


# ============================================================
# ROUTE STOPS
# ============================================================

class RouteStop(Base):
    __tablename__ = "intelientregas_route_stops"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    route_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_routes.id"), nullable=False, index=True)
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_deliveries.id"), nullable=False, unique=True)
    orden = Column(Integer, nullable=False)
    estado = Column(String(20), default="pending", server_default="pending")
    latitud = Column(Float)
    longitud = Column(Float)
    direccion = Column(Text)
    customer_nombre = Column(String(200))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_intelientregas_route_stops_route_orden", "route_id", "orden"),
    )


# ============================================================
# TRACKING EVENTS (GPS) — Mobile app pushes these
# ============================================================

class TrackingEvent(Base):
    __tablename__ = "intelientregas_tracking_events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_deliveries.id"), nullable=False, index=True)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_drivers.id"), nullable=True, index=True)
    latitud = Column(Float, nullable=False)
    longitud = Column(Float, nullable=False)
    velocidad_kmh = Column(Numeric(5, 2))
    precision_m = Column(Float)
    bateria_pct = Column(Integer)
    evento = Column(String(30), default="location")
    datos = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_intelientregas_tracking_delivery", "delivery_id", "created_at"),
        Index("ix_intelientregas_tracking_driver", "driver_id", "created_at"),
    )


# ============================================================
# DELIVERY PROOFS
# ============================================================

class DeliveryProof(Base):
    __tablename__ = "intelientregas_delivery_proofs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_deliveries.id"), nullable=False, index=True)
    tipo = Column(SAEnum(ProofType), nullable=False)
    url = Column(Text)
    codigo_confirmacion = Column(String(10))
    nombre_recibio = Column(String(100))
    relacion = Column(String(50))
    observaciones = Column(Text)
    latitud = Column(Float)
    longitud = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_intelientregas_proofs_delivery", "delivery_id"),
    )


# ============================================================
# DELIVERY ZONES
# ============================================================

class DeliveryZone(Base):
    __tablename__ = "intelientregas_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    costo_base = Column(Numeric(15, 0), nullable=False)
    costo_km = Column(Numeric(15, 0), default=0)
    tiempo_estimado_min = Column(Integer)
    radio_km = Column(Numeric(5, 2))
    centro_lat = Column(Float)
    centro_lon = Column(Float)
    activo = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_intelientregas_zones_company", "company_id"),
    )
