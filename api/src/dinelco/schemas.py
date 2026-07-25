"""Dinelco Pydantic schemas"""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


class DinelcoCheckoutCreate(BaseModel):
    amount: int
    description: str
    order_id: str
    customer_email: str = ""
    customer_name: str = ""
    installments: int = 1


class DinelcoTransactionResponse(BaseModel):
    id: UUID
    company_id: UUID
    order_id: str
    amount: int
    currency: str
    status: str
    payment_id: Optional[str] = None
    checkout_url: Optional[str] = None
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None
    installments: int
    authorization_code: Optional[str] = None
    card_last4: Optional[str] = None
    card_brand: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DinelcoCheckoutResponse(BaseModel):
    payment_id: str
    checkout_url: str
    status: str = "pending"
    amount: int
    order_id: str
    installments: int


class DinelcoVerifyResponse(BaseModel):
    payment_id: str
    status: str
    card_brand: str = ""
    card_last4: str = ""
    installments: int = 1
    authorization_code: str = ""
