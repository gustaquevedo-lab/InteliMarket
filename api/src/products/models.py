"""Product and category models"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base
from api.src.purchases.models import Supplier


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
    categoria_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id"))  # nombre real de la columna en la tabla (antes mapeada como category_id, que no existe)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True, index=True)
    sku = Column(String(50), nullable=False)
    codigo_barra = Column(String(50), index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    tipo = Column(String(20), nullable=False, default="producto")
    tipo_producto = Column(String(20), nullable=False, default="producto", server_default="producto", comment="Clasificación de negocio: producto (final para venta), materia_prima, insumo (uso interno), servicio (mano de obra)")
    unidad_medida = Column(String(10), default="UN")
    iva_tasa = Column(Numeric(5, 2), default=10)
    metodo_costeo = Column(String(10), default="promedio", server_default="promedio")
    tipo_venta = Column(String(20), default="unidad", server_default="unidad")
    tiene_lotes = Column(Boolean, default=False, server_default=text("false"))
    tiene_vencimiento = Column(Boolean, default=False, server_default=text("false"))
    tiene_serial = Column(Boolean, default=False, server_default=text("false"))
    stock_minimo = Column(Integer, default=0, server_default=text("0"))
    stock_maximo = Column(Integer)
    costo_promedio = Column(Numeric(15, 2), default=0, server_default=text("0"), comment="Costo promedio ponderado (en moneda local)")
    ultimo_costo = Column(Numeric(15, 2), default=0, server_default=text("0"), comment="Último costo de compra/importación (en moneda local)")
    costo_landed = Column(Numeric(15, 2), default=0, server_default=text("0"), comment="Costo landed total por unidad (importados)")
    precio_venta = Column(Numeric(15, 2), default=0, server_default=text("0"), comment="Precio de venta al público")
    precio_regular = Column(Numeric(15, 2), nullable=True, comment="Precio regular/base antes de aplicar promoción")
    peso_kg = Column(Numeric(10, 3))
    plu_balanza = Column(Integer, nullable=True, comment="Numero de PLU (7 digitos) ya cargado en la balanza Balmak Edge (software SDL) para este producto")
    imagen_url = Column(String(500), nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    categoria = relationship("ProductCategory")
    supplier = relationship("Supplier", foreign_keys=[supplier_id], lazy="select")

    @property
    def categoria_nombre(self) -> str | None:
        return self.categoria.nombre if self.categoria else None

    @property
    def supplier_nombre(self) -> str | None:
        return self.supplier.razon_social if self.supplier else None


# Alias expected by some modules (customer360, etc.)
Category = ProductCategory
