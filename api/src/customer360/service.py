from sqlalchemy import select, func as sa_func, and_, desc, delete, extract, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid, math, random

from api.src.customer360.models import (
    CustomerBasketAnalysis, CustomerCategoryPenetration,
    CustomerChurnPrediction, CustomerLifecycleStage, RecoveryCampaign,
)
from api.src.customer360.schemas import (
    BasketAnalysisResponse, CategoryPenetrationResponse,
    ChurnPredictionResponse, LifecycleStageResponse,
    RecoveryCampaignResponse, Customer360DashboardResponse,
)
from api.src.products.models import Product, Category
from api.src.sales.models import Sale, SaleItem


# ── Basket Analysis ──────────────────────────────────────────────

async def compute_basket_analysis(db: AsyncSession, company_id: str, customer_id: str) -> dict:
    cut_30d = datetime.now(timezone.utc) - timedelta(days=30)
    cut_90d = datetime.now(timezone.utc) - timedelta(days=90)

    def _fetch_sales(days, cut):
        return db.execute(
            select(Sale).where(
                Sale.company_id == company_id,
                Sale.customer_id == customer_id,
                Sale.fecha >= cut,
                Sale.estado.in_(["completada", "entregada", "confirmada"]),
            )
        )

    r30 = await _fetch_sales(30, cut_30d)
    sales_30d = r30.scalars().all()
    r90 = await _fetch_sales(90, cut_90d)
    sales_90d = r90.scalars().all()

    total_30d = sum(float(s.total or 0) for s in sales_30d)
    total_90d = sum(float(s.total or 0) for s in sales_90d)
    tx_30d = len(sales_30d)
    tx_90d = len(sales_90d)
    avg_ticket = round(total_90d / max(1, tx_90d))
    avg_items = 0
    pct_promo = 0
    margin_avg = 0
    preferred_dept = None
    preferred_day = None
    preferred_hour = None
    avg_days = 0

    if tx_90d >= 2:
        dates = sorted(s.fecha or s.created_at for s in sales_90d)
        gaps = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
        avg_days = round(sum(gaps) / len(gaps), 1)

    dept_count = {}
    for s in sales_90d:
        day = s.fecha.strftime("%A") if s.fecha else None
        if day:
            dept_count[day] = dept_count.get(day, 0) + 1
        hour = s.fecha.hour if s.fecha else None
        if hour is not None:
            if "hours" not in locals():
                hours = {}
            hours[hour] = hours.get(hour, 0) + 1

    if dept_count:
        preferred_day = max(dept_count, key=dept_count.get)
    if "hours" in dir() and hours:
        preferred_hour = max(hours, key=hours.get)

    total_items_90d = 0
    promo_items_90d = 0
    for s in sales_90d:
        r = await db.execute(select(SaleItem).where(SaleItem.sale_id == s.id))
        items = r.scalars().all()
        total_items_90d += sum(float(i.cantidad or 0) for i in items)
        if items:
            avg_items += sum(float(i.cantidad or 0) for i in items)

    avg_items = round(avg_items / max(1, tx_90d), 1)

    existing = (await db.execute(
        select(CustomerBasketAnalysis).where(
            CustomerBasketAnalysis.company_id == company_id,
            CustomerBasketAnalysis.customer_id == customer_id,
        )
    )).scalar_one_or_none()

    data = {
        "company_id": uuid.UUID(company_id),
        "customer_id": uuid.UUID(customer_id),
        "avg_ticket": avg_ticket,
        "avg_items_per_ticket": avg_items,
        "total_spent_30d": total_30d,
        "total_spent_90d": total_90d,
        "total_transactions_30d": tx_30d,
        "total_transactions_90d": tx_90d,
        "pct_on_promotion": pct_promo,
        "margin_avg_pct": margin_avg,
        "preferred_department": preferred_dept,
        "preferred_day": preferred_day,
        "preferred_hour": preferred_hour,
        "avg_days_between_visits": avg_days,
        "data_json": None,
    }

    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        existing.computed_at = datetime.now(timezone.utc)
        ba = existing
    else:
        ba = CustomerBasketAnalysis(**data)
        db.add(ba)

    await db.flush()
    return BasketAnalysisResponse.model_validate(ba).model_dump()


async def get_basket_analysis(db: AsyncSession, company_id: str, customer_id: str) -> Optional[dict]:
    r = await db.execute(
        select(CustomerBasketAnalysis).where(
            CustomerBasketAnalysis.company_id == company_id,
            CustomerBasketAnalysis.customer_id == customer_id,
        )
    )
    ba = r.scalar_one_or_none()
    if not ba:
        return None
    return BasketAnalysisResponse.model_validate(ba).model_dump()


# ── Category Penetration ─────────────────────────────────────────

async def compute_penetration(db: AsyncSession, company_id: str, customer_id: str) -> list[dict]:
    cut_90d = datetime.now(timezone.utc) - timedelta(days=90)

    cats = (await db.execute(
        select(Category).where(Category.company_id == company_id, Category.activo == True)
    )).scalars().all()

    total_spent = 0
    r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Sale.total), 0)).where(
            Sale.company_id == company_id, Sale.customer_id == customer_id,
            Sale.fecha >= cut_90d, Sale.estado.in_(["completada", "entregada", "confirmada"]),
        )
    )
    total_spent = float(r.scalar() or 0)

    results = []
    for cat in cats:
        r = await db.execute(
            select(Sale).where(
                Sale.company_id == company_id, Sale.customer_id == customer_id,
                Sale.fecha >= cut_90d, Sale.estado.in_(["completada", "entregada", "confirmada"]),
            )
        )
        sales = r.scalars().all()
        cat_spent = 0
        cat_tx = 0
        for s in sales:
            items_r = await db.execute(
                select(SaleItem).where(SaleItem.sale_id == s.id)
            )
            items = items_r.scalars().all()
            for i in items:
                pr = await db.execute(select(Product).where(Product.id == i.product_id))
                p = pr.scalar_one_or_none()
                if p and p.categoria_id == cat.id:
                    cat_spent += float(i.subtotal or 0)
                    cat_tx += 1
                    break

        penetration = round((cat_spent / max(1, total_spent)) * 100, 1) if total_spent > 0 else 0

        existing = (await db.execute(
            select(CustomerCategoryPenetration).where(
                CustomerCategoryPenetration.company_id == company_id,
                CustomerCategoryPenetration.customer_id == customer_id,
                CustomerCategoryPenetration.category_id == cat.id,
            )
        )).scalar_one_or_none()

        data = {
            "company_id": uuid.UUID(company_id),
            "customer_id": uuid.UUID(customer_id),
            "category_id": cat.id,
            "category_name": cat.nombre,
            "total_spent": round(cat_spent),
            "total_transactions": cat_tx,
            "penetration_pct": penetration,
            "share_of_wallet_pct": penetration,
            "last_purchase_at": max((s.fecha for s in sales if s.fecha), default=None),
            "cross_sell_score": round(penetration * random.uniform(0.5, 1.5), 1) if cat_tx > 0 else 0,
        }

        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            existing.computed_at = datetime.now(timezone.utc)
        else:
            cp = CustomerCategoryPenetration(**data)
            db.add(cp)

    await db.flush()

    results_r = await db.execute(
        select(CustomerCategoryPenetration).where(
            CustomerCategoryPenetration.company_id == company_id,
            CustomerCategoryPenetration.customer_id == customer_id,
        ).order_by(desc(CustomerCategoryPenetration.penetration_pct))
    )
    return [CategoryPenetrationResponse.model_validate(r).model_dump() for r in results_r.scalars().all()]


async def get_penetration(db: AsyncSession, company_id: str, customer_id: str) -> list[dict]:
    r = await db.execute(
        select(CustomerCategoryPenetration).where(
            CustomerCategoryPenetration.company_id == company_id,
            CustomerCategoryPenetration.customer_id == customer_id,
        ).order_by(desc(CustomerCategoryPenetration.penetration_pct))
    )
    return [CategoryPenetrationResponse.model_validate(c).model_dump() for c in r.scalars().all()]


# ── Churn Prediction ─────────────────────────────────────────────

async def predict_churn(db: AsyncSession, company_id: str, customer_id: str) -> dict:
    cut_90d = datetime.now(timezone.utc) - timedelta(days=90)
    cut_180d = datetime.now(timezone.utc) - timedelta(days=180)

    r = await db.execute(
        select(Sale).where(
            Sale.company_id == company_id, Sale.customer_id == customer_id,
            Sale.fecha >= cut_180d, Sale.estado.in_(["completada", "entregada", "confirmada"]),
        ).order_by(Sale.fecha)
    )
    sales_180d = r.scalars().all()

    if not sales_180d:
        data = {
            "churn_score": 0, "churn_risk": "unknown", "days_since_last_purchase": 999,
            "avg_frequency_days": 0, "avg_ticket_change_pct": 0, "frequency_change_pct": 0,
            "category_attrition_score": 0, "factors_json": {"reason": "No hay historial de compras"},
            "is_recovery_triggered": False,
        }
        return _upsert_churn(db, company_id, customer_id, data)

    last = max(s.fecha or s.created_at for s in sales_180d)
    days_since = (datetime.now(timezone.utc) - last).days

    dates = sorted(s.fecha or s.created_at for s in sales_180d)
    gaps = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
    avg_freq = round(sum(gaps) / len(gaps), 1) if gaps else 30

    recent_90d = [s for s in sales_180d if (s.fecha or s.created_at) >= cut_90d]
    old_90d = [s for s in sales_180d if (s.fecha or s.created_at) < cut_90d]

    avg_ticket_recent = sum(float(s.total or 0) for s in recent_90d) / max(1, len(recent_90d))
    avg_ticket_old = sum(float(s.total or 0) for s in old_90d) / max(1, len(old_90d))
    ticket_change = ((avg_ticket_recent - avg_ticket_old) / max(1, avg_ticket_old)) * 100

    freq_recent = len(recent_90d) / 3
    freq_old = len(old_90d) / 3
    freq_change = ((freq_recent - freq_old) / max(1, freq_old)) * 100 if freq_old > 0 else 0

    cat_attrition = 0
    if old_90d:
        old_cats = set()
        for s in old_90d:
            items_r = await db.execute(select(SaleItem).where(SaleItem.sale_id == s.id))
            for i in items_r.scalars().all():
                pr = await db.execute(select(Product).where(Product.id == i.product_id))
                p = pr.scalar_one_or_none()
                if p and p.categoria_id:
                    old_cats.add(str(p.categoria_id))
        recent_cats = set()
        for s in recent_90d:
            items_r = await db.execute(select(SaleItem).where(SaleItem.sale_id == s.id))
            for i in items_r.scalars().all():
                pr = await db.execute(select(Product).where(Product.id == i.product_id))
                p = pr.scalar_one_or_none()
                if p and p.categoria_id:
                    recent_cats.add(str(p.categoria_id))
        lost = old_cats - recent_cats
        cat_attrition = round((len(lost) / max(1, len(old_cats))) * 100, 1) if old_cats else 0

    score = 0
    if avg_freq > 0:
        score += min(25, (days_since / avg_freq) * 15)
    else:
        score += min(25, days_since * 0.5)
    if ticket_change < 0:
        score += min(25, abs(ticket_change) * 0.5)
    if freq_change < 0:
        score += min(25, abs(freq_change) * 0.3)
    score += min(25, cat_attrition * 0.5)
    score = round(min(100, max(0, score)), 1)

    risk = "low"
    if score >= 70:
        risk = "critical"
    elif score >= 50:
        risk = "high"
    elif score >= 30:
        risk = "medium"

    factors = {
        "days_since_last_purchase": days_since,
        "avg_frequency_days": avg_freq,
        "ticket_change_pct": round(ticket_change, 1),
        "frequency_change_pct": round(freq_change, 1),
        "category_attrition_pct": cat_attrition,
        "score_breakdown": {
            "recency": round(min(25, (days_since / max(1, avg_freq)) * 15), 1),
            "ticket_trend": round(min(25, abs(ticket_change) * 0.5 if ticket_change < 0 else 0), 1),
            "frequency_trend": round(min(25, abs(freq_change) * 0.3 if freq_change < 0 else 0), 1),
            "category_attrition": round(min(25, cat_attrition * 0.5), 1),
        },
    }

    data = {
        "churn_score": score,
        "churn_risk": risk,
        "days_since_last_purchase": days_since,
        "avg_frequency_days": avg_freq,
        "avg_ticket_change_pct": round(ticket_change, 1),
        "frequency_change_pct": round(freq_change, 1),
        "category_attrition_score": cat_attrition,
        "factors_json": factors,
        "is_recovery_triggered": False,
    }

    pred = _upsert_churn(db, company_id, customer_id, data)
    await db.flush()

    if score >= 70:
        await _trigger_recovery(db, company_id, customer_id, pred["id"], score)

    return pred


def _upsert_churn(db, company_id, customer_id, data):
    existing = db.execute(
        select(CustomerChurnPrediction).where(
            CustomerChurnPrediction.company_id == company_id,
            CustomerChurnPrediction.customer_id == customer_id,
        )
    ).scalar_one_or_none()

    d = {
        "company_id": uuid.UUID(company_id),
        "customer_id": uuid.UUID(customer_id),
        **data,
        "factors_json": data.get("factors_json"),
    }
    if existing:
        for k, v in d.items():
            setattr(existing, k, v)
        existing.computed_at = datetime.now(timezone.utc)
        pred = existing
    else:
        pred = CustomerChurnPrediction(**d)
        db.add(pred)

    return {"id": str(pred.id), **data}


async def get_churn_prediction(db: AsyncSession, company_id: str, customer_id: str) -> Optional[dict]:
    r = await db.execute(
        select(CustomerChurnPrediction).where(
            CustomerChurnPrediction.company_id == company_id,
            CustomerChurnPrediction.customer_id == customer_id,
        )
    )
    p = r.scalar_one_or_none()
    if not p:
        return None
    return ChurnPredictionResponse.model_validate(p).model_dump()


async def list_high_risk_churn(db: AsyncSession, company_id: str, min_score: float = 50, limit: int = 50) -> list[dict]:
    r = await db.execute(
        select(CustomerChurnPrediction).where(
            CustomerChurnPrediction.company_id == company_id,
            CustomerChurnPrediction.churn_score >= min_score,
        ).order_by(desc(CustomerChurnPrediction.churn_score)).limit(limit)
    )
    return [ChurnPredictionResponse.model_validate(p).model_dump() for p in r.scalars().all()]


# ── Recovery Campaign ────────────────────────────────────────────

async def _trigger_recovery(db: AsyncSession, company_id: str, customer_id: str, pred_id: str, score: float):
    existing = (await db.execute(
        select(RecoveryCampaign).where(
            RecoveryCampaign.company_id == company_id,
            RecoveryCampaign.customer_id == customer_id,
            RecoveryCampaign.status.in_(["pending", "notified"]),
        )
    )).scalar_one_or_none()

    if existing:
        return

    offer_value = max(5000, int(score * 500))

    campaign = RecoveryCampaign(
        company_id=uuid.UUID(company_id),
        customer_id=uuid.UUID(customer_id),
        churn_prediction_id=uuid.UUID(pred_id),
        trigger_score=score,
        offer_type="descuento_recuperacion",
        offer_value=offer_value,
        offer_config={"tipo": "porcentaje", "valor": 15, "monto_maximo": offer_value, "valido_dias": 7},
        channel="auto",
        status="pending",
    )
    db.add(campaign)

    pred = await db.execute(
        select(CustomerChurnPrediction).where(
            CustomerChurnPrediction.id == uuid.UUID(pred_id)
        )
    )
    p = pred.scalar_one_or_none()
    if p:
        p.is_recovery_triggered = True


async def list_recovery_campaigns(
    db: AsyncSession, company_id: str,
    status: Optional[str] = None, limit: int = 50,
) -> list[dict]:
    q = select(RecoveryCampaign).where(RecoveryCampaign.company_id == company_id)
    if status:
        q = q.where(RecoveryCampaign.status == status)
    q = q.order_by(desc(RecoveryCampaign.created_at)).limit(limit)
    r = await db.execute(q)
    return [RecoveryCampaignResponse.model_validate(c).model_dump() for c in r.scalars().all()]


async def notify_recovery(db: AsyncSession, company_id: str, campaign_id: str) -> dict:
    r = await db.execute(
        select(RecoveryCampaign).where(
            RecoveryCampaign.id == campaign_id,
            RecoveryCampaign.company_id == company_id,
        )
    )
    c = r.scalar_one_or_none()
    if not c:
        raise ValueError("Campaña no encontrada")
    c.status = "notified"
    c.notified_at = datetime.now(timezone.utc)
    await db.flush()
    return RecoveryCampaignResponse.model_validate(c).model_dump()


async def redeem_recovery(db: AsyncSession, company_id: str, campaign_id: str, sale_id: str, amount: float) -> dict:
    r = await db.execute(
        select(RecoveryCampaign).where(
            RecoveryCampaign.id == campaign_id,
            RecoveryCampaign.company_id == company_id,
        )
    )
    c = r.scalar_one_or_none()
    if not c:
        raise ValueError("Campaña no encontrada")
    c.status = "redeemed"
    c.redeemed_at = datetime.now(timezone.utc)
    c.recovery_sale_id = uuid.UUID(sale_id)
    c.recovery_amount = amount
    await db.flush()
    return RecoveryCampaignResponse.model_validate(c).model_dump()


# ── Lifecycle Stage ──────────────────────────────────────────────

STAGE_ORDER = ["new", "active", "regular", "loyal", "at_risk", "lost"]

async def compute_lifecycle(db: AsyncSession, company_id: str, customer_id: str) -> dict:
    cut_90d = datetime.now(timezone.utc) - timedelta(days=90)
    cut_180d = datetime.now(timezone.utc) - timedelta(days=180)
    cut_365d = datetime.now(timezone.utc) - timedelta(days=365)

    r = await db.execute(
        select(Sale).where(
            Sale.company_id == company_id, Sale.customer_id == customer_id,
            Sale.estado.in_(["completada", "entregada", "confirmada"]),
        ).order_by(Sale.fecha)
    )
    sales = r.scalars().all()

    if not sales:
        return await _upsert_lifecycle(db, company_id, customer_id, {
            "stage": "new",
            "days_in_stage": 0,
            "total_tenure_days": 0,
            "total_lifetime_value": 0,
            "predicted_ltv": 0,
            "ltv_trend": "stable",
            "segment_tags": [],
        })

    first = min(s.fecha or s.created_at for s in sales)
    last = max(s.fecha or s.created_at for s in sales)
    tenure = (datetime.now(timezone.utc) - first).days
    total_ltv = sum(float(s.total or 0) for s in sales)
    days_since_last = (datetime.now(timezone.utc) - last).days

    recent_90d_count = sum(1 for s in sales if (s.fecha or s.created_at) >= cut_90d)
    recent_180d_count = sum(1 for s in sales if (s.fecha or s.created_at) >= cut_180d)
    total_365d = sum(float(s.total or 0) for s in sales if (s.fecha or s.created_at) >= cut_365d)

    if days_since_last > 90:
        stage = "lost"
    elif days_since_last > 45:
        stage = "at_risk"
    elif tenure < 30:
        stage = "new"
    elif recent_90d_count < 3:
        stage = "active"
    elif recent_90d_count < 8:
        stage = "regular"
    else:
        stage = "loyal"

    predicted = total_ltv / max(1, tenure // 30) * 12

    trend = "stable"
    if total_365d > 0 and total_ltv > 0:
        recent_total = sum(float(s.total or 0) for s in sales if (s.fecha or s.created_at) >= cut_90d)
        ratio = recent_total / (total_365d / 4)
        if ratio < 0.5:
            trend = "declining"
        elif ratio > 1.5:
            trend = "growing"

    tags = []
    if stage == "loyal":
        tags.append("high_value")
    if total_ltv > 0:
        avg_ticket = total_ltv / len(sales)
        if avg_ticket > 100000:
            tags.append("big_spender")
    if days_since_last > 60:
        tags.append("needs_attention")

    data = {
        "stage": stage,
        "days_in_stage": days_since_last,
        "total_tenure_days": tenure,
        "total_lifetime_value": round(total_ltv),
        "predicted_ltv": round(predicted),
        "ltv_trend": trend,
        "segment_tags": tags,
    }

    return await _upsert_lifecycle(db, company_id, customer_id, data)


async def _upsert_lifecycle(db, company_id, customer_id, data):
    existing = db.execute(
        select(CustomerLifecycleStage).where(
            CustomerLifecycleStage.company_id == company_id,
            CustomerLifecycleStage.customer_id == customer_id,
        )
    ).scalar_one_or_none()

    d = {
        "company_id": uuid.UUID(company_id),
        "customer_id": uuid.UUID(customer_id),
        **data,
        "segment_tags": data.get("segment_tags"),
    }
    if existing:
        for k, v in d.items():
            setattr(existing, k, v)
        existing.computed_at = datetime.now(timezone.utc)
        ls = existing
    else:
        ls = CustomerLifecycleStage(**d)
        db.add(ls)
    await db.flush()
    return LifecycleStageResponse.model_validate(ls).model_dump()


async def get_lifecycle(db: AsyncSession, company_id: str, customer_id: str) -> Optional[dict]:
    r = await db.execute(
        select(CustomerLifecycleStage).where(
            CustomerLifecycleStage.company_id == company_id,
            CustomerLifecycleStage.customer_id == customer_id,
        )
    )
    ls = r.scalar_one_or_none()
    if not ls:
        return None
    return LifecycleStageResponse.model_validate(ls).model_dump()


# ── Dashboard ─────────────────────────────────────────────────────

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    cut_30d = datetime.now(timezone.utc) - timedelta(days=30)
    cut_90d = datetime.now(timezone.utc) - timedelta(days=90)

    from api.src.customers.models import Partner

    r = await db.execute(
        select(sa_func.count()).where(Partner.company_id == company_id)
    )
    total_customers = r.scalar() or 0

    r = await db.execute(
        select(sa_func.count(sa_func.distinct(Sale.customer_id))).where(
            Sale.company_id == company_id, Sale.fecha >= cut_30d,
        )
    )
    active_30d = r.scalar() or 0

    r = await db.execute(
        select(sa_func.count(sa_func.distinct(Sale.customer_id))).where(
            Sale.company_id == company_id, Sale.fecha >= cut_30d, Sale.fecha < datetime.now(timezone.utc),
        )
    )
    new_30d = 0
    r = await db.execute(
        select(Partner).where(Partner.company_id == company_id).order_by(Partner.created_at.desc()).limit(0)
    )
    new_30d = (await db.execute(
        select(sa_func.count()).where(
            Partner.company_id == company_id,
            Partner.created_at >= cut_30d,
        )
    )).scalar() or 0

    r = await db.execute(
        select(sa_func.count()).where(
            CustomerLifecycleStage.company_id == company_id,
            CustomerLifecycleStage.stage == "lost",
        )
    )
    lost_30d = r.scalar() or 0

    churn_rate = round((lost_30d / max(1, total_customers)) * 100, 1)

    r = await db.execute(
        select(sa_func.avg(CustomerLifecycleStage.total_lifetime_value)).where(
            CustomerLifecycleStage.company_id == company_id,
        )
    )
    avg_ltv = float(r.scalar() or 0)

    r = await db.execute(
        select(sa_func.avg(CustomerBasketAnalysis.avg_ticket)).where(
            CustomerBasketAnalysis.company_id == company_id,
        )
    )
    avg_basket = float(r.scalar() or 0)

    r = await db.execute(
        select(sa_func.avg(CustomerCategoryPenetration.penetration_pct)).where(
            CustomerCategoryPenetration.company_id == company_id,
        )
    )
    avg_penetration = float(r.scalar() or 0)

    r = await db.execute(
        select(sa_func.count()).where(
            CustomerChurnPrediction.company_id == company_id,
            CustomerChurnPrediction.churn_score >= 50,
        )
    )
    high_risk = r.scalar() or 0

    r = await db.execute(
        select(sa_func.count()).where(
            RecoveryCampaign.company_id == company_id,
            RecoveryCampaign.status.in_(["pending", "notified"]),
        )
    )
    active_recovery = r.scalar() or 0

    r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(RecoveryCampaign.recovery_amount), 0)).where(
            RecoveryCampaign.company_id == company_id,
            RecoveryCampaign.status == "redeemed",
        )
    )
    total_recovered = float(r.scalar() or 0)

    r = await db.execute(
        select(CustomerLifecycleStage.stage, sa_func.count()).where(
            CustomerLifecycleStage.company_id == company_id,
        ).group_by(CustomerLifecycleStage.stage)
    )
    by_stage = {row[0]: row[1] for row in r.all()}

    r = await db.execute(
        select(
            extract("month", CustomerChurnPrediction.computed_at),
            sa_func.avg(CustomerChurnPrediction.churn_score),
            sa_func.count(),
        ).where(
            CustomerChurnPrediction.company_id == company_id,
        ).group_by(extract("month", CustomerChurnPrediction.computed_at))
    )
    churn_trend = [{"month": int(row[0]), "avg_score": round(float(row[1]), 1), "count": row[2]} for row in r.all()]

    return Customer360DashboardResponse(
        total_customers=total_customers,
        active_customers_30d=active_30d,
        new_customers_30d=new_30d,
        lost_customers_30d=lost_30d,
        churn_rate_pct=churn_rate,
        avg_ltv=round(avg_ltv),
        avg_basket=round(avg_basket),
        avg_penetration_pct=avg_penetration,
        high_risk_churn=high_risk,
        active_recovery_campaigns=active_recovery,
        total_recovered_amount=round(total_recovered),
        by_stage=by_stage,
        penetration_summary={},
        churn_trend=churn_trend,
    ).model_dump()
