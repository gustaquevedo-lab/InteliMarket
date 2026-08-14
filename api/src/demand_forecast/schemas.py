from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, date
import uuid


class ForecastConfigCreate(BaseModel):
    model_type: str = "exponential_smoothing"
    horizon_days: int = 90
    seasonality_period: int = 7
    confidence_level: float = 95.0
    min_history_days: int = 60
    anomaly_threshold: float = 2.5
    reorder_weeks: int = 2
    safety_stock_days: int = 7
    default_markup_pct: float = 15.0


class ForecastConfigUpdate(BaseModel):
    model_type: Optional[str] = None
    horizon_days: Optional[int] = None
    seasonality_period: Optional[int] = None
    confidence_level: Optional[float] = None
    min_history_days: Optional[int] = None
    anomaly_threshold: Optional[float] = None
    reorder_weeks: Optional[int] = None
    safety_stock_days: Optional[int] = None
    default_markup_pct: Optional[float] = None
    activo: Optional[bool] = None


class ForecastConfigResponse(BaseModel):
    id: str
    company_id: str
    model_type: str
    horizon_days: int
    seasonality_period: int
    confidence_level: float
    min_history_days: int
    anomaly_threshold: float
    reorder_weeks: int
    safety_stock_days: int
    default_markup_pct: float
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ForecastGenerateRequest(BaseModel):
    product_ids: Optional[list[str]] = None  # None = all products
    customer_ids: Optional[list[str]] = None
    zones: Optional[list[str]] = None
    horizon_days: Optional[int] = None
    force: bool = False  # regenerate even if exists


class ForecastPredictionResponse(BaseModel):
    id: str
    company_id: str
    product_id: str
    customer_id: Optional[str]
    zone: Optional[str]
    forecast_date: date
    predicted_qty: float
    confidence_lower: Optional[float]
    confidence_upper: Optional[float]
    confidence_score: Optional[float]
    model_used: Optional[str]
    factors: Optional[Any]
    is_override: bool
    original_prediction: Optional[float]
    override_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ForecastOverrideCreate(BaseModel):
    product_id: uuid.UUID
    customer_id: Optional[uuid.UUID] = None
    zone: Optional[str] = None
    forecast_date: date
    adjusted_qty: float
    reason: str


class ForecastOverrideResponse(BaseModel):
    id: str
    company_id: str
    product_id: str
    customer_id: Optional[str]
    zone: Optional[str]
    forecast_date: date
    original_qty: float
    adjusted_qty: float
    reason: str
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class AnomalyDetectionResponse(BaseModel):
    id: str
    company_id: str
    product_id: str
    customer_id: Optional[str]
    zone: Optional[str]
    tipo: str
    severity: str
    detected_date: date
    expected_value: Optional[float]
    actual_value: Optional[float]
    deviation_pct: Optional[float]
    z_score: Optional[float]
    details: Optional[Any]
    reviewed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AnomalyReviewRequest(BaseModel):
    reviewed: bool


class PurchaseSuggestionResponse(BaseModel):
    id: str
    company_id: str
    product_id: str
    supplier_id: Optional[str]
    suggested_qty: float
    suggested_date: date
    expected_price: Optional[float]
    expected_total: Optional[float]
    confidence_score: Optional[float]
    forecast_demand: Optional[float]
    current_stock: Optional[float]
    stock_after_lead: Optional[float]
    lead_time_days: Optional[int]
    status: str
    converted_order_id: Optional[str]
    notes: Optional[str]
    supplier_candidates: Optional[list[dict[str, Any]]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseSuggestionUpdate(BaseModel):
    status: str  # suggested, converted, rejected
    converted_order_id: Optional[str] = None
    notes: Optional[str] = None


class ForecastAccuracyResponse(BaseModel):
    id: str
    company_id: str
    product_id: str
    customer_id: Optional[str]
    zone: Optional[str]
    forecast_date: date
    predicted_qty: float
    actual_qty: Optional[float]
    error_absolute: Optional[float]
    error_pct: Optional[float]
    error_squared: Optional[float]
    modelo: Optional[str]
    recorded_at: datetime

    class Config:
        from_attributes = True


class ForecastDashboard(BaseModel):
    total_products_forecasted: int
    total_predictions: int
    pending_suggestions: int
    active_anomalies: int
    overall_accuracy_pct: Optional[float]
    total_overrides: int
    upcoming_purchase_suggestions: list[PurchaseSuggestionResponse]
    recent_anomalies: list[AnomalyDetectionResponse]
    accuracy_trend: list[dict]  # [{period, mape, mae}]
