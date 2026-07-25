"""Logistics models"""

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Numeric, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import enum

from api.src.db import Base


class DeliveryStatus(enum.Enum):
    pending = "pending"
    in_transit = "in_transit"
    delivered = "delivered"
    cancelled = "cancelled"
    returned = "returned"


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)
    driver_name = Column(String(200))
    vehicle_plate = Column(String(20))
    direccion_entrega = Column(String(500), nullable=False)
    coordenadas = Column(String(100))  # lat,lng
    estado = Column(SAEnum(DeliveryStatus), default=DeliveryStatus.pending, nullable=False)
    fecha_programada = Column(DateTime(timezone=True))
    fecha_salida = Column(DateTime(timezone=True))
    fecha_entrega = Column(DateTime(timezone=True))
    observaciones = Column(Text)
    tracking_notes = Column(Text)  # JSON array of status updates
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Route(Base):
    __tablename__ = "routes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    driver_name = Column(String(200))
    vehicle_plate = Column(String(20))
    fecha = Column(DateTime(timezone=True), nullable=False)
    estado = Column(String(20), default="pending", nullable=False)  # pending, active, completed
    total_deliveries = Column(Integer, default=0)
    completed_deliveries = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RouteStop(Base):
    __tablename__ = "route_stops"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), nullable=False, index=True)
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("deliveries.id"), nullable=False, unique=True)
    orden = Column(Integer, nullable=False)
    estado = Column(String(20), default="pending", nullable=False)  # pending, in_transit, delivered, skipped
    fecha_llegada = Column(DateTime(timezone=True))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
