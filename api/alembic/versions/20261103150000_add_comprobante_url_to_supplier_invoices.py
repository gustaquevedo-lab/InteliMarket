"""add comprobante_url to supplier_invoices

Revision ID: 20261103150000
Revises: 20261102170000
Create Date: 2026-11-03 15:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261103150000'
down_revision: Union[str, None] = '20261102170000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS comprobante_url TEXT;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE supplier_invoices DROP COLUMN IF EXISTS comprobante_url;
    """)
