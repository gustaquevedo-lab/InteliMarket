"""Bonificacion de proveedor por volumen de compra puntual (ej. "llevando
100 cajas, te regalan 5") -- distinto del rebate acumulado por periodo tipo
PARESA (api/src/supplier_kpis/). Ni el legacy ni Intelimarket lo trackeaban
(confirmado por auditoria); hoy se maneja de memoria/Excel."""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class PurchaseBonusScale(Base):
    """Una escala: a partir de `cantidad_minima` comprada de este producto a
    este proveedor, se bonifican `cantidad_bonificada` unidades extra."""
    __tablename__ = "purchase_bonus_scales"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    cantidad_minima = Column(Numeric(10, 3), nullable=False)
    cantidad_bonificada = Column(Numeric(10, 3), nullable=False)
    activo = Column(Boolean, nullable=False, default=True)
    observaciones = Column(String(300))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
