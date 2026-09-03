"""Pack barcode schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class PackBarcodeCreate(BaseModel):
    codigo_barra: str
    etiqueta: str
    unidades_por_paquete: float = Field(gt=0)


class PackBarcodeUpdate(BaseModel):
    codigo_barra: Optional[str] = None
    etiqueta: Optional[str] = None
    unidades_por_paquete: Optional[float] = Field(default=None, gt=0)
    activo: Optional[bool] = None


class PackBarcodeResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    company_id: uuid.UUID
    codigo_barra: str
    etiqueta: str
    unidades_por_paquete: float
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
