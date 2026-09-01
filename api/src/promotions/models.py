from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Date, Time, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from api.src.db import Base


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text)

    # porcentaje | monto_fijo | dos_por_uno | combo_precio | cantidad_lleva | precio_fijo_oferta
    tipo = Column(String(30), nullable=False)
    valor = Column(Numeric(15, 2))  # porcentaje o monto de descuento
    precio_fijo_promocional = Column(Numeric(15, 2))  # precio directo de venta en oferta (ej. ₲ 38.000)
    valor_maximo = Column(Numeric(15, 2))  # techo del descuento

    # producto | categoria | carrito | marca
    aplica_a = Column(String(20), nullable=False)
    producto_ids = Column(ARRAY(UUID))  # when aplica_a=producto
    categoria_ids = Column(ARRAY(UUID))  # when aplica_a=categoria

    # Origen & Justificación Comercial (Trade Marketing)
    # corto_vencimiento | accion_proveedor | iniciativa_propia
    origen = Column(String(50), default="iniciativa_propia")

    # Financiación Comercial
    # proveedor_sell_out | proveedor_sell_in | propio_supermercado | co_financiado
    financiamiento = Column(String(50), default="propio_supermercado")
    supplier_id = Column(UUID(as_uuid=True), nullable=True)
    purchases_invoices_ids = Column(JSON, nullable=True)
    porcentaje_aporte_proveedor = Column(Numeric(5, 2), default=0)
    porcentaje_aporte_tienda = Column(Numeric(5, 2), default=0)
    monto_aporte_proveedor_pyg = Column(Numeric(15, 2), default=0)
    monto_aporte_tienda_pyg = Column(Numeric(15, 2), default=0)

    # Control de Rentabilidad & Margen
    costo_unitario_referencia = Column(Numeric(15, 2), default=0)
    vende_bajo_costo = Column(Boolean, default=False)
    
    # Aprobaciones de Gerencia
    # borrador | pendiente_aprobacion_gerencia | activa | pausada | finalizada_por_stock | finalizada_por_fecha
    estado = Column(String(50), default="activa", index=True)
    aprobado_por = Column(UUID(as_uuid=True), nullable=True)
    fecha_aprobacion = Column(DateTime(timezone=True), nullable=True)

    # Restricciones por Ticket y Stock Límite
    limite_por_compra = Column(Integer, nullable=True)  # ej: máx 6 unidades en oferta por ticket
    limitar_unidades = Column(Boolean, default=False)
    stock_limite_unidades = Column(Numeric(15, 2), nullable=True)  # cupo total autorizado (ej. 100 un)
    unidades_vendidas_promo = Column(Numeric(15, 2), default=0)  # contador en tiempo real

    # Condiciones de Compra
    monto_minimo_compra = Column(Numeric(15, 2))
    cantidad_minima = Column(Integer)
    cantidad_maxima_items = Column(Integer)
    aplicaciones_por_cliente = Column(Integer)
    combinable = Column(Boolean, server_default="false")

    # Calendario y Días de Semana
    valido_desde = Column(Date, nullable=False)
    valido_hasta = Column(Date, nullable=False)
    horario_desde = Column(Time)
    horario_hasta = Column(Time)
    dias_semana = Column(ARRAY(Integer))  # 0=domingo, 1=lunes ... 6=sabado

    # Cupón
    codigo_cupon = Column(String(50))
    requiere_cupon = Column(Boolean, server_default="false")

    # Liquidación Sell-Out con Proveedor (Vendor Claim & Nota de Crédito)
    # pendiente_liquidacion | obligacion_inicial_generada | solicitada_al_proveedor | nc_recibida_conciliada
    nc_estado = Column(String(50), default="pendiente_liquidacion")
    porcentaje_nc_costo = Column(Numeric(5, 2), default=0)  # % de NC acordado sobre el costo de adquisición
    monto_total_nc_comprometido = Column(Numeric(15, 2), default=0)  # Monto total de la obligación en firme
    fecha_vencimiento_lote = Column(Date, nullable=True)  # Fecha de vencimiento físico del producto
    ar_receivable_id = Column(UUID(as_uuid=True), nullable=True)  # ID de la cuenta por cobrar en firme generada al inicio
    nc_numero_proveedor = Column(String(50), nullable=True)  # Número de NC oficial (ej: 001-002-0004581)
    nc_timbrado_proveedor = Column(String(20), nullable=True)
    nc_monto_total = Column(Numeric(15, 2), default=0)

    # Trazabilidad Legacy Nemuha
    origen_fuente = Column(String(30), default="intelimarket")  # nemuha | intelimarket
    legacy_id = Column(Integer, nullable=True, index=True)  # ID_PROMOCAO en MySQL Nemuha

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
    sale_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True))
    branch_id = Column(UUID(as_uuid=True))
    product_id = Column(UUID(as_uuid=True), nullable=True)
    codigo_cupon = Column(String(50))
    cantidad_items = Column(Numeric(15, 2), default=1)
    precio_regular_unitario = Column(Numeric(15, 2), default=0)
    precio_promo_unitario = Column(Numeric(15, 2), default=0)
    descuento_aplicado = Column(Numeric(15, 2), nullable=False)
    es_venta_mayorista = Column(Boolean, default=False)
    items_aplicados = Column(ARRAY(UUID))  # sale_item_ids
    created_at = Column(DateTime(timezone=True), server_default=func.now())
