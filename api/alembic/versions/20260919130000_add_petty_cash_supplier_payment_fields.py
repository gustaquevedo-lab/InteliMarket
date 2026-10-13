"""add_petty_cash_supplier_payment_fields

Revision ID: 20260919130000
Revises: 20260917000000
Create Date: 2026-09-19 13:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20260919130000'
down_revision: Union[str, None] = '20260917000000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Vincular pagos de facturas a fondos fijos / caja chica
    op.execute("""
        ALTER TABLE supplier_invoice_payments
        ADD COLUMN IF NOT EXISTS petty_cash_fund_id UUID REFERENCES petty_cash_funds(id) ON DELETE SET NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_supplier_invoice_payments_fund
        ON supplier_invoice_payments (petty_cash_fund_id);
    """)

    # 2. Agregar campos en gastos para identificar y vincular pagos a proveedores de mercaderías
    op.execute("""
        ALTER TABLE expenses
        ADD COLUMN IF NOT EXISTS es_pago_proveedor BOOLEAN DEFAULT FALSE NOT NULL,
        ADD COLUMN IF NOT EXISTS supplier_id UUID NULL,
        ADD COLUMN IF NOT EXISTS supplier_invoice_id UUID REFERENCES supplier_invoices(id) ON DELETE SET NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_expenses_supplier_id
        ON expenses (supplier_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_expenses_supplier_invoice_id
        ON expenses (supplier_invoice_id);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_expenses_supplier_invoice_id;")
    op.execute("DROP INDEX IF EXISTS ix_expenses_supplier_id;")
    op.execute("""
        ALTER TABLE expenses
        DROP COLUMN IF EXISTS supplier_invoice_id,
        DROP COLUMN IF EXISTS supplier_id,
        DROP COLUMN IF EXISTS es_pago_proveedor;
    """)
    op.execute("DROP INDEX IF EXISTS ix_supplier_invoice_payments_fund;")
    op.execute("""
        ALTER TABLE supplier_invoice_payments
        DROP COLUMN IF EXISTS petty_cash_fund_id;
    """)
