"""Commercial Agreement models"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from api.src.db import Base


class CommercialAgreement(Base):
    __tablename__ = "commercial_agreements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(30), nullable=False, unique=True)
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(30), nullable=False)
    estado = Column(String(20), server_default="borrador")
    prioridad = Column(String(20), server_default="normal")

    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    dias_aviso_renovacion = Column(Integer(), server_default="30")

    condiciones_pago = Column(Text())
    plazo_pago_dias = Column(Integer(), server_default="30")
    moneda = Column(String(3), server_default="PYG")
    tipo_cambio_fijo = Column(Numeric(10, 4))
    forma_pago = Column(String(50))

    aplica_iragru = Column(Boolean(), server_default="false")
    tasa_iragru = Column(Numeric(5, 2))
    aplica_retencion_iva = Column(Boolean(), server_default="false")
    tasa_retencion_iva = Column(Numeric(5, 2))
    categoria_retencion = Column(String(30))

    exclusividad = Column(Boolean(), server_default="false")
    zona_exclusividad = Column(String(200))
    tipo_envio = Column(String(30))
    porto_destino = Column(String(200))

    monto_minimo_orden = Column(Numeric(15, 0))
    monto_maximo_orden = Column(Numeric(15, 0))
    monto_total_acordado = Column(Numeric(15, 0))
    monto_ejecutado = Column(Numeric(15, 0), server_default="0")

    volumen_minimo_mensual = Column(Numeric(15, 0))
    unidad_medida = Column(String(30))

    aplica_rebate = Column(Boolean(), server_default="false")
    tipo_rebate = Column(String(20))
    umbral_rebate_1 = Column(Numeric(15, 0))
    porcentaje_rebate_1 = Column(Numeric(5, 2))
    umbral_rebate_2 = Column(Numeric(15, 0))
    porcentaje_rebate_2 = Column(Numeric(5, 2))
    umbral_rebate_3 = Column(Numeric(15, 0))
    porcentaje_rebate_3 = Column(Numeric(5, 2))
    frecuencia_liquidacion_rebate = Column(String(20))

    multa_incumplimiento = Column(Numeric(15, 0))
    bonificacion_cumplimiento = Column(Numeric(15, 0))
    nota_penalidad = Column(Text())

    archivo_url = Column(Text, comment="URL del PDF del contrato escaneado/firmado")
    renovacion_automatica = Column(Boolean, server_default="false")

    objeto = Column(Text())
    observaciones = Column(Text())
    user_id = Column(UUID(as_uuid=True))
    aprobado_por = Column(UUID(as_uuid=True))
    fecha_aprobacion = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("AgreementItem", back_populates="agreement", cascade="all, delete-orphan")
    rebates = relationship("AgreementRebate", back_populates="agreement", cascade="all, delete-orphan")
    volumes = relationship("AgreementVolume", back_populates="agreement", cascade="all, delete-orphan")


class AgreementItem(Base):
    __tablename__ = "agreement_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    agreement_id = Column(UUID(as_uuid=True), ForeignKey("commercial_agreements.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    descripcion = Column(String(300))

    precio_acordado = Column(Numeric(15, 0), nullable=False)
    precio_lista = Column(Numeric(15, 0))
    descuento_pct = Column(Numeric(5, 2))
    moneda = Column(String(3), server_default="PYG")
    tipo_precio = Column(String(20))

    cantidad_minima = Column(Numeric(10, 3))
    cantidad_multiple = Column(Numeric(10, 3))

    iva_tasa = Column(Numeric(5, 2), server_default="10")
    incluye_iva = Column(Boolean(), server_default="true")

    lead_time_dias = Column(Integer())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    agreement = relationship("CommercialAgreement", back_populates="items")


class AgreementRebate(Base):
    __tablename__ = "agreement_rebates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    agreement_id = Column(UUID(as_uuid=True), ForeignKey("commercial_agreements.id"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), nullable=False)

    periodo = Column(String(20), nullable=False)
    tipo = Column(String(20), nullable=False)

    umbral_desde = Column(Numeric(15, 0), nullable=False)
    umbral_hasta = Column(Numeric(15, 0))
    valor_rebate = Column(Numeric(15, 0), nullable=False)
    monto_aplicado = Column(Numeric(15, 0), server_default="0")

    estado = Column(String(20), server_default="pendiente")
    fecha_calculo = Column(DateTime(timezone=True))
    fecha_aprobacion = Column(DateTime(timezone=True))
    aprobado_por = Column(UUID(as_uuid=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    agreement = relationship("CommercialAgreement", back_populates="rebates")


class AgreementVolume(Base):
    __tablename__ = "agreement_volumes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    agreement_id = Column(UUID(as_uuid=True), ForeignKey("commercial_agreements.id"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), nullable=False)

    periodo = Column(String(20), nullable=False)
    tipo_periodo = Column(String(20), nullable=False)

    volumen_comprometido = Column(Numeric(15, 0), nullable=False)
    volumen_real = Column(Numeric(15, 0), server_default="0")
    monto_comprometido = Column(Numeric(15, 0), nullable=False)
    monto_real = Column(Numeric(15, 0), server_default="0")

    porcentaje_cumplimiento = Column(Numeric(5, 1))
    bonificacion_ganada = Column(Numeric(15, 0), server_default="0")
    multa_aplicada = Column(Numeric(15, 0), server_default="0")

    estado = Column(String(20), server_default="abierto")
    observaciones = Column(Text())

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    agreement = relationship("CommercialAgreement", back_populates="volumes")


class SupplierNegotiation(Base):
    __tablename__ = "supplier_negotiations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), nullable=False)

    tipo = Column(String(30), nullable=False)
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text())

    estado = Column(String(20), server_default="abierta")

    meta_precio = Column(Numeric(15, 0))
    meta_descuento = Column(Numeric(5, 2))
    precio_final = Column(Numeric(15, 0))

    observaciones = Column(Text())
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())