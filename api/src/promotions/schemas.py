from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, time, datetime
from decimal import Decimal


class PromotionCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    tipo: str  # porcentaje | monto_fijo | dos_por_uno | combo_precio | cantidad_lleva
    valor: Optional[Decimal] = None
    valor_maximo: Optional[Decimal] = None
    aplica_a: str  # producto | categoria | carrito | marca
    producto_ids: Optional[list[str]] = None
    categoria_ids: Optional[list[str]] = None
    monto_minimo_compra: Optional[Decimal] = None
    cantidad_minima: Optional[int] = None
    cantidad_maxima_items: Optional[int] = None
    aplicaciones_por_cliente: Optional[int] = None
    combinable: bool = False
    valido_desde: date
    valido_hasta: date
    horario_desde: Optional[time] = None
    horario_hasta: Optional[time] = None
    dias_semana: Optional[list[int]] = None
    codigo_cupon: Optional[str] = None
    requiere_cupon: bool = False
    usos_maximos: Optional[int] = None
    activo: bool = True


class PromotionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    valor: Optional[Decimal] = None
    valor_maximo: Optional[Decimal] = None
    aplica_a: Optional[str] = None
    producto_ids: Optional[list[str]] = None
    categoria_ids: Optional[list[str]] = None
    monto_minimo_compra: Optional[Decimal] = None
    cantidad_minima: Optional[int] = None
    cantidad_maxima_items: Optional[int] = None
    aplicaciones_por_cliente: Optional[int] = None
    combinable: Optional[bool] = None
    valido_desde: Optional[date] = None
    valido_hasta: Optional[date] = None
    horario_desde: Optional[time] = None
    horario_hasta: Optional[time] = None
    dias_semana: Optional[list[int]] = None
    codigo_cupon: Optional[str] = None
    requiere_cupon: Optional[bool] = None
    usos_maximos: Optional[int] = None
    activo: Optional[bool] = None


class PromotionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    tipo: str
    valor: Optional[float] = None
    valor_maximo: Optional[float] = None
    aplica_a: str
    producto_ids: Optional[list[str]] = None
    categoria_ids: Optional[list[str]] = None
    monto_minimo_compra: Optional[float] = None
    cantidad_minima: Optional[int] = None
    cantidad_maxima_items: Optional[int] = None
    aplicaciones_por_cliente: Optional[int] = None
    combinable: bool = False
    valido_desde: Optional[date] = None
    valido_hasta: Optional[date] = None
    horario_desde: Optional[str] = None
    horario_hasta: Optional[str] = None
    dias_semana: Optional[list[int]] = None
    codigo_cupon: Optional[str] = None
    requiere_cupon: bool = False
    usos_maximos: Optional[int] = None
    usos_actuales: int = 0
    activo: bool = True
    created_at: Optional[datetime] = None


class ValidateCartInput(BaseModel):
    """Input for POS to check applicable promotions"""
    items: list["CartItemInput"]
    customer_id: Optional[str] = None
    branch_id: Optional[str] = None
    codigo_cupon: Optional[str] = None


class CartItemInput(BaseModel):
    producto_id: str
    categoria_id: Optional[str] = None
    cantidad: int
    precio_unitario: Decimal


class ValidatedPromotion(BaseModel):
    promotion_id: str
    nombre: str
    tipo: str
    descuento: float
    descuento_maximo: Optional[float] = None
    items_aplicados: list[str]  # producto_ids
    descripcion: Optional[str] = None


class CalculatePromoResponse(BaseModel):
    applicable_promotions: list[ValidatedPromotion]
    total_descuento: float
    total_final: float
