"""add bakery daily plans (production planning & scaling)

Revision ID: 20260524200000
Revises: 20260524150000
Create Date: 2026-05-24 20:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260524200000"
down_revision: Union[str, None] = "20260524150000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supermer_bakery_plans",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("dia_semana", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_supermer_bakery_plans_company_dia", "company_id", "dia_semana"),
    )

    op.create_table(
        "supermer_bakery_plan_items",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("plan_id", sa.UUID(), sa.ForeignKey("supermer_bakery_plans.id"), nullable=False),
        sa.Column("receta_id", sa.UUID(), sa.ForeignKey("supermer_recipes.id"), nullable=False),
        sa.Column("cantidad_objetivo", sa.Numeric(12, 3), nullable=False),
        sa.Column("prioridad", sa.Integer(), server_default="0"),
        sa.Index("ix_supermer_bakery_plan_items_plan", "plan_id"),
    )


def downgrade() -> None:
    op.drop_table("supermer_bakery_plan_items")
    op.drop_table("supermer_bakery_plans")
