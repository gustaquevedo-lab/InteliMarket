from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class TriggerRunRequest(BaseModel):
    company_id: UUID


class DecisionRequest(BaseModel):
    approved_by: UUID
    comments: Optional[str] = None


class ApplyPriceRequest(BaseModel):
    company_id: UUID
    product_id: UUID
    nuevo_precio: Decimal
    motivo: Optional[str] = None
    escalas: Optional[list[dict]] = None


class ChatMessageRequest(BaseModel):
    company_id: UUID
    message: str
    context_tab: Optional[str] = "general"
    conversation_history: Optional[list[dict]] = None


class ActionOutcome(BaseModel):
    tipo: str  # "price_adjustment", "daily_task", "promo_bundle", "supplier_negotiation"
    titulo: str
    descripcion: str
    data: dict = Field(default_factory=dict)
    ejecutable: bool = True


class ChatMessageResponse(BaseModel):
    reply: str
    action_outcome: Optional[ActionOutcome] = None
    suggested_prompts: list[str] = Field(default_factory=list)


class PriceTierScale(BaseModel):
    min_qty: int
    precio_unitario: Decimal
    descuento_pct: float
    descripcion: str


class PriceProposal(BaseModel):
    id: str
    product_id: UUID
    nombre: str
    categoria: str
    precio_actual: Decimal
    costo_unitario: Decimal
    margen_actual_pct: float
    precio_sugerido: Decimal
    margen_sugerido_pct: float
    impacto_mensual_gs: Decimal
    tipo_estrategia: str  # "kvi_gancho", "margin_driver", "recuperacion_gap"
    motivo: str
    escalas_precio: list[PriceTierScale] = Field(default_factory=list)
    promocion_activa: Optional[str] = None
    estado: str = "pendiente"


class DailyActionItem(BaseModel):
    id: str
    titulo: str
    area: str
    descripcion: str
    impacto_esperado: str
    responsable_sugerido: str
    prioridad: str  # "alta", "critica", "media"
    estado: str = "pendiente"  # "pendiente", "en_curso", "completado"


class SalesRecommendationResponse(BaseModel):
    id: UUID
    company_id: UUID
    run_id: UUID
    tipo: str
    titulo: str
    descripcion: str
    entidad_relacionada: Optional[str] = None
    monto_relacionado: Optional[str] = None
    requested_by: str
    approved_by: Optional[UUID] = None
    status: str
    comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesAgentRunResponse(BaseModel):
    id: UUID
    company_id: UUID
    started_at: datetime
    finished_at: Optional[datetime] = None
    model: Optional[str] = None
    status: str
    diagnostico: Optional[str] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class SalesRentabilidadExecutive(BaseModel):
    margen_actual_pct: float
    margen_minimo_target_pct: float = 20.0
    margen_ideal_target_pct: float = 24.0
    facturacion_mes: Decimal
    costo_ventas_mes: Decimal
    ganancia_bruta_mes: Decimal
    proyeccion_cierre_mes_gs: Decimal = Decimal("0")
    tickets_mes: int = 0
    gap_para_20_pct_gs: Decimal
    gap_para_24_pct_gs: Decimal
    estado_salud_margen: str  # "critico", "regular", "saludable", "optimo"
    resumen_ejecutivo: str
    rentabilidad_por_departamento: list[dict]
    pareto_resumen: dict
    propuestas_precios: list[PriceProposal]
    plan_accion_diario: list[DailyActionItem]

class SalesPeriodFilter(BaseModel):
    periodo_tipo: str = "mes_actual"  # mes_actual, mes_anterior, ultimos_30_dias, personalizado
    fecha_desde: Optional[datetime] = None
    fecha_hasta: Optional[datetime] = None


class ParetoItem(BaseModel):
    product_id: UUID
    codigo_barra: Optional[str] = None
    nombre: str
    categoria: str
    unidades_vendidas: Decimal
    facturacion_total: Decimal
    cmv_total: Decimal
    ganancia_bruta: Decimal
    margen_bruto_pct: float
    participacion_pct: float
    acumulado_pct: float
    clase: str  # "A", "B", "C"


class ParetoSummary(BaseModel):
    total_skus: int
    facturacion_total: Decimal
    ganancia_total: Decimal
    clase_a_skus: int
    clase_a_pct: float
    clase_b_skus: int
    clase_b_pct: float
    clase_c_skus: int
    clase_c_pct: float


class ParetoResponse(BaseModel):
    resumen: ParetoSummary
    items: list[ParetoItem]
    total_items: int
    page: int
    page_size: int


class CategoryAdjustment(BaseModel):
    categoria: str
    variacion_pct: float  # ej. 4.0 para +4%


class SkuAdjustment(BaseModel):
    product_id: UUID
    nuevo_precio: Decimal


class MarginSimulationRequest(BaseModel):
    company_id: UUID
    periodo_tipo: str = "mes_actual"
    fecha_desde: Optional[datetime] = None
    fecha_hasta: Optional[datetime] = None
    ajustes_categoria: list[CategoryAdjustment] = Field(default_factory=list)
    ajustes_sku: list[SkuAdjustment] = Field(default_factory=list)


class MarginSimulationResponse(BaseModel):
    margen_actual_pct: float
    margen_simulado_pct: float
    facturacion_base: Decimal
    facturacion_simulada: Decimal
    ganancia_adicional_gs: Decimal
    gap_actual_gs: Decimal
    gap_restante_gs: Decimal
    reduccion_gap_pct: float
    desglose_categorias: list[dict] = Field(default_factory=list)


class KviToggleRequest(BaseModel):
    company_id: UUID
    product_id: UUID
    es_gancho: bool
    motivo: Optional[str] = None
    margen_techo_pct: Optional[float] = 15.0


class KviProductResponse(BaseModel):
    product_id: UUID
    es_gancho: bool
    margen_techo_pct: float
    motivo_gancho: str


class SettingsUpdateRequest(BaseModel):
    company_id: UUID
    target_margen_minimo_pct: float
    target_margen_ideal_pct: float
    metas_por_categoria: Optional[dict[str, float]] = None


class SalesAgentSettingsResponse(BaseModel):
    target_margen_minimo_pct: float
    target_margen_ideal_pct: float
    metas_por_categoria: dict[str, float]


class BusinessRuleCreateRequest(BaseModel):
    company_id: UUID
    regla: str
    categoria: Optional[str] = "comercial"
    origen: Optional[str] = "usuario_manual"


class BusinessRuleResponse(BaseModel):
    id: UUID
    regla: str
    categoria: Optional[str] = None
    origen: str
    activa: bool
    confianza: float
    created_at: datetime


class ActionTaskUpdateRequest(BaseModel):
    task_id: UUID
    estado: str  # "pendiente", "en_progreso", "completado", "descartado"
    motivo_descarte: Optional[str] = None
    completado_por: Optional[str] = None


class ExecuteActionTaskRequest(BaseModel):
    task_id: UUID
    company_id: UUID
    tipo_accion: str
    telefono_whatsapp: Optional[str] = None

