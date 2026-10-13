"""Add intelifact_configs table

Revision ID: 20260902140000
Revises: 20260901200000
Create Date: 2026-09-02 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260902140000'
down_revision = '20260902120000'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'intelifact_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('ruc', sa.String(length=20), nullable=True),
        sa.Column('dv', sa.String(length=2), nullable=True),
        sa.Column('razon_social', sa.String(length=255), nullable=True),
        sa.Column('nombre_fantasia', sa.String(length=255), nullable=True),
        sa.Column('actividad_economica', sa.String(length=255), nullable=True),
        sa.Column('direccion', sa.String(length=255), nullable=True),
        sa.Column('ciudad', sa.String(length=100), nullable=True),
        sa.Column('departamento', sa.String(length=100), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('telefono', sa.String(length=50), nullable=True),
        sa.Column('timbrado', sa.String(length=20), nullable=True),
        sa.Column('timbrado_inicio', sa.String(length=20), nullable=True),
        sa.Column('codigo_establecimiento', sa.String(length=10), nullable=True),
        sa.Column('codigo_punto_expedicion', sa.String(length=10), nullable=True),
        sa.Column('cert_p12_base64', sa.Text(), nullable=True),
        sa.Column('cert_password', sa.String(length=255), nullable=True),
        sa.Column('ambiente', sa.String(length=20), server_default='test', nullable=False),
        sa.Column('service_base_url', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', name='uq_intelifact_config_company'),
    )
    op.create_index('ix_intelifact_configs_company_id', 'intelifact_configs', ['company_id'])


def downgrade():
    op.drop_index('ix_intelifact_configs_company_id', table_name='intelifact_configs')
    op.drop_table('intelifact_configs')
