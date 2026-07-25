"""Kuapay models"""

from sqlalchemy import Column, String, BigInteger, DateTime, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class KuapayTransaction(Base):
    __tablename__ = "kuapay_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    order_id = Column(String(100), nullable=False, index=True)
    amount = Column(BigInteger, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    payment_method = Column(String(50))
    qr_code = Column(Text)
    qr_image_url = Column(Text)
    checkout_url = Column(Text)
    customer_email = Column(String(200), nullable=False)
    customer_name = Column(String(200), nullable=False)
    customer_phone = Column(String(20))
    customer_ci = Column(String(20))
    kuapay_id = Column(String(100))
    webhook_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
