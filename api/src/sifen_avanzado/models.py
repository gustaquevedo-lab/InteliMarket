from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, Date, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from api.src.db import Base


class DgrVehicle(Base):
    __tablename__ = "dgr_vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    patente = Column(String(10), nullable=False, index=True)
    marca = Column(String(50), nullable=False)
    modelo = Column(String(50), nullable=False)
    anio = Column(Integer, nullable=False)
    tipo = Column(String(30), nullable=False)
    chasis = Column(String(50))
    motor = Column(String(50))
    capacidad_toneladas = Column(Numeric(8, 2))
    propietario = Column(String(200))
    ruc_propietario = Column(String(20))
    color = Column(String(30))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "patente", name="uq_dgr_vehicle_patente"),
    )


class EkuatiaDocument(Base):
    __tablename__ = "ekuatia_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), index=True)
    tipo_documento = Column(String(30), nullable=False)
    nombre_original = Column(String(300), nullable=False)
    archivo_path = Column(String(500))
    hash_sha256 = Column(String(64))
    validez_legal = Column(Boolean, default=False)
    fecha_digitalizacion = Column(DateTime(timezone=True), server_default=func.now())
    document_metadata = Column("metadata", JSON)
    uploaded_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CdcValidationLog(Base):
    __tablename__ = "cdc_validation_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    cdc = Column(String(44), nullable=False)
    valido = Column(Boolean)
    request_data = Column(JSON)
    response_data = Column(JSON)
    codigo_error = Column(String(50))
    mensaje_error = Column(String(500))
    fecha_consulta = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class IvaBookConfig(Base):
    __tablename__ = "iva_book_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    regimen = Column(String(30), default="general")
    periodicidad = Column(String(10), default="mensual")
    ultimo_periodo_generado = Column(String(7))
    exportar_con_desglose = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DgrReportGenerated(Base):
    __tablename__ = "dgr_report_generated"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    periodo = Column(String(7), nullable=False)
    tipo = Column(String(20), nullable=False)
    archivo_path = Column(String(500))
    cantidad_vehiculos = Column(Integer, default=0)
    monto_total_impuesto = Column(Numeric(15, 0))
    fecha_generacion = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
