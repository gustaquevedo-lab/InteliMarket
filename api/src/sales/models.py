"""Sales models"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class Sale(Base):
    __tablename__ = "sales"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True))
    session_id = Column(UUID(as_uuid=True), index=True)
    customer_id = Column(UUID(as_uuid=True))
    emission_point_id = Column(UUID(as_uuid=True))
    numero = Column(String(20), nullable=False, unique=True)
    # Correlativo interno propio (independiente del numero de factura fiscal
    # 001-XXX-NNNNNNN) -- se genera y guarda SIEMPRE, exista o no timbrado
    # configurado, para que haya un codigo de venta estable que no dependa
    # de la config fiscal ni del punto de emision.
    numero_interno = Column(String(20), unique=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    tipo_comprobante = Column(String(20), nullable=False)
    condicion = Column(String(20), nullable=False, default="contado")
    moneda = Column(String(3), nullable=False, default="PYG")
    tipo_cambio = Column(Numeric(10, 2), default=1, server_default=text("1"))
    estado = Column(String(20), nullable=False, default="pendiente")

    subtotal = Column(Numeric(15, 0), nullable=False)
    descuento_total = Column(Numeric(15, 0), default=0, server_default=text("0"))
    base_gravada_10 = Column(Numeric(15, 0), default=0, server_default=text("0"))
    base_gravada_5 = Column(Numeric(15, 0), default=0, server_default=text("0"))
    base_exenta = Column(Numeric(15, 0), default=0, server_default=text("0"))
    iva_10 = Column(Numeric(15, 0), default=0, server_default=text("0"))
    iva_5 = Column(Numeric(15, 0), default=0, server_default=text("0"))
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
    recibo_html = Column(Text)
    recibo_escpos_b64 = Column(Text)
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
    descuento_pct = Column(Numeric(5, 2), default=0, server_default=text("0"))
    descuento_monto = Column(Numeric(15, 0), default=0)
    iva_tasa = Column(Numeric(5, 2), nullable=False)
    iva_monto = Column(Numeric(15, 0), nullable=False)
    total = Column(Numeric(15, 0), nullable=False)
    costo_unitario = Column(Numeric(15, 0))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sale = relationship("Sale", back_populates="items")


class SalePayment(Base):
    """Desglose de medios de pago por venta (efectivo, tarjeta, QR, PIX, etc.)"""
    __tablename__ = "sale_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=False, index=True)
    forma_pago = Column(String(30), nullable=False)
    monto = Column(Numeric(15, 2), nullable=False)
    moneda = Column(String(3), nullable=False, default="PYG", server_default=text("'PYG'"))
    fecha = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sale = relationship("Sale")
