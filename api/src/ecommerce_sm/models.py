import uuid
from datetime import datetime, date, time
from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, Integer, Date, Time, JSON, Index, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from api.src.db import Base


class EcommerceProduct(Base):
    __tablename__ = "sm_ecommerce_products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    online_visible = Column(Boolean, server_default="true")
    online_price = Column(Float, nullable=False)
    compare_at_price = Column(Float, nullable=True)
    stock_available = Column(Integer, server_default="0")
    low_stock_threshold = Column(Integer, server_default="5")
    description_online = Column(Text, nullable=True)
    images = Column(JSONB, nullable=True)
    category_online = Column(String(100), nullable=True)
    tags = Column(JSONB, nullable=True)
    aisle_location = Column(String(50), nullable=True)
    max_per_order = Column(Integer, server_default="99")
    requires_age_verification = Column(Boolean, server_default="false")
    sort_order = Column(Integer, server_default="0")
    is_active = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_sm_ecom_prod_company_branch", "company_id", "branch_id"),
        Index("ix_sm_ecom_prod_product", "product_id"),
    )


class EcommerceOrder(Base):
    __tablename__ = "sm_ecommerce_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_name = Column(String(200), nullable=False)
    customer_email = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    order_number = Column(String(20), nullable=False, unique=True)
    order_type = Column(String(10), nullable=False)
    status = Column(String(20), nullable=False, server_default="pending")
    subtotal = Column(Float, server_default="0")
    shipping_cost = Column(Float, server_default="0")
    discount = Column(Float, server_default="0")
    total = Column(Float, server_default="0")
    payment_status = Column(String(20), server_default="pending")
    payment_method = Column(String(30), nullable=True)
    notes = Column(Text, nullable=True)
    pickup_slot_id = Column(UUID(as_uuid=True), nullable=True)
    pickup_date = Column(Date, nullable=True)
    pickup_start = Column(Time, nullable=True)
    pickup_end = Column(Time, nullable=True)
    delivery_zone_id = Column(UUID(as_uuid=True), nullable=True)
    delivery_address = Column(Text, nullable=True)
    delivery_lat = Column(Float, nullable=True)
    delivery_lng = Column(Float, nullable=True)
    delivery_date = Column(Date, nullable=True)
    delivery_start = Column(Time, nullable=True)
    delivery_end = Column(Time, nullable=True)
    preparation_deadline = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    preparing_at = Column(DateTime(timezone=True), nullable=True)
    ready_at = Column(DateTime(timezone=True), nullable=True)
    picked_up_at = Column(DateTime(timezone=True), nullable=True)
    in_transit_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(String(200), nullable=True)
    is_picked = Column(Boolean, server_default="false")
    picking_list_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_sm_ecom_order_company_status", "company_id", "status"),
        Index("ix_sm_ecom_order_customer", "company_id", "customer_id"),
        Index("ix_sm_ecom_order_branch_date", "company_id", "branch_id", "created_at"),
    )


class EcommerceOrderItem(Base):
    __tablename__ = "sm_ecommerce_order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("sm_ecommerce_orders.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    product_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EcommercePickupSlot(Base):
    __tablename__ = "sm_ecommerce_pickup_slots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    slot_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    max_orders = Column(Integer, server_default="10")
    current_orders = Column(Integer, server_default="0")
    is_active = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_sm_ecom_pickup_slot_branch_date", "company_id", "branch_id", "slot_date"),
    )


class EcommerceDeliveryZone(Base):
    __tablename__ = "sm_ecommerce_delivery_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    base_price = Column(Float, server_default="0")
    price_per_km = Column(Float, server_default="0")
    free_from_amount = Column(Float, nullable=True)
    estimated_minutes = Column(Integer, server_default="30")
    polygon_coords = Column(JSONB, nullable=True)
    is_active = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EcommerceDeliverySlot(Base):
    __tablename__ = "sm_ecommerce_delivery_slots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    zone_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    slot_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    max_orders = Column(Integer, server_default="10")
    current_orders = Column(Integer, server_default="0")
    is_active = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_sm_ecom_del_slot_zone_date", "company_id", "zone_id", "slot_date"),
    )


class EcommercePickingList(Base):
    __tablename__ = "sm_ecommerce_picking_lists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("sm_ecommerce_orders.id"), nullable=False)
    branch_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    assigned_to = Column(UUID(as_uuid=True), nullable=True)
    status = Column(String(20), server_default="pending")
    total_items = Column(Integer, server_default="0")
    picked_items = Column(Integer, server_default="0")
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EcommercePickingItem(Base):
    __tablename__ = "sm_ecommerce_picking_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    picking_list_id = Column(UUID(as_uuid=True), ForeignKey("sm_ecommerce_picking_lists.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    product_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False)
    picked_quantity = Column(Integer, server_default="0")
    aisle_location = Column(String(50), nullable=True)
    scanned = Column(Boolean, server_default="false")
    status = Column(String(20), server_default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EcommercePayment(Base):
    __tablename__ = "sm_ecommerce_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("sm_ecommerce_orders.id"), nullable=False, index=True)
    gateway = Column(String(30), nullable=False)
    transaction_id = Column(String(200), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), server_default="PYG")
    status = Column(String(20), server_default="pending")
    gateway_response = Column(JSONB, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
