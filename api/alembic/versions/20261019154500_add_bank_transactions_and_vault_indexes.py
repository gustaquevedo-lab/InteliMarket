"""add bank transactions and vault indexes for fast queries

Revision ID: 20261019154500
Revises: 20261019140000
Create Date: 2026-10-19 15:45:00.000000

Indices compuestos especializados para acelerar listados de extractos,
metricas del dashboard bancario y busquedas del asistente de conciliacion.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261019154500'
down_revision: Union[str, None] = '20261019140000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_bank_transactions_acct_fecha 
        ON bank_transactions (bank_account_id, fecha DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_bank_transactions_company_conciliado 
        ON bank_transactions (company_id, conciliado);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_bank_transactions_cheque_id 
        ON bank_transactions (cheque_id) WHERE cheque_id IS NOT NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_bank_transactions_invoice_id 
        ON bank_transactions (invoice_id) WHERE invoice_id IS NOT NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_vault_entries_company_estado_monto 
        ON vault_entries (company_id, estado, monto_pyg);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_bank_transactions_acct_fecha;")
    op.execute("DROP INDEX IF EXISTS ix_bank_transactions_company_conciliado;")
    op.execute("DROP INDEX IF EXISTS ix_bank_transactions_cheque_id;")
    op.execute("DROP INDEX IF EXISTS ix_bank_transactions_invoice_id;")
    op.execute("DROP INDEX IF EXISTS ix_vault_entries_company_estado_monto;")
