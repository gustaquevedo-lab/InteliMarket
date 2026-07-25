"""Add Clientes — Fidelización & Segmentación tables (RFM, segments, loyalty, offers, coupons)

Revision ID: 20260601300000
Revises: 20260601290000
Create Date: 2026-06-02 06:20:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601300000"
down_revision: Union[str, None] = "20260601290000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # RFM Scores
    op.create_table(
        "cli_rfm_scores",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, unique=True, index=True),
        sa.Column("recency_days", sa.Integer(), nullable=True),
        sa.Column("recency_score", sa.Integer(), server_default=sa.text("3")),
        sa.Column("frequency_count", sa.Integer(), server_default=sa.text("0")),
        sa.Column("frequency_score", sa.Integer(), server_default=sa.text("3")),
        sa.Column("monetary_total", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("monetary_score", sa.Integer(), server_default=sa.text("3")),
        sa.Column("rfm_total", sa.Integer(), server_default=sa.text("9")),
        sa.Column("rfm_segment", sa.String(30), nullable=True),
        sa.Column("last_evaluation_date", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Behavioral Segments
    op.create_table(
        "cli_behavioral_segments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("slug", sa.String(40), nullable=False, unique=True),
        sa.Column("color", sa.String(20), server_default=sa.text("'#6366f1'")),
        sa.Column("rfm_min", sa.Integer(), nullable=True),
        sa.Column("rfm_max", sa.Integer(), nullable=True),
        sa.Column("rules", sa.JSON(), nullable=True),
        sa.Column("customer_count", sa.Integer(), server_default=sa.text("0")),
        sa.Column("is_system", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Customer Segment Assignments
    op.create_table(
        "cli_segment_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("segment_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("assigned_by", sa.String(40), server_default=sa.text("'auto'")),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Loyalty Programs
    op.create_table(
        "cli_loyalty_programs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, unique=True, index=True),
        sa.Column("nombre", sa.String(80), server_default=sa.text("'Programa de Lealtad'")),
        sa.Column("points_per_currency", sa.Integer(), server_default=sa.text("1")),
        sa.Column("signup_bonus", sa.Integer(), server_default=sa.text("100")),
        sa.Column("referral_bonus", sa.Integer(), server_default=sa.text("50")),
        sa.Column("min_redeem_points", sa.Integer(), server_default=sa.text("500")),
        sa.Column("currency_name", sa.String(30), server_default=sa.text("'Puntos'")),
        sa.Column("tier_enabled", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("tier_bronze_min", sa.Integer(), server_default=sa.text("0")),
        sa.Column("tier_silver_min", sa.Integer(), server_default=sa.text("500")),
        sa.Column("tier_gold_min", sa.Integer(), server_default=sa.text("1500")),
        sa.Column("tier_platinum_min", sa.Integer(), server_default=sa.text("3000")),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Loyalty Transactions
    op.create_table(
        "cli_loyalty_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("puntos", sa.Integer(), nullable=False),
        sa.Column("concepto", sa.String(200), nullable=True),
        sa.Column("order_id", UUID(as_uuid=True), nullable=True),
        sa.Column("reference_type", sa.String(30), nullable=True),
        sa.Column("reference_id", sa.String(80), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Personalized Offers
    op.create_table(
        "cli_personalized_offers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("offer_type", sa.String(30), nullable=False),
        sa.Column("discount_type", sa.String(20), nullable=False),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("min_purchase", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("target_type", sa.String(30), nullable=False),
        sa.Column("target_segment_id", UUID(as_uuid=True), nullable=True),
        sa.Column("target_customer_id", UUID(as_uuid=True), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("max_redemptions", sa.Integer(), server_default=sa.text("0")),
        sa.Column("current_redemptions", sa.Integer(), server_default=sa.text("0")),
            sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Coupon Codes
    op.create_table(
        "cli_coupon_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("offer_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("code", sa.String(40), nullable=False, unique=True, index=True),
        sa.Column("discount_type", sa.String(20), nullable=False),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("min_purchase", sa.Numeric(14, 0), server_default=sa.text("0")),
        sa.Column("is_percentage", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("max_uses", sa.Integer(), server_default=sa.text("1")),
        sa.Column("current_uses", sa.Integer(), server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("cli_coupon_codes")
    op.drop_table("cli_personalized_offers")
    op.drop_table("cli_loyalty_transactions")
    op.drop_table("cli_loyalty_programs")
    op.drop_table("cli_segment_assignments")
    op.drop_table("cli_behavioral_segments")
    op.drop_table("cli_rfm_scores")
