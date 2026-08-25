from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID


class KioskBannerCreate(BaseModel):
    titulo: str
    subtitulo: Optional[str] = None
    etiqueta: Optional[str] = None
    descuento_texto: Optional[str] = None
    color: Optional[str] = "orange"
    imagen_url: Optional[str] = None
    orden: int = 0
    activo: bool = True
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None


class KioskBannerUpdate(BaseModel):
    titulo: Optional[str] = None
    subtitulo: Optional[str] = None
    etiqueta: Optional[str] = None
    descuento_texto: Optional[str] = None
    color: Optional[str] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None


class KioskBannerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    titulo: str
    subtitulo: Optional[str] = None
    etiqueta: Optional[str] = None
    descuento_texto: Optional[str] = None
    color: Optional[str] = None
    imagen_url: Optional[str] = None
    orden: int
    activo: bool
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class PriceScaleTier(BaseModel):
    min_qty: int
    max_qty: Optional[int] = None
    precio_unitario: float
    moneda: str = "PYG"


class ProductLookupResponse(BaseModel):
    id: UUID
    nombre: str
    sku: Optional[str] = None
    codigo_barra: Optional[str] = None
    precio_venta: float
    imagen_url: Optional[str] = None
    categoria_nombre: Optional[str] = None
    tipo_venta: Optional[str] = None
    escalas: list[PriceScaleTier] = []
