"""add ecommerce_sm tables (sm_ecommerce_*)

Revision ID: 20260601400000
Revises: 20260601390000
Create Date: 2026-06-04 18:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601400000"
down_revision = "20260601390000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "sm_ecommerce_products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("online_visible", sa.Boolean, server_default="true"),
        sa.Column("online_price", sa.Float, nullable=False),
        sa.Column("compare_at_price", sa.Float, nullable=True),
        sa.Column("stock_available", sa.Integer, server_default="0"),
        sa.Column("low_stock_threshold", sa.Integer, server_default="5"),
        sa.Column("description_online", sa.Text, nullable=True),
        sa.Column("images", postgresql.JSONB, nullable=True),
        sa.Column("category_online", sa.String(100), nullable=True),
        sa.Column("tags", postgresql.JSONB, nullable=True),
        sa.Column("aisle_location", sa.String(50), nullable=True),
        sa.Column("max_per_order", sa.Integer, server_default="99"),
        sa.Column("requires_age_verification", sa.Boolean, server_default="false"),
        sa.Column("sort_order", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sm_ecom_prod_company_branch", "sm_ecommerce_products", ["company_id", "branch_id"])
    op.create_index("ix_sm_ecom_prod_product", "sm_ecommerce_products", ["product_id"])

    op.create_table(
        "sm_ecommerce_delivery_zones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("base_price", sa.Float, server_default="0"),
        sa.Column("price_per_km", sa.Float, server_default="0"),
        sa.Column("free_from_amount", sa.Float, nullable=True),
        sa.Column("estimated_minutes", sa.Integer, server_default="30"),
        sa.Column("polygon_coords", postgresql.JSONB, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "sm_ecommerce_delivery_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("slot_date", sa.Date, nullable=False, index=True),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=False),
        sa.Column("max_orders", sa.Integer, server_default="10"),
        sa.Column("current_orders", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sm_ecom_del_slot_zone_date", "sm_ecommerce_delivery_slots", ["company_id", "zone_id", "slot_date"])

    op.create_table(
        "sm_ecommerce_pickup_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("slot_date", sa.Date, nullable=False, index=True),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=False),
        sa.Column("max_orders", sa.Integer, server_default="10"),
        sa.Column("current_orders", sa.Integer, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sm_ecom_pickup_slot_branch_date", "sm_ecommerce_pickup_slots", ["company_id", "branch_id", "slot_date"])

    op.create_table(
        "sm_ecommerce_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_name", sa.String(200), nullable=False),
        sa.Column("customer_email", sa.String(255), nullable=True),
        sa.Column("customer_phone", sa.String(50), nullable=True),
        sa.Column("order_number", sa.String(20), nullable=False, unique=True),
        sa.Column("order_type", sa.String(10), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("subtotal", sa.Float, server_default="0"),
        sa.Column("shipping_cost", sa.Float, server_default="0"),
        sa.Column("discount", sa.Float, server_default="0"),
        sa.Column("total", sa.Float, server_default="0"),
        sa.Column("payment_status", sa.String(20), server_default="pending"),
        sa.Column("payment_method", sa.String(30), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("pickup_slot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("pickup_date", sa.Date, nullable=True),
        sa.Column("pickup_start", sa.Time, nullable=True),
        sa.Column("pickup_end", sa.Time, nullable=True),
        sa.Column("delivery_zone_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("delivery_address", sa.Text, nullable=True),
        sa.Column("delivery_lat", sa.Float, nullable=True),
        sa.Column("delivery_lng", sa.Float, nullable=True),
        sa.Column("delivery_date", sa.Date, nullable=True),
        sa.Column("delivery_start", sa.Time, nullable=True),
        sa.Column("delivery_end", sa.Time, nullable=True),
        sa.Column("preparation_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("preparing_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("picked_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("in_transit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.String(200), nullable=True),
        sa.Column("is_picked", sa.Boolean, server_default="false"),
        sa.Column("picking_list_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sm_ecom_order_company_status", "sm_ecommerce_orders", ["company_id", "status"])
    op.create_index("ix_sm_ecom_order_customer", "sm_ecommerce_orders", ["company_id", "customer_id"])
    op.create_index("ix_sm_ecom_order_branch_date", "sm_ecommerce_orders", ["company_id", "branch_id", "created_at"])

    op.create_table(
        "sm_ecommerce_order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sm_ecommerce_orders.id"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_name", sa.String(200), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_price", sa.Float, nullable=False),
        sa.Column("subtotal", sa.Float, nullable=False),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "sm_ecommerce_picking_lists",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sm_ecommerce_orders.id"), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("total_items", sa.Integer, server_default="0"),
        sa.Column("picked_items", sa.Integer, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "sm_ecommerce_picking_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("picking_list_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sm_ecommerce_picking_lists.id"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_name", sa.String(200), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("picked_quantity", sa.Integer, server_default="0"),
        sa.Column("aisle_location", sa.String(50), nullable=True),
        sa.Column("scanned", sa.Boolean, server_default="false"),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "sm_ecommerce_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sm_ecommerce_orders.id"), nullable=False, index=True),
        sa.Column("gateway", sa.String(30), nullable=False),
        sa.Column("transaction_id", sa.String(200), nullable=True),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("currency", sa.String(3), server_default="PYG"),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("gateway_response", postgresql.JSONB, nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("sm_ecommerce_payments")
    op.drop_table("sm_ecommerce_picking_items")
    op.drop_table("sm_ecommerce_picking_lists")
    op.drop_table("sm_ecommerce_order_items")
    op.drop_index("ix_sm_ecom_order_branch_date", table_name="sm_ecommerce_orders")
    op.drop_index("ix_sm_ecom_order_customer", table_name="sm_ecommerce_orders")
    op.drop_index("ix_sm_ecom_order_company_status", table_name="sm_ecommerce_orders")
    op.drop_table("sm_ecommerce_orders")
    op.drop_index("ix_sm_ecom_pickup_slot_branch_date", table_name="sm_ecommerce_pickup_slots")
    op.drop_table("sm_ecommerce_pickup_slots")
    op.drop_index("ix_sm_ecom_del_slot_zone_date", table_name="sm_ecommerce_delivery_slots")
    op.drop_table("sm_ecommerce_delivery_slots")
    op.drop_table("sm_ecommerce_delivery_zones")
    op.drop_index("ix_sm_ecom_prod_product", table_name="sm_ecommerce_products")
    op.drop_index("ix_sm_ecom_prod_company_branch", table_name="sm_ecommerce_products")
    op.drop_table("sm_ecommerce_products")
