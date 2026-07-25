"""Advanced Inventory schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


# ── Locations ───────────────────────────────────────────────────

class LocationCreate(BaseModel):
    warehouse_id: str
    codigo: str
    pasillo: Optional[str] = None
    estante: Optional[str] = None
    posicion: Optional[str] = None
    capacidad_maxima: Optional[float] = None


class LocationResponse(BaseModel):
    id: UUID
    warehouse_id: UUID
    codigo: str
    pasillo: Optional[str]
    estante: Optional[str]
    posicion: Optional[str]
    capacidad_maxima: Optional[float]
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Picking ─────────────────────────────────────────────────────

class PickingListCreate(BaseModel):
    warehouse_id: str
    numero: str
    referencia_tipo: Optional[str] = None
    referencia_id: Optional[str] = None
    notas: Optional[str] = None
    items: list[dict]


class PickingListResponse(BaseModel):
    id: UUID
    warehouse_id: UUID
    numero: str
    estado: str
    assigned_to: Optional[UUID]
    total_items: int
    picked_items: int
    notas: Optional[str]
    items: list[dict] = []
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PickItemRequest(BaseModel):
    cantidad: float = Field(gt=0)
    lot_id: Optional[str] = None
    location_id: Optional[str] = None


# ── Cycle Count ─────────────────────────────────────────────────

class CycleCountCreate(BaseModel):
    warehouse_id: str
    tipo: str = "rotativo"
    notas: Optional[str] = None


class CycleCountItemCreate(BaseModel):
    product_id: str
    cantidad_sistema: float = 0


class CountItemRequest(BaseModel):
    cantidad_fisica: float = Field(ge=0)
    location_id: Optional[str] = None
    notas: Optional[str] = None


class CycleCountResponse(BaseModel):
    id: UUID
    warehouse_id: UUID
    numero: str
    tipo: str
    estado: str
    conteo_total: int
    conteo_completado: int
    discrepancias: int
    items: list[dict] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ── Lots / FIFO ────────────────────────────────────────────────

class LotResponse(BaseModel):
    id: UUID
    product_id: UUID
    warehouse_id: UUID
    cantidad_disponible: float
    referencia: Optional[str]
    fecha_ingreso: Optional[datetime]
    fecha_vencimiento: Optional[datetime]
    costo_unitario: Optional[float]

    class Config:
        from_attributes = True


class AllocateLotRequest(BaseModel):
    product_id: str
    warehouse_id: str
    cantidad: float = Field(gt=0)


class AllocateLotResponse(BaseModel):
    allocations: list[dict]


# ── Consignment ─────────────────────────────────────────────────

class ConsignmentCreate(BaseModel):
    warehouse_id: str
    product_id: str
    supplier_id: str
    supplier_nombre: str
    cantidad: float = Field(gt=0)
    costo_acordado: Optional[float] = None
    moneda: str = "PYG"
    fecha_vencimiento: Optional[str] = None
    notas: Optional[str] = None


class ConsignmentMovementCreate(BaseModel):
    tipo: str = Field(..., pattern="^(venta|devolucion|ajuste)$")
    cantidad: float = Field(gt=0)
    referencia_tipo: Optional[str] = None
    referencia_id: Optional[str] = None
    notas: Optional[str] = None


class ConsignmentResponse(BaseModel):
    id: UUID
    warehouse_id: UUID
    product_id: UUID
    supplier_id: UUID
    supplier_nombre: str
    cantidad: float
    costo_acordado: Optional[float]
    moneda: str
    activo: bool
    items: list[dict] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ── Auto Replenish ──────────────────────────────────────────────

class ReplenishRuleCreate(BaseModel):
    product_id: str
    warehouse_id: str
    stock_minimo: float = Field(gt=0)
    stock_seguridad: float = 0
    cantidad_reorden: Optional[float] = None
    lead_time_dias: int = 1
    supplier_id: Optional[str] = None
    auto_generar_oc: bool = False


class ReplenishRuleResponse(BaseModel):
    id: UUID
    product_id: UUID
    warehouse_id: UUID
    stock_minimo: float
    stock_seguridad: float
    cantidad_reorden: Optional[float]
    lead_time_dias: int
    activo: bool
    auto_generar_oc: bool
    ultima_alerta_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Dashboard ──────────────────────────────────────────────────

class AdvancedInventoryDashboard(BaseModel):
    total_locations: int
    active_picking_lists: int
    open_cycle_counts: int
    consignment_items: int
    low_stock_alerts: int
    lots_expiring_soon: int
    pending_picks: int
    total_discrepancies: int
    recent_picking_lists: list[dict]
    recent_cycle_counts: list[dict]
    expiring_lots: list[dict]
    low_stock_items: list[dict]
