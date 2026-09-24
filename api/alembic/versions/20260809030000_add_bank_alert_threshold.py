"""add saldo_minimo_alerta a bank_accounts — umbral configurable por cuenta
para la alerta de saldo bajo (Bancos Fase 3). NULL = alerta desactivada.

Revision ID: 20260809030000
Revises: 20260809020000
Create Date: 2026-08-09 03:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260809030000"
down_revision: Union[str, None] = "20260809020000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bank_accounts", sa.Column("saldo_minimo_alerta", sa.Numeric(15, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("bank_accounts", "saldo_minimo_alerta")
