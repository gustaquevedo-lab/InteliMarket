from pydantic import BaseModel
from typing import Optional, Any
from datetime import date, datetime
import uuid


# ── ShrinkageRecord ──────────────────────────────────────────────

class ShrinkageRecordResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    category: str
    fecha: date
    theoretical_sales: float
    actual_sales: float
    total_shrinkage: float
    shrinkage_pct: float
    external_theft_est: float
    internal_theft_est: float
    pricing_error_est: float
    unrecorded_waste_est: float
    breakage_est: float
    high_value_shrinkage: float
    night_shift_shrinkage: float
    price_discrepancy_count: int
    anomaly_score: float
    is_anomaly: bool

    class Config:
        from_attributes = True


class ComputeShrinkageRequest(BaseModel):
    fecha: str
    categories: Optional[list[str]] = None


# ── ShrinkageAlert ───────────────────────────────────────────────

class ShrinkageAlertResponse(BaseModel):
    id: uuid.UUID
    category: str
    severity: str
    description: str
    recommendation: Optional[str]
    metric_name: Optional[str]
    metric_value: Optional[float]
    threshold: Optional[float]
    detected_pattern: Optional[str]
    is_resolved: bool
    resolved_by: Optional[uuid.UUID]
    resolved_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ResolveAlertRequest(BaseModel):
    resolved_by: str


# ── ShrinkageRecommendation ──────────────────────────────────────

class ShrinkageRecommendationResponse(BaseModel):
    id: uuid.UUID
    category: str
    recommendation_type: str
    title: str
    description: Optional[str]
    priority: str
    potential_savings: float
    is_applied: bool
    applied_at: Optional[datetime]

    class Config:
        from_attributes = True


class ApplyRecommendationRequest(BaseModel):
    applied_by: Optional[str] = None


# ── Dashboard ────────────────────────────────────────────────────

class CategoryShrinkageSummary(BaseModel):
    category: str
    total_shrinkage: float
    shrinkage_pct: float
    theoretical_sales: float
    actual_sales: float
    primary_cause: str
    anomaly_count: int
    trend_direction: str


class ShrinkageDecomposition(BaseModel):
    external_theft: float
    internal_theft: float
    pricing_error: float
    unrecorded_waste: float
    breakage: float


class ShrinkageDashboardResponse(BaseModel):
    date: str
    total_theoretical_sales: float
    total_actual_sales: float
    total_shrinkage: float
    overall_shrinkage_pct: float
    benchmark_pct: float
    variance_vs_benchmark: float
    decomposition: ShrinkageDecomposition
    by_category: list[CategoryShrinkageSummary]
    active_alerts: list[ShrinkageAlertResponse]
    pending_recommendations: list[ShrinkageRecommendationResponse]
    trends_7d: list[dict]
    anomaly_categories: list[str]
