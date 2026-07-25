"""Add Comerciales (Opportunity Detection) tables

Revision ID: 20260601240000
Revises: 20260601230000
Create Date: 2026-06-01 23:50:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601240000"
down_revision: Union[str, None] = "20260601230000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Opportunities (all 5 types in one table)
    op.create_table(
        "co_opportunities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=True),
        sa.Column("suggested_product_id", UUID(as_uuid=True), nullable=True),
        sa.Column("opportunity_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(10), server_default=sa.text("'medium'")),
        sa.Column("score", sa.Integer(), server_default=sa.text("0")),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'")),
        sa.Column("suggested_discount_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("suggested_action", sa.String(100), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("assigned_to", UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Product Affinity (market basket analysis)
    op.create_table(
        "co_product_affinity",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_a_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_b_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("support", sa.Float(), server_default=sa.text("0")),
        sa.Column("confidence", sa.Float(), server_default=sa.text("0")),
        sa.Column("lift", sa.Float(), server_default=sa.text("0")),
        sa.Column("times_bought_together", sa.Integer(), server_default=sa.text("0")),
        sa.Column("last_computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Recommendations per customer
    op.create_table(
        "co_recommendations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("recommendation_type", sa.String(30), nullable=False),
        sa.Column("score", sa.Integer(), server_default=sa.text("0")),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("is_applied", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Churn Analysis snapshots
    op.create_table(
        "co_churn_analysis",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("churn_score", sa.Integer(), server_default=sa.text("0")),
        sa.Column("churn_risk", sa.String(10), server_default=sa.text("'low'")),
        sa.Column("days_since_last_purchase", sa.Integer(), nullable=True),
        sa.Column("previous_frequency_days", sa.Float(), nullable=True),
        sa.Column("current_frequency_days", sa.Float(), nullable=True),
        sa.Column("frequency_drop_pct", sa.Float(), nullable=True),
        sa.Column("average_purchase_amount", sa.Numeric(14, 0), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("co_churn_analysis")
    op.drop_table("co_recommendations")
    op.drop_table("co_product_affinity")
    op.drop_table("co_opportunities")
