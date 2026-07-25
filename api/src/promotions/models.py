from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Date, Time, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from api.src.db import Base


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text)

    # porcentaje | monto_fijo | dos_por_uno | combo_precio | cantidad_lleva
    tipo = Column(String(20), nullable=False)
    valor = Column(Numeric(15, 2))  # porcentaje o monto fijo
    valor_maximo = Column(Numeric(15, 2))  # techo del descuento

    # producto | categoria | carrito | marca
    aplica_a = Column(String(20), nullable=False)
    producto_ids = Column(ARRAY(UUID))  # when aplica_a=producto
    categoria_ids = Column(ARRAY(UUID))  # when aplica_a=categoria

    # Condiciones
    monto_minimo_compra = Column(Numeric(15, 2))
    cantidad_minima = Column(Integer)
    cantidad_maxima_items = Column(Integer)  # ej: 2x1 → max 10 uds
    aplicaciones_por_cliente = Column(Integer)
    combinable = Column(Boolean, server_default="false")

    # Schedule
    valido_desde = Column(Date, nullable=False)
    valido_hasta = Column(Date, nullable=False)
    horario_desde = Column(Time)  # ej: 18:00 for after-hours
    horario_hasta = Column(Time)
    dias_semana = Column(ARRAY(Integer))  # 0=domingo, 6=sabado

    # Cupón
    codigo_cupon = Column(String(50))  # optional coupon code
    requiere_cupon = Column(Boolean, server_default="false")

    # Control
    usos_maximos = Column(Integer)
    usos_actuales = Column(Integer, server_default="0")
    activo = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PromotionUsage(Base):
    __tablename__ = "promotion_usages"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    promotion_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), nullable=False)
    customer_id = Column(UUID(as_uuid=True))
    branch_id = Column(UUID(as_uuid=True))
    codigo_cupon = Column(String(50))
    descuento_aplicado = Column(Numeric(15, 2), nullable=False)
    items_aplicados = Column(ARRAY(UUID))  # sale_item_ids
    created_at = Column(DateTime(timezone=True), server_default=func.now())
