from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class ConversationOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: Optional[uuid.UUID]
    customer_name: Optional[str]
    customer_phone: Optional[str]
    channel: str
    status: str
    current_intent: Optional[str]
    message_count: int
    resolved_by_ai: Optional[bool]
    satisfaction_score: Optional[int]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    intent: Optional[str]
    confidence: Optional[float]
    action_taken: Optional[str]
    needs_human: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    conversation_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    message: str
    channel: str = "web"


class SendMessageResponse(BaseModel):
    conversation_id: str
    user_message: MessageOut
    assistant_message: MessageOut
    needs_human: bool
    action_taken: Optional[str]


class TicketOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    conversation_id: Optional[uuid.UUID]
    customer_id: uuid.UUID
    customer_name: Optional[str]
    category: str
    description: str
    priority: str
    status: str
    assigned_to: Optional[uuid.UUID]
    resolved_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class TicketUpdate(BaseModel):
    status: str
    assigned_to: Optional[str] = None


class IntentTemplateOut(BaseModel):
    id: uuid.UUID
    intent_name: str
    keywords: list
    response_template: str
    requires_live_agent: bool
    needs_auth: bool
    action_handler: Optional[str]
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class AssistantDashboard(BaseModel):
    total_conversations: int
    active_conversations: int
    resolved_by_ai: int
    escalated_to_human: int
    total_tickets: int
    open_tickets: int
    messages_today: int
    ai_resolution_rate: Optional[float]
    tickets_by_category: list[dict]
    conversations_by_intent: list[dict]
    recent_conversations: list[dict]
