from sqlalchemy import Column, String, DateTime, Numeric, Text, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from api.src.db import Base


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True))
    customer_id = Column(UUID(as_uuid=True), index=True)
    numero = Column(String(20), nullable=False, unique=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    fecha_entrega_solicitada = Column(Date)
    fecha_entrega_estimada = Column(Date)
    estado = Column(String(30), nullable=False, server_default="borrador")
    prioridad = Column(String(20), server_default="normal")
    moneda = Column(String(3), server_default="PYG")
    tipo_cambio = Column(Numeric(10, 2), server_default="1")
    condicion = Column(String(20), server_default="contado")
    subtotal = Column(Numeric(15, 0))
    descuento_total = Column(Numeric(15, 0), server_default="0")
    base_gravada_10 = Column(Numeric(15, 0), server_default="0")
    base_gravada_5 = Column(Numeric(15, 0), server_default="0")
    base_exenta = Column(Numeric(15, 0), server_default="0")
    iva_10 = Column(Numeric(15, 0), server_default="0")
    iva_5 = Column(Numeric(15, 0), server_default="0")
    total = Column(Numeric(15, 0))
    observaciones = Column(Text)
    direccion_entrega = Column(Text)
    vendedor_id = Column(UUID(as_uuid=True))
    aprobado_por = Column(UUID(as_uuid=True))
    fecha_aprobacion = Column(DateTime(timezone=True))
    rechazado_motivo = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("SalesOrderItem", back_populates="order", cascade="all, delete-orphan")


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    order_id = Column(UUID(as_uuid=True), ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    descripcion = Column(String(300))
    cantidad = Column(Numeric(10, 3), nullable=False)
    cantidad_pendiente = Column(Numeric(10, 3))
    cantidad_facturada = Column(Numeric(10, 3), server_default="0")
    cantidad_entregada = Column(Numeric(10, 3), server_default="0")
    precio_unitario = Column(Numeric(15, 0), nullable=False)
    descuento_pct = Column(Numeric(5, 2), server_default="0")
    iva_tasa = Column(Numeric(5, 2), server_default="10")
    iva_monto = Column(Numeric(15, 0), server_default="0")
    total = Column(Numeric(15, 0), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("SalesOrder", back_populates="items")
