"""SIFEN models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class SifenTimbrado(Base):
    __tablename__ = "sifen_timbrados"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(20), nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    rango_desde = Column(Integer, nullable=False)
    rango_hasta = Column(Integer, nullable=False)
    tipo_comprobante = Column(String(20))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SifenResponse(Base):
    __tablename__ = "sifen_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    sale_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    cdc = Column(String(44), index=True)
    estado = Column(String(20), nullable=False)
    codigo_error = Column(String(10))
    mensaje_error = Column(Text)
    xml_sent = Column(Text)
    xml_response = Column(Text)
    fecha_envio = Column(DateTime(timezone=True), server_default=func.now())
    fecha_respuesta = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
