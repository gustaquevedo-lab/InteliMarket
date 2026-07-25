from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class Opportunity(Base):
    __tablename__ = "co_opportunities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=True)
    suggested_product_id = Column(UUID(as_uuid=True), nullable=True)

    opportunity_type = Column(String(30), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(10), default="medium")
    score = Column(Integer, default=0)
    status = Column(String(20), default="pending")

    suggested_discount_pct = Column(Numeric(5, 2), nullable=True)
    suggested_action = Column(String(100), nullable=True)
    metadata_json = Column(JSON, nullable=True)
    assigned_to = Column(UUID(as_uuid=True), nullable=True)

    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProductAffinity(Base):
    __tablename__ = "co_product_affinity"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_a_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_b_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    support = Column(Float, default=0)
    confidence = Column(Float, default=0)
    lift = Column(Float, default=0)
    times_bought_together = Column(Integer, default=0)

    last_computed_at = Column(DateTime(timezone=True), server_default=func.now())

    class Meta:
        unique_constraint = ("company_id", "product_a_id", "product_b_id")


class Recommendation(Base):
    __tablename__ = "co_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False)

    recommendation_type = Column(String(30), nullable=False)
    score = Column(Integer, default=0)
    reason = Column(Text, nullable=True)
    is_applied = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChurnAnalysis(Base):
    __tablename__ = "co_churn_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    churn_score = Column(Integer, default=0)
    churn_risk = Column(String(10), default="low")
    days_since_last_purchase = Column(Integer, nullable=True)
    previous_frequency_days = Column(Float, nullable=True)
    current_frequency_days = Column(Float, nullable=True)
    frequency_drop_pct = Column(Float, nullable=True)
    average_purchase_amount = Column(Numeric(14, 0), nullable=True)

    evaluated_at = Column(DateTime(timezone=True), server_default=func.now())
