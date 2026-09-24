"""add expense void (anulacion) fields — Fase 4 del rediseño de Gastos/Caja
Chica: reemplaza el borrado fisico por anulacion con motivo, mismo patron
que "Anular Recepcion" en Compras. anulado es independiente de estado
(aprobado/rechazado) porque se puede anular un gasto ya aprobado si se
descubre un error despues.

Revision ID: 20260810080000
Revises: 20260810070000
Create Date: 2026-08-10 08:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810080000"
down_revision: Union[str, None] = "20260810070000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("expenses", sa.Column("anulado", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("expenses", sa.Column("anulado_por", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("expenses", sa.Column("anulado_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("expenses", sa.Column("anulado_motivo", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("expenses", "anulado_motivo")
    op.drop_column("expenses", "anulado_at")
    op.drop_column("expenses", "anulado_por")
    op.drop_column("expenses", "anulado")
