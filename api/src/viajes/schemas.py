from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel


class TripVehicleCreate(BaseModel):
    company_id: str
    patente: str
    descripcion: Optional[str] = None
    max_weight_kg: Decimal


class TripVehicleResponse(BaseModel):
    id: str
    company_id: str
    patente: str
    descripcion: Optional[str] = None
    max_weight_kg: Decimal
    activo: bool

    class Config:
        from_attributes = True


class TripCreate(BaseModel):
    company_id: str
    cobrador_id: str
    patente: str
    fecha: date
    despachante_id: str


class TripStopAssign(BaseModel):
    sales_order_id: str
    customer_id: str
    orden_visita: int


class TripStopsUpdate(BaseModel):
    stops: List[TripStopAssign]


class TripStopItemConfirm(BaseModel):
    stop_item_id: str
    cantidad_entregada: Decimal
    cantidad_rechazada: Decimal
    cantidad_faltante: Decimal


class StopConfirmInput(BaseModel):
    items: List[TripStopItemConfirm]
    firmado: bool
    observaciones: Optional[str] = None


class KmSalidaInput(BaseModel):
    km_salida: int


class KmLlegadaInput(BaseModel):
    km_llegada: int


class TripStopItemResponse(BaseModel):
    id: str
    stop_id: str
    sales_order_item_id: str
    product_id: str
    cantidad_asignada: Decimal
    cantidad_entregada: Decimal
    cantidad_rechazada: Decimal
    cantidad_faltante: Decimal
    nc_id: Optional[str] = None

    class Config:
        from_attributes = True


class TripStopResponse(BaseModel):
    id: str
    trip_id: str
    sales_order_id: str
    customer_id: str
    orden_visita: int
    estado: str
    firmado: bool
    observaciones: Optional[str] = None
    visited_at: Optional[datetime] = None
    items: Optional[List[TripStopItemResponse]] = None

    class Config:
        from_attributes = True


class TripResponse(BaseModel):
    id: str
    company_id: str
    cobrador_id: str
    patente: str
    fecha: date
    estado: str
    km_salida: Optional[int] = None
    km_llegada: Optional[int] = None
    peso_total_kg: Optional[Decimal] = None
    route_session_id: Optional[str] = None
    despachante_id: str
    created_at: datetime
    stops: Optional[List[TripStopResponse]] = None

    class Config:
        from_attributes = True


class PendingOrderForDispatch(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    numero: str
    total: Decimal
    peso_kg: Decimal
    zona: Optional[str] = None
