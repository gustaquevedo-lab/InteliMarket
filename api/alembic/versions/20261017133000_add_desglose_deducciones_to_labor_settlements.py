"""add_desglose_deducciones_to_labor_settlements

Revision ID: 20261017133000
Revises: 20261015070000
Create Date: 2026-10-17 13:30:00.000000

Agrega columnas para individualizar las deducciones de finiquitos:
- descuento_extra_club: compras a credito y vales en supermercado (extingue Cuentas por Cobrar via ReceivablePayment).
- descuento_anticipos: anticipos de sueldo previos retirados en efectivo / caja chica.
- receivable_payment_id: vinculacion directa al Recibo Oficial de Cobranza emitido.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '20261017133000'
down_revision: Union[str, None] = '20261015070000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Esquema public
    op.execute("""
        ALTER TABLE labor_settlements
        ADD COLUMN IF NOT EXISTS descuento_extra_club NUMERIC(15, 0) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS descuento_anticipos NUMERIC(15, 0) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS receivable_payment_id UUID REFERENCES receivable_payments(id) ON DELETE SET NULL
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_settlements_rec_payment ON labor_settlements(receivable_payment_id)
    """)

    # 2. Esquema sandbox si existe
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sandbox' AND table_name = 'labor_settlements') THEN
                    ALTER TABLE sandbox.labor_settlements
                    ADD COLUMN IF NOT EXISTS descuento_extra_club NUMERIC(15, 0) DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS descuento_anticipos NUMERIC(15, 0) DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS receivable_payment_id UUID;
                END IF;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE labor_settlements
        DROP COLUMN IF EXISTS descuento_extra_club,
        DROP COLUMN IF EXISTS descuento_anticipos,
        DROP COLUMN IF EXISTS receivable_payment_id
    """)
