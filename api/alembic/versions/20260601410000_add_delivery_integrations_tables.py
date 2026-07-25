"""add delivery_integrations tables (di_*)

Revision ID: 20260601410000
Revises: 20260601400000
Create Date: 2026-06-04 19:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601410000"
down_revision = "20260601400000"
branch_labels = None
depends_on = None


def upgrade():
    # Delivery Integration Configs
    op.create_table(
        "di_delivery_integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("enabled", sa.Boolean, server_default="false"),
        sa.Column("store_id", sa.String(100), nullable=True),
        sa.Column("api_key", sa.String(500), nullable=True),
        sa.Column("api_secret", sa.String(500), nullable=True),
        sa.Column("webhook_secret", sa.String(200), nullable=True),
        sa.Column("webhook_url", sa.String(500), nullable=True),
        sa.Column("sync_catalog", sa.Boolean, server_default="false"),
        sa.Column("auto_accept_orders", sa.Boolean, server_default="false"),
        sa.Column("preparation_time_minutes", sa.Integer, server_default="30"),
        sa.Column("commission_pct", sa.Float, server_default="0"),
        sa.Column("config", postgresql.JSONB, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_di_integration_company_platform", "di_delivery_integrations", ["company_id", "platform"], unique=True)

    # Delivery Orders from Platforms
    op.create_table(
        "di_delivery_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("platform_order_id", sa.String(100), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="received"),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("customer_phone", sa.String(50), nullable=True),
        sa.Column("customer_address", sa.Text, nullable=True),
        sa.Column("delivery_lat", sa.Float, nullable=True),
        sa.Column("delivery_lng", sa.Float, nullable=True),
        sa.Column("subtotal", sa.Float, server_default="0"),
        sa.Column("delivery_fee", sa.Float, server_default="0"),
        sa.Column("discount", sa.Float, server_default="0"),
        sa.Column("commission", sa.Float, server_default="0"),
        sa.Column("net_amount", sa.Float, server_default="0"),
        sa.Column("total", sa.Float, server_default="0"),
        sa.Column("currency", sa.String(3), server_default="PYG"),
        sa.Column("order_data", postgresql.JSONB, nullable=True),
        sa.Column("items_data", postgresql.JSONB, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("preparing_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("picked_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("in_transit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_di_order_platform_id", "di_delivery_orders", ["platform", "platform_order_id"], unique=True)
    op.create_index("ix_di_order_company_status", "di_delivery_orders", ["company_id", "status"])
    op.create_index("ix_di_order_company_platform", "di_delivery_orders", ["company_id", "platform"])

    # Menu Sync Logs
    op.create_table(
        "di_menu_sync_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("products_count", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("sync_type", sa.String(20), server_default="full"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_di_menu_sync_company", "di_menu_sync_logs", ["company_id", "platform"])

    # Platform Activity Logs
    op.create_table(
        "di_platform_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("direction", sa.String(10), server_default="inbound"),
        sa.Column("request_url", sa.String(500), nullable=True),
        sa.Column("request_data", postgresql.JSONB, nullable=True),
        sa.Column("response_data", postgresql.JSONB, nullable=True),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column("status", sa.String(20), server_default="success"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_di_log_company_platform", "di_platform_logs", ["company_id", "platform"])
    op.create_index("ix_di_log_created", "di_platform_logs", ["created_at"])

    # Daily Stats
    op.create_table(
        "di_daily_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("stat_date", sa.Date, nullable=False),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("orders_count", sa.Integer, server_default="0"),
        sa.Column("total_sales", sa.Float, server_default="0"),
        sa.Column("total_commission", sa.Float, server_default="0"),
        sa.Column("net_sales", sa.Float, server_default="0"),
        sa.Column("avg_prep_time_minutes", sa.Float, nullable=True),
        sa.Column("cancelled_orders", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_di_stats_company_date", "di_daily_stats", ["company_id", "stat_date", "platform"], unique=True)


def downgrade():
    op.drop_index("ix_di_stats_company_date", table_name="di_daily_stats")
    op.drop_table("di_daily_stats")
    op.drop_index("ix_di_log_created", table_name="di_platform_logs")
    op.drop_index("ix_di_log_company_platform", table_name="di_platform_logs")
    op.drop_table("di_platform_logs")
    op.drop_index("ix_di_menu_sync_company", table_name="di_menu_sync_logs")
    op.drop_table("di_menu_sync_logs")
    op.drop_index("ix_di_order_company_platform", table_name="di_delivery_orders")
    op.drop_index("ix_di_order_company_status", table_name="di_delivery_orders")
    op.drop_index("ix_di_order_platform_id", table_name="di_delivery_orders")
    op.drop_table("di_delivery_orders")
    op.drop_index("ix_di_integration_company_platform", table_name="di_delivery_integrations")
    op.drop_table("di_delivery_integrations")
