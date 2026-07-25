"""SPI QR schemas"""

from pydantic import BaseModel, Field
from typing import Optional


class SpiConfig(BaseModel):
    merchant_id: str
    merchant_name: str
    terminal_id: str
    api_key: str = ""
    sandbox: bool = True


class CreateSpiPaymentRequest(BaseModel):
    amount: int = Field(..., description="Amount in guaranies (PYG)")
    order_id: str
    description: str = ""
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None


class SpiPaymentResponse(BaseModel):
    payment_id: str
    order_id: str
    amount: int
    status: str
    qr_data: Optional[str] = None
    qr_image_base64: Optional[str] = None
    qr_image_url: Optional[str] = None
    merchant_name: Optional[str] = None
    created_at: str


class SpiTransactionOut(BaseModel):
    id: str
    order_id: str
    amount: int
    currency: str
    status: str
    merchant_name: Optional[str] = None
    description: Optional[str] = None
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None
    bcp_transaction_id: Optional[str] = None
    qr_data: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
