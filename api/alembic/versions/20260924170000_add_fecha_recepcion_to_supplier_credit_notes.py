"""add_fecha_recepcion_to_supplier_credit_notes

Revision ID: 20260924170000
Revises: 20260924113000
Create Date: 2026-09-24 17:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20260924170000'
down_revision: Union[str, None] = '20260924113000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE supplier_credit_notes
        ADD COLUMN IF NOT EXISTS fecha_recepcion DATE;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE supplier_credit_notes
        DROP COLUMN IF EXISTS fecha_recepcion;
    """)
