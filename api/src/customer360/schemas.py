from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class BasketAnalysisResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    avg_ticket: float
    avg_items_per_ticket: float
    total_spent_30d: float
    total_spent_90d: float
    total_transactions_30d: int
    total_transactions_90d: int
    pct_on_promotion: float
    margin_avg_pct: float
    preferred_department: Optional[str]
    preferred_day: Optional[str]
    preferred_hour: Optional[int]
    avg_days_between_visits: float
    data_json: Optional[list]
    computed_at: Optional[datetime]

    class Config:
        from_attributes = True


class CategoryPenetrationResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    category_id: uuid.UUID
    category_name: Optional[str]
    total_spent: float
    total_transactions: int
    penetration_pct: float
    share_of_wallet_pct: float
    last_purchase_at: Optional[datetime]
    cross_sell_score: float

    class Config:
        from_attributes = True


class ChurnPredictionResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    churn_score: float
    churn_risk: str
    days_since_last_purchase: int
    avg_frequency_days: float
    avg_ticket_change_pct: float
    frequency_change_pct: float
    category_attrition_score: float
    factors_json: Optional[dict]
    is_recovery_triggered: bool
    computed_at: Optional[datetime]

    class Config:
        from_attributes = True


class LifecycleStageResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    stage: str
    days_in_stage: int
    total_tenure_days: int
    total_lifetime_value: float
    predicted_ltv: float
    ltv_trend: str
    segment_tags: Optional[list]
    computed_at: Optional[datetime]

    class Config:
        from_attributes = True


class RecoveryCampaignResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    trigger_score: float
    offer_type: Optional[str]
    offer_value: float
    offer_config: Optional[dict]
    channel: str
    status: str
    notified_at: Optional[datetime]
    redeemed_at: Optional[datetime]
    recovery_amount: Optional[float]
    effectiveness_score: Optional[float]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class Customer360DashboardResponse(BaseModel):
    total_customers: int
    active_customers_30d: int
    new_customers_30d: int
    lost_customers_30d: int
    churn_rate_pct: float
    avg_ltv: float
    avg_basket: float
    avg_penetration_pct: float
    high_risk_churn: int
    active_recovery_campaigns: int
    total_recovered_amount: float
    by_stage: dict
    penetration_summary: dict
    churn_trend: list[dict]
