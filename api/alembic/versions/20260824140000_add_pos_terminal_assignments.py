"""add_pos_terminal_assignments

Revision ID: 20260824140000
Revises: 20260824130000
Create Date: 2026-08-24 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '20260824140000'
down_revision: Union[str, None] = '20260824130000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pos_terminal_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hostname", sa.String(120), nullable=False, unique=True),
        sa.Column("punto_emision", sa.String(10), nullable=False),
        sa.Column("caja_nombre", sa.String(60), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("pos_terminal_assignments")
