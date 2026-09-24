from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class GenerateQrRequest(BaseModel):
    amount: int
    description: Optional[str] = None
    punto_emision: Optional[str] = None


class GenerateQrResponse(BaseModel):
    hook_alias: str
    amount: int
    description: Optional[str] = None
    qr_url: Optional[str] = None
    qr_data: Optional[str] = None
    status: str
    created_at: datetime


class QrStatusResponse(BaseModel):
    hook_alias: str
    status: str
    amount: int
    response_code: Optional[str] = None
    response_description: Optional[str] = None
    ticket_number: Optional[str] = None
    authorization_code: Optional[str] = None
    account_type: Optional[str] = None
    card_last_numbers: Optional[str] = None
    payer_name: Optional[str] = None
    payer_lastname: Optional[str] = None
    confirmed_at: Optional[datetime] = None


class RevertResponse(BaseModel):
    hook_alias: str
    status: str
    response_code: Optional[str] = None
    response_description: Optional[str] = None
