from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class LoyaltyConfigCreate(BaseModel):
    company_id: UUID
    puntos_por_guarani: int = 1
    guarani_por_punto: int = 100
    vencimiento_dias: int = 365
    canje_minimo_puntos: int = 100
    bienvenida_puntos: int = 50
    cumpleanos_puntos: int = 200
    crear_en_venta: bool = True
    activo: bool = True


class LoyaltyConfigUpdate(BaseModel):
    puntos_por_guarani: Optional[int] = None
    guarani_por_punto: Optional[int] = None
    vencimiento_dias: Optional[int] = None
    canje_minimo_puntos: Optional[int] = None
    bienvenida_puntos: Optional[int] = None
    cumpleanos_puntos: Optional[int] = None
    crear_en_venta: Optional[bool] = None
    activo: Optional[bool] = None


class LoyaltyConfigResponse(BaseModel):
    id: UUID
    company_id: UUID
    puntos_por_guarani: int
    guarani_por_punto: int
    vencimiento_dias: int
    canje_minimo_puntos: int
    bienvenida_puntos: int
    cumpleanos_puntos: int
    crear_en_venta: bool
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PointsCreate(BaseModel):
    company_id: UUID
    customer_id: UUID
    tipo: str
    puntos: int
    referencia_tipo: Optional[str] = None
    referencia_id: Optional[str] = None
    descripcion: Optional[str] = None


class PointsResponse(BaseModel):
    id: UUID
    company_id: UUID
    customer_id: UUID
    tipo: str
    puntos: int
    referencia_tipo: Optional[str] = None
    referencia_id: Optional[str] = None
    descripcion: Optional[str] = None
    vence_en: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PointsBalance(BaseModel):
    customer_id: UUID
    total_puntos: int = 0
    puntos_por_vencer: int = 0


class LoyaltyRewardCreate(BaseModel):
    company_id: UUID
    nombre: str
    descripcion: Optional[str] = None
    puntos_requeridos: int
    tipo_recompensa: str
    valor_recompensa: Optional[Decimal] = None
    stock: Optional[int] = None
    imagen_url: Optional[str] = None


class LoyaltyRewardUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    puntos_requeridos: Optional[int] = None
    tipo_recompensa: Optional[str] = None
    valor_recompensa: Optional[Decimal] = None
    stock: Optional[int] = None
    imagen_url: Optional[str] = None
    activo: Optional[bool] = None


class LoyaltyRewardResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    descripcion: Optional[str] = None
    puntos_requeridos: int
    tipo_recompensa: str
    valor_recompensa: Optional[Decimal] = None
    stock: Optional[int] = None
    imagen_url: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
