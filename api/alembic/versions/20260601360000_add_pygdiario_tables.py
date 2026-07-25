"""add pyg diario tables (sm_ prefix)

Revision ID: 20260601360000
Revises: 20260601350000
Create Date: 2026-06-04 16:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601360000"
down_revision = "20260601350000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "sm_daily_pnl",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("department", sa.String(50), nullable=False, index=True),
        sa.Column("fecha", sa.Date, nullable=False, index=True),
        sa.Column("sales_amount", sa.Float, server_default="0"),
        sa.Column("transaction_count", sa.Integer, server_default="0"),
        sa.Column("theoretical_cost", sa.Float, server_default="0"),
        sa.Column("actual_cost", sa.Float, server_default="0"),
        sa.Column("cost_of_sales", sa.Float, server_default="0"),
        sa.Column("gross_margin_real", sa.Float, server_default="0"),
        sa.Column("gross_margin_real_pct", sa.Float, server_default="0"),
        sa.Column("gross_margin_theoretical", sa.Float, server_default="0"),
        sa.Column("gross_margin_theoretical_pct", sa.Float, server_default="0"),
        sa.Column("margin_variance", sa.Float, server_default="0"),
        sa.Column("margin_variance_pct", sa.Float, server_default="0"),
        sa.Column("shrinkage_cost", sa.Float, server_default="0"),
        sa.Column("labor_cost", sa.Float, server_default="0"),
        sa.Column("equipment_depreciation", sa.Float, server_default="0"),
        sa.Column("other_costs", sa.Float, server_default="0"),
        sa.Column("total_assignable_costs", sa.Float, server_default="0"),
        sa.Column("net_margin", sa.Float, server_default="0"),
        sa.Column("net_margin_pct", sa.Float, server_default="0"),
        sa.Column("products_negative_margin", postgresql.JSON, nullable=True),
        sa.Column("top_products", postgresql.JSON, nullable=True),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sm_pnl_adjustments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("pnl_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("adjustment_type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sm_pnl_budgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("department", sa.String(50), nullable=False),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=True),
        sa.Column("budgeted_sales", sa.Float, server_default="0"),
        sa.Column("budgeted_cost", sa.Float, server_default="0"),
        sa.Column("budgeted_margin_pct", sa.Float, server_default="0"),
        sa.Column("budgeted_shrinkage", sa.Float, server_default="0"),
        sa.Column("budgeted_labor", sa.Float, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("sm_pnl_budgets")
    op.drop_table("sm_pnl_adjustments")
    op.drop_table("sm_daily_pnl")
