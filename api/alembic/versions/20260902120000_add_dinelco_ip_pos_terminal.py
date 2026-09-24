"""Add ip_pos_dinelco to pos_terminal_assignments

Revision ID: 20260902120000
Revises: 20260901200000
Create Date: 2026-09-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260902120000'
down_revision = '20260901200000'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('pos_terminal_assignments', sa.Column('ip_pos_dinelco', sa.String(length=45), nullable=True))


def downgrade():
    op.drop_column('pos_terminal_assignments', 'ip_pos_dinelco')
