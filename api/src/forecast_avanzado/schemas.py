from pydantic import BaseModel
from typing import Optional, Any
from datetime import date, datetime
import uuid


# ── HolidayCalendar ──────────────────────────────────────────────

class HolidayCreate(BaseModel):
    name: str
    holiday_date: str
    category: str
    impact_weight: float = 1.0
    repeat_yearly: bool = True
    affected_categories: Optional[list[str]] = None
    lift_multiplier: float = 1.0
    notes: Optional[str] = None


class HolidayResponse(BaseModel):
    id: uuid.UUID
    name: str
    holiday_date: date
    category: str
    impact_weight: float
    repeat_yearly: bool
    affected_categories: Optional[Any]
    lift_multiplier: float
    notes: Optional[str]

    class Config:
        from_attributes = True


# ── ExternalFactor ───────────────────────────────────────────────

class ExternalFactorCreate(BaseModel):
    factor_type: str
    name: str
    factor_date: str
    value: float = 0
    affected_categories: Optional[list[str]] = None
    description: Optional[str] = None


class ExternalFactorResponse(BaseModel):
    id: uuid.UUID
    factor_type: str
    name: str
    factor_date: date
    value: float
    affected_categories: Optional[Any]
    description: Optional[str]

    class Config:
        from_attributes = True


# ── ForecastModelConfig ──────────────────────────────────────────

class ForecastModelConfigResponse(BaseModel):
    id: uuid.UUID
    target_type: str
    target_id: str
    target_name: Optional[str]
    base_daily_sales: float
    dow_coefficients: Optional[Any]
    holiday_coefficient: float
    weather_coefficient: float
    promo_lift_by_type: Optional[Any]
    seasonality_factors: Optional[Any]
    last_calibrated_at: Optional[datetime]
    calibration_samples: int
    mape_score: Optional[float]

    class Config:
        from_attributes = True


class CalibrateRequest(BaseModel):
    target_type: str
    target_id: str
    target_name: Optional[str] = None
    historical_daily_sales: Optional[list[float]] = None


# ── AdvanceForecastResult ────────────────────────────────────────

class ForecastRequest(BaseModel):
    target_type: str
    target_id: str
    target_name: Optional[str] = None
    days: int = 14
    include_decomposition: bool = True


class ForecastResultResponse(BaseModel):
    id: uuid.UUID
    target_type: str
    target_id: str
    target_name: Optional[str]
    forecast_date: date
    baseline: float
    adjusted_forecast: float
    lower_bound: float
    upper_bound: float
    factor_decomposition: Optional[Any]
    confidence_level: float

    class Config:
        from_attributes = True


class FactorImpact(BaseModel):
    day: str
    baseline: float
    holiday_impact: float
    weather_impact: float
    promo_impact: float
    seasonality_impact: float
    adjusted_forecast: float


class MultiDayForecastResponse(BaseModel):
    target_type: str
    target_id: str
    target_name: Optional[str]
    forecasts: list[ForecastResultResponse]
    factor_impacts: list[FactorImpact]


# ── Dashboard ────────────────────────────────────────────────────

class ForecastDashboardResponse(BaseModel):
    total_configs: int
    total_forecasts: int
    categories_covered: list[str]
    avg_mape: Optional[float]
    upcoming_holidays: list[dict]
    recent_forecasts: list[dict]
    factor_summary: dict
