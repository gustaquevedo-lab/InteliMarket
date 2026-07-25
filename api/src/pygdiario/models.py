from sqlalchemy import Column, String, Boolean, DateTime, Float, Integer, Text, Date, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class DailyDepartmentPnl(Base):
    __tablename__ = "sm_daily_pnl"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)

    department = Column(String(50), nullable=False, index=True)
    fecha = Column(Date, nullable=False, index=True)

    sales_amount = Column(Float, default=0)
    transaction_count = Column(Integer, default=0)

    theoretical_cost = Column(Float, default=0)
    actual_cost = Column(Float, default=0)
    cost_of_sales = Column(Float, default=0)

    gross_margin_real = Column(Float, default=0)
    gross_margin_real_pct = Column(Float, default=0)
    gross_margin_theoretical = Column(Float, default=0)
    gross_margin_theoretical_pct = Column(Float, default=0)
    margin_variance = Column(Float, default=0)
    margin_variance_pct = Column(Float, default=0)

    shrinkage_cost = Column(Float, default=0)
    labor_cost = Column(Float, default=0)
    equipment_depreciation = Column(Float, default=0)
    other_costs = Column(Float, default=0)
    total_assignable_costs = Column(Float, default=0)

    net_margin = Column(Float, default=0)
    net_margin_pct = Column(Float, default=0)

    products_negative_margin = Column(JSON, nullable=True)
    top_products = Column(JSON, nullable=True)

    status = Column(String(20), default="draft")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PnlAdjustment(Base):
    __tablename__ = "sm_pnl_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    pnl_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    description = Column(String(300), nullable=False)
    adjustment_type = Column(String(30), nullable=False)
    amount = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PnlBudget(Base):
    __tablename__ = "sm_pnl_budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)

    department = Column(String(50), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=True)

    budgeted_sales = Column(Float, default=0)
    budgeted_cost = Column(Float, default=0)
    budgeted_margin_pct = Column(Float, default=0)
    budgeted_shrinkage = Column(Float, default=0)
    budgeted_labor = Column(Float, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
