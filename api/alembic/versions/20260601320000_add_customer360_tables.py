"""add customer360 tables (c360_ prefix)

Revision ID: 20260601320000
Revises: 20260601310000
Create Date: 2026-06-04 12:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601320000"
down_revision = "20260601310000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "c360_basket_analysis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("avg_ticket", sa.Numeric(14, 0), server_default="0"),
        sa.Column("avg_items_per_ticket", sa.Float, server_default="0"),
        sa.Column("total_spent_30d", sa.Numeric(14, 0), server_default="0"),
        sa.Column("total_spent_90d", sa.Numeric(14, 0), server_default="0"),
        sa.Column("total_transactions_30d", sa.Integer, server_default="0"),
        sa.Column("total_transactions_90d", sa.Integer, server_default="0"),
        sa.Column("pct_on_promotion", sa.Float, server_default="0"),
        sa.Column("margin_avg_pct", sa.Float, server_default="0"),
        sa.Column("preferred_department", sa.String(100), nullable=True),
        sa.Column("preferred_day", sa.String(20), nullable=True),
        sa.Column("preferred_hour", sa.Integer, nullable=True),
        sa.Column("avg_days_between_visits", sa.Float, server_default="0"),
        sa.Column("data_json", postgresql.JSON, nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "c360_category_penetration",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_name", sa.String(200), nullable=True),
        sa.Column("total_spent", sa.Numeric(14, 0), server_default="0"),
        sa.Column("total_transactions", sa.Integer, server_default="0"),
        sa.Column("penetration_pct", sa.Float, server_default="0"),
        sa.Column("share_of_wallet_pct", sa.Float, server_default="0"),
        sa.Column("last_purchase_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cross_sell_score", sa.Float, server_default="0"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "c360_churn_predictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("churn_score", sa.Float, server_default="0"),
        sa.Column("churn_risk", sa.String(20), server_default="low"),
        sa.Column("days_since_last_purchase", sa.Integer, server_default="0"),
        sa.Column("avg_frequency_days", sa.Float, server_default="0"),
        sa.Column("avg_ticket_change_pct", sa.Float, server_default="0"),
        sa.Column("frequency_change_pct", sa.Float, server_default="0"),
        sa.Column("category_attrition_score", sa.Float, server_default="0"),
        sa.Column("factors_json", postgresql.JSON, nullable=True),
        sa.Column("is_recovery_triggered", sa.Boolean, server_default="false"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "c360_lifecycle_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True, unique=True),
        sa.Column("stage", sa.String(30), nullable=False),
        sa.Column("days_in_stage", sa.Integer, server_default="0"),
        sa.Column("total_tenure_days", sa.Integer, server_default="0"),
        sa.Column("total_lifetime_value", sa.Numeric(14, 0), server_default="0"),
        sa.Column("predicted_ltv", sa.Numeric(14, 0), server_default="0"),
        sa.Column("ltv_trend", sa.String(10), server_default="stable"),
        sa.Column("segment_tags", postgresql.JSON, nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "c360_recovery_campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("churn_prediction_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("c360_churn_predictions.id"), nullable=True),
        sa.Column("trigger_score", sa.Float, server_default="0"),
        sa.Column("offer_type", sa.String(30), nullable=True),
        sa.Column("offer_value", sa.Numeric(14, 0), server_default="0"),
        sa.Column("offer_config", postgresql.JSON, nullable=True),
        sa.Column("channel", sa.String(30), server_default="auto"),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recovery_sale_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recovery_amount", sa.Numeric(14, 0), nullable=True),
        sa.Column("effectiveness_score", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("c360_recovery_campaigns")
    op.drop_table("c360_lifecycle_stages")
    op.drop_table("c360_churn_predictions")
    op.drop_table("c360_category_penetration")
    op.drop_table("c360_basket_analysis")
