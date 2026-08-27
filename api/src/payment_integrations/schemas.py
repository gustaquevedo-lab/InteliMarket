from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import uuid


class PaymentIntegrationConfigUpsert(BaseModel):
    environment: str = "sandbox"
    enabled: bool = True
    config: Optional[dict] = None


class PaymentIntegrationConfigResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    provider: str
    environment: str
    enabled: bool
    config: Optional[Any] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
