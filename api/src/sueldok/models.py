"""SueldOK integration models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class SueldokSyncConfig(Base):
    __tablename__ = "sueldok_sync_config"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    api_url = Column(String(500), nullable=False)
    api_key = Column(String(200))
    enabled = Column(Boolean, default=True)
    commission_rate = Column(Numeric(5, 2), default=2.00)
    auto_sync = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LaborSettlement(Base):
    __tablename__ = "labor_settlements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id = Column(String(100), nullable=False, index=True)
    employee_nombre = Column(String(150), nullable=False)
    employee_ci = Column(String(50))
    employee_cargo = Column(String(100))
    fecha_ingreso = Column(DateTime)
    fecha_salida = Column(DateTime, nullable=False)
    motivo = Column(String(100), nullable=False, default="despido_injustificado")
    salario_base = Column(Numeric(15, 0), nullable=False, default=0)
    dias_trabajados_mes = Column(Numeric(5, 0), default=0)
    monto_dias_trabajados = Column(Numeric(15, 0), default=0)
    vacaciones_monto = Column(Numeric(15, 0), default=0)
    aguinaldo_proporcional = Column(Numeric(15, 0), default=0)
    preaviso = Column(Numeric(15, 0), default=0)
    indemnizacion_legal = Column(Numeric(15, 0), default=0)
    descuentos_varios = Column(Numeric(15, 0), default=0)
    total_liquidacion_neta = Column(Numeric(15, 0), nullable=False, default=0)
    payment_order_id = Column(UUID(as_uuid=True), index=True)
    estado = Column(String(30), nullable=False, default="pendiente")
    observaciones = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
