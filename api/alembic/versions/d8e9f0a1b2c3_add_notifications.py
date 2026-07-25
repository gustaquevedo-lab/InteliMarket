"""add notifications tables

Revision ID: d8e9f0a1b2c3
Revises: c77109599b19
Create Date: 2026-05-13 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd8e9f0a1b2c3'
down_revision: Union[str, Sequence[str], None] = 'c77109599b19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('notification_templates',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('title_template', sa.String(500), nullable=False),
        sa.Column('body_template', sa.Text(), nullable=False),
        sa.Column('tipo', sa.String(50), nullable=False),
        sa.Column('canales', sa.ARRAY(sa.String), server_default=sa.text("ARRAY['in_app']")),
        sa.Column('activo', sa.Boolean(), server_default="true"),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_notification_templates_tenant_id', 'notification_templates', ['tenant_id'])
    op.create_index('ix_notification_templates_tipo', 'notification_templates', ['tipo'])
    op.create_foreign_key('fk_notification_templates_tenant', 'notification_templates', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')

    op.create_table('user_notification_preferences',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('canal', sa.String(20), nullable=False),
        sa.Column('tipo', sa.String(50), nullable=False),
        sa.Column('habilitado', sa.Boolean(), server_default="true"),
        sa.Column('horario_inicio', sa.Time(), nullable=True),
        sa.Column('horario_fin', sa.Time(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_user_notification_preferences_user_id', 'user_notification_preferences', ['user_id'])
    op.create_index('ix_user_notification_preferences_tenant_id', 'user_notification_preferences', ['tenant_id'])
    op.create_foreign_key('fk_user_notification_preferences_user', 'user_notification_preferences', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_user_notification_preferences_tenant', 'user_notification_preferences', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')

    op.create_table('notifications',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('tipo', sa.String(50), nullable=False),
        sa.Column('link', sa.String(500), nullable=True),
        sa.Column('leida', sa.Boolean(), server_default="false"),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_notifications_tenant_id', 'notifications', ['tenant_id'])
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_tipo', 'notifications', ['tipo'])
    op.create_index('ix_notifications_leida', 'notifications', ['leida'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])
    op.create_foreign_key('fk_notifications_tenant', 'notifications', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_notifications_user', 'notifications', 'users', ['user_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_table('notifications')
    op.drop_table('user_notification_preferences')
    op.drop_table('notification_templates')