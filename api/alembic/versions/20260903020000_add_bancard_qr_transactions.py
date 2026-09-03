"""Add bancard_qr_transactions

Revision ID: 20260903020000
Revises: 20260902140000
Create Date: 2026-09-03 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260903020000'
down_revision = '20260902140000'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'bancard_qr_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('hook_alias', sa.String(length=60), nullable=False),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('description', sa.String(length=200)),
        sa.Column('qr_url', sa.Text()),
        sa.Column('qr_data', sa.Text()),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('response_code', sa.String(length=10)),
        sa.Column('response_description', sa.Text()),
        sa.Column('ticket_number', sa.String(length=40)),
        sa.Column('authorization_code', sa.String(length=40)),
        sa.Column('account_type', sa.String(length=10)),
        sa.Column('card_last_numbers', sa.String(length=10)),
        sa.Column('bin', sa.String(length=20)),
        sa.Column('payer_name', sa.String(length=120)),
        sa.Column('payer_lastname', sa.String(length=120)),
        sa.Column('punto_emision', sa.String(length=10)),
        sa.Column('cajero_id', postgresql.UUID(as_uuid=True)),
        sa.Column('reverted', sa.Boolean(), server_default='false'),
        sa.Column('raw_callback', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('confirmed_at', sa.DateTime(timezone=True)),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_bancard_qr_transactions_company_id', 'bancard_qr_transactions', ['company_id'])
    op.create_unique_constraint('uq_bancard_qr_transactions_hook_alias', 'bancard_qr_transactions', ['hook_alias'])
    op.create_index('ix_bancard_qr_transactions_hook_alias', 'bancard_qr_transactions', ['hook_alias'])


def downgrade():
    op.drop_table('bancard_qr_transactions')
