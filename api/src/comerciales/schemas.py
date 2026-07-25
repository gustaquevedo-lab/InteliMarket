from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class OpportunityOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    product_id: Optional[uuid.UUID]
    suggested_product_id: Optional[uuid.UUID]
    opportunity_type: str
    title: str
    description: Optional[str]
    priority: str
    score: int
    status: str
    suggested_discount_pct: Optional[float]
    suggested_action: Optional[str]
    assigned_to: Optional[uuid.UUID]
    resolved_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class OpportunityUpdate(BaseModel):
    status: str
    note: Optional[str] = None


class ChurnAnalysisOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    churn_score: int
    churn_risk: str
    days_since_last_purchase: Optional[int]
    previous_frequency_days: Optional[float]
    current_frequency_days: Optional[float]
    frequency_drop_pct: Optional[float]
    average_purchase_amount: Optional[float]
    evaluated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ProductAffinityOut(BaseModel):
    product_a_id: uuid.UUID
    product_b_id: uuid.UUID
    support: float
    confidence: float
    lift: float
    times_bought_together: int


class RecommendationOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    product_id: uuid.UUID
    recommendation_type: str
    score: int
    reason: Optional[str]
    is_applied: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class DetectionSummary(BaseModel):
    opportunities_found: int
    churn_detected: int
    dormant_products_found: int
    cross_sell_suggestions: int
    credit_potential_found: int
    up_sell_found: int
    high_priority: int


class OpportunitiesDashboard(BaseModel):
    summary: DetectionSummary
    by_type: list[dict]
    by_priority: list[dict]
    recent_opportunities: list[OpportunityOut]
    pending_count: int
