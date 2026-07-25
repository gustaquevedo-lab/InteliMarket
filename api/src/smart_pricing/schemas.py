from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import uuid


class PriceListAssignmentCreate(BaseModel):
    price_list_id: uuid.UUID
    tipo: str  # cliente, grupo, canal, zona
    ref_id: str


class PriceListAssignmentResponse(BaseModel):
    id: str
    company_id: str
    price_list_id: str
    tipo: str
    ref_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class TieredPriceCreate(BaseModel):
    price_list_id: Optional[uuid.UUID] = None
    product_id: uuid.UUID
    min_qty: int = 1
    max_qty: Optional[int] = None
    precio_unitario: float
    moneda: str = "PYG"


class TieredPriceUpdate(BaseModel):
    min_qty: Optional[int] = None
    max_qty: Optional[int] = None
    precio_unitario: Optional[float] = None
    activo: Optional[bool] = None


class TieredPriceResponse(BaseModel):
    id: str
    company_id: str
    price_list_id: Optional[str]
    product_id: str
    min_qty: int
    max_qty: Optional[int]
    precio_unitario: float
    moneda: str
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PromotionCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    tipo: str  # 2x1, quantity_discount, product_bonus, combo, percentage_discount, fixed_discount
    fecha_inicio: datetime
    fecha_fin: datetime
    condiciones: Optional[Any] = None
    prioridad: int = 0
    max_usos: Optional[int] = None
    rewards: list[dict] = []  # [{product_id, qty_required, qty_free, discount_pct, precio_fijo}]
    assignments: list[dict] = []  # [{tipo, ref_id}]


class PromotionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    activo: Optional[bool] = None
    condiciones: Optional[Any] = None
    prioridad: Optional[int] = None
    max_usos: Optional[int] = None


class PromotionResponse(BaseModel):
    id: str
    company_id: str
    nombre: str
    descripcion: Optional[str]
    tipo: str
    fecha_inicio: datetime
    fecha_fin: datetime
    activo: bool
    condiciones: Optional[Any]
    prioridad: int
    max_usos: Optional[int]
    usos_actuales: int
    created_at: datetime
    updated_at: Optional[datetime]
    rewards: list["PromotionRewardResponse"] = []
    assignments: list["PromotionAssignmentResponse"] = []

    class Config:
        from_attributes = True


class PromotionRewardResponse(BaseModel):
    id: str
    promotion_id: str
    product_id: str
    qty_required: int
    qty_free: int
    discount_pct: float
    precio_fijo: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


class PromotionAssignmentResponse(BaseModel):
    id: str
    promotion_id: str
    tipo: str
    ref_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PriceSuggestionCreate(BaseModel):
    product_id: uuid.UUID
    current_price: float
    suggested_price: float
    confidence: Optional[float] = None
    factors: Optional[Any] = None
    source: str = "mixto"


class PriceSuggestionUpdate(BaseModel):
    estado: str  # approved, rejected
    reviewed_by: Optional[uuid.UUID] = None


class PriceSuggestionResponse(BaseModel):
    id: str
    company_id: str
    product_id: str
    current_price: float
    suggested_price: float
    confidence: Optional[float]
    factors: Optional[Any]
    source: str
    estado: str
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PriceChangeRequestCreate(BaseModel):
    product_id: uuid.UUID
    price_list_id: Optional[uuid.UUID] = None
    old_price: float
    new_price: float
    reason: Optional[str] = None
    approval_level: int = 1


class PriceChangeRequestReview(BaseModel):
    status: str  # approved, rejected
    comments: Optional[str] = None
    approved_by: uuid.UUID


class PriceChangeRequestResponse(BaseModel):
    id: str
    company_id: str
    product_id: str
    price_list_id: Optional[str]
    old_price: float
    new_price: float
    reason: Optional[str]
    requested_by: str
    approved_by: Optional[str]
    status: str
    approval_level: int
    comments: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PriceChangeHistoryResponse(BaseModel):
    id: str
    company_id: str
    product_id: str
    price_list_id: Optional[str]
    old_price: float
    new_price: float
    changed_by: str
    change_type: str
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DynamicPriceRequest(BaseModel):
    product_id: uuid.UUID
    current_price: float
    costo_promedio: Optional[float] = None
    demanda_historica: Optional[int] = None  # units sold last 30 days
    stock_actual: Optional[int] = None
    estacionalidad: Optional[float] = 1.0  # 0.5 = low season, 1.5 = high season
    margen_objetivo: Optional[float] = None  # target margin %


class DynamicPriceResponse(BaseModel):
    suggested_price: float
    confidence: float
    factors: dict
    source: str


class PriceManagementDashboard(BaseModel):
    total_price_lists: int
    active_promotions: int
    pending_suggestions: int
    pending_requests: int
    recent_changes: list[PriceChangeHistoryResponse]
