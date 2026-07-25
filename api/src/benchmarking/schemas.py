from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, date
import uuid


class BenchmarkConfigCreate(BaseModel):
    kpi_key: str
    kpi_label: str
    weight: float = 1.0
    target_value: Optional[float] = None
    target_direction: str = "higher"
    green_threshold: Optional[float] = None
    red_threshold: Optional[float] = None
    unit: str = ""
    is_active: bool = True


class BenchmarkConfigUpdate(BaseModel):
    kpi_label: Optional[str] = None
    weight: Optional[float] = None
    target_value: Optional[float] = None
    target_direction: Optional[str] = None
    green_threshold: Optional[float] = None
    red_threshold: Optional[float] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None


class BenchmarkConfigResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    kpi_key: str
    kpi_label: str
    weight: float
    target_value: Optional[float]
    target_direction: str
    green_threshold: Optional[float]
    red_threshold: Optional[float]
    unit: str
    is_active: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BenchmarkRegionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    branch_ids: Optional[list[str]] = None
    is_active: bool = True


class BenchmarkRegionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    branch_ids: Optional[list[str]] = None
    is_active: Optional[bool] = None


class BenchmarkRegionResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    description: Optional[str]
    branch_ids: Optional[Any]
    is_active: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BenchmarkRecordCreate(BaseModel):
    branch_id: str
    period_start: date
    period_end: date
    period_type: str = "weekly"
    sales_per_sqm: float = 0
    gross_margin_pct: float = 0
    shrinkage_pct: float = 0
    inventory_turnover: float = 0
    avg_ticket: float = 0
    transactions_per_day: float = 0
    labor_productivity: float = 0
    total_sales: float = 0
    total_area_sqm: float = 0
    total_transactions: int = 0
    labor_hours: float = 0


class BenchmarkRecordUpdate(BaseModel):
    sales_per_sqm: Optional[float] = None
    gross_margin_pct: Optional[float] = None
    shrinkage_pct: Optional[float] = None
    inventory_turnover: Optional[float] = None
    avg_ticket: Optional[float] = None
    transactions_per_day: Optional[float] = None
    labor_productivity: Optional[float] = None
    total_sales: Optional[float] = None
    total_area_sqm: Optional[float] = None
    total_transactions: Optional[int] = None
    labor_hours: Optional[float] = None


class BenchmarkRecordResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    branch_id: uuid.UUID
    period_start: date
    period_end: date
    period_type: str
    sales_per_sqm: float
    gross_margin_pct: float
    shrinkage_pct: float
    inventory_turnover: float
    avg_ticket: float
    transactions_per_day: float
    labor_productivity: float
    total_sales: float
    total_area_sqm: float
    total_transactions: int
    labor_hours: float
    branch_name: Optional[str] = None
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BenchmarkScoreResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    branch_id: uuid.UUID
    branch_name: Optional[str] = None
    period_start: date
    period_end: date
    period_type: str
    overall_score: float
    traffic_light: str
    kpi_scores: Optional[Any]
    kpi_details: Optional[Any]
    rank: Optional[int]
    total_stores: Optional[int]
    percentile: Optional[float]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class RankingItem(BaseModel):
    branch_id: uuid.UUID
    branch_name: str
    kpi_key: str
    kpi_label: str
    value: float
    rank: int
    total: int
    percentile: float
    trend: Optional[str] = None


class DashboardData(BaseModel):
    total_stores: int
    periods_analyzed: int
    avg_overall_score: float
    green_stores: int
    yellow_stores: int
    red_stores: int
    top_store: Optional[dict] = None
    bottom_store: Optional[dict] = None
    best_kpi: Optional[dict] = None
    worst_kpi: Optional[dict] = None
    rankings: list[RankingItem] = []
    trend_data: Optional[Any] = None


class RegionalComparisonItem(BaseModel):
    region_id: uuid.UUID
    region_name: str
    store_count: int
    avg_score: float
    avg_sales_per_sqm: float
    avg_margin: float
    avg_shrinkage: float
    avg_ticket: float
    best_store: Optional[str] = None
    worst_store: Optional[str] = None


class TrendPoint(BaseModel):
    period_start: date
    value: float
