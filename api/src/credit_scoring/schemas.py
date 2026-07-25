from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class CreditScoreOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    score: int
    risk_level: str
    payment_history_score: int
    antiquity_score: int
    frequency_score: int
    avg_amount_score: int
    industry_score: int
    credit_utilization_score: int
    suggested_credit_limit: float
    current_credit_limit: float
    used_credit: float
    available_credit: float
    on_time_payment_rate: float
    average_payment_delay_days: float
    total_overdue_days: int
    days_since_last_purchase: Optional[int]
    total_purchases: int
    total_purchase_amount: float
    months_as_customer: int
    times_overdue: int
    status: str
    is_auto_blocked: bool
    block_reason: Optional[str]
    last_evaluation_date: Optional[datetime]
    next_evaluation_date: Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CreditScoreSummary(BaseModel):
    total_customers: int
    average_score: float
    risk_distribution: dict
    total_exposure: float
    total_suggested_limit: float
    blocked_customers: int
    warning_customers: int
    critical_customers: int


class EvaluateCustomerRequest(BaseModel):
    customer_id: uuid.UUID


class EvaluateCustomerResponse(BaseModel):
    credit_score: CreditScoreOut
    alerts_generated: list[dict]
    limit_changed: bool


class BulkEvaluateResponse(BaseModel):
    evaluated: int
    alerts_generated: int
    blocked_customers: int


class RiskAlertOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    alert_type: str
    severity: str
    previous_score: Optional[int]
    new_score: Optional[int]
    message: str
    is_read: bool
    resolved_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class CreditEventOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    event_type: str
    previous_limit: Optional[float]
    new_limit: Optional[float]
    previous_score: Optional[int]
    new_score: Optional[int]
    reason: Optional[str]
    performed_by: Optional[uuid.UUID]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class UpdateLimitRequest(BaseModel):
    customer_id: uuid.UUID
    new_limit: float
    reason: str


class BlockCustomerRequest(BaseModel):
    customer_id: uuid.UUID
    reason: str


class UnblockCustomerRequest(BaseModel):
    customer_id: uuid.UUID
    reason: str


class PortfolioDashboard(BaseModel):
    summary: CreditScoreSummary
    risk_by_customer: list[dict]
    concentration: list[dict]
    recent_alerts: list[RiskAlertOut]
    monthly_trend: list[dict]
