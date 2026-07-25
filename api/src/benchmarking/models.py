import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, Integer, Date, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from api.src.db import Base


class BenchmarkConfig(Base):
    __tablename__ = "sm_benchmark_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    kpi_key = Column(String(50), nullable=False)
    kpi_label = Column(String(100), nullable=False)
    weight = Column(Float, server_default="1.0")
    target_value = Column(Float, nullable=True)
    target_direction = Column(String(10), server_default="higher")
    green_threshold = Column(Float, nullable=True)
    red_threshold = Column(Float, nullable=True)
    unit = Column(String(30), server_default="")
    is_active = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BenchmarkRegion(Base):
    __tablename__ = "sm_benchmark_regions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    branch_ids = Column(JSONB, nullable=True)
    is_active = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BenchmarkRecord(Base):
    __tablename__ = "sm_benchmark_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False)
    period_type = Column(String(10), server_default="weekly")
    sales_per_sqm = Column(Float, server_default="0")
    gross_margin_pct = Column(Float, server_default="0")
    shrinkage_pct = Column(Float, server_default="0")
    inventory_turnover = Column(Float, server_default="0")
    avg_ticket = Column(Float, server_default="0")
    transactions_per_day = Column(Float, server_default="0")
    labor_productivity = Column(Float, server_default="0")
    total_sales = Column(Float, server_default="0")
    total_area_sqm = Column(Float, server_default="0")
    total_transactions = Column(Integer, server_default="0")
    labor_hours = Column(Float, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_benchmark_record_company_branch_period", "company_id", "branch_id", "period_start"),
    )


class BenchmarkScore(Base):
    __tablename__ = "sm_benchmark_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False)
    period_type = Column(String(10), server_default="weekly")
    overall_score = Column(Float, server_default="0")
    traffic_light = Column(String(10), server_default="yellow")
    kpi_scores = Column(JSONB, nullable=True)
    kpi_details = Column(JSONB, nullable=True)
    rank = Column(Integer, nullable=True)
    total_stores = Column(Integer, nullable=True)
    percentile = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
