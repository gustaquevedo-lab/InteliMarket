"""Inteliforce (app de campo unificada con SueldOK) — modelos"""

from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
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
