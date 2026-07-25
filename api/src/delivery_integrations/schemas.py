from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, date
import uuid


class IntegrationConfigCreate(BaseModel):
    platform: str
    enabled: bool = False
    store_id: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    webhook_secret: Optional[str] = None
    sync_catalog: bool = False
    auto_accept_orders: bool = False
    preparation_time_minutes: int = 30
    commission_pct: float = 0
    config: Optional[Any] = None


class IntegrationConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    store_id: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    webhook_secret: Optional[str] = None
    sync_catalog: Optional[bool] = None
    auto_accept_orders: Optional[bool] = None
    preparation_time_minutes: Optional[int] = None
    commission_pct: Optional[float] = None
    config: Optional[Any] = None


class IntegrationConfigResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    platform: str
    enabled: bool
    store_id: Optional[str]
    sync_catalog: bool
    auto_accept_orders: bool
    preparation_time_minutes: int
    commission_pct: float
    config: Optional[Any]
    is_active: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class DeliveryOrderResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    platform: str
    platform_order_id: str
    branch_id: Optional[str]
    status: str
    customer_name: Optional[str]
    customer_phone: Optional[str]
    customer_address: Optional[str]
    subtotal: float
    delivery_fee: float
    discount: float
    commission: float
    net_amount: float
    total: float
    order_data: Optional[Any]
    items_data: Optional[Any]
    notes: Optional[str]
    received_at: Optional[datetime]
    accepted_at: Optional[datetime]
    preparing_at: Optional[datetime]
    ready_at: Optional[datetime]
    picked_up_at: Optional[datetime]
    in_transit_at: Optional[datetime]
    delivered_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    cancel_reason: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class DeliveryOrderStatusUpdate(BaseModel):
    status: str
    cancel_reason: Optional[str] = None


class MenuSyncResponse(BaseModel):
    id: uuid.UUID
    platform: str
    status: str
    products_count: int
    error_message: Optional[str]
    sync_type: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class PlatformLogResponse(BaseModel):
    id: uuid.UUID
    platform: str
    event_type: str
    direction: str
    request_url: Optional[str]
    status_code: Optional[int]
    status: str
    error_message: Optional[str]
    duration_ms: Optional[int]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    total_orders_today: int = 0
    total_orders_week: int = 0
    total_sales_today: float = 0
    total_sales_week: float = 0
    total_commission_week: float = 0
    net_sales_week: float = 0
    avg_order_value: float = 0
    avg_prep_time: float = 0
    active_integrations: int = 0
    orders_by_platform: list[Any] = []
    sales_by_platform: list[Any] = []
    recent_orders: list[Any] = []
    status_distribution: list[Any] = []
    daily_trend: list[Any] = []


class WebhookPayload(BaseModel):
    platform: str
    event: str
    data: Any
