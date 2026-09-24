"""Scale integration models — config, weight logs, PLU sync, label templates"""

from decimal import Decimal
import enum

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, Integer, ForeignKey, Index, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from api.src.db import Base


class ConnectionType(str, enum.Enum):
    serial = "serial"
    tcp = "tcp"
    usb_hid = "usb_hid"
    wifi = "wifi"


class ScaleBrand(str, enum.Enum):
    balmak = "balmak"
    toledo = "toledo"
    filizola = "filizola"
    jundiai = "jundiai"
    lider = "lider"
    digitron = "digitron"
    rinnert = "rinnert"
    generic = "generic"


class ScaleProtocol(str, enum.Enum):
    toledo_p03 = "toledo_p03"
    filizola = "filizola"
    rinnert = "rinnert"
    balmak_sdl = "balmak_sdl"
    modbus_rtu = "modbus_rtu"
    digitron = "digitron"
    generic_ascii = "generic_ascii"
    usb_hid_pos = "usb_hid_pos"


class ScaleConfig(Base):
    __tablename__ = "scale_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    marca = Column(String(20), nullable=False)
    modelo = Column(String(100))
    protocolo = Column(String(20), nullable=False)
    conexion = Column(String(20), nullable=False)

    # Serial params
    puerto_com = Column(String(20))
    baudrate = Column(Integer, default=9600)
    data_bits = Column(Integer, default=8)
    paridad = Column(String(10), default="N")
    stop_bits = Column(String(5), default="1")
    handshaking = Column(String(20))

    # TCP/Wi-Fi params
    host = Column(String(255))
    puerto_tcp = Column(Integer, default=9000)
    timeout_segundos = Column(Integer, default=5)

    # USB HID
    vendor_id = Column(String(10))
    product_id = Column(String(10))

    # SDL / file-based
    ruta_carga = Column(String(500))
    sync_automatico = Column(Boolean, default=False)
    categorias_ids = Column(JSONB, nullable=False, default=list, server_default="[]", comment="IDs de product_categories que esta balanza recibe via PLU sync; vacio = todas")

    # Label defaults
    etiqueta_formato = Column(String(50), default="40x30")
    etiqueta_cabecera = Column(String(200))

    activa = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_scale_configs_company", "company_id"),
    )


class ScaleWeightLog(Base):
    __tablename__ = "scale_weight_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    scale_id = Column(UUID(as_uuid=True), ForeignKey("scale_configs.id"), nullable=False)
    peso_bruto = Column(Numeric(10, 3), nullable=False)
    peso_neto = Column(Numeric(10, 3))
    tara = Column(Numeric(10, 3), default=0)
    unidad = Column(String(10), default="kg")
    estable = Column(Boolean, default=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    origen = Column(String(50), comment="production, checkout, receiving, inventory")
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    metadatos = Column("metadata", JSONB)

    __table_args__ = (
        Index("ix_scale_weight_logs_scale", "scale_id"),
        Index("ix_scale_weight_logs_fecha", "fecha"),
    )


class ScalePLUSync(Base):
    __tablename__ = "scale_plu_syncs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    scale_id = Column(UUID(as_uuid=True), ForeignKey("scale_configs.id"), nullable=False)
    total_productos = Column(Integer, nullable=False)
    exitosos = Column(Integer, nullable=False)
    fallidos = Column(Integer, default=0)
    modo = Column(String(20), default="incremental")
    archivo_generado = Column(String(500))
    resultado = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_scale_plu_syncs_scale", "scale_id"),
    )


class ScaleLabelTemplate(Base):
    __tablename__ = "scale_label_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    ancho_mm = Column(Integer, default=40)
    alto_mm = Column(Integer, default=30)
    campos = Column(JSONB, nullable=False, comment="ordered list of field definitions")
    incluir_barcode = Column(Boolean, default=True)
    incluir_precio = Column(Boolean, default=True)
    incluir_peso = Column(Boolean, default=True)
    incluir_info_nutricional = Column(Boolean, default=False)
    incluir_logo = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_scale_label_templates_company", "company_id"),
    )
