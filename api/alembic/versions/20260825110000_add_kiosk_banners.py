"""add_kiosk_banners

Revision ID: 20260825110000
Revises: 20260824140000
Create Date: 2026-08-25 11:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '20260825110000'
down_revision: Union[str, None] = '20260824140000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "kiosk_banners",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("titulo", sa.String(200), nullable=False),
        sa.Column("subtitulo", sa.Text()),
        sa.Column("etiqueta", sa.String(60)),
        sa.Column("descuento_texto", sa.String(40)),
        sa.Column("color", sa.String(20), server_default="orange"),
        sa.Column("imagen_url", sa.String(500)),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("fecha_inicio", sa.DateTime(timezone=True)),
        sa.Column("fecha_fin", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("kiosk_banners_company_id_idx", "kiosk_banners", ["company_id"])


def downgrade() -> None:
    op.drop_index("kiosk_banners_company_id_idx", table_name="kiosk_banners")
    op.drop_table("kiosk_banners")
