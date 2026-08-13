"""Devoluciones A proveedores — mercaderia vencida/danada/con error de
pedido que se devuelve al proveedor. No existia en Intelimarket ni en el
legacy (confirmado por auditoria): returns/models.py es exclusivamente
devoluciones DE clientes. Espeja esa misma estructura en la direccion
opuesta: el stock sale (no entra) y en vez de generar una Nota de Credito
al cliente (sales, total negativo), genera una Nota de Credito DEL
proveedor (supplier_invoices, total negativo) -- misma logica de
"nada queda invisible para el resto del sistema" que se aplico alla."""

from sqlalchemy import Column, String, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from api.src.db import Base


class PurchaseReturn(Base):
    __tablename__ = "supplier_returns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    purchase_order_id = Column(UUID(as_uuid=True), index=True)
    numero = Column(String(20), nullable=False, unique=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    motivo = Column(String(50), nullable=False)
    motivo_detalle = Column(Text)
    estado = Column(String(20), server_default="pendiente")
    moneda = Column(String(3), server_default="PYG")
    tipo_cambio = Column(Numeric(10, 2), server_default="1")
    subtotal = Column(Numeric(15, 0))
    iva_10 = Column(Numeric(15, 0), server_default="0")
    iva_5 = Column(Numeric(15, 0), server_default="0")
    total = Column(Numeric(15, 0))
    supplier_invoice_id = Column(UUID(as_uuid=True))  # NC del proveedor generada al aprobar
    warehouse_id = Column(UUID(as_uuid=True))
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    aprobado_por = Column(UUID(as_uuid=True))
    fecha_aprobacion = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("PurchaseReturnItem", back_populates="return_", cascade="all, delete-orphan")


class PurchaseReturnItem(Base):
    __tablename__ = "supplier_return_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    return_id = Column(UUID(as_uuid=True), ForeignKey("supplier_returns.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    descripcion = Column(String(300))
    cantidad = Column(Numeric(10, 3), nullable=False)
    precio_unitario = Column(Numeric(15, 0), nullable=False)
    iva_tasa = Column(Numeric(5, 2), server_default="10")
    iva_monto = Column(Numeric(15, 0), server_default="0")
    total = Column(Numeric(15, 0), nullable=False)
    motivo_detalle = Column(Text)
    condicion = Column(String(30), server_default="vencido")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    return_ = relationship("PurchaseReturn", back_populates="items")
