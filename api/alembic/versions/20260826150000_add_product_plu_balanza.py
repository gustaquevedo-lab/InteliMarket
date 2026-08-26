"""add plu_balanza to products (numero de PLU real ya cargado en la balanza Balmak Edge SDL)

Revision ID: 20260826150000
Revises: 20260826120000
Create Date: 2026-08-26 15:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260826150000"
down_revision: Union[str, None] = "20260826120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("plu_balanza", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "plu_balanza")
