"""Impresión de etiquetas: config de impresoras (Pantum rollo 3 columnas /
Zebra ZPL) y plantillas de campos por tipo. La config de conexión del Zebra
soporta tanto QZ Tray (impresora USB local en la PC de depósito, hoy) como
TCP directo (cuando pase a estar en red) -- ver api/src/label_printing/service.py."""

from sqlalchemy import Column, String, Boolean, Integer, Numeric, DateTime, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class LabelPrinterConfig(Base):
    __tablename__ = "label_printer_configs"
    __table_args__ = (
        UniqueConstraint("company_id", "tipo", name="uq_label_printer_company_tipo"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # pantum_rollo, zebra_zpl
    nombre = Column(String(100), nullable=False)
    conexion = Column(String(20), nullable=True)  # solo zebra: qz_tray, red_tcp
    qz_printer_name = Column(String(200), nullable=True)
    host = Column(String(100), nullable=True)
    puerto_tcp = Column(Integer, nullable=True)
    ancho_mm = Column(Numeric(6, 2), nullable=False)
    alto_mm = Column(Numeric(6, 2), nullable=False)
    columnas = Column(Integer, nullable=False, default=1)
    activa = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LabelTemplate(Base):
    __tablename__ = "label_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo_impresora = Column(String(20), nullable=False)  # pantum_rollo, zebra_zpl
    nombre = Column(String(100), nullable=False)
    es_default = Column(Boolean, nullable=False, default=False)
    campos = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
