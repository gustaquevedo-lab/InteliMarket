"""add categorias_ids to scale_configs (scope which product categories a scale's PLU/price auto-sync covers)

Revision ID: 20260826120000
Revises: 20260825170000
Create Date: 2026-08-26 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260826120000"
down_revision: Union[str, None] = "20260825170000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scale_configs",
        sa.Column("categorias_ids", postgresql.JSONB, nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("scale_configs", "categorias_ids")
