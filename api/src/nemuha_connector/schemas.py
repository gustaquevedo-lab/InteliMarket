from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class TriggerSyncRequest(BaseModel):
    company_id: UUID
    since: Optional[date] = None  # si no se pasa, sincroniza todo lo pendiente


class NemuhaSyncRunResponse(BaseModel):
    id: UUID
    company_id: UUID
    started_at: datetime
    finished_at: Optional[datetime] = None
    status: str
    since_date: Optional[datetime] = None
    rows_synced: Optional[dict] = None
    errors: Optional[dict] = None

    class Config:
        from_attributes = True
