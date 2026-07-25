"""SPI — Sistema de Pagos Interoperables (QR BCP Hub, Paraguay)"""

import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from io import BytesIO
from typing import Optional

import httpx
import qrcode
from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.spi.schemas import CreateSpiPaymentRequest, SpiConfig
from api.src.spi.models import SpiTransaction


def generate_emvco_qr(
    merchant_id: str,
    merchant_name: str,
    terminal_id: str,
    amount: int,
    order_id: str,
    currency: str = "PYG",
) -> str:
    """Generate EMVCo Merchant Presented QR string per BCP QR Hub standard."""
    currency_map = {"PYG": "600", "USD": "840", "BRL": "986", "ARS": "032"}
    currency_numeric = currency_map.get(currency, "600")
    amount_str = str(amount)

    # EMVCo QR payload format
    qr = "000201"  # Payload format indicator
    qr += "010212"  # Point of initiation method (12 = dynamic)
    # Merchant account info (ID 26 for "merchant_account_information")
    merchant_info = f"00{len(merchant_id):02d}{merchant_id}"
    merchant_info += f"01{len(terminal_id):02d}{terminal_id}"
    qr += f"26{len(merchant_info):02d}{merchant_info}"
    # Merchant category code
    qr += f"5204{merchant_category_code(merchant_id, terminal_id)}"
    # Transaction currency
    qr += f"53{len(currency_numeric):02d}{currency_numeric}"
    # Transaction amount
    qr += f"54{len(amount_str):02d}{amount_str}"
    # Country code
    qr += "58PY"
    # Merchant name
    name = merchant_name[:25]
    qr += f"59{len(name):02d}{name}"
    # Merchant city
    city = "Asuncion"
    qr += f"60{len(city):02d}{city}"
    # Additional data (ID 62)
    ref_data = f"01{len(order_id):02d}{order_id}"
    qr += f"62{len(ref_data):02d}{ref_data}"
    # CRC (ID 63) — placeholder, actual CRC16 would need to be computed
    qr += "6304"

    return qr


def merchant_category_code(merchant_id: str, terminal_id: str) -> str:
    """Return a static MCC for general retail."""
    return "5399"


def generate_qr_image(qr_data: str) -> tuple[str, str]:
    """Generate QR code image and return base64 string + data URL."""
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_bytes = buffer.getvalue()
    img_b64 = base64.b64encode(img_bytes).decode()
    data_url = f"data:image/png;base64,{img_b64}"
    return img_b64, data_url


def sign_payload(api_key: str, payload: dict) -> str:
    sorted_keys = sorted(payload.keys())
    raw = "".join(str(payload[k]) for k in sorted_keys)
    return hmac.new(api_key.encode(), raw.encode(), hashlib.sha256).hexdigest()


def verify_webhook_signature(api_key: str, body: bytes, signature: str) -> bool:
    expected = hmac.new(api_key.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def get_config(db: AsyncSession, company_id: str) -> Optional[SpiConfig]:
    from api.src.companies.models import Company
    result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()
    if not company or not company.config:
        return None
    cfg = company.config.get("spi")
    if not cfg:
        return None
    return SpiConfig(**cfg)


async def create_qr_payment(
    db: AsyncSession,
    company_id: str,
    config: SpiConfig,
    request: CreateSpiPaymentRequest,
) -> dict:
    now = datetime.now(timezone.utc)
    amount = request.amount

    qr_data = generate_emvco_qr(
        merchant_id=config.merchant_id,
        merchant_name=config.merchant_name,
        terminal_id=config.terminal_id,
        amount=amount,
        order_id=request.order_id,
    )
    img_b64, img_url = generate_qr_image(qr_data)

    transaction = SpiTransaction(
        company_id=company_id,
        order_id=request.order_id,
        amount=amount,
        currency="PYG",
        status="pending",
        qr_data=qr_data,
        qr_image_base64=img_b64,
        merchant_name=config.merchant_name,
        description=request.description,
        customer_email=request.customer_email,
        customer_name=request.customer_name,
        created_at=now,
        updated_at=now,
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    return {
        "payment_id": str(transaction.id),
        "order_id": request.order_id,
        "amount": amount,
        "status": "pending",
        "qr_data": qr_data,
        "qr_image_base64": img_b64,
        "qr_image_url": img_url,
        "merchant_name": config.merchant_name,
        "created_at": transaction.created_at.isoformat(),
    }


async def handle_webhook(
    db: AsyncSession,
    config: SpiConfig,
    body: bytes,
    signature: str,
) -> dict:
    if not verify_webhook_signature(config.api_key, body, signature):
        return {"error": "Invalid signature"}

    data = json.loads(body.decode("utf-8"))
    event = data.get("event", "")
    payload = data.get("data", {})

    bcp_id = payload.get("transaction_id") or payload.get("id")
    order_id = payload.get("order_id") or payload.get("reference")
    status = payload.get("status", "")

    if not order_id:
        return {"error": "Missing order_id in payload"}

    result = await db.execute(
        select(SpiTransaction).where(SpiTransaction.order_id == order_id)
    )
    transaction = result.scalar_one_or_none()
    if not transaction:
        return {"error": "Transaction not found"}

    status_map = {
        "approved": "approved",
        "completed": "approved",
        "confirmed": "approved",
        "rejected": "rejected",
        "failed": "rejected",
        "cancelled": "cancelled",
        "refunded": "refunded",
        "pending": "pending",
    }
    new_status = status_map.get(status, transaction.status)

    await db.execute(
        sa_update(SpiTransaction)
        .where(SpiTransaction.id == transaction.id)
        .values(
            status=new_status,
            bcp_transaction_id=bcp_id or transaction.bcp_transaction_id,
            webhook_data=json.dumps(data),
            error_message=payload.get("error") or payload.get("message"),
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
    from api.src.sales.models import Sale

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


async def verify_payment_with_bcp(
    config: SpiConfig,
    order_id: str,
    bcp_transaction_id: Optional[str] = None,
) -> dict:
    if not config.api_key:
        return {"status": "pending", "message": "SPI API not configured for verification"}

    base = "https://api-sandbox.bcp.gov.py/spi/v1" if config.sandbox else "https://api.bcp.gov.py/spi/v1"
    headers = {"Authorization": f"Bearer {config.api_key}", "Content-Type": "application/json"}

    endpoint = f"{base}/payments/status/{order_id}"
    if bcp_transaction_id:
        endpoint = f"{base}/payments/{bcp_transaction_id}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(endpoint, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def get_transactions(
    db: AsyncSession,
    company_id: str,
    order_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list:
    query = select(SpiTransaction).where(SpiTransaction.company_id == company_id)
    if order_id:
        query = query.where(SpiTransaction.order_id == order_id)
    if status:
        query = query.where(SpiTransaction.status == status)
    query = query.order_by(SpiTransaction.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()


async def get_transaction(db: AsyncSession, transaction_id: str):
    import uuid as uuid_lib
    try:
        tid = uuid_lib.UUID(transaction_id)
    except ValueError:
        return None
    result = await db.execute(
        select(SpiTransaction).where(SpiTransaction.id == tid)
    )
    return result.scalar_one_or_none()
