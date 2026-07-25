"""Caja (Cash Register) models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class CashRegister(Base):
    __tablename__ = "cash_registers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    branch_id = Column(UUID(as_uuid=True))
    nombre = Column(String(100), nullable=False)
    codigo = Column(String(20), nullable=False, unique=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashSession(Base):
    __tablename__ = "cash_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    register_id = Column(UUID(as_uuid=True), ForeignKey("cash_registers.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    monto_apertura = Column(Numeric(15, 0), nullable=False)
    fecha_apertura = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    fecha_cierre = Column(DateTime(timezone=True))
    monto_cierre = Column(Numeric(15, 0))
    estado = Column(String(20), nullable=False, default="abierta")
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashCount(Base):
    __tablename__ = "cash_counts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False)
    monto_efectivo = Column(Numeric(15, 0), nullable=False)
    monto_tarjeta = Column(Numeric(15, 0), default=0)
    monto_transferencia = Column(Numeric(15, 0), default=0)
    monto_cheque = Column(Numeric(15, 0), default=0)
    monto_otro = Column(Numeric(15, 0), default=0)
    monto_total = Column(Numeric(15, 0), nullable=False)
    diferencia = Column(Numeric(15, 0))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
