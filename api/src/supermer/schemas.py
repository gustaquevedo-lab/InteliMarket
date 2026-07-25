"""Supermarket schemas"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


# ============================================================
# PRODUCTION RECIPES (BOM)
# ============================================================

class RecipeItemCreate(BaseModel):
    producto_id: str
    cantidad: Decimal
    unidad_medida: str = "UN"
    es_opcional: bool = False


class RecipeItemResponse(BaseModel):
    id: UUID
    producto_id: UUID
    cantidad: Decimal
    unidad_medida: str
    es_opcional: bool
    producto_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RecipeCreate(BaseModel):
    area: str
    nombre: str
    descripcion: Optional[str] = None
    producto_terminado_id: str
    cantidad_esperada: Decimal
    unidad_medida: str = "UN"
    rendimiento_esperado: Decimal = Field(Decimal("100"), ge=0, le=100)
    items: list[RecipeItemCreate]


class RecipeUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    cantidad_esperada: Optional[Decimal] = None
    rendimiento_esperado: Optional[Decimal] = None
    activa: Optional[bool] = None
    items: Optional[list[RecipeItemCreate]] = None


class RecipeResponse(BaseModel):
    id: UUID
    area: str
    nombre: str
    descripcion: Optional[str]
    producto_terminado_id: UUID
    cantidad_esperada: Decimal
    unidad_medida: str
    rendimiento_esperado: Decimal
    activa: bool
    items: list[RecipeItemResponse] = []
    producto_terminado_nombre: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# PRODUCTION ORDERS
# ============================================================

class ProductionOrderCreate(BaseModel):
    receta_id: str
    cantidad_objetivo: Decimal
    fecha_inicio: Optional[datetime] = None
    fecha_vencimiento: Optional[date] = None
    responsable_id: Optional[str] = None
    notas: Optional[str] = None


class ProductionOrderUpdate(BaseModel):
    cantidad_objetivo: Optional[Decimal] = None
    estado: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    fecha_vencimiento: Optional[date] = None
    responsable_id: Optional[str] = None
    notas: Optional[str] = None
    insumos_usados: Optional[dict] = None
    producto_obtenido: Optional[Decimal] = None
    rendimiento_real: Optional[Decimal] = None


class ProductionOrderResponse(BaseModel):
    id: UUID
    receta_id: Optional[UUID]
    area: str
    cantidad_objetivo: Decimal
    estado: str
    fecha_inicio: Optional[datetime]
    fecha_fin: Optional[datetime]
    fecha_vencimiento: Optional[date]
    responsable_id: Optional[UUID]
    notas: Optional[str]
    insumos_usados: Optional[dict]
    producto_obtenido: Optional[Decimal]
    rendimiento_real: Optional[Decimal]
    receta_nombre: Optional[str] = None
    responsable_nombre: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# PRODUCTION BATCHES
# ============================================================

class ProductionBatchCreate(BaseModel):
    orden_id: str
    producto_id: str
    cantidad_obtenida: Decimal
    fecha_vencimiento: date
    lote_codigo: Optional[str] = None
    costo_unitario: Optional[Decimal] = None


class ProductionBatchResponse(BaseModel):
    id: UUID
    orden_id: Optional[UUID]
    producto_id: UUID
    cantidad_obtenida: Decimal
    fecha_produccion: datetime
    fecha_vencimiento: date
    lote_codigo: Optional[str]
    costo_unitario: Optional[Decimal]
    producto_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# WASTE LOGS
# ============================================================

class WasteLogCreate(BaseModel):
    area: str
    producto_id: str
    cantidad: Decimal
    costo_unitario: Optional[Decimal] = None
    tipo_merma: str
    motivo: Optional[str] = None


class WasteLogResponse(BaseModel):
    id: UUID
    area: str
    producto_id: UUID
    cantidad: Decimal
    costo_unitario: Optional[Decimal]
    costo_total: Optional[Decimal]
    tipo_merma: str
    motivo: Optional[str]
    fecha: datetime
    registrado_por: Optional[UUID]
    producto_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# PERISHABLE CONFIG
# ============================================================

class PerishableConfigCreate(BaseModel):
    producto_id: str
    vida_util_dias: int
    requiere_markdown: bool = True
    categoria_perecedera: str


class PerishableConfigResponse(BaseModel):
    id: UUID
    producto_id: UUID
    vida_util_dias: int
    requiere_markdown: bool
    categoria_perecedera: str
    producto_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# MARKDOWN LOGS
# ============================================================

class MarkdownLogCreate(BaseModel):
    producto_id: str
    lote_id: Optional[str] = None
    descuento_porcentaje: Decimal
    precio_original: Decimal
    fecha_fin: Optional[datetime] = None
    motivo: Optional[str] = None


class MarkdownLogResponse(BaseModel):
    id: UUID
    producto_id: UUID
    lote_id: Optional[UUID]
    descuento_porcentaje: Decimal
    precio_original: Decimal
    precio_markdown: Decimal
    fecha_inicio: datetime
    fecha_fin: Optional[datetime]
    activo: bool
    motivo: Optional[str]
    producto_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# FORECAST & SUGGESTIONS
# ============================================================

class PurchaseForecastResponse(BaseModel):
    id: UUID
    producto_id: UUID
    fecha_pronosticada: date
    cantidad_pronosticada: Decimal
    confianza: Optional[Decimal]
    fecha_generacion: datetime
    producto_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PurchaseSuggestionCreate(BaseModel):
    producto_id: str
    proveedor_id: Optional[str] = None
    cantidad_sugerida: Decimal
    lead_time_dias: Optional[int] = None
    precio_estimado: Optional[Decimal] = None
    notas: Optional[str] = None


class PurchaseSuggestionUpdate(BaseModel):
    cantidad_sugerida: Optional[Decimal] = None
    estado: Optional[str] = None
    proveedor_id: Optional[str] = None
    precio_estimado: Optional[Decimal] = None
    notas: Optional[str] = None


class PurchaseSuggestionResponse(BaseModel):
    id: UUID
    producto_id: UUID
    proveedor_id: Optional[UUID]
    cantidad_sugerida: Decimal
    cantidad_stock_actual: Decimal
    cantidad_pendiente_recibir: Decimal
    cantidad_pronosticada: Optional[Decimal]
    lead_time_dias: Optional[int]
    fecha_sugerida_pedido: Optional[date]
    fecha_sugerida_llegada: Optional[date]
    precio_estimado: Optional[Decimal]
    costo_estimado_total: Optional[Decimal]
    estado: str
    notas: Optional[str]
    producto_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# DASHBOARD / REPORTS
# ============================================================

class DashboardStats(BaseModel):
    ordenes_activas: int
    ordenes_hoy: int
    total_producido_hoy: Decimal
    merma_diaria_total: Decimal
    merma_diaria_porcentaje: Decimal
    productos_en_markdown: int
    productos_por_vencer_30d: int
    alertas_criticas: int
    rendimiento_promedio: Optional[Decimal] = None
    sugerencias_pendientes: int
    forecast_actualizacion: Optional[datetime] = None


class WasteByArea(BaseModel):
    area: str
    total_cantidad: Decimal
    total_costo: Decimal
    cantidad_ordenes: int


class ProductionByArea(BaseModel):
    area: str
    total_producido: Decimal
    ordenes_completadas: int
    rendimiento_promedio: Optional[Decimal] = None
    merma_cantidad: Decimal
    merma_costo: Decimal


# ============================================================
# BUTCHERY (CARNICERÍA) — DESPOSTE
# ============================================================

class ButcheryTemplateCutCreate(BaseModel):
    producto_id: str
    rendimiento_porcentual: Decimal = Field(..., ge=0, le=100)
    precio_ponderado: Decimal = Field(Decimal("50"), ge=0, le=100)
    orden: int = 0
    es_subproducto: bool = False


class ButcheryTemplateCutResponse(BaseModel):
    id: UUID
    producto_id: UUID
    rendimiento_porcentual: Decimal
    precio_ponderado: Decimal
    orden: int
    es_subproducto: bool
    producto_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ButcheryTemplateCreate(BaseModel):
    nombre: str
    especie: str = "bovino"
    peso_promedio_kg: Decimal
    descripcion: Optional[str] = None
    cuts: list[ButcheryTemplateCutCreate]


class ButcheryTemplateResponse(BaseModel):
    id: UUID
    nombre: str
    especie: str
    peso_promedio_kg: Decimal
    descripcion: Optional[str]
    activa: bool
    cuts: list[ButcheryTemplateCutResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DesposteInput(BaseModel):
    template_id: str
    peso_entrada_kg: Decimal = Field(..., gt=0)
    costo_total_gs: Decimal = Field(..., gt=0)
    fecha_vencimiento: Optional[date] = None
    responsable_id: Optional[str] = None
    notas: Optional[str] = None


class DesposteCorteResult(BaseModel):
    producto_id: UUID
    producto_nombre: Optional[str]
    rendimiento_esperado: Decimal
    peso_obtenido_kg: Decimal
    costo_unitario_gs: Decimal
    precio_ponderado: Decimal
    es_subproducto: bool


class DesposteResponse(BaseModel):
    orden_id: UUID
    template_nombre: str
    peso_entrada_kg: Decimal
    costo_total_gs: Decimal
    peso_total_obtenido: Decimal
    merma_kg: Decimal
    merma_porcentaje: Decimal
    cortes: list[DesposteCorteResult]
    batches: list[ProductionBatchResponse]


class ButcheryYieldReport(BaseModel):
    template_nombre: str
    peso_total_procesado: Decimal
    peso_total_obtenido: Decimal
    rendimiento_promedio: Decimal
    merma_total: Decimal
    merma_porcentaje: Decimal
    cortes: list[dict]


# ============================================================
# BAKERY (PANADERÍA) — PLAN DIARIO + ESCALADO
# ============================================================

class BakeryPlanItemCreate(BaseModel):
    receta_id: str
    cantidad_objetivo: Decimal = Field(..., gt=0)
    prioridad: int = 0


class BakeryPlanItemResponse(BaseModel):
    id: UUID
    receta_id: UUID
    cantidad_objetivo: Decimal
    prioridad: int
    receta_nombre: Optional[str] = None
    producto_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BakeryPlanCreate(BaseModel):
    nombre: str
    dia_semana: int = Field(..., ge=0, le=7)
    items: list[BakeryPlanItemCreate]


class BakeryPlanResponse(BaseModel):
    id: UUID
    nombre: str
    dia_semana: int
    activo: bool
    items: list[BakeryPlanItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScaleRecipeInput(BaseModel):
    receta_id: str
    cantidad_deseada: Decimal = Field(..., gt=0, description="Cantidad de producto final deseada")


class ScaleRecipeResult(BaseModel):
    receta_nombre: str
    producto_terminado: str
    cantidad_base: Decimal
    cantidad_deseada: Decimal
    factor_escala: Decimal
    items: list[dict]
    insumos_totales: list[dict]


class ExecutePlanInput(BaseModel):
    plan_id: str
    fecha_ejecucion: Optional[date] = None
    responsable_id: Optional[str] = None
    notas: Optional[str] = None
    ajustes: Optional[dict[str, Decimal]] = None


class ExecutePlanResult(BaseModel):
    plan_nombre: str
    fecha: str
    ordenes_creadas: int
    ordenes: list[ProductionOrderResponse]


# ============================================================
# VERDULERÍA — RECEPCIÓN, AUDITORÍA, SCORECARD, FORECAST
# ============================================================

class ReceiveBatchCreate(BaseModel):
    producto_id: str
    proveedor_id: Optional[str] = None
    cantidad_recibida: Decimal = Field(..., gt=0)
    calidad: str = "estandar"
    precio_unitario: Optional[Decimal] = None
    fecha_recepcion: Optional[date] = None
    fecha_vencimiento_estimada: Optional[date] = None
    lote_proveedor: Optional[str] = None
    nota_calidad: Optional[str] = None
    rechazo_motivo: Optional[str] = None


class ReceiveBatchResponse(BaseModel):
    id: UUID
    producto_id: UUID
    proveedor_id: Optional[UUID]
    cantidad_recibida: Decimal
    cantidad_aceptada: Optional[Decimal]
    calidad: str
    precio_unitario: Optional[Decimal]
    fecha_recepcion: date
    fecha_vencimiento_estimada: Optional[date]
    lote_proveedor: Optional[str]
    lote_codigo_interno: Optional[str]
    nota_calidad: Optional[str]
    producto_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    dias_para_vencer: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FreshnessAuditCreate(BaseModel):
    producto_id: str
    batch_id: Optional[str] = None
    calidad_actual: str
    firmeza: Optional[int] = Field(None, ge=1, le=5)
    color: Optional[int] = Field(None, ge=1, le=5)
    aspecto_general: Optional[int] = Field(None, ge=1, le=5)
    notas: Optional[str] = None


class FreshnessAuditResponse(BaseModel):
    id: UUID
    producto_id: UUID
    batch_id: Optional[UUID]
    calidad_actual: str
    firmeza: Optional[int]
    color: Optional[int]
    aspecto_general: Optional[int]
    notas: Optional[str]
    audited_at: datetime
    triggered_markdown: bool
    producto_nombre: Optional[str] = None
    batch_calidad: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SupplierScorecardResponse(BaseModel):
    id: UUID
    proveedor_id: UUID
    producto_id: UUID
    total_recibido: Decimal
    calidad_promedio: Optional[str]
    merma_porcentaje: Decimal
    rechazos: int
    entregas_puntuales: int
    total_entregas: int
    precio_promedio: Optional[Decimal]
    puntaje_general: Optional[Decimal]
    recomendacion: str
    periodo_inicio: Optional[date]
    periodo_fin: Optional[date]
    proveedor_nombre: Optional[str] = None
    producto_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AutoApplyMarkdownByBatchInput(BaseModel):
    dias_umbral_verde: int = 2
    dias_umbral_amarillo: int = 1
    descuento_amarillo: Decimal = Field(Decimal("20"), ge=0, le=100)
    descuento_rojo: Decimal = Field(Decimal("50"), ge=0, le=100)


class AutoApplyMarkdownResult(BaseModel):
    markdowns_aplicados: int
    total_descuento_promedio: Decimal
    productos: list[dict]


class ForecastEnhanceInput(BaseModel):
    producto_ids: list[str] = Field(default_factory=list)
    periodo_dias: int = 90
    incluir_clima: bool = False
    incluir_estacionalidad: bool = True
