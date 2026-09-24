"""Product pack barcode models -- codigos de barra impresos en la caja/pack
que representa N unidades del producto suelto (mismo producto base, no un
combo de productos distintos como product_kits, ni una variante con su
propio stock como product_variants)."""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class ProductPackBarcode(Base):
    __tablename__ = "product_pack_barcodes"
    __table_args__ = (
        UniqueConstraint("company_id", "codigo_barra", name="uq_pack_barcode_company_codigo"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo_barra = Column(String(50), nullable=False, index=True)
    etiqueta = Column(String(60), nullable=False)
    unidades_por_paquete = Column(Numeric(10, 3), nullable=False)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
