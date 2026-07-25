from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class RfmScore(Base):
    __tablename__ = "cli_rfm_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)

    recency_days = Column(Integer, nullable=True)
    recency_score = Column(Integer, default=3)
    frequency_count = Column(Integer, default=0)
    frequency_score = Column(Integer, default=3)
    monetary_total = Column(Numeric(14, 0), default=0)
    monetary_score = Column(Integer, default=3)

    rfm_total = Column(Integer, default=9)
    rfm_segment = Column(String(30), nullable=True)

    last_evaluation_date = Column(DateTime(timezone=True), default=func.now())

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BehavioralSegment(Base):
    __tablename__ = "cli_behavioral_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    nombre = Column(String(80), nullable=False)
    descripcion = Column(Text, nullable=True)
    slug = Column(String(40), nullable=False, unique=True)
    color = Column(String(20), default="#6366f1")

    rfm_min = Column(Integer, nullable=True)
    rfm_max = Column(Integer, nullable=True)
    rules = Column(JSON, nullable=True)

    customer_count = Column(Integer, default=0)
    is_system = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CustomerSegmentAssignment(Base):
    __tablename__ = "cli_segment_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("cli_behavioral_segments.id"), nullable=False, index=True)

    assigned_by = Column(String(40), default="auto")
    assigned_at = Column(DateTime(timezone=True), default=func.now())


class LoyaltyProgram(Base):
    __tablename__ = "cli_loyalty_programs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)

    nombre = Column(String(80), default="Programa de Lealtad")
    points_per_currency = Column(Integer, default=1)
    signup_bonus = Column(Integer, default=100)
    referral_bonus = Column(Integer, default=50)
    min_redeem_points = Column(Integer, default=500)
    currency_name = Column(String(30), default="Puntos")
    tier_enabled = Column(Boolean, default=False)

    tier_bronze_min = Column(Integer, default=0)
    tier_silver_min = Column(Integer, default=500)
    tier_gold_min = Column(Integer, default=1500)
    tier_platinum_min = Column(Integer, default=3000)

    activo = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LoyaltyTransaction(Base):
    __tablename__ = "cli_loyalty_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    tipo = Column(String(20), nullable=False)
    puntos = Column(Integer, nullable=False)
    concepto = Column(String(200), nullable=True)
    order_id = Column(UUID(as_uuid=True), nullable=True)
    reference_type = Column(String(30), nullable=True)
    reference_id = Column(String(80), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PersonalizedOffer(Base):
    __tablename__ = "cli_personalized_offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    nombre = Column(String(120), nullable=False)
    descripcion = Column(Text, nullable=True)
    offer_type = Column(String(30), nullable=False)
    discount_type = Column(String(20), nullable=False)
    discount_value = Column(Numeric(10, 2), nullable=False)
    min_purchase = Column(Numeric(14, 0), default=0)

    target_type = Column(String(30), nullable=False)
    target_segment_id = Column(UUID(as_uuid=True), ForeignKey("cli_behavioral_segments.id"), nullable=True)
    target_customer_id = Column(UUID(as_uuid=True), nullable=True)

    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    max_redemptions = Column(Integer, default=0)
    current_redemptions = Column(Integer, default=0)
    activo = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CouponCode(Base):
    __tablename__ = "cli_coupon_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    offer_id = Column(UUID(as_uuid=True), ForeignKey("cli_personalized_offers.id"), nullable=True, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    code = Column(String(40), nullable=False, unique=True, index=True)
    discount_type = Column(String(20), nullable=False)
    discount_value = Column(Numeric(10, 2), nullable=False)
    min_purchase = Column(Numeric(14, 0), default=0)
    is_percentage = Column(Boolean, default=True)

    max_uses = Column(Integer, default=1)
    current_uses = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    starts_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    used_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
