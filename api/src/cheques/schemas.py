from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

ESTADOS_VALIDOS = ["pendiente", "entregado", "cobrado", "rechazado", "anulado"]

# Transiciones permitidas -- un cheque cobrado o anulado es un hecho consumado,
# no vuelve atras; rechazado puede reintentarse marcandolo pendiente de nuevo
# tras renegociar con el proveedor.
TRANSICIONES_VALIDAS = {
    "pendiente": {"entregado", "cobrado", "rechazado", "anulado"},
    "entregado": {"cobrado", "rechazado", "anulado"},
    "rechazado": {"pendiente", "anulado"},
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


class ChequeEstadoUpdate(BaseModel):
    estado: str
    notas: Optional[str] = None


class ChequeHistorialResponse(BaseModel):
    id: UUID
    estado_anterior: Optional[str] = None
    estado_nuevo: str
    user_nombre: Optional[str] = None
    notas: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


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
    invoice_payment_id: Optional[UUID] = None
    concepto: Optional[str] = None
    notas: Optional[str] = None
    dias_para_vencer: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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
