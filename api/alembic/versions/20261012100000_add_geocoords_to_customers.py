"""add geocoords to customers

Revision ID: 20261012100000
Revises: 20260923200000
Create Date: 2026-10-12 10:00:00.000000

"""
from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261012100000'
down_revision: Union[str, None] = '20260923200000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('customers', sa.Column('lat', sa.Numeric(10, 8), nullable=True))
    op.add_column('customers', sa.Column('lng', sa.Numeric(11, 8), nullable=True))
    op.add_column('customers', sa.Column('geocoded_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('customers', 'geocoded_at')
    op.drop_column('customers', 'lng')
    op.drop_column('customers', 'lat')
