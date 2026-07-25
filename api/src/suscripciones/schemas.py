from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, date
import uuid


class PlanItemInput(BaseModel):
    product_id: str
    product_name: str
    quantity: int = 1
    unit_price: float


class SubscriptionPlanCreate(BaseModel):
    customer_id: str
    branch_id: str
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    frequency: str = "weekly"
    delivery_day: Optional[int] = None
    delivery_address: Optional[str] = None
    delivery_zone_id: Optional[str] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    delivery_fee: float = 0
    discount_pct: float = 0
    notes: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    items: list[PlanItemInput]


class SubscriptionPlanUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    frequency: Optional[str] = None
    delivery_day: Optional[int] = None
    delivery_address: Optional[str] = None
    delivery_zone_id: Optional[str] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    delivery_fee: Optional[float] = None
    discount_pct: Optional[float] = None
    notes: Optional[str] = None
    end_date: Optional[date] = None
    items: Optional[list[PlanItemInput]] = None


class PlanItemResponse(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    quantity: int
    unit_price: float

    class Config:
        from_attributes = True


class SubscriptionPlanResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    branch_id: uuid.UUID
    customer_name: Optional[str]
    customer_email: Optional[str]
    customer_phone: Optional[str]
    frequency: str
    delivery_day: Optional[int]
    delivery_address: Optional[str]
    delivery_zone_id: Optional[str]
    delivery_fee: float
    status: str
    discount_pct: float
    notes: Optional[str]
    start_date: date
    end_date: Optional[date]
    next_generation_date: Optional[date]
    skip_next: bool
    pause_reason: Optional[str]
    total_generated: int
    total_spent: float
    is_active: bool
    items: list[Any] = []
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class GeneratedOrderResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    plan_id: uuid.UUID
    customer_id: uuid.UUID
    order_number: str
    status: str
    subtotal: float
    discount: float
    delivery_fee: float
    total: float
    delivery_address: Optional[str]
    scheduled_date: Optional[date]
    generated_at: Optional[datetime]
    notified_at: Optional[datetime]
    ecommerce_order_id: Optional[str]
    items_data: Optional[Any]
    cancel_reason: Optional[str]

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    total_plans: int = 0
    active_plans: int = 0
    paused_plans: int = 0
    cancelled_plans: int = 0
    total_customers: int = 0
    mrr: float = 0
    avg_order_value: float = 0
    retention_rate: float = 0
    orders_generated_total: int = 0
    next_due_generations: int = 0
    plans_by_frequency: list[Any] = []
    recent_generations: list[Any] = []
    top_products: list[Any] = []
