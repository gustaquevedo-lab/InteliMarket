"""SPI QR models"""

from sqlalchemy import Column, String, BigInteger, DateTime, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class SpiTransaction(Base):
    __tablename__ = "spi_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    order_id = Column(String(100), nullable=False, index=True)
    amount = Column(BigInteger, nullable=False)
    currency = Column(String(3), nullable=False, default="PYG")
    status = Column(String(20), nullable=False, default="pending")
    qr_data = Column(Text)
    qr_image_base64 = Column(Text)
    merchant_name = Column(String(100))
    description = Column(String(255))
    customer_email = Column(String(200))
    customer_name = Column(String(200))
    bcp_transaction_id = Column(String(100))
    webhook_data = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
