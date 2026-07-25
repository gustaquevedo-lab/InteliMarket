"""Add seguro_vencimiento and itv_vencimiento to intelientregas_vehicles

Revision ID: 20260531000001
Revises: 20260531000000
Create Date: 2026-05-31 00:00:01.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "20260531000001"
down_revision: Union[str, Sequence[str], None] = "20260531000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "intelientregas_vehicles",
        sa.Column("seguro_vencimiento", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "intelientregas_vehicles",
        sa.Column("itv_vencimiento", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("intelientregas_vehicles", "seguro_vencimiento")
    op.drop_column("intelientregas_vehicles", "itv_vencimiento")
