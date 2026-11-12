"""Schemas del Gerente de Riesgo IA -- dashboard y chat sobre eventos reales de audit_logs."""
from typing import Optional
from pydantic import BaseModel, Field


class RiskEventItem(BaseModel):
    id: str
    accion: str
    entidad: Optional[str] = None
    nivel_riesgo: str  # BAJO | MEDIO | ALTO
    categoria_riesgo: str  # operativo | financiero | fiscal | seguridad | inventario
    descripcion: str
    tipo_evento_label: Optional[str] = None
    cajero: Optional[str] = None
    caja: Optional[str] = None
    autorizado_por: Optional[str] = None
    usuario: Optional[str] = None
    usuario_nombre: Optional[str] = None
    monto_gs: Optional[float] = None
    detalles: Optional[dict] = None
    created_at: str


class RiskByCajero(BaseModel):
    cajero: str
    total_eventos: int
    eventos_alto: int
    eventos_medio: int
    eventos_bajo: int
    score_riesgo: float  # ponderado: alto*3 + medio*1.5 + bajo*1, normalizado


class RiskTrendPoint(BaseModel):
    fecha: str
    total: int
    alto: int
    medio: int
    bajo: int


class AccionDisponible(BaseModel):
    accion: str
    label: str
    total: int


class RiskDashboard(BaseModel):
    periodo_dias: int
    total_eventos: int
    total_alto: int
    total_medio: int
    total_bajo: int
    total_descuentos: int = 0
    monto_total_descuentos_pyg: float = 0.0
    por_categoria: dict[str, int]
    por_accion: dict[str, int]
    acciones_disponibles: list[AccionDisponible] = Field(default_factory=list)
    usuarios_disponibles: list[str] = Field(default_factory=list)
    top_cajeros_riesgo: list[RiskByCajero]
    tendencia: list[RiskTrendPoint]
    eventos_recientes_alto: list[RiskEventItem]
    eventos_recientes_descuento: list[RiskEventItem] = Field(default_factory=list)
    resumen_ejecutivo: str


class ChatMessageRequest(BaseModel):
    company_id: str
    message: str
    conversation_history: Optional[list[dict]] = None


class ChatMessageResponse(BaseModel):
    reply: str
    suggested_prompts: list[str] = Field(default_factory=list)

