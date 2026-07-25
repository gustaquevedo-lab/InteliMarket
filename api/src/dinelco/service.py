"""Dinelco payment gateway — card processing for Paraguay

Dinelco provides POS terminal integration and virtual payment API.
Reference: https://www.dinelco.com.py/
"""

import hashlib
import json
import os
import time
from typing import Optional

import httpx

DINELCO_MERCHANT_ID = os.getenv("DINELCO_MERCHANT_ID", "")
DINELCO_API_KEY = os.getenv("DINELCO_API_KEY", "")
DINELCO_SECRET = os.getenv("DINELCO_SECRET", "")
DINELCO_BASE_URL = os.getenv("DINELCO_API_URL", "https://api.dinelco.com.py/v1")
DINELCO_SANDBOX = os.getenv("DINELCO_SANDBOX", "true").lower() == "true"


def _sign_request(payload: dict) -> str:
    data = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(f"{data}{DINELCO_SECRET}".encode()).hexdigest()


async def create_payment(
    amount: int,
    description: str,
    order_id: str,
    customer_email: str = "",
    customer_name: str = "",
    installments: int = 1,
) -> dict:
    """Create a Dinelco payment session."""
    if not DINELCO_MERCHANT_ID or not DINELCO_API_KEY:
        return {"error": "Dinelco not configured"}

    payload = {
        "merchant_id": DINELCO_MERCHANT_ID,
        "order_id": order_id,
        "amount": amount,
        "currency": "PYG",
        "description": description[:150],
        "customer_email": customer_email,
        "customer_name": customer_name,
        "installments": min(installments, 12),
        "return_url": os.getenv("APP_URL", "http://localhost:5173") + "/pos",
        "callback_url": os.getenv("APP_URL", "http://localhost:8000") + "/api/v1/dinelco/webhook",
        "timestamp": int(time.time()),
    }
    payload["signature"] = _sign_request(payload)

    headers = {
        "Authorization": f"Bearer {DINELCO_API_KEY}",
        "Content-Type": "application/json",
    }

    base_url = "https://sandbox.dinelco.com.py/v1" if DINELCO_SANDBOX else DINELCO_BASE_URL
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{base_url}/payments", json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    return {
        "payment_id": data.get("payment_id", order_id),
        "checkout_url": data.get("checkout_url", ""),
        "status": data.get("status", "pending"),
        "amount": amount,
        "order_id": order_id,
        "installments": installments,
    }


async def verify_payment(payment_id: str) -> dict:
    """Check payment status from Dinelco."""
    headers = {"Authorization": f"Bearer {DINELCO_API_KEY}"}
    base_url = "https://sandbox.dinelco.com.py/v1" if DINELCO_SANDBOX else DINELCO_BASE_URL

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{base_url}/payments/{payment_id}", headers=headers)
        resp.raise_for_status()
        data = resp.json()

    return {
        "payment_id": payment_id,
        "status": data.get("status", "pending"),
        "card_brand": data.get("card_brand", ""),
        "card_last4": data.get("card_last4", ""),
        "installments": data.get("installments", 1),
        "authorization_code": data.get("auth_code", ""),
    }


def is_configured() -> bool:
    return bool(DINELCO_MERCHANT_ID and DINELCO_API_KEY and DINELCO_SECRET)
