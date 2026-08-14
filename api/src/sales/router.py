"""Sales API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.sales.schemas import (
    SaleCreate, SaleUpdate, SaleResponse, SaleWithItems,
    SaleAddPayment, SaleLinkQuote, SaleLinkOrder,
)
from api.src.sales import service
from api.src.events.emitters import emit_sale_completed
from api.src.email import service as email_service
from api.src.whatsapp.service import send_message_to_phone, get_wa_template, format_wa_template
from api.src.intelicont.service import generate_sale_entry
from api.src.integrations.service import send_webhook_async

router = APIRouter(prefix="/api/v1", tags=["sales"])


async def _get_customer_email_phone(db: AsyncSession, customer_id: str) -> tuple:
    """Get customer email and phone."""
    from api.src.customers.models import Customer
    from sqlalchemy import select
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    c = result.scalar_one_or_none()
    return (c.email, c.telefono) if c else (None, None)


async def _send_sale_wa(db: AsyncSession, sale, customer_phone: str | None, tipo: str = "venta.creada", extra: dict | None = None):
    if not customer_phone or not sale.company_id:
        return
    from uuid import UUID
    template = await get_wa_template(db, UUID(sale.company_id), tipo)
    if not template:
        return
    total_str = f"{float(sale.total):,.0f}" if sale.total else "0"
    kwargs = {"NUMERO": sale.numero or "", "TOTAL": total_str, **(extra or {})}
    message = format_wa_template(template, **kwargs)
    await send_message_to_phone(db, sale.company_id, customer_phone, message)


async def fire_sale_side_effects(db: AsyncSession, sale, tipo_comprobante: str) -> None:
    """Email de recibo, WhatsApp, asiento contable InteliCont, emision SIFEN
    y webhook. Solo debe dispararse para una venta realmente confirmada — si
    queda 'pend_aprob_credito' (excede limite de credito, retenida
    para Supervisor+Gerente) todavia no hay nada que facturar ni emitir."""
    try:
        await emit_sale_completed(
            company_id=sale.company_id,
            sale_id=str(sale.id),
            total=sale.total,
            customer_name="",
        )
    except Exception:
        pass

    customer_email, customer_phone = None, None
    if sale.customer_id:
        customer_email, customer_phone = await _get_customer_email_phone(db, str(sale.customer_id))

    # Send receipt email
    if customer_email:
        try:
            email_service.send_receipt_email(
                to_email=customer_email,
                customer_name="Cliente",
                sale_number=sale.numero,
                total=float(sale.total),
                company_name="InteliMarket",
            )
        except Exception:
            pass

    # WhatsApp notification
    await _send_sale_wa(db, sale, customer_phone)

    # Auto-generate InteliCont entry
    try:
        await generate_sale_entry(db, str(sale.id))
    except Exception:
        pass

    # Auto-fire SIFEN for POS sales
    if tipo_comprobante in ("ticket", "factura"):
        try:
            from api.src.sifen.service import send_sale_to_sifen
            await send_sale_to_sifen(db, str(sale.id))
        except Exception:
            pass

    # Fire webhook event
    try:
        await send_webhook_async(db, "venta.creada", {
            "sale_id": str(sale.id),
            "company_id": str(sale.company_id),
            "numero": sale.numero,
            "total": float(sale.total),
            "customer_id": str(sale.customer_id) if sale.customer_id else None,
        })
    except Exception:
        pass


@router.post("/sales", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(body: SaleCreate, db: AsyncSession = Depends(get_db)):
    try:
        sale = await service.create_sale(db, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if sale.estado == "pend_aprob_credito":
        return sale

    await fire_sale_side_effects(db, sale, body.tipo_comprobante)
    return sale


@router.get("/companies/{company_id}/sales", response_model=list[SaleResponse])
async def list_sales(
    company_id: str,
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_sales(db, company_id, customer_id, estado, limit=limit, offset=offset)


@router.get("/sales/{sale_id}", response_model=SaleResponse)
async def get_sale(sale_id: str, db: AsyncSession = Depends(get_db)):
    sale = await service.get_sale(db, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale


@router.get("/companies/{company_id}/sales/today")
async def sales_today(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_sales_today(db, company_id)


@router.post("/sales/{sale_id}/cancel", response_model=SaleResponse)
async def cancel_sale(sale_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.cancel_sale(db, sale_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo cancelar la venta")
    # WhatsApp cancellation notice
    if result.customer_id:
        _, customer_phone = await _get_customer_email_phone(db, str(result.customer_id))
        if customer_phone:
            await _send_sale_wa(db, result, customer_phone, tipo="venta.cancelada", extra={"TOTAL": f"{float(result.total):,.0f}"})
    try:
        await send_webhook_async(db, "venta.anulada", {
            "sale_id": str(result.id),
            "company_id": str(result.company_id),
            "numero": result.numero,
        })
    except Exception:
        pass
    return result


@router.get("/sales/{sale_id}/items")
async def get_sale_items(sale_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_sale_items(db, sale_id)


@router.put("/sales/{sale_id}", response_model=SaleResponse)
async def update_sale(sale_id: str, body: SaleUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_sale(db, sale_id, body)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo actualizar la venta")
    return result


@router.post("/sales/{sale_id}/payments", response_model=SaleResponse)
async def add_payment_to_sale(sale_id: str, body: SaleAddPayment, db: AsyncSession = Depends(get_db)):
    result = await service.add_payment(db, sale_id, body)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    sale = result["sale"]
    # WhatsApp payment notification
    if sale.customer_id:
        _, customer_phone = await _get_customer_email_phone(db, str(sale.customer_id))
        if customer_phone:
            await _send_sale_wa(db, sale, customer_phone, tipo="pago.recibido", extra={"MONTO": f"{float(body.monto):,.0f}"})
    # Auto-generate InteliCont entry if not yet created
    try:
        await generate_sale_entry(db, str(sale.id))
    except Exception:
        pass
    # Fire webhook event
    try:
        await send_webhook_async(db, "pago.recibido", {
            "sale_id": str(sale.id),
            "company_id": str(sale.company_id),
            "monto": float(body.monto),
            "payment_method_id": str(body.payment_method_id) if body.payment_method_id else None,
        })
    except Exception:
        pass
    return sale


@router.post("/sales/{sale_id}/link-quote")
async def link_quote(sale_id: str, body: SaleLinkQuote, db: AsyncSession = Depends(get_db)):
    result = await service.link_quote(db, sale_id, str(body.quote_id))
    if not result:
        raise HTTPException(status_code=404, detail="Venta o cotización no encontrada")
    return {"message": "Cotización vinculada", "sale_id": sale_id, "quote_id": str(body.quote_id)}


@router.post("/sales/{sale_id}/link-order")
async def link_order(sale_id: str, body: SaleLinkOrder, db: AsyncSession = Depends(get_db)):
    result = await service.link_order(db, sale_id, str(body.order_id))
    if not result:
        raise HTTPException(status_code=404, detail="Venta o pedido no encontrado")
    return {"message": "Pedido vinculado", "sale_id": sale_id, "order_id": str(body.order_id)}
