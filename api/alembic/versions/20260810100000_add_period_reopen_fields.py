"""add accounting_periods reapertura fields — Fase 2 del rediseño de
Contabilidad Integrada: cerrar un período ahora bloquea de verdad los
asientos (manuales y automáticos), así que hace falta una vía explícita y
auditada para reabrirlo si hace falta corregir algo.

Revision ID: 20260810100000
Revises: 20260810090000
Create Date: 2026-08-10 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810100000"
down_revision: Union[str, None] = "20260810090000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("accounting_periods", sa.Column("reabierto_por", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("accounting_periods", sa.Column("fecha_reapertura", sa.DateTime(timezone=True), nullable=True))
    op.add_column("accounting_periods", sa.Column("motivo_reapertura", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("accounting_periods", "motivo_reapertura")
    op.drop_column("accounting_periods", "fecha_reapertura")
    op.drop_column("accounting_periods", "reabierto_por")
