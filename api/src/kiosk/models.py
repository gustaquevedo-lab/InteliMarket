from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from api.src.db import Base


class KioskBanner(Base):
    """Creativo de oferta para los verificadores de precio del salón --
    marketing carga la imagen y el texto directamente, sin depender de
    un developer. Reemplaza los banners hardcodeados en el frontend que
    ni marketing podía tocar ni reflejaban ofertas reales."""
    __tablename__ = "kiosk_banners"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    titulo = Column(String(200), nullable=False)
    subtitulo = Column(Text)
    etiqueta = Column(String(60))  # "OFERTA DEL DÍA", "OFERTA DE LA SEMANA", etc.
    descuento_texto = Column(String(40))  # "-25% OFF", "3x2", etc. (informativo, no opera precio)
    color = Column(String(20), server_default="orange")  # tema de acento del banner
    imagen_url = Column(String(500))
    orden = Column(Integer, nullable=False, server_default="0")
    activo = Column(Boolean, server_default="true")
    fecha_inicio = Column(DateTime(timezone=True))
    fecha_fin = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
