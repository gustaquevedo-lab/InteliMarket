from pydantic import BaseModel, field_validator, ConfigDict
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

ESTADOS_VALIDOS = ["pendiente", "entregado", "cobrado", "rechazado", "anulado", "en_cartera", "depositado"]

# Transiciones permitidas -- un cheque cobrado o anulado es un hecho consumado,
# no vuelve atras; rechazado puede reintentarse marcandolo pendiente de nuevo
# tras renegociar con el proveedor.
TRANSICIONES_VALIDAS = {
    "pendiente": {"entregado", "cobrado", "rechazado", "anulado"},
    "entregado": {"cobrado", "rechazado", "anulado", "pendiente"},
    "rechazado": {"pendiente", "anulado"},
    "en_cartera": {"depositado", "cobrado", "rechazado", "anulado"},
    "depositado": {"cobrado", "rechazado", "anulado"},
    "cobrado": set(),
    "anulado": set(),
}


class ChequeCreate(BaseModel):
    numero: str
    banco_emisor: Optional[str] = None
    bank_account_id: Optional[UUID] = None
    beneficiario: str
    supplier_id: Optional[UUID] = None
    monto: Decimal
    moneda: str = "PYG"
    fecha_emision: date
    fecha_entrega: Optional[date] = None
    fecha_pago: Optional[date] = None
    diferido: bool = False
    invoice_payment_id: Optional[UUID] = None
    concepto: Optional[str] = None
    notas: Optional[str] = None

    @field_validator("fecha_entrega", "fecha_pago", mode="before")
    @classmethod
    def parse_optional_date(cls, v):
        if v == "" or v is None:
            return None
        return v


class ChequeEstadoUpdate(BaseModel):
    estado: str
    notas: Optional[str] = None
    motivo_rechazo: Optional[str] = None
    costo_rechazo: Optional[Decimal] = None
    bank_account_id: Optional[UUID] = None


class ChequeUpdate(BaseModel):
    numero: Optional[str] = None
    banco_emisor: Optional[str] = None
    bank_account_id: Optional[UUID] = None
    beneficiario: Optional[str] = None
    supplier_id: Optional[UUID] = None
    monto: Optional[Decimal] = None
    moneda: Optional[str] = None
    fecha_emision: Optional[date] = None
    fecha_entrega: Optional[date] = None
    fecha_pago: Optional[date] = None
    diferido: Optional[bool] = None
    estado: Optional[str] = None
    concepto: Optional[str] = None
    notas: Optional[str] = None

    @field_validator("fecha_entrega", "fecha_pago", "fecha_emision", mode="before")
    @classmethod
    def parse_optional_date(cls, v):
        if v == "" or v is None:
            return None
        return v



class ChequeHistorialResponse(BaseModel):
    id: UUID
    estado_anterior: Optional[str] = None
    estado_nuevo: str
    user_nombre: Optional[str] = None
    notas: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChequeResponse(BaseModel):
    id: UUID
    company_id: UUID
    numero: str
    numero_confiable: bool
    banco_emisor: Optional[str] = None
    bank_account_id: Optional[UUID] = None
    beneficiario: str
    supplier_id: Optional[UUID] = None
    supplier_nombre: Optional[str] = None
    monto: float
    moneda: str
    fecha_emision: date
    fecha_entrega: Optional[date] = None
    fecha_pago: Optional[date] = None
    diferido: bool
    estado: str
    tipo: Optional[str] = None
    invoice_payment_id: Optional[UUID] = None
    concepto: Optional[str] = None
    notas: Optional[str] = None
    dias_para_vencer: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChequeDashboard(BaseModel):
    total_cartera: float
    cantidad_cartera: int
    vencidos_sin_cobrar: float
    cantidad_vencidos: int
    vence_hoy: float
    cantidad_vence_hoy: int
    por_vencer_7d: float
    cantidad_por_vencer_7d: int
    por_vencer_30d: float
    cantidad_por_vencer_30d: int
    rechazados_monto: float
    cantidad_rechazados: int
    cobrados_mes: float
    cantidad_cobrados_mes: int
