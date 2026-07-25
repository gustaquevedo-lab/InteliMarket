import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, Integer, Date, JSON, Index, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from api.src.db import Base


class SubscriptionPlan(Base):
    __tablename__ = "sr_subscription_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=False)
    customer_name = Column(String(200), nullable=True)
    customer_email = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    frequency = Column(String(20), nullable=False)
    delivery_day = Column(Integer, nullable=True)
    delivery_address = Column(Text, nullable=True)
    delivery_zone_id = Column(UUID(as_uuid=True), nullable=True)
    delivery_lat = Column(Float, nullable=True)
    delivery_lng = Column(Float, nullable=True)
    delivery_fee = Column(Float, server_default="0")
    status = Column(String(20), nullable=False, server_default="active")
    discount_pct = Column(Float, server_default="0")
    notes = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    next_generation_date = Column(Date, nullable=True)
    skip_next = Column(Boolean, server_default="false")
    pause_reason = Column(String(200), nullable=True)
    total_generated = Column(Integer, server_default="0")
    total_spent = Column(Float, server_default="0")
    is_active = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_sr_plan_company_customer", "company_id", "customer_id"),
        Index("ix_sr_plan_status", "company_id", "status"),
    )


class SubscriptionPlanItem(Base):
    __tablename__ = "sr_subscription_plan_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("sr_subscription_plans.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    product_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False, server_default="1")
    unit_price = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class GeneratedOrder(Base):
    __tablename__ = "sr_generated_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("sr_subscription_plans.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False)
    order_number = Column(String(20), nullable=False, unique=True)
    status = Column(String(20), nullable=False, server_default="pending")
    subtotal = Column(Float, server_default="0")
    discount = Column(Float, server_default="0")
    delivery_fee = Column(Float, server_default="0")
    total = Column(Float, server_default="0")
    delivery_address = Column(Text, nullable=True)
    scheduled_date = Column(Date, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    notified_at = Column(DateTime(timezone=True), nullable=True)
    ecommerce_order_id = Column(UUID(as_uuid=True), nullable=True)
    items_data = Column(JSONB, nullable=True)
    cancel_reason = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_sr_gen_order_company_plan", "company_id", "plan_id"),
        Index("ix_sr_gen_order_status", "company_id", "status"),
        Index("ix_sr_gen_order_scheduled", "scheduled_date"),
    )


class SubscriptionPayment(Base):
    __tablename__ = "sr_subscription_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("sr_subscription_plans.id"), nullable=False, index=True)
    generated_order_id = Column(UUID(as_uuid=True), ForeignKey("sr_generated_orders.id"), nullable=True)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(30), nullable=True)
    gateway = Column(String(30), nullable=True)
    transaction_id = Column(String(200), nullable=True)
    status = Column(String(20), server_default="pending")
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_sr_payment_plan", "company_id", "plan_id"),
    )


class SubscriptionLog(Base):
    __tablename__ = "sr_subscription_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("sr_subscription_plans.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_sr_log_plan", "company_id", "plan_id"),
    )
