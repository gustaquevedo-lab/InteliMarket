"""Add Scan&Go — Autopago con el Celular tables

Revision ID: 20260601310000
Revises: 20260601300000
Create Date: 2026-06-02 13:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601310000"
down_revision: Union[str, None] = "20260601300000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Scan Sessions
    op.create_table(
        "sg_scan_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'active'")),
        sa.Column("total_items", sa.Integer(), server_default=sa.text("0")),
        sa.Column("total_amount", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("discount_amount", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("final_amount", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("currency", sa.String(10), server_default=sa.text("'Gs'")),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Scan Items
    op.create_table(
        "sg_scan_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("barcode", sa.String(80), nullable=True),
        sa.Column("product_name", sa.String(200), nullable=True),
        sa.Column("quantity", sa.Numeric(10, 3), nullable=False, server_default=sa.text("1")),
        sa.Column("unit_price", sa.Numeric(14, 0), nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 0), nullable=False),
        sa.Column("is_weight", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("weight_kg", sa.Numeric(10, 3), nullable=True),
        sa.Column("scanned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Scan Payments
    op.create_table(
        "sg_scan_payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("method", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(14, 0), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("gateway", sa.String(30), nullable=True),
        sa.Column("gateway_transaction_id", sa.String(120), nullable=True),
        sa.Column("gateway_response", sa.JSON(), nullable=True),
        sa.Column("loyalty_points_used", sa.Integer(), server_default=sa.text("0")),
        sa.Column("loyalty_discount", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Scan Audits
    op.create_table(
        "sg_scan_audits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("is_random_audit", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("items_to_check", sa.JSON(), nullable=True),
        sa.Column("items_checked", sa.JSON(), nullable=True),
        sa.Column("discrepancies", sa.JSON(), nullable=True),
        sa.Column("has_discrepancy", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'")),
        sa.Column("checked_by", UUID(as_uuid=True), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution", sa.String(30), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Scan Daily Stats
    op.create_table(
        "sg_scan_daily_stats",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_sessions", sa.Integer(), server_default=sa.text("0")),
        sa.Column("completed_sessions", sa.Integer(), server_default=sa.text("0")),
        sa.Column("abandoned_sessions", sa.Integer(), server_default=sa.text("0")),
        sa.Column("total_amount", sa.Numeric(16, 0), server_default=sa.text("0")),
        sa.Column("total_items", sa.Integer(), server_default=sa.text("0")),
        sa.Column("audits_conducted", sa.Integer(), server_default=sa.text("0")),
        sa.Column("audits_with_discrepancy", sa.Integer(), server_default=sa.text("0")),
        sa.Column("avg_session_value", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("avg_items_per_session", sa.Float(), server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("sg_scan_daily_stats")
    op.drop_table("sg_scan_audits")
    op.drop_table("sg_scan_payments")
    op.drop_table("sg_scan_items")
    op.drop_table("sg_scan_sessions")
