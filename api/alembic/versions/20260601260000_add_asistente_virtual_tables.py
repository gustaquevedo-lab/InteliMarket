"""Add Asistente Virtual IA tables (conversations, messages, tickets, intent templates)

Revision ID: 20260601260000
Revises: 20260601250000
Create Date: 2026-06-02 01:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601260000"
down_revision: Union[str, None] = "20260601250000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Conversations
    op.create_table(
        "va_conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("customer_phone", sa.String(20), nullable=True),
        sa.Column("channel", sa.String(20), server_default=sa.text("'web'")),
        sa.Column("status", sa.String(20), server_default=sa.text("'active'")),
        sa.Column("current_intent", sa.String(50), nullable=True),
        sa.Column("message_count", sa.Integer(), server_default=sa.text("0")),
        sa.Column("resolved_by_ai", sa.Boolean(), nullable=True),
        sa.Column("satisfaction_score", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Messages
    op.create_table(
        "va_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", UUID(as_uuid=True), sa.ForeignKey("va_conversations.id"), nullable=False, index=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("intent", sa.String(50), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("action_taken", sa.String(50), nullable=True),
        sa.Column("needs_human", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Tickets
    op.create_table(
        "va_tickets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("conversation_id", UUID(as_uuid=True), sa.ForeignKey("va_conversations.id"), nullable=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("priority", sa.String(10), server_default=sa.text("'medium'")),
        sa.Column("status", sa.String(20), server_default=sa.text("'open'")),
        sa.Column("assigned_to", UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Intent Templates
    op.create_table(
        "va_intent_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("intent_name", sa.String(50), nullable=False),
        sa.Column("keywords", sa.JSON(), nullable=False),
        sa.Column("response_template", sa.Text(), nullable=False),
        sa.Column("requires_live_agent", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("needs_auth", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("action_handler", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("va_intent_templates")
    op.drop_table("va_tickets")
    op.drop_table("va_messages")
    op.drop_table("va_conversations")
