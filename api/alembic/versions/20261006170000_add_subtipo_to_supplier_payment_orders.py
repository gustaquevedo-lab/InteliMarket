"""add_subtipo_to_supplier_payment_orders

Revision ID: 20261006170000
Revises: 20261006093000
Create Date: 2026-10-06 17:00:00.000000

Agrega soporte para subtipos en órdenes de pago (proveedor, nomina_salarios, finiquito,
anticipo_sueldo, otro) y hace supplier_id nullable para permitir erogaciones de RRHH / SueldOK.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261006170000'
down_revision: Union[str, None] = '20261006093000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Esquema public
    op.execute("ALTER TABLE supplier_payment_orders ALTER COLUMN supplier_id DROP NOT NULL")
    op.execute("ALTER TABLE supplier_payment_orders ADD COLUMN IF NOT EXISTS subtipo VARCHAR(50) NOT NULL DEFAULT 'proveedor'")
    op.execute("ALTER TABLE supplier_payment_orders ADD COLUMN IF NOT EXISTS beneficiario_nombre VARCHAR(200)")
    op.execute("ALTER TABLE supplier_payment_orders ADD COLUMN IF NOT EXISTS beneficiario_documento VARCHAR(50)")
    op.execute("ALTER TABLE supplier_payment_orders ADD COLUMN IF NOT EXISTS periodo_nomina VARCHAR(20)")
    op.execute("ALTER TABLE supplier_payment_orders ADD COLUMN IF NOT EXISTS sueldok_sync_id VARCHAR(100)")

    op.execute("CREATE INDEX IF NOT EXISTS idx_spo_subtipo ON supplier_payment_orders(subtipo)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_spo_periodo ON supplier_payment_orders(periodo_nomina)")

    # 2. Esquema sandbox si existe
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'sandbox' AND table_name = 'supplier_payment_orders'
            ) THEN
                EXECUTE 'ALTER TABLE sandbox.supplier_payment_orders ALTER COLUMN supplier_id DROP NOT NULL';
                EXECUTE 'ALTER TABLE sandbox.supplier_payment_orders ADD COLUMN IF NOT EXISTS subtipo VARCHAR(50) NOT NULL DEFAULT ''proveedor''';
                EXECUTE 'ALTER TABLE sandbox.supplier_payment_orders ADD COLUMN IF NOT EXISTS beneficiario_nombre VARCHAR(200)';
                EXECUTE 'ALTER TABLE sandbox.supplier_payment_orders ADD COLUMN IF NOT EXISTS beneficiario_documento VARCHAR(50)';
                EXECUTE 'ALTER TABLE sandbox.supplier_payment_orders ADD COLUMN IF NOT EXISTS periodo_nomina VARCHAR(20)';
                EXECUTE 'ALTER TABLE sandbox.supplier_payment_orders ADD COLUMN IF NOT EXISTS sueldok_sync_id VARCHAR(100)';
                EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sandbox_spo_subtipo ON sandbox.supplier_payment_orders(subtipo)';
                EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sandbox_spo_periodo ON sandbox.supplier_payment_orders(periodo_nomina)';
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_spo_subtipo")
    op.execute("DROP INDEX IF EXISTS idx_spo_periodo")
    op.execute("""
        ALTER TABLE supplier_payment_orders
        DROP COLUMN IF EXISTS subtipo,
        DROP COLUMN IF EXISTS beneficiario_nombre,
        DROP COLUMN IF EXISTS beneficiario_documento,
        DROP COLUMN IF EXISTS periodo_nomina,
        DROP COLUMN IF EXISTS sueldok_sync_id
    """)

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'sandbox' AND table_name = 'supplier_payment_orders'
            ) THEN
                EXECUTE 'DROP INDEX IF EXISTS sandbox.idx_sandbox_spo_subtipo';
                EXECUTE 'DROP INDEX IF EXISTS sandbox.idx_sandbox_spo_periodo';
                EXECUTE 'ALTER TABLE sandbox.supplier_payment_orders DROP COLUMN IF EXISTS subtipo, DROP COLUMN IF EXISTS beneficiario_nombre, DROP COLUMN IF EXISTS beneficiario_documento, DROP COLUMN IF EXISTS periodo_nomina, DROP COLUMN IF EXISTS sueldok_sync_id';
            END IF;
        END $$
    """)
