"""Add payment_integration_configs and plugpay_transactions tables

Revision ID: 20260827200000
Revises: 20260827180000
Create Date: 2026-08-27 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260827200000'
down_revision = '20260827180000'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'payment_integration_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', sa.String(length=30), nullable=False),
        sa.Column('environment', sa.String(length=20), server_default='sandbox', nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('config', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'provider', 'environment', name='uq_payment_integration_company_provider_env'),
    )
    op.create_index('ix_payment_integration_configs_company_id', 'payment_integration_configs', ['company_id'])

    op.create_table(
        'plugpay_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('tipo_operacion', sa.String(length=30), nullable=False),
        sa.Column('id_transacao', sa.String(length=30), nullable=True),
        sa.Column('referencia_interna', sa.String(length=80), nullable=True),
        sa.Column('qr_code_id', sa.String(length=80), nullable=True),
        sa.Column('qr_code_string_image', sa.String(length=2000), nullable=True),
        sa.Column('value_brl', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('url_payment_form', sa.String(length=500), nullable=True),
        sa.Column('numero_cuotas', sa.Integer(), nullable=True),
        sa.Column('moneda_origen', sa.String(length=3), nullable=True),
        sa.Column('monto_origen', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('exitosa', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('error_message', sa.String(length=300), nullable=True),
        sa.Column('raw_response', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_plugpay_transactions_company_id', 'plugpay_transactions', ['company_id'])
    op.create_index('ix_plugpay_transactions_sale_id', 'plugpay_transactions', ['sale_id'])
    op.create_index('ix_plugpay_transactions_customer_id', 'plugpay_transactions', ['customer_id'])


def downgrade():
    op.drop_index('ix_plugpay_transactions_customer_id', table_name='plugpay_transactions')
    op.drop_index('ix_plugpay_transactions_sale_id', table_name='plugpay_transactions')
    op.drop_index('ix_plugpay_transactions_company_id', table_name='plugpay_transactions')
    op.drop_table('plugpay_transactions')
    op.drop_index('ix_payment_integration_configs_company_id', table_name='payment_integration_configs')
    op.drop_table('payment_integration_configs')
