"""add supplier_candidates to df_purchase_suggestions

Revision ID: 20260813070000
Revises: 20260813060000
Create Date: 2026-08-13 07:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260813070000"
down_revision: Union[str, None] = "20260813060000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "df_purchase_suggestions",
        sa.Column("supplier_candidates", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("df_purchase_suggestions", "supplier_candidates")
