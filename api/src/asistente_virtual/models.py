from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class Conversation(Base):
    __tablename__ = "va_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    customer_name = Column(String(200), nullable=True)
    customer_phone = Column(String(20), nullable=True)

    channel = Column(String(20), default="web")
    status = Column(String(20), default="active")
    current_intent = Column(String(50), nullable=True)

    message_count = Column(Integer, default=0)
    resolved_by_ai = Column(Boolean, nullable=True)
    satisfaction_score = Column(Integer, nullable=True)

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "va_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("va_conversations.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    intent = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)

    action_taken = Column(String(50), nullable=True)
    needs_human = Column(Boolean, default=False)
    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Ticket(Base):
    __tablename__ = "va_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("va_conversations.id"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_name = Column(String(200), nullable=True)

    category = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(10), default="medium")
    status = Column(String(20), default="open")

    assigned_to = Column(UUID(as_uuid=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class IntentTemplate(Base):
    __tablename__ = "va_intent_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    intent_name = Column(String(50), nullable=False)
    keywords = Column(JSON, nullable=False)
    response_template = Column(Text, nullable=False)
    requires_live_agent = Column(Boolean, default=False)
    needs_auth = Column(Boolean, default=True)
    action_handler = Column(String(50), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
