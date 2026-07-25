"""add_driver_pin_hash

Revision ID: 20260523120000
Revises: 20260522194300
Create Date: 2026-05-23 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20260523120000"
down_revision: Union[str, None] = "20260522194300"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("intelientregas_drivers", sa.Column("pin_hash", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("intelientregas_drivers", "pin_hash")
