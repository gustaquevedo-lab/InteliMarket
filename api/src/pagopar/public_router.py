from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.pagopar.models import PagoparTransaction
from api.src.pagopar import service

router = APIRouter(prefix="/api/public/pagopar", tags=["pagopar-public"])


@router.get("/pay/{order_id}")
async def payment_portal(
    order_id: str,
    company_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PagoparTransaction)
        .where(PagoparTransaction.order_id == order_id)
        .where(PagoparTransaction.company_id == company_id)
        .order_by(PagoparTransaction.created_at.desc())
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    return {
        "id": str(transaction.id),
        "order_id": transaction.order_id,
        "amount": transaction.amount,
        "status": transaction.status,
        "customer_name": transaction.customer_name,
        "customer_email": transaction.customer_email,
        "checkout_url": transaction.checkout_url,
        "created_at": transaction.created_at.isoformat(),
        "updated_at": transaction.updated_at.isoformat(),
    }


@router.get("/pay/{order_id}/status")
async def payment_status(
    order_id: str,
    company_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PagoparTransaction)
        .where(PagoparTransaction.order_id == order_id)
        .where(PagoparTransaction.company_id == company_id)
        .order_by(PagoparTransaction.created_at.desc())
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    return {
        "order_id": transaction.order_id,
        "status": transaction.status,
        "amount": transaction.amount,
        "payment_method": transaction.payment_method,
        "card_brand": transaction.card_brand,
        "card_last4": transaction.card_last4,
        "updated_at": transaction.updated_at.isoformat(),
    }


@router.get("/pay/{order_id}/page", response_class=HTMLResponse)
async def payment_page(
    order_id: str,
    company_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PagoparTransaction)
        .where(PagoparTransaction.order_id == order_id)
        .where(PagoparTransaction.company_id == company_id)
        .order_by(PagoparTransaction.created_at.desc())
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    status_colors = {
        "pending": "#f59e0b",
        "approved": "#10b981",
        "rejected": "#ef4444",
        "refunded": "#6b7280",
        "cancelled": "#6b7280",
    }
    status_labels = {
        "pending": "Pendiente",
        "approved": "Aprobado",
        "rejected": "Rechazado",
        "refunded": "Reembolsado",
        "cancelled": "Cancelado",
    }
    color = status_colors.get(transaction.status, "#6b7280")
    label = status_labels.get(transaction.status, transaction.status)

    amount_gs = f"{transaction.amount:,}".replace(",", ".")

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pago - InteliMarket</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }}
        .card {{ background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 420px; width: 100%; padding: 2rem; }}
        .header {{ text-align: center; margin-bottom: 1.5rem; }}
        .header h1 {{ font-size: 1.25rem; color: #1f2937; margin-bottom: 0.25rem; }}
        .header p {{ color: #6b7280; font-size: 0.875rem; }}
        .amount {{ text-align: center; font-size: 2rem; font-weight: 700; color: #1f2937; margin: 1.5rem 0; }}
        .amount span {{ font-size: 1rem; font-weight: 400; color: #6b7280; }}
        .status {{ display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem; border-radius: 8px; background: {color}15; margin-bottom: 1.5rem; }}
        .status-dot {{ width: 10px; height: 10px; border-radius: 50%; background: {color}; }}
        .status-text {{ color: {color}; font-weight: 600; font-size: 0.875rem; }}
        .details {{ border-top: 1px solid #e5e7eb; padding-top: 1rem; }}
        .detail-row {{ display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 0.875rem; }}
        .detail-label {{ color: #6b7280; }}
        .detail-value {{ color: #1f2937; font-weight: 500; }}
        .btn {{ display: block; width: 100%; padding: 0.875rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; text-align: center; text-decoration: none; margin-top: 1.5rem; }}
        .btn-primary {{ background: #2563eb; color: white; }}
        .btn-primary:hover {{ background: #1d4ed8; }}
        .btn-disabled {{ background: #d1d5db; color: #6b7280; cursor: not-allowed; }}
        .footer {{ text-align: center; margin-top: 1.5rem; font-size: 0.75rem; color: #9ca3af; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h1>InteliMarket</h1>
            <p>Portal de Pago</p>
        </div>
        <div class="amount">
            <span>Gs.</span> {amount_gs}
        </div>
        <div class="status">
            <div class="status-dot"></div>
            <span class="status-text">{label}</span>
        </div>
        <div class="details">
            <div class="detail-row">
                <span class="detail-label">Pedido</span>
                <span class="detail-value">{transaction.order_id}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Cliente</span>
                <span class="detail-value">{transaction.customer_name}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Email</span>
                <span class="detail-value">{transaction.customer_email}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Fecha</span>
                <span class="detail-value">{transaction.created_at.strftime('%d/%m/%Y %H:%M')}</span>
            </div>
        </div>
        {f'<a href="{transaction.checkout_url}" class="btn btn-primary">Pagar ahora</a>' if transaction.status == 'pending' and transaction.checkout_url else '<div class="btn btn-disabled">Pago completado</div>'}
        <div class="footer">
            Procesado por Pagopar &middot; InteliMarket ERP
        </div>
    </div>
</body>
</html>"""

    return HTMLResponse(content=html)
