from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class TriggerRunRequest(BaseModel):
    company_id: UUID


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


class DecisionRequest(BaseModel):
    approved_by: UUID
    comments: Optional[str] = None
