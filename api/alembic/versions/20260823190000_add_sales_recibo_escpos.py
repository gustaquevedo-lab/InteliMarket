"""add_sales_recibo_escpos

Revision ID: 20260823190000
Revises: 20260823161000
Create Date: 2026-08-23 19:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260823190000'
down_revision: Union[str, None] = '20260823161000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sales", sa.Column("recibo_escpos_b64", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("sales", "recibo_escpos_b64")
