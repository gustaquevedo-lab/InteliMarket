"""Product and category models"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"))
    nombre = Column(String(100), nullable=False)
    codigo = Column(String(20), unique=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    children = relationship("ProductCategory", backref="parent", remote_side=[id])


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"))
    sku = Column(String(50), nullable=False)
    codigo_barra = Column(String(50), index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    tipo = Column(String(20), nullable=False, default="producto")
    unidad_medida = Column(String(10), default="UN")
    iva_tasa = Column(Numeric(5, 2), default=10)
    metodo_costeo = Column(String(10), default="promedio")
    tiene_lotes = Column(Boolean, default=False)
    tiene_vencimiento = Column(Boolean, default=False)
    tiene_serial = Column(Boolean, default=False)
    stock_minimo = Column(Integer, default=0)
    stock_maximo = Column(Integer)
    peso_kg = Column(Numeric(10, 3))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("ProductCategory")
