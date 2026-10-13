"""Price list models"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class PriceList(Base):
    __tablename__ = "price_lists"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(20), nullable=False, default="general")  # general, grupo, cliente
    customer_id = Column(UUID(as_uuid=True), nullable=True)  # solo si tipo=cliente
    grupo = Column(String(100), nullable=True)  # solo si tipo=grupo
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PriceListItem(Base):
    __tablename__ = "price_list_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    price_list_id = Column(UUID(as_uuid=True), ForeignKey("price_lists.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    variant_id = Column(UUID(as_uuid=True), nullable=True)
    precio = Column(Numeric(15, 2), nullable=False, default=0)
    moneda = Column(String(3), default="PYG")
    notas = Column(String(200), nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PriceVariationLog(Base):
    __tablename__ = "price_variation_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    product_nombre = Column(String(255), nullable=True)
    product_sku = Column(String(100), nullable=True)
    product_barcode = Column(String(100), nullable=True)
    categoria_nombre = Column(String(150), nullable=True)
    tipo = Column(String(20), nullable=False)  # 'unitario' | 'escala'
    escala_min_qty = Column(Integer, nullable=True)
    precio_minorista_anterior = Column(Numeric(15, 2), nullable=False, default=0)
    precio_minorista_nuevo = Column(Numeric(15, 2), nullable=False, default=0)
    precio_escala_anterior = Column(Numeric(15, 2), nullable=False, default=0)
    precio_escala_nuevo = Column(Numeric(15, 2), nullable=False, default=0)
    precio_anterior = Column(Numeric(15, 2), nullable=False, default=0)
    precio_nuevo = Column(Numeric(15, 2), nullable=False, default=0)
    diferencia_monto = Column(Numeric(15, 2), nullable=False, default=0)
    diferencia_pct = Column(Numeric(7, 2), nullable=False, default=0)
    origen = Column(String(50), nullable=True, default="sistema")
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    usuario_nombre = Column(String(150), nullable=True)
    motivo = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

