"""add_customers_empresa_vinculada

Revision ID: 20260825160000
Revises: 20260825150000
Create Date: 2026-08-25 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260825160000'
down_revision: Union[str, None] = '20260825150000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("empresa_vinculada_nombre", sa.String(255)))
    op.add_column("customers", sa.Column("empresa_vinculada_ruc", sa.String(20)))


def downgrade() -> None:
    op.drop_column("customers", "empresa_vinculada_ruc")
    op.drop_column("customers", "empresa_vinculada_nombre")
