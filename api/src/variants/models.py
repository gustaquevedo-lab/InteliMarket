"""Product Variant models"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(50), nullable=False, default="talle")
    valor = Column(String(100), nullable=False)
    sku_variante = Column(String(100), nullable=False, unique=True)
    codigo_barra = Column(String(50))
    precio_extra = Column(Numeric(15, 2), default=0)
    stock = Column(Integer, default=0)
    orden = Column(Integer, default=0)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
