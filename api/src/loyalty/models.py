from sqlalchemy import Column, String, BigInteger, Integer, Boolean, DateTime, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from api.src.db import Base


class LoyaltyConfig(Base):
    __tablename__ = "loyalty_config"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    puntos_por_guarani = Column(Integer, nullable=False, default=1)
    guarani_por_punto = Column(Integer, nullable=False, default=100)
    vencimiento_dias = Column(Integer, nullable=False, default=365)
    canje_minimo_puntos = Column(Integer, nullable=False, default=100)
    bienvenida_puntos = Column(Integer, nullable=False, default=50)
    cumpleanos_puntos = Column(Integer, nullable=False, default=200)
    crear_en_venta = Column(Boolean, server_default="true")
    activo = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LoyaltyPoints(Base):
    __tablename__ = "loyalty_points"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)
    puntos = Column(Integer, nullable=False)
    referencia_tipo = Column(String(50))
    referencia_id = Column(String(100))
    descripcion = Column(Text)
    vence_en = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LoyaltyReward(Base):
    __tablename__ = "loyalty_rewards"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    puntos_requeridos = Column(Integer, nullable=False)
    tipo_recompensa = Column(String(50), nullable=False)
    valor_recompensa = Column(Numeric(15, 0))
    stock = Column(Integer)
    imagen_url = Column(Text)
    activo = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
