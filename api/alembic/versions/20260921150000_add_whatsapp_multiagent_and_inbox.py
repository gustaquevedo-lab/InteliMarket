"""Add WhatsApp Multi-Agent, Inboxes and Advanced Media support

Revision ID: 20260921150000
Revises: 20260919170000
Create Date: 2026-09-21 15:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '20260921150000'
down_revision: Union[str, None] = '20260919170000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Columnas para whatsapp_conversations
    op.execute("ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS handling_mode VARCHAR(30) DEFAULT 'ai_bot' NOT NULL")
    op.execute("ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS assigned_user_name VARCHAR(150)")
    op.execute("ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'general'")
    op.execute("ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS waiting_since TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS unread_agent_count INTEGER DEFAULT 0 NOT NULL")

    # Índices para consultas de bandejas
    op.execute("CREATE INDEX IF NOT EXISTS ix_wa_conv_handling_mode ON whatsapp_conversations(handling_mode)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_wa_conv_assigned_user ON whatsapp_conversations(assigned_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_wa_conv_department ON whatsapp_conversations(department)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_wa_conv_waiting_since ON whatsapp_conversations(waiting_since)")

    # 2. Columnas para whatsapp_messages
    op.execute("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_type VARCHAR(30) DEFAULT 'customer'")
    op.execute("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_user_id UUID")
    op.execute("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(150)")
    op.execute("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(30)")
    op.execute("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_filename VARCHAR(255)")
    op.execute("ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_size_bytes BIGINT")

    # Índices para mensajes
    op.execute("CREATE INDEX IF NOT EXISTS ix_wa_msg_sender_type ON whatsapp_messages(sender_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_wa_msg_media_type ON whatsapp_messages(media_type)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_wa_msg_media_type")
    op.execute("DROP INDEX IF EXISTS ix_wa_msg_sender_type")
    op.execute("ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS media_size_bytes")
    op.execute("ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS media_filename")
    op.execute("ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS media_type")
    op.execute("ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS sender_name")
    op.execute("ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS sender_user_id")
    op.execute("ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS sender_type")

    op.execute("DROP INDEX IF EXISTS ix_wa_conv_waiting_since")
    op.execute("DROP INDEX IF EXISTS ix_wa_conv_department")
    op.execute("DROP INDEX IF EXISTS ix_wa_conv_assigned_user")
    op.execute("DROP INDEX IF EXISTS ix_wa_conv_handling_mode")
    op.execute("ALTER TABLE whatsapp_conversations DROP COLUMN IF EXISTS unread_agent_count")
    op.execute("ALTER TABLE whatsapp_conversations DROP COLUMN IF EXISTS waiting_since")
    op.execute("ALTER TABLE whatsapp_conversations DROP COLUMN IF EXISTS department")
    op.execute("ALTER TABLE whatsapp_conversations DROP COLUMN IF EXISTS assigned_user_name")
    op.execute("ALTER TABLE whatsapp_conversations DROP COLUMN IF EXISTS assigned_user_id")
    op.execute("ALTER TABLE whatsapp_conversations DROP COLUMN IF EXISTS handling_mode")
