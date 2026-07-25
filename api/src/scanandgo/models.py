from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class ScanSession(Base):
    __tablename__ = "sg_scan_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)

    status = Column(String(20), nullable=False, default="active")
    total_items = Column(Integer, default=0)
    total_amount = Column(Numeric(14, 0), default=0)
    discount_amount = Column(Numeric(14, 0), default=0)
    final_amount = Column(Numeric(14, 0), default=0)
    currency = Column(String(10), default="Gs")

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ScanItem(Base):
    __tablename__ = "sg_scan_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sg_scan_sessions.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False)

    barcode = Column(String(80), nullable=True)
    product_name = Column(String(200), nullable=True)
    quantity = Column(Numeric(10, 3), nullable=False, default=1)
    unit_price = Column(Numeric(14, 0), nullable=False)
    subtotal = Column(Numeric(14, 0), nullable=False)
    is_weight = Column(Boolean, default=False)
    weight_kg = Column(Numeric(10, 3), nullable=True)

    scanned_at = Column(DateTime(timezone=True), server_default=func.now())


class ScanPayment(Base):
    __tablename__ = "sg_scan_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sg_scan_sessions.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    method = Column(String(30), nullable=False)
    amount = Column(Numeric(14, 0), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    gateway = Column(String(30), nullable=True)
    gateway_transaction_id = Column(String(120), nullable=True)
    gateway_response = Column(JSON, nullable=True)
    loyalty_points_used = Column(Integer, default=0)
    loyalty_discount = Column(Numeric(14, 0), default=0)

    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ScanAudit(Base):
    __tablename__ = "sg_scan_audits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sg_scan_sessions.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    is_random_audit = Column(Boolean, default=False)
    items_to_check = Column(JSON, nullable=True)
    items_checked = Column(JSON, nullable=True)
    discrepancies = Column(JSON, nullable=True)
    has_discrepancy = Column(Boolean, default=False)
    status = Column(String(20), default="pending")
    checked_by = Column(UUID(as_uuid=True), nullable=True)
    checked_at = Column(DateTime(timezone=True), nullable=True)
    resolution = Column(String(30), nullable=True)
    resolution_note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ScanDashboard(Base):
    __tablename__ = "sg_scan_daily_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)

    date = Column(DateTime(timezone=True), nullable=False)
    total_sessions = Column(Integer, default=0)
    completed_sessions = Column(Integer, default=0)
    abandoned_sessions = Column(Integer, default=0)
    total_amount = Column(Numeric(16, 0), default=0)
    total_items = Column(Integer, default=0)
    audits_conducted = Column(Integer, default=0)
    audits_with_discrepancy = Column(Integer, default=0)
    avg_session_value = Column(Numeric(14, 0), default=0)
    avg_items_per_session = Column(Float, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
