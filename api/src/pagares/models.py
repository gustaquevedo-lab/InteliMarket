from sqlalchemy import Column, String, Date, DateTime, Numeric, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class Pagare(Base):
    __tablename__ = "pagares"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    receivable_account_id = Column(UUID(as_uuid=True), nullable=True)
    numero_pagare = Column(String(30), nullable=False)
    monto_original = Column(Numeric(15, 0), nullable=False)
    saldo_pendiente = Column(Numeric(15, 0), nullable=False)
    fecha_emision = Column(Date(), nullable=False)
    fecha_vencimiento = Column(Date(), nullable=False)
    motivo = Column(Text(), nullable=True)
    estado = Column(String(20), nullable=False, default="vigente")
    cobrador_id = Column(UUID(as_uuid=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    payments = relationship("PagarePayment", back_populates="pagare", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_pagares_company_b", "company_id"),
        Index("ix_pagares_customer_b", "customer_id"),
    )


class PagarePayment(Base):
    __tablename__ = "pagare_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    pagare_id = Column(UUID(as_uuid=True), ForeignKey("pagares.id"), nullable=False, index=True)
    receivable_payment_id = Column(UUID(as_uuid=True), nullable=True)
    monto_aplicado = Column(Numeric(15, 0), nullable=False)
    fecha = Column(Date(), nullable=False)
    observaciones = Column(Text(), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    pagare = relationship("Pagare", back_populates="payments")
