from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ── Segments ────────────────────────────────────────────────────

class SegmentCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    filters: dict = {}


class SegmentUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    filters: Optional[dict] = None
    activo: Optional[bool] = None


class SegmentResponse(BaseModel):
    id: UUID
    nombre: str
    descripcion: Optional[str]
    filters: dict
    estimated_count: int
    last_calculated_at: Optional[datetime]
    activo: bool
    created_at: datetime


# ── Campaigns ───────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    segment_id: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    canal: str = "whatsapp"
    tipo: str = "promocion"
    contenido: Optional[str] = None
    template_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class CampaignUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    contenido: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    estado: Optional[str] = None


class CampaignResponse(BaseModel):
    id: UUID
    segment_id: Optional[UUID]
    nombre: str
    descripcion: Optional[str]
    canal: str
    tipo: str
    contenido: Optional[str]
    scheduled_at: Optional[datetime]
    estado: str
    total_recipients: int
    sent_count: int
    delivered_count: int
    opened_count: int
    clicked_count: int
    converted_count: int
    created_at: datetime


# ── Recipients ─────────────────────────────────────────────────

class RecipientResponse(BaseModel):
    id: UUID
    customer_id: UUID
    customer_nombre: Optional[str]
    customer_telefono: Optional[str]
    estado: str
    sent_at: Optional[datetime]
    opened_at: Optional[datetime]
    error_message: Optional[str]


# ── Stock Alerts ───────────────────────────────────────────────

class StockAlertConfigCreate(BaseModel):
    customer_id: str
    product_id: str


class StockAlertConfigResponse(BaseModel):
    id: UUID
    customer_id: UUID
    product_id: UUID
    activo: bool
    last_notified_at: Optional[datetime]
    created_at: datetime


class StockAlertNotification(BaseModel):
    customer_id: UUID
    customer_nombre: str
    product_id: UUID
    product_nombre: str
    stock_actual: float


# ── Offers ──────────────────────────────────────────────────────

class OfferCreate(BaseModel):
    customer_id: str
    campaign_id: Optional[str] = None
    product_id: Optional[str] = None
    titulo: str
    descripcion: Optional[str] = None
    tipo: str = "descuento"
    valor: Optional[Decimal] = None
    codigo_cupon: Optional[str] = None
    valido_desde: Optional[datetime] = None
    valido_hasta: Optional[datetime] = None


class OfferResponse(BaseModel):
    id: UUID
    customer_id: UUID
    product_id: Optional[UUID]
    titulo: str
    descripcion: Optional[str]
    tipo: str
    valor: Optional[float]
    codigo_cupon: Optional[str]
    valido_hasta: Optional[datetime]
    usado: bool
    created_at: datetime


# ── Surveys ────────────────────────────────────────────────────

class SurveyCreate(BaseModel):
    nombre: str
    preguntas: list = []


class SurveyResponse(BaseModel):
    id: UUID
    nombre: str
    preguntas: list
    activo: bool
    created_at: datetime


class SurveySubmitInput(BaseModel):
    survey_id: str
    respuestas: dict


class SurveyAnswerResponse(BaseModel):
    survey_id: UUID
    customer_id: UUID
    respuestas: dict
    created_at: datetime


# ── Dashboard ──────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_campaigns: int
    active_campaigns: int
    total_sent: int
    total_delivered: int
    total_opened: int
    total_converted: int
    total_segments: int
    total_alerts: int
    total_offers: int
    total_offer_used: int
    total_surveys: int
    total_survey_responses: int
    recent_campaigns: list[CampaignResponse]
