"""Dinelco transaction models"""

from sqlalchemy import Column, String, BigInteger, Integer, DateTime, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class DinelcoTransaction(Base):
    __tablename__ = "dinelco_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    order_id = Column(String(100), nullable=False, index=True)
    amount = Column(BigInteger, nullable=False)
    currency = Column(String(3), nullable=False, default="PYG")
    status = Column(String(20), nullable=False, default="pending")
    payment_id = Column(String(100), index=True)
    checkout_url = Column(Text)
    customer_email = Column(String(200))
    customer_name = Column(String(200))
    installments = Column(Integer, default=1)
    authorization_code = Column(String(50))
    card_last4 = Column(String(10))
    card_brand = Column(String(30))
    webhook_data = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
