"""Sales targets (metas de venta) — schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class SalesRepResponse(BaseModel):
    id: UUID
    company_id: UUID
    funcionario_codigo: Optional[str] = None
    user_id: Optional[UUID] = None
    nombre: str
    cedula: Optional[str] = None
    rama: Optional[str] = None
    rol: str
    supervisor_id: Optional[UUID] = None
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesRepCreate(BaseModel):
    nombre: str
    cedula: Optional[str] = None
    rama: Optional[str] = None
    rol: str
    supervisor_id: Optional[UUID] = None


class SalesRepUpdate(BaseModel):
    nombre: Optional[str] = None
    rama: Optional[str] = None
    rol: Optional[str] = None
    supervisor_id: Optional[UUID] = None
    activo: Optional[bool] = None


class ProductLineResponse(BaseModel):
    id: UUID
    company_id: UUID
    codigo_legacy: Optional[str] = None
    nombre: str
    activo: bool

    class Config:
        from_attributes = True


class CascadeConfigResponse(BaseModel):
    id: UUID
    company_id: UUID
    umbral_pct: Decimal
    activo: bool

    class Config:
        from_attributes = True


class CascadeConfigUpdate(BaseModel):
    umbral_pct: Decimal
    activo: Optional[bool] = None


class SalesTargetResponse(BaseModel):
    id: UUID
    company_id: UUID
    sales_rep_id: Optional[UUID] = None
    periodo_tipo: str
    periodo_inicio: date
    periodo_fin: date
    product_line_id: Optional[UUID] = None
    monto_gs: Decimal
    cantidad_unidades: Decimal
    origen: str
    created_at: datetime

    class Config:
        from_attributes = True


class SalesTargetCreate(BaseModel):
    sales_rep_id: UUID
    periodo_tipo: str
    periodo_inicio: date
    periodo_fin: date
    product_line_id: Optional[UUID] = None
    monto_gs: Decimal = Decimal("0")
    cantidad_unidades: Decimal = Decimal("0")
    origen: str = "manual"


class SalesTargetUpdate(BaseModel):
    monto_gs: Optional[Decimal] = None
    cantidad_unidades: Optional[Decimal] = None
    origen: Optional[str] = None


class RepProgressResponse(BaseModel):
    sales_rep_id: UUID
    nombre: str
    periodo_inicio: str
    periodo_fin: str
    venta_gs: Decimal
    unidades: Decimal
    meta_gs: Decimal
    meta_unidades: Decimal
    pct_gs: Decimal
    pct_unidades: Decimal
    cumplido: bool


class BaselineResponse(BaseModel):
    product_line_id: UUID
    linea_nombre: str
    mes: int
    promedio_gs: Decimal
    promedio_unidades: Decimal
    tendencia_pct: Decimal
    desvio_gs: Decimal
    objetivo_legacy_ref_gs: Optional[Decimal] = None
    sugerido_gs: Decimal


class SuggestTargetsRequest(BaseModel):
    periodo_tipo: str
    periodo_inicio: date
    periodo_fin: date
    mes_referencia: int
    ajuste_manual_pct: Decimal = Decimal("0")


class SuggestedTargetLinea(BaseModel):
    linea_nombre: str
    monto_gs: Decimal


class SuggestedTarget(BaseModel):
    sales_rep_id: UUID
    nombre: str
    rama: Optional[str] = None
    monto_gs: Decimal
    cantidad_unidades: Decimal
    desglose: list[SuggestedTargetLinea] = []


class CascadeStatusResponse(BaseModel):
    lider_id: UUID
    lider_nombre: str
    umbral_pct: Decimal
    equipo_total: int
    equipo_cumplieron: int
    pct_equipo_cumplio: Decimal
    cascada_cumplida: bool
    equipo: list[RepProgressResponse]
