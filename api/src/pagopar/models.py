from sqlalchemy import Column, String, BigInteger, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class PagoparTransaction(Base):
    __tablename__ = "pagopar_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    order_id = Column(String(100), nullable=False, index=True)
    amount = Column(BigInteger, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    payment_method = Column(String(50))
    card_brand = Column(String(50))
    card_last4 = Column(String(4))
    customer_email = Column(String(200), nullable=False)
    customer_name = Column(String(200), nullable=False)
    checkout_url = Column(Text)
    pagopar_id = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
