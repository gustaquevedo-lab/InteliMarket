"""add brl fields to supplier_invoices and expenses, widen cash_register_movements.monto

Revision ID: 20260922130000
Revises: 20260922120000
Create Date: 2026-09-22 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260922130000"
down_revision: Union[str, None] = "20260922120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. supplier_invoices: soporte para monto en Reales (R$)
    op.add_column("supplier_invoices", sa.Column("total_brl", sa.Numeric(12, 2), nullable=True))
    op.add_column("supplier_invoices", sa.Column("saldo_pendiente_brl", sa.Numeric(12, 2), nullable=True))

    # 2. expenses: soporte para insumos/gastos en Reales (R$)
    op.add_column("expenses", sa.Column("monto_brl", sa.Numeric(12, 2), nullable=True))

    # 3. cash_register_movements: ampliar monto a Numeric(15, 2) para soportar centavos en R$ o USD
    op.alter_column(
        "cash_register_movements",
        "monto",
        type_=sa.Numeric(15, 2),
        existing_type=sa.Numeric(15, 0),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "cash_register_movements",
        "monto",
        type_=sa.Numeric(15, 0),
        existing_type=sa.Numeric(15, 2),
        existing_nullable=False,
    )
    op.drop_column("expenses", "monto_brl")
    op.drop_column("supplier_invoices", "saldo_pendiente_brl")
    op.drop_column("supplier_invoices", "total_brl")
