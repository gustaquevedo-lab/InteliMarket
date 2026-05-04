"""Inventory models"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    branch_id = Column(UUID(as_uuid=True))
    codigo = Column(String(10), nullable=False)
    nombre = Column(String(100), nullable=False)
    direccion = Column(Text)
    tipo = Column(String(20), default="principal")
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Stock(Base):
    __tablename__ = "stock"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    cantidad = Column(Integer, nullable=False, default=0)
    cantidad_reservada = Column(Integer, nullable=False, default=0)
    costo_unitario = Column(Numeric(15, 0))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    tipo = Column(String(30), nullable=False)
    cantidad = Column(Integer, nullable=False)
    costo_unitario = Column(Numeric(15, 0))
    referencia_type = Column(String(30))
    referencia_id = Column(UUID(as_uuid=True))
    motivo = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    codigo = Column(String(20), nullable=False, unique=True)
    warehouse_origen_id = Column(UUID(as_uuid=True), nullable=False)
    warehouse_destino_id = Column(UUID(as_uuid=True), nullable=False)
    estado = Column(String(20), nullable=False, default="pendiente")
    fecha_envio = Column(DateTime(timezone=True))
    fecha_recepcion = Column(DateTime(timezone=True))
    observaciones = Column(Text)
    user_id_envio = Column(UUID(as_uuid=True))
    user_id_recepcion = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StockTransferItem(Base):
    __tablename__ = "stock_transfer_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    transfer_id = Column(UUID(as_uuid=True), ForeignKey("stock_transfers.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    cantidad_enviada = Column(Integer, nullable=False)
    cantidad_recibida = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transfer = relationship("StockTransfer")


class InventoryAdjustment(Base):
    __tablename__ = "inventory_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    codigo = Column(String(20), nullable=False, unique=True)
    motivo = Column(String(50), nullable=False)
    estado = Column(String(20), default="pendiente")
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    aprobado_por = Column(UUID(as_uuid=True))
    fecha_aprobacion = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InventoryAdjustmentItem(Base):
    __tablename__ = "inventory_adjustment_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    adjustment_id = Column(UUID(as_uuid=True), ForeignKey("inventory_adjustments.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    cantidad_sistema = Column(Integer, nullable=False)
    cantidad_fisica = Column(Integer, nullable=False)
    diferencia = Column(Integer, nullable=False)
    costo_unitario = Column(Numeric(15, 0))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    adjustment = relationship("InventoryAdjustment")
