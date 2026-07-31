"""Retail schemas — Pydantic v2 compatible."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


# ── Store Config ──────────────────────────────────────────────

class StoreConfigBase(BaseModel):
    branch_id: UUID
    nombre: str
    metros_cuadrados: Decimal = Decimal("0")
    tipo: str = "retail"
    hora_apertura: str = "08:00"
    hora_cierre: str = "20:00"
    dias_abiertos: str = "1,2,3,4,5,6"
    capacidad_horaria: int = 20
    config_pos: Dict[str, Any] = Field(default_factory=dict)
    config_online: Dict[str, Any] = Field(default_factory=dict)


class StoreConfigCreate(StoreConfigBase):
    pass


class StoreConfigUpdate(BaseModel):
    nombre: Optional[str] = None
    metros_cuadrados: Optional[Decimal] = None
    tipo: Optional[str] = None
    hora_apertura: Optional[str] = None
    hora_cierre: Optional[str] = None
    dias_abiertos: Optional[str] = None
    capacidad_horaria: Optional[int] = None
    config_pos: Optional[Dict[str, Any]] = None
    config_online: Optional[Dict[str, Any]] = None
    activo: Optional[bool] = None


class StoreConfigResponse(StoreConfigBase):
    id: UUID
    company_id: UUID
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── KPI Snapshots ─────────────────────────────────────────────

class KpiSnapshotResponse(BaseModel):
    fecha: date
    periodo: str
    ventas_total: Decimal
    ventas_count: int
    ticket_promedio: Decimal
    ventas_m2: Decimal
    margen_bruto: Decimal
    margen_pct: Decimal
    clientes_unicos: int
    productos_vendidos: int
    descuento_total: Decimal
    delta_ventas_pct: Decimal
    delta_ticket_pct: Decimal
    delta_clientes_pct: Decimal
    hora_pico: Optional[int]
    hora_pico_ventas: Decimal
    conversion_pct: Optional[Decimal] = None
    payload: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


# ── Hour Heatmap ──────────────────────────────────────────────

class HourHeatmapResponse(BaseModel):
    fecha: date
    hora: int
    ventas_total: Decimal
    ventas_count: int
    clientes_count: int
    duracion_promedio_min: int
    personal_sugerido: int

    class Config:
        from_attributes = True


# ── Coupons ───────────────────────────────────────────────────

class CouponBase(BaseModel):
    codigo: str = Field(..., min_length=4, max_length=20)
    nombre: str
    descripcion: Optional[str] = None
    tipo: str  # porcentaje, monto_fijo, 2x1, regalo, envio_gratis, puntos_dobles
    valor: Decimal = Decimal("0")
    compra_minima: Decimal = Decimal("0")
    segmento_id: Optional[UUID] = None
    segmento_nombre: Optional[str] = None
    clientes_target: List[UUID] = Field(default_factory=list)
    aplicar_a: str = "todos"
    categorias_ids: List[UUID] = Field(default_factory=list)
    productos_ids: List[UUID] = Field(default_factory=list)
    fecha_desde: datetime
    fecha_hasta: datetime
    usos_maximos: int = 0
    usos_por_cliente: int = 1
    canal: str = "todos"


class CouponCreate(CouponBase):
    pass


class CouponUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    valor: Optional[Decimal] = None
    compra_minima: Optional[Decimal] = None
    fecha_hasta: Optional[datetime] = None
    usos_maximos: Optional[int] = None
    estado: Optional[str] = None
    canal: Optional[str] = None


class CouponResponse(CouponBase):
    id: UUID
    company_id: UUID
    usos_actuales: int
    estado: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CouponValidateRequest(BaseModel):
    codigo: str
    customer_id: Optional[UUID] = None
    monto_compra: Decimal = Decimal("0")


class CouponValidateResponse(BaseModel):
    valido: bool
    cupon: Optional[CouponResponse] = None
    descuento_aplicado: Decimal = Decimal("0")
    mensaje: str


# ── Calendar Events ───────────────────────────────────────────

class CalendarEventBase(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    fecha_evento: date
    fecha_fin: Optional[date] = None
    categoria: Optional[str] = None
    icono: str = "🎉"
    recurrente: bool = True
    notas_planificacion: Optional[str] = None


class CalendarEventCreate(CalendarEventBase):
    pass


class CalendarEventUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_evento: Optional[date] = None
    fecha_fin: Optional[date] = None
    activo: Optional[bool] = None
    notas_planificacion: Optional[str] = None


class CalendarEventResponse(CalendarEventBase):
    id: UUID
    company_id: UUID
    activo: bool
    created_at: datetime
    promos_count: int = 0

    class Config:
        from_attributes = True


class EventPromoBase(BaseModel):
    event_id: UUID
    nombre: str
    tipo: str
    valor: Decimal = Decimal("0")
    fecha_desde: date
    fecha_hasta: date
    productos_ids: List[UUID] = Field(default_factory=list)
    categorias_ids: List[UUID] = Field(default_factory=list)
    bundle_config: Dict[str, Any] = Field(default_factory=dict)
    presupuesto: Decimal = Decimal("0")
    inversion_marketing: Decimal = Decimal("0")
    copy_sugerido: Optional[str] = None
    notas: Optional[str] = None


class EventPromoCreate(EventPromoBase):
    pass


class EventPromoUpdate(BaseModel):
    nombre: Optional[str] = None
    estado: Optional[str] = None
    valor: Optional[Decimal] = None
    fecha_hasta: Optional[date] = None
    ventas_atribuidas: Optional[Decimal] = None
    inversion_marketing: Optional[Decimal] = None
    notas: Optional[str] = None


class EventPromoResponse(EventPromoBase):
    id: UUID
    company_id: UUID
    estado: str
    ventas_atribuidas: Decimal
    roi_pct: Decimal
    created_at: datetime
    updated_at: datetime
    event_nombre: Optional[str] = None
    event_icono: Optional[str] = None

    class Config:
        from_attributes = True


# ── Cash Sessions ─────────────────────────────────────────────

class CashSessionOpen(BaseModel):
    branch_id: UUID
    monto_apertura: Decimal = Decimal("0")
    notas: Optional[str] = None


class CashSessionClose(BaseModel):
    monto_cierre: Decimal
    movimientos: List[Dict[str, Any]] = Field(default_factory=list)
    notas: Optional[str] = None


class CashSessionResponse(BaseModel):
    id: UUID
    company_id: UUID
    branch_id: UUID
    usuario_id: UUID
    usuario_nombre: Optional[str]
    monto_apertura: Decimal
    monto_cierre: Optional[Decimal]
    monto_teorico: Optional[Decimal]
    diferencia: Optional[Decimal]
    ventas_total: Decimal
    ventas_count: int
    descuentos_total: Decimal
    movimientos: List[Dict[str, Any]]
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime]
    estado: str
    notas: Optional[str]

    class Config:
        from_attributes = True


# ── Quick Customer ────────────────────────────────────────────

class QuickCustomerLookup(BaseModel):
    identificador: str
    tipo: Optional[str] = "auto"  # auto, telefono, dni, ruc, qr


class QuickCustomerResult(BaseModel):
    encontrado: bool
    customer_id: Optional[UUID] = None
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    puntos: int = 0
    segmento: Optional[str] = None
    proxima_recompensa: Optional[str] = None
    descuento_aplicable: Decimal = Decimal("0")
    sugerencias: List[str] = Field(default_factory=list)
    mensaje: str


# ── Online Storefront ─────────────────────────────────────────

class OnlineStorefrontBase(BaseModel):
    branch_id: UUID
    slug: str = Field(..., min_length=3, max_length=100)
    nombre_publico: Optional[str] = None
    mensaje_bienvenida: Optional[str] = None
    color_primario: str = "#0d9488"
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    metodos_pago: List[str] = Field(default_factory=lambda: ["pagopar", "contra_entrega"])
    delivery_activo: bool = True
    delivery_km_max: int = 10
    delivery_costo_km: Decimal = Decimal("5000")
    pickup_activo: bool = True
    pickup_horas: int = 2
    senia_pct: Decimal = Decimal("20")
    productos_destacados: List[UUID] = Field(default_factory=list)
    horarios_atencion: Dict[str, Any] = Field(default_factory=dict)
    politicas: Optional[str] = None
    seo_meta: Dict[str, Any] = Field(default_factory=dict)


class OnlineStorefrontCreate(OnlineStorefrontBase):
    pass


class OnlineStorefrontUpdate(BaseModel):
    nombre_publico: Optional[str] = None
    mensaje_bienvenida: Optional[str] = None
    color_primario: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    metodos_pago: Optional[List[str]] = None
    delivery_activo: Optional[bool] = None
    delivery_km_max: Optional[int] = None
    delivery_costo_km: Optional[Decimal] = None
    pickup_activo: Optional[bool] = None
    pickup_horas: Optional[int] = None
    senia_pct: Optional[Decimal] = None
    productos_destacados: Optional[List[UUID]] = None
    horarios_atencion: Optional[Dict[str, Any]] = None
    politicas: Optional[str] = None
    seo_meta: Optional[Dict[str, Any]] = None
    activo: Optional[bool] = None


class OnlineStorefrontResponse(OnlineStorefrontBase):
    id: UUID
    company_id: UUID
    activo: bool
    created_at: datetime
    updated_at: datetime
    url_publica: Optional[str] = None

    class Config:
        from_attributes = True


# ── Dashboard aggregated ─────────────────────────────────────

class RetailDashboardData(BaseModel):
    hoy: KpiSnapshotResponse
    semana: KpiSnapshotResponse
    mes: KpiSnapshotResponse
    heatmap_7dias: List[HourHeatmapResponse]
    top_productos: List[Dict[str, Any]]
    productos_sin_venta: List[Dict[str, Any]]
    alertas_stock: List[Dict[str, Any]]
    proximos_eventos: List[CalendarEventResponse]
    cupones_activos: int
    ventas_por_dia_semana: List[Dict[str, Any]]
    comparativa: Dict[str, Any]
    generated_at: datetime
