"""add_sales_numero_interno

Revision ID: 20260824000000
Revises: 20260823190000
Create Date: 2026-08-24 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260824000000'
down_revision: Union[str, None] = '20260823190000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sales", sa.Column("numero_interno", sa.String(20), nullable=True))
    op.create_unique_constraint("uq_sales_numero_interno", "sales", ["numero_interno"])


def downgrade() -> None:
    op.drop_constraint("uq_sales_numero_interno", "sales", type_="unique")
    op.drop_column("sales", "numero_interno")
