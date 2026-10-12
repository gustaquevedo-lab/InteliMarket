"""Kit schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class KitItemCreate(BaseModel):
    product_id: uuid.UUID
    variant_id: Optional[uuid.UUID] = None
    cantidad: float = 1


class KitCreate(BaseModel):
    company_id: Optional[uuid.UUID] = uuid.UUID("00000000-0000-0000-0000-000000000010")
    product_id: Optional[uuid.UUID] = None
    nombre: str
    descripcion: Optional[str] = None
    precio_venta: Optional[float] = None
    modalidad_facturacion: Optional[str] = "item_unico"  # 'item_unico' (IVA 10%) | 'desglosado' (IVA individual)
    codigo_barra: Optional[str] = None
    sku: Optional[str] = None
    items: list[KitItemCreate] = []


class KitUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio_venta: Optional[float] = None
    modalidad_facturacion: Optional[str] = None
    codigo_barra: Optional[str] = None
    sku: Optional[str] = None
    activo: Optional[bool] = None
    items: Optional[list[KitItemCreate]] = None


class KitItemResponse(BaseModel):
    id: Optional[str] = None
    kit_id: Optional[str] = None
    product_id: str
    variant_id: Optional[str] = None
    nombre: Optional[str] = None
    sku: Optional[str] = None
    codigo_barra: Optional[str] = None
    cantidad: float = 1
    iva_tasa: Optional[float] = 10.0
    stock_actual: Optional[float] = 0.0
    costo_unitario: Optional[float] = 0
    precio_unitario: Optional[float] = 0
    subtotal_costo: Optional[float] = 0
    subtotal_precio: Optional[float] = 0
    precio_con_descuento: Optional[float] = 0
    descuento_prorrateado_pct: Optional[float] = 0

    class Config:
        from_attributes = True


class KitResponse(BaseModel):
    id: str
    company_id: str
    product_id: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    precio_venta: Optional[float] = None
    modalidad_facturacion: str = "item_unico"  # 'item_unico' | 'desglosado'
    codigo_barra: Optional[str] = None
    sku: Optional[str] = None
    costo_total: Optional[float] = 0
    precio_individual_total: Optional[float] = 0
    margen_monto: Optional[float] = 0
    margen_pct: Optional[float] = 0
    ahorro_cliente_monto: Optional[float] = 0
    stock_potencial_kits: Optional[float] = 0
    producto_cuello_botella: Optional[str] = None
    activo: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: list[KitItemResponse] = []

    class Config:
        from_attributes = True


class KitPriceResponse(BaseModel):
    kit_id: str
    nombre: str
    precio_venta: Optional[float] = None
    precio_calculado: float
    costo_total: Optional[float] = 0
    margen_monto: Optional[float] = 0
    margen_pct: Optional[float] = 0
    diferencia: float
    items: list[KitItemResponse] = []
