from sqlalchemy import Column, String, Boolean, DateTime, Float, Integer, Text, Date, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class ShrinkageRecord(Base):
    __tablename__ = "sm_shrinkage_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)

    category = Column(String(50), nullable=False, index=True)
    fecha = Column(Date, nullable=False, index=True)

    theoretical_sales = Column(Float, default=0)
    actual_sales = Column(Float, default=0)
    total_shrinkage = Column(Float, default=0)
    shrinkage_pct = Column(Float, default=0)

    external_theft_est = Column(Float, default=0)
    internal_theft_est = Column(Float, default=0)
    pricing_error_est = Column(Float, default=0)
    unrecorded_waste_est = Column(Float, default=0)
    breakage_est = Column(Float, default=0)

    high_value_shrinkage = Column(Float, default=0)
    night_shift_shrinkage = Column(Float, default=0)
    price_discrepancy_count = Column(Integer, default=0)

    anomaly_score = Column(Float, default=0)
    is_anomaly = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ShrinkageAlert(Base):
    __tablename__ = "sm_shrinkage_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)

    category = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    description = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=True)

    metric_name = Column(String(50), nullable=True)
    metric_value = Column(Float, nullable=True)
    threshold = Column(Float, nullable=True)

    detected_pattern = Column(String(50), nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ShrinkageRecommendation(Base):
    __tablename__ = "sm_shrinkage_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)

    category = Column(String(50), nullable=False)
    recommendation_type = Column(String(30), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    priority = Column(String(20), default="medium")
    potential_savings = Column(Float, default=0)

    is_applied = Column(Boolean, default=False)
    applied_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
