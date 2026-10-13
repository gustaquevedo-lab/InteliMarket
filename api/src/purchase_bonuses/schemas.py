import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class BonusScaleCreate(BaseModel):
    supplier_id: uuid.UUID
    product_id: uuid.UUID
    cantidad_minima: Decimal
    cantidad_bonificada: Decimal
    observaciones: Optional[str] = None


class BonusScaleUpdate(BaseModel):
    cantidad_minima: Optional[Decimal] = None
    cantidad_bonificada: Optional[Decimal] = None
    activo: Optional[bool] = None
    observaciones: Optional[str] = None


class BonusScaleResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    supplier_id: uuid.UUID
    product_id: uuid.UUID
    cantidad_minima: float
    cantidad_bonificada: float
    activo: bool
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BonusSuggestion(BaseModel):
    scale_id: Optional[uuid.UUID] = None
    cantidad_bonificada_sugerida: float = 0
