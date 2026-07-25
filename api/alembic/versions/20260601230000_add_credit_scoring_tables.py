"""Add Credit Scoring tables (credit scores, risk alerts, credit events)

Revision ID: 20260601230000
Revises: 20260601220000
Create Date: 2026-06-01 23:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601230000"
down_revision: Union[str, None] = "20260601220000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Credit Scores (per-customer scoring result)
    op.create_table(
        "sc_credit_scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, unique=True, index=True),
        sa.Column("score", sa.Integer(), nullable=False, server_default=sa.text("500")),
        sa.Column("risk_level", sa.String(20), nullable=False, server_default=sa.text("'medium'")),
        sa.Column("payment_history_score", sa.Integer(), server_default=sa.text("0")),
        sa.Column("antiquity_score", sa.Integer(), server_default=sa.text("0")),
        sa.Column("frequency_score", sa.Integer(), server_default=sa.text("0")),
        sa.Column("avg_amount_score", sa.Integer(), server_default=sa.text("0")),
        sa.Column("industry_score", sa.Integer(), server_default=sa.text("0")),
        sa.Column("credit_utilization_score", sa.Integer(), server_default=sa.text("0")),
        sa.Column("suggested_credit_limit", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("current_credit_limit", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("used_credit", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("available_credit", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("on_time_payment_rate", sa.Float(), server_default=sa.text("1.0")),
        sa.Column("average_payment_delay_days", sa.Float(), server_default=sa.text("0")),
        sa.Column("total_overdue_days", sa.Integer(), server_default=sa.text("0")),
        sa.Column("days_since_last_purchase", sa.Integer(), nullable=True),
        sa.Column("total_purchases", sa.Integer(), server_default=sa.text("0")),
        sa.Column("total_purchase_amount", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("months_as_customer", sa.Integer(), server_default=sa.text("0")),
        sa.Column("times_overdue", sa.Integer(), server_default=sa.text("0")),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'active'")),
        sa.Column("is_auto_blocked", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("block_reason", sa.Text(), nullable=True),
        sa.Column("last_evaluation_date", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("next_evaluation_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Risk Alerts
    op.create_table(
        "sc_risk_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("alert_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default=sa.text("'medium'")),
        sa.Column("previous_score", sa.Integer(), nullable=True),
        sa.Column("new_score", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Credit Events (audit log)
    op.create_table(
        "sc_credit_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("previous_limit", sa.Numeric(14, 0), nullable=True),
        sa.Column("new_limit", sa.Numeric(14, 0), nullable=True),
        sa.Column("previous_score", sa.Integer(), nullable=True),
        sa.Column("new_score", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("performed_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("sc_credit_events")
    op.drop_table("sc_risk_alerts")
    op.drop_table("sc_credit_scores")
