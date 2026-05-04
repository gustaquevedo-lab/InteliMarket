"""Sales models"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class Sale(Base):
    __tablename__ = "sales"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True))
    customer_id = Column(UUID(as_uuid=True))
    emission_point_id = Column(UUID(as_uuid=True))
    numero = Column(String(20), nullable=False, unique=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    tipo_comprobante = Column(String(20), nullable=False)
    condicion = Column(String(20), nullable=False, default="contado")
    moneda = Column(String(3), nullable=False, default="PYG")
    tipo_cambio = Column(Numeric(10, 2), default=1)
    estado = Column(String(20), nullable=False, default="pendiente")

    subtotal = Column(Numeric(15, 0), nullable=False)
    descuento_total = Column(Numeric(15, 0), default=0)
    base_gravada_10 = Column(Numeric(15, 0), default=0)
    base_gravada_5 = Column(Numeric(15, 0), default=0)
    base_exenta = Column(Numeric(15, 0), default=0)
    iva_10 = Column(Numeric(15, 0), default=0)
    iva_5 = Column(Numeric(15, 0), default=0)
    total = Column(Numeric(15, 0), nullable=False)
    total_pagado = Column(Numeric(15, 0), default=0)
    saldo = Column(Numeric(15, 0))

    cdc = Column(String(44))
    sifen_estado = Column(String(20))
    sifen_fecha_respuesta = Column(DateTime(timezone=True))
    sifen_xml_sent = Column(Text)
    sifen_xml_response = Column(Text)

    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    descripcion = Column(String(300))
    cantidad = Column(Numeric(10, 3), nullable=False)
    precio_unitario = Column(Numeric(15, 0), nullable=False)
    descuento_pct = Column(Numeric(5, 2), default=0)
    descuento_monto = Column(Numeric(15, 0), default=0)
    iva_tasa = Column(Numeric(5, 2), nullable=False)
    iva_monto = Column(Numeric(15, 0), nullable=False)
    total = Column(Numeric(15, 0), nullable=False)
    costo_unitario = Column(Numeric(15, 0))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sale = relationship("Sale", back_populates="items")


class CashRegister(Base):
    __tablename__ = "cash_registers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    branch_id = Column(UUID(as_uuid=True), nullable=False)
    nombre = Column(String(100), nullable=False)
    tipo = Column(String(20), default="principal")
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashSession(Base):
    __tablename__ = "cash_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cash_register_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    fecha_apertura = Column(DateTime(timezone=True), server_default=func.now())
    monto_apertura = Column(Numeric(15, 0), nullable=False, default=0)
    fecha_cierre = Column(DateTime(timezone=True))
    monto_cierre_esperado = Column(Numeric(15, 0))
    monto_cierre_real = Column(Numeric(15, 0))
    diferencia = Column(Numeric(15, 0))
    estado = Column(String(20), default="abierta")
    observaciones_cierre = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
