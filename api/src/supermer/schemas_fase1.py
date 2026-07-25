"""Fase 1 — Schemas for Rotisería, HACCP, Store Audits, Equipment Maintenance"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ============================================================
# ROTISERÍA SCHEMAS
# ============================================================

class RotiseriaRecipeItemCreate(BaseModel):
    producto_id: UUID
    cantidad: Decimal
    unidad_medida: Optional[str] = None
    es_opcional: bool = False

class RotiseriaRecipeItemResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    cantidad: Decimal
    unidad_medida: Optional[str] = None
    es_opcional: bool

class RotiseriaRecipeCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    area: str
    holding_method: str
    factor_coccion: Decimal = Decimal("1.0")
    factor_merma_coccion: Optional[Decimal] = None
    producto_terminado_id: UUID
    cantidad_esperada: Decimal
    unidad_medida: str = "unidad"
    temp_min_conservacion: Optional[Decimal] = None
    temp_max_conservacion: Optional[Decimal] = None
    tiempo_maximo_exhibicion_hs: Optional[Decimal] = None
    requiere_etiquetado: bool = True
    alérgenos: Optional[list[str]] = None
    costo_estimado_porcion: Optional[Decimal] = None
    precio_sugerido: Optional[Decimal] = None
    margen_objetivo_pct: Optional[Decimal] = None
    items: list[RotiseriaRecipeItemCreate] = []

class RotiseriaRecipeUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    area: Optional[str] = None
    holding_method: Optional[str] = None
    factor_coccion: Optional[Decimal] = None
    factor_merma_coccion: Optional[Decimal] = None
    producto_terminado_id: Optional[UUID] = None
    cantidad_esperada: Optional[Decimal] = None
    unidad_medida: Optional[str] = None
    temp_min_conservacion: Optional[Decimal] = None
    temp_max_conservacion: Optional[Decimal] = None
    tiempo_maximo_exhibicion_hs: Optional[Decimal] = None
    requiere_etiquetado: Optional[bool] = None
    alérgenos: Optional[list[str]] = None
    activa: Optional[bool] = None
    items: Optional[list[RotiseriaRecipeItemCreate]] = None

class RotiseriaRecipeResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    descripcion: Optional[str] = None
    area: str
    holding_method: str
    factor_coccion: Decimal
    factor_merma_coccion: Optional[Decimal] = None
    producto_terminado_id: UUID
    producto_terminado_nombre: Optional[str] = None
    cantidad_esperada: Decimal
    unidad_medida: str
    temp_min_conservacion: Optional[Decimal] = None
    temp_max_conservacion: Optional[Decimal] = None
    tiempo_maximo_exhibicion_hs: Optional[Decimal] = None
    requiere_etiquetado: bool
    alérgenos: Optional[list[str]] = None
    costo_estimado_porcion: Optional[Decimal] = None
    precio_sugerido: Optional[Decimal] = None
    margen_objetivo_pct: Optional[Decimal] = None
    activa: bool
    items: list[RotiseriaRecipeItemResponse] = []
    created_at: datetime
    updated_at: datetime

class RotiseriaPlanCreate(BaseModel):
    receta_id: UUID
    fecha: date
    cantidad_objetivo: Decimal
    responsable_id: Optional[UUID] = None
    notas: Optional[str] = None

class RotiseriaPlanUpdate(BaseModel):
    cantidad_objetivo: Optional[Decimal] = None
    cantidad_producida: Optional[Decimal] = None
    estado: Optional[str] = None
    hora_inicio: Optional[datetime] = None
    hora_fin: Optional[datetime] = None
    notas: Optional[str] = None

class RotiseriaTemperatureLogCreate(BaseModel):
    punto_control: str
    tipo: str
    temperatura: Decimal
    temp_min_requerida: Optional[Decimal] = None
    temp_max_requerida: Optional[Decimal] = None
    observaciones: Optional[str] = None

class RotiseriaTemperatureLogResponse(BaseModel):
    id: UUID
    plan_id: UUID
    punto_control: str
    tipo: str
    temperatura: Decimal
    temp_min_requerida: Optional[Decimal] = None
    temp_max_requerida: Optional[Decimal] = None
    conforme: Optional[bool] = None
    registrado_por: Optional[UUID] = None
    registrado_at: datetime
    observaciones: Optional[str] = None

class RotiseriaLabelCreate(BaseModel):
    producto_id: UUID
    cantidad: Decimal
    lote_codigo: str
    fecha_elaboracion: date
    fecha_vencimiento: date
    ingredientes: Optional[str] = None
    alérgenos: Optional[list[str]] = None
    precio_unitario: Optional[Decimal] = None

class RotiseriaLabelResponse(BaseModel):
    id: UUID
    plan_id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    cantidad: Decimal
    lote_codigo: str
    fecha_elaboracion: date
    fecha_vencimiento: date
    alérgenos: Optional[list[str]] = None
    precio_unitario: Optional[Decimal] = None
    created_at: datetime

class RotiseriaDashboard(BaseModel):
    ordenes_hoy: int = 0
    total_producido_hoy: Decimal = Decimal("0")
    recetas_activas: int = 0
    puntos_calientes_activos: int = 0
    temp_fuera_rango: int = 0
    markdowns_sugeridos: int = 0
    produccion_por_receta: list[dict] = []


# ============================================================
# HACCP SCHEMAS
# ============================================================

class HaccpPlanCreate(BaseModel):
    nombre: str
    area: str
    descripcion: Optional[str] = None

class HaccpPlanUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None
    version: Optional[int] = None

class HaccpPlanResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    area: str
    descripcion: Optional[str] = None
    version: int
    activo: bool
    critical_points: list = []
    created_at: datetime
    updated_at: datetime

class HaccpCriticalPointCreate(BaseModel):
    plan_id: UUID
    nombre: str
    tipo: str
    riesgo: str
    limite_inferior: Optional[Decimal] = None
    limite_superior: Optional[Decimal] = None
    unidad: Optional[str] = None
    frecuencia_monitoreo_min: Optional[int] = None
    metodo_monitoreo: Optional[str] = None
    accion_correctiva_template: Optional[str] = None
    sensor_ids: Optional[list[str]] = None
    orden: int = 0

class HaccpCriticalPointUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    riesgo: Optional[str] = None
    limite_inferior: Optional[Decimal] = None
    limite_superior: Optional[Decimal] = None
    unidad: Optional[str] = None
    frecuencia_monitoreo_min: Optional[int] = None
    metodo_monitoreo: Optional[str] = None
    activo: Optional[bool] = None

class HaccpCriticalPointResponse(BaseModel):
    id: UUID
    plan_id: UUID
    nombre: str
    tipo: str
    riesgo: str
    limite_inferior: Optional[Decimal] = None
    limite_superior: Optional[Decimal] = None
    unidad: Optional[str] = None
    frecuencia_monitoreo_min: Optional[int] = None
    metodo_monitoreo: Optional[str] = None
    accion_correctiva_template: Optional[str] = None
    activo: bool
    orden: int

class HaccpMonitoringLogCreate(BaseModel):
    valor: Decimal
    fuente: str = "manual"
    sensor_id: Optional[UUID] = None
    observaciones: Optional[str] = None

class HaccpMonitoringLogResponse(BaseModel):
    id: UUID
    critical_point_id: UUID
    valor: Decimal
    conforme: bool
    fuente: str
    sensor_id: Optional[UUID] = None
    registrado_por: Optional[UUID] = None
    registrado_at: datetime
    observaciones: Optional[str] = None

class HaccpCorrectiveActionCreate(BaseModel):
    monitoring_log_id: UUID
    critical_point_id: UUID
    descripcion: str
    accion_tomada: str
    responsable_id: UUID
    producto_afectado_id: Optional[UUID] = None
    disposicion: Optional[str] = None
    cantidad_afectada: Optional[Decimal] = None
    costo_perdida: Optional[Decimal] = None

class HaccpCorrectiveActionResponse(BaseModel):
    id: UUID
    monitoring_log_id: UUID
    critical_point_id: UUID
    descripcion: str
    accion_tomada: str
    responsable_id: UUID
    producto_afectado_id: Optional[UUID] = None
    disposicion: Optional[str] = None
    cantidad_afectada: Optional[Decimal] = None
    costo_perdida: Optional[Decimal] = None
    resuelto: bool
    resuelto_at: Optional[datetime] = None
    created_at: datetime

class HaccpComplianceReport(BaseModel):
    periodo: str
    total_puntos_criticos: int = 0
    monitoreos_realizados: int = 0
    conformidad_pct: Decimal = Decimal("0")
    acciones_correctivas: int = 0
    costo_total_perdidas: Decimal = Decimal("0")
    puntos_fuera_control: list[dict] = []
    por_area: list[dict] = []

class HaccpDashboard(BaseModel):
    planes_activos: int = 0
    puntos_criticos: int = 0
    monitoreos_hoy: int = 0
    conformidad_pct: Decimal = Decimal("0")
    alertas_activas: int = 0
    acciones_pendientes: int = 0


# ============================================================
# AUDITORÍA SCHEMAS
# ============================================================

class AuditTemplateItemCreate(BaseModel):
    orden: int
    pregunta: str
    tipo_respuesta: str
    peso: Decimal = Decimal("1.0")
    opciones: Optional[list] = None
    instrucciones: Optional[str] = None

class AuditTemplateItemResponse(BaseModel):
    id: UUID
    template_id: UUID
    orden: int
    pregunta: str
    tipo_respuesta: str
    peso: Decimal
    opciones: Optional[list] = None
    instrucciones: Optional[str] = None

class AuditTemplateCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    area: str
    schedule: str
    peso_porcentual: Decimal = Decimal("100.0")
    puntaje_minimo_aprobacion: Decimal = Decimal("70.0")
    items: list[AuditTemplateItemCreate] = []

class AuditTemplateUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    area: Optional[str] = None
    schedule: Optional[str] = None
    activo: Optional[bool] = None

class AuditTemplateResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    descripcion: Optional[str] = None
    area: str
    schedule: str
    peso_porcentual: Decimal
    puntaje_minimo_aprobacion: Decimal
    activo: bool
    version: int
    items: list[AuditTemplateItemResponse] = []
    created_at: datetime
    updated_at: datetime

class AuditAnswerCreate(BaseModel):
    template_item_id: UUID
    valor: str
    conforme: Optional[bool] = None
    foto_url: Optional[str] = None
    observaciones: Optional[str] = None

class AuditAnswerResponse(BaseModel):
    id: UUID
    execution_id: UUID
    template_item_id: UUID
    valor: str
    conforme: Optional[bool] = None
    foto_url: Optional[str] = None
    observaciones: Optional[str] = None

class AuditExecutionCreate(BaseModel):
    template_id: UUID
    supervisor_id: Optional[UUID] = None
    notas_generales: Optional[str] = None

class AuditExecutionResponse(BaseModel):
    id: UUID
    company_id: UUID
    template_id: UUID
    template_nombre: Optional[str] = None
    area: Optional[str] = None
    fecha: date
    hora: datetime
    ejecutado_por: UUID
    ejecutado_por_nombre: Optional[str] = None
    puntaje_total: Optional[Decimal] = None
    puntaje_maximo: Optional[Decimal] = None
    porcentaje: Optional[Decimal] = None
    aprobado: Optional[bool] = None
    estado: str
    answers: list[AuditAnswerResponse] = []
    created_at: datetime

class AuditDashboard(BaseModel):
    ejecuciones_hoy: int = 0
    ejecuciones_semana: int = 0
    promedio_porcentaje: Decimal = Decimal("0")
    aprobadas: int = 0
    rechazadas: int = 0
    por_area: list[dict] = []
    tendencia_semanal: list[dict] = []


# ============================================================
# MANTENIMIENTO DE EQUIPOS SCHEMAS
# ============================================================

class EquipmentCreate(BaseModel):
    nombre: str
    categoria: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    codigo_inventario: Optional[str] = None
    area: Optional[str] = None
    ubicacion: Optional[str] = None
    fecha_instalacion: Optional[date] = None
    capacidad: Optional[str] = None
    eficiencia_energetica: Optional[str] = None
    consumo_estimado_kwh: Optional[Decimal] = None
    temp_min_operacion: Optional[Decimal] = None
    temp_max_operacion: Optional[Decimal] = None
    alerta_habilitada: bool = True
    proveedor_mantenimiento: Optional[str] = None
    garantia_vencimiento: Optional[date] = None
    costo_adquisicion: Optional[Decimal] = None
    notas: Optional[str] = None

class EquipmentUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    area: Optional[str] = None
    ubicacion: Optional[str] = None
    activo: Optional[bool] = None
    fecha_ultimo_mantenimiento: Optional[date] = None
    fecha_proximo_mantenimiento: Optional[date] = None
    proveedor_mantenimiento: Optional[str] = None
    notas: Optional[str] = None

class EquipmentResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    categoria: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    numero_serie: Optional[str] = None
    codigo_inventario: Optional[str] = None
    area: Optional[str] = None
    ubicacion: Optional[str] = None
    activo: bool
    fecha_instalacion: Optional[date] = None
    fecha_ultimo_mantenimiento: Optional[date] = None
    fecha_proximo_mantenimiento: Optional[date] = None
    capacidad: Optional[str] = None
    eficiencia_energetica: Optional[str] = None
    consumo_estimado_kwh: Optional[Decimal] = None
    temp_min_operacion: Optional[Decimal] = None
    temp_max_operacion: Optional[Decimal] = None
    alerta_habilitada: bool
    proveedor_mantenimiento: Optional[str] = None
    garantia_vencimiento: Optional[date] = None
    costo_adquisicion: Optional[Decimal] = None
    notas: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class EquipmentScheduleCreate(BaseModel):
    equipo_id: UUID
    tipo: str
    frecuencia_dias: int
    frecuencia_instrucciones: Optional[str] = None
    tareas: list
    duracion_estimada_min: Optional[int] = None
    prioridad: str = "media"

class EquipmentScheduleUpdate(BaseModel):
    tipo: Optional[str] = None
    frecuencia_dias: Optional[int] = None
    tareas: Optional[list] = None
    duracion_estimada_min: Optional[int] = None
    prioridad: Optional[str] = None
    activo: Optional[bool] = None

class EquipmentScheduleResponse(BaseModel):
    id: UUID
    company_id: UUID
    equipo_id: UUID
    equipo_nombre: Optional[str] = None
    tipo: str
    frecuencia_dias: int
    tareas: list
    duracion_estimada_min: Optional[int] = None
    prioridad: str
    activo: bool
    created_at: datetime

class WorkOrderCreate(BaseModel):
    equipo_id: UUID
    schedule_id: Optional[UUID] = None
    tipo: str
    prioridad: str = "media"
    descripcion_falla: Optional[str] = None
    sintomas: Optional[list[str]] = None
    asignado_a: Optional[UUID] = None
    fecha_programada: Optional[date] = None
    notas: Optional[str] = None

class WorkOrderUpdate(BaseModel):
    estado: Optional[str] = None
    asignado_a: Optional[UUID] = None
    fecha_programada: Optional[date] = None
    notas: Optional[str] = None

class WorkOrderComplete(BaseModel):
    diagnostico: str
    acciones_realizadas: str
    repuestos_utilizados: Optional[list[dict]] = None
    horas_trabajadas: Optional[Decimal] = None
    costo_repuestos: Optional[Decimal] = None
    costo_mano_obra: Optional[Decimal] = None
    resultado: str = "resuelto"
    requiere_seguimiento: bool = False

class WorkOrderResponse(BaseModel):
    id: UUID
    company_id: UUID
    equipo_id: UUID
    equipo_nombre: Optional[str] = None
    numero_ot: str
    tipo: str
    prioridad: str
    estado: str
    descripcion_falla: Optional[str] = None
    sintomas: Optional[list[str]] = None
    asignado_a: Optional[UUID] = None
    asignado_nombre: Optional[str] = None
    fecha_programada: Optional[date] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    horas_trabajadas: Optional[Decimal] = None
    costo_total: Optional[Decimal] = None
    diagnostico: Optional[str] = None
    acciones_realizadas: Optional[str] = None
    resultado: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class EquipmentAlertResponse(BaseModel):
    id: UUID
    equipo_id: UUID
    equipo_nombre: Optional[str] = None
    tipo: str
    severidad: str
    mensaje: str
    resuelta: bool
    created_at: datetime

class EquipmentDashboard(BaseModel):
    total_equipos: int = 0
    equipos_activos: int = 0
    mantenimientos_pendientes: int = 0
    ordenes_abiertas: int = 0
    alertas_activas: int = 0
    por_categoria: list[dict] = []
    proximos_mantenimientos: list[dict] = []
    costo_mantenimiento_mes: Decimal = Decimal("0")
    uptime_promedio_pct: Decimal = Decimal("0")

class AutoMarkdownRotiseriaInput(BaseModel):
    hora_limite: Optional[str] = None  # "19:00"
    descuento_minimo: Optional[Decimal] = None
    descuento_maximo: Optional[Decimal] = None
    auto_aplicar: bool = False
