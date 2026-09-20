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
    multiplicador_bronce = Column(Numeric(3, 2), nullable=False, default=1.00, server_default="1.00")
    multiplicador_plata = Column(Numeric(3, 2), nullable=False, default=1.20, server_default="1.20")
    multiplicador_oro = Column(Numeric(3, 2), nullable=False, default=1.50, server_default="1.50")
    multiplicador_vip = Column(Numeric(3, 2), nullable=False, default=2.00, server_default="2.00")
    promocion_activa = Column(Boolean, nullable=False, default=False, server_default="false")
    promocion_nombre = Column(String(100), nullable=True)
    multiplicador_promocional = Column(Numeric(3, 2), nullable=False, default=1.00, server_default="1.00")
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
    stock = Column(Integer, default=0)
    imagen_url = Column(Text)
    activo = Column(Boolean, server_default="true")
    
    # Patrocinio y Depósito de Premios
    supplier_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    warehouse_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    patrocinador_nombre = Column(String(255), nullable=True)
    aporte_tipo = Column(String(50), nullable=True, default="donacion_100")
    unidades_pactadas = Column(Integer, nullable=True, default=0)
    costo_referencial = Column(Numeric(15, 0), nullable=True, default=0)
    notas = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LoyaltyRedemption(Base):
    __tablename__ = "loyalty_redemptions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    reward_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    warehouse_id = Column(UUID(as_uuid=True), nullable=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=True)
    puntos_canjeados = Column(Integer, nullable=False)
    cantidad = Column(Integer, nullable=False, default=1)
    comprobante_numero = Column(String(50), nullable=True)
    entregado_por = Column(String(100), nullable=True)
    notas = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
