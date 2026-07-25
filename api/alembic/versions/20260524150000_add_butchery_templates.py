"""add butchery/desposte tables (multi-output + costeo ponderado)

Revision ID: 20260524150000
Revises: 20260524100000
Create Date: 2026-05-24 15:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260524150000"
down_revision: Union[str, None] = "20260524100000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supermer_butchery_templates",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("especie", sa.String(50), nullable=False, server_default="bovino"),
        sa.Column("peso_promedio_kg", sa.Numeric(8, 2), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("activa", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_supermer_butchery_templates_company", "company_id"),
    )

    op.create_table(
        "supermer_butchery_template_cuts",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("template_id", sa.UUID(), sa.ForeignKey("supermer_butchery_templates.id"), nullable=False),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("rendimiento_porcentual", sa.Numeric(5, 2), nullable=False),
        sa.Column("precio_ponderado", sa.Numeric(5, 2), server_default="50"),
        sa.Column("orden", sa.Integer(), server_default="0"),
        sa.Column("es_subproducto", sa.Boolean(), server_default=sa.text("false")),
        sa.Index("ix_supermer_butchery_cuts_template", "template_id"),
    )


def downgrade() -> None:
    op.drop_table("supermer_butchery_template_cuts")
    op.drop_table("supermer_butchery_templates")
