"""add whatsapp tables

Revision ID: c77109599b19
Revises: xxxx_add_crm
Create Date: 2026-05-10 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c77109599b19'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f67891'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('whatsapp_configs',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('account_sid', sa.String(100), nullable=False),
        sa.Column('auth_token', sa.Text(), nullable=False),
        sa.Column('phone_number', sa.String(30), nullable=False),
        sa.Column('webhook_url', sa.Text()),
        sa.Column('enabled', sa.Boolean(), server_default='true'),
        sa.Column('auto_reply', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_whatsapp_configs_tenant_id', 'whatsapp_configs', ['tenant_id'])
    op.create_index('ix_whatsapp_configs_account_sid', 'whatsapp_configs', ['account_sid'])
    op.create_foreign_key('fk_whatsapp_configs_tenant', 'whatsapp_configs', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')

    op.create_table('whatsapp_conversations',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('contact_id', sa.String(100)),
        sa.Column('contact_name', sa.String(200)),
        sa.Column('contact_phone', sa.String(30), nullable=False),
        sa.Column('last_message_at', sa.DateTime(timezone=True)),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_whatsapp_conversations_tenant_id', 'whatsapp_conversations', ['tenant_id'])
    op.create_index('ix_whatsapp_conversations_contact_phone', 'whatsapp_conversations', ['contact_phone'])
    op.create_index('ix_whatsapp_conversations_status', 'whatsapp_conversations', ['status'])
    op.create_foreign_key('fk_whatsapp_conversations_tenant', 'whatsapp_conversations', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')

    op.create_table('whatsapp_messages',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('conversation_id', sa.UUID(), nullable=False),
        sa.Column('direction', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('message_id', sa.String(100)),
        sa.Column('media_url', sa.Text()),
        sa.Column('status', sa.String(20), server_default='queued'),
        sa.Column('command', sa.String(50)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_whatsapp_messages_tenant_id', 'whatsapp_messages', ['tenant_id'])
    op.create_index('ix_whatsapp_messages_conversation_id', 'whatsapp_messages', ['conversation_id'])
    op.create_index('ix_whatsapp_messages_direction', 'whatsapp_messages', ['direction'])
    op.create_index('ix_whatsapp_messages_created_at', 'whatsapp_messages', ['created_at'])
    op.create_foreign_key('fk_whatsapp_messages_tenant', 'whatsapp_messages', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_whatsapp_messages_conversation', 'whatsapp_messages', 'whatsapp_conversations', ['conversation_id'], ['id'], ondelete='CASCADE')

    op.create_table('whatsapp_templates',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('tipo', sa.String(20), nullable=False),
        sa.Column('active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_whatsapp_templates_tenant_id', 'whatsapp_templates', ['tenant_id'])
    op.create_index('ix_whatsapp_templates_tipo', 'whatsapp_templates', ['tipo'])
    op.create_foreign_key('fk_whatsapp_templates_tenant', 'whatsapp_templates', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_table('whatsapp_templates')
    op.drop_table('whatsapp_messages')
    op.drop_table('whatsapp_conversations')
    op.drop_table('whatsapp_configs')
