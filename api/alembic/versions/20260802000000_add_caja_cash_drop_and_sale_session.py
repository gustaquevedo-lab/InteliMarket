"""add sales.session_id, cash_sessions.cajero_nombre/ultimo_cash_drop_at, cash_registers.cash_drop_threshold

Revision ID: 20260802000000
Revises: 20260801000000
Create Date: 2026-08-02 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260802000000"
down_revision: Union[str, None] = "20260801000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sales", sa.Column("session_id", sa.dialects.postgresql.UUID(as_uuid=True)))
    op.create_index("ix_sales_session_id", "sales", ["session_id"])

    op.add_column("cash_sessions", sa.Column("cajero_nombre", sa.String(100)))
    op.add_column("cash_sessions", sa.Column("ultimo_cash_drop_at", sa.DateTime(timezone=True)))

    op.add_column("cash_registers", sa.Column("cash_drop_threshold", sa.Numeric(15, 0)))


def downgrade() -> None:
    op.drop_column("cash_registers", "cash_drop_threshold")
    op.drop_column("cash_sessions", "ultimo_cash_drop_at")
    op.drop_column("cash_sessions", "cajero_nombre")
    op.drop_index("ix_sales_session_id", table_name="sales")
    op.drop_column("sales", "session_id")
