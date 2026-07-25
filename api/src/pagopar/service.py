import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.pagopar.schemas import CreatePaymentRequest, PagoparConfig
from api.src.pagopar.models import PagoparTransaction


PAGOPAR_API_URL = "https://api.pagopar.com/api"
PAGOPAR_CHECKOUT_URL = "https://checkout.pagopar.com"


def sign_request(private_key: str, params: dict) -> str:
    sorted_params = dict(sorted(params.items()))
    query_string = urlencode(sorted_params)
    signature = hmac.new(
        private_key.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return signature


def verify_webhook_signature(private_key: str, body: bytes, signature: str) -> bool:
    expected = hmac.new(
        private_key.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def get_config(db: AsyncSession, company_id: str) -> Optional[PagoparConfig]:
    from api.src.companies.models import Company
    result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()
    if not company or not company.config:
        return None
    cfg = company.config.get("pagopar")
    if not cfg:
        return None
    return PagoparConfig(**cfg)


async def create_checkout_session(
    db: AsyncSession,
    company_id: str,
    config: PagoparConfig,
    request: CreatePaymentRequest,
) -> dict:
    base_url = PAGOPAR_API_URL if not config.sandbox else f"{PAGOPAR_API_URL}/sandbox"
    nonce = str(int(time.time()))
    timestamp = str(int(time.time()))

    params = {
        "public_key": config.public_key,
        "amount": str(request.amount),
        "description": request.description,
        "order_id": request.order_id,
        "customer_email": request.customer_email,
        "customer_name": request.customer_name,
        "nonce": nonce,
        "timestamp": timestamp,
    }
    if request.customer_phone:
        params["customer_phone"] = request.customer_phone
    if request.customer_ci:
        params["customer_ci"] = request.customer_ci

    params["signature"] = sign_request(config.private_key, params)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{base_url}/payments/checkout", json=params)
        resp.raise_for_status()
        data = resp.json()

    checkout_url = data.get("checkout_url", f"{PAGOPAR_CHECKOUT_URL}/{data.get('id', '')}")

    transaction = PagoparTransaction(
        order_id=request.order_id,
        amount=request.amount,
        status="pending",
        customer_email=request.customer_email,
        customer_name=request.customer_name,
        checkout_url=checkout_url,
        pagopar_id=data.get("id"),
        company_id=company_id,
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    return {
        "payment_id": str(transaction.id),
        "checkout_url": checkout_url,
        "status": "pending",
        "order_id": request.order_id,
        "amount": request.amount,
        "created_at": transaction.created_at.isoformat(),
    }


async def handle_webhook(
    db: AsyncSession,
    config: PagoparConfig,
    body: bytes,
    signature: str,
) -> dict:
    if not verify_webhook_signature(config.private_key, body, signature):
        return {"error": "Invalid signature"}

    data = json.loads(body.decode("utf-8"))
    event = data.get("event", "")
    payload = data.get("data", {})

    order_id = payload.get("order_id")
    if not order_id:
        return {"error": "Missing order_id"}

    result = await db.execute(
        select(PagoparTransaction).where(PagoparTransaction.order_id == order_id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        return {"error": "Transaction not found"}

    status_map = {
        "approved": "approved",
        "rejected": "rejected",
        "pending": "pending",
        "refunded": "refunded",
        "cancelled": "cancelled",
    }
    new_status = status_map.get(payload.get("status", ""), transaction.status)

    await db.execute(
        update(PagoparTransaction)
        .where(PagoparTransaction.id == transaction.id)
        .values(
            status=new_status,
            payment_method=payload.get("payment_method"),
            card_brand=payload.get("card_brand"),
            card_last4=payload.get("card_last4"),
            pagopar_id=payload.get("id", transaction.pagopar_id),
        )
    )

    if new_status == "approved":
        await _update_sale_from_payment(db, order_id, transaction.amount)

    await db.commit()

    return {
        "status": "ok",
        "transaction_id": str(transaction.id),
        "order_id": order_id,
        "new_status": new_status,
        "event": event,
    }


async def _update_sale_from_payment(db: AsyncSession, order_id: str, amount: int):
    """Update sale status and totals when Pagopar payment is approved."""
    from api.src.sales.models import Sale
    from sqlalchemy import update as sa_update

    result = await db.execute(
        select(Sale).where(Sale.numero == order_id)
    )
    sale = result.scalar_one_or_none()
    if not sale:
        return

    new_total_pagado = float(sale.total_pagado or 0) + amount
    new_saldo = max(float(sale.total or 0) - new_total_pagado, 0)
    new_estado = "pagado" if new_saldo <= 0 else "parcial"

    await db.execute(
        sa_update(Sale)
        .where(Sale.id == sale.id)
        .values(
            estado=new_estado,
            total_pagado=new_total_pagado,
            saldo=new_saldo,
        )
    )


async def get_transactions(
    db: AsyncSession,
    company_id: str,
    order_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list:
    query = select(PagoparTransaction).where(PagoparTransaction.company_id == company_id)
    if order_id:
        query = query.where(PagoparTransaction.order_id == order_id)
    if status:
        query = query.where(PagoparTransaction.status == status)
    query = query.order_by(PagoparTransaction.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()


async def get_transaction(db: AsyncSession, transaction_id: str):
    import uuid
    try:
        tid = uuid.UUID(transaction_id)
    except ValueError:
        return None
    result = await db.execute(
        select(PagoparTransaction).where(PagoparTransaction.id == tid)
    )
    return result.scalar_one_or_none()
