"""Add Smart Pricing tables (assignments, tiered prices, promotions, suggestions, approval workflow, history)

Revision ID: 20260601200000
Revises: 20260601100000
Create Date: 2026-06-01 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601200000"
down_revision: Union[str, None] = "20260601100000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Price List Assignments
    op.create_table(
        "sp_price_list_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("price_list_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("ref_id", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Tiered Prices
    op.create_table(
        "sp_tiered_prices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("price_list_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("min_qty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("max_qty", sa.Integer(), nullable=True),
        sa.Column("precio_unitario", sa.Numeric(15, 2), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Promotions
    op.create_table(
        "sp_promotions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("fecha_inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fecha_fin", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("condiciones", sa.JSON(), nullable=True),
        sa.Column("prioridad", sa.Integer(), server_default="0"),
        sa.Column("max_usos", sa.Integer(), nullable=True),
        sa.Column("usos_actuales", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Promotion Rewards
    op.create_table(
        "sp_promotion_rewards",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("promotion_id", UUID(as_uuid=True), sa.ForeignKey("sp_promotions.id"), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("qty_required", sa.Integer(), server_default="1"),
        sa.Column("qty_free", sa.Integer(), server_default="0"),
        sa.Column("discount_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("precio_fijo", sa.Numeric(15, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Promotion Assignments
    op.create_table(
        "sp_promotion_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("promotion_id", UUID(as_uuid=True), sa.ForeignKey("sp_promotions.id"), nullable=False, index=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("ref_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Price Suggestions (IA)
    op.create_table(
        "sp_price_suggestions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("current_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("suggested_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 2), nullable=True),
        sa.Column("factors", sa.JSON(), nullable=True),
        sa.Column("source", sa.String(30), nullable=False),
        sa.Column("estado", sa.String(20), server_default="pending"),
        sa.Column("reviewed_by", UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Price Change Requests (Approval Workflow)
    op.create_table(
        "sp_price_change_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("price_list_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("old_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("new_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("requested_by", UUID(as_uuid=True), nullable=False),
        sa.Column("approved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("approval_level", sa.Integer(), server_default="1"),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Price Change History
    op.create_table(
        "sp_price_change_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("price_list_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("old_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("new_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("changed_by", UUID(as_uuid=True), nullable=False),
        sa.Column("change_type", sa.String(20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("sp_price_change_history")
    op.drop_table("sp_price_change_requests")
    op.drop_table("sp_price_suggestions")
    op.drop_table("sp_promotion_assignments")
    op.drop_table("sp_promotion_rewards")
    op.drop_table("sp_promotions")
    op.drop_table("sp_tiered_prices")
    op.drop_table("sp_price_list_assignments")
