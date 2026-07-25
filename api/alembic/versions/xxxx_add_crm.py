"""add crm tables

Revision ID: xxxx_add_crm
Revises: a1b2c3d4e5f6
Create Date: 2026-05-10 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f67891'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('crm_leads',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('nombre', sa.String(200), nullable=False),
        sa.Column('email', sa.String(200)),
        sa.Column('telefono', sa.String(30)),
        sa.Column('empresa', sa.String(200)),
        sa.Column('fuente', sa.String(50), server_default='web'),
        sa.Column('estado', sa.String(50), server_default='nuevo'),
        sa.Column('puntaje', sa.Integer(), server_default='0'),
        sa.Column('notas', sa.Text()),
        sa.Column('asignado_a', sa.UUID()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_crm_leads_tenant_id', 'crm_leads', ['tenant_id'])
    op.create_index('ix_crm_leads_estado', 'crm_leads', ['estado'])
    op.create_foreign_key('fk_crm_leads_tenant', 'crm_leads', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_crm_leads_company', 'crm_leads', 'companies', ['company_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_crm_leads_user', 'crm_leads', 'users', ['asignado_a'], ['id'])

    op.create_table('crm_oportunidades',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('lead_id', sa.UUID(), nullable=True),
        sa.Column('nombre', sa.String(200), nullable=False),
        sa.Column('monto_estimado', sa.Numeric(15, 0), server_default='0'),
        sa.Column('etapa', sa.String(50), server_default='lead'),
        sa.Column('probabilidad', sa.Integer(), server_default='0'),
        sa.Column('cliente_id', sa.UUID(), nullable=True),
        sa.Column('fecha_cierre_estimada', sa.Date(), nullable=True),
        sa.Column('notas', sa.Text()),
        sa.Column('asignado_a', sa.UUID()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_crm_oportunidades_tenant_id', 'crm_oportunidades', ['tenant_id'])
    op.create_index('ix_crm_oportunidades_etapa', 'crm_oportunidades', ['etapa'])
    op.create_foreign_key('fk_crm_oportunidades_tenant', 'crm_oportunidades', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_crm_oportunidades_company', 'crm_oportunidades', 'companies', ['company_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_crm_oportunidades_lead', 'crm_oportunidades', 'crm_leads', ['lead_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_crm_oportunidades_cliente', 'crm_oportunidades', 'customers', ['cliente_id'], ['id'])
    op.create_foreign_key('fk_crm_oportunidades_user', 'crm_oportunidades', 'users', ['asignado_a'], ['id'])

    op.create_table('crm_actividades',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('oportunidad_id', sa.UUID(), nullable=True),
        sa.Column('lead_id', sa.UUID(), nullable=True),
        sa.Column('tipo', sa.String(50), nullable=False),
        sa.Column('titulo', sa.String(300), nullable=False),
        sa.Column('descripcion', sa.Text()),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('hora', sa.Time(), nullable=True),
        sa.Column('duracion_min', sa.Integer(), nullable=True),
        sa.Column('completada', sa.Boolean(), server_default='false'),
        sa.Column('asignado_a', sa.UUID()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_crm_actividades_tenant_id', 'crm_actividades', ['tenant_id'])
    op.create_index('ix_crm_actividades_fecha', 'crm_actividades', ['fecha'])
    op.create_foreign_key('fk_crm_actividades_tenant', 'crm_actividades', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_crm_actividades_oportunidad', 'crm_actividades', 'crm_oportunidades', ['oportunidad_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_crm_actividades_lead', 'crm_actividades', 'crm_leads', ['lead_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_crm_actividades_user', 'crm_actividades', 'users', ['asignado_a'], ['id'])

    op.create_table('crm_actividades_realizadas',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('actividad_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('fecha_ejecucion', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('notas', sa.Text()),
    )
    op.create_foreign_key('fk_crm_actividades_realizadas_tenant', 'crm_actividades_realizadas', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_crm_actividades_realizadas_actividad', 'crm_actividades_realizadas', 'crm_actividades', ['actividad_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_crm_actividades_realizadas_user', 'crm_actividades_realizadas', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    op.drop_table('crm_actividades_realizadas')
    op.drop_table('crm_actividades')
    op.drop_table('crm_oportunidades')
    op.drop_table('crm_leads')
