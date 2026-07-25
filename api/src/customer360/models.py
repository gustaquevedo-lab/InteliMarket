from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class CustomerBasketAnalysis(Base):
    __tablename__ = "c360_basket_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    avg_ticket = Column(Numeric(14, 0), default=0)
    avg_items_per_ticket = Column(Float, default=0)
    total_spent_30d = Column(Numeric(14, 0), default=0)
    total_spent_90d = Column(Numeric(14, 0), default=0)
    total_transactions_30d = Column(Integer, default=0)
    total_transactions_90d = Column(Integer, default=0)
    pct_on_promotion = Column(Float, default=0)
    margin_avg_pct = Column(Float, default=0)
    preferred_department = Column(String(100), nullable=True)
    preferred_day = Column(String(20), nullable=True)
    preferred_hour = Column(Integer, nullable=True)
    avg_days_between_visits = Column(Float, default=0)
    data_json = Column(JSON, nullable=True)

    computed_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CustomerCategoryPenetration(Base):
    __tablename__ = "c360_category_penetration"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), nullable=False)
    category_name = Column(String(200), nullable=True)

    total_spent = Column(Numeric(14, 0), default=0)
    total_transactions = Column(Integer, default=0)
    penetration_pct = Column(Float, default=0)
    share_of_wallet_pct = Column(Float, default=0)
    last_purchase_at = Column(DateTime(timezone=True), nullable=True)
    cross_sell_score = Column(Float, default=0)

    computed_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CustomerChurnPrediction(Base):
    __tablename__ = "c360_churn_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    churn_score = Column(Float, default=0)
    churn_risk = Column(String(20), default="low")
    days_since_last_purchase = Column(Integer, default=0)
    avg_frequency_days = Column(Float, default=0)
    avg_ticket_change_pct = Column(Float, default=0)
    frequency_change_pct = Column(Float, default=0)
    category_attrition_score = Column(Float, default=0)
    factors_json = Column(JSON, nullable=True)
    is_recovery_triggered = Column(Boolean, default=False)

    computed_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CustomerLifecycleStage(Base):
    __tablename__ = "c360_lifecycle_stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True, unique=True)

    stage = Column(String(30), nullable=False)
    days_in_stage = Column(Integer, default=0)
    total_tenure_days = Column(Integer, default=0)
    total_lifetime_value = Column(Numeric(14, 0), default=0)
    predicted_ltv = Column(Numeric(14, 0), default=0)
    ltv_trend = Column(String(10), default="stable")
    segment_tags = Column(JSON, nullable=True)

    computed_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RecoveryCampaign(Base):
    __tablename__ = "c360_recovery_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    churn_prediction_id = Column(UUID(as_uuid=True), ForeignKey("c360_churn_predictions.id"), nullable=True)

    trigger_score = Column(Float, default=0)
    offer_type = Column(String(30), nullable=True)
    offer_value = Column(Numeric(14, 0), default=0)
    offer_config = Column(JSON, nullable=True)
    channel = Column(String(30), default="auto")
    status = Column(String(20), default="pending")
    notified_at = Column(DateTime(timezone=True), nullable=True)
    redeemed_at = Column(DateTime(timezone=True), nullable=True)
    recovery_sale_id = Column(UUID(as_uuid=True), nullable=True)
    recovery_amount = Column(Numeric(14, 0), nullable=True)
    effectiveness_score = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
