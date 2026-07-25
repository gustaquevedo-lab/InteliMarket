"""Retail / Tienda models — KPIs, POS config, coupons, calendar events, online store."""
import uuid
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Integer, ForeignKey, Date, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from api.src.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


# ── Store Config (per-branch retail settings) ──────────────────────

class StoreConfig(Base):
    __tablename__ = "rt_store_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    metros_cuadrados = Column(Numeric(10, 2), default=0)
    tipo = Column(String(50), default="retail")  # retail, kiosko, boutique
    hora_apertura = Column(String(5), default="08:00")
    hora_cierre = Column(String(5), default="20:00")
    dias_abiertos = Column(String(50), default="1,2,3,4,5,6")  # 0=dom, 6=sab
    capacidad_horaria = Column(Integer, default=20)  # clientes/hora
    config_pos = Column(JSONB, default=dict)
    # config_pos: { modo_kiosko, atajos_teclado, sonidos, ticket_digital_default }
    config_online = Column(JSONB, default=dict)
    # config_online: { activo, slug_publico, mensaje_bienvenida, metodos_pago, delivery_km_max, costo_delivery_km }
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ── KPI Snapshots (cached aggregated metrics) ────────────────────

class KpiSnapshot(Base):
    __tablename__ = "rt_kpi_snapshot"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), index=True)
    fecha = Column(Date, nullable=False, index=True)
    periodo = Column(String(10), nullable=False)  # dia, semana, mes

    ventas_total = Column(Numeric(15, 0), default=0)
    ventas_count = Column(Integer, default=0)
    ticket_promedio = Column(Numeric(15, 0), default=0)
    ventas_m2 = Column(Numeric(15, 2), default=0)
    margen_bruto = Column(Numeric(15, 0), default=0)
    clientes_unicos = Column(Integer, default=0)
    productos_vendidos = Column(Integer, default=0)
    descuento_total = Column(Numeric(15, 0), default=0)

    # comparison vs prev period
    delta_ventas_pct = Column(Numeric(6, 2), default=0)
    delta_ticket_pct = Column(Numeric(6, 2), default=0)
    delta_clientes_pct = Column(Numeric(6, 2), default=0)

    hora_pico = Column(Integer)  # 0-23
    hora_pico_ventas = Column(Numeric(15, 0), default=0)
    conversion_pct = Column(Numeric(5, 2), default=0)  # estimado

    payload = Column(JSONB, default=dict)
    calculated_at = Column(DateTime(timezone=True), default=_utcnow)


# ── Hour Heatmap (sales by hour x day) ────────────────────────────

class HourHeatmap(Base):
    __tablename__ = "rt_hour_heatmap"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), index=True)
    fecha = Column(Date, nullable=False, index=True)
    hora = Column(Integer, nullable=False)  # 0-23
    ventas_total = Column(Numeric(15, 0), default=0)
    ventas_count = Column(Integer, default=0)
    clientes_count = Column(Integer, default=0)
    duracion_promedio_min = Column(Integer, default=0)
    personal_sugerido = Column(Integer, default=0)


# ── Digital Coupons ──────────────────────────────────────────────

class Coupon(Base):
    __tablename__ = "rt_coupon"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(20), nullable=False, unique=True, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    tipo = Column(String(20), nullable=False)  # porcentaje, monto_fijo, 2x1, regalo, envio_gratis, puntos_dobles
    valor = Column(Numeric(15, 2), default=0)  # % o monto
    compra_minima = Column(Numeric(15, 0), default=0)

    # Targeting
    segmento_id = Column(UUID(as_uuid=True))  # opcional, FK a marketing_segments
    segmento_nombre = Column(String(200))  # RFM cache
    clientes_target = Column(JSONB, default=list)  # lista UUIDs explícitos
    aplicar_a = Column(String(20), default="todos")  # todos, categoria, producto
    categorias_ids = Column(JSONB, default=list)
    productos_ids = Column(JSONB, default=list)

    # Validity
    fecha_desde = Column(DateTime(timezone=True), nullable=False)
    fecha_hasta = Column(DateTime(timezone=True), nullable=False)
    usos_maximos = Column(Integer, default=0)  # 0 = ilimitado
    usos_por_cliente = Column(Integer, default=1)
    usos_actuales = Column(Integer, default=0)

    # Status
    estado = Column(String(20), default="activo")  # activo, pausado, expirado, agotado
    canal = Column(String(20), default="todos")  # pos, online, todos
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class CouponRedemption(Base):
    __tablename__ = "rt_coupon_redemption"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    coupon_id = Column(UUID(as_uuid=True), ForeignKey("rt_coupon.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True))
    sale_id = Column(UUID(as_uuid=True))
    branch_id = Column(UUID(as_uuid=True))
    monto_descuento = Column(Numeric(15, 0), default=0)
    fecha = Column(DateTime(timezone=True), default=_utcnow)
    vendedor = Column(String(200))
    foto_ticket = Column(String(500))  # URL optional
    notas = Column(Text)


# ── Calendar Events (Paraguay-aware) ─────────────────────────────

class CalendarEvent(Base):
    __tablename__ = "rt_calendar_event"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50), nullable=False, index=True)  # dia_madre, dia_padre, san_juan, etc
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    fecha_evento = Column(Date, nullable=False, index=True)
    fecha_fin = Column(Date)  # para promos que duran varios días
    categoria = Column(String(50))  # festividad, comercial, escolar, etc
    icono = Column(String(20), default="🎉")
    recurrente = Column(Boolean, default=True)  # si se repite cada año
    activo = Column(Boolean, default=True)
    notas_planificacion = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


class EventPromo(Base):
    __tablename__ = "rt_event_promo"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    event_id = Column(UUID(as_uuid=True), ForeignKey("rt_calendar_event.id"), nullable=False)
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(20), nullable=False)  # descuento, 2x1, bundle, regalo
    valor = Column(Numeric(15, 2), default=0)
    fecha_desde = Column(Date, nullable=False)
    fecha_hasta = Column(Date, nullable=False)
    estado = Column(String(20), default="planificada")  # planificada, activa, finalizada, cancelada
    productos_ids = Column(JSONB, default=list)
    categorias_ids = Column(JSONB, default=list)
    bundle_config = Column(JSONB, default=dict)  # { productos: [{id, qty}], precio_bundle }
    presupuesto = Column(Numeric(15, 0), default=0)
    inversion_marketing = Column(Numeric(15, 0), default=0)
    ventas_atribuidas = Column(Numeric(15, 0), default=0)
    roi_pct = Column(Numeric(8, 2), default=0)
    copy_sugerido = Column(Text)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ── POS Cash Sessions ────────────────────────────────────────────

class CashSession(Base):
    __tablename__ = "rt_cash_session"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    usuario_id = Column(UUID(as_uuid=True), nullable=False)
    usuario_nombre = Column(String(200))
    monto_apertura = Column(Numeric(15, 0), default=0)
    monto_cierre = Column(Numeric(15, 0), default=0)
    monto_teorico = Column(Numeric(15, 0), default=0)
    diferencia = Column(Numeric(15, 0), default=0)
    ventas_total = Column(Numeric(15, 0), default=0)
    ventas_count = Column(Integer, default=0)
    descuentos_total = Column(Numeric(15, 0), default=0)
    movimientos = Column(JSONB, default=list)  # [{ tipo, monto, desc }]
    fecha_apertura = Column(DateTime(timezone=True), default=_utcnow)
    fecha_cierre = Column(DateTime(timezone=True))
    estado = Column(String(20), default="abierta")  # abierta, cerrada, cuadre
    notas = Column(Text)


# ── Quick Customer (rapid identification log) ────────────────────

class QuickCustomerLog(Base):
    __tablename__ = "rt_quick_customer"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    identificador = Column(String(100), nullable=False, index=True)  # telefono, dni, ruc, qr
    tipo = Column(String(20), nullable=False)  # telefono, dni, ruc, qr
    customer_id = Column(UUID(as_uuid=True))
    customer_nombre = Column(String(300))
    puntos = Column(Integer, default=0)
    segmento = Column(String(50))
    proxima_recompensa = Column(String(200))
    descuento_aplicable = Column(Numeric(15, 0), default=0)
    ultima_consulta = Column(DateTime(timezone=True), default=_utcnow)
    conteo_consultas = Column(Integer, default=1)


# ── Online Storefronts (config per branch) ───────────────────────

class OnlineStorefront(Base):
    __tablename__ = "rt_online_storefront"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    nombre_publico = Column(String(200))
    mensaje_bienvenida = Column(Text)
    color_primario = Column(String(20), default="#0d9488")
    logo_url = Column(String(500))
    banner_url = Column(String(500))
    metodos_pago = Column(JSONB, default=list)  # [pagopar, kuapay, spi, contra_entrega]
    delivery_activo = Column(Boolean, default=True)
    delivery_km_max = Column(Integer, default=10)
    delivery_costo_km = Column(Numeric(15, 0), default=5000)
    pickup_activo = Column(Boolean, default=True)
    pickup_horas = Column(Integer, default=2)
    senia_pct = Column(Numeric(5, 2), default=20)
    productos_destacados = Column(JSONB, default=list)
    horarios_atencion = Column(JSONB, default=dict)
    politicas = Column(Text)
    seo_meta = Column(JSONB, default=dict)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
