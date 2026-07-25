from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, Date, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from api.src.db import Base


class WithholdingConfig(Base):
    __tablename__ = "withholding_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False)
    tipo = Column(String(10), nullable=False)
    activo = Column(Boolean, default=True)
    categoria = Column(String(30))
    tasa = Column(Numeric(5, 2), nullable=False)
    base_minima = Column(Numeric(15, 0), default=0)
    exento_hasta = Column(Numeric(15, 0), default=0)
    regimen = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "supplier_id", "tipo", name="uq_withholding_supplier_tipo"),
    )


class WithholdingDocument(Base):
    __tablename__ = "withholding_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    invoice_id = Column(UUID(as_uuid=True), nullable=False)
    tipo = Column(String(10), nullable=False)
    numero_documento = Column(String(30))
    cdc = Column(String(64))
    fecha_emision = Column(Date, nullable=False, server_default=func.current_date())
    periodo_fiscal = Column(String(7), nullable=False)
    base_imponible = Column(Numeric(15, 0), nullable=False)
    tasa = Column(Numeric(5, 2), nullable=False)
    monto_retenido = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    estado = Column(String(20), default="pendiente")
    xml_enviado = Column(Text)
    xml_respuesta = Column(Text)
    fecha_envio_sifen = Column(DateTime(timezone=True))
    fecha_respuesta_sifen = Column(DateTime(timezone=True))
    notas = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "numero_documento", name="uq_withholding_doc_numero"),
    )


class AccountPlan(Base):
    __tablename__ = "account_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(20), nullable=False)
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(20), nullable=False)
    nivel = Column(Integer, default=1)
    padre_id = Column(UUID(as_uuid=True), ForeignKey("account_plans.id"))
    acepta_asientos = Column(Boolean, default=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "codigo", name="uq_account_plan_codigo"),
    )

    hijos = relationship("AccountPlan", backref="padre", remote_side=[id], cascade="all")


class AccountingPeriod(Base):
    __tablename__ = "accounting_periods"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    anio = Column(Integer, nullable=False)
    mes = Column(Integer, nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    estado = Column(String(20), nullable=False, default="abierto")
    fecha_apertura = Column(DateTime(timezone=True), server_default=func.now())
    fecha_cierre = Column(DateTime(timezone=True))
    cerrado_por = Column(UUID(as_uuid=True))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "anio", "mes", name="uq_accounting_period"),
    )


class AccountingEntry(Base):
    __tablename__ = "accounting_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    period_id = Column(UUID(as_uuid=True), ForeignKey("accounting_periods.id"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("account_plans.id"), nullable=False)
    fecha = Column(Date, nullable=False, server_default=func.current_date())
    tipo = Column(String(10), nullable=False)
    monto = Column(Numeric(15, 0), nullable=False)
    concepto = Column(String(300))
    referencia_tipo = Column(String(30))
    referencia_id = Column(UUID(as_uuid=True))
    asiento_numero = Column(String(20))
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    period = relationship("AccountingPeriod", backref="entries")
    account = relationship("AccountPlan", backref="entries")


class CollectionAction(Base):
    __tablename__ = "collection_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    receivable_id = Column(UUID(as_uuid=True))
    tipo = Column(String(30), nullable=False)
    fecha = Column(Date, nullable=False, server_default=func.current_date())
    resultado = Column(String(30))
    notas = Column(Text)
    contacto = Column(String(100))
    proximo_contacto = Column(Date)
    compromiso_pago = Column(Date)
    monto_comprometido = Column(Numeric(15, 0))
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CustomerScore(Base):
    __tablename__ = "customer_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False)
    score = Column(Integer, default=100)
    pago_puntual = Column(Numeric(5, 2), default=100.0)
    dias_mora_promedio = Column(Numeric(6, 1), default=0)
    antiguedad_dias = Column(Integer, default=0)
    total_compras = Column(Numeric(15, 0), default=0)
    total_pagos = Column(Numeric(15, 0), default=0)
    veces_mora = Column(Integer, default=0)
    ultima_actualizacion = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "customer_id", name="uq_customer_score_company"),
    )
