"""add shrinkage tables (sm_ prefix)

Revision ID: 20260601370000
Revises: 20260601360000
Create Date: 2026-06-04 16:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601370000"
down_revision = "20260601360000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "sm_shrinkage_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("fecha", sa.Date, nullable=False, index=True),
        sa.Column("theoretical_sales", sa.Float, server_default="0"),
        sa.Column("actual_sales", sa.Float, server_default="0"),
        sa.Column("total_shrinkage", sa.Float, server_default="0"),
        sa.Column("shrinkage_pct", sa.Float, server_default="0"),
        sa.Column("external_theft_est", sa.Float, server_default="0"),
        sa.Column("internal_theft_est", sa.Float, server_default="0"),
        sa.Column("pricing_error_est", sa.Float, server_default="0"),
        sa.Column("unrecorded_waste_est", sa.Float, server_default="0"),
        sa.Column("breakage_est", sa.Float, server_default="0"),
        sa.Column("high_value_shrinkage", sa.Float, server_default="0"),
        sa.Column("night_shift_shrinkage", sa.Float, server_default="0"),
        sa.Column("price_discrepancy_count", sa.Integer, server_default="0"),
        sa.Column("anomaly_score", sa.Float, server_default="0"),
        sa.Column("is_anomaly", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sm_shrinkage_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("recommendation", sa.Text, nullable=True),
        sa.Column("metric_name", sa.String(50), nullable=True),
        sa.Column("metric_value", sa.Float, nullable=True),
        sa.Column("threshold", sa.Float, nullable=True),
        sa.Column("detected_pattern", sa.String(50), nullable=True),
        sa.Column("is_resolved", sa.Boolean, server_default="false"),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sm_shrinkage_recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("recommendation_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("priority", sa.String(20), server_default="medium"),
        sa.Column("potential_savings", sa.Float, server_default="0"),
        sa.Column("is_applied", sa.Boolean, server_default="false"),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("sm_shrinkage_recommendations")
    op.drop_table("sm_shrinkage_alerts")
    op.drop_table("sm_shrinkage_records")
