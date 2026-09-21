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
    # 1. Campos para whatsapp_conversations (multi-agente, handling_mode, departamento, tiempos de espera)
    op.execute("""
        ALTER TABLE whatsapp_conversations
        ADD COLUMN IF NOT EXISTS handling_mode VARCHAR(30) DEFAULT 'ai_bot' NOT NULL,
        ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS assigned_user_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'general',
        ADD COLUMN IF NOT EXISTS waiting_since TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS unread_agent_count INTEGER DEFAULT 0 NOT NULL;
    """)

    # Índices para consultas ultrarrápidas de bandejas
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_wa_conv_handling_mode ON whatsapp_conversations(handling_mode);
        CREATE INDEX IF NOT EXISTS ix_wa_conv_assigned_user ON whatsapp_conversations(assigned_user_id);
        CREATE INDEX IF NOT EXISTS ix_wa_conv_department ON whatsapp_conversations(department);
        CREATE INDEX IF NOT EXISTS ix_wa_conv_waiting_since ON whatsapp_conversations(waiting_since);
    """)

    # 2. Campos para whatsapp_messages (autoría, notas internas, tipo de multimedia)
    op.execute("""
        ALTER TABLE whatsapp_messages
        ADD COLUMN IF NOT EXISTS sender_type VARCHAR(30) DEFAULT 'customer',
        ADD COLUMN IF NOT EXISTS sender_user_id UUID,
        ADD COLUMN IF NOT EXISTS sender_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS media_type VARCHAR(30),
        ADD COLUMN IF NOT EXISTS media_filename VARCHAR(255),
        ADD COLUMN IF NOT EXISTS media_size_bytes BIGINT;
    """)

    # Índices para mensajes
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_wa_msg_sender_type ON whatsapp_messages(sender_type);
        CREATE INDEX IF NOT EXISTS ix_wa_msg_media_type ON whatsapp_messages(media_type);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS ix_wa_msg_media_type;
        DROP INDEX IF EXISTS ix_wa_msg_sender_type;
        ALTER TABLE whatsapp_messages
        DROP COLUMN IF EXISTS media_size_bytes,
        DROP COLUMN IF EXISTS media_filename,
        DROP COLUMN IF EXISTS media_type,
        DROP COLUMN IF EXISTS sender_name,
        DROP COLUMN IF EXISTS sender_user_id,
        DROP COLUMN IF EXISTS sender_type;

        DROP INDEX IF EXISTS ix_wa_conv_waiting_since;
        DROP INDEX IF EXISTS ix_wa_conv_department;
        DROP INDEX IF EXISTS ix_wa_conv_assigned_user;
        DROP INDEX IF EXISTS ix_wa_conv_handling_mode;
        ALTER TABLE whatsapp_conversations
        DROP COLUMN IF EXISTS unread_agent_count,
        DROP COLUMN IF EXISTS waiting_since,
        DROP COLUMN IF EXISTS department,
        DROP COLUMN IF EXISTS assigned_user_name,
        DROP COLUMN IF EXISTS assigned_user_id,
        DROP COLUMN IF EXISTS handling_mode;
    """)
