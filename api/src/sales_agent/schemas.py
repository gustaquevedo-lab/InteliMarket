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
