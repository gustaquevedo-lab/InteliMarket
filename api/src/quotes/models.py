from sqlalchemy import Column, String, DateTime, Numeric, Text, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from api.src.db import Base


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True))
    numero = Column(String(20), nullable=False, unique=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    valido_hasta = Column(Date)
    estado = Column(String(20), server_default="vigente")
    moneda = Column(String(3), server_default="PYG")
    tipo_cambio = Column(Numeric(10, 2), server_default="1")
    subtotal = Column(Numeric(15, 0))
    descuento_total = Column(Numeric(15, 0), server_default="0")
    base_gravada_10 = Column(Numeric(15, 0), server_default="0")
    base_gravada_5 = Column(Numeric(15, 0), server_default="0")
    base_exenta = Column(Numeric(15, 0), server_default="0")
    iva_10 = Column(Numeric(15, 0), server_default="0")
    iva_5 = Column(Numeric(15, 0), server_default="0")
    total = Column(Numeric(15, 0))
    observaciones = Column(Text)
    condiciones_pago = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    sale_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")


class QuoteItem(Base):
    __tablename__ = "quote_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    quote_id = Column(UUID(as_uuid=True), ForeignKey("quotes.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    descripcion = Column(String(300))
    cantidad = Column(Numeric(10, 3), nullable=False)
    precio_unitario = Column(Numeric(15, 0), nullable=False)
    descuento_pct = Column(Numeric(5, 2), server_default="0")
    iva_tasa = Column(Numeric(5, 2), server_default="10")
    iva_monto = Column(Numeric(15, 0), server_default="0")
    total = Column(Numeric(15, 0), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    quote = relationship("Quote", back_populates="items")
