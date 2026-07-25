from sqlalchemy import select, func as sa_func, and_, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid, math, random
from collections import defaultdict

from api.src.credit_scoring.models import CreditScore, RiskAlert, CreditEvent
from api.src.credit_scoring.schemas import (
    EvaluateCustomerRequest, EvaluateCustomerResponse,
    BulkEvaluateResponse, UpdateLimitRequest, PortfolioDashboard,
)
from api.src.customers.models import Partner
from api.src.sales.models import Sale
from api.src.payments.models import Payment, PaymentAllocation


async def _get_customer_data(db: AsyncSession, company_id: str, customer_id: str) -> dict:
    """Aggregate customer data for scoring from existing tables."""
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Partner).where(Partner.id == customer_id, Partner.company_id == company_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        return None

    months_as_customer = max(1, (now - customer.created_at.replace(tzinfo=timezone.utc)).days // 30) if customer.created_at else 1

    result = await db.execute(
        select(sa_func.count(), sa_func.coalesce(sa_func.sum(Sale.total), 0))
        .where(Sale.customer_id == customer_id, Sale.company_id == company_id)
    )
    total_sales_count, total_sales_amount = result.one()

    result = await db.execute(
        select(Sale).where(
            Sale.customer_id == customer_id,
            Sale.company_id == company_id,
            Sale.saldo > 0,
        ).order_by(desc(Sale.fecha))
    )
    overdue_sales = result.scalars().all()

    total_overdue_days = 0
    times_overdue = 0
    for s in overdue_sales:
        if s.fecha:
            days = (now - s.fecha.replace(tzinfo=timezone.utc)).days
            if days > 0:
                total_overdue_days += days
                times_overdue += 1

    result = await db.execute(
        select(Sale).where(
            Sale.customer_id == customer_id,
            Sale.company_id == company_id,
        ).order_by(desc(Sale.fecha)).limit(1)
    )
    last_sale = result.scalar_one_or_none()
    days_since_last_purchase = (now - last_sale.fecha.replace(tzinfo=timezone.utc)).days if last_sale and last_sale.fecha else None

    result = await db.execute(
        select(PaymentAllocation).join(Payment, PaymentAllocation.payment_id == Payment.id)
        .where(PaymentAllocation.sale_id.in_(
            select(Sale.id).where(Sale.customer_id == customer_id, Sale.company_id == company_id)
        ))
    )
    allocations = result.scalars().all()

    on_time_payments = 0
    total_payments_for_rate = 0
    total_delay_days = 0

    sale_ids = set()
    for alloc in allocations:
        sale_ids.add(str(alloc.sale_id))
        total_payments_for_rate += 1

    for sid in sale_ids:
        result = await db.execute(
            select(Sale).where(Sale.id == sid)
        )
        sale = result.scalar_one_or_none()
        if sale and sale.fecha:
            allocs_for_sale = [a for a in allocations if str(a.sale_id) == sid]
            for alc in allocs_for_sale:
                result = await db.execute(
                    select(Payment).where(Payment.id == alc.payment_id)
                )
                payment = result.scalar_one_or_none()
                if payment and payment.fecha:
                    delay = (payment.fecha.replace(tzinfo=timezone.utc) - sale.fecha.replace(tzinfo=timezone.utc)).days
                    if delay > 0:
                        total_delay_days += delay
                        times_overdue += 1
                    else:
                        on_time_payments += 1

    on_time_payment_rate = on_time_payments / max(total_payments_for_rate, 1)
    avg_delay = total_delay_days / max(times_overdue, 1)

    used_credit = float(customer.credito_usado or 0)
    current_limit = float(customer.credito_limite or 0)

    return {
        "customer_id": str(customer.id),
        "company_id": company_id,
        "months_as_customer": months_as_customer,
        "total_sales_count": total_sales_count,
        "total_sales_amount": float(total_sales_amount),
        "total_overdue_days": total_overdue_days,
        "times_overdue": times_overdue,
        "days_since_last_purchase": days_since_last_purchase,
        "on_time_payment_rate": round(on_time_payment_rate, 4),
        "average_payment_delay_days": round(avg_delay, 1),
        "used_credit": used_credit,
        "current_credit_limit": current_limit,
        "available_credit": max(0, current_limit - used_credit),
    }


def _compute_score(data: dict) -> dict:
    on_time = data["on_time_payment_rate"]
    avg_delay = data["average_payment_delay_days"]
    times_overdue = data["times_overdue"]
    total_overdue = data["total_overdue_days"]
    months = data["months_as_customer"]
    total_sales = data["total_sales_count"]
    total_amount = data["total_sales_amount"]
    used = data["used_credit"]
    limit = data["current_credit_limit"]

    payment_history_score = min(300, int(on_time * 200 + max(0, 100 - avg_delay) / 100 * 100))
    if times_overdue > 0:
        payment_history_score = max(0, payment_history_score - times_overdue * 20)
    if total_overdue > 90:
        payment_history_score = max(0, payment_history_score - 100)

    antiquity_score = min(200, int(months / 60 * 200))
    if months < 3:
        antiquity_score = max(antiquity_score, 50)

    freq_per_month = total_sales / max(months, 1)
    frequency_score = min(150, int(freq_per_month / 8 * 150))

    if total_sales > 0:
        avg_amount = total_amount / total_sales
        if avg_amount > 5000000:
            avg_amount_score = 150
        elif avg_amount > 1000000:
            avg_amount_score = 120
        elif avg_amount > 500000:
            avg_amount_score = 90
        elif avg_amount > 100000:
            avg_amount_score = 60
        else:
            avg_amount_score = 30
    else:
        avg_amount_score = 50

    industry_score = 60

    if limit > 0:
        utilization = used / limit
        credit_utilization_score = max(0, 100 - int(utilization * 100))
    else:
        credit_utilization_score = 50

    score = payment_history_score + antiquity_score + frequency_score + avg_amount_score + industry_score + credit_utilization_score
    score = max(0, min(1000, score))

    if score >= 800:
        risk_level = "low"
        suggested_limit = int(total_amount / max(months, 1) * 3) if total_sales > 0 else 5000000
    elif score >= 600:
        risk_level = "medium"
        suggested_limit = int(total_amount / max(months, 1) * 2) if total_sales > 0 else 3000000
    elif score >= 400:
        risk_level = "high"
        suggested_limit = int(total_amount / max(months, 1) * 1) if total_sales > 0 else 1000000
    else:
        risk_level = "critical"
        suggested_limit = min(500000, int(total_amount / max(months, 1) * 0.5)) if total_sales > 0 else 0

    new_limit = max(suggested_limit, 0)
    should_block = score < 300 or total_overdue > 60

    return {
        "score": score,
        "risk_level": risk_level,
        "payment_history_score": payment_history_score,
        "antiquity_score": antiquity_score,
        "frequency_score": frequency_score,
        "avg_amount_score": avg_amount_score,
        "industry_score": industry_score,
        "credit_utilization_score": credit_utilization_score,
        "suggested_credit_limit": new_limit,
        "should_block": should_block,
        "block_reason": "Puntaje crítico o mora superior a 60 días" if should_block else None,
    }


def _generate_alerts(old: CreditScore, new_data: dict, customer: dict) -> list[dict]:
    alerts = []
    old_score = old.score if old else 500

    if new_data["score"] < old_score - 50:
        alerts.append({
            "alert_type": "score_drop",
            "severity": "high" if new_data["score"] < old_score - 100 else "medium",
            "previous_score": old_score,
            "new_score": new_data["score"],
            "message": f"Puntaje crediticio cayó de {old_score} a {new_data['score']} puntos",
        })

    if customer.get("used_credit", 0) > 0 and customer.get("current_credit_limit", 0) > 0:
        utilization = customer["used_credit"] / customer["current_credit_limit"]
        if utilization > 0.8:
            alerts.append({
                "alert_type": "near_limit",
                "severity": "high" if utilization > 0.95 else "medium",
                "previous_score": None,
                "new_score": None,
                "message": f"Cliente utilizó {utilization:.0%} de su límite de crédito",
            })

    if customer.get("total_overdue_days", 0) > 30:
        alerts.append({
            "alert_type": "overdue",
            "severity": "critical" if customer["total_overdue_days"] > 60 else "high",
            "previous_score": None,
            "new_score": None,
            "message": f"Cliente tiene {customer['total_overdue_days']} días de mora acumulados",
        })

    if new_data["risk_level"] == "critical":
        alerts.append({
            "alert_type": "payment_default",
            "severity": "critical",
            "previous_score": old_score,
            "new_score": new_data["score"],
            "message": f"Cliente en estado crítico (score {new_data['score']}). Requiere revisión inmediata",
        })

    return alerts


async def evaluate_customer(db: AsyncSession, company_id: str, customer_id: str) -> EvaluateCustomerResponse:
    data = await _get_customer_data(db, company_id, customer_id)
    if not data:
        return None

    result = await db.execute(
        select(CreditScore).where(
            CreditScore.company_id == company_id,
            CreditScore.customer_id == customer_id,
        )
    )
    existing = result.scalar_one_or_none()

    score_data = _compute_score(data)

    now = datetime.now(timezone.utc)
    alerts_data = _generate_alerts(existing, score_data, data)

    limit_changed = False

    if existing:
        old_limit = float(existing.current_credit_limit)
        existing.score = score_data["score"]
        existing.risk_level = score_data["risk_level"]
        existing.payment_history_score = score_data["payment_history_score"]
        existing.antiquity_score = score_data["antiquity_score"]
        existing.frequency_score = score_data["frequency_score"]
        existing.avg_amount_score = score_data["avg_amount_score"]
        existing.industry_score = score_data["industry_score"]
        existing.credit_utilization_score = score_data["credit_utilization_score"]
        existing.suggested_credit_limit = score_data["suggested_credit_limit"]
        existing.used_credit = data["used_credit"]
        existing.available_credit = data["available_credit"]
        existing.on_time_payment_rate = data["on_time_payment_rate"]
        existing.average_payment_delay_days = data["average_payment_delay_days"]
        existing.total_overdue_days = data["total_overdue_days"]
        existing.days_since_last_purchase = data["days_since_last_purchase"]
        existing.total_purchases = data["total_sales_count"]
        existing.total_purchase_amount = data["total_sales_amount"]
        existing.months_as_customer = data["months_as_customer"]
        existing.times_overdue = data["times_overdue"]
        existing.last_evaluation_date = now

        if old_limit != score_data["suggested_credit_limit"] and score_data["suggested_credit_limit"] > 0:
            existing.current_credit_limit = score_data["suggested_credit_limit"]
            existing.current_credit_limit = score_data["suggested_credit_limit"]
            limit_changed = True
            event = CreditEvent(
                company_id=company_id,
                customer_id=customer_id,
                event_type="limit_change",
                previous_limit=old_limit,
                new_limit=score_data["suggested_credit_limit"],
                reason="Actualización automática por re-evaluación de scoring",
            )
            db.add(event)

        if score_data["should_block"] and not existing.is_auto_blocked:
            existing.is_auto_blocked = True
            existing.status = "blocked"
            existing.block_reason = score_data["block_reason"]
            event = CreditEvent(
                company_id=company_id,
                customer_id=customer_id,
                event_type="auto_block",
                reason=score_data["block_reason"],
            )
            db.add(event)

        elif not score_data["should_block"] and existing.is_auto_blocked:
            existing.is_auto_blocked = False
            existing.status = "active"
            existing.block_reason = None
            event = CreditEvent(
                company_id=company_id,
                customer_id=customer_id,
                event_type="auto_unblock",
                reason="Re-evaluación: puntaje mejoró o mora regularizada",
            )
            db.add(event)

        elif score_data["risk_level"] in ("high", "critical") and existing.status == "active":
            existing.status = "warning"

        elif score_data["risk_level"] in ("low", "medium") and existing.status == "warning":
            existing.status = "active"

        existing.updated_at = now
        db.add(existing)
    else:
        new_score = CreditScore(
            company_id=company_id,
            customer_id=customer_id,
            score=score_data["score"],
            risk_level=score_data["risk_level"],
            payment_history_score=score_data["payment_history_score"],
            antiquity_score=score_data["antiquity_score"],
            frequency_score=score_data["frequency_score"],
            avg_amount_score=score_data["avg_amount_score"],
            industry_score=score_data["industry_score"],
            credit_utilization_score=score_data["credit_utilization_score"],
            suggested_credit_limit=score_data["suggested_credit_limit"],
            current_credit_limit=score_data["suggested_credit_limit"],
            used_credit=data["used_credit"],
            available_credit=data["available_credit"],
            on_time_payment_rate=data["on_time_payment_rate"],
            average_payment_delay_days=data["average_payment_delay_days"],
            total_overdue_days=data["total_overdue_days"],
            days_since_last_purchase=data["days_since_last_purchase"],
            total_purchases=data["total_sales_count"],
            total_purchase_amount=data["total_sales_amount"],
            months_as_customer=data["months_as_customer"],
            times_overdue=data["times_overdue"],
            status="warning" if score_data["risk_level"] in ("high", "critical") else "active",
            is_auto_blocked=score_data["should_block"],
            block_reason=score_data["block_reason"] if score_data["should_block"] else None,
            last_evaluation_date=now,
        )
        db.add(new_score)
        limit_changed = True
        existing = new_score

    saved_alerts = []
    for alert_data in alerts_data:
        alert = RiskAlert(
            company_id=company_id,
            customer_id=customer_id,
            alert_type=alert_data["alert_type"],
            severity=alert_data["severity"],
            previous_score=alert_data["previous_score"],
            new_score=alert_data["new_score"],
            message=alert_data["message"],
        )
        db.add(alert)
        saved_alerts.append(alert_data)

    if score_data["should_block"]:
        if not any(a["alert_type"] == "payment_default" for a in alerts_data):
            alert = RiskAlert(
                company_id=company_id,
                customer_id=customer_id,
                alert_type="payment_default",
                severity="critical",
                previous_score=old_score if existing else 500,
                new_score=score_data["score"],
                message=f"Bloqueo automático: puntaje crítico ({score_data['score']}) o mora superior a 60 días",
            )
            db.add(alert)
            saved_alerts.append({
                "alert_type": "payment_default",
                "severity": "critical",
                "previous_score": old_score if existing else 500,
                "new_score": score_data["score"],
                "message": f"Bloqueo automático: puntaje crítico ({score_data['score']}) o mora superior a 60 días",
            })

    next_eval = now + timedelta(days=30)
    if existing:
        existing.next_evaluation_date = next_eval
        db.add(existing)

    await db.commit()
    await db.refresh(existing)

    return {
        "credit_score": {
            "id": str(existing.id),
            "company_id": company_id,
            "customer_id": customer_id,
            "score": existing.score,
            "risk_level": existing.risk_level,
            "payment_history_score": existing.payment_history_score,
            "antiquity_score": existing.antiquity_score,
            "frequency_score": existing.frequency_score,
            "avg_amount_score": existing.avg_amount_score,
            "industry_score": existing.industry_score,
            "credit_utilization_score": existing.credit_utilization_score,
            "suggested_credit_limit": float(existing.suggested_credit_limit),
            "current_credit_limit": float(existing.current_credit_limit),
            "used_credit": float(existing.used_credit),
            "available_credit": float(existing.available_credit),
            "on_time_payment_rate": existing.on_time_payment_rate,
            "average_payment_delay_days": existing.average_payment_delay_days,
            "total_overdue_days": existing.total_overdue_days,
            "days_since_last_purchase": existing.days_since_last_purchase,
            "total_purchases": existing.total_purchases,
            "total_purchase_amount": float(existing.total_purchase_amount),
            "months_as_customer": existing.months_as_customer,
            "times_overdue": existing.times_overdue,
            "status": existing.status,
            "is_auto_blocked": existing.is_auto_blocked,
            "block_reason": existing.block_reason,
            "last_evaluation_date": existing.last_evaluation_date,
            "next_evaluation_date": existing.next_evaluation_date,
            "created_at": existing.created_at,
            "updated_at": existing.updated_at,
        },
        "alerts_generated": saved_alerts,
        "limit_changed": limit_changed,
    }


async def get_credit_score(db: AsyncSession, company_id: str, customer_id: str) -> Optional[dict]:
    result = await db.execute(
        select(CreditScore).where(
            CreditScore.company_id == company_id,
            CreditScore.customer_id == customer_id,
        )
    )
    cs = result.scalar_one_or_none()
    if not cs:
        return None
    return {
        "id": str(cs.id),
        "company_id": str(cs.company_id),
        "customer_id": str(cs.customer_id),
        "score": cs.score,
        "risk_level": cs.risk_level,
        "payment_history_score": cs.payment_history_score,
        "antiquity_score": cs.antiquity_score,
        "frequency_score": cs.frequency_score,
        "avg_amount_score": cs.avg_amount_score,
        "industry_score": cs.industry_score,
        "credit_utilization_score": cs.credit_utilization_score,
        "suggested_credit_limit": float(cs.suggested_credit_limit),
        "current_credit_limit": float(cs.current_credit_limit),
        "used_credit": float(cs.used_credit),
        "available_credit": float(cs.available_credit),
        "on_time_payment_rate": cs.on_time_payment_rate,
        "average_payment_delay_days": cs.average_payment_delay_days,
        "total_overdue_days": cs.total_overdue_days,
        "days_since_last_purchase": cs.days_since_last_purchase,
        "total_purchases": cs.total_purchases,
        "total_purchase_amount": float(cs.total_purchase_amount),
        "months_as_customer": cs.months_as_customer,
        "times_overdue": cs.times_overdue,
        "status": cs.status,
        "is_auto_blocked": cs.is_auto_blocked,
        "block_reason": cs.block_reason,
        "last_evaluation_date": cs.last_evaluation_date,
        "next_evaluation_date": cs.next_evaluation_date,
        "created_at": cs.created_at,
        "updated_at": cs.updated_at,
    }


async def list_credit_scores(
    db: AsyncSession, company_id: str,
    risk_level: Optional[str] = None, status: Optional[str] = None,
    limit: int = 100, offset: int = 0,
) -> list[dict]:
    conditions = [CreditScore.company_id == company_id]
    if risk_level:
        conditions.append(CreditScore.risk_level == risk_level)
    if status:
        conditions.append(CreditScore.status == status)

    result = await db.execute(
        select(CreditScore).where(and_(*conditions))
        .order_by(desc(CreditScore.score))
        .limit(limit).offset(offset)
    )
    scores = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "customer_id": str(s.customer_id),
            "score": s.score,
            "risk_level": s.risk_level,
            "suggested_credit_limit": float(s.suggested_credit_limit),
            "current_credit_limit": float(s.current_credit_limit),
            "used_credit": float(s.used_credit),
            "status": s.status,
            "is_auto_blocked": s.is_auto_blocked,
            "last_evaluation_date": s.last_evaluation_date,
            "on_time_payment_rate": s.on_time_payment_rate,
            "total_overdue_days": s.total_overdue_days,
        }
        for s in scores
    ]


async def get_summary(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(CreditScore).where(CreditScore.company_id == company_id)
    )
    scores = result.scalars().all()

    total = len(scores)
    if total == 0:
        return {
            "total_customers": 0,
            "average_score": 0,
            "risk_distribution": {},
            "total_exposure": 0,
            "total_suggested_limit": 0,
            "blocked_customers": 0,
            "warning_customers": 0,
            "critical_customers": 0,
        }

    risk_dist = defaultdict(int)
    total_exposure = 0
    total_suggested = 0
    blocked = 0
    warning = 0
    critical = 0
    score_sum = 0

    for s in scores:
        risk_dist[s.risk_level] += 1
        total_exposure += float(s.used_credit)
        total_suggested += float(s.suggested_credit_limit)
        score_sum += s.score
        if s.is_auto_blocked or s.status == "blocked":
            blocked += 1
        if s.status == "warning":
            warning += 1
        if s.risk_level == "critical":
            critical += 1

    return {
        "total_customers": total,
        "average_score": round(score_sum / total, 1),
        "risk_distribution": dict(risk_dist),
        "total_exposure": total_exposure,
        "total_suggested_limit": total_suggested,
        "blocked_customers": blocked,
        "warning_customers": warning,
        "critical_customers": critical,
    }


async def get_alerts(
    db: AsyncSession, company_id: str,
    alert_type: Optional[str] = None, severity: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    conditions = [RiskAlert.company_id == company_id]
    if alert_type:
        conditions.append(RiskAlert.alert_type == alert_type)
    if severity:
        conditions.append(RiskAlert.severity == severity)

    result = await db.execute(
        select(RiskAlert).where(and_(*conditions))
        .order_by(desc(RiskAlert.created_at))
        .limit(limit).offset(offset)
    )
    alerts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "company_id": str(a.company_id),
            "customer_id": str(a.customer_id),
            "alert_type": a.alert_type,
            "severity": a.severity,
            "previous_score": a.previous_score,
            "new_score": a.new_score,
            "message": a.message,
            "is_read": a.is_read,
            "resolved_at": a.resolved_at,
            "created_at": a.created_at,
        }
        for a in alerts
    ]


async def resolve_alert(db: AsyncSession, company_id: str, alert_id: str) -> Optional[dict]:
    result = await db.execute(
        select(RiskAlert).where(
            RiskAlert.id == alert_id,
            RiskAlert.company_id == company_id,
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        return None
    alert.is_read = True
    alert.resolved_at = datetime.now(timezone.utc)
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return {"status": "resolved"}


async def bulk_resolve_alerts(db: AsyncSession, company_id: str, alert_ids: list[str]) -> dict:
    now = datetime.now(timezone.utc)
    for aid in alert_ids:
        result = await db.execute(
            select(RiskAlert).where(
                RiskAlert.id == aid,
                RiskAlert.company_id == company_id,
            )
        )
        alert = result.scalar_one_or_none()
        if alert:
            alert.is_read = True
            alert.resolved_at = now
            db.add(alert)
    await db.commit()
    return {"resolved": len(alert_ids)}


async def update_credit_limit(db: AsyncSession, company_id: str, req: UpdateLimitRequest, user_id: str) -> Optional[dict]:
    result = await db.execute(
        select(CreditScore).where(
            CreditScore.company_id == company_id,
            CreditScore.customer_id == req.customer_id,
        )
    )
    cs = result.scalar_one_or_none()
    if not cs:
        return None

    old_limit = float(cs.current_credit_limit)
    cs.current_credit_limit = req.new_limit
    cs.available_credit = max(0, float(req.new_limit) - float(cs.used_credit))
    cs.updated_at = datetime.now(timezone.utc)
    db.add(cs)

    event = CreditEvent(
        company_id=company_id,
        customer_id=str(req.customer_id),
        event_type="limit_change",
        previous_limit=old_limit,
        new_limit=float(req.new_limit),
        reason=req.reason,
        performed_by=user_id,
    )
    db.add(event)
    await db.commit()
    await db.refresh(cs)
    return {"status": "updated", "new_limit": float(cs.current_credit_limit)}


async def block_customer(db: AsyncSession, company_id: str, customer_id: str, reason: str, user_id: str) -> Optional[dict]:
    result = await db.execute(
        select(CreditScore).where(
            CreditScore.company_id == company_id,
            CreditScore.customer_id == customer_id,
        )
    )
    cs = result.scalar_one_or_none()
    if not cs:
        return None

    cs.is_auto_blocked = True
    cs.status = "blocked"
    cs.block_reason = reason
    cs.updated_at = datetime.now(timezone.utc)
    db.add(cs)

    event = CreditEvent(
        company_id=company_id,
        customer_id=customer_id,
        event_type="block",
        reason=reason,
        performed_by=user_id,
    )
    db.add(event)
    await db.commit()
    return {"status": "blocked"}


async def unblock_customer(db: AsyncSession, company_id: str, customer_id: str, reason: str, user_id: str) -> Optional[dict]:
    result = await db.execute(
        select(CreditScore).where(
            CreditScore.company_id == company_id,
            CreditScore.customer_id == customer_id,
        )
    )
    cs = result.scalar_one_or_none()
    if not cs:
        return None

    cs.is_auto_blocked = False
    cs.status = "active"
    cs.block_reason = None
    cs.updated_at = datetime.now(timezone.utc)
    db.add(cs)

    event = CreditEvent(
        company_id=company_id,
        customer_id=customer_id,
        event_type="unblock",
        reason=reason,
        performed_by=user_id,
    )
    db.add(event)
    await db.commit()
    return {"status": "unblocked"}


async def get_events(
    db: AsyncSession, company_id: str,
    customer_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    conditions = [CreditEvent.company_id == company_id]
    if customer_id:
        conditions.append(CreditEvent.customer_id == customer_id)
    if event_type:
        conditions.append(CreditEvent.event_type == event_type)

    result = await db.execute(
        select(CreditEvent).where(and_(*conditions))
        .order_by(desc(CreditEvent.created_at))
        .limit(limit).offset(offset)
    )
    events = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "company_id": str(e.company_id),
            "customer_id": str(e.customer_id),
            "event_type": e.event_type,
            "previous_limit": float(e.previous_limit) if e.previous_limit else None,
            "new_limit": float(e.new_limit) if e.new_limit else None,
            "previous_score": e.previous_score,
            "new_score": e.new_score,
            "reason": e.reason,
            "performed_by": str(e.performed_by) if e.performed_by else None,
            "created_at": e.created_at,
        }
        for e in events
    ]


async def bulk_evaluate(db: AsyncSession, company_id: str) -> BulkEvaluateResponse:
    result = await db.execute(
        select(Partner.id).where(Partner.company_id == company_id, Partner.activo == True)
    )
    customer_ids = [r[0] for r in result.all()]

    evaluated = 0
    alerts_generated = 0
    blocked = 0

    for cid in customer_ids:
        try:
            res = await evaluate_customer(db, company_id, str(cid))
            if res:
                evaluated += 1
                alerts_generated += len(res["alerts_generated"])
                if res["credit_score"]["is_auto_blocked"]:
                    blocked += 1
        except:
            pass

    return BulkEvaluateResponse(
        evaluated=evaluated,
        alerts_generated=alerts_generated,
        blocked_customers=blocked,
    )


async def get_portfolio_dashboard(db: AsyncSession, company_id: str) -> dict:
    summary = await get_summary(db, company_id)

    result = await db.execute(
        select(CreditScore).where(CreditScore.company_id == company_id)
        .order_by(desc(CreditScore.used_credit)).limit(20)
    )
    top_exposure = result.scalars().all()
    risk_by_customer = [
        {
            "customer_id": str(s.customer_id),
            "score": s.score,
            "risk_level": s.risk_level,
            "used_credit": float(s.used_credit),
            "limit": float(s.current_credit_limit),
            "status": s.status,
        }
        for s in top_exposure
    ]

    concentration = [
        {"risk_level": level, "count": count, "exposure": 0}
        for level, count in summary["risk_distribution"].items()
    ]

    result = await db.execute(
        select(RiskAlert).where(
            RiskAlert.company_id == company_id,
            RiskAlert.is_read == False,
        ).order_by(desc(RiskAlert.created_at)).limit(20)
    )
    recent_alerts_raw = result.scalars().all()
    recent_alerts = [
        {
            "id": str(a.id),
            "customer_id": str(a.customer_id),
            "alert_type": a.alert_type,
            "severity": a.severity,
            "message": a.message,
            "created_at": a.created_at,
        }
        for a in recent_alerts_raw
    ]

    return {
        "summary": summary,
        "risk_by_customer": risk_by_customer,
        "concentration": concentration,
        "recent_alerts": recent_alerts,
        "monthly_trend": [],
    }
