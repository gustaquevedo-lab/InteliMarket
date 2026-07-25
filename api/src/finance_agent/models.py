"""Gerente Financiero IA — corridas de diagnóstico y recomendaciones pendientes de aprobación.

Modo solo-diagnóstico (acordado con el cliente): el agente nunca ejecuta una
acción por su cuenta. Toda recomendación queda en estado "pending" hasta que
un humano la apruebe o rechace explícitamente — mismo patrón que
smart_pricing.PriceChangeRequest.
"""

import uuid

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class FinanceAgentRun(Base):
    __tablename__ = "finance_agent_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))
    model = Column(String(60))
    status = Column(String(20), default="running")  # running, completed, error
    diagnostico = Column(Text)  # resumen en texto plano para mostrar en el dashboard
    contexto = Column(JSON)  # snapshot de los datos que se le pasaron al modelo (auditoría)
    respuesta_cruda = Column(JSON)  # respuesta completa de Claude, para trazabilidad
    error_message = Column(Text)


class FinanceRecommendation(Base):
    __tablename__ = "finance_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    run_id = Column(UUID(as_uuid=True), ForeignKey("finance_agent_runs.id"), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # cobranza, pago_proveedor, alerta_stock, presupuesto, otro
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=False)
    entidad_relacionada = Column(String(200))  # ej. nombre del cliente/proveedor involucrado
    monto_relacionado = Column(String(120))  # texto formateado, puede incluir varias monedas — no se opera aritméticamente sobre esto
    requested_by = Column(String(20), default="ai_agent")
    approved_by = Column(UUID(as_uuid=True))
    status = Column(String(20), default="pending")  # pending, approved, rejected
    comments = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
