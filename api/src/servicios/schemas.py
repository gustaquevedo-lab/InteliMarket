"""Pydantic schemas para el modulo Servicios (sv_*)."""
from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


# ============================================================
# VERTICALES / SKILLS
# ============================================================
class ServiceVerticalOut(_Base):
    id: Optional[str] = None
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    icono: Optional[str] = None
    color: Optional[str] = None
    activo: Optional[bool] = None


class SkillBase(_Base):
    codigo: str
    nombre: str
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    nivel_maximo: int = 5
    skill_padre_id: Optional[str] = None


class SkillCreate(SkillBase):
    pass


class SkillOut(SkillBase):
    id: Optional[str] = None
    activo: Optional[bool] = None
    created_at: Optional[datetime] = None


# ============================================================
# TECNICOS
# ============================================================
class TechnicianBase(_Base):
    nombre: str
    vertical_codigo: Optional[str] = None
    ci: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    tipo: str = "interno"
    modalidad: str = "tiempo_completo"
    fecha_ingreso: Optional[date] = None
    tarifa_hora_pyg: Decimal = Decimal("0")
    tarifa_visita_pyg: Decimal = Decimal("0")
    comision_pct: Decimal = Decimal("0")
    zonas_cobertura: Optional[List[str]] = None
    biografia: Optional[str] = None
    color_calendario: str = "#3b82f6"


class TechnicianCreate(TechnicianBase):
    company_id: str


class TechnicianUpdate(_Base):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    tarifa_hora_pyg: Optional[Decimal] = None
    tarifa_visita_pyg: Optional[Decimal] = None
    comision_pct: Optional[Decimal] = None
    biografia: Optional[str] = None
    activo: Optional[bool] = None
    disponible: Optional[bool] = None


class TechnicianOut(TechnicianBase):
    id: Optional[str] = None
    company_id: Optional[str] = None
    rating_promedio: Optional[Decimal] = None
    total_servicios: Optional[int] = None
    total_clientes: Optional[int] = None
    primera_visita_pct: Optional[Decimal] = None
    activo: Optional[bool] = None
    disponible: Optional[bool] = None
    created_at: Optional[datetime] = None


class TechnicianSkillCreate(_Base):
    skill_id: str
    nivel: int = 1
    certificado: bool = False
    fecha_adquisicion: Optional[date] = None
    notas: Optional[str] = None


class TechnicianSkillOut(_Base):
    id: Optional[str] = None
    technician_id: Optional[str] = None
    skill_id: Optional[str] = None
    nivel: Optional[int] = None
    certificado: Optional[bool] = None
    skill_nombre: Optional[str] = None
    skill_codigo: Optional[str] = None


class CertificationCreate(_Base):
    tipo: str
    nombre: str
    institucion: Optional[str] = None
    numero: Optional[str] = None
    fecha_emision: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    alerta_dias: int = 30
    archivo_url: Optional[str] = None
    notas: Optional[str] = None


class CertificationOut(CertificationCreate):
    id: Optional[str] = None
    company_id: Optional[str] = None
    technician_id: Optional[str] = None
    dias_para_vencer: Optional[int] = None
    alerta_enviada: Optional[bool] = None
    created_at: Optional[datetime] = None


# ============================================================
# AVAILABILITY
# ============================================================
class AvailabilityCreate(_Base):
    dia_semana: int
    hora_desde: time
    hora_hasta: time
    disponible: bool = True
    es_receso: bool = False
    notas: Optional[str] = None


class AvailabilityOut(AvailabilityCreate):
    id: Optional[str] = None
    technician_id: Optional[str] = None


# ============================================================
# TEAMS
# ============================================================
class TeamCreate(_Base):
    nombre: str
    descripcion: Optional[str] = None
    lider_technician_id: Optional[str] = None
    color: str = "#10b981"
    member_ids: Optional[List[str]] = None


class TeamOut(_Base):
    id: Optional[str] = None
    company_id: Optional[str] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    lider_technician_id: Optional[str] = None
    color: Optional[str] = None
    activo: Optional[bool] = None
    member_count: Optional[int] = None
    created_at: Optional[datetime] = None


# ============================================================
# ZONAS
# ============================================================
class ServiceZoneCreate(_Base):
    nombre: str
    ciudad: str
    departamento: Optional[str] = None
    codigo_postal: Optional[str] = None
    radio_km: Decimal = Decimal("10")
    recargo_km_pyg: Decimal = Decimal("0")
    tiempo_promedio_minutos: int = 30


class ServiceZoneOut(ServiceZoneCreate):
    id: Optional[str] = None
    company_id: Optional[str] = None
    activo: Optional[bool] = None


# ============================================================
# PROPIEDADES
# ============================================================
class PropertyCreate(_Base):
    customer_id: str
    nombre: str
    tipo: str = "residencial"
    direccion: str
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    codigo_postal: Optional[str] = None
    lat: Optional[Decimal] = None
    lng: Optional[Decimal] = None
    zona_id: Optional[str] = None
    metros_cuadrados: Optional[Decimal] = None
    pisos: int = 1
    habitaciones: Optional[int] = None
    banos: Optional[Decimal] = None
    acceso_notas: Optional[str] = None
    contacto_nombre: Optional[str] = None
    contacto_telefono: Optional[str] = None
    notas: Optional[str] = None


class PropertyOut(PropertyCreate):
    id: Optional[str] = None
    company_id: Optional[str] = None
    activo: Optional[bool] = None
    equipment_count: Optional[int] = None
    created_at: Optional[datetime] = None


# ============================================================
# EQUIPOS
# ============================================================
class EquipmentCreate(_Base):
    property_id: str
    tipo: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    capacidad: Optional[str] = None
    fecha_instalacion: Optional[date] = None
    fecha_garantia_fin: Optional[date] = None
    ubicacion: Optional[str] = None
    requiere_mantenimiento: bool = True
    frecuencia_mantenimiento_dias: int = 180
    proximo_mantenimiento: Optional[date] = None
    estado: str = "operativo"
    notas: Optional[str] = None


class EquipmentOut(EquipmentCreate):
    id: Optional[str] = None
    company_id: Optional[str] = None
    customer_id: Optional[str] = None
    ultimo_mantenimiento: Optional[date] = None
    activo: Optional[bool] = None
    created_at: Optional[datetime] = None


# ============================================================
# COTIZACIONES
# ============================================================
class QuoteItemCreate(_Base):
    tipo: str = "mano_obra"
    codigo: Optional[str] = None
    descripcion: str
    detalle: Optional[str] = None
    cantidad: Decimal = Decimal("1")
    unidad: str = "UN"
    precio_unitario: Decimal = Decimal("0")
    descuento_pct: Decimal = Decimal("0")
    iva_incluido: bool = True
    orden: int = 0


class QuoteItemOut(QuoteItemCreate):
    id: Optional[str] = None
    subtotal: Optional[Decimal] = None


class QuoteCreate(_Base):
    customer_id: str
    property_id: Optional[str] = None
    equipment_id: Optional[str] = None
    technician_id: Optional[str] = None
    vertical_codigo: Optional[str] = None
    titulo: str
    descripcion: Optional[str] = None
    duracion_estimada_horas: Optional[Decimal] = None
    fecha_inicio_estimada: Optional[date] = None
    tiempo_validez_dias: int = 15
    descuento_pct: Decimal = Decimal("0")
    iva_pct: Decimal = Decimal("10")
    condiciones: Optional[str] = None
    metodo_pago_propuesto: Optional[str] = None
    items: List[QuoteItemCreate] = []


class QuoteUpdate(_Base):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    estado: Optional[str] = None
    fecha_validez: Optional[date] = None
    items: Optional[List[QuoteItemCreate]] = None


class QuoteOut(_Base):
    id: Optional[str] = None
    company_id: Optional[str] = None
    numero: Optional[str] = None
    customer_id: Optional[str] = None
    customer_nombre: Optional[str] = None
    property_id: Optional[str] = None
    property_nombre: Optional[str] = None
    equipment_id: Optional[str] = None
    technician_id: Optional[str] = None
    technician_nombre: Optional[str] = None
    vertical_codigo: Optional[str] = None
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    estado: Optional[str] = None
    fecha_cotizacion: Optional[date] = None
    fecha_validez: Optional[date] = None
    duracion_estimada_horas: Optional[Decimal] = None
    subtmano_obra: Optional[Decimal] = None
    subtotal_materiales: Optional[Decimal] = None
    subtotal_equipos: Optional[Decimal] = None
    subtotal_subcontratos: Optional[Decimal] = None
    descuento_pct: Optional[Decimal] = None
    descuento_monto: Optional[Decimal] = None
    iva_pct: Optional[Decimal] = None
    iva_monto: Optional[Decimal] = None
    total: Optional[Decimal] = None
    pdf_url: Optional[str] = None
    items: List[QuoteItemOut] = []
    created_at: Optional[datetime] = None


# ============================================================
# AGENDA / APPOINTMENTS
# ============================================================
class AppointmentCreate(_Base):
    customer_id: str
    property_id: Optional[str] = None
    technician_id: str
    quote_id: Optional[str] = None
    tipo: str = "servicio"
    prioridad: str = "normal"
    titulo: str
    descripcion: Optional[str] = None
    fecha: date
    hora_desde: time
    hora_hasta: time
    duracion_estimada_minutos: int = 60
    ventana_tiempo: Optional[str] = None
    direccion: Optional[str] = None
    lat: Optional[Decimal] = None
    lng: Optional[Decimal] = None
    recordatorio_horas_antes: int = 24
    notas_previas: Optional[str] = None
    requiere_confirmacion: bool = True


class AppointmentUpdate(_Base):
    estado: Optional[str] = None
    fecha: Optional[date] = None
    hora_desde: Optional[time] = None
    hora_hasta: Optional[time] = None
    notas_previas: Optional[str] = None
    confirmada: Optional[bool] = None


class AppointmentOut(_Base):
    id: Optional[str] = None
    company_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_nombre: Optional[str] = None
    customer_telefono: Optional[str] = None
    property_id: Optional[str] = None
    property_direccion: Optional[str] = None
    technician_id: Optional[str] = None
    technician_nombre: Optional[str] = None
    technician_color: Optional[str] = None
    quote_id: Optional[str] = None
    tipo: Optional[str] = None
    estado: Optional[str] = None
    prioridad: Optional[str] = None
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha: Optional[date] = None
    hora_desde: Optional[time] = None
    hora_hasta: Optional[time] = None
    duracion_estimada_minutos: Optional[int] = None
    ventana_tiempo: Optional[str] = None
    direccion: Optional[str] = None
    recordatorio_enviado: Optional[bool] = None
    confirmada: Optional[bool] = None
    color: Optional[str] = None
    created_at: Optional[datetime] = None


# ============================================================
# WORK ORDERS
# ============================================================
class WorkOrderItemCreate(_Base):
    tipo: str = "mano_obra"
    codigo: Optional[str] = None
    descripcion: str
    detalle: Optional[str] = None
    cantidad: Decimal = Decimal("1")
    unidad: str = "UN"
    precio_unitario: Decimal = Decimal("0")
    descuento_pct: Decimal = Decimal("0")
    iva_incluido: bool = True
    product_id: Optional[str] = None
    truck_stock: bool = False
    tecnico_id: Optional[str] = None
    horas: Optional[Decimal] = None
    tarifa_hora: Optional[Decimal] = None
    orden: int = 0


class WorkOrderItemOut(WorkOrderItemCreate):
    id: Optional[str] = None
    subtotal: Optional[Decimal] = None


class WorkOrderCreate(_Base):
    customer_id: str
    property_id: Optional[str] = None
    equipment_id: Optional[str] = None
    technician_id: str
    quote_id: Optional[str] = None
    appointment_id: Optional[str] = None
    vertical_codigo: Optional[str] = None
    tipo: str = "servicio"
    prioridad: str = "normal"
    titulo: str
    descripcion_cliente: Optional[str] = None
    problema_reportado: Optional[str] = None
    fecha_programada: date
    hora_programada: Optional[time] = None
    duracion_estimada_horas: Optional[Decimal] = None
    requiere_garantia: bool = False
    dias_garantia: int = 30
    items: List[WorkOrderItemCreate] = []


class WorkOrderUpdate(_Base):
    estado: Optional[str] = None
    prioridad: Optional[str] = None
    titulo: Optional[str] = None
    problema_reportado: Optional[str] = None
    diagnostico: Optional[str] = None
    solucion_aplicada: Optional[str] = None
    recomendaciones: Optional[str] = None
    fecha_checkin: Optional[datetime] = None
    lat_checkin: Optional[Decimal] = None
    lng_checkin: Optional[Decimal] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    duracion_real_minutos: Optional[int] = None
    km_recorridos: Optional[Decimal] = None
    nombre_firmante: Optional[str] = None
    ci_firmante: Optional[str] = None
    satisfaccion_nps: Optional[int] = None
    satisfaccion_comentario: Optional[str] = None
    requiere_seguimiento: Optional[bool] = None
    fecha_seguimiento: Optional[date] = None
    notas_internas: Optional[str] = None


class WorkOrderOut(_Base):
    id: Optional[str] = None
    company_id: Optional[str] = None
    numero: Optional[str] = None
    customer_id: Optional[str] = None
    customer_nombre: Optional[str] = None
    property_id: Optional[str] = None
    equipment_id: Optional[str] = None
    technician_id: Optional[str] = None
    technician_nombre: Optional[str] = None
    quote_id: Optional[str] = None
    appointment_id: Optional[str] = None
    vertical_codigo: Optional[str] = None
    tipo: Optional[str] = None
    estado: Optional[str] = None
    prioridad: Optional[str] = None
    titulo: Optional[str] = None
    problema_reportado: Optional[str] = None
    fecha_programada: Optional[date] = None
    fecha_checkin: Optional[datetime] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    duracion_real_minutos: Optional[int] = None
    subtmano_obra: Optional[Decimal] = None
    subtotal_materiales: Optional[Decimal] = None
    descuento: Optional[Decimal] = None
    iva: Optional[Decimal] = None
    total: Optional[Decimal] = None
    invoice_id: Optional[str] = None
    satisfaccion_nps: Optional[int] = None
    items: List[WorkOrderItemOut] = []
    created_at: Optional[datetime] = None


# ============================================================
# CONTRATOS
# ============================================================
class ServiceContractCreate(_Base):
    customer_id: str
    vertical_codigo: Optional[str] = None
    titulo: str
    descripcion: Optional[str] = None
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    duracion_meses: int = 12
    renovacion_auto: bool = False
    dias_aviso_renovacion: int = 30
    frecuencia_visitas: str = "mensual"
    visitas_incluidas_anio: int = 12
    incluye_emergencias: bool = False
    tiempo_respuesta_horas: int = 24
    tiempo_resolucion_horas: int = 72
    monto_mensual_pyg: Decimal = Decimal("0")
    descuento_pct: Decimal = Decimal("0")
    incluye_materiales: bool = False
    incluye_repuestos: bool = False
    equipos_cubiertos: Optional[List[str]] = None
    properties_cubiertas: Optional[List[str]] = None
    sla_texto: Optional[str] = None
    terminos_condiciones: Optional[str] = None
    notas: Optional[str] = None


class ServiceContractOut(_Base):
    id: Optional[str] = None
    company_id: Optional[str] = None
    numero: Optional[str] = None
    customer_id: Optional[str] = None
    customer_nombre: Optional[str] = None
    titulo: Optional[str] = None
    estado: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    duracion_meses: Optional[int] = None
    renovacion_auto: Optional[bool] = None
    frecuencia_visitas: Optional[str] = None
    visitas_incluidas_anio: Optional[int] = None
    visitas_realizadas: Optional[int] = None
    visitas_restantes: Optional[int] = None
    monto_mensual_pyg: Optional[Decimal] = None
    fecha_proximo_cobro: Optional[date] = None
    created_at: Optional[datetime] = None


class ContractVisitOut(_Base):
    id: Optional[str] = None
    contract_id: Optional[str] = None
    numero_visita: Optional[int] = None
    fecha_programada: Optional[date] = None
    fecha_realizada: Optional[date] = None
    work_order_id: Optional[str] = None
    technician_id: Optional[str] = None
    estado: Optional[str] = None
    tipo: Optional[str] = None
    completado_pct: Optional[Decimal] = None
    notas: Optional[str] = None


# ============================================================
# INVENTARIO
# ============================================================
class TruckInventoryOut(_Base):
    id: Optional[str] = None
    technician_id: Optional[str] = None
    technician_nombre: Optional[str] = None
    product_id: Optional[str] = None
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    cantidad_actual: Optional[Decimal] = None
    cantidad_minima: Optional[Decimal] = None
    cantidad_maxima: Optional[Decimal] = None
    ubicacion_vehiculo: Optional[str] = None
    necesita_reposicion: Optional[bool] = None


class InventoryMovementCreate(_Base):
    technician_id: Optional[str] = None
    product_id: str
    work_order_id: Optional[str] = None
    tipo: str
    cantidad: Decimal
    notas: Optional[str] = None


class InventoryMovementOut(_Base):
    id: Optional[str] = None
    product_id: Optional[str] = None
    tipo: Optional[str] = None
    cantidad: Optional[Decimal] = None
    stock_anterior: Optional[Decimal] = None
    stock_actual: Optional[Decimal] = None
    created_at: Optional[datetime] = None


# ============================================================
# FACTURAS
# ============================================================
class InvoicePaymentCreate(_Base):
    fecha: Optional[date] = None
    monto: Decimal
    metodo_pago: str
    referencia: Optional[str] = None
    banco: Optional[str] = None
    notas: Optional[str] = None


class InvoicePaymentOut(InvoicePaymentCreate):
    id: Optional[str] = None
    invoice_id: Optional[str] = None
    created_at: Optional[datetime] = None


class ServiceInvoiceOut(_Base):
    id: Optional[str] = None
    company_id: Optional[str] = None
    numero: Optional[str] = None
    customer_id: Optional[str] = None
    customer_nombre: Optional[str] = None
    work_order_id: Optional[str] = None
    contract_id: Optional[str] = None
    estado: Optional[str] = None
    fecha_emision: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    subtotal: Optional[Decimal] = None
    descuento: Optional[Decimal] = None
    iva: Optional[Decimal] = None
    total: Optional[Decimal] = None
    monto_pagado: Optional[Decimal] = None
    saldo: Optional[Decimal] = None
    dias_mora: Optional[int] = None
    sifen_cdc: Optional[str] = None
    pdf_url: Optional[str] = None
    payments: List[InvoicePaymentOut] = []
    created_at: Optional[datetime] = None


# ============================================================
# QUOTE REQUESTS (PUBLIC FORM)
# ============================================================
class QuoteRequestCreate(_Base):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    tipo_servicio: Optional[str] = None
    descripcion: Optional[str] = None
    fotos_urls: Optional[List[str]] = None
    urgencia: Optional[str] = "normal"
    fuente: Optional[str] = "web"


class QuoteRequestOut(QuoteRequestCreate):
    id: Optional[str] = None
    company_id: Optional[str] = None
    estado: Optional[str] = None
    quote_id: Optional[str] = None
    customer_id: Optional[str] = None
    fecha_contacto: Optional[datetime] = None
    created_at: Optional[datetime] = None


# ============================================================
# DASHBOARD
# ============================================================
class ServiciosDashboard(_Base):
    kpis_principales: Dict[str, Any]
    agenda_hoy: List[AppointmentOut] = []
    wo_en_progreso: List[WorkOrderOut] = []
    alertas_certificaciones: List[Dict[str, Any]] = []
    top_tecnicos: List[Dict[str, Any]] = []
    revenue_mes: Dict[str, Any]
    aging_facturas: Dict[str, Any]
    contratos_por_vencer: List[ServiceContractOut] = []
    queue_quote_requests: List[QuoteRequestOut] = []


# ============================================================
# REVIEWS
# ============================================================
class TechnicianReviewCreate(_Base):
    work_order_id: Optional[str] = None
    customer_id: str
    rating: int
    puntualidad: Optional[int] = None
    profesionalismo: Optional[int] = None
    calidad: Optional[int] = None
    limpieza: Optional[int] = None
    recomendaria: bool = True
    comentario: Optional[str] = None
    fotos_urls: Optional[List[str]] = None


class TechnicianReviewOut(TechnicianReviewCreate):
    id: Optional[str] = None
    company_id: Optional[str] = None
    technician_id: Optional[str] = None
    verificado: Optional[bool] = None
    created_at: Optional[datetime] = None
