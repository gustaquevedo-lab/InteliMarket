from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.pagopar.schemas import CreatePaymentRequest, PagoparTransaction
from api.src.pagopar import service

router = APIRouter(prefix="/api/v1/pagopar", tags=["pagopar"])


@router.post("/checkout")
async def create_checkout(
    body: CreatePaymentRequest,
    company_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    config = await service.get_config(db, company_id)
    if not config:
        raise HTTPException(status_code=400, detail="Pagopar no configurado para esta empresa")

    try:
        result = await service.create_checkout_session(db, company_id, config, body)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando pago: {str(e)}")


@router.post("/webhook")
async def webhook(
    request: Request,
    company_id: str = Query(...),
    x_signature: str = Header("", alias="X-Signature"),
    db: AsyncSession = Depends(get_db),
):
    config = await service.get_config(db, company_id)
    if not config:
        raise HTTPException(status_code=400, detail="Pagopar no configurado")

    body = await request.body()
    result = await service.handle_webhook(db, config, body, x_signature)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.get("/transactions")
async def list_transactions(
    company_id: str = Query(...),
    order_id: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    transactions = await service.get_transactions(db, company_id, order_id, status, limit, offset)
    return [
        {
            "id": str(t.id),
            "order_id": t.order_id,
            "amount": t.amount,
            "status": t.status,
            "payment_method": t.payment_method,
            "card_brand": t.card_brand,
            "card_last4": t.card_last4,
            "customer_email": t.customer_email,
            "customer_name": t.customer_name,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat(),
        }
        for t in transactions
    ]


@router.get("/transactions/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
):
    transaction = await service.get_transaction(db, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transacci\u00f3n no encontrada")
    return {
        "id": str(transaction.id),
        "order_id": transaction.order_id,
        "amount": transaction.amount,
        "status": transaction.status,
        "payment_method": transaction.payment_method,
        "card_brand": transaction.card_brand,
        "card_last4": transaction.card_last4,
        "customer_email": transaction.customer_email,
        "customer_name": transaction.customer_name,
        "checkout_url": transaction.checkout_url,
        "created_at": transaction.created_at.isoformat(),
        "updated_at": transaction.updated_at.isoformat(),
    }
