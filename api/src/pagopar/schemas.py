from pydantic import BaseModel, Field
from typing import Optional


class PagoparConfig(BaseModel):
    public_key: str
    private_key: str
    sandbox: bool = True
    success_url: str = ""
    failure_url: str = ""
    pending_url: str = ""


class CreatePaymentRequest(BaseModel):
    amount: int = Field(..., description="Amount in guaranies (PYG)")
    description: str
    order_id: str
    customer_email: str
    customer_name: str
    customer_phone: Optional[str] = None
    customer_ci: Optional[str] = None


class PagoparPaymentResponse(BaseModel):
    payment_id: str
    checkout_url: str
    status: str
    order_id: str
    amount: int
    created_at: str


class PagoparWebhookPayload(BaseModel):
    event: str
    data: dict


class PagoparTransaction(BaseModel):
    id: str
    order_id: str
    amount: int
    status: str
    payment_method: Optional[str] = None
    card_brand: Optional[str] = None
    card_last4: Optional[str] = None
    customer_email: str
    customer_name: str
    checkout_url: Optional[str] = None
    pagopar_id: Optional[str] = None
    created_at: str
    updated_at: str
