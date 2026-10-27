from __future__ import annotations

from sqlalchemy import Column, String, Date, DateTime, Integer, Numeric, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from api.src.db import Base


class RouteSession(Base):
    __tablename__ = "route_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    cobrador_id = Column(UUID(as_uuid=True), nullable=False)
    route_id = Column(UUID(as_uuid=True), nullable=True)
    fecha = Column(Date, nullable=False)
    estado = Column(String(20), nullable=False, default="abierta")
    fondo_inicial = Column(Numeric(18, 0), nullable=False, default=0)
    fondo_sobrante = Column(Numeric(18, 0), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    # una sesion por caja/salida (no por cobrador+dia): caja del sistema viejo, viaje y quien la cerro
    legacy_caja_id = Column(Integer, nullable=True)
    trip_id = Column(UUID(as_uuid=True), nullable=True)
    closed_by = Column(UUID(as_uuid=True), nullable=True)

    __table_args__ = (
        Index("ix_route_sessions_company_fecha", "company_id", "fecha"),
        Index("ix_route_sessions_cobrador_fecha", "company_id", "cobrador_id", "fecha"),
    )


class RouteLiquidation(Base):
    __tablename__ = "route_liquidations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    route_session_id = Column(UUID(as_uuid=True), nullable=False)
    efectivo_declarado = Column(Numeric(18, 0), nullable=False, default=0)
    cheques_declarado = Column(Numeric(18, 0), nullable=False, default=0)
    pagares_declarado = Column(Numeric(18, 0), nullable=False, default=0)
    nc_aplicadas = Column(Numeric(18, 0), nullable=False, default=0)
    descuentos_autorizados = Column(Numeric(18, 0), nullable=False, default=0)
    efectivo_esperado = Column(Numeric(18, 0), nullable=False, default=0)
    total_cobrado_ar = Column(Numeric(18, 0), nullable=False, default=0)
    estado = Column(String(20), nullable=False, default="pendiente")
    supervisor_id = Column(UUID(as_uuid=True), nullable=True)
    observaciones = Column(Text, nullable=True)
    fecha_autorizacion = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class RouteLiquidationItem(Base):
    __tablename__ = "route_liquidation_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    liquidation_id = Column(UUID(as_uuid=True), nullable=False)
    # cheque, pagare, cobro, otro_ingreso, deposito, gasto, devolucion, dev_credito
    tipo = Column(String(20), nullable=False)
    numero = Column(String(50), nullable=False)
    banco = Column(String(100), nullable=True)
    monto = Column(Numeric(18, 0), nullable=False)
    customer_id = Column(UUID(as_uuid=True), nullable=True)
    vencimiento = Column(Date, nullable=True)


class BankDeposit(Base):
    __tablename__ = "bank_deposits"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    fecha = Column(Date, nullable=False)
    bank_name = Column(String(150), nullable=False)
    account_number = Column(String(50), nullable=False)
    monto_efectivo = Column(Numeric(18, 0), nullable=False, default=0)
    monto_cheques = Column(Numeric(18, 0), nullable=False, default=0)
    referencia = Column(String(100), nullable=True)
    route_liquidation_ids = Column(JSONB, nullable=False, server_default="[]")
    cash_session_ids = Column(JSONB, nullable=False, server_default="[]")
    observaciones = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("ix_bank_deposits_company_fecha", "company_id", "fecha"),
    )
