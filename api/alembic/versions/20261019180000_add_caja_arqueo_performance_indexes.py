"""add caja arqueo and session performance indexes

Revision ID: 20261019180000
Revises: 20261019171500
Create Date: 2026-10-19 18:00:00.000000

Indices criticos para acelerar el modulo de caja, arqueo de sesiones,
punteo de comprobantes, busqueda de ventas y transacciones POS/PlugPay.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261019180000'
down_revision: Union[str, None] = '20261019171500'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Sesiones, entregas y retiros de caja
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_cash_drop_requests_session_id
        ON cash_drop_requests (session_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_cash_handoffs_session_id
        ON cash_handoffs (session_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_cash_registers_company_id
        ON cash_registers (company_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_vault_entries_handoff_id
        ON vault_entries (handoff_id)
        WHERE handoff_id IS NOT NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_cash_counts_session_created
        ON cash_counts (session_id, created_at DESC);
    """)

    # 2. Transacciones electronicas vinculadas a ventas y conciliacion
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_plugpay_transactions_created_at
        ON plugpay_transactions (created_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_plugpay_transactions_sale_exitosa
        ON plugpay_transactions (sale_id, exitosa)
        WHERE sale_id IS NOT NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_pos_terminal_transactions_sale_exitosa
        ON pos_terminal_transactions (sale_id, exitosa)
        WHERE sale_id IS NOT NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_pos_terminal_transactions_created_at
        ON pos_terminal_transactions (created_at DESC);
    """)

    # 3. Ventas y pagos de caja (tablas pesadas: ~150k filas)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_sales_session_estado
        ON sales (session_id, estado);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_sale_payments_sale_forma_pago
        ON sale_payments (sale_id, forma_pago);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_cash_drop_requests_session_id;")
    op.execute("DROP INDEX IF EXISTS ix_cash_handoffs_session_id;")
    op.execute("DROP INDEX IF EXISTS ix_cash_registers_company_id;")
    op.execute("DROP INDEX IF EXISTS ix_vault_entries_handoff_id;")
    op.execute("DROP INDEX IF EXISTS ix_cash_counts_session_created;")
    op.execute("DROP INDEX IF EXISTS ix_plugpay_transactions_created_at;")
    op.execute("DROP INDEX IF EXISTS ix_plugpay_transactions_sale_exitosa;")
    op.execute("DROP INDEX IF EXISTS ix_pos_terminal_transactions_sale_exitosa;")
    op.execute("DROP INDEX IF EXISTS ix_pos_terminal_transactions_created_at;")
    op.execute("DROP INDEX IF EXISTS ix_sales_session_estado;")
    op.execute("DROP INDEX IF EXISTS ix_sale_payments_sale_forma_pago;")
