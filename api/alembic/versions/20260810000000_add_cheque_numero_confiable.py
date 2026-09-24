"""add numero_confiable a cheques -- distingue cheques con numero real
(cargados a mano o por el sync a futuro) de los migrados por backfill
historico con numero sintetico (Bancos Fase 4).

Revision ID: 20260810000000
Revises: 20260809030000
Create Date: 2026-08-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260810000000"
down_revision: Union[str, None] = "20260809030000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cheques", sa.Column("numero_confiable", sa.Boolean(), nullable=False, server_default="true"))


def downgrade() -> None:
    op.drop_column("cheques", "numero_confiable")
