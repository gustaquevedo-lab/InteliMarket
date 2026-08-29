"""Modelos para el Gerente Comercial IA — Casa Gonzalito Distribuidora"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float, Text, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from api.src.db import Base


class CommercialAgentRun(Base):
    __tablename__ = "commercial_agent_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    trigger_type = Column(String(50), default="manual")  # manual, scheduled, threshold
    kpis_snapshot = Column(JSON, default=dict)
    summary = Column(Text, default="")
    recommendations_count = Column(Integer, default=0)
    execution_time_seconds = Column(Float, default=0.0)


class CommercialRecommendation(Base):
    __tablename__ = "commercial_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    run_id = Column(UUID(as_uuid=True), ForeignKey("commercial_agent_runs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    categoria = Column(String(50), nullable=False)  # rebate_paresa, rentabilidad_linea, preventa_rutas, mix_productos, retencion_clientes
    titulo = Column(String(200), nullable=False)
    diagnostico = Column(Text, nullable=False)
    accion_propuesta = Column(Text, nullable=False)
    impacto_estimado_gs = Column(Float, default=0.0)
    urgencia = Column(String(20), default="media")  # alta, media, baja
    estado = Column(String(30), default="pendiente")  # pendiente, aprobada, rechazada, ejecutada

    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    detalles = Column(JSON, default=dict)
