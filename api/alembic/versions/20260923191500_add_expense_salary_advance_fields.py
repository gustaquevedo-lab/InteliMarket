"""add_expense_salary_advance_fields

Revision ID: 20260923191500
Revises: 20260923164500
Create Date: 2026-09-23 19:15:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20260923191500'
down_revision: Union[str, None] = '20260923164500'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE expenses
        ADD COLUMN IF NOT EXISTS es_anticipo_sueldo BOOLEAN DEFAULT FALSE NOT NULL,
        ADD COLUMN IF NOT EXISTS employee_id UUID NULL,
        ADD COLUMN IF NOT EXISTS employee_nombre VARCHAR(150) NULL,
        ADD COLUMN IF NOT EXISTS employee_ci VARCHAR(30) NULL,
        ADD COLUMN IF NOT EXISTS periodo_nomina VARCHAR(7) NULL,
        ADD COLUMN IF NOT EXISTS cuotas_anticipo INTEGER DEFAULT 1 NOT NULL,
        ADD COLUMN IF NOT EXISTS sueldok_sync_status VARCHAR(30) DEFAULT 'pendiente' NOT NULL,
        ADD COLUMN IF NOT EXISTS sueldok_sync_id VARCHAR(100) NULL;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_expenses_es_anticipo_sueldo
        ON expenses (es_anticipo_sueldo);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_expenses_employee_id
        ON expenses (employee_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_expenses_periodo_nomina
        ON expenses (periodo_nomina);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_expenses_periodo_nomina;")
    op.execute("DROP INDEX IF EXISTS ix_expenses_employee_id;")
    op.execute("DROP INDEX IF EXISTS ix_expenses_es_anticipo_sueldo;")
    op.execute("""
        ALTER TABLE expenses
        DROP COLUMN IF EXISTS sueldok_sync_id,
        DROP COLUMN IF EXISTS sueldok_sync_status,
        DROP COLUMN IF EXISTS cuotas_anticipo,
        DROP COLUMN IF EXISTS periodo_nomina,
        DROP COLUMN IF EXISTS employee_ci,
        DROP COLUMN IF EXISTS employee_nombre,
        DROP COLUMN IF EXISTS employee_id,
        DROP COLUMN IF EXISTS es_anticipo_sueldo;
    """)
