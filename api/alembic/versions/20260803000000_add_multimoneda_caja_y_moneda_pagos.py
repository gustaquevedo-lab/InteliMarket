"""sale_payments.moneda (fix: montos en USD/BRL se guardaban como si fueran PYG),
cash_counts multi-moneda (usd/brl), cash_registers.diferencia_maxima_tolerada

Revision ID: 20260803000000
Revises: 20260802000000
Create Date: 2026-08-03 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260803000000"
down_revision: Union[str, None] = "20260802000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("sale_payments", "monto", type_=sa.Numeric(15, 2))
    op.add_column("sale_payments", sa.Column("moneda", sa.String(3), nullable=False, server_default="PYG"))

    op.add_column("cash_registers", sa.Column("diferencia_maxima_tolerada", sa.Numeric(15, 0)))

    op.add_column("cash_counts", sa.Column("monto_efectivo_usd", sa.Numeric(12, 2), server_default="0"))
    op.add_column("cash_counts", sa.Column("monto_efectivo_brl", sa.Numeric(12, 2), server_default="0"))
    op.add_column("cash_counts", sa.Column("diferencia_usd", sa.Numeric(12, 2), server_default="0"))
    op.add_column("cash_counts", sa.Column("diferencia_brl", sa.Numeric(12, 2), server_default="0"))


def downgrade() -> None:
    op.drop_column("cash_counts", "diferencia_brl")
    op.drop_column("cash_counts", "diferencia_usd")
    op.drop_column("cash_counts", "monto_efectivo_brl")
    op.drop_column("cash_counts", "monto_efectivo_usd")
    op.drop_column("cash_registers", "diferencia_maxima_tolerada")
    op.drop_column("sale_payments", "moneda")
    op.alter_column("sale_payments", "monto", type_=sa.Numeric(15, 0))
