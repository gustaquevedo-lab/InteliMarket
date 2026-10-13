"""add expense approval fields — aprobado_at, rechazado_por/at/motivo (Fase 2
del rediseño de Gastos/Caja Chica): aprobacion real con umbral de rol, en vez
del boton que no controlaba nada.

Revision ID: 20260810070000
Revises: 20260810060000
Create Date: 2026-08-10 07:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810070000"
down_revision: Union[str, None] = "20260810060000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("expenses", sa.Column("aprobado_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("expenses", sa.Column("rechazado_por", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("expenses", sa.Column("rechazado_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("expenses", sa.Column("rechazado_motivo", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("expenses", "rechazado_motivo")
    op.drop_column("expenses", "rechazado_at")
    op.drop_column("expenses", "rechazado_por")
    op.drop_column("expenses", "aprobado_at")
