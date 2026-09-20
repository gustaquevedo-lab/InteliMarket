"""Customer schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class CustomerCreate(BaseModel):
    company_id: UUID
    tipo_persona: str = "juridica"
    tipo: Optional[str] = "cliente"
    ruc: Optional[str] = Field(default=None, max_length=20)
    extra_club_numero: Optional[str] = Field(default=None, max_length=40)
    empresa_vinculada_nombre: Optional[str] = Field(default=None, max_length=255)
    empresa_vinculada_ruc: Optional[str] = Field(default=None, max_length=20)
    ci: Optional[str] = Field(default=None, max_length=20)
    razon_social: str = Field(min_length=2, max_length=255)
    nombre_fantasia: Optional[str] = None
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    contacto: Optional[str] = None
    price_list_id: Optional[UUID] = None
    credito_limite: Decimal = Decimal("0")
    limite_credito: Optional[Decimal] = Decimal("0")
    pago_default: str = "contado"
    es_agente_retencion: bool = False
    regimen_retencion: Optional[str] = "general"
    porcentaje_retencion_iva: Optional[Decimal] = Decimal("30.00")
    idioma: Optional[str] = "es"
    whatsapp_valido: Optional[bool] = True
    activo: bool = True


class CustomerUpdate(BaseModel):
    razon_social: Optional[str] = None
    ruc: Optional[str] = None
    ci: Optional[str] = None
    tipo_persona: Optional[str] = None
    tipo: Optional[str] = None
    nombre_fantasia: Optional[str] = None
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    contacto: Optional[str] = None
    price_list_id: Optional[UUID] = None
    credito_limite: Optional[Decimal] = None
    limite_credito: Optional[Decimal] = None
    pago_default: Optional[str] = None
    es_agente_retencion: Optional[bool] = None
    regimen_retencion: Optional[str] = None
    porcentaje_retencion_iva: Optional[Decimal] = None
    idioma: Optional[str] = None
    whatsapp_valido: Optional[bool] = None
    arquetipo: Optional[str] = None
    tags: Optional[list[str]] = None
    ia_analisis: Optional[dict] = None
    activo: Optional[bool] = None
    extra_club_numero: Optional[str] = None
    empresa_vinculada_nombre: Optional[str] = None
    empresa_vinculada_ruc: Optional[str] = None


class CustomerResponse(BaseModel):
    id: UUID
    company_id: UUID
    tipo_persona: str
    tipo: Optional[str] = "cliente"
    ruc: Optional[str] = None
    extra_club_numero: Optional[str] = None
    empresa_vinculada_nombre: Optional[str] = None
    empresa_vinculada_ruc: Optional[str] = None
    ci: Optional[str] = None
    razon_social: str
    nombre_fantasia: Optional[str] = None
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    contacto: Optional[str] = None
    credito_limite: float
    limite_credito: Optional[float] = 0.0
    credito_usado: float
    pago_default: Optional[str] = None
    es_agente_retencion: Optional[bool] = False
    regimen_retencion: Optional[str] = "general"
    porcentaje_retencion_iva: Optional[float] = 30.0
    idioma: Optional[str] = "es"
    whatsapp_valido: Optional[bool] = True
    arquetipo: Optional[str] = None
    tags: Optional[list[str]] = []
    ia_analisis: Optional[dict] = {}
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

