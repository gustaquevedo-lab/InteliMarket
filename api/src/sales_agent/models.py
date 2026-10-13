"""Gerente de Ventas IA — corridas de diagnóstico y recomendaciones pendientes de aprobación.

Mismo patrón que finance_agent: modo solo-diagnóstico, el agente nunca ejecuta
una acción por su cuenta. Toda recomendación queda en estado "pending" hasta
que un humano la apruebe o rechace explícitamente.
"""

import uuid

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class SalesAgentRun(Base):
    __tablename__ = "sales_agent_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))
    model = Column(String(60))
    status = Column(String(20), default="running")  # running, completed, error
    diagnostico = Column(Text)
    contexto = Column(JSON)
    respuesta_cruda = Column(JSON)
    error_message = Column(Text)


class SalesRecommendation(Base):
    __tablename__ = "sales_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    run_id = Column(UUID(as_uuid=True), ForeignKey("sales_agent_runs.id"), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # oportunidad, alerta_caida, concentracion_cliente, estacionalidad, otro
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=False)
    entidad_relacionada = Column(String(200))  # ej. producto o cliente involucrado
    monto_relacionado = Column(String(120))
    requested_by = Column(String(20), default="ai_agent")
    approved_by = Column(UUID(as_uuid=True))
    status = Column(String(20), default="pending")  # pending, approved, rejected
    comments = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
