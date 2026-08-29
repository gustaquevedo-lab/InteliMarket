"""Esquemas Pydantic para el Gerente Comercial IA"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class TriggerRunRequest(BaseModel):
    company_id: str
    trigger_type: Optional[str] = "manual"


class CommercialRecommendationResponse(BaseModel):
    id: str
    company_id: str
    run_id: Optional[str] = None
    created_at: datetime
    categoria: str
    titulo: str
    diagnostico: str
    accion_propuesta: str
    impacto_estimado_gs: float
    urgencia: str
    estado: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    detalles: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class CommercialAgentRunResponse(BaseModel):
    id: str
    company_id: str
    created_at: datetime
    trigger_type: str
    kpis_snapshot: Dict[str, Any]
    summary: str
    recommendations_count: int
    execution_time_seconds: float
    recommendations: List[CommercialRecommendationResponse] = []

    class Config:
        from_attributes = True


class DecisionRequest(BaseModel):
    approved_by: str = "Gustavo"
    comments: Optional[str] = None


class CommercialChatRequest(BaseModel):
    company_id: str
    query: str
    user_name: Optional[str] = "Gustavo"


class CommercialChatResponse(BaseModel):
    query: str
    response: str
    diagnostico_key: Optional[str] = None
    metricas_relacionadas: Optional[Dict[str, Any]] = None
    propuesta_estrategica: Optional[str] = None
    execution_time_seconds: float = 0.0


class CommercialReportRequest(BaseModel):
    company_id: str
    tipo_reporte: str = "cierre_mes"  # cierre_mes, rentabilidad_proveedor, preventistas, clientes_churn
