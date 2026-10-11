"""Gerente Financiero IA — corridas de diagnóstico y recomendaciones pendientes de aprobación.

Modo solo-diagnóstico (acordado con el cliente): el agente nunca ejecuta una
acción por su cuenta. Toda recomendación queda en estado "pending" hasta que
un humano la apruebe o rechace explícitamente — mismo patrón que
smart_pricing.PriceChangeRequest.
"""

import uuid

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base
from api.src.companies.models import Company


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
    tipo = Column(String(30), nullable=False)  # cobranza, pago_proveedor, alerta_presupuesto, otro (generadas por IA) | arqueo_caja, deposito_pendiente (generadas por reglas del sistema)
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


class FinanceAgentSetting(Base):
    __tablename__ = "finance_agent_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    colchon_minimo_bancos_gs = Column(Numeric(14, 2), nullable=False, default=50000000.00)
    dias_alerta_mora = Column(Integer, nullable=False, default=15)
    limite_pago_diario_sin_autorizacion_gs = Column(Numeric(14, 2), nullable=False, default=20000000.00)
    prioridad_pagos = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InterAgentDirective(Base):
    __tablename__ = "inter_agent_directives"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50), nullable=False)
    emisor = Column(String(50), nullable=False, index=True)  # cfo_agent, sales_agent, marketing_agent, etc.
    receptor = Column(String(50), nullable=False, index=True)
    titulo = Column(String(255), nullable=False)
    mensaje = Column(Text, nullable=False)
    accion_sugerida = Column(String(100))
    prioridad = Column(String(20), nullable=False, default="alta")  # critica, alta, media, baja
    estado = Column(String(30), nullable=False, default="emitida", index=True)  # emitida, leida, en_progreso, completada, rechazada
    payload = Column(JSON, default=dict)
    impacto_estimado_gs = Column(Numeric(14, 2), default=0.00)
    impacto_real_recaudado_gs = Column(Numeric(14, 2), default=0.00)
    feedback_receptor = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CashFlowScenario(Base):
    __tablename__ = "cash_flow_scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text)
    parametros = Column(JSON, nullable=False, default=dict)
    resultado_30d = Column(JSON, nullable=False, default=dict)
    creado_por = Column(String(100), default="cfo_agent")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

