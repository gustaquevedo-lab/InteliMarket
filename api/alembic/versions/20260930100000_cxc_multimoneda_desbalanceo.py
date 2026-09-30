"""cxc_multimoneda_desbalanceo

Revision ID: 20260930100000
Revises: 20260928170000
Create Date: 2026-09-30 10:00:00.000000

Agrega columnas multimoneda y tratamiento de desbalanceo (descuento vs gastos administrativos)
a receivable_payments para imputacion exacta en Tesoreria y Boveda.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20260930100000'
down_revision: Union[str, None] = '20260928170000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE receivable_payments
        ADD COLUMN IF NOT EXISTS monto_pyg NUMERIC(15, 0),
        ADD COLUMN IF NOT EXISTS monto_brl NUMERIC(12, 2),
        ADD COLUMN IF NOT EXISTS monto_usd NUMERIC(12, 2),
        ADD COLUMN IF NOT EXISTS tasa_brl NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS tasa_usd NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS monto_facturas_canceladas NUMERIC(15, 0),
        ADD COLUMN IF NOT EXISTS diferencia_monto NUMERIC(15, 0) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tipo_diferencia VARCHAR(30) DEFAULT 'exacto';
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE receivable_payments
        DROP COLUMN IF EXISTS monto_pyg,
        DROP COLUMN IF EXISTS monto_brl,
        DROP COLUMN IF EXISTS monto_usd,
        DROP COLUMN IF EXISTS tasa_brl,
        DROP COLUMN IF EXISTS tasa_usd,
        DROP COLUMN IF EXISTS monto_facturas_canceladas,
        DROP COLUMN IF EXISTS diferencia_monto,
        DROP COLUMN IF EXISTS tipo_diferencia;
    """)
