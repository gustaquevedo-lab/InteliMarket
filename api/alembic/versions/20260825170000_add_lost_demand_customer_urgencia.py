"""add_lost_demand_customer_urgencia

Revision ID: 20260825170000
Revises: 20260825160000
Create Date: 2026-08-25 17:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260825170000'
down_revision: Union[str, None] = '20260825160000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customer_lost_demands", sa.Column("customer_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id"), nullable=True))
    op.add_column("customer_lost_demands", sa.Column("urgencia", sa.String(20), nullable=False, server_default="normal"))


def downgrade() -> None:
    op.drop_column("customer_lost_demands", "urgencia")
    op.drop_column("customer_lost_demands", "customer_id")
