"""Credit account models"""

from sqlalchemy import Column, String, BigInteger, Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


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
