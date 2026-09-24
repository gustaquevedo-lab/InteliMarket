"""add accounting_entries.reversa_de_asiento — Fase 3 del rediseño de
Contabilidad Integrada: los asientos no se editan ni se borran (correcto),
pero hasta ahora no existia ningun mecanismo para corregir uno posteado por
error salvo cargarlo mal para siempre. Esto agrega un reverso real: crea un
asiento nuevo con las lineas invertidas, enlazado al original via este
campo, sin tocar ni un byte del asiento original.

Revision ID: 20260810110000
Revises: 20260810100000
Create Date: 2026-08-10 11:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260810110000"
down_revision: Union[str, None] = "20260810100000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("accounting_entries", sa.Column("reversa_de_asiento", sa.String(20), nullable=True))
    op.create_index("ix_accounting_entries_reversa_de_asiento", "accounting_entries", ["reversa_de_asiento"])


def downgrade() -> None:
    op.drop_index("ix_accounting_entries_reversa_de_asiento", table_name="accounting_entries")
    op.drop_column("accounting_entries", "reversa_de_asiento")
