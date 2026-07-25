from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class PriceListAssignment(Base):
    __tablename__ = "sp_price_list_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    price_list_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # cliente, grupo, canal, zona
    ref_id = Column(String(255), nullable=False)  # customer_id, group name, channel slug, zone name
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TieredPrice(Base):
    __tablename__ = "sp_tiered_prices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    price_list_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # null applies globally
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    min_qty = Column(Integer, nullable=False, default=1)
    max_qty = Column(Integer, nullable=True)
    precio_unitario = Column(Numeric(15, 2), nullable=False)
    moneda = Column(String(3), default="PYG")
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Promotion(Base):
    __tablename__ = "sp_promotions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=True)
    tipo = Column(String(30), nullable=False)  # 2x1, quantity_discount, product_bonus, combo, percentage_discount, fixed_discount
    fecha_inicio = Column(DateTime(timezone=True), nullable=False)
    fecha_fin = Column(DateTime(timezone=True), nullable=False)
    activo = Column(Boolean, default=True)
    condiciones = Column(JSON, nullable=True)  # flexible conditions (min purchase, specific customers, etc.)
    prioridad = Column(Integer, default=0)
    max_usos = Column(Integer, nullable=True)
    usos_actuales = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PromotionReward(Base):
    __tablename__ = "sp_promotion_rewards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promotion_id = Column(UUID(as_uuid=True), ForeignKey("sp_promotions.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    qty_required = Column(Integer, default=1)  # buy X
    qty_free = Column(Integer, default=0)  # get Y free (for 2x1 or bonus)
    discount_pct = Column(Numeric(5, 2), default=0)  # discount % (for quantity_discount or percentage_discount)
    precio_fijo = Column(Numeric(15, 2), nullable=True)  # fixed price (for combo)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PromotionAssignment(Base):
    __tablename__ = "sp_promotion_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promotion_id = Column(UUID(as_uuid=True), ForeignKey("sp_promotions.id"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # all, cliente, grupo, canal, zona
    ref_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PriceSuggestion(Base):
    __tablename__ = "sp_price_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    current_price = Column(Numeric(15, 2), nullable=False)
    suggested_price = Column(Numeric(15, 2), nullable=False)
    confidence = Column(Numeric(5, 2), nullable=True)  # 0-100
    factors = Column(JSON, nullable=True)  # {demand_score, seasonality_factor, cost, margin_target, competitor_price, ...}
    source = Column(String(30), nullable=False)  # demanda, estacionalidad, costo_margen, competencia, mixto
    estado = Column(String(20), default="pending")  # pending, approved, rejected
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PriceChangeRequest(Base):
    __tablename__ = "sp_price_change_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    price_list_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    old_price = Column(Numeric(15, 2), nullable=False)
    new_price = Column(Numeric(15, 2), nullable=False)
    reason = Column(Text, nullable=True)
    requested_by = Column(UUID(as_uuid=True), nullable=False)
    approved_by = Column(UUID(as_uuid=True), nullable=True)
    status = Column(String(20), default="pending")  # pending, approved_1, approved, rejected
    approval_level = Column(Integer, default=1)  # 1 or 2 levels
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PriceChangeHistory(Base):
    __tablename__ = "sp_price_change_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    price_list_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    old_price = Column(Numeric(15, 2), nullable=False)
    new_price = Column(Numeric(15, 2), nullable=False)
    changed_by = Column(UUID(as_uuid=True), nullable=False)
    change_type = Column(String(20), nullable=False)  # manual, approval, promotion, dynamic, bulk
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
