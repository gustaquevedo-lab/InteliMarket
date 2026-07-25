from pydantic import BaseModel
from typing import Optional, Any
from datetime import date, datetime
import uuid


# ── DailyDepartmentPnl ───────────────────────────────────────────

class DailyPnlCreate(BaseModel):
    department: str
    fecha: str
    sales_amount: float = 0
    transaction_count: int = 0
    theoretical_cost: float = 0
    actual_cost: float = 0
    shrinkage_cost: float = 0
    labor_cost: float = 0
    equipment_depreciation: float = 0
    other_costs: float = 0
    branch_id: Optional[str] = None


class DailyPnlResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    department: str
    fecha: date
    sales_amount: float
    transaction_count: int
    theoretical_cost: float
    actual_cost: float
    cost_of_sales: float
    gross_margin_real: float
    gross_margin_real_pct: float
    gross_margin_theoretical: float
    gross_margin_theoretical_pct: float
    margin_variance: float
    margin_variance_pct: float
    shrinkage_cost: float
    labor_cost: float
    equipment_depreciation: float
    other_costs: float
    total_assignable_costs: float
    net_margin: float
    net_margin_pct: float
    products_negative_margin: Optional[Any]
    top_products: Optional[Any]
    status: str

    class Config:
        from_attributes = True


# ── PnlAdjustment ────────────────────────────────────────────────

class PnlAdjustmentCreate(BaseModel):
    pnl_id: str
    description: str
    adjustment_type: str
    amount: float
    reason: Optional[str] = None


class PnlAdjustmentResponse(BaseModel):
    id: uuid.UUID
    pnl_id: uuid.UUID
    description: str
    adjustment_type: str
    amount: float
    reason: Optional[str]
    created_by: Optional[uuid.UUID]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── PnlBudget ────────────────────────────────────────────────────

class PnlBudgetCreate(BaseModel):
    department: str
    period_start: str
    period_end: Optional[str] = None
    budgeted_sales: float = 0
    budgeted_cost: float = 0
    budgeted_margin_pct: float = 0
    budgeted_shrinkage: float = 0
    budgeted_labor: float = 0
    branch_id: Optional[str] = None


class PnlBudgetResponse(BaseModel):
    id: uuid.UUID
    department: str
    period_start: date
    period_end: Optional[date]
    budgeted_sales: float
    budgeted_cost: float
    budgeted_margin_pct: float
    budgeted_shrinkage: float
    budgeted_labor: float

    class Config:
        from_attributes = True


# ── Compute / Dashboard ──────────────────────────────────────────

class ComputeDailyPnlRequest(BaseModel):
    fecha: str
    departments: Optional[list[str]] = None


class DepartmentComparison(BaseModel):
    department: str
    today_sales: float
    today_margin_pct: float
    yesterday_sales: float
    yesterday_margin_pct: float
    budgeted_margin_pct: float
    variance_vs_yesterday: float
    variance_vs_budget: float


class NegativeMarginProduct(BaseModel):
    name: str
    margin: float
    margin_pct: float
    sales: float


class DailyPnlDashboard(BaseModel):
    date: str
    total_sales: float
    total_cost: float
    total_margin: float
    total_margin_pct: float
    total_shrinkage: float
    total_labor: float
    department_comparisons: list[DepartmentComparison]
    negative_margin_products: list[NegativeMarginProduct]
    trends_7d: list[dict]
