from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class WhatsAppConfigCreate(BaseModel):
    account_sid: str
    auth_token: str
    phone_number: str
    webhook_url: Optional[str] = None
    enabled: bool = True
    auto_reply: bool = True


class WhatsAppConfigUpdate(BaseModel):
    account_sid: Optional[str] = None
    auth_token: Optional[str] = None
    phone_number: Optional[str] = None
    webhook_url: Optional[str] = None
    enabled: Optional[bool] = None
    auto_reply: Optional[bool] = None


class WhatsAppConfigResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    account_sid: str
    auth_token_masked: str
    phone_number: str
    webhook_url: Optional[str] = None
    enabled: bool
    auto_reply: bool
    created_at: datetime

    @classmethod
    def from_config(cls, config) -> "WhatsAppConfigResponse":
        return cls(
            id=config.id,
            tenant_id=config.tenant_id,
            account_sid=config.account_sid,
            auth_token_masked="****",
            phone_number=config.phone_number,
            webhook_url=config.webhook_url,
            enabled=config.enabled,
            auto_reply=config.auto_reply,
            created_at=config.created_at,
        )


class WhatsAppConversationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: str
    last_message_at: Optional[datetime] = None
    status: str
    session_state: Optional[str] = "idle"
    session_data: Optional[dict] = None
    created_at: datetime


class WhatsAppMessageResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    conversation_id: UUID
    direction: str
    content: str
    message_id: Optional[str] = None
    media_url: Optional[str] = None
    status: str
    command: Optional[str] = None
    created_at: datetime


class WhatsAppTemplateCreate(BaseModel):
    name: str
    content: str
    tipo: str
    active: bool = True


class WhatsAppTemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    tipo: Optional[str] = None
    active: Optional[bool] = None


class WhatsAppTemplateResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    content: str
    tipo: str
    active: bool
    created_at: datetime


class TwilioWebhook(BaseModel):
    From: str
    To: str
    Body: str
    MessageSid: str
    NumMedia: int = 0
    MediaUrl0: Optional[str] = None
    AccountSid: str


class SendMessageRequest(BaseModel):
    content: str
    media_url: Optional[str] = None


class WhatsAppStats(BaseModel):
    total_conversations: int
    active_today: int
    messages_today: int
    avg_response_time_seconds: Optional[float] = None


# ═══════════════════════════════════════════════════════════════
# INTELLIZAPP — Campaigns & Automation
# ═══════════════════════════════════════════════════════════════

class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tipo: str = "promotion"
    segment_filters: Optional[dict] = None
    template_id: Optional[str] = None
    message_template: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tipo: Optional[str] = None
    segment_filters: Optional[dict] = None
    template_id: Optional[str] = None
    message_template: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class CampaignResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str] = None
    tipo: str
    segment_filters: Optional[dict] = None
    template_id: Optional[UUID] = None
    message_template: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str
    total_recipients: int
    sent_count: int
    delivered_count: int
    read_count: int
    replied_count: int
    created_at: datetime
    updated_at: datetime


class CampaignRecipientResponse(BaseModel):
    id: UUID
    campaign_id: UUID
    tenant_id: UUID
    customer_id: Optional[UUID] = None
    contact_phone: str
    contact_name: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    created_at: datetime


class AutomationRuleCreate(BaseModel):
    name: str
    trigger_event: str
    conditions: Optional[dict] = None
    template_id: Optional[str] = None
    message_template: Optional[str] = None
    delay_minutes: int = 0
    active: bool = True


class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = None
    conditions: Optional[dict] = None
    template_id: Optional[str] = None
    message_template: Optional[str] = None
    delay_minutes: Optional[int] = None
    active: Optional[bool] = None


class AutomationRuleResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    trigger_event: str
    conditions: Optional[dict] = None
    template_id: Optional[UUID] = None
    message_template: Optional[str] = None
    delay_minutes: int
    active: bool
    created_at: datetime
    updated_at: datetime
