"""Schemas del Gerente de Marketing IA (CMO Virtual) -- inteligencia híbrida y sincronización tripartita."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ActionOutcome(BaseModel):
    tipo: str  # pos_promotion, kiosk_banner, whatsapp_blast, memory_rule, directive_ack
    titulo: str
    descripcion: str
    data: Optional[Dict[str, Any]] = None
    ejecutable: bool = False


class CustomerSegment(BaseModel):
    id: str
    nombre: str
    cantidad: int
    criterio: str
    ticket_promedio_gs: float = 0.0
    gasto_total_gs: float = 0.0


class TopProductHabit(BaseModel):
    producto_nombre: str
    compras_count: int
    total_gastado_gs: float


class CustomerProfileDetail(BaseModel):
    id: str
    nombre: str
    documento: str
    telefono: Optional[str] = None
    barrio: Optional[str] = None
    ciudad: str = "Pedro Juan Caballero"
    ticket_promedio_gs: float = 0.0
    total_gastado_gs: float = 0.0
    cantidad_compras: int = 0
    dias_inactivo: Optional[int] = None
    segmento: str = "General"
    productos_favoritos: List[TopProductHabit] = Field(default_factory=list)


class CampaignSuggestion(BaseModel):
    id: str
    titulo: str
    segmento: str
    cantidad_clientes: int
    motivo: str
    producto_destacado: Optional[str] = None
    descuento_sugerido_pct: Optional[float] = None
    origen_directiva: Optional[str] = None  # ej. DIR-CFO-01
    estado: str = "propuesta"  # propuesta, activa, pausada


class DirectiveItem(BaseModel):
    id: str
    codigo: str
    emisor: str
    receptor: str
    titulo: str
    mensaje: str
    accion_sugerida: Optional[str] = None
    prioridad: str  # critica, alta, media, baja
    estado: str  # emitida, en_progreso, completada, rechazada
    impacto_estimado_gs: float = 0.0
    created_at: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class TripartiteSyncResponse(BaseModel):
    estado_general: str  # sincronizado, advertencia, desalineado
    cfo_margen_actual_pct: float
    cfo_margen_piso_pct: float
    cfo_sobrestock_valor_gs: float
    cmo_promociones_activas: int
    cmo_clientes_fidelizados_impactados: int
    cso_meta_cumplimiento_pct: float
    cso_ticket_promedio_gs: float
    directivas_activas: List[DirectiveItem] = Field(default_factory=list)
    alertas_alineacion: List[str] = Field(default_factory=list)


class MarketingDashboard(BaseModel):
    total_clientes_fidelizados: int
    segmentos: List[CustomerSegment]
    campañas_sugeridas: List[CampaignSuggestion]
    resumen_ejecutivo: str
    sync_tripartito: TripartiteSyncResponse
    reglas_aprendidas_count: int = 0


class ChatMessageRequest(BaseModel):
    company_id: str
    message: str
    conversation_history: Optional[List[Dict[str, Any]]] = None


class ChatMessageResponse(BaseModel):
    reply: str
    action_outcome: Optional[ActionOutcome] = None
    suggested_prompts: List[str] = Field(default_factory=list)


class SendCouponRequest(BaseModel):
    phone: str
    customer_name: Optional[str] = None
    message: str
    cupon: Optional[str] = None


class LaunchCampaignRequest(BaseModel):
    company_id: str
    campaign_id: str
    segmento: str
    message: Optional[str] = None
    crear_en_pos: bool = True
    descuento_pct: Optional[float] = None
    producto_ids: Optional[List[str]] = None


class ApproveDirectiveRequest(BaseModel):
    directive_id: str
    accion: str  # aprobar_y_ejecutar | rechazar
    comentarios: Optional[str] = None


class LearnedRuleItem(BaseModel):
    id: str
    regla: str
    categoria: str
    origen: str
    activa: bool
    confianza: float
    created_at: Optional[str] = None
