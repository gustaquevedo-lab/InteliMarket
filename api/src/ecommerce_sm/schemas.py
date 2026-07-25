from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime, date, time
import uuid


class EcommerceProductCreate(BaseModel):
    branch_id: str
    product_id: str
    online_price: float
    compare_at_price: Optional[float] = None
    stock_available: int = 0
    low_stock_threshold: int = 5
    description_online: Optional[str] = None
    images: Optional[list[str]] = None
    category_online: Optional[str] = None
    tags: Optional[list[str]] = None
    aisle_location: Optional[str] = None
    max_per_order: int = 99
    requires_age_verification: bool = False
    online_visible: bool = True
    sort_order: int = 0


class EcommerceProductUpdate(BaseModel):
    online_price: Optional[float] = None
    compare_at_price: Optional[float] = None
    stock_available: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    description_online: Optional[str] = None
    images: Optional[list[str]] = None
    category_online: Optional[str] = None
    tags: Optional[list[str]] = None
    aisle_location: Optional[str] = None
    max_per_order: Optional[int] = None
    online_visible: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class EcommerceProductResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    branch_id: uuid.UUID
    product_id: uuid.UUID
    online_visible: bool
    online_price: float
    compare_at_price: Optional[float]
    stock_available: int
    low_stock_threshold: int
    description_online: Optional[str]
    images: Optional[Any]
    category_online: Optional[str]
    tags: Optional[Any]
    aisle_location: Optional[str]
    max_per_order: int
    requires_age_verification: bool
    sort_order: int
    is_active: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


class OrderItemInput(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float


class OrderCreate(BaseModel):
    branch_id: str
    customer_id: str
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    order_type: str = "pickup"
    items: list[OrderItemInput]
    notes: Optional[str] = None
    pickup_slot_id: Optional[str] = None
    pickup_date: Optional[date] = None
    pickup_start: Optional[time] = None
    pickup_end: Optional[time] = None
    delivery_zone_id: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    delivery_date: Optional[date] = None
    delivery_start: Optional[time] = None
    delivery_end: Optional[time] = None
    payment_method: Optional[str] = None
    shipping_cost: float = 0


class OrderStatusUpdate(BaseModel):
    status: str
    cancel_reason: Optional[str] = None


class OrderResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    branch_id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    customer_email: Optional[str]
    customer_phone: Optional[str]
    order_number: str
    order_type: str
    status: str
    subtotal: float
    shipping_cost: float
    discount: float
    total: float
    payment_status: str
    payment_method: Optional[str]
    notes: Optional[str]
    pickup_slot_id: Optional[str]
    pickup_date: Optional[date]
    pickup_start: Optional[time]
    pickup_end: Optional[time]
    delivery_zone_id: Optional[str]
    delivery_address: Optional[str]
    delivery_lat: Optional[float]
    delivery_lng: Optional[float]
    delivery_date: Optional[date]
    delivery_start: Optional[time]
    delivery_end: Optional[time]
    is_picked: bool
    picking_list_id: Optional[str]
    confirmed_at: Optional[datetime]
    preparing_at: Optional[datetime]
    ready_at: Optional[datetime]
    picked_up_at: Optional[datetime]
    in_transit_at: Optional[datetime]
    delivered_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    items: list[Any] = []
    payments: list[Any] = []
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class PickupSlotCreate(BaseModel):
    branch_id: str
    slot_date: date
    start_time: time
    end_time: time
    max_orders: int = 10


class PickupSlotResponse(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    slot_date: date
    start_time: time
    end_time: time
    max_orders: int
    current_orders: int
    is_active: bool
    available: Optional[int] = None

    class Config:
        from_attributes = True


class DeliveryZoneCreate(BaseModel):
    name: str
    description: Optional[str] = None
    base_price: float = 0
    price_per_km: float = 0
    free_from_amount: Optional[float] = None
    estimated_minutes: int = 30
    polygon_coords: Optional[Any] = None
    is_active: bool = True


class DeliveryZoneResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    base_price: float
    price_per_km: float
    free_from_amount: Optional[float]
    estimated_minutes: int
    polygon_coords: Optional[Any]
    is_active: bool

    class Config:
        from_attributes = True


class DeliverySlotCreate(BaseModel):
    zone_id: str
    slot_date: date
    start_time: time
    end_time: time
    max_orders: int = 10


class DeliverySlotResponse(BaseModel):
    id: uuid.UUID
    zone_id: uuid.UUID
    slot_date: date
    start_time: time
    end_time: time
    max_orders: int
    current_orders: int
    is_active: bool
    available: Optional[int] = None
    zone_name: Optional[str] = None

    class Config:
        from_attributes = True


class PickingListAssign(BaseModel):
    assigned_to: str


class PickingScanItem(BaseModel):
    picking_item_id: str
    scanned_quantity: int


class PickingListResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    branch_id: uuid.UUID
    assigned_to: Optional[str]
    status: str
    total_items: int
    picked_items: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    items: list[Any] = []
    order_number: Optional[str] = None
    customer_name: Optional[str] = None
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class PaymentRecord(BaseModel):
    order_id: str
    gateway: str
    transaction_id: Optional[str] = None
    amount: float
    currency: str = "PYG"


class ShippingCalcInput(BaseModel):
    zone_id: str
    distance_km: float = 0
    order_total: float = 0


class ShippingCalcResult(BaseModel):
    base_price: float
    distance_charge: float
    free_delivery: bool
    total_shipping: float
    estimated_minutes: int


class DashboardResponse(BaseModel):
    total_orders_today: int = 0
    total_orders_week: int = 0
    pending_orders: int = 0
    preparing_orders: int = 0
    ready_orders: int = 0
    in_transit_orders: int = 0
    delivered_today: int = 0
    avg_order_value: float = 0
    total_revenue_today: float = 0
    total_revenue_week: float = 0
    pickup_vs_delivery: Optional[Any] = None
    orders_by_hour: Optional[Any] = None
    top_products: list[Any] = []
    recent_orders: list[Any] = []
    picking_pending: int = 0
    picking_in_progress: int = 0


class BulkSlotGenerate(BaseModel):
    branch_id: str
    zone_id: Optional[str] = None
    slot_type: str = "pickup"
    start_date: date
    end_date: date
    weekdays: list[int] = [0, 1, 2, 3, 4, 5, 6]
    slots: list[dict]  # [{"start": "08:00", "end": "10:00", "max_orders": 10}, ...]
