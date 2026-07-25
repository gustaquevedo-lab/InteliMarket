"""add productividad tables (pdp_ prefix)

Revision ID: 20260601340000
Revises: 20260601330000
Create Date: 2026-06-04 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601340000"
down_revision = "20260601330000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pdp_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("employee_name", sa.String(200), nullable=True),
        sa.Column("area", sa.String(50), nullable=False, index=True),
        sa.Column("fecha", sa.Date, nullable=False, index=True),
        sa.Column("transactions_processed", sa.Float, server_default="0"),
        sa.Column("kg_processed", sa.Float, server_default="0"),
        sa.Column("units_processed", sa.Float, server_default="0"),
        sa.Column("boxes_processed", sa.Float, server_default="0"),
        sa.Column("sales_amount", sa.Float, server_default="0"),
        sa.Column("hours_worked", sa.Float, server_default="0"),
        sa.Column("planned_hours", sa.Float, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "pdp_targets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("area", sa.String(50), nullable=False),
        sa.Column("metric_name", sa.String(50), nullable=False),
        sa.Column("target_value", sa.Float, nullable=False),
        sa.Column("budget_cost_per_unit", sa.Float, server_default="0"),
        sa.Column("effective_from", sa.Date, nullable=False),
        sa.Column("effective_to", sa.Date, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "pdp_efficiency",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("employee_name", sa.String(200), nullable=True),
        sa.Column("area", sa.String(50), nullable=False, index=True),
        sa.Column("fecha_desde", sa.Date, nullable=False),
        sa.Column("fecha_hasta", sa.Date, nullable=False),
        sa.Column("total_hours", sa.Float, server_default="0"),
        sa.Column("planned_hours", sa.Float, server_default="0"),
        sa.Column("efficiency_pct", sa.Float, server_default="0"),
        sa.Column("metric_name", sa.String(50), nullable=True),
        sa.Column("metric_value", sa.Float, server_default="0"),
        sa.Column("metric_per_hour", sa.Float, server_default="0"),
        sa.Column("cost_per_unit", sa.Float, server_default="0"),
        sa.Column("ranking_in_area", sa.Integer, server_default="0"),
        sa.Column("trend", sa.String(20), server_default="stable"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("pdp_efficiency")
    op.drop_table("pdp_targets")
    op.drop_table("pdp_records")
