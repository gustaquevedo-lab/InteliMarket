"""Dinelco router"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.dinelco import service
from api.src.dinelco.schemas import DinelcoCheckoutCreate, DinelcoCheckoutResponse, DinelcoVerifyResponse, DinelcoTransactionResponse
from api.src.dinelco.models import DinelcoTransaction

router = APIRouter(prefix="/api/v1/dinelco", tags=["dinelco"])


@router.post("/checkout", response_model=DinelcoCheckoutResponse)
async def create_payment(body: DinelcoCheckoutCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    if not service.is_configured():
        raise HTTPException(status_code=400, detail="Dinelco no configurado")
    result = await service.create_payment(body.amount, body.description, body.order_id, body.customer_email, body.customer_name, body.installments)
    txn = DinelcoTransaction(
        company_id=user.get("company_id"),
        order_id=body.order_id,
        amount=body.amount,
        currency="PYG",
        status=result.get("status", "pending"),
        payment_id=result.get("payment_id", ""),
        checkout_url=result.get("checkout_url", ""),
        customer_email=body.customer_email,
        customer_name=body.customer_name,
        installments=body.installments,
    )
    db.add(txn)
    await db.flush()
    return result


@router.get("/verify/{payment_id}", response_model=DinelcoVerifyResponse)
async def verify_payment(payment_id: str, user=Depends(require_auth)):
    if not service.is_configured():
        raise HTTPException(status_code=400, detail="Dinelco no configurado")
    return await service.verify_payment(payment_id)


@router.get("/payments", response_model=list[DinelcoTransactionResponse])
async def list_payments(company_id: str, limit: int = 50, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    from sqlalchemy import select as sa_select
    result = await db.execute(
        sa_select(DinelcoTransaction).where(DinelcoTransaction.company_id == company_id).order_by(DinelcoTransaction.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/payments/{payment_id}", response_model=DinelcoTransactionResponse)
async def get_payment(payment_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    from sqlalchemy import select as sa_select
    import uuid
    result = await db.execute(sa_select(DinelcoTransaction).where(DinelcoTransaction.id == uuid.UUID(payment_id)))
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    return txn


@router.get("/config")
async def get_config(user=Depends(require_auth)):
    return {"configured": service.is_configured()}


@router.post("/webhook")
async def webhook(data: dict, db: AsyncSession = Depends(get_db)):
    payment_id = data.get("payment_id", "")
    status = data.get("status", "")
    if payment_id:
        from sqlalchemy import select
        result = await db.execute(select(DinelcoTransaction).where(DinelcoTransaction.payment_id == payment_id))
        txn = result.scalar_one_or_none()
        if txn:
            txn.status = "approved" if status == "approved" else "declined"
            txn.webhook_data = str(data)
            if status == "approved":
                txn.authorization_code = data.get("auth_code", "")
                txn.card_last4 = data.get("card_last4", "")
                txn.card_brand = data.get("card_brand", "")
            await db.flush()
    return {"status": "ok", "payment_id": payment_id}
