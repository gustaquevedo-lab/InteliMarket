from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class RfmScoreOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    recency_days: Optional[int]
    recency_score: int
    frequency_count: int
    frequency_score: int
    monetary_total: float
    monetary_score: int
    rfm_total: int
    rfm_segment: Optional[str]
    last_evaluation_date: Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BehavioralSegmentCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    slug: str
    color: Optional[str] = "#6366f1"
    rfm_min: Optional[int] = None
    rfm_max: Optional[int] = None
    rules: Optional[dict] = None


class BehavioralSegmentUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    color: Optional[str] = None
    rfm_min: Optional[int] = None
    rfm_max: Optional[int] = None
    rules: Optional[dict] = None
    activo: Optional[bool] = None


class BehavioralSegmentOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    nombre: str
    descripcion: Optional[str]
    slug: str
    color: str
    rfm_min: Optional[int]
    rfm_max: Optional[int]
    rules: Optional[dict]
    customer_count: int
    is_system: bool
    activo: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CustomerSegmentAssignmentOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    segment_id: uuid.UUID
    assigned_by: str
    assigned_at: Optional[datetime]

    class Config:
        from_attributes = True


class LoyaltyProgramOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    nombre: str
    points_per_currency: int
    signup_bonus: int
    referral_bonus: int
    min_redeem_points: int
    currency_name: str
    tier_enabled: bool
    tier_bronze_min: int
    tier_silver_min: int
    tier_gold_min: int
    tier_platinum_min: int
    activo: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class LoyaltyProgramUpdate(BaseModel):
    nombre: Optional[str] = None
    points_per_currency: Optional[int] = None
    signup_bonus: Optional[int] = None
    referral_bonus: Optional[int] = None
    min_redeem_points: Optional[int] = None
    currency_name: Optional[str] = None
    tier_enabled: Optional[bool] = None
    tier_bronze_min: Optional[int] = None
    tier_silver_min: Optional[int] = None
    tier_gold_min: Optional[int] = None
    tier_platinum_min: Optional[int] = None
    activo: Optional[bool] = None


class LoyaltyTransactionCreate(BaseModel):
    customer_id: uuid.UUID
    tipo: str
    puntos: int
    concepto: Optional[str] = None
    order_id: Optional[uuid.UUID] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None


class LoyaltyTransactionOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    tipo: str
    puntos: int
    concepto: Optional[str]
    order_id: Optional[uuid.UUID]
    reference_type: Optional[str]
    reference_id: Optional[str]
    created_by: Optional[uuid.UUID]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class LoyaltySummary(BaseModel):
    total_points: int
    lifetime_earned: int
    lifetime_redeemed: int
    current_tier: str
    next_tier: Optional[str]
    points_to_next_tier: int


class PersonalizedOfferCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    offer_type: str
    discount_type: str
    discount_value: float
    min_purchase: Optional[float] = 0
    target_type: str
    target_segment_id: Optional[uuid.UUID] = None
    target_customer_id: Optional[uuid.UUID] = None
    starts_at: datetime
    ends_at: datetime
    max_redemptions: Optional[int] = 0


class PersonalizedOfferUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    discount_value: Optional[float] = None
    min_purchase: Optional[float] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    max_redemptions: Optional[int] = None
    activo: Optional[bool] = None


class PersonalizedOfferOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    nombre: str
    descripcion: Optional[str]
    offer_type: str
    discount_type: str
    discount_value: float
    min_purchase: float
    target_type: str
    target_segment_id: Optional[uuid.UUID]
    target_customer_id: Optional[uuid.UUID]
    starts_at: Optional[datetime]
    ends_at: Optional[datetime]
    max_redemptions: int
    current_redemptions: int
    activo: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CouponCodeGenerate(BaseModel):
    offer_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None
    discount_type: str
    discount_value: float
    min_purchase: Optional[float] = 0
    is_percentage: Optional[bool] = True
    max_uses: Optional[int] = 1
    expires_at: Optional[datetime] = None
    count: Optional[int] = 1


class CouponCodeOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    offer_id: Optional[uuid.UUID]
    customer_id: Optional[uuid.UUID]
    code: str
    discount_type: str
    discount_value: float
    min_purchase: float
    is_percentage: bool
    max_uses: int
    current_uses: int
    is_active: bool
    starts_at: Optional[datetime]
    expires_at: Optional[datetime]
    used_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class CouponValidateRequest(BaseModel):
    code: str
    customer_id: Optional[uuid.UUID] = None
    purchase_amount: Optional[float] = 0


class CouponValidateResponse(BaseModel):
    valid: bool
    message: str
    discount_amount: Optional[float] = None
    final_amount: Optional[float] = None


class ClientesDashboard(BaseModel):
    total_customers_with_rfm: int
    rfm_distribution: dict
    segment_breakdown: list[dict]
    loyalty_summary: dict
    active_offers: int
    active_coupons: int
    redeemed_coupons: int
