from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class TriggerRunRequest(BaseModel):
    company_id: UUID


class FinanceRecommendationResponse(BaseModel):
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


class FinanceAgentRunResponse(BaseModel):
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


class DecisionRequest(BaseModel):
    approved_by: Optional[UUID] = None
    approved_by_name: Optional[str] = "Gustavo"
    comments: Optional[str] = None


class FinanceChatRequest(BaseModel):
    query: str
    user_name: Optional[str] = "Gustavo"


class FinanceChatResponse(BaseModel):
    query: str
    response: str
    diagnostico_key: Optional[str] = None
    metricas_relacionadas: Optional[Dict[str, Any]] = None
    propuesta_estrategica: Optional[str] = None
    execution_time_seconds: float = 0.0


class FinanceExecutiveSummaryResponse(BaseModel):
    company_id: str
    as_of: datetime
    liquidez_bancos_gs: float
    cuentas_por_cobrar_gs: float
    cuentas_por_cobrar_vencidas_gs: float
    cuentas_por_pagar_gs: float
    flujo_neto_proyectado_30d_gs: float
    cheques_en_cartera_gs: float
    alertas_criticas: List[str]
    recomendaciones_activas_count: int
