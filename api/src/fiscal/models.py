"""Fiscal models — SIFEN, preimpresos, autoimpresores, NC/ND."""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class FiscalConfig(Base):
    """Per-tenant fiscal document configuration."""
    __tablename__ = "fiscal_config"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    modo_emision = Column(String(20), nullable=False, default="sifen")  # sifen, preimpreso, autoimpresor
    timbrado_id = Column(UUID(as_uuid=True), ForeignKey("sifen_timbrados.id"))
    punto_emision = Column(String(10), default="001")
    cert_p12_base64 = Column(Text, nullable=True)
    cert_password = Column(String(255), nullable=True)
    sifen_env = Column(String(20), default="test")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TimbradoUsage(Base):
    """Tracks which pre-printed invoice numbers from a timbrado have been used."""
    __tablename__ = "timbrado_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    timbrado_id = Column(UUID(as_uuid=True), ForeignKey("sifen_timbrados.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero_utilizado = Column(Integer, nullable=False)
    sale_id = Column(UUID(as_uuid=True))
    tipo_documento = Column(String(20), nullable=False)  # factura, nota_credito, nota_debito
    used_at = Column(DateTime(timezone=True), server_default=func.now())


class NotaCreditoDebito(Base):
    """Nota de Crédito / Nota de Débito."""
    __tablename__ = "notas_credito_debito"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # credito, debito
    numero = Column(String(20), nullable=False)
    cdc = Column(String(44))
    timbrado_numero = Column(String(20))
    numero_preimpreso = Column(String(20))
    motivo = Column(Text, nullable=False)

    # Montos
    subtotal = Column(Numeric(15, 0), nullable=False)
    descuento_total = Column(Numeric(15, 0), default=0)
    base_gravada_10 = Column(Numeric(15, 0), default=0)
    base_gravada_5 = Column(Numeric(15, 0), default=0)
    base_exenta = Column(Numeric(15, 0), default=0)
    iva_10 = Column(Numeric(15, 0), default=0)
    iva_5 = Column(Numeric(15, 0), default=0)
    total = Column(Numeric(15, 0), nullable=False)

    # SIFEN state
    sifen_estado = Column(String(20))
    sifen_xml_sent = Column(Text)
    sifen_xml_response = Column(Text)

    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente, emitido, rechazado
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sale = relationship("Sale", foreign_keys=[sale_id])

    __table_args__ = (
        {"extend_existing": True}
    )
