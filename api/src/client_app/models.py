import uuid
from datetime import datetime, timezone
from decimal import Decimal
import sqlalchemy as sa
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text, JSON, Integer, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from api.src.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


class ClientUser(Base):
    __tablename__ = "client_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    nombre = Column(String(200), nullable=False)
    telefono = Column(String(50))
    activo = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ClientDevice(Base):
    __tablename__ = "client_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_user_id = Column(UUID(as_uuid=True), ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False)
    push_token = Column(String(500))
    platform = Column(String(20))
    last_seen_at = Column(DateTime(timezone=True), default=_utcnow)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    client_user = relationship("ClientUser", backref="devices")


class ClientCart(Base):
    __tablename__ = "client_carts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_user_id = Column(UUID(as_uuid=True), ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(UUID(as_uuid=True), nullable=False)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    items = relationship("ClientCartItem", back_populates="cart", cascade="all, delete-orphan")
    client_user = relationship("ClientUser", backref="carts")


class ClientCartItem(Base):
    __tablename__ = "client_cart_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cart_id = Column(UUID(as_uuid=True), ForeignKey("client_carts.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True), nullable=True)
    descripcion = Column(String(300))
    cantidad = Column(Numeric(10, 3), default=1)
    precio_unitario = Column(Numeric(15, 2), default=0)
    iva_tasa = Column(Numeric(5, 2), default=10)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    cart = relationship("ClientCart", back_populates="items")


class ClientOrder(Base):
    __tablename__ = "client_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_user_id = Column(UUID(as_uuid=True), ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(20))
    estado = Column(String(20), default="pendiente")
    condicion = Column(String(20), default="contado")
    subtotal = Column(Numeric(15, 2), default=0)
    descuento_total = Column(Numeric(15, 2), default=0)
    total = Column(Numeric(15, 2), default=0)
    saldo = Column(Numeric(15, 2), default=0)
    direccion_entrega = Column(Text)
    latitud = Column(Numeric(10, 7))
    longitud = Column(Numeric(10, 7))
    observaciones = Column(Text)
    delivery_id = Column(UUID(as_uuid=True), nullable=True)
    sale_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    items = relationship("ClientOrderItem", back_populates="order", cascade="all, delete-orphan")
    client_user = relationship("ClientUser", backref="orders")


class ClientOrderItem(Base):
    __tablename__ = "client_order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("client_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True), nullable=True)
    descripcion = Column(String(300))
    cantidad = Column(Numeric(10, 3))
    precio_unitario = Column(Numeric(15, 2))
    descuento_pct = Column(Numeric(5, 2), default=0)
    descuento_monto = Column(Numeric(15, 2), default=0)
    iva_tasa = Column(Numeric(5, 2), default=10)
    iva_monto = Column(Numeric(15, 2), default=0)
    total = Column(Numeric(15, 2), default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    order = relationship("ClientOrder", back_populates="items")


class ClientFavorite(Base):
    __tablename__ = "client_favorites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_user_id = Column(UUID(as_uuid=True), ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    __table_args__ = (
        sa.UniqueConstraint("client_user_id", "product_id", name="uq_client_favorite_product"),
    )
    client_user = relationship("ClientUser", backref="favorites")


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), nullable=True)
    tipo = Column(String(20), nullable=False)  # acumulacion | canje
    puntos = Column(Integer, nullable=False)
    concepto = Column(String(200))
    created_at = Column(DateTime(timezone=True), default=_utcnow)


class ClientAddress(Base):
    __tablename__ = "client_addresses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_user_id = Column(UUID(as_uuid=True), ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String(100))
    direccion = Column(String(300), nullable=False)
    ciudad = Column(String(100))
    latitud = Column(Numeric(10, 7))
    longitud = Column(Numeric(10, 7))
    es_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
