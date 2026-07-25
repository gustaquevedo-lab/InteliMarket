from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
import uuid


# ── ProductivityRecord ──────────────────────────────────────────

class ProductivityRecordCreate(BaseModel):
    employee_id: str
    employee_name: Optional[str] = None
    area: str
    fecha: str
    transactions_processed: float = 0
    kg_processed: float = 0
    units_processed: float = 0
    boxes_processed: float = 0
    sales_amount: float = 0
    hours_worked: float = 0
    planned_hours: float = 0
    branch_id: Optional[str] = None


class ProductivityRecordResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: Optional[str]
    area: str
    fecha: date
    transactions_processed: float
    kg_processed: float
    units_processed: float
    boxes_processed: float
    sales_amount: float
    hours_worked: float
    planned_hours: float
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── ProductivityTarget ──────────────────────────────────────────

class ProductivityTargetCreate(BaseModel):
    area: str
    metric_name: str
    target_value: float
    budget_cost_per_unit: float = 0
    effective_from: str
    effective_to: Optional[str] = None
    branch_id: Optional[str] = None


class ProductivityTargetResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    area: str
    metric_name: str
    target_value: float
    budget_cost_per_unit: float
    effective_from: date
    effective_to: Optional[date]

    class Config:
        from_attributes = True


# ── EmployeeEfficiency ──────────────────────────────────────────

class EmployeeEfficiencyResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: Optional[str]
    area: str
    fecha_desde: date
    fecha_hasta: date
    total_hours: float
    planned_hours: float
    efficiency_pct: float
    metric_name: Optional[str]
    metric_value: float
    metric_per_hour: float
    cost_per_unit: float
    ranking_in_area: int
    trend: str

    class Config:
        from_attributes = True


# ── Compute / Dashboard ─────────────────────────────────────────

class ComputeEfficiencyRequest(BaseModel):
    employee_id: str
    fecha_desde: str
    fecha_hasta: str


class ComputeAllEfficiencyRequest(BaseModel):
    fecha_desde: str
    fecha_hasta: str


class AreaMetricsResponse(BaseModel):
    area: str
    employees_count: int
    total_hours: float
    planned_hours: float
    avg_efficiency_pct: float
    avg_metric_per_hour: float
    avg_cost_per_unit: float
    top_performer: Optional[str]
    bottom_performer: Optional[str]


class ProductivityDashboardResponse(BaseModel):
    area_metrics: list[AreaMetricsResponse]
    ranking: list[EmployeeEfficiencyResponse]
    weekly_trends: list[dict]
    total_employees_evaluated: int
    overall_avg_efficiency: float
    overall_avg_cost_per_unit: float
