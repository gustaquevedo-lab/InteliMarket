"""alter_expense_employee_id_to_varchar

Revision ID: 20260923200000
Revises: 20260923191500
Create Date: 2026-09-23 20:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20260923200000'
down_revision: Union[str, None] = '20260923191500'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE expenses
        ALTER COLUMN employee_id TYPE VARCHAR(100) USING employee_id::text;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE expenses
        ALTER COLUMN employee_id TYPE UUID USING employee_id::uuid;
    """)
