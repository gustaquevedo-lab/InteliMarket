"""add_pos_terminal_claims

Revision ID: 20260824130000
Revises: 20260824000000
Create Date: 2026-08-24 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '20260824130000'
down_revision: Union[str, None] = '20260824000000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pos_terminal_claims",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fin_operacao_pos_id", sa.String(30), nullable=False, unique=True),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True)),
        sa.Column("procesador", sa.String(20), nullable=False),
        sa.Column("monto", sa.Integer(), nullable=False),
        sa.Column("voucher", sa.String(60)),
        sa.Column("tarjeta_marca", sa.String(200)),
        sa.Column("claimed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("pos_terminal_claims")
