import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, Integer, Date, JSON, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from api.src.db import Base


class DeliveryIntegration(Base):
    __tablename__ = "di_delivery_integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    platform = Column(String(20), nullable=False)
    enabled = Column(Boolean, server_default="false")
    store_id = Column(String(100), nullable=True)
    api_key = Column(String(500), nullable=True)
    api_secret = Column(String(500), nullable=True)
    webhook_secret = Column(String(200), nullable=True)
    webhook_url = Column(String(500), nullable=True)
    sync_catalog = Column(Boolean, server_default="false")
    auto_accept_orders = Column(Boolean, server_default="false")
    preparation_time_minutes = Column(Integer, server_default="30")
    commission_pct = Column(Float, server_default="0")
    config = Column(JSONB, nullable=True)
    is_active = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_di_integration_company_platform", "company_id", "platform", unique=True),
    )


class DeliveryOrder(Base):
    __tablename__ = "di_delivery_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    platform = Column(String(20), nullable=False)
    platform_order_id = Column(String(100), nullable=False)
    branch_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(String(30), nullable=False, server_default="received")
    customer_name = Column(String(200), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    customer_address = Column(Text, nullable=True)
    delivery_lat = Column(Float, nullable=True)
    delivery_lng = Column(Float, nullable=True)
    subtotal = Column(Float, server_default="0")
    delivery_fee = Column(Float, server_default="0")
    discount = Column(Float, server_default="0")
    commission = Column(Float, server_default="0")
    net_amount = Column(Float, server_default="0")
    total = Column(Float, server_default="0")
    currency = Column(String(3), server_default="PYG")
    order_data = Column(JSONB, nullable=True)
    items_data = Column(JSONB, nullable=True)
    notes = Column(Text, nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    preparing_at = Column(DateTime(timezone=True), nullable=True)
    ready_at = Column(DateTime(timezone=True), nullable=True)
    picked_up_at = Column(DateTime(timezone=True), nullable=True)
    in_transit_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_di_order_platform_id", "platform", "platform_order_id", unique=True),
        Index("ix_di_order_company_status", "company_id", "status"),
        Index("ix_di_order_company_platform", "company_id", "platform"),
    )


class DeliveryMenuSync(Base):
    __tablename__ = "di_menu_sync_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    platform = Column(String(20), nullable=False)
    status = Column(String(20), server_default="pending")
    products_count = Column(Integer, server_default="0")
    error_message = Column(Text, nullable=True)
    sync_type = Column(String(20), server_default="full")
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_di_menu_sync_company", "company_id", "platform"),
    )


class DeliveryPlatformLog(Base):
    __tablename__ = "di_platform_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    platform = Column(String(20), nullable=False)
    event_type = Column(String(50), nullable=False)
    direction = Column(String(10), server_default="inbound")
    request_url = Column(String(500), nullable=True)
    request_data = Column(JSONB, nullable=True)
    response_data = Column(JSONB, nullable=True)
    status_code = Column(Integer, nullable=True)
    status = Column(String(20), server_default="success")
    error_message = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_di_log_company_platform", "company_id", "platform"),
        Index("ix_di_log_created", "created_at"),
    )


class DeliveryDailyStats(Base):
    __tablename__ = "di_daily_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    stat_date = Column(Date, nullable=False)
    platform = Column(String(20), nullable=False)
    orders_count = Column(Integer, server_default="0")
    total_sales = Column(Float, server_default="0")
    total_commission = Column(Float, server_default="0")
    net_sales = Column(Float, server_default="0")
    avg_prep_time_minutes = Column(Float, nullable=True)
    cancelled_orders = Column(Integer, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_di_stats_company_date", "company_id", "stat_date", "platform", unique=True),
    )
