"""Kuapay router"""

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.kuapay import service
from api.src.kuapay.schemas import CreateKuapayPaymentRequest, KuapayPaymentResponse, KuapayTransaction


router = APIRouter(prefix="/api/v1/kuapay", tags=["kuapay"])


@router.post("/checkout")
async def create_checkout(
    request: CreateKuapayPaymentRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    config = await service.get_config(db, user["company_id"])
    if not config:
        raise HTTPException(status_code=400, detail="Kuapay not configured for this company")
    result = await service.create_checkout_session(db, user["company_id"], config, request)
    return result


@router.get("/transactions")
async def list_transactions(
    order_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    transactions = await service.get_transactions(
        db, user["company_id"], order_id=order_id, status=status, limit=limit, offset=offset
    )
    return [
        {
            "id": str(t.id),
            "order_id": t.order_id,
            "amount": t.amount,
            "status": t.status,
            "payment_method": t.payment_method,
            "qr_code": t.qr_code,
            "customer_email": t.customer_email,
            "customer_name": t.customer_name,
            "checkout_url": t.checkout_url,
            "kuapay_id": t.kuapay_id,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        }
        for t in transactions
    ]


@router.get("/transactions/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    transaction = await service.get_transaction(db, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {
        "id": str(transaction.id),
        "order_id": transaction.order_id,
        "amount": transaction.amount,
        "status": transaction.status,
        "payment_method": transaction.payment_method,
        "qr_code": transaction.qr_code,
        "qr_image_url": transaction.qr_image_url,
        "customer_email": transaction.customer_email,
        "customer_name": transaction.customer_name,
        "checkout_url": transaction.checkout_url,
        "kuapay_id": transaction.kuapay_id,
        "created_at": transaction.created_at.isoformat(),
        "updated_at": transaction.updated_at.isoformat() if transaction.updated_at else None,
    }
