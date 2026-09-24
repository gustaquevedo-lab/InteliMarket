"""add_alias_to_bank_accounts

Revision ID: 20260909160000
Revises: 20260909140000
Create Date: 2026-09-09 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260909160000'
down_revision: Union[str, None] = '20260909140000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Agrega columna alias (apodo/nombre de fantasía) a bank_accounts
    op.add_column(
        'bank_accounts',
        sa.Column('alias', sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('bank_accounts', 'alias')
