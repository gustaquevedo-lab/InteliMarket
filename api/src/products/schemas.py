"""Product schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class CategoryCreate(BaseModel):
    company_id: UUID
    parent_id: Optional[UUID] = None
    nombre: str = Field(min_length=1, max_length=100)
    codigo: Optional[str] = Field(default=None, max_length=20)


class CategoryResponse(BaseModel):
    id: UUID
    company_id: UUID
    parent_id: Optional[UUID] = None
    nombre: str
    codigo: Optional[str] = None
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    company_id: UUID
    category_id: Optional[UUID] = None
    sku: str = Field(min_length=1, max_length=50)
    codigo_barra: Optional[str] = Field(default=None, max_length=50)
    nombre: str = Field(min_length=1, max_length=200)
    descripcion: Optional[str] = None
    tipo: str = "producto"
    unidad_medida: str = "UN"
    iva_tasa: Decimal = Decimal("10")
    metodo_costeo: str = "promedio"
    tiene_lotes: bool = False
    tiene_vencimiento: bool = False
    tiene_serial: bool = False
    stock_minimo: int = 0
    stock_maximo: Optional[int] = None
    peso_kg: Optional[Decimal] = None


class ProductUpdate(BaseModel):
    category_id: Optional[UUID] = None
    codigo_barra: Optional[str] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    unidad_medida: Optional[str] = None
    iva_tasa: Optional[Decimal] = None
    metodo_costeo: Optional[str] = None
    tiene_lotes: Optional[bool] = None
    tiene_vencimiento: Optional[bool] = None
    tiene_serial: Optional[bool] = None
    stock_minimo: Optional[int] = None
    stock_maximo: Optional[int] = None
    peso_kg: Optional[Decimal] = None
    activo: Optional[bool] = None


class ProductResponse(BaseModel):
    id: UUID
    company_id: UUID
    category_id: Optional[UUID] = None
    sku: str
    codigo_barra: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    tipo: str
    unidad_medida: str
    iva_tasa: Decimal
    metodo_costeo: str
    tiene_lotes: bool
    tiene_vencimiento: bool
    tiene_serial: bool
    stock_minimo: int
    stock_maximo: Optional[int] = None
    peso_kg: Optional[Decimal] = None
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
