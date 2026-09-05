"""Schemas del Gerente de Marketing IA -- dashboard y chat sobre datos reales."""
from typing import Optional
from pydantic import BaseModel, Field


class CustomerSegment(BaseModel):
    nombre: str
    cantidad: int
    criterio: str


class CampaignSuggestion(BaseModel):
    id: str
    titulo: str
    segmento: str
    cantidad_clientes: int
    motivo: str


class MarketingDashboard(BaseModel):
    segmentos: list[CustomerSegment]
    campañas_sugeridas: list[CampaignSuggestion]
    resumen_ejecutivo: str


class ChatMessageRequest(BaseModel):
    company_id: str
    message: str
    conversation_history: Optional[list[dict]] = None


class ChatMessageResponse(BaseModel):
    reply: str
    suggested_prompts: list[str] = Field(default_factory=list)
