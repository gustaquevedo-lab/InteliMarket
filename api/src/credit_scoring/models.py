from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class CreditScore(Base):
    __tablename__ = "sc_credit_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)

    score = Column(Integer, nullable=False, default=500)
    risk_level = Column(String(20), nullable=False, default="medium")

    payment_history_score = Column(Integer, default=0)
    antiquity_score = Column(Integer, default=0)
    frequency_score = Column(Integer, default=0)
    avg_amount_score = Column(Integer, default=0)
    industry_score = Column(Integer, default=0)
    credit_utilization_score = Column(Integer, default=0)

    suggested_credit_limit = Column(Numeric(14, 0), default=0)
    current_credit_limit = Column(Numeric(14, 0), default=0)
    used_credit = Column(Numeric(14, 0), default=0)
    available_credit = Column(Numeric(14, 0), default=0)

    on_time_payment_rate = Column(Float, default=1.0)
    average_payment_delay_days = Column(Float, default=0)
    total_overdue_days = Column(Integer, default=0)
    days_since_last_purchase = Column(Integer, nullable=True)
    total_purchases = Column(Integer, default=0)
    total_purchase_amount = Column(Numeric(14, 0), default=0)
    months_as_customer = Column(Integer, default=0)
    times_overdue = Column(Integer, default=0)

    status = Column(String(20), default="active")
    is_auto_blocked = Column(Boolean, default=False)
    block_reason = Column(Text, nullable=True)
    last_evaluation_date = Column(DateTime(timezone=True), default=func.now())
    next_evaluation_date = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RiskAlert(Base):
    __tablename__ = "sc_risk_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    alert_type = Column(String(30), nullable=False)
    severity = Column(String(20), nullable=False, default="medium")
    previous_score = Column(Integer, nullable=True)
    new_score = Column(Integer, nullable=True)
    message = Column(Text, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    is_read = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CreditEvent(Base):
    __tablename__ = "sc_credit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    event_type = Column(String(30), nullable=False)
    previous_limit = Column(Numeric(14, 0), nullable=True)
    new_limit = Column(Numeric(14, 0), nullable=True)
    previous_score = Column(Integer, nullable=True)
    new_score = Column(Integer, nullable=True)
    reason = Column(Text, nullable=True)
    performed_by = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
