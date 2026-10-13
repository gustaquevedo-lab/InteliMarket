"""Configuracion centralizada de integraciones de medios de pago (Bancard,
PlugPay, y las que se agreguen despues) -- pensada para que un admin la
gestione desde la pantalla de Integraciones, sin tocar codigo ni localStorage
por maquina."""

from sqlalchemy import Column, String, Boolean, DateTime, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class PaymentIntegrationConfig(Base):
    __tablename__ = "payment_integration_configs"
    __table_args__ = (
        UniqueConstraint("company_id", "provider", "environment", name="uq_payment_integration_company_provider_env"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    provider = Column(String(30), nullable=False)  # bancard, plugpay
    environment = Column(String(20), nullable=False, default="sandbox")  # sandbox, production
    enabled = Column(Boolean, nullable=False, default=True)
    config = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
