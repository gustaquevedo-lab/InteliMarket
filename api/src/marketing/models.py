import uuid
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from api.src.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


# ── Customer Segments ───────────────────────────────────────────

class CustomerSegment(Base):
    __tablename__ = "marketing_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    filters = Column(JSONB, nullable=False, default=dict)
    # filters: {
    #   frecuencia_min: int (compras/mes), frecuencia_max: int,
    #   monto_min: float, monto_max: float,
    #   zonas: [str], ciudades: [str],
    #   productos_comprados: [uuid], categorias: [uuid],
    #   antiguedad_dias_min: int, antiguedad_dias_max: int,
    #   ultima_compra_dias: int (inactivos),
    #   tipo_persona: str (fisica/juridica),
    #   credito_disponible_min: float,
    #   con_pendientes: bool
    # }
    estimated_count = Column(Integer, default=0)
    last_calculated_at = Column(DateTime(timezone=True))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ── Campaigns ───────────────────────────────────────────────────

class MarketingCampaign(Base):
    __tablename__ = "marketing_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("marketing_segments.id"), nullable=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    canal = Column(String(20), nullable=False)  # whatsapp, email, sms
    tipo = Column(String(30), nullable=False, default="promocion")
    # promocion, informativa, recordatorio, encuesta, alerta_stock, bienvenida
    contenido = Column(Text)
    template_id = Column(UUID(as_uuid=True), nullable=True)
    # Scheduling
    scheduled_at = Column(DateTime(timezone=True))
    sent_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    estado = Column(String(20), default="borrador")
    # borrador, programada, enviando, completada, cancelada
    # Stats
    total_recipients = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    opened_count = Column(Integer, default=0)
    clicked_count = Column(Integer, default=0)
    converted_count = Column(Integer, default=0)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    segment = relationship("CustomerSegment")
    recipients = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")


class CampaignRecipient(Base):
    __tablename__ = "marketing_campaign_recipients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("marketing_campaigns.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False)
    customer_nombre = Column(String(200))
    customer_telefono = Column(String(50))
    customer_email = Column(String(255))
    estado = Column(String(20), default="pendiente")
    # pendiente, enviado, entregado, abierto, convertido, fallido
    error_message = Column(Text)
    sent_at = Column(DateTime(timezone=True))
    opened_at = Column(DateTime(timezone=True))
    clicked_at = Column(DateTime(timezone=True))
    converted_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    campaign = relationship("MarketingCampaign", back_populates="recipients")


# ── Stock Alerts ────────────────────────────────────────────────

class StockAlertConfig(Base):
    __tablename__ = "marketing_stock_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    activo = Column(Boolean, default=True)
    notify_whatsapp = Column(Boolean, default=True)
    notify_email = Column(Boolean, default=False)
    last_notified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    __table_args__ = (
        sa.UniqueConstraint("company_id", "customer_id", "product_id", name="uq_stock_alert_customer_product"),
    )


# ── Personalized Offers ─────────────────────────────────────────

class CustomerOffer(Base):
    __tablename__ = "marketing_customer_offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("marketing_campaigns.id"), nullable=True)
    product_id = Column(UUID(as_uuid=True), nullable=True)
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text)
    tipo = Column(String(20), nullable=False)  # descuento, 2x1, bonificacion, combo
    valor = Column(Numeric(15, 2))
    codigo_cupon = Column(String(50))
    valido_desde = Column(DateTime(timezone=True))
    valido_hasta = Column(DateTime(timezone=True))
    usado = Column(Boolean, default=False)
    usado_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ── Satisfaction Surveys ────────────────────────────────────────

class SatisfactionSurvey(Base):
    __tablename__ = "marketing_surveys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    preguntas = Column(JSONB, nullable=False)
    # [{ "id": "q1", "tipo": "rating|si_no|multiple|texto", "pregunta": "...", "opciones": ["..."] }]
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class SurveyResponse(Base):
    __tablename__ = "marketing_survey_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    survey_id = Column(UUID(as_uuid=True), ForeignKey("marketing_surveys.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False)
    campaign_id = Column(UUID(as_uuid=True), nullable=True)
    respuestas = Column(JSONB, nullable=False)
    # { "q1": 5, "q2": "si", "q3": "Muy buen servicio" }
    created_at = Column(DateTime(timezone=True), default=_utcnow)
