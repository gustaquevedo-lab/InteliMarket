from sqlalchemy import Column, String, Boolean, DateTime, Text, BigInteger, Integer, Enum as SAEnum, ForeignKey, Index, ForeignKeyConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import enum

from api.src.db import Base


class ConversationStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class MessageDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class MessageStatus(str, enum.Enum):
    queued = "queued"
    sent = "sent"
    delivered = "delivered"
    read = "read"
    failed = "failed"


class TemplateTipo(str, enum.Enum):
    welcome = "welcome"
    order_status = "order_status"
    stock_alert = "stock_alert"
    promotion = "promotion"
    reminder = "reminder"
    custom = "custom"


class CampaignStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    sending = "sending"
    completed = "completed"
    cancelled = "cancelled"


class CampaignRecipientStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    delivered = "delivered"
    read = "read"
    replied = "replied"
    failed = "failed"


class AutomationTriggerEvent(str, enum.Enum):
    sale_created = "sale.created"
    sale_paid = "sale.paid"
    sale_cancelled = "sale.cancelled"
    delivery_assigned = "delivery.assigned"
    delivery_in_transit = "delivery.in_transit"
    delivery_delivered = "delivery.delivered"
    delivery_failed = "delivery.failed"
    payment_received = "payment.received"
    payment_overdue = "payment.overdue"
    customer_inactive_30d = "customer.inactive_30d"
    customer_inactive_60d = "customer.inactive_60d"
    customer_inactive_90d = "customer.inactive_90d"
    stock_below_minimum = "stock.below_minimum"
    contract_expiring = "contract.expiring"


class WhatsAppConfig(Base):
    __tablename__ = "whatsapp_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    account_sid = Column(String(100), nullable=False)
    auth_token = Column(Text, nullable=False)
    phone_number = Column(String(30), nullable=False)
    webhook_url = Column(Text)
    enabled = Column(Boolean, default=True, server_default="true")
    auto_reply = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_whatsapp_configs_tenant_id", "tenant_id"),
    )


class WhatsAppConversation(Base):
    __tablename__ = "whatsapp_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    contact_id = Column(String(100))
    contact_name = Column(String(200))
    contact_phone = Column(String(30), nullable=False)
    last_message_at = Column(DateTime(timezone=True))
    status = Column(SAEnum(ConversationStatus), default=ConversationStatus.active, server_default="active")
    session_state = Column(String(50), default="idle", server_default="idle", comment="Chatbot state: idle, menu_main, menu_products, etc.")
    session_data = Column(JSONB, comment="Additional session data (selected product, order context, etc.)")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_whatsapp_conversations_tenant_id", "tenant_id"),
        Index("ix_whatsapp_conversations_contact_phone", "contact_phone"),
        Index("ix_whatsapp_conversations_status", "status"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_conversations.id", ondelete="CASCADE"), nullable=False)
    direction = Column(SAEnum(MessageDirection), nullable=False)
    content = Column(Text, nullable=False)
    message_id = Column(String(100))
    media_url = Column(Text)
    status = Column(SAEnum(MessageStatus), default=MessageStatus.queued, server_default="queued")
    command = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_whatsapp_messages_tenant_id", "tenant_id"),
        Index("ix_whatsapp_messages_conversation_id", "conversation_id"),
        Index("ix_whatsapp_messages_direction", "direction"),
        Index("ix_whatsapp_messages_created_at", "created_at"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )


class WhatsAppTemplate(Base):
    __tablename__ = "whatsapp_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    tipo = Column(SAEnum(TemplateTipo), nullable=False)
    active = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_whatsapp_templates_tenant_id", "tenant_id"),
        Index("ix_whatsapp_templates_tipo", "tipo"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )


# ═══════════════════════════════════════════════════════════════
# INTELLIZAPP — Campaign Engine
# ═══════════════════════════════════════════════════════════════

class WhatsAppCampaign(Base):
    """Marketing campaign with scheduled sending to segmented recipients."""
    __tablename__ = "whatsapp_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    tipo = Column(String(30), nullable=False, server_default="promotion")
    # promotion, transactional, newsletter, reminder
    segment_filters = Column(JSONB, comment="JSON: {zona: [...], frecuencia_min: N, producto_comprado: [...], ...}")
    template_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_templates.id"), nullable=True)
    message_template = Column(Text, comment="Override template content with {VAR} placeholders")
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    status = Column(SAEnum(CampaignStatus), default=CampaignStatus.draft, server_default="draft", index=True)
    total_recipients = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    read_count = Column(Integer, default=0)
    replied_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_whatsapp_campaigns_tenant_status", "tenant_id", "status"),
        Index("ix_whatsapp_campaigns_scheduled", "scheduled_at"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )


class WhatsAppCampaignRecipient(Base):
    """Per-recipient tracking within a campaign."""
    __tablename__ = "whatsapp_campaign_recipients"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_campaigns.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    customer_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    contact_phone = Column(String(30), nullable=False)
    contact_name = Column(String(200))
    status = Column(SAEnum(CampaignRecipientStatus), default=CampaignRecipientStatus.pending, server_default="pending", index=True)
    error_message = Column(Text)
    sent_at = Column(DateTime(timezone=True))
    delivered_at = Column(DateTime(timezone=True))
    read_at = Column(DateTime(timezone=True))
    replied_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_wa_campaign_recipients_campaign_status", "campaign_id", "status"),
        Index("ix_wa_campaign_recipients_phone", "contact_phone"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )


class WhatsAppAutomationRule(Base):
    """Trigger-based automation: when event X happens, send template Y after Z minutes."""
    __tablename__ = "whatsapp_automation_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    trigger_event = Column(SAEnum(AutomationTriggerEvent), nullable=False, index=True)
    conditions = Column(JSONB, comment="Additional JSON conditions for trigger")
    template_id = Column(UUID(as_uuid=True), ForeignKey("whatsapp_templates.id"), nullable=True)
    message_template = Column(Text, comment="Override with {VAR} placeholders")
    delay_minutes = Column(Integer, default=0, comment="Delay in minutes before sending")
    active = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_wa_automation_rules_tenant_event", "tenant_id", "trigger_event"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )
