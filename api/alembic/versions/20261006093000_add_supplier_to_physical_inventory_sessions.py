"""add_supplier_to_physical_inventory_sessions

Revision ID: 20261006093000
Revises: 20261001180000
Create Date: 2026-10-06 09:30:00.000000

Agrega columnas supplier_id, supplier_nombre y categoria_nombre a physical_inventory_sessions
para permitir generar inventarios y planillas de conteo acotadas por proveedor o sector.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261006093000'
down_revision: Union[str, None] = '20261001180000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE physical_inventory_sessions
        ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS supplier_nombre VARCHAR(150),
        ADD COLUMN IF NOT EXISTS categoria_nombre VARCHAR(150)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_phys_session_supplier ON physical_inventory_sessions(supplier_id)
    """)

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN
                ALTER TABLE sandbox.physical_inventory_sessions
                ADD COLUMN IF NOT EXISTS supplier_id UUID,
                ADD COLUMN IF NOT EXISTS supplier_nombre VARCHAR(150),
                ADD COLUMN IF NOT EXISTS categoria_nombre VARCHAR(150);

                CREATE INDEX IF NOT EXISTS idx_sandbox_phys_session_supplier ON sandbox.physical_inventory_sessions(supplier_id);
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS idx_phys_session_supplier
    """)

    op.execute("""
        ALTER TABLE physical_inventory_sessions
        DROP COLUMN IF EXISTS supplier_id,
        DROP COLUMN IF EXISTS supplier_nombre,
        DROP COLUMN IF EXISTS categoria_nombre
    """)

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN
                DROP INDEX IF EXISTS sandbox.idx_sandbox_phys_session_supplier;
                ALTER TABLE sandbox.physical_inventory_sessions
                DROP COLUMN IF EXISTS supplier_id,
                DROP COLUMN IF EXISTS supplier_nombre,
                DROP COLUMN IF EXISTS categoria_nombre;
            END IF;
        END $$
    """)
