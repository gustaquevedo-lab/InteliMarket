"""Product fractionation models -- gestiona la relacion entre un Display/Caja y su Unidad fraccionada."""
from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class ProductFractionation(Base):
    __tablename__ = "product_fractionations"
    __table_args__ = (
        UniqueConstraint("parent_product_id", name="uq_fractionation_parent"),
        UniqueConstraint("child_product_id", name="uq_fractionation_child"),
        CheckConstraint("factor_conversion > 1", name="chk_fractionation_factor"),
        CheckConstraint("parent_product_id <> child_product_id", name="chk_fractionation_diff"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    parent_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    child_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    factor_conversion = Column(Integer, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    parent_product = relationship("Product", foreign_keys=[parent_product_id])
    child_product = relationship("Product", foreign_keys=[child_product_id])
