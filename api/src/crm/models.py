"""CRM models"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Numeric, Date, Time, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class Lead(Base):
    __tablename__ = "crm_leads"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    email = Column(String(200))
    telefono = Column(String(30))
    empresa = Column(String(200))
    fuente = Column(String(50), default="web")
    estado = Column(String(50), default="nuevo", index=True)
    puntaje = Column(Integer, default=0)
    notas = Column(Text)
    asignado_a = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Oportunidad(Base):
    __tablename__ = "crm_oportunidades"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("crm_leads.id"), nullable=True)
    nombre = Column(String(200), nullable=False)
    monto_estimado = Column(Numeric(15, 0), default=0)
    etapa = Column(String(50), default="lead", index=True)
    probabilidad = Column(Integer, default=0)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    fecha_cierre_estimada = Column(Date, nullable=True)
    notas = Column(Text)
    asignado_a = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Actividad(Base):
    __tablename__ = "crm_actividades"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    oportunidad_id = Column(UUID(as_uuid=True), ForeignKey("crm_oportunidades.id"), nullable=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("crm_leads.id"), nullable=True)
    tipo = Column(String(50), nullable=False)
    titulo = Column(String(300), nullable=False)
    descripcion = Column(Text)
    fecha = Column(Date, nullable=False, index=True)
    hora = Column(Time, nullable=True)
    duracion_min = Column(Integer, nullable=True)
    completada = Column(Boolean, default=False)
    asignado_a = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ActividadRealizada(Base):
    __tablename__ = "crm_actividades_realizadas"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    actividad_id = Column(UUID(as_uuid=True), ForeignKey("crm_actividades.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    fecha_ejecucion = Column(DateTime(timezone=True), server_default=func.now())
    notas = Column(Text)
