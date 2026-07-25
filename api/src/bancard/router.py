"""Bancard router"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.bancard import service
from api.src.bancard.schemas import BancardCheckoutCreate, BancardPosnetCreate, BancardCheckoutResponse, BancardVerifyResponse, BancardTransactionResponse
from api.src.bancard.models import BancardTransaction

router = APIRouter(prefix="/api/v1/bancard", tags=["bancard"])


@router.post("/checkout", response_model=BancardCheckoutResponse)
async def create_payment(body: BancardCheckoutCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    if not service.is_configured():
        raise HTTPException(status_code=400, detail="Bancard no configurado")
    result = await service.create_payment(body.amount, body.description, body.order_id, body.currency, body.return_url, body.cancel_url)
    txn = BancardTransaction(
        company_id=user.get("company_id"),
        order_id=body.order_id,
        amount=body.amount,
        currency=body.currency,
        status=result.get("status", "pending"),
        token=result.get("payment_id", ""),
        process_id=result.get("process_id", ""),
        checkout_url=result.get("checkout_url", ""),
        payment_type="virtual",
    )
    db.add(txn)
    await db.flush()
    return result


@router.post("/posnet")
async def process_posnet(body: BancardPosnetCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.process_posnet_payment(body.terminal_id, body.amount, body.description, body.order_id)
    txn = BancardTransaction(
        company_id=user.get("company_id"),
        order_id=body.order_id,
        amount=body.amount,
        currency="PYG",
        status="pending_terminal",
        terminal_id=body.terminal_id,
        payment_type="posnet",
    )
    db.add(txn)
    await db.flush()
    return result


@router.get("/verify/{process_id}", response_model=BancardVerifyResponse)
async def verify_payment(process_id: str, user=Depends(require_auth)):
    if not service.is_configured():
        raise HTTPException(status_code=400, detail="Bancard no configurado")
    return await service.verify_payment_status(process_id)


@router.get("/payments", response_model=list[BancardTransactionResponse])
async def list_payments(company_id: str, limit: int = 50, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    from sqlalchemy import select as sa_select
    result = await db.execute(
        sa_select(BancardTransaction).where(BancardTransaction.company_id == company_id).order_by(BancardTransaction.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/payments/{payment_id}", response_model=BancardTransactionResponse)
async def get_payment(payment_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    from sqlalchemy import select as sa_select
    import uuid
    result = await db.execute(sa_select(BancardTransaction).where(BancardTransaction.id == uuid.UUID(payment_id)))
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    return txn


@router.get("/config")
async def get_config(user=Depends(require_auth)):
    return {"configured": service.is_configured()}


@router.post("/webhook")
async def webhook(data: dict, db: AsyncSession = Depends(get_db)):
    process_id = data.get("process_id", "")
    status = data.get("response", "")
    if process_id:
        from sqlalchemy import select, update as sa_update
        result = await db.execute(select(BancardTransaction).where(BancardTransaction.process_id == process_id))
        txn = result.scalar_one_or_none()
        if txn:
            txn.status = "approved" if status == "approved" else "declined"
            txn.webhook_data = str(data)
            if status == "approved":
                txn.authorization_code = data.get("authorization_number", "")
                txn.card_last4 = data.get("card_last4", "")
                txn.card_brand = data.get("card_brand", "")
            await db.flush()
    return {"status": "ok", "process_id": process_id}
