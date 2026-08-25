"""Integrations models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class IntegrationConfig(Base):
    __tablename__ = "integration_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    app_name = Column(String(50), nullable=False)
    webhook_url = Column(String(500), nullable=False)
    api_key = Column(String(200))
    hmac_secret = Column(String(200))
    enabled = Column(Boolean, default=True)
    config = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class IntegrationDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    config_id = Column(UUID(as_uuid=True), ForeignKey("integration_configs.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    payload = Column(JSON, nullable=False)
    response_status = Column(String(10))
    response_body = Column(Text)
    success = Column(Boolean, default=False)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PosTerminalClaim(Base):
    """Registra qué transacción real de fin_operacao_pos (Bancard/Dinelco,
    MySQL de Ñemuha) ya fue usada para verificar un cobro de InteliMarket
    -- evita que la misma transacción física se le asigne por error a dos
    ventas distintas si coinciden en monto y ventana de tiempo."""
    __tablename__ = "pos_terminal_claims"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    fin_operacao_pos_id = Column(String(30), nullable=False, unique=True)
    sale_id = Column(UUID(as_uuid=True))
    procesador = Column(String(20), nullable=False)
    monto = Column(Integer, nullable=False)
    voucher = Column(String(60))
    tarjeta_marca = Column(String(200))
    claimed_at = Column(DateTime(timezone=True), server_default=func.now())
