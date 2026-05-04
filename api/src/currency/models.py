"""Currency models"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class Currency(Base):
    __tablename__ = "currencies"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    codigo = Column(String(3), nullable=False)
    nombre = Column(String(50), nullable=False)
    simbolo = Column(String(5))
    activa = Column(Boolean, default=True)
    es_moneda_local = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    moneda = Column(String(3), nullable=False)
    tasa_compra = Column(Numeric(10, 2))
    tasa_venta = Column(Numeric(10, 2))
    fuente = Column(String(20), default="bcp")
    fecha = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
