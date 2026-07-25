"""add benchmarking tables (sm_benchmark_*)

Revision ID: 20260601390000
Revises: 20260601380000
Create Date: 2026-06-04 17:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601390000"
down_revision = "20260601380000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "sm_benchmark_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("kpi_key", sa.String(50), nullable=False),
        sa.Column("kpi_label", sa.String(100), nullable=False),
        sa.Column("weight", sa.Float, server_default="1.0"),
        sa.Column("target_value", sa.Float, nullable=True),
        sa.Column("target_direction", sa.String(10), server_default="higher"),
        sa.Column("green_threshold", sa.Float, nullable=True),
        sa.Column("red_threshold", sa.Float, nullable=True),
        sa.Column("unit", sa.String(30), server_default=""),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sm_benchmark_regions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("branch_ids", postgresql.JSONB, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sm_benchmark_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("period_start", sa.Date, nullable=False, index=True),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("period_type", sa.String(10), server_default="weekly"),
        sa.Column("sales_per_sqm", sa.Float, server_default="0"),
        sa.Column("gross_margin_pct", sa.Float, server_default="0"),
        sa.Column("shrinkage_pct", sa.Float, server_default="0"),
        sa.Column("inventory_turnover", sa.Float, server_default="0"),
        sa.Column("avg_ticket", sa.Float, server_default="0"),
        sa.Column("transactions_per_day", sa.Float, server_default="0"),
        sa.Column("labor_productivity", sa.Float, server_default="0"),
        sa.Column("total_sales", sa.Float, server_default="0"),
        sa.Column("total_area_sqm", sa.Float, server_default="0"),
        sa.Column("total_transactions", sa.Integer, server_default="0"),
        sa.Column("labor_hours", sa.Float, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_benchmark_record_company_branch_period",
        "sm_benchmark_records",
        ["company_id", "branch_id", "period_start"],
    )
    op.create_table(
        "sm_benchmark_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("period_start", sa.Date, nullable=False, index=True),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("period_type", sa.String(10), server_default="weekly"),
        sa.Column("overall_score", sa.Float, server_default="0"),
        sa.Column("traffic_light", sa.String(10), server_default="yellow"),
        sa.Column("kpi_scores", postgresql.JSONB, nullable=True),
        sa.Column("kpi_details", postgresql.JSONB, nullable=True),
        sa.Column("rank", sa.Integer, nullable=True),
        sa.Column("total_stores", sa.Integer, nullable=True),
        sa.Column("percentile", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("sm_benchmark_scores")
    op.drop_index("ix_benchmark_record_company_branch_period", table_name="sm_benchmark_records")
    op.drop_table("sm_benchmark_records")
    op.drop_table("sm_benchmark_regions")
    op.drop_table("sm_benchmark_configs")
