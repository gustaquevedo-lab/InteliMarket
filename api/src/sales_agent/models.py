"""Gerente de Ventas IA — corridas de diagnóstico y recomendaciones pendientes de aprobación.

Mismo patrón que finance_agent: modo solo-diagnóstico, el agente nunca ejecuta
una acción por su cuenta. Toda recomendación queda en estado "pending" hasta
que un humano la apruebe o rechace explícitamente.
"""

import uuid

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Numeric, Boolean
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

class SalesAgentSetting(Base):
    __tablename__ = "sales_agent_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    target_margen_minimo_pct = Column(Numeric(5, 2), nullable=False, default=20.00)
    target_margen_ideal_pct = Column(Numeric(5, 2), nullable=False, default=24.00)
    metas_por_categoria = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CompanyBusinessRule(Base):
    __tablename__ = "company_business_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    regla = Column(Text, nullable=False)
    categoria = Column(String(100))
    origen = Column(String(50), default="usuario_decision")
    activa = Column(Boolean, default=True)
    confianza = Column(Numeric(3, 2), default=1.00)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CompanyKviProduct(Base):
    __tablename__ = "company_kvi_products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    es_gancho = Column(Boolean, default=True)
    margen_techo_pct = Column(Numeric(5, 2), default=15.00)
    motivo_gancho = Column(Text, default="Producto ancla de atraccion de clientes")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SalesActionTask(Base):
    __tablename__ = "sales_action_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    titulo = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=False)
    area = Column(String(100), nullable=False)
    prioridad = Column(String(20), nullable=False, default="alta")
    estado = Column(String(30), nullable=False, default="pendiente", index=True)
    tipo_accion = Column(String(50), nullable=False)
    payload_accion = Column(JSON, default=dict)
    responsable_sugerido = Column(String(150))
    impacto_estimado = Column(String(100))
    motivo_descarte = Column(Text)
    completado_por = Column(String(150))
    fecha_limite = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PriceAuditLog(Base):
    __tablename__ = "price_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    precio_anterior = Column(Numeric(14, 2), nullable=False)
    precio_nuevo = Column(Numeric(14, 2), nullable=False)
    costo_unitario_momento = Column(Numeric(14, 2), nullable=False)
    margen_anterior_pct = Column(Numeric(5, 2))
    margen_nuevo_pct = Column(Numeric(5, 2))
    motivo = Column(Text)
    aplicado_por = Column(String(150), default="gerente_ventas_ia")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

