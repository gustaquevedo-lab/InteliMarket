"""add_customers_extra_club_numero

Revision ID: 20260825150000
Revises: 20260825140000
Create Date: 2026-08-25 15:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260825150000'
down_revision: Union[str, None] = '20260825140000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("extra_club_numero", sa.String(40)))
    op.create_index("ix_customers_extra_club_numero", "customers", ["extra_club_numero"])


def downgrade() -> None:
    op.drop_index("ix_customers_extra_club_numero", table_name="customers")
    op.drop_column("customers", "extra_club_numero")
