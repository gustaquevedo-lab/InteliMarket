"""add unique index to supplier_invoices to permanently prevent duplicates

Revision ID: 20261023120000
Revises: 20261021160000
Create Date: 2026-10-23 12:00:00.000000

- Partial unique index on supplier_invoices (company_id, supplier_id, trim(numero_factura))
  WHERE estado NOT IN ('cancelada', 'cancelado', 'anulada')
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261023120000'
down_revision: Union[str, None] = '20261021160000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_invoices_company_supplier_numero
        ON supplier_invoices (company_id, supplier_id, trim(numero_factura))
        WHERE estado NOT IN ('cancelada', 'cancelado', 'anulada');
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS uq_supplier_invoices_company_supplier_numero;
    """)
