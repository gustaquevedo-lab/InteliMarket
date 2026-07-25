"""Variant schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class VariantCreate(BaseModel):
    product_id: uuid.UUID
    company_id: uuid.UUID
    tipo: str = "talle"
    valor: str
    sku_variante: str
    codigo_barra: Optional[str] = None
    precio_extra: float = 0
    stock: int = 0
    orden: int = 0


class VariantUpdate(BaseModel):
    tipo: Optional[str] = None
    valor: Optional[str] = None
    codigo_barra: Optional[str] = None
    precio_extra: Optional[float] = None
    stock: Optional[int] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None


class VariantResponse(BaseModel):
    id: str
    product_id: str
    company_id: str
    tipo: str
    valor: str
    sku_variante: str
    codigo_barra: Optional[str]
    precio_extra: float
    stock: int
    orden: int
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
