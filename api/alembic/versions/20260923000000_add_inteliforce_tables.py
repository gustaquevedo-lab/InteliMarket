"""add_inteliforce_tables

Revision ID: 20260923000000
Revises: 20260807000000
Create Date: 2026-09-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = '20260923000000'
down_revision: Union[str, None] = '20260807000000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'inteliforce_service_keys',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('api_key', sa.String(), nullable=False),
        sa.Column('nombre', sa.String(), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('api_key'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_inteliforce_service_keys_company_id', 'inteliforce_service_keys', ['company_id'])

    op.create_table(
        'inteliforce_sync_records',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('record_type', sa.String(), nullable=False),
        sa.Column('convex_id', sa.String(), nullable=False),
        sa.Column('employee_convex_id', sa.String(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payload', JSONB(), nullable=False, server_default='{}'),
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('record_type', 'convex_id', name='uq_inteliforce_sync_records_type_convex'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_inteliforce_sync_records_company_id', 'inteliforce_sync_records', ['company_id'])
    op.create_index('ix_inteliforce_sync_records_employee', 'inteliforce_sync_records', ['employee_convex_id'])
    op.create_index('ix_inteliforce_sync_records_recorded_at', 'inteliforce_sync_records', ['recorded_at'])


def downgrade() -> None:
    op.drop_table('inteliforce_sync_records')
    op.drop_table('inteliforce_service_keys')
