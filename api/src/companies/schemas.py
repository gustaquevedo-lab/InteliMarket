"""Company schemas"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from uuid import UUID


class CompanyCreate(BaseModel):
    ruc: str = Field(min_length=7, max_length=15)
    razon_social: str = Field(min_length=2, max_length=255)
    nombre_fantasia: Optional[str] = None
    nombre: Optional[str] = None
    actividad_principal: Optional[str] = None
    regimen_tributario: str = "general"
    iva_condition: str = "gravado"
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    timbrado_numero: Optional[str] = None


class CompanyUpdate(BaseModel):
    ruc: Optional[str] = None
    razon_social: Optional[str] = None
    nombre_fantasia: Optional[str] = None
    nombre: Optional[str] = None
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
    config: Optional[dict[str, Any]] = None


class CompanyResponse(BaseModel):
    id: UUID
    ruc: str
    razon_social: str
    nombre_fantasia: Optional[str] = None
    nombre: Optional[str] = None
    actividad_principal: Optional[str] = None
    regimen_tributario: Optional[str] = "general"
    iva_condition: Optional[str] = "gravado"
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    timbrado_numero: Optional[str] = None
    sifen_enabled: Optional[bool] = False
    config: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
