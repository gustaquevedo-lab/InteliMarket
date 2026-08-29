"""Schemas for Marketing Agent IA — Casa Gonzalito S.R.L."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class MarketingComboItem(BaseModel):
    product_id: str
    product_name: str
    cantidad: int
    precio_unitario_gs: float
    precio_promocional_gs: float
    tipo_rol: str  # 'ancla', 'rebate_meta', 'rotacion_lenta'


class MarketingCampaignSuggestion(BaseModel):
    id: str
    titulo: str
    objetivo: str  # 'cerrar_rebate', 'liquidar_stock', 'reactivar_clientes', 'combo_fin_de_semana'
    proveedor_relacionado: Optional[str] = None
    rebate_en_juego_gs: Optional[float] = 0.0
    impacto_ventas_estimado_gs: float
    margen_estimado_pct: float
    descripcion: str
    items_combo: List[MarketingComboItem] = []
    segmento_objetivo: str
    canales: List[str] = ["whatsapp", "app_b2b", "preventa_ruta"]
    copy_whatsapp: str
    copy_app: str
    estado: str = "sugerida"  # 'sugerida', 'activa', 'pausada', 'finalizada'
    created_at: Optional[str] = None


class CustomerSegmentSummary(BaseModel):
    id: str
    nombre: str
    descripcion: str
    total_clientes: int
    score_crediticio_promedio: str
    condicion_venta: str  # 'Credito Habilitado (15-30d)', 'Solo Contado / Pix'
    potencial_compra_gs: float


class MarketingAgentDashboard(BaseModel):
    mes_activo: str
    ventas_por_campanas_gs: float
    fardos_traccionados_rebate: int
    tasa_conversion_pct: float
    clientes_activados: int
    campanas_activas: int
    proveedores_en_empuje: List[str] = []
    campanas_sugeridas: List[MarketingCampaignSuggestion] = []
    segmentos: List[CustomerSegmentSummary] = []


class MarketingChatRequest(BaseModel):
    query: str
    user_name: Optional[str] = "Gustavo"
    use_gemini: Optional[bool] = False


class MarketingChatResponse(BaseModel):
    response: str
    execution_time_seconds: float
    model_used: str = "qwen2.5:7b-local"
    data_preview: Optional[List[Dict[str, Any]]] = None
    campana_generada: Optional[MarketingCampaignSuggestion] = None


class MarketingExecutiveSummaryResponse(BaseModel):
    status: str
    ventas_campanas_gs: float
    fardos_traccionados: int
    proveedores_prioritarios: List[Dict[str, Any]]
    campanas_recomendadas: List[Dict[str, Any]]
