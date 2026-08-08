"""Inteliforce (app de campo unificada con SueldOK) — modelos"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from api.src.db import Base


class InteliforceServiceKey(Base):
    """Credencial de servidor-a-servidor que SueldOK usa para canjear la cedula
    de un empleado por un JWT corto de Intelimarket. Analogo a company.systemApiKey
    del lado de SueldOK, pero es la propia de Intelimarket — no se comparte la
    misma clave, cada sistema valida la del otro con la suya."""

    __tablename__ = "inteliforce_service_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    api_key = Column(String(100), nullable=False, unique=True, index=True)
    nombre = Column(String(100))
    activo = Column(Boolean, default=True)
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InteliforceSyncRecord(Base):
    """Espejo generico en Postgres de eventos de campo que hoy viven en
    Convex (tracking GPS, visitas, asistencia) — historial completo para
    siempre, aunque Convex purgue lo viejo semanalmente. Sin esquema rigido
    por tipo todavia: se especializa cuando el patron de uso real lo pida."""

    __tablename__ = "inteliforce_sync_records"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    record_type = Column(String(30), nullable=False, index=True)  # tracking_log | visit | attendance
    convex_id = Column(String(50), nullable=False)
    employee_convex_id = Column(String(50), index=True)
    recorded_at = Column(DateTime(timezone=True))
    payload = Column(JSONB, nullable=False)
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("record_type", "convex_id", name="uq_inteliforce_sync_record"),
    )
