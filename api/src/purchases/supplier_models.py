"""Supplier model"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo_persona = Column(String(20), nullable=False, default="juridica")
    ruc = Column(String(15), index=True)
    ci = Column(String(20))
    razon_social = Column(String(255), nullable=False)
    condicion_iva = Column(String(20))
    direccion = Column(Text)
    ciudad = Column(String(100))
    telefono = Column(String(20))
    email = Column(String(255))
    plazo_pago_dias = Column(Integer, default=0)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
