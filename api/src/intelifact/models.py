"""Configuracion de facturacion electronica InteliFact, por tenant -- listo
para el dia que un tenant necesite migrar de autoimpresor/preimpreso a
facturacion electronica real (ver fiscal_config.modo_emision). Modulo aparte
de api/src/sifen (el stub actual, autoimpresor-safe, que no se toca) y sin
ningun enganche a sales/service.py todavia -- deliberadamente inactivo hasta
que se decida activarlo."""

from sqlalchemy import Column, String, Boolean, Text, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class IntelifactConfig(Base):
    __tablename__ = "intelifact_configs"
    __table_args__ = (
        UniqueConstraint("company_id", name="uq_intelifact_config_company"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    enabled = Column(Boolean, nullable=False, default=False)  # false hasta el dia de la activacion

    # Identidad del emisor (hoy hardcodeada en Distribuidora, aca es config real por tenant)
    ruc = Column(String(20), nullable=True)
    dv = Column(String(2), nullable=True)
    razon_social = Column(String(255), nullable=True)
    nombre_fantasia = Column(String(255), nullable=True)
    actividad_economica = Column(String(255), nullable=True)
    direccion = Column(String(255), nullable=True)
    ciudad = Column(String(100), nullable=True)
    departamento = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    telefono = Column(String(50), nullable=True)

    # Timbrado electronico
    timbrado = Column(String(20), nullable=True)
    timbrado_inicio = Column(String(20), nullable=True)  # YYYY-MM-DD
    codigo_establecimiento = Column(String(10), nullable=True)
    codigo_punto_expedicion = Column(String(10), nullable=True)

    # Certificado y ambiente (nunca se devuelven en un GET -- ver service.sanitize_config)
    cert_p12_base64 = Column(Text, nullable=True)
    cert_password = Column(String(255), nullable=True)
    ambiente = Column(String(20), nullable=False, default="test")  # test | production

    # Donde vive el microservicio Node para este tenant (cada uno puede correr su propia instancia)
    service_base_url = Column(String(255), nullable=True)  # ej. http://localhost:3000

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
