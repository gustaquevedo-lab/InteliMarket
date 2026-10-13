"""Models for Donation Campaigns, Donation Records and Liquidations"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class DonationCampaign(Base):
    __tablename__ = "donation_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False, default="Abre tu corazón", server_default="Abre tu corazón")
    ong_nombre = Column(String(200), nullable=False, default="Centro Amor y Esperanza", server_default="Centro Amor y Esperanza")
    ong_ruc = Column(String(50), nullable=True)
    ong_web = Column(String(255), nullable=False, default="www.centroamoresperanza.org", server_default="www.centroamoresperanza.org")
    slogan = Column(String(255), nullable=True, default="Ayudanos a ayudar", server_default="Ayudanos a ayudar")
    mensaje_ticket = Column(
        Text,
        nullable=False,
        default="¡Gracias por abrir tu corazón! Colaboraste con {monto} para el Centro Amor y Esperanza.",
        server_default="¡Gracias por abrir tu corazón! Colaboraste con {monto} para el Centro Amor y Esperanza."
    )
    meta_recaudacion_pyg = Column(Numeric(15, 0), nullable=False, default=20000000, server_default=text("20000000"))
    fecha_inicio = Column(DateTime(timezone=True), server_default=func.now())
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    activa = Column(Boolean, default=True, server_default=text("true"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    records = relationship("DonationRecord", back_populates="campaign", cascade="all, delete-orphan")
    liquidations = relationship("DonationLiquidation", back_populates="campaign", cascade="all, delete-orphan")


class DonationRecord(Base):
    __tablename__ = "donation_records"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=True)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    cajero_nombre = Column(String(100), nullable=True)
    campana_id = Column(UUID(as_uuid=True), ForeignKey("donation_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    
    monto_pyg = Column(Numeric(15, 0), nullable=False, default=0, server_default=text("0"))
    monto_total_venta_pyg = Column(Numeric(15, 0), nullable=False, default=0, server_default=text("0"))
    numero_comprobante = Column(String(50), nullable=True, index=True)
    tipo_origen = Column(String(50), default="redondeo_vuelto", server_default="redondeo_vuelto")
    estado = Column(String(20), default="recaudado", server_default="recaudado", nullable=False)  # recaudado | liquidado | anulado
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    campaign = relationship("DonationCampaign", back_populates="records")
    sale = relationship("Sale")


class DonationLiquidation(Base):
    """Acta y comprobante de entrega/transferencia formal de fondos a la ONG"""
    __tablename__ = "donation_liquidations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    campana_id = Column(UUID(as_uuid=True), ForeignKey("donation_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    
    monto_total_pyg = Column(Numeric(15, 0), nullable=False)
    cantidad_donaciones = Column(Integer, nullable=False, default=0)
    fecha_desde = Column(DateTime(timezone=True), nullable=False)
    fecha_hasta = Column(DateTime(timezone=True), nullable=False)
    numero_acta = Column(String(50), nullable=False, unique=True)
    
    entregado_por_nombre = Column(String(100), nullable=True)
    recibido_por_nombre = Column(String(100), nullable=True)
    recibido_por_ci = Column(String(50), nullable=True)
    comprobante_transferencia = Column(String(100), nullable=True)
    observaciones = Column(Text, nullable=True)
    estado = Column(String(20), default="entregado", server_default="entregado", nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("DonationCampaign", back_populates="liquidations")
