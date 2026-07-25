"""widen finance_recommendations.monto_relacionado (multi-moneda no entraba en 30 chars)

Revision ID: 20260725000000
Revises: 20260724000000
Create Date: 2026-07-25 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260725000000"
down_revision: Union[str, None] = "20260724000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("finance_recommendations", "monto_relacionado", type_=sa.String(120))


def downgrade() -> None:
    op.alter_column("finance_recommendations", "monto_relacionado", type_=sa.String(30))
