from sqlalchemy import Column, String, Boolean, DateTime, Float, Integer, Text, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class ProductivityRecord(Base):
    __tablename__ = "pdp_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)
    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_name = Column(String(200), nullable=True)

    area = Column(String(50), nullable=False, index=True)
    fecha = Column(Date, nullable=False, index=True)

    transactions_processed = Column(Float, default=0)
    kg_processed = Column(Float, default=0)
    units_processed = Column(Float, default=0)
    boxes_processed = Column(Float, default=0)
    sales_amount = Column(Float, default=0)

    hours_worked = Column(Float, default=0)
    planned_hours = Column(Float, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProductivityTarget(Base):
    __tablename__ = "pdp_targets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)

    area = Column(String(50), nullable=False)
    metric_name = Column(String(50), nullable=False)
    target_value = Column(Float, nullable=False)
    budget_cost_per_unit = Column(Float, default=0)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EmployeeEfficiency(Base):
    __tablename__ = "pdp_efficiency"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)
    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_name = Column(String(200), nullable=True)

    area = Column(String(50), nullable=False, index=True)
    fecha_desde = Column(Date, nullable=False)
    fecha_hasta = Column(Date, nullable=False)

    total_hours = Column(Float, default=0)
    planned_hours = Column(Float, default=0)
    efficiency_pct = Column(Float, default=0)

    metric_name = Column(String(50), nullable=True)
    metric_value = Column(Float, default=0)
    metric_per_hour = Column(Float, default=0)
    cost_per_unit = Column(Float, default=0)

    ranking_in_area = Column(Integer, default=0)
    trend = Column(String(20), default="stable")

    computed_at = Column(DateTime(timezone=True), server_default=func.now())
