"""Sales targets (metas de venta) — schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class SalesRepResponse(BaseModel):
    id: UUID
    company_id: UUID
    funcionario_codigo: Optional[str] = None
    user_id: Optional[UUID] = None
    nombre: str
    cedula: Optional[str] = None
    rama: Optional[str] = None
    rol: str
    supervisor_id: Optional[UUID] = None
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesRepCreate(BaseModel):
    nombre: str
    cedula: Optional[str] = None
    rama: Optional[str] = None
    rol: str
    supervisor_id: Optional[UUID] = None


class SalesRepUpdate(BaseModel):
    nombre: Optional[str] = None
    rama: Optional[str] = None
    rol: Optional[str] = None
    supervisor_id: Optional[UUID] = None
    activo: Optional[bool] = None


class ProductLineResponse(BaseModel):
    id: UUID
    company_id: UUID
    codigo_legacy: Optional[str] = None
    nombre: str
    activo: bool

    class Config:
        from_attributes = True


class CascadeConfigResponse(BaseModel):
    id: UUID
    company_id: UUID
    umbral_pct: Decimal
    activo: bool

    class Config:
        from_attributes = True


class CascadeConfigUpdate(BaseModel):
    umbral_pct: Decimal
    activo: Optional[bool] = None
