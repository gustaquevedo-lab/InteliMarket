"""Currency schemas"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class CurrencyResponse(BaseModel):
    id: UUID
    company_id: UUID
    codigo: str
    nombre: str
    simbolo: Optional[str] = None
    activa: bool
    es_moneda_local: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExchangeRateResponse(BaseModel):
    id: UUID
    company_id: UUID
    moneda: str
    tasa_compra: Optional[Decimal] = None
    tasa_venta: Optional[Decimal] = None
    fuente: str
    fecha: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BcpRateResponse(BaseModel):
    codigo: str
    nombre: str
    compra: Decimal
    venta: Decimal
