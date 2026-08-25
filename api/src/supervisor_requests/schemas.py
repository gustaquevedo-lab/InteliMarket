from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID


class SupervisorAuthRequestCreate(BaseModel):
    company_id: UUID
    tipo: str
    descripcion: str
    monto: Optional[str] = None
    cajero_id: Optional[UUID] = None
    cajero_nombre: Optional[str] = None
    caja_nombre: Optional[str] = None


class SupervisorAuthRequestResolve(BaseModel):
    aprobado: bool
    resuelto_por: UUID
    resuelto_por_nombre: str


class SupervisorAuthRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    tipo: str
    descripcion: str
    monto: Optional[str] = None
    cajero_id: Optional[UUID] = None
    cajero_nombre: Optional[str] = None
    caja_nombre: Optional[str] = None
    estado: str
    resuelto_por: Optional[UUID] = None
    resuelto_por_nombre: Optional[str] = None
    created_at: datetime
    resuelto_at: Optional[datetime] = None
