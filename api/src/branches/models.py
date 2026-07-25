"""Branch models"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class Branch(Base):
    __tablename__ = "branches"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    codigo = Column(String(20), nullable=False, unique=True)
    nombre = Column(String(200), nullable=False)
    direccion = Column(String(500))
    ciudad = Column(String(100))
    departamento = Column(String(100))
    telefono = Column(String(20))
    email = Column(String(200))
    ruc = Column(String(20))
    punto_emision = Column(Integer, default=1)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BranchPrice(Base):
    __tablename__ = "branch_prices"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    precio = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("branch_id", "product_id", name="uq_branch_product_price"),)


class BranchTransfer(Base):
    __tablename__ = "branch_transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    origen_branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    destino_branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    numero = Column(String(20), nullable=False, unique=True)
    estado = Column(String(20), nullable=False, default="pendiente")
    notas = Column(Text)
    transportista = Column(String(200))
    created_by = Column(UUID(as_uuid=True))
    approved_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("BranchTransferItem", back_populates="transfer", lazy="selectin")


class BranchTransferItem(Base):
    __tablename__ = "branch_transfer_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    transfer_id = Column(UUID(as_uuid=True), ForeignKey("branch_transfers.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    cantidad = Column(Integer, nullable=False)
    costo_unitario = Column(Numeric(15, 2))
    cantidad_recibida = Column(Integer)

    transfer = relationship("BranchTransfer", back_populates="items")
