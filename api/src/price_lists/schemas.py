"""Price list schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class PriceListCreate(BaseModel):
    company_id: Optional[uuid.UUID] = None  # el router lo pisa con user[company_id] -- no hace falta que lo mande el cliente
    nombre: str
    tipo: str = "general"
    customer_id: Optional[uuid.UUID] = None
    grupo: Optional[str] = None


class PriceListUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    customer_id: Optional[uuid.UUID] = None
    grupo: Optional[str] = None
    activo: Optional[bool] = None


class PriceListItemCreate(BaseModel):
    price_list_id: Optional[uuid.UUID] = None  # el router lo pisa con el {pl_id} de la URL -- no hace falta que lo mande el cliente
    product_id: uuid.UUID
    variant_id: Optional[uuid.UUID] = None
    precio: float
    moneda: str = "PYG"
    notas: Optional[str] = None


class PriceListItemUpdate(BaseModel):
    precio: Optional[float] = None
    activo: Optional[bool] = None
    notas: Optional[str] = None


class PriceListResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    nombre: str
    tipo: str
    customer_id: Optional[uuid.UUID] = None
    grupo: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PriceListItemResponse(BaseModel):
    id: uuid.UUID
    price_list_id: uuid.UUID
    product_id: uuid.UUID
    variant_id: Optional[uuid.UUID] = None
    precio: float
    moneda: str
    notas: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PriceVariationItem(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    product_id: uuid.UUID
    product_nombre: Optional[str] = None
    product_sku: Optional[str] = None
    product_barcode: Optional[str] = None
    categoria_nombre: Optional[str] = None
    tipo: str  # 'unitario' | 'escala'
    escala_min_qty: Optional[int] = None
    precio_minorista_anterior: float = 0.0
    precio_minorista_nuevo: float = 0.0
    precio_escala_anterior: float = 0.0
    precio_escala_nuevo: float = 0.0
    precio_anterior: float
    precio_nuevo: float
    diferencia_monto: float
    diferencia_pct: float
    origen: Optional[str] = None
    usuario_id: Optional[uuid.UUID] = None
    usuario_nombre: Optional[str] = None
    motivo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PriceVariationsSummary(BaseModel):
    total_modificaciones: int = 0
    total_subidas: int = 0
    total_bajadas: int = 0
    promedio_variacion_pct: float = 0.0


class PriceVariationsPagination(BaseModel):
    total: int = 0
    page: int = 1
    page_size: int = 25
    total_pages: int = 1


class PriceVariationsResponse(BaseModel):
    resumen: PriceVariationsSummary
    paginacion: PriceVariationsPagination
    items: list[PriceVariationItem]

