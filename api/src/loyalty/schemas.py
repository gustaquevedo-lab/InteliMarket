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
    multiplicador_bronce: Decimal = Decimal("1.00")
    multiplicador_plata: Decimal = Decimal("1.20")
    multiplicador_oro: Decimal = Decimal("1.50")
    multiplicador_vip: Decimal = Decimal("2.00")
    promocion_activa: bool = False
    promocion_nombre: Optional[str] = None
    multiplicador_promocional: Decimal = Decimal("1.00")


class LoyaltyConfigUpdate(BaseModel):
    puntos_por_guarani: Optional[int] = None
    guarani_por_punto: Optional[int] = None
    vencimiento_dias: Optional[int] = None
    canje_minimo_puntos: Optional[int] = None
    bienvenida_puntos: Optional[int] = None
    cumpleanos_puntos: Optional[int] = None
    crear_en_venta: Optional[bool] = None
    activo: Optional[bool] = None
    multiplicador_bronce: Optional[Decimal] = None
    multiplicador_plata: Optional[Decimal] = None
    multiplicador_oro: Optional[Decimal] = None
    multiplicador_vip: Optional[Decimal] = None
    promocion_activa: Optional[bool] = None
    promocion_nombre: Optional[str] = None
    multiplicador_promocional: Optional[Decimal] = None


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
    multiplicador_bronce: Decimal = Decimal("1.00")
    multiplicador_plata: Decimal = Decimal("1.20")
    multiplicador_oro: Decimal = Decimal("1.50")
    multiplicador_vip: Decimal = Decimal("2.00")
    promocion_activa: bool = False
    promocion_nombre: Optional[str] = None
    multiplicador_promocional: Decimal = Decimal("1.00")
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
    is_member: bool = True
    extra_club_numero: Optional[str] = None


class LoyaltyRewardCreate(BaseModel):
    company_id: UUID
    nombre: str
    descripcion: Optional[str] = None
    puntos_requeridos: int
    tipo_recompensa: str
    valor_recompensa: Optional[Decimal] = None
    stock: Optional[int] = 0
    imagen_url: Optional[str] = None
    supplier_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    warehouse_id: Optional[UUID] = None
    patrocinador_nombre: Optional[str] = None
    aporte_tipo: Optional[str] = "donacion_100"
    unidades_pactadas: Optional[int] = 0
    costo_referencial: Optional[Decimal] = None
    notas: Optional[str] = None


class LoyaltyRewardUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    puntos_requeridos: Optional[int] = None
    tipo_recompensa: Optional[str] = None
    valor_recompensa: Optional[Decimal] = None
    stock: Optional[int] = None
    imagen_url: Optional[str] = None
    activo: Optional[bool] = None
    supplier_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    warehouse_id: Optional[UUID] = None
    patrocinador_nombre: Optional[str] = None
    aporte_tipo: Optional[str] = None
    unidades_pactadas: Optional[int] = None
    costo_referencial: Optional[Decimal] = None
    notas: Optional[str] = None


class LoyaltyRewardResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    descripcion: Optional[str] = None
    puntos_requeridos: int
    tipo_recompensa: str
    valor_recompensa: Optional[Decimal] = None
    stock: Optional[int] = 0
    imagen_url: Optional[str] = None
    activo: bool
    supplier_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    warehouse_id: Optional[UUID] = None
    patrocinador_nombre: Optional[str] = None
    aporte_tipo: Optional[str] = "donacion_100"
    unidades_pactadas: Optional[int] = 0
    costo_referencial: Optional[Decimal] = None
    notas: Optional[str] = None
    warehouse_nombre: Optional[str] = None
    product_sku: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RewardStockEntryCreate(BaseModel):
    cantidad: int
    remision_proveedor: Optional[str] = None
    costo_unitario: Optional[Decimal] = None
    notas: Optional[str] = None


class RewardRedeemCreate(BaseModel):
    customer_id: UUID
    company_id: UUID
    cantidad: int = 1
    notas: Optional[str] = None


class RewardRedemptionResponse(BaseModel):
    id: UUID
    company_id: UUID
    customer_id: UUID
    reward_id: UUID
    warehouse_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None
    puntos_canjeados: int
    cantidad: int
    comprobante_numero: Optional[str] = None
    entregado_por: Optional[str] = None
    notas: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
