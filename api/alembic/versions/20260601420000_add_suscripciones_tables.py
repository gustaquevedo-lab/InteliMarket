"""add suscripciones tables (sr_*)

Revision ID: 20260601420000
Revises: 20260601410000
Create Date: 2026-06-04 19:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601420000"
down_revision = "20260601410000"
branch_labels = None
depends_on = None


def upgrade():
    # Subscription Plans
    op.create_table(
        "sr_subscription_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("customer_email", sa.String(255), nullable=True),
        sa.Column("customer_phone", sa.String(50), nullable=True),
        sa.Column("frequency", sa.String(20), nullable=False),
        sa.Column("delivery_day", sa.Integer, nullable=True),
        sa.Column("delivery_address", sa.Text, nullable=True),
        sa.Column("delivery_zone_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("delivery_lat", sa.Float, nullable=True),
        sa.Column("delivery_lng", sa.Float, nullable=True),
        sa.Column("delivery_fee", sa.Float, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("discount_pct", sa.Float, server_default="0"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("next_generation_date", sa.Date, nullable=True),
        sa.Column("skip_next", sa.Boolean, server_default="false"),
        sa.Column("pause_reason", sa.String(200), nullable=True),
        sa.Column("total_generated", sa.Integer, server_default="0"),
        sa.Column("total_spent", sa.Float, server_default="0"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sr_plan_company_customer", "sr_subscription_plans", ["company_id", "customer_id"])
    op.create_index("ix_sr_plan_status", "sr_subscription_plans", ["company_id", "status"])

    # Plan Items
    op.create_table(
        "sr_subscription_plan_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sr_subscription_plans.id"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_name", sa.String(200), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Float, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Generated Orders
    op.create_table(
        "sr_generated_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sr_subscription_plans.id"), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_number", sa.String(20), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("subtotal", sa.Float, server_default="0"),
        sa.Column("discount", sa.Float, server_default="0"),
        sa.Column("delivery_fee", sa.Float, server_default="0"),
        sa.Column("total", sa.Float, server_default="0"),
        sa.Column("delivery_address", sa.Text, nullable=True),
        sa.Column("scheduled_date", sa.Date, nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ecommerce_order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("items_data", postgresql.JSONB, nullable=True),
        sa.Column("cancel_reason", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sr_gen_order_company_plan", "sr_generated_orders", ["company_id", "plan_id"])
    op.create_index("ix_sr_gen_order_status", "sr_generated_orders", ["company_id", "status"])
    op.create_index("ix_sr_gen_order_scheduled", "sr_generated_orders", ["scheduled_date"])

    # Subscription Payments
    op.create_table(
        "sr_subscription_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sr_subscription_plans.id"), nullable=False, index=True),
        sa.Column("generated_order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sr_generated_orders.id"), nullable=True),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("payment_method", sa.String(30), nullable=True),
        sa.Column("gateway", sa.String(30), nullable=True),
        sa.Column("transaction_id", sa.String(200), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sr_payment_plan", "sr_subscription_payments", ["company_id", "plan_id"])

    # Subscription Logs
    op.create_table(
        "sr_subscription_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sr_subscription_plans.id"), nullable=False, index=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("details", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sr_log_plan", "sr_subscription_logs", ["company_id", "plan_id"])


def downgrade():
    op.drop_index("ix_sr_log_plan", table_name="sr_subscription_logs")
    op.drop_table("sr_subscription_logs")
    op.drop_index("ix_sr_payment_plan", table_name="sr_subscription_payments")
    op.drop_table("sr_subscription_payments")
    op.drop_index("ix_sr_gen_order_scheduled", table_name="sr_generated_orders")
    op.drop_index("ix_sr_gen_order_status", table_name="sr_generated_orders")
    op.drop_index("ix_sr_gen_order_company_plan", table_name="sr_generated_orders")
    op.drop_table("sr_generated_orders")
    op.drop_table("sr_subscription_plan_items")
    op.drop_index("ix_sr_plan_status", table_name="sr_subscription_plans")
    op.drop_index("ix_sr_plan_company_customer", table_name="sr_subscription_plans")
    op.drop_table("sr_subscription_plans")
