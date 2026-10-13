"""Fixed Assets (Activos Fijos) models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, Integer, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class FixedAsset(Base):
    """Depreciación en línea recta: (valor_adquisicion - valor_residual) /
    vida_util_meses cada mes, posteada como asiento real via create_manual_entry
    de Contabilidad Integrada. ultima_depreciacion_periodo evita postear dos
    veces el mismo mes si el job corre más de una vez."""
    __tablename__ = "fixed_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    categoria = Column(String(100))
    fecha_adquisicion = Column(Date, nullable=False)
    valor_adquisicion = Column(Numeric(15, 0), nullable=False)
    valor_residual = Column(Numeric(15, 0), nullable=False, default=0)
    vida_util_meses = Column(Integer, nullable=False)
    meses_depreciados = Column(Integer, nullable=False, default=0)
    depreciacion_acumulada = Column(Numeric(15, 0), nullable=False, default=0)
    estado = Column(String(20), nullable=False, default="activo")  # activo | dado_de_baja
    fecha_baja = Column(Date)
    motivo_baja = Column(Text)
    ultima_depreciacion_periodo = Column(String(7))  # "YYYY-MM"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
