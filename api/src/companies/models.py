"""Company model"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    ruc = Column(String(15), unique=True, nullable=False, index=True)
    razon_social = Column(String(255), nullable=False)
    nombre_fantasia = Column(String(255))
    actividad_principal = Column(String(255))
    regimen_tributario = Column(String(50), nullable=False)
    iva_condition = Column(String(20), nullable=False)
    direccion = Column(Text)
    ciudad = Column(String(100))
    departamento = Column(String(100))
    telefono = Column(String(20))
    email = Column(String(255))
    logo_url = Column(Text)
    timbrado_numero = Column(String(20))
    timbrado_vigencia_desde = Column(DateTime(timezone=True))
    timbrado_vigencia_hasta = Column(DateTime(timezone=True))
    sifen_enabled = Column(Boolean, default=False)
    sifen_cert_path = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
