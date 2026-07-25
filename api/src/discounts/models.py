from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Date
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from api.src.db import Base


class Discount(Base):
    __tablename__ = "discounts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    tipo = Column(String(20), nullable=False)
    valor = Column(Numeric(15, 0))
    aplica_a = Column(String(20), nullable=False)
    producto_ids = Column(ARRAY(UUID))
    categoria_ids = Column(ARRAY(UUID))
    monto_minimo = Column(Numeric(15, 0))
    cantidad_minima = Column(Numeric(10, 0))
    maximo_aplicaciones = Column(Numeric(10, 0))
    aplicaciones_usadas = Column(Numeric(10, 0), server_default="0")
    valido_desde = Column(Date)
    valido_hasta = Column(Date)
    activo = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
