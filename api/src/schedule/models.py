from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON, Float, Time, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class ShiftTemplate(Base):
    __tablename__ = "sch_shift_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)

    nombre = Column(String(100), nullable=False)
    area = Column(String(50), nullable=False)
    rol = Column(String(50), nullable=True)
    hora_inicio = Column(Time, nullable=False)
    hora_fin = Column(Time, nullable=False)
    days_of_week = Column(JSON, nullable=True)
    quantity_required = Column(Integer, default=1)
    min_break_minutes = Column(Integer, default=60)
    is_night_shift = Column(Boolean, default=False)
    is_holiday = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ShiftPlan(Base):
    __tablename__ = "sch_shift_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("sch_shift_templates.id"), nullable=True)
    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_name = Column(String(200), nullable=True)
    area = Column(String(50), nullable=False)
    rol = Column(String(50), nullable=True)
    fecha = Column(Date, nullable=False, index=True)
    hora_inicio = Column(Time, nullable=False)
    hora_fin = Column(Time, nullable=False)
    is_night_shift = Column(Boolean, default=False)
    is_holiday = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    status = Column(String(20), default="planned")
    conflict_detected = Column(Boolean, default=False)
    conflict_detail = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TimeClockEntry(Base):
    __tablename__ = "sch_time_clock_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)
    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("sch_shift_plans.id"), nullable=True)

    tipo = Column(String(20), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    source = Column(String(20), default="web")
    latitude = Column(String(30), nullable=True)
    longitude = Column(String(30), nullable=True)
    device_id = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    verified = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ShiftSwap(Base):
    __tablename__ = "sch_shift_swaps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("sch_shift_plans.id"), nullable=False)
    requester_id = Column(UUID(as_uuid=True), nullable=False)
    receiver_id = Column(UUID(as_uuid=True), nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    approved_by = Column(UUID(as_uuid=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ShiftCostConfig(Base):
    __tablename__ = "sch_shift_cost_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    tipo_hora = Column(String(30), nullable=False)
    factor_pct = Column(Float, nullable=False)
    descripcion = Column(String(200), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
