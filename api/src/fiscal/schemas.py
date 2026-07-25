from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FiscalConfigCreate(BaseModel):
    company_id: UUID
    modo_emision: str = "sifen"  # sifen, preimpreso, autoimpresor
    timbrado_id: Optional[UUID] = None
    punto_emision: str = "001"


class FiscalConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    modo_emision: str
    timbrado_id: Optional[UUID] = None
    punto_emision: str
    created_at: datetime


class TimbradoCreate(BaseModel):
    company_id: UUID
    numero: str
    fecha_inicio: date
    fecha_fin: date
    rango_desde: int
    rango_hasta: int
    tipo_comprobante: Optional[str] = None
    activo: bool = True


class TimbradoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    numero: str
    fecha_inicio: date
    fecha_fin: date
    rango_desde: int
    rango_hasta: int
    tipo_comprobante: Optional[str] = None
    activo: bool
    created_at: datetime
    usados: Optional[int] = None
    disponibles: Optional[int] = None


class TimbradoUsageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    timbrado_id: UUID
    numero_utilizado: int
    sale_id: Optional[UUID]
    tipo_documento: str
    used_at: datetime


class NotaCreditoDebitoCreate(BaseModel):
    sale_id: UUID
    tipo: str  # credito, debito
    motivo: str
    items: Optional[list[dict]] = None

    # Si se pasa manual
    total: Optional[Decimal] = None
    base_gravada_10: Optional[Decimal] = None
    base_gravada_5: Optional[Decimal] = None
    base_exenta: Optional[Decimal] = None
    iva_10: Optional[Decimal] = None
    iva_5: Optional[Decimal] = None


class NotaCreditoDebitoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    sale_id: UUID
    tipo: str
    numero: str
    cdc: Optional[str]
    timbrado_numero: Optional[str]
    numero_preimpreso: Optional[str]
    motivo: str
    subtotal: Decimal
    descuento_total: Decimal
    base_gravada_10: Decimal
    base_gravada_5: Decimal
    base_exenta: Decimal
    iva_10: Decimal
    iva_5: Decimal
    total: Decimal
    sifen_estado: Optional[str]
    estado: str
    created_at: datetime
