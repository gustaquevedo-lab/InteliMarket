from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class CommissionRuleCreate(BaseModel):
    company_id: UUID
    nombre: str
    tipo: str
    vendedor_id: Optional[UUID] = None
    porcentaje: Decimal = Field(ge=0, le=100)
    aplica_a: str = "total"
    categoria_ids: Optional[list[UUID]] = None
    producto_ids: Optional[list[UUID]] = None
    monto_minimo: Optional[Decimal] = None
    monto_maximo: Optional[Decimal] = None
    valido_desde: Optional[date] = None
    valido_hasta: Optional[date] = None


class CommissionRuleUpdate(BaseModel):
    nombre: Optional[str] = None
    porcentaje: Optional[Decimal] = None
    aplica_a: Optional[str] = None
    vendedor_id: Optional[UUID] = None
    categoria_ids: Optional[list[UUID]] = None
    producto_ids: Optional[list[UUID]] = None
    monto_minimo: Optional[Decimal] = None
    monto_maximo: Optional[Decimal] = None
    valido_desde: Optional[date] = None
    valido_hasta: Optional[date] = None
    activo: Optional[bool] = None


class CommissionRuleResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    tipo: str
    vendedor_id: Optional[UUID] = None
    porcentaje: Decimal
    aplica_a: str
    categoria_ids: Optional[list[UUID]] = None
    producto_ids: Optional[list[UUID]] = None
    monto_minimo: Optional[Decimal] = None
    monto_maximo: Optional[Decimal] = None
    valido_desde: Optional[date] = None
    valido_hasta: Optional[date] = None
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SalesCommissionResponse(BaseModel):
    id: UUID
    company_id: UUID
    rule_id: Optional[UUID] = None
    sale_id: Optional[UUID] = None
    vendedor_id: Optional[UUID] = None
    base_calculo: Decimal
    porcentaje: Decimal
    monto_comision: Decimal
    moneda: str
    estado: str
    fecha_pago: Optional[date] = None
    notas: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CommissionSummary(BaseModel):
    vendedor_id: UUID
    total_ventas: Decimal
    total_comisiones: Decimal
    cantidad_operaciones: int
    pendiente_pago: Decimal
