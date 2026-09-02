"""Add label_printer_configs and label_templates tables

Revision ID: 20260901200000
Revises: 20260827200000
Create Date: 2026-09-01 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260901200000'
down_revision = '20260827200000'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'label_printer_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('nombre', sa.String(length=100), nullable=False),
        sa.Column('conexion', sa.String(length=20), nullable=True),
        sa.Column('qz_printer_name', sa.String(length=200), nullable=True),
        sa.Column('host', sa.String(length=100), nullable=True),
        sa.Column('puerto_tcp', sa.Integer(), nullable=True),
        sa.Column('ancho_mm', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('alto_mm', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('columnas', sa.Integer(), server_default='1', nullable=False),
        sa.Column('activa', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'tipo', name='uq_label_printer_company_tipo'),
    )
    op.create_index('ix_label_printer_configs_company_id', 'label_printer_configs', ['company_id'])

    op.create_table(
        'label_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tipo_impresora', sa.String(length=20), nullable=False),
        sa.Column('nombre', sa.String(length=100), nullable=False),
        sa.Column('es_default', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('campos', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_label_templates_company_id', 'label_templates', ['company_id'])


def downgrade():
    op.drop_index('ix_label_templates_company_id', table_name='label_templates')
    op.drop_table('label_templates')
    op.drop_index('ix_label_printer_configs_company_id', table_name='label_printer_configs')
    op.drop_table('label_printer_configs')
