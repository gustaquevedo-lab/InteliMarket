"""Add pos_terminal_transactions table (integracion real Bancard POS Android)

Revision ID: 20260827180000
Revises: 20260827120000
Create Date: 2026-08-27 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260827180000'
down_revision = '20260827120000'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'pos_terminal_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('tipo_operacion', sa.String(length=30), nullable=False),
        sa.Column('terminal_ip', sa.String(length=45), nullable=True),
        sa.Column('punto_emision', sa.String(length=10), nullable=True),
        sa.Column('factura_nro_provisional', sa.String(length=20), nullable=True),
        sa.Column('bin', sa.String(length=10), nullable=True),
        sa.Column('nsu', sa.String(length=10), nullable=True),
        sa.Column('codigo_autorizacion', sa.String(length=10), nullable=True),
        sa.Column('codigo_comercio', sa.String(length=15), nullable=True),
        sa.Column('issuer_id', sa.String(length=5), nullable=True),
        sa.Column('nombre_tarjeta', sa.String(length=60), nullable=True),
        sa.Column('pan', sa.String(length=4), nullable=True),
        sa.Column('mensaje_display', sa.String(length=60), nullable=True),
        sa.Column('nombre_cliente', sa.String(length=60), nullable=True),
        sa.Column('monto', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('monto_vuelto', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('monto_comision', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('monto_extraccion', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('saldo', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('moneda_alt', sa.String(length=3), nullable=True),
        sa.Column('monto_alt', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('exitosa', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('verificado_automaticamente', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('error_message', sa.String(length=200), nullable=True),
        sa.Column('raw_response', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_pos_terminal_transactions_company_id', 'pos_terminal_transactions', ['company_id'])
    op.create_index('ix_pos_terminal_transactions_sale_id', 'pos_terminal_transactions', ['sale_id'])
    op.create_index('ix_pos_terminal_transactions_customer_id', 'pos_terminal_transactions', ['customer_id'])


def downgrade():
    op.drop_index('ix_pos_terminal_transactions_customer_id', table_name='pos_terminal_transactions')
    op.drop_index('ix_pos_terminal_transactions_sale_id', table_name='pos_terminal_transactions')
    op.drop_index('ix_pos_terminal_transactions_company_id', table_name='pos_terminal_transactions')
    op.drop_table('pos_terminal_transactions')
