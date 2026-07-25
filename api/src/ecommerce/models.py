"""E-commerce models — sync, customers, cart, orders, payments"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Integer, Text, Numeric, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from api.src.db import Base


class EcommerceSyncLog(Base):
    __tablename__ = "ecommerce_sync_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)
    estado = Column(String(20), nullable=False, default="pendiente")
    productos_count = Column(Integer, default=0)
    errores_count = Column(Integer, default=0)
    resultado = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class EcommerceCustomer(Base):
    __tablename__ = "ecommerce_customers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    nombre = Column(String(200), nullable=False)
    telefono = Column(String(50))
    direccion_envio = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime(timezone=True))


class EcommerceCart(Base):
    __tablename__ = "ecommerce_carts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    moneda = Column(String(3), default="PYG")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    items = relationship("EcommerceCartItem", back_populates="cart", lazy="selectin")


class EcommerceCartItem(Base):
    __tablename__ = "ecommerce_cart_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cart_id = Column(UUID(as_uuid=True), ForeignKey("ecommerce_carts.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    product_nombre = Column(String(200))
    cantidad = Column(Numeric(15, 3), nullable=False, default=1)
    precio_unitario = Column(Numeric(15, 2), nullable=False)
    moneda = Column(String(3), default="PYG")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    cart = relationship("EcommerceCart", back_populates="items")


class EcommerceOrderLegacy(Base):
    __tablename__ = "ecommerce_orders"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(20))
    estado = Column(String(20), nullable=False, default="pendiente")
    moneda = Column(String(3), default="PYG")
    subtotal = Column(Numeric(15, 2), nullable=False, default=0)
    descuento = Column(Numeric(15, 2), default=0)
    total = Column(Numeric(15, 2), nullable=False, default=0)
    metodo_pago = Column(String(50))
    pago_estado = Column(String(20), default="pendiente")
    direccion_envio = Column(Text)
    notas = Column(Text)
    sales_order_id = Column(UUID(as_uuid=True))
    invoice_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    items = relationship("EcommerceOrderItemLegacy", back_populates="order", lazy="selectin")


class EcommerceOrderItemLegacy(Base):
    __tablename__ = "ecommerce_order_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("ecommerce_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    product_nombre = Column(String(200))
    cantidad = Column(Numeric(15, 3), nullable=False)
    precio_unitario = Column(Numeric(15, 2), nullable=False)
    subtotal = Column(Numeric(15, 2), nullable=False)
    moneda = Column(String(3), default="PYG")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    order = relationship("EcommerceOrderLegacy", back_populates="items")


EcommerceOrder = EcommerceOrderLegacy
EcommerceOrderItem = EcommerceOrderItemLegacy


class EcommercePayment(Base):
    __tablename__ = "ecommerce_payments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("ecommerce_orders.id"), nullable=False)
    metodo = Column(String(50), nullable=False)
    monto = Column(Numeric(15, 2), nullable=False)
    moneda = Column(String(3), default="PYG")
    estado = Column(String(20), default="pendiente")
    referencia_externa = Column(String(255))
    payment_metadata = Column("metadata", JSON)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
