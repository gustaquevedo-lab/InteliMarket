from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class ScanSessionCreate(BaseModel):
    branch_id: Optional[uuid.UUID] = None


class ScanItemAdd(BaseModel):
    session_id: uuid.UUID
    product_id: uuid.UUID
    barcode: Optional[str] = None
    product_name: Optional[str] = None
    quantity: float = 1
    unit_price: float
    is_weight: bool = False
    weight_kg: Optional[float] = None


class ScanItemResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    product_id: uuid.UUID
    barcode: Optional[str]
    product_name: Optional[str]
    quantity: float
    unit_price: float
    subtotal: float
    is_weight: bool
    weight_kg: Optional[float]
    scanned_at: Optional[datetime]

    class Config:
        from_attributes = True


class ScanSessionResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    branch_id: Optional[uuid.UUID]
    status: str
    total_items: int
    total_amount: float
    discount_amount: float
    final_amount: float
    currency: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    items: list[ScanItemResponse] = []
    payment: Optional["ScanPaymentResponse"] = None
    audit: Optional["ScanAuditResponse"] = None

    class Config:
        from_attributes = True


class ScanPaymentRequest(BaseModel):
    session_id: uuid.UUID
    method: str
    gateway: Optional[str] = None
    gateway_transaction_id: Optional[str] = None
    loyalty_points_used: Optional[int] = 0


class ScanPaymentResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    method: str
    amount: float
    status: str
    gateway: Optional[str]
    gateway_transaction_id: Optional[str]
    loyalty_points_used: int
    loyalty_discount: float
    paid_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ScanAuditResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    is_random_audit: bool
    items_to_check: Optional[list]
    items_checked: Optional[list]
    discrepancies: Optional[list]
    has_discrepancy: bool
    status: str
    checked_by: Optional[uuid.UUID]
    checked_at: Optional[datetime]
    resolution: Optional[str]
    resolution_note: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ScanAuditCheck(BaseModel):
    audit_id: uuid.UUID
    items_checked: list[dict]
    checked_by: uuid.UUID


class ScanAuditResolve(BaseModel):
    audit_id: uuid.UUID
    resolution: str
    resolution_note: Optional[str] = None


class ScanDashboardResponse(BaseModel):
    today_sessions: int
    active_sessions: int
    completed_sessions: int
    abandoned_sessions: int
    today_amount: float
    total_audits: int
    audits_with_issues: int
    audit_rate: float
    adoption_rate: float
    avg_session_value: float
    recent_sessions: list[dict]
    hourly_breakdown: list[dict]


class ScanProductLookup(BaseModel):
    barcode: str


class SendDigitalTicketRequest(BaseModel):
    session_id: uuid.UUID
    email: Optional[str] = None
    whatsapp_phone: Optional[str] = None


class SendDigitalTicketResponse(BaseModel):
    sent: bool
    channel: Optional[str] = None
    message: str
