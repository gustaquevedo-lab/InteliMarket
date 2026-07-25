from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class DiscountCreate(BaseModel):
    company_id: UUID
    nombre: str
    descripcion: Optional[str] = None
    tipo: str
    valor: Optional[Decimal] = None
    aplica_a: str
    producto_ids: Optional[list[UUID]] = None
    categoria_ids: Optional[list[UUID]] = None
    monto_minimo: Optional[Decimal] = None
    cantidad_minima: Optional[Decimal] = None
    maximo_aplicaciones: Optional[Decimal] = None
    valido_desde: Optional[date] = None
    valido_hasta: Optional[date] = None


class DiscountUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    valor: Optional[Decimal] = None
    producto_ids: Optional[list[UUID]] = None
    categoria_ids: Optional[list[UUID]] = None
    monto_minimo: Optional[Decimal] = None
    cantidad_minima: Optional[Decimal] = None
    maximo_aplicaciones: Optional[Decimal] = None
    valido_desde: Optional[date] = None
    valido_hasta: Optional[date] = None
    activo: Optional[bool] = None


class DiscountResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    descripcion: Optional[str] = None
    tipo: str
    valor: Optional[Decimal] = None
    aplica_a: str
    producto_ids: Optional[list[UUID]] = None
    categoria_ids: Optional[list[UUID]] = None
    monto_minimo: Optional[Decimal] = None
    cantidad_minima: Optional[Decimal] = None
    maximo_aplicaciones: Optional[Decimal] = None
    aplicaciones_usadas: Optional[Decimal] = None
    valido_desde: Optional[date] = None
    valido_hasta: Optional[date] = None
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True
