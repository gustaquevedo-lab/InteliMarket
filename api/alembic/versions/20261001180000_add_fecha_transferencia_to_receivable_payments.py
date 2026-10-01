"""add_fecha_transferencia_to_receivable_payments

Revision ID: 20261001180000
Revises: 20260930100000
Create Date: 2026-10-01 18:00:00.000000

Agrega columnas de fecha_transferencia, monto_transferencia, monto_cheque y referencia_transferencia
a receivable_payments para permitir conciliación bancaria exacta con fecha de operación real.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261001180000'
down_revision: Union[str, None] = '20260930100000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE receivable_payments
        ADD COLUMN IF NOT EXISTS fecha_transferencia DATE,
        ADD COLUMN IF NOT EXISTS monto_transferencia NUMERIC(15, 0),
        ADD COLUMN IF NOT EXISTS monto_cheque NUMERIC(15, 0),
        ADD COLUMN IF NOT EXISTS referencia_transferencia VARCHAR(150)
    """)

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN
                ALTER TABLE sandbox.receivable_payments
                ADD COLUMN IF NOT EXISTS fecha_transferencia DATE,
                ADD COLUMN IF NOT EXISTS monto_transferencia NUMERIC(15, 0),
                ADD COLUMN IF NOT EXISTS monto_cheque NUMERIC(15, 0),
                ADD COLUMN IF NOT EXISTS referencia_transferencia VARCHAR(150);
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE receivable_payments
        DROP COLUMN IF EXISTS fecha_transferencia,
        DROP COLUMN IF EXISTS monto_transferencia,
        DROP COLUMN IF EXISTS monto_cheque,
        DROP COLUMN IF EXISTS referencia_transferencia
    """)

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN
                ALTER TABLE sandbox.receivable_payments
                DROP COLUMN IF EXISTS fecha_transferencia,
                DROP COLUMN IF EXISTS monto_transferencia,
                DROP COLUMN IF EXISTS monto_cheque,
                DROP COLUMN IF EXISTS referencia_transferencia;
            END IF;
        END $$
    """)
