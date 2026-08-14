"""Credit account models"""

from sqlalchemy import Column, String, BigInteger, Boolean, Date, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class CustomerAdvance(Base):
    """Dinero que un cliente adelanta antes de tener una factura contra la
    cual aplicarlo — queda como saldo a favor disponible (Fase 5)."""
    __tablename__ = "customer_advances"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    monto_total = Column(Numeric(15, 0), nullable=False)
    monto_disponible = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), nullable=False, default="PYG")
    forma_pago = Column(String(30))
    referencia = Column(String(200))
    fecha = Column(Date, nullable=False, server_default=func.current_date())
    observaciones = Column(Text)
    registrado_por = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CustomerAdvanceApplication(Base):
    """Cuanto de un CustomerAdvance se aplico a que documento de AR."""
    __tablename__ = "customer_advance_applications"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    customer_advance_id = Column(UUID(as_uuid=True), ForeignKey("customer_advances.id"), nullable=False, index=True)
    accounts_receivable_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    monto = Column(Numeric(15, 0), nullable=False)
    aplicado_por = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CreditAccount(Base):
    __tablename__ = "credit_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, unique=True, index=True)
    limite_credito = Column(Numeric(15, 2), nullable=False, default=0)
    saldo_disponible = Column(Numeric(15, 2), nullable=False, default=0)
    saldo_utilizado = Column(Numeric(15, 2), nullable=False, default=0)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CreditMovement(Base):
    __tablename__ = "credit_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    credit_account_id = Column(UUID(as_uuid=True), ForeignKey("credit_accounts.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # compra, pago, ajuste, devolucion
    monto = Column(Numeric(15, 2), nullable=False)
    saldo_anterior = Column(Numeric(15, 2), nullable=False)
    saldo_nuevo = Column(Numeric(15, 2), nullable=False)
    referencia_type = Column(String(50))  # sale, payment, adjustment
    referencia_id = Column(UUID(as_uuid=True))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ReceivableWriteoffRequest(Base):
    """Baja de una factura incobrable (Fase 3) — requiere que Gerente Y
    Finanzas aprueben (dos personas reales, un rol no puede llenar los dos
    slots) antes de que el documento salga de la cartera pendiente."""
    __tablename__ = "receivable_writeoff_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    accounts_receivable_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    credit_account_id = Column(UUID(as_uuid=True))
    monto = Column(Numeric(15, 2), nullable=False)
    motivo = Column(Text, nullable=False)
    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente, aprobado, rechazado
    solicitado_por = Column(UUID(as_uuid=True))
    aprobado_gerente_id = Column(UUID(as_uuid=True))
    aprobado_gerente_at = Column(DateTime(timezone=True))
    aprobado_finanzas_id = Column(UUID(as_uuid=True))
    aprobado_finanzas_at = Column(DateTime(timezone=True))
    rechazado_por = Column(UUID(as_uuid=True))
    rechazado_at = Column(DateTime(timezone=True))
    rechazado_motivo = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CreditApprovalRequest(Base):
    """Venta a credito que excede el limite disponible del cliente, retenida
    hasta que Supervisor Y Gerente aprueben (cualquier orden, ambos slots
    deben llenarse) — la venta no se confirma ni descuenta stock hasta
    entonces."""
    __tablename__ = "credit_approval_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    credit_account_id = Column(UUID(as_uuid=True), ForeignKey("credit_accounts.id"), nullable=False)
    monto = Column(Numeric(15, 2), nullable=False)
    limite_credito = Column(Numeric(15, 2))
    saldo_disponible = Column(Numeric(15, 2))
    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente, aprobado, rechazado
    aprobado_supervisor_id = Column(UUID(as_uuid=True))
    aprobado_supervisor_at = Column(DateTime(timezone=True))
    aprobado_gerente_id = Column(UUID(as_uuid=True))
    aprobado_gerente_at = Column(DateTime(timezone=True))
    rechazado_por = Column(UUID(as_uuid=True))
    rechazado_at = Column(DateTime(timezone=True))
    rechazado_motivo = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
