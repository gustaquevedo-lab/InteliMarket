from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class PosTerminalAssignmentCreate(BaseModel):
    hostname: str
    punto_emision: str
    caja_nombre: str


class PosTerminalAssignmentUpdate(BaseModel):
    punto_emision: Optional[str] = None
    caja_nombre: Optional[str] = None
    activo: Optional[bool] = None


class PosTerminalAssignmentResponse(BaseModel):
    id: UUID
    hostname: str
    punto_emision: str
    caja_nombre: str
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
