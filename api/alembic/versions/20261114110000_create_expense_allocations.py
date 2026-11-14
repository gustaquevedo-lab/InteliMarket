"""create expense_allocations table and split indexes

Revision ID: 20261114110000
Revises: 20261103150000
Create Date: 2026-11-14 11:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261114110000'
down_revision: Union[str, None] = '20261103150000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS expense_allocations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
            cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
            category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
            naturaleza_economica VARCHAR(50) NOT NULL DEFAULT 'OPEX_GASTO_OPERATIVO',
            production_area VARCHAR(50),
            monto NUMERIC(15, 2) NOT NULL,
            notas TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_expense_allocations_expense_id ON expense_allocations(expense_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_expense_allocations_cost_center ON expense_allocations(cost_center_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_expense_allocations_category ON expense_allocations(category_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_expense_allocations_naturaleza ON expense_allocations(naturaleza_economica)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS expense_allocations CASCADE")
