"""Kit schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class KitItemCreate(BaseModel):
    product_id: uuid.UUID
    variant_id: Optional[uuid.UUID] = None
    cantidad: int = 1


class KitCreate(BaseModel):
    company_id: uuid.UUID
    product_id: uuid.UUID
    nombre: str
    descripcion: Optional[str] = None
    precio_venta: Optional[int] = None
    items: list[KitItemCreate]


class KitUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio_venta: Optional[int] = None
    activo: Optional[bool] = None
    items: Optional[list[KitItemCreate]] = None


class KitItemResponse(BaseModel):
    id: str
    kit_id: str
    product_id: str
    variant_id: Optional[str]
    cantidad: int

    class Config:
        from_attributes = True


class KitResponse(BaseModel):
    id: str
    company_id: str
    product_id: str
    nombre: str
    descripcion: Optional[str]
    precio_venta: Optional[int]
    precio_calculado: Optional[int] = None
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime]
    items: list[KitItemResponse] = []

    class Config:
        from_attributes = True


class KitPriceResponse(BaseModel):
    kit_id: str
    nombre: str
    precio_venta: Optional[int]
    precio_calculado: int
    diferencia: int
    items: list[KitItemResponse]
