"""Customer schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class CustomerCreate(BaseModel):
    company_id: UUID
    tipo_persona: str = "juridica"
    ruc: Optional[str] = Field(default=None, max_length=15)
    ci: Optional[str] = Field(default=None, max_length=20)
    razon_social: str = Field(min_length=2, max_length=255)
    nombre_fantasia: Optional[str] = None
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    price_list_id: Optional[UUID] = None
    credito_limite: Decimal = Decimal("0")
    pago_default: str = "contado"


class CustomerUpdate(BaseModel):
    nombre_fantasia: Optional[str] = None
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    price_list_id: Optional[UUID] = None
    credito_limite: Optional[Decimal] = None
    pago_default: Optional[str] = None
    activo: Optional[bool] = None


class CustomerResponse(BaseModel):
    id: UUID
    company_id: UUID
    tipo_persona: str
    ruc: Optional[str] = None
    ci: Optional[str] = None
    razon_social: str
    nombre_fantasia: Optional[str] = None
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    credito_limite: Decimal
    credito_usado: Decimal
    pago_default: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
