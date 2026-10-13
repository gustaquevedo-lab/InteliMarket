import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class IndicatorCreate(BaseModel):
    codigo: str
    nombre: str
    peso_pct: Decimal
    meta: Optional[Decimal] = None
    resultado: Optional[Decimal] = None
    piso_minimo_pct: Optional[Decimal] = None
    orden: int = 0


class IndicatorUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    peso_pct: Optional[Decimal] = None
    meta: Optional[Decimal] = None
    resultado: Optional[Decimal] = None
    piso_minimo_pct: Optional[Decimal] = None
    orden: Optional[int] = None


class IndicatorResponse(BaseModel):
    id: uuid.UUID
    period_id: uuid.UUID
    codigo: str
    nombre: str
    peso_pct: float
    meta: Optional[float] = None
    resultado: Optional[float] = None
    piso_minimo_pct: Optional[float] = None
    orden: int = 0
    categoria: Optional[str] = None
    meta_uc: Optional[float] = None
    resultado_uc: Optional[float] = None
    cumplimiento_pct: Optional[float] = None
    es_foco: Optional[bool] = None
    segmento_paresa: Optional[str] = None
    pct_cumplimiento: Optional[float] = None  # calculado, no persistido
    aporte_ponderado_pct: Optional[float] = None  # calculado, no persistido

    class Config:
        from_attributes = True


class PeriodCreate(BaseModel):
    supplier_id: uuid.UUID
    periodo: date  # cualquier dia del mes, se normaliza al dia 1
    rebate_pct_objetivo: Decimal = Decimal("4.5")
    observaciones: Optional[str] = None


class PeriodUpdate(BaseModel):
    rebate_pct_objetivo: Optional[Decimal] = None
    estado: Optional[str] = None
    observaciones: Optional[str] = None


class PeriodResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    supplier_id: uuid.UUID
    periodo: date
    rebate_pct_objetivo: float
    estado: str
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PeriodSummary(BaseModel):
    period: PeriodResponse
    supplier_razon_social: str
    indicadores: list[IndicatorResponse]
    pct_cumplimiento_total: float
    meta_alcanzada: bool
    venta_base_sin_iva: float
    monto_rebate_calculado: float
    monto_compras_sin_iva: Optional[float] = None
    monto_ventas_sin_iva: Optional[float] = None
    total_rebate_pct_ganado: Optional[float] = None

