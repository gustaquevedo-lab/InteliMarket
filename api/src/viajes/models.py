from __future__ import annotations

from sqlalchemy import (
    Column, String, Date, DateTime, Numeric, Text, Integer, Boolean,
    UniqueConstraint, Index, ForeignKey
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class TripVehicle(Base):
    __tablename__ = "trip_vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    patente = Column(String(15), nullable=False)
    descripcion = Column(String(100), nullable=True)
    max_weight_kg = Column(Numeric(10, 2), nullable=False)
    activo = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "patente", name="uq_trip_vehicle_company_patente"),
    )


class Trip(Base):
    __tablename__ = "trips"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    cobrador_id = Column(UUID(as_uuid=True), nullable=False)
    patente = Column(String(15), nullable=False)
    fecha = Column(Date, nullable=False)
    estado = Column(String(20), nullable=False, default="armando", server_default="armando")
    km_salida = Column(Integer, nullable=True)
    km_llegada = Column(Integer, nullable=True)
    peso_total_kg = Column(Numeric(10, 2), nullable=True)
    route_session_id = Column(UUID(as_uuid=True), nullable=True)
    despachante_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "cobrador_id", "fecha", name="uq_trip_cobrador_fecha"),
        Index("ix_trips_company_fecha", "company_id", "fecha"),
    )


class TripStop(Base):
    __tablename__ = "trip_stops"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    sales_order_id = Column(UUID(as_uuid=True), nullable=False)
    customer_id = Column(UUID(as_uuid=True), nullable=False)
    orden_visita = Column(Integer, nullable=False)
    estado = Column(String(20), nullable=False, default="pendiente", server_default="pendiente")
    firmado = Column(Boolean, nullable=False, default=False, server_default="false")
    observaciones = Column(Text, nullable=True)
    visited_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_trip_stops_trip_id", "trip_id"),
    )


class TripStopItem(Base):
    __tablename__ = "trip_stop_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    stop_id = Column(UUID(as_uuid=True), ForeignKey("trip_stops.id", ondelete="CASCADE"), nullable=False)
    sales_order_item_id = Column(UUID(as_uuid=True), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    cantidad_asignada = Column(Numeric(12, 3), nullable=False)
    cantidad_entregada = Column(Numeric(12, 3), nullable=False, default=0, server_default="0")
    cantidad_rechazada = Column(Numeric(12, 3), nullable=False, default=0, server_default="0")
    cantidad_faltante = Column(Numeric(12, 3), nullable=False, default=0, server_default="0")
    nc_id = Column(UUID(as_uuid=True), nullable=True)
