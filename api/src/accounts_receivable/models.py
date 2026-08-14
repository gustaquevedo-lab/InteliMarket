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
    saldo = Column(Numeric(15, 0), default=0)
    limite_credito = Column(Numeric(15, 0), default=0)
    activo = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_accounts_receivable_company", "company_id"),
        Index("ix_accounts_receivable_customer", "customer_id"),
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
