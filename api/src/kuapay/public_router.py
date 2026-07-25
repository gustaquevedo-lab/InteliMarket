"""Kuapay public router"""

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.kuapay import service


router = APIRouter(prefix="/api/public/kuapay", tags=["kuapay-public"])


@router.post("/webhook")
async def kuapay_webhook(
    request: Request,
    x_signature: str = Header(..., alias="X-Kuapay-Signature"),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    config = await service.get_config(db, "00000000-0000-0000-0000-000000000001")
    if not config:
        raise HTTPException(status_code=400, detail="Kuapay not configured")
    result = await service.handle_webhook(db, config, body, x_signature)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/pay/{order_id}")
async def payment_page(order_id: str, db: AsyncSession = Depends(get_db)):
    transactions = await service.get_transactions(db, "00000000-0000-0000-0000-000000000001", order_id=order_id)
    if not transactions:
        raise HTTPException(status_code=404, detail="Payment not found")
    tx = transactions[0]
    if tx.checkout_url:
        return RedirectResponse(url=tx.checkout_url)
    return HTMLResponse(
        content=f"""
        <html>
        <head><title>Pagar con Kuapay</title></head>
        <body>
            <h1>Pago #{order_id}</h1>
            <p>Monto: Gs. {tx.amount:,}</p>
            {f'<img src="{tx.qr_image_url}" alt="QR Code" />' if tx.qr_image_url else '<p>QR no disponible</p>'}
            <p>Estado: {tx.status}</p>
        </body>
        </html>
        """
    )


@router.get("/pay/{order_id}/status")
async def payment_status(order_id: str, db: AsyncSession = Depends(get_db)):
    transactions = await service.get_transactions(db, "00000000-0000-0000-0000-000000000001", order_id=order_id)
    if not transactions:
        raise HTTPException(status_code=404, detail="Payment not found")
    tx = transactions[0]
    return {
        "order_id": tx.order_id,
        "status": tx.status,
        "amount": tx.amount,
        "payment_method": tx.payment_method,
        "updated_at": tx.updated_at.isoformat() if tx.updated_at else None,
    }
