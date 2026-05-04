"""Company schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class CompanyCreate(BaseModel):
    ruc: str = Field(min_length=7, max_length=15, pattern=r"^\d{6,8}-\d$")
    razon_social: str = Field(min_length=2, max_length=255)
    nombre_fantasia: Optional[str] = None
    actividad_principal: Optional[str] = None
    regimen_tributario: str = "general"
    iva_condition: str = "gravado"
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None


class CompanyUpdate(BaseModel):
    nombre_fantasia: Optional[str] = None
    actividad_principal: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    timbrado_numero: Optional[str] = None
    timbrado_vigencia_desde: Optional[datetime] = None
    timbrado_vigencia_hasta: Optional[datetime] = None
    sifen_enabled: Optional[bool] = None


class CompanyResponse(BaseModel):
    id: UUID
    ruc: str
    razon_social: str
    nombre_fantasia: Optional[str] = None
    actividad_principal: Optional[str] = None
    regimen_tributario: str
    iva_condition: str
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    sifen_enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
