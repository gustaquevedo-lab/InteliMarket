"""Email Pydantic schemas"""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


class EmailSend(BaseModel):
    to_email: str
    subject: str
    body_html: str
    tipo: str = "general"
    referencia_id: Optional[str] = None


class EmailLogResponse(BaseModel):
    id: UUID
    company_id: UUID
    to_email: str
    subject: str
    tipo: str
    referencia_id: Optional[str] = None
    success: bool
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EmailTestResponse(BaseModel):
    message: str


class EmailConfigResponse(BaseModel):
    configured: bool
    from_address: str
    host: str = ""
