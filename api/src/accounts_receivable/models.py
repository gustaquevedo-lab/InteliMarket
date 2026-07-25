"""Accounts receivable models"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Index
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
