from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class PosTerminalAssignmentCreate(BaseModel):
    hostname: str
    ip_address: Optional[str] = None
    ip_pos_bancard: Optional[str] = None
    ip_pos_dinelco: Optional[str] = None
    punto_emision: str
    caja_nombre: str


class PosTerminalAssignmentUpdate(BaseModel):
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    ip_pos_bancard: Optional[str] = None
    ip_pos_dinelco: Optional[str] = None
    punto_emision: Optional[str] = None
    caja_nombre: Optional[str] = None
    activo: Optional[bool] = None


class PosTerminalAssignmentResponse(BaseModel):
    id: UUID
    hostname: str
    ip_address: Optional[str] = None
    ip_pos_bancard: Optional[str] = None
    ip_pos_dinelco: Optional[str] = None
    punto_emision: str
    caja_nombre: str
    activo: bool
    factura_actual: Optional[int] = None
    factura_final: Optional[int] = None
    nc_actual: Optional[int] = None
    nc_final: Optional[int] = None
    tiene_factura: Optional[bool] = None
    tiene_nc: Optional[bool] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

