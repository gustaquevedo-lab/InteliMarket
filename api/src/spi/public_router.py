"""SPI QR public router — webhooks and payment pages"""

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.spi import service

router = APIRouter(prefix="/api/public/spi", tags=["spi-public"])


@router.post("/webhook")
async def spi_webhook(
    request: Request,
    x_signature: str = Header(None, alias="X-Spi-Signature"),
    x_bcp_signature: str = Header(None, alias="X-BCP-Signature"),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    signature = x_signature or x_bcp_signature or ""
    if not signature:
        raise HTTPException(status_code=400, detail="Missing webhook signature")

    config = await service.get_config(db, "00000000-0000-0000-0000-000000000001")
    if not config:
        raise HTTPException(status_code=400, detail="SPI QR not configured")

    result = await service.handle_webhook(db, config, body, signature)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/pay/{order_id}")
async def payment_page(order_id: str, db: AsyncSession = Depends(get_db)):
    transactions = await service.get_transactions(db, "00000000-0000-0000-0000-000000000001", order_id=order_id)
    if not transactions:
        raise HTTPException(status_code=404, detail="Payment not found")
    tx = transactions[0]
    return HTMLResponse(
        content=f"""
        <html>
        <head>
            <title>Pagar con SPI QR</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {{ font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }}
                .card {{ background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 16px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }}
                .amount {{ font-size: 28px; font-weight: bold; color: #1a1a1a; margin: 16px 0; }}
                .qr {{ margin: 24px 0; }}
                .qr img {{ width: 240px; height: 240px; border: 2px solid #e0e0e0; border-radius: 12px; padding: 8px; }}
                .status {{ display: inline-block; padding: 4px 16px; border-radius: 20px; font-size: 14px; }}
                .pending {{ background: #fff3cd; color: #856404; }}
                .approved {{ background: #d4edda; color: #155724; }}
                .rejected {{ background: #f8d7da; color: #721c24; }}
                .merchant {{ color: #666; font-size: 14px; margin-top: 16px; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Pago SPI QR</h2>
                <p>Orden #{order_id}</p>
                <div class="amount">Gs. {tx.amount:,}</div>
                <div class="qr">
                    <img src="data:image/png;base64,{tx.qr_image_base64 or ''}" alt="QR de pago" />
                </div>
                <p>Escaneá el QR con tu app bancaria</p>
                <div class="status {tx.status}">{tx.status}</div>
                <div class="merchant">{tx.merchant_name or ''}</div>
            </div>
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
        "currency": tx.currency,
        "updated_at": tx.updated_at.isoformat() if tx.updated_at else None,
    }
