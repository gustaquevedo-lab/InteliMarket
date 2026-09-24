"""Models for Institutional Vouchers (Vales Institucionales / Convenios)"""

from sqlalchemy import Column, String, DateTime, Date, Numeric, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class InstitutionalVoucher(Base):
    """Control unitario de vales físicos prepagados para convenios institucionales
    (ej: Universidad del Pacífico). Permite validación ultrarrápida en caja por
    código de barras, trazabilidad de canje y prevención de doble uso."""
    __tablename__ = "institutional_vouchers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Datos del Convenio / Institución
    convenio_nombre = Column(String(150), nullable=False, index=True)  # ej: "Universidad del Pacífico"
    cliente_ruc = Column(String(30), nullable=True, index=True)
    cliente_razon_social = Column(String(255), nullable=True)
    factura_emision_numero = Column(String(50), nullable=True)  # Factura Exenta madre

    # Identificación del Vale
    numero_vale = Column(String(50), nullable=False, index=True)   # ej: "001", "002"
    codigo_barras = Column(String(100), nullable=False, index=True) # Lo que lee la pistola láser

    # Montos y vigencia
    monto_inicial = Column(Numeric(15, 0), nullable=False, default=100000)
    saldo_disponible = Column(Numeric(15, 0), nullable=False, default=100000)
    fecha_vencimiento = Column(Date, nullable=False)
    
    # Estado: ACTIVO | CANJEADO | ANULADO | VENCIDO
    estado = Column(String(30), nullable=False, default="ACTIVO", index=True)
    beneficiario_nombre = Column(String(255), nullable=True)

    # Trazabilidad de Canje en Caja
    canjeado_en_sale_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    canjeado_en_caja_session_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    canjeado_at = Column(DateTime(timezone=True), nullable=True)
    canjeado_por_usuario_id = Column(UUID(as_uuid=True), nullable=True)
    canjeado_caja_numero = Column(String(50), nullable=True)
    notas = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_vouchers_company_convenio", "company_id", "convenio_nombre"),
        Index("ix_vouchers_company_barcode", "company_id", "codigo_barras"),
        Index("ix_vouchers_company_numero", "company_id", "numero_vale"),
    )
