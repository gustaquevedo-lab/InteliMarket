from sqlalchemy import select, func as sa_func, and_, desc, delete, extract
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid, random, math

from api.src.scanandgo.models import ScanSession, ScanItem, ScanPayment, ScanAudit, ScanDashboard
from api.src.scanandgo.schemas import (
    ScanSessionCreate, ScanItemAdd, ScanItemResponse, ScanSessionResponse,
    ScanPaymentRequest, ScanPaymentResponse, ScanAuditResponse,
    ScanAuditCheck, ScanAuditResolve, ScanDashboardResponse,
    SendDigitalTicketRequest, SendDigitalTicketResponse,
)
from api.src.products.models import Product
from api.src.customers.models import Partner
from api.src.clientes.models import LoyaltyProgram, LoyaltyTransaction
from api.src.email import service as email_service


AUDIT_PROBABILITY = 0.10


async def create_session(db: AsyncSession, company_id: str, customer_id: str, data: ScanSessionCreate) -> dict:
    session = ScanSession(
        company_id=uuid.UUID(company_id),
        customer_id=uuid.UUID(customer_id),
        branch_id=data.branch_id,
        status="active",
    )
    db.add(session)
    await db.flush()

    result = await db.execute(
        select(ScanItem).where(ScanItem.session_id == session.id)
    )
    items = result.scalars().all()

    return _session_to_dict(session, items)


async def get_active_session(db: AsyncSession, company_id: str, customer_id: str) -> Optional[dict]:
    result = await db.execute(
        select(ScanSession).where(
            ScanSession.company_id == company_id,
            ScanSession.customer_id == customer_id,
            ScanSession.status == "active",
        ).order_by(desc(ScanSession.started_at)).limit(1)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None
    return await _get_session_full(db, session)


async def get_session(db: AsyncSession, company_id: str, session_id: str) -> Optional[dict]:
    result = await db.execute(
        select(ScanSession).where(ScanSession.id == session_id, ScanSession.company_id == company_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None
    return await _get_session_full(db, session)


async def _get_session_full(db: AsyncSession, session: ScanSession) -> dict:
    result = await db.execute(
        select(ScanItem).where(ScanItem.session_id == session.id).order_by(ScanItem.scanned_at)
    )
    items = result.scalars().all()

    result = await db.execute(
        select(ScanPayment).where(ScanPayment.session_id == session.id)
    )
    payment = result.scalar_one_or_none()

    result = await db.execute(
        select(ScanAudit).where(ScanAudit.session_id == session.id)
    )
    audit = result.scalar_one_or_none()

    return {
        **_session_to_dict(session, items),
        "payment": ScanPaymentResponse.model_validate(payment).model_dump() if payment else None,
        "audit": ScanAuditResponse.model_validate(audit).model_dump() if audit else None,
    }


def _session_to_dict(session: ScanSession, items: list[ScanItem]) -> dict:
    return {
        "id": str(session.id),
        "company_id": str(session.company_id),
        "customer_id": str(session.customer_id),
        "branch_id": str(session.branch_id) if session.branch_id else None,
        "status": session.status,
        "total_items": session.total_items,
        "total_amount": float(session.total_amount or 0),
        "discount_amount": float(session.discount_amount or 0),
        "final_amount": float(session.final_amount or 0),
        "currency": session.currency,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        "items": [ScanItemResponse.model_validate(i).model_dump() for i in items],
    }


async def add_item(db: AsyncSession, company_id: str, data: ScanItemAdd) -> dict:
    result = await db.execute(
        select(ScanSession).where(ScanSession.id == data.session_id, ScanSession.company_id == company_id)
    )
    session = result.scalar_one_or_none()
    if not session or session.status != "active":
        raise ValueError("Sesión no activa")

    subtotal = round(data.quantity * data.unit_price)

    item = ScanItem(
        session_id=data.session_id,
        company_id=uuid.UUID(company_id),
        product_id=data.product_id,
        barcode=data.barcode,
        product_name=data.product_name,
        quantity=data.quantity,
        unit_price=data.unit_price,
        subtotal=subtotal,
        is_weight=data.is_weight,
        weight_kg=data.weight_kg,
    )
    db.add(item)

    session.total_items = (session.total_items or 0) + 1
    session.total_amount = float(session.total_amount or 0) + subtotal
    session.final_amount = float(session.final_amount or 0) + subtotal

    await db.flush()

    result = await db.execute(
        select(ScanItem).where(ScanItem.session_id == session.id).order_by(ScanItem.scanned_at)
    )
    items = result.scalars().all()
    return _session_to_dict(session, items)


async def remove_item(db: AsyncSession, company_id: str, session_id: str, item_id: str) -> Optional[dict]:
    result = await db.execute(
        select(ScanItem).where(ScanItem.id == item_id, ScanItem.session_id == session_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        return None

    result = await db.execute(
        select(ScanSession).where(ScanSession.id == session_id, ScanSession.company_id == company_id)
    )
    session = result.scalar_one_or_none()
    if not session or session.status != "active":
        return None

    session.total_amount = float(session.total_amount or 0) - float(item.subtotal)
    session.final_amount = float(session.final_amount or 0) - float(item.subtotal)
    session.total_items = max(0, (session.total_items or 0) - 1)

    await db.delete(item)
    await db.flush()

    result = await db.execute(
        select(ScanItem).where(ScanItem.session_id == session.id).order_by(ScanItem.scanned_at)
    )
    items = result.scalars().all()
    return _session_to_dict(session, items)


async def process_payment(db: AsyncSession, company_id: str, data: ScanPaymentRequest) -> dict:
    result = await db.execute(
        select(ScanSession).where(ScanSession.id == data.session_id, ScanSession.company_id == company_id)
    )
    session = result.scalar_one_or_none()
    if not session or session.status != "active":
        raise ValueError("Sesión no activa")

    loyalty_discount = 0
    if data.loyalty_points_used and data.loyalty_points_used > 0:
        result = await db.execute(
            select(LoyaltyProgram).where(LoyaltyProgram.company_id == company_id)
        )
        prog = result.scalar_one_or_none()
        if prog:
            points_value = data.loyalty_points_used / (prog.points_per_currency or 1)
            loyalty_discount = min(float(points_value) * 1000, float(session.final_amount or 0))

            txn = LoyaltyTransaction(
                company_id=uuid.UUID(company_id),
                customer_id=session.customer_id,
                tipo="canje",
                puntos=data.loyalty_points_used,
                concepto="Canje en Scan&Go",
                reference_type="scan_session",
                reference_id=str(session.id),
            )
            db.add(txn)

    final = float(session.final_amount or 0) - loyalty_discount
    session.discount_amount = loyalty_discount
    session.final_amount = final

    payment = ScanPayment(
        session_id=data.session_id,
        company_id=uuid.UUID(company_id),
        method=data.method,
        amount=final,
        status="completed" if data.gateway_transaction_id else "pending",
        gateway=data.gateway,
        gateway_transaction_id=data.gateway_transaction_id,
        loyalty_points_used=data.loyalty_points_used or 0,
        loyalty_discount=loyalty_discount,
        paid_at=datetime.now(timezone.utc) if data.gateway_transaction_id else None,
    )
    db.add(payment)

    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)

    await db.flush()

    # Trigger random audit
    if random.random() < AUDIT_PROBABILITY:
        await _create_audit(db, session)

    return ScanPaymentResponse.model_validate(payment).model_dump()


async def _create_audit(db: AsyncSession, session: ScanSession):
    result = await db.execute(
        select(ScanItem).where(ScanItem.session_id == session.id)
    )
    items = result.scalars().all()

    sample_size = min(random.randint(3, 5), len(items))
    to_check = random.sample(items, sample_size)

    audit = ScanAudit(
        session_id=session.id,
        company_id=session.company_id,
        is_random_audit=True,
        items_to_check=[{"item_id": str(i.id), "product_id": str(i.product_id), "product_name": i.product_name} for i in to_check],
        status="pending",
    )
    db.add(audit)
    await db.flush()


async def list_sessions(
    db: AsyncSession, company_id: str,
    status: Optional[str] = None, customer_id: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    query = select(ScanSession).where(ScanSession.company_id == company_id)
    if status:
        query = query.where(ScanSession.status == status)
    if customer_id:
        query = query.where(ScanSession.customer_id == customer_id)
    query = query.order_by(desc(ScanSession.started_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    sessions = result.scalars().all()

    return [_session_to_dict(s, []) for s in sessions]


async def get_audit(db: AsyncSession, company_id: str, audit_id: str) -> Optional[dict]:
    result = await db.execute(
        select(ScanAudit).where(ScanAudit.id == audit_id, ScanAudit.company_id == company_id)
    )
    audit = result.scalar_one_or_none()
    if not audit:
        return None
    return ScanAuditResponse.model_validate(audit).model_dump()


async def check_audit(db: AsyncSession, company_id: str, data: ScanAuditCheck) -> Optional[dict]:
    result = await db.execute(
        select(ScanAudit).where(ScanAudit.id == data.audit_id, ScanAudit.company_id == company_id)
    )
    audit = result.scalar_one_or_none()
    if not audit:
        return None

    discrepancies = []
    for checked in data.items_checked:
        expected = next(
            (i for i in (audit.items_to_check or []) if str(i.get("item_id")) == str(checked.get("item_id"))),
            None
        )
        if expected and float(checked.get("scanned_qty", 0)) != 1:
            discrepancies.append({
                "item_id": checked.get("item_id"),
                "product_name": expected.get("product_name"),
                "expected_qty": 1,
                "found_qty": checked.get("scanned_qty"),
                "difference": 1 - float(checked.get("scanned_qty", 0)),
            })

    audit.items_checked = data.items_checked
    audit.discrepancies = discrepancies if discrepancies else None
    audit.has_discrepancy = len(discrepancies) > 0
    audit.checked_by = data.checked_by
    audit.checked_at = datetime.now(timezone.utc)
    audit.status = "checked"

    await db.flush()
    return ScanAuditResponse.model_validate(audit).model_dump()


async def resolve_audit(db: AsyncSession, company_id: str, data: ScanAuditResolve) -> Optional[dict]:
    result = await db.execute(
        select(ScanAudit).where(ScanAudit.id == data.audit_id, ScanAudit.company_id == company_id)
    )
    audit = result.scalar_one_or_none()
    if not audit:
        return None

    audit.resolution = data.resolution
    audit.resolution_note = data.resolution_note
    audit.status = "resolved"

    await db.flush()
    return ScanAuditResponse.model_validate(audit).model_dump()


async def list_pending_audits(db: AsyncSession, company_id: str, limit: int = 50) -> list[dict]:
    result = await db.execute(
        select(ScanAudit).where(
            ScanAudit.company_id == company_id,
            ScanAudit.status.in_(["pending", "checked"]),
        ).order_by(desc(ScanAudit.created_at)).limit(limit)
    )
    audits = result.scalars().all()
    return [ScanAuditResponse.model_validate(a).model_dump() for a in audits]


async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(sa_func.count()).where(
            ScanSession.company_id == company_id,
            ScanSession.started_at >= today_start,
        )
    )
    today_sessions = result.scalar() or 0

    result = await db.execute(
        select(sa_func.count()).where(
            ScanSession.company_id == company_id,
            ScanSession.status == "active",
        )
    )
    active_sessions = result.scalar() or 0

    result = await db.execute(
        select(sa_func.count()).where(
            ScanSession.company_id == company_id,
            ScanSession.status == "completed",
            ScanSession.started_at >= today_start,
        )
    )
    completed_today = result.scalar() or 0

    result = await db.execute(
        select(sa_func.coalesce(sa_func.sum(ScanSession.final_amount), 0)).where(
            ScanSession.company_id == company_id,
            ScanSession.status == "completed",
            ScanSession.started_at >= today_start,
        )
    )
    today_amount = float(result.scalar() or 0)

    result = await db.execute(
        select(sa_func.count()).where(
            ScanAudit.company_id == company_id,
        )
    )
    total_audits = result.scalar() or 0

    result = await db.execute(
        select(sa_func.count()).where(
            ScanAudit.company_id == company_id,
            ScanAudit.has_discrepancy == True,
        )
    )
    audits_with_issues = result.scalar() or 0

    result = await db.execute(
        select(
            extract("hour", ScanSession.started_at),
            sa_func.count(),
            sa_func.coalesce(sa_func.sum(ScanSession.final_amount), 0),
        ).where(
            ScanSession.company_id == company_id,
            ScanSession.started_at >= today_start,
        ).group_by(extract("hour", ScanSession.started_at)).order_by(extract("hour", ScanSession.started_at))
    )
    hourly = [{"hour": int(r[0]), "sessions": r[1], "amount": float(r[2])} for r in result.all()]

    result = await db.execute(
        select(ScanSession).where(
            ScanSession.company_id == company_id,
            ScanSession.started_at >= today_start,
        ).order_by(desc(ScanSession.started_at)).limit(10)
    )
    recent = result.scalars().all()

    audit_rate = round((total_audits / max(1, today_sessions)) * 100, 1) if today_sessions > 0 else 0

    result = await db.execute(
        select(sa_func.count()).where(Partner.company_id == company_id)
    )
    total_customers = result.scalar() or 1

    unique_customers_today = 0
    result = await db.execute(
        select(sa_func.count(sa_func.distinct(ScanSession.customer_id))).where(
            ScanSession.company_id == company_id,
            ScanSession.started_at >= today_start,
        )
    )
    unique_customers_today = result.scalar() or 0

    return ScanDashboardResponse(
        today_sessions=today_sessions,
        active_sessions=active_sessions,
        completed_sessions=completed_today,
        abandoned_sessions=today_sessions - completed_today,
        today_amount=today_amount,
        total_audits=total_audits,
        audits_with_issues=audits_with_issues,
        audit_rate=audit_rate,
        adoption_rate=round((unique_customers_today / max(1, total_customers)) * 100, 1),
        avg_session_value=round(today_amount / max(1, completed_today)),
        recent_sessions=[_session_to_dict(s, []) for s in recent],
        hourly_breakdown=hourly,
    ).model_dump()


async def lookup_product(db: AsyncSession, company_id: str, barcode: str) -> Optional[dict]:
    result = await db.execute(
        select(Product).where(
            Product.company_id == company_id,
            Product.barcode == barcode,
            Product.activo == True,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        return None
    return {
        "id": str(product.id),
        "nombre": product.nombre,
        "barcode": product.barcode,
        "precio_venta": float(product.precio_venta or 0),
        "imagen_url": product.imagen_url,
        "unidad_venta": product.unidad_venta,
        "is_weight": product.unidad_venta in ("kg", "g", "l", "ml"),
    }


async def send_digital_ticket(db: AsyncSession, company_id: str, data: SendDigitalTicketRequest) -> dict:
    result = await db.execute(
        select(ScanSession).where(ScanSession.id == data.session_id, ScanSession.company_id == company_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise ValueError("Sesión no encontrada")

    result = await db.execute(
        select(ScanItem).where(ScanItem.session_id == session.id)
    )
    items = result.scalars().all()

    result = await db.execute(
        select(ScanPayment).where(ScanPayment.session_id == session.id)
    )
    payment = result.scalar_one_or_none()

    company_name = "InteliMarket"
    total = float(session.final_amount or 0)
    item_lines = "\n".join(
        f"  • {i.product_name or 'Producto'} x{i.quantity} — Gs {float(i.subtotal or 0):,.0f}"
        for i in items
    )

    receipt_body = (
        f"**{company_name} — Ticket Digital**\n\n"
        f"Gracias por tu compra con Scan&Go.\n\n"
        f"**Resumen:**\n"
        f"{item_lines}\n\n"
        f"**Total:** Gs {total:,.0f}\n"
        f"**Método:** {payment.method if payment else 'N/A'}\n"
        f"**Fecha:** {session.completed_at.strftime('%d/%m/%Y %H:%M') if session.completed_at else 'N/A'}\n\n"
        f"¡Vuelve pronto!"
    )

    sent = False
    channel = None

    if data.email:
        try:
            email_service.send_receipt_email(
                to_email=data.email,
                customer_name="Cliente",
                sale_number=str(session.id)[:8],
                total=total,
                company_name=company_name,
            )
            sent = True
            channel = "email"
        except Exception:
            pass

    if data.whatsapp_phone:
        try:
            from api.src.whatsapp.service import send_template_message
            await send_template_message(
                to=data.whatsapp_phone,
                template_name="ticket_digital",
                variables={"company": company_name, "total": f"Gs {total:,.0f}", "items": str(len(items))},
            )
            sent = True
            channel = "whatsapp" if channel is None else "both"
        except Exception:
            pass

    return SendDigitalTicketResponse(
        sent=sent,
        channel=channel,
        message="Ticket digital enviado" if sent else "No se pudo enviar el ticket — sin contacto configurado",
    ).model_dump()
