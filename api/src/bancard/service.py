"""Bancard payment gateway — card processing for Paraguay"""

import hashlib
import hmac
import json
import time
import os
from typing import Optional

import httpx

BANCARD_API_URL = os.getenv("BANCARD_API_URL", "https://vpos.infonet.com.py:8888")
BANCARD_PUBLIC_KEY = os.getenv("BANCARD_PUBLIC_KEY", "")
BANCARD_PRIVATE_KEY = os.getenv("BANCARD_PRIVATE_KEY", "")
BANCARD_SANDBOX = os.getenv("BANCARD_SANDBOX", "true").lower() == "true"


def sign_bancard(data: dict, private_key: str) -> str:
    msg = "&".join(f"{k}={v}" for k, v in sorted(data.items()))
    return hmac.new(private_key.encode(), msg.encode(), hashlib.sha256).hexdigest()


async def create_payment(
    amount: int,
    description: str,
    order_id: str,
    currency: str = "PYG",
    return_url: str = "",
    cancel_url: str = "",
) -> dict:
    """Create a Bancard payment session (single payment via card)."""
    if not BANCARD_PUBLIC_KEY or not BANCARD_PRIVATE_KEY:
        return {"error": "Bancard not configured"}

    token = f"{order_id}-{int(time.time())}"
    params = {
        "public_key": BANCARD_PUBLIC_KEY,
        "operation": {
            "token": token,
            "amount": str(amount),
            "currency": currency,
            "description": description[:100],
            "shop_process_id": int(time.time() * 1000) % 99999999,
            "return_url": return_url or os.getenv("APP_URL", "http://localhost:5173"),
            "cancel_url": cancel_url or os.getenv("APP_URL", "http://localhost:5173"),
        },
    }
    params["signature"] = sign_bancard(params, BANCARD_PRIVATE_KEY)

    base = BANCARD_API_URL if not BANCARD_SANDBOX else "https://vpos.infonet.com.py:8888"
    async with httpx.AsyncClient(timeout=30, verify=False) as client:
        resp = await client.post(f"{base}/vpos/api/0.3/single_buy", json=params)
        resp.raise_for_status()
        result = resp.json()
    
    return {
        "payment_id": token,
        "process_id": result.get("process_id", ""),
        "checkout_url": result.get("url", ""),
        "status": "pending",
        "amount": amount,
        "order_id": order_id,
    }


async def process_posnet_payment(
    terminal_id: str,
    amount: int,
    description: str,
    order_id: str,
) -> dict:
    """Process payment via physical Bancard POSNET terminal."""
    # POSNET terminals communicate via serial/IP.
    # This serves as the middleware to log and track the transaction.
    # The actual terminal communication is handled by the Bancard middleware service.
    return {
        "status": "pending_terminal",
        "terminal_id": terminal_id,
        "amount": amount,
        "description": description,
        "order_id": order_id,
        "message": "Aguardando respuesta del terminal POSNET",
    }


async def verify_payment_status(process_id: str) -> dict:
    """Check payment status from Bancard."""
    params = {
        "public_key": BANCARD_PUBLIC_KEY,
        "process_id": process_id,
    }
    params["signature"] = sign_bancard(params, BANCARD_PRIVATE_KEY)

    base = BANCARD_API_URL if not BANCARD_SANDBOX else "https://vpos.infonet.com.py:8888"
    async with httpx.AsyncClient(timeout=30, verify=False) as client:
        resp = await client.post(f"{base}/vpos/api/0.3/confirm", json=params)
        resp.raise_for_status()
        result = resp.json()
    
    return {
        "status": result.get("response", "pending"),
        "process_id": process_id,
        "authorization_code": result.get("authorization_number", ""),
        "card_last4": result.get("card_last4", ""),
        "card_brand": result.get("card_brand", ""),
    }


def is_configured() -> bool:
    return bool(BANCARD_PUBLIC_KEY and BANCARD_PRIVATE_KEY)
