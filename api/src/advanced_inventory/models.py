"""Advanced Inventory models — locations, picking, cycles, consignment, FIFO"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Integer, Text, Numeric, Boolean, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from api.src.db import Base


class StorageLocation(Base):
    __tablename__ = "adv_storage_locations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    codigo = Column(String(50), nullable=False)
    pasillo = Column(String(50))
    estante = Column(String(50))
    posicion = Column(String(50))
    capacidad_maxima = Column(Numeric(15, 3))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    UniqueConstraint("company_id", "warehouse_id", "codigo", name="uq_location_code")


class PickingList(Base):
    __tablename__ = "adv_picking_lists"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    numero = Column(String(30), nullable=False)
    referencia_tipo = Column(String(30))
    referencia_id = Column(UUID(as_uuid=True))
    estado = Column(String(20), nullable=False, default="pendiente")
    assigned_to = Column(UUID(as_uuid=True))
    notas = Column(Text)
    total_items = Column(Integer, default=0)
    picked_items = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    items = relationship("PickingListItem", back_populates="picking_list", lazy="selectin")


class PickingListItem(Base):
    __tablename__ = "adv_picking_list_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    picking_list_id = Column(UUID(as_uuid=True), ForeignKey("adv_picking_lists.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    product_nombre = Column(String(200))
    cantidad_solicitada = Column(Numeric(15, 3), nullable=False)
    cantidad_pickeada = Column(Numeric(15, 3), default=0)
    location_id = Column(UUID(as_uuid=True))
    lot_id = Column(UUID(as_uuid=True))
    estado = Column(String(20), default="pendiente")
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    picking_list = relationship("PickingList", back_populates="items")


class CycleCount(Base):
    __tablename__ = "adv_cycle_counts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    numero = Column(String(30), nullable=False)
    tipo = Column(String(20), nullable=False, default="rotativo")
    estado = Column(String(20), nullable=False, default="abierto")
    conteo_total = Column(Integer, default=0)
    conteo_completado = Column(Integer, default=0)
    discrepancias = Column(Integer, default=0)
    notas = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    items = relationship("CycleCountItem", back_populates="cycle_count", lazy="selectin")


class CycleCountItem(Base):
    __tablename__ = "adv_cycle_count_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cycle_count_id = Column(UUID(as_uuid=True), ForeignKey("adv_cycle_counts.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    product_nombre = Column(String(200))
    location_id = Column(UUID(as_uuid=True))
    cantidad_sistema = Column(Numeric(15, 3), nullable=False, default=0)
    cantidad_fisica = Column(Numeric(15, 3))
    diferencia = Column(Numeric(15, 3))
    estado = Column(String(20), default="pendiente")
    notas = Column(Text)
    counted_by = Column(UUID(as_uuid=True))
    counted_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    cycle_count = relationship("CycleCount", back_populates="items")


class ConsignmentStock(Base):
    __tablename__ = "adv_consignment_stock"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), nullable=False)
    supplier_nombre = Column(String(200))
    cantidad = Column(Numeric(15, 3), nullable=False, default=0)
    costo_acordado = Column(Numeric(15, 2))
    moneda = Column(String(3), default="PYG")
    fecha_ingreso = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fecha_vencimiento = Column(DateTime(timezone=True))
    notas = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    items = relationship("ConsignmentMovement", back_populates="stock", lazy="selectin")


class ConsignmentMovement(Base):
    __tablename__ = "adv_consignment_movements"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consignment_id = Column(UUID(as_uuid=True), ForeignKey("adv_consignment_stock.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(String(20), nullable=False)
    cantidad = Column(Numeric(15, 3), nullable=False)
    referencia_tipo = Column(String(30))
    referencia_id = Column(UUID(as_uuid=True))
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    stock = relationship("ConsignmentStock", back_populates="items")


class AutoReplenishRule(Base):
    __tablename__ = "adv_auto_replenish_rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    stock_minimo = Column(Numeric(15, 3), nullable=False)
    stock_seguridad = Column(Numeric(15, 3), default=0)
    cantidad_reorden = Column(Numeric(15, 3))
    lead_time_dias = Column(Integer, default=1)
    supplier_id = Column(UUID(as_uuid=True))
    activo = Column(Boolean, default=True)
    ultima_alerta_at = Column(DateTime(timezone=True))
    auto_generar_oc = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    UniqueConstraint("company_id", "product_id", "warehouse_id", name="uq_replenish_rule")
