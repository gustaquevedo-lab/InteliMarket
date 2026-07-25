from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Date
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from api.src.db import Base


class CommissionRule(Base):
    __tablename__ = "commission_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    tipo = Column(String(30), nullable=False)
    vendedor_id = Column(UUID(as_uuid=True))
    porcentaje = Column(Numeric(5, 2), nullable=False)
    aplica_a = Column(String(20), server_default="total")
    categoria_ids = Column(ARRAY(UUID))
    producto_ids = Column(ARRAY(UUID))
    monto_minimo = Column(Numeric(15, 0))
    monto_maximo = Column(Numeric(15, 0))
    valido_desde = Column(Date)
    valido_hasta = Column(Date)
    activo = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SalesCommission(Base):
    __tablename__ = "sales_commissions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    rule_id = Column(UUID(as_uuid=True))
    sale_id = Column(UUID(as_uuid=True), index=True)
    vendedor_id = Column(UUID(as_uuid=True), index=True)
    base_calculo = Column(Numeric(15, 0), nullable=False)
    porcentaje = Column(Numeric(5, 2), nullable=False)
    monto_comision = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), server_default="PYG")
    estado = Column(String(20), server_default="calculada")
    fecha_pago = Column(Date)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
