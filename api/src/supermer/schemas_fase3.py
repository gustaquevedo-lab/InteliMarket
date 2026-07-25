"""Fase 3 — Schemas for Pricing, ESL, Promotions, Dynamic Markdown

💡 UX GUIDELINES for operators:
- Prices are in Gs (guaraníes), always show with formatPYG()
- Diferencia_pct helps operators know if a change is significant (>10% requires approval)
- For psychological pricing, the system suggests .990/.900 endings automatically
- ESL sync workflow: price change → send to ESL → verify confirmation
- Promo effectiveness shows lift vs canibalización to prevent margin erosion
- Markdown recommendations include urgency score (1-100) so operators prioritize
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ============================================================
# PRICE ZONES
# ============================================================

class PriceZoneCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    tipo: str = "sucursal"
    activa: bool = True

class PriceZoneResponse(BaseModel):
    id: UUID
    nombre: str
    descripcion: Optional[str] = None
    tipo: str
    activa: bool
    created_at: datetime

class PriceZoneUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    activa: Optional[bool] = None


# ============================================================
# COMPETITOR PRICES
# ============================================================

class CompetitorPriceCreate(BaseModel):
    producto_id: UUID
    competidor: str
    precio: Decimal
    fecha_captura: Optional[datetime] = None
    fuente: str = "manual"

class CompetitorPriceResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    competidor: str
    precio: Decimal
    fecha_captura: datetime
    fuente: str
    diferencia_pct: Optional[Decimal] = None
    created_at: datetime


# ============================================================
# PRICE AUDIT LOG
# ============================================================

class PriceAuditLogCreate(BaseModel):
    producto_id: UUID
    precio_anterior: Optional[Decimal] = None
    precio_nuevo: Decimal
    motivo: str
    requiere_aprobacion: bool = False

class PriceAuditLogResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    precio_anterior: Optional[Decimal] = None
    precio_nuevo: Decimal
    diferencia_pct: Optional[Decimal] = None
    motivo: str
    cambiado_por: UUID
    cambiado_at: datetime
    requiere_aprobacion: bool
    aprobado_por: Optional[UUID] = None
    aprobado_at: Optional[datetime] = None
    estado: str
    created_at: datetime


# ============================================================
# PSYCHOLOGICAL PRICING
# ============================================================

class PsychologicalRuleCreate(BaseModel):
    nombre: str
    tipo_redondeo: str = ".990"
    limite_superior: Optional[Decimal] = None
    activa: bool = True

class PsychologicalRuleResponse(BaseModel):
    id: UUID
    nombre: str
    tipo_redondeo: str
    limite_superior: Optional[Decimal] = None
    activa: bool
    created_at: datetime


# ============================================================
# ESL
# ============================================================

class EslZoneCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class EslZoneResponse(BaseModel):
    id: UUID
    nombre: str
    descripcion: Optional[str] = None
    created_at: datetime

class EslDeviceCreate(BaseModel):
    codigo_dispositivo: str
    producto_id: Optional[UUID] = None
    precio_actual: Optional[Decimal] = None
    ubicacion: Optional[str] = None
    zona_id: Optional[UUID] = None
    bateria_pct: Optional[int] = None

class EslDeviceUpdate(BaseModel):
    producto_id: Optional[UUID] = None
    ubicacion: Optional[str] = None
    zona_id: Optional[UUID] = None
    estado: Optional[str] = None
    bateria_pct: Optional[int] = None

class EslDeviceResponse(BaseModel):
    id: UUID
    codigo_dispositivo: str
    producto_id: Optional[UUID] = None
    producto_nombre: Optional[str] = None
    precio_actual: Optional[Decimal] = None
    ubicacion: Optional[str] = None
    zona_id: Optional[UUID] = None
    zona_nombre: Optional[str] = None
    estado: str
    bateria_pct: Optional[int] = None
    ultima_sync: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class EslSyncCreate(BaseModel):
    esl_device_id: UUID
    producto_id: UUID
    precio_nuevo: Decimal

class EslSyncResponse(BaseModel):
    id: UUID
    esl_device_id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    precio_anterior: Optional[Decimal] = None
    precio_nuevo: Decimal
    estado: str
    intentos: int
    error_msg: Optional[str] = None
    created_at: datetime
    completado_at: Optional[datetime] = None

class EslDashboard(BaseModel):
    total_dispositivos: int = 0
    online: int = 0
    offline: int = 0
    bateria_baja: int = 0
    syncs_pendientes: int = 0
    syncs_error: int = 0
    precio_actualizado_24h: int = 0


# ============================================================
# PROMOTIONS
# ============================================================

class PromoCalendarCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: date
    fecha_fin: date
    tipo: str
    presupuesto_asignado: Optional[Decimal] = None

class PromoCalendarUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    presupuesto_asignado: Optional[Decimal] = None
    estado: Optional[str] = None

class PromoCalendarResponse(BaseModel):
    id: UUID
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: date
    fecha_fin: date
    tipo: str
    presupuesto_asignado: Optional[Decimal] = None
    estado: str
    created_at: datetime
    updated_at: datetime

class PromoBudgetCreate(BaseModel):
    promo_id: UUID
    categoria: str
    presupuesto_planificado: Optional[Decimal] = None
    gasto_real: Optional[Decimal] = None

class PromoBudgetResponse(BaseModel):
    id: UUID
    promo_id: UUID
    categoria: str
    presupuesto_planificado: Optional[Decimal] = None
    gasto_real: Optional[Decimal] = None
    created_at: datetime

class PromoEffectivenessCreate(BaseModel):
    promo_id: UUID
    producto_id: Optional[UUID] = None
    ventas_durante: Optional[Decimal] = None
    ventas_antes: Optional[Decimal] = None
    ventas_despues: Optional[Decimal] = None

class PromoEffectivenessResponse(BaseModel):
    id: UUID
    promo_id: UUID
    producto_id: Optional[UUID] = None
    producto_nombre: Optional[str] = None
    ventas_durante: Optional[Decimal] = None
    ventas_antes: Optional[Decimal] = None
    ventas_despues: Optional[Decimal] = None
    lift_pct: Optional[Decimal] = None
    margen_incremental: Optional[Decimal] = None
    canibalizacion_pct: Optional[Decimal] = None
    created_at: datetime

class PromoDashboard(BaseModel):
    promos_activas: int = 0
    promos_planificadas: int = 0
    completadas_mes: int = 0
    presupuesto_total_mes: Decimal = Decimal("0")
    lift_promedio_pct: Decimal = Decimal("0")
    effectiveness_count: int = 0


# ============================================================
# DYNAMIC MARKDOWN
# ============================================================

class DynamicMarkdownRuleCreate(BaseModel):
    producto_id: Optional[UUID] = None
    categoria: Optional[str] = None
    estrategia: str = "moderada"
    descuento_maximo_pct: Decimal
    descuento_minimo_pct: Optional[Decimal] = None
    horas_limite: Optional[int] = None
    activa: bool = True

class DynamicMarkdownRuleUpdate(BaseModel):
    estrategia: Optional[str] = None
    descuento_maximo_pct: Optional[Decimal] = None
    descuento_minimo_pct: Optional[Decimal] = None
    horas_limite: Optional[int] = None
    activa: Optional[bool] = None

class DynamicMarkdownRuleResponse(BaseModel):
    id: UUID
    producto_id: Optional[UUID] = None
    producto_nombre: Optional[str] = None
    categoria: Optional[str] = None
    estrategia: str
    descuento_maximo_pct: Decimal
    descuento_minimo_pct: Optional[Decimal] = None
    horas_limite: Optional[int] = None
    activa: bool
    created_at: datetime
    updated_at: datetime

class MarkdownRecommendationResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    precio_original: Decimal
    descuento_recomendado_pct: Decimal
    precio_recomendado: Decimal
    motivo: Optional[str] = None
    score_urgencia: int
    aplicada: bool
    aplicada_at: Optional[datetime] = None
    created_at: datetime

class MarkdownApplyInput(BaseModel):
    recommendation_ids: list[UUID]

class MarkdownGenerateInput(BaseModel):
    solo_urgentes: bool = False
    max_recommendations: Optional[int] = None

class MarkdownDashboard(BaseModel):
    reglas_activas: int = 0
    recomendaciones_hoy: int = 0
    aplicadas_hoy: int = 0
    ahorro_estimado: Decimal = Decimal("0")
    urgencia_alta: int = 0
    efectividad_promedio: Decimal = Decimal("0")
