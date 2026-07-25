"""Kuapay schemas"""

from pydantic import BaseModel, Field
from typing import Optional


class KuapayConfig(BaseModel):
    public_key: str
    private_key: str
    sandbox: bool = True
    success_url: str = ""
    failure_url: str = ""
    pending_url: str = ""


class CreateKuapayPaymentRequest(BaseModel):
    amount: int = Field(..., description="Amount in guaranies (PYG)")
    description: str
    order_id: str
    customer_email: str
    customer_name: str
    customer_phone: Optional[str] = None
    customer_ci: Optional[str] = None
    payment_method: Optional[str] = "qr"


class KuapayPaymentResponse(BaseModel):
    payment_id: str
    qr_code: Optional[str] = None
    qr_image_url: Optional[str] = None
    checkout_url: Optional[str] = None
    status: str
    order_id: str
    amount: int
    created_at: str


class KuapayTransaction(BaseModel):
    id: str
    order_id: str
    amount: int
    status: str
    payment_method: Optional[str] = None
    qr_code: Optional[str] = None
    customer_email: str
    customer_name: str
    checkout_url: Optional[str] = None
    kuapay_id: Optional[str] = None
    created_at: str
    updated_at: str
