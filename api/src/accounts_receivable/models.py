"""Accounts receivable models"""

from sqlalchemy import Column, String, Boolean, DateTime, Date, Numeric, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class Account(Base):
    __tablename__ = "accounts_receivable"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True))
    numero_documento = Column(String(50))
    fecha_emision = Column(DateTime(timezone=True))
    fecha_vencimiento = Column(Date)
    moneda = Column(String(3), default="PYG")
    monto_original = Column(Numeric(15, 0), default=0)
    saldo_pendiente = Column(Numeric(15, 0), default=0)
    tipo = Column(String(20))
    estado = Column(String(30), default="pendiente")
    dias_mora = Column(Numeric(10, 0), default=0)
    ultimo_pago = Column(DateTime(timezone=True))
    notas_cobranza = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    corporate_remission_id = Column(UUID(as_uuid=True), ForeignKey("ar_corporate_remissions.id"))
    remitido_empresa_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_accounts_receivable_company", "company_id"),
        Index("ix_accounts_receivable_customer", "customer_id"),
        Index("ix_accounts_receivable_remission", "corporate_remission_id"),
    )


class CorporateRemission(Base):
    """Lote consolidado de corte mensual enviado a empresas vinculadas para descuento
    por nómina de funcionarios (Extra Club). Al remitirse, la titularidad de cobro
    pasa a la empresa vinculada y se libera la línea de crédito a los funcionarios."""
    __tablename__ = "ar_corporate_remissions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    empresa_customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"))
    empresa_vinculada_nombre = Column(String(255), nullable=False)
    empresa_vinculada_ruc = Column(String(20))
    numero_remision = Column(String(50), nullable=False)
    periodo_mes = Column(String(7), nullable=False)  # ej: 2026-09
    fecha_corte = Column(Date, nullable=False)
    fecha_remision = Column(Date, nullable=False)
    monto_total = Column(Numeric(15, 0), nullable=False, default=0)
    saldo_pendiente = Column(Numeric(15, 0), nullable=False, default=0)
    cantidad_funcionarios = Column(Numeric(10, 0), default=0)
    cantidad_documentos = Column(Numeric(10, 0), default=0)
    estado = Column(String(30), nullable=False, default="REMITIDO")  # REMITIDO | PAGADO_PARCIAL | PAGADO
    recibido_por = Column(String(150))
    fecha_recepcion = Column(Date)
    notas = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_ar_corporate_remissions_company_empresa", "company_id", "empresa_vinculada_nombre"),
    )


class ReceivablePayment(Base):
    """Pago real de un cliente contra cuentas por cobrar — a diferencia del
    pago atado a una sola venta (api.src.sales), este vive en el modulo de AR
    y puede repartirse entre varios documentos del mismo cliente con un solo
    pago, que es como se cobra en la realidad (el cliente paga un monto
    redondo que rara vez coincide con una sola factura)."""
    __tablename__ = "receivable_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    monto_total = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), nullable=False, server_default="PYG")
    forma_pago = Column(String(30))
    referencia = Column(String(200))
    fecha = Column(Date, nullable=False, server_default=func.current_date())
    observaciones = Column(Text)
    registrado_por = Column(UUID(as_uuid=True))
    bank_account_id = Column(UUID(as_uuid=True))
    cheque_id = Column(UUID(as_uuid=True))
    caja_session_id = Column(UUID(as_uuid=True))
    vault_entry_id = Column(UUID(as_uuid=True))
    destino_fondos = Column(String(30))  # boveda | caja | banco
    numero_recibo = Column(String(50), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_receivable_payments_company", "company_id"),
        Index("ix_receivable_payments_customer", "customer_id"),
    )


class ReceivablePaymentAllocation(Base):
    """Cuanto de un ReceivablePayment se aplico a cada documento puntual —
    el rastro de auditoria que antes no existia: el modulo de AR solo
    decrementaba saldo_pendiente en el lugar, sin dejar ningun registro de
    los pagos parciales individuales."""
    __tablename__ = "receivable_payment_allocations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    receivable_payment_id = Column(UUID(as_uuid=True), ForeignKey("receivable_payments.id"), nullable=False, index=True)
    accounts_receivable_id = Column(UUID(as_uuid=True), ForeignKey("accounts_receivable.id"), nullable=False, index=True)
    monto = Column(Numeric(15, 0), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

