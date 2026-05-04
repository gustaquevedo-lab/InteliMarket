"""Inventory schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class WarehouseCreate(BaseModel):
    company_id: UUID
    branch_id: Optional[UUID] = None
    codigo: str = Field(min_length=1, max_length=10)
    nombre: str = Field(min_length=1, max_length=100)
    direccion: Optional[str] = None
    tipo: str = "principal"


class WarehouseResponse(BaseModel):
    id: UUID
    company_id: UUID
    branch_id: Optional[UUID] = None
    codigo: str
    nombre: str
    direccion: Optional[str] = None
    tipo: str
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StockResponse(BaseModel):
    id: UUID
    warehouse_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    cantidad: int
    cantidad_reservada: int
    costo_unitario: Optional[Decimal] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class MovementCreate(BaseModel):
    company_id: UUID
    warehouse_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    tipo: str
    cantidad: int
    costo_unitario: Optional[Decimal] = None
    referencia_type: Optional[str] = None
    referencia_id: Optional[str] = None
    motivo: Optional[str] = None
    user_id: Optional[UUID] = None


class MovementResponse(BaseModel):
    id: UUID
    company_id: UUID
    warehouse_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    tipo: str
    cantidad: int
    costo_unitario: Optional[Decimal] = None
    referencia_type: Optional[str] = None
    referencia_id: Optional[UUID] = None
    motivo: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransferCreate(BaseModel):
    company_id: UUID
    warehouse_origen_id: UUID
    warehouse_destino_id: UUID
    items: list[dict]
    observaciones: Optional[str] = None


class TransferResponse(BaseModel):
    id: UUID
    company_id: UUID
    codigo: str
    warehouse_origen_id: UUID
    warehouse_destino_id: UUID
    estado: str
    fecha_envio: Optional[datetime] = None
    fecha_recepcion: Optional[datetime] = None
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdjustmentCreate(BaseModel):
    company_id: UUID
    warehouse_id: UUID
    motivo: str
    items: list[dict]
    observaciones: Optional[str] = None


class AdjustmentResponse(BaseModel):
    id: UUID
    company_id: UUID
    warehouse_id: UUID
    codigo: str
    motivo: str
    estado: str
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    aprobado_por: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
