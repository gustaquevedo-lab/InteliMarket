"""Add chatbot session state to whatsapp_conversations

Revision ID: 20260529000000
Revises: 20260528140000
Create Date: 2026-05-29 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '20260529000000'
down_revision = '20260528140000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add session_state column for chatbot state machine
    op.add_column('whatsapp_conversations', 
        sa.Column('session_state', sa.String(50), 
                  server_default='idle',
                  comment='Chatbot state: idle, menu_main, menu_products, etc.'),
        schema='public'
    )
    
    # Add session_data column for storing context (selected product, order, etc.)
    op.add_column('whatsapp_conversations',
        sa.Column('session_data', postgresql.JSONB(),
                  comment='Additional session data (selected product, order context, etc.)'),
        schema='public'
    )
    
    # Create index for faster state-based queries
    op.create_index(
        'ix_whatsapp_conversations_session_state',
        'whatsapp_conversations',
        ['session_state'],
        schema='public'
    )


def downgrade() -> None:
    op.drop_index('ix_whatsapp_conversations_session_state', table_name='whatsapp_conversations', schema='public')
    op.drop_column('whatsapp_conversations', 'session_data', schema='public')
    op.drop_column('whatsapp_conversations', 'session_state', schema='public')
