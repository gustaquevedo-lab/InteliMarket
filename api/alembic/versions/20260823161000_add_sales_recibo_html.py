"""add_sales_recibo_html

Revision ID: 20260823161000
Revises: 20260823140000
Create Date: 2026-08-23 16:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260823161000'
down_revision: Union[str, None] = '20260823140000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sales", sa.Column("recibo_html", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("sales", "recibo_html")
