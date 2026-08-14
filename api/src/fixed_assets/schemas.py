"""Fixed Assets schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal


class FixedAssetCreate(BaseModel):
    nombre: str
    categoria: Optional[str] = None
    fecha_adquisicion: date
    valor_adquisicion: Decimal
    valor_residual: Decimal = Decimal("0")
    vida_util_meses: int


class FixedAssetRetire(BaseModel):
    motivo: str
    fecha_baja: Optional[date] = None


class FixedAssetResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    categoria: Optional[str] = None
    fecha_adquisicion: date
    valor_adquisicion: float
    valor_residual: float
    vida_util_meses: int
    meses_depreciados: int
    depreciacion_acumulada: float
    valor_libros: float
    estado: str
    fecha_baja: Optional[date] = None
    motivo_baja: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
