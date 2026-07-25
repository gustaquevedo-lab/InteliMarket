from sqlalchemy import Column, String, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from api.src.db import Base


class Return(Base):
    __tablename__ = "returns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True))
    sale_id = Column(UUID(as_uuid=True), index=True)
    customer_id = Column(UUID(as_uuid=True))
    numero = Column(String(20), nullable=False, unique=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    tipo = Column(String(20), nullable=False)
    motivo = Column(String(50), nullable=False)
    motivo_detalle = Column(Text)
    estado = Column(String(20), server_default="pendiente")
    moneda = Column(String(3), server_default="PYG")
    tipo_cambio = Column(Numeric(10, 2), server_default="1")
    subtotal = Column(Numeric(15, 0))
    iva_10 = Column(Numeric(15, 0), server_default="0")
    iva_5 = Column(Numeric(15, 0), server_default="0")
    total = Column(Numeric(15, 0))
    nota_credito_id = Column(UUID(as_uuid=True))
    warehouse_id = Column(UUID(as_uuid=True))
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    aprobado_por = Column(UUID(as_uuid=True))
    fecha_aprobacion = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("ReturnItem", back_populates="return_", cascade="all, delete-orphan")


class ReturnItem(Base):
    __tablename__ = "return_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    return_id = Column(UUID(as_uuid=True), ForeignKey("returns.id"), nullable=False)
    sale_item_id = Column(UUID(as_uuid=True))
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    descripcion = Column(String(300))
    cantidad = Column(Numeric(10, 3), nullable=False)
    precio_unitario = Column(Numeric(15, 0), nullable=False)
    iva_tasa = Column(Numeric(5, 2), server_default="10")
    iva_monto = Column(Numeric(15, 0), server_default="0")
    total = Column(Numeric(15, 0), nullable=False)
    motivo_detalle = Column(Text)
    condicion = Column(String(30), server_default="buen_estado")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    return_ = relationship("Return", back_populates="items")
