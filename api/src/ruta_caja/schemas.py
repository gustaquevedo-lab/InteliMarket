from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class LiquidationItemCreate(BaseModel):
    tipo: str  # cheque, pagare, cobro, otro_ingreso, deposito, gasto, devolucion, credito
    numero: str
    banco: Optional[str] = None
    monto: Decimal
    customer_id: Optional[UUID] = None
    vencimiento: Optional[date] = None


class RouteSessionCreate(BaseModel):
    company_id: str
    cobrador_id: str
    route_id: Optional[str] = None
    fecha: date
    fondo_inicial: Decimal = Decimal(0)
    created_by: str


class RouteSessionResponse(BaseModel):
    id: UUID
    company_id: UUID
    cobrador_id: UUID
    cobrador_nombre: Optional[str] = None
    route_id: Optional[UUID] = None
    fecha: date
    estado: str
    fondo_inicial: Decimal
    fondo_sobrante: Optional[Decimal] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    created_by: UUID
    legacy_caja_id: Optional[int] = None
    trip_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class LiquidationItemResponse(BaseModel):
    id: UUID
    liquidation_id: UUID
    tipo: str
    numero: str
    banco: Optional[str] = None
    monto: Decimal
    customer_id: Optional[UUID] = None
    vencimiento: Optional[date] = None

    class Config:
        from_attributes = True


class RouteLiquidationResponse(BaseModel):
    id: UUID
    route_session_id: UUID
    efectivo_declarado: Decimal
    cheques_declarado: Decimal
    pagares_declarado: Decimal
    nc_aplicadas: Decimal
    descuentos_autorizados: Decimal
    efectivo_esperado: Decimal
    total_cobrado_ar: Decimal
    diferencia: Decimal
    estado: str
    supervisor_id: Optional[UUID] = None
    observaciones: Optional[str] = None
    fecha_autorizacion: Optional[datetime] = None
    created_at: datetime
    items: Optional[list[LiquidationItemResponse]] = None

    class Config:
        from_attributes = True


class RouteSessionDetailResponse(RouteSessionResponse):
    liquidation: Optional[RouteLiquidationResponse] = None
    ar_summary: Optional[dict] = None
    rendicion: Optional[dict] = None  # componentes de la formula + total (calcular_rendicion)


class CloseSessionRequest(BaseModel):
    efectivo_declarado: Decimal
    cheques_declarado: Decimal = Decimal(0)
    pagares_declarado: Decimal = Decimal(0)
    nc_aplicadas: Decimal = Decimal(0)
    descuentos_autorizados: Decimal = Decimal(0)
    items: list[LiquidationItemCreate] = []


class ObserveRequest(BaseModel):
    observaciones: str


class BankDepositCreate(BaseModel):
    company_id: str
    fecha: date
    bank_name: str
    account_number: str
    monto_efectivo: Decimal = Decimal(0)
    monto_cheques: Decimal = Decimal(0)
    referencia: Optional[str] = None
    route_liquidation_ids: list[str] = []
    cash_session_ids: list[str] = []
    observaciones: Optional[str] = None
    created_by: str


class BankDepositResponse(BaseModel):
    id: UUID
    company_id: UUID
    fecha: date
    bank_name: str
    account_number: str
    monto_efectivo: Decimal
    monto_cheques: Decimal
    referencia: Optional[str] = None
    route_liquidation_ids: list
    cash_session_ids: list
    observaciones: Optional[str] = None
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class TreasuryDailySummaryResponse(BaseModel):
    fecha: date
    rutas: list[dict]
    retail: dict
    totales: dict
