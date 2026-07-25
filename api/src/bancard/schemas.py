"""Bancard Pydantic schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class BancardCheckoutCreate(BaseModel):
    amount: int
    description: str
    order_id: str
    currency: str = "PYG"
    return_url: str = ""
    cancel_url: str = ""


class BancardPosnetCreate(BaseModel):
    terminal_id: str
    amount: int
    description: str
    order_id: str


class BancardTransactionResponse(BaseModel):
    id: UUID
    company_id: UUID
    order_id: str
    amount: int
    currency: str
    status: str
    token: Optional[str] = None
    process_id: Optional[str] = None
    checkout_url: Optional[str] = None
    authorization_code: Optional[str] = None
    card_last4: Optional[str] = None
    card_brand: Optional[str] = None
    terminal_id: Optional[str] = None
    payment_type: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BancardCheckoutResponse(BaseModel):
    payment_id: str
    process_id: str
    checkout_url: str
    status: str = "pending"
    amount: int
    order_id: str


class BancardVerifyResponse(BaseModel):
    status: str
    process_id: str
    authorization_code: str = ""
    card_last4: str = ""
    card_brand: str = ""
