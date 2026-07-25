"""SPI QR router — QR Interoperable BCP Hub"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.spi import service
from api.src.spi.schemas import CreateSpiPaymentRequest

router = APIRouter(prefix="/api/v1/spi", tags=["spi"], dependencies=[Depends(require_feature("spi"))])


@router.post("/checkout")
async def create_checkout(
    request: CreateSpiPaymentRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    config = await service.get_config(db, user["company_id"])
    if not config:
        raise HTTPException(status_code=400, detail="SPI QR no configurado para esta empresa")
    return await service.create_qr_payment(db, user["company_id"], config, request)


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
            "currency": t.currency,
            "status": t.status,
            "merchant_name": t.merchant_name,
            "description": t.description,
            "customer_email": t.customer_email,
            "customer_name": t.customer_name,
            "bcp_transaction_id": t.bcp_transaction_id,
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
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    return {
        "id": str(transaction.id),
        "order_id": transaction.order_id,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "status": transaction.status,
        "merchant_name": transaction.merchant_name,
        "description": transaction.description,
        "customer_email": transaction.customer_email,
        "customer_name": transaction.customer_name,
        "bcp_transaction_id": transaction.bcp_transaction_id,
        "qr_data": transaction.qr_data,
        "created_at": transaction.created_at.isoformat(),
        "updated_at": transaction.updated_at.isoformat() if transaction.updated_at else None,
    }


@router.get("/config")
async def get_config(user=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    config = await service.get_config(db, user["company_id"])
    return {"configured": config is not None}


@router.post("/verify/{order_id}")
async def verify_payment(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    config = await service.get_config(db, user["company_id"])
    if not config:
        raise HTTPException(status_code=400, detail="SPI QR no configurado")
    try:
        result = await service.verify_payment_with_bcp(config, order_id)
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/qr")
async def generate_qr_standalone(
    amount: int,
    order_id: str,
    description: str = "",
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    config = await service.get_config(db, user["company_id"])
    if not config:
        raise HTTPException(status_code=400, detail="SPI QR no configurado")
    result = await service.create_qr_payment(
        db,
        user["company_id"],
        config,
        CreateSpiPaymentRequest(amount=amount, order_id=order_id, description=description),
    )
    return result
