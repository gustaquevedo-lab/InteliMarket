import uuid
from datetime import datetime, date, timedelta
from typing import Optional, Any
from sqlalchemy import select, func as sa_func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.delivery_integrations.models import (
    DeliveryIntegration, DeliveryOrder, DeliveryMenuSync,
    DeliveryPlatformLog, DeliveryDailyStats,
)
from api.src.delivery_integrations.schemas import (
    IntegrationConfigCreate, IntegrationConfigUpdate,
    DeliveryOrderStatusUpdate,
)

PLATFORMS = ["ifood", "rappi", "pedidosya"]
ORDER_STATUSES = [
    "received", "accepted", "preparing", "ready",
    "picked_up", "in_transit", "delivered", "cancelled",
]


# ========== INTEGRATION CONFIG ==========

async def get_integrations(db: AsyncSession, company_id: str) -> list[dict]:
    r = await db.execute(
        select(DeliveryIntegration).where(
            DeliveryIntegration.company_id == company_id,
            DeliveryIntegration.is_active == True,
        ).order_by(DeliveryIntegration.platform)
    )
    configs = r.scalars().all()
    result = []
    for c in configs:
        d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
        for k in ("id", "company_id"):
            d[k] = str(d[k])
        result.append(d)
    return result


async def get_integration(db: AsyncSession, company_id: str, platform: str) -> Optional[dict]:
    r = await db.execute(
        select(DeliveryIntegration).where(
            DeliveryIntegration.company_id == company_id,
            DeliveryIntegration.platform == platform,
            DeliveryIntegration.is_active == True,
        )
    )
    c = r.scalar_one_or_none()
    if not c:
        return None
    d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    for k in ("id", "company_id"):
        d[k] = str(d[k])
    return d


async def upsert_integration(db: AsyncSession, company_id: str, platform: str, data: IntegrationConfigCreate) -> dict:
    if platform not in PLATFORMS:
        raise ValueError(f"Invalid platform: {platform}. Must be one of {PLATFORMS}")

    r = await db.execute(
        select(DeliveryIntegration).where(
            DeliveryIntegration.company_id == company_id,
            DeliveryIntegration.platform == platform,
        )
    )
    existing = r.scalar_one_or_none()

    if existing:
        for k, v in data.model_dump(exclude_unset=True).items():
            if k != "platform":
                setattr(existing, k, v)
    else:
        existing = DeliveryIntegration(company_id=company_id, platform=platform, **data.model_dump(exclude={"platform"}))
        db.add(existing)

    await db.commit()
    d = {col.name: getattr(existing, col.name) for col in existing.__table__.columns}
    for k in ("id", "company_id"):
        d[k] = str(d[k])
    return d


async def update_integration(db: AsyncSession, company_id: str, platform: str, data: IntegrationConfigUpdate) -> Optional[dict]:
    r = await db.execute(
        select(DeliveryIntegration).where(
            DeliveryIntegration.company_id == company_id,
            DeliveryIntegration.platform == platform,
            DeliveryIntegration.is_active == True,
        )
    )
    existing = r.scalar_one_or_none()
    if not existing:
        return None

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(existing, k, v)
    await db.commit()

    d = {col.name: getattr(existing, col.name) for col in existing.__table__.columns}
    for k in ("id", "company_id"):
        d[k] = str(d[k])
    return d


# ========== DELIVERY ORDERS ==========

async def list_orders(
    db: AsyncSession, company_id: str,
    platform: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    q = select(DeliveryOrder).where(DeliveryOrder.company_id == company_id)
    if platform:
        q = q.where(DeliveryOrder.platform == platform)
    if status:
        q = q.where(DeliveryOrder.status == status)
    q = q.order_by(DeliveryOrder.received_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    orders = r.scalars().all()

    result = []
    for o in orders:
        d = {col.name: getattr(o, col.name) for col in o.__table__.columns}
        for k in ("id", "company_id", "branch_id"):
            if d.get(k):
                d[k] = str(d[k])
        result.append(d)
    return result


async def get_order(db: AsyncSession, company_id: str, order_id: str) -> Optional[dict]:
    r = await db.execute(
        select(DeliveryOrder).where(
            DeliveryOrder.id == order_id,
            DeliveryOrder.company_id == company_id,
        )
    )
    o = r.scalar_one_or_none()
    if not o:
        return None
    d = {col.name: getattr(o, col.name) for col in o.__table__.columns}
    for k in ("id", "company_id", "branch_id"):
        if d.get(k):
            d[k] = str(d[k])
    return d


async def update_order_status(db: AsyncSession, company_id: str, order_id: str, data: DeliveryOrderStatusUpdate) -> Optional[dict]:
    if data.status not in ORDER_STATUSES:
        raise ValueError(f"Invalid status: {data.status}")

    r = await db.execute(
        select(DeliveryOrder).where(
            DeliveryOrder.id == order_id,
            DeliveryOrder.company_id == company_id,
        )
    )
    order = r.scalar_one_or_none()
    if not order:
        return None

    order.status = data.status
    now = datetime.utcnow()
    status_map = {
        "received": "received_at",
        "accepted": "accepted_at",
        "preparing": "preparing_at",
        "ready": "ready_at",
        "picked_up": "picked_up_at",
        "in_transit": "in_transit_at",
        "delivered": "delivered_at",
        "cancelled": "cancelled_at",
    }
    attr = status_map.get(data.status)
    if attr:
        setattr(order, attr, now)
    if data.status == "cancelled":
        order.cancel_reason = data.cancel_reason

    await db.commit()
    return await get_order(db, company_id, order_id)


# ========== WEBHOOK ==========

async def process_webhook(db: AsyncSession, company_id: str, platform: str, event: str, payload: Any) -> dict:
    if platform not in PLATFORMS:
        raise ValueError(f"Unsupported platform: {platform}")

    log_entry = DeliveryPlatformLog(
        company_id=company_id,
        platform=platform,
        event_type=event,
        direction="inbound",
        request_data=payload,
        status="success",
    )

    if event == "order.new":
        platform_order_id = None
        if isinstance(payload, dict):
            platform_order_id = payload.get("id") or payload.get("order_id") or str(uuid.uuid4())

        order = DeliveryOrder(
            company_id=company_id,
            platform=platform,
            platform_order_id=platform_order_id,
            status="received",
            customer_name=payload.get("customer", {}).get("name") if isinstance(payload, dict) else None,
            customer_phone=payload.get("customer", {}).get("phone") if isinstance(payload, dict) else None,
            customer_address=payload.get("delivery_address", {}).get("address") if isinstance(payload, dict) else None,
            total=float(payload.get("total", 0)) if isinstance(payload, dict) else 0,
            delivery_fee=float(payload.get("delivery_fee", 0)) if isinstance(payload, dict) else 0,
            discount=float(payload.get("discount", 0)) if isinstance(payload, dict) else 0,
            order_data=payload,
            items_data=payload.get("items", []) if isinstance(payload, dict) else [],
            received_at=datetime.utcnow(),
        )
        db.add(order)
        await db.flush()
        log_entry.response_data = {"order_id": str(order.id)}

    db.add(log_entry)
    await db.commit()

    return {
        "status": "ok",
        "event": event,
        "platform": platform,
        "log_id": str(log_entry.id),
    }


# ========== MENU SYNC ==========

async def trigger_menu_sync(db: AsyncSession, company_id: str, platform: str, sync_type: str = "full") -> dict:
    if platform not in PLATFORMS:
        raise ValueError(f"Invalid platform: {platform}")

    sync = DeliveryMenuSync(
        company_id=company_id,
        platform=platform,
        sync_type=sync_type,
        status="pending",
        started_at=datetime.utcnow(),
    )
    db.add(sync)
    await db.commit()

    d = {col.name: getattr(sync, col.name) for col in sync.__table__.columns}
    d["id"] = str(d["id"])
    d["company_id"] = str(d["company_id"])
    return d


async def list_menu_syncs(db: AsyncSession, company_id: str, platform: Optional[str] = None, limit: int = 20) -> list[dict]:
    q = select(DeliveryMenuSync).where(DeliveryMenuSync.company_id == company_id)
    if platform:
        q = q.where(DeliveryMenuSync.platform == platform)
    q = q.order_by(DeliveryMenuSync.created_at.desc()).limit(limit)
    r = await db.execute(q)
    syncs = r.scalars().all()

    result = []
    for s in syncs:
        d = {col.name: getattr(s, col.name) for col in s.__table__.columns}
        d["id"] = str(d["id"])
        d["company_id"] = str(d["company_id"])
        result.append(d)
    return result


# ========== LOGS ==========

async def list_logs(
    db: AsyncSession, company_id: str,
    platform: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    q = select(DeliveryPlatformLog).where(DeliveryPlatformLog.company_id == company_id)
    if platform:
        q = q.where(DeliveryPlatformLog.platform == platform)
    if event_type:
        q = q.where(DeliveryPlatformLog.event_type == event_type)
    q = q.order_by(DeliveryPlatformLog.created_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    logs = r.scalars().all()

    result = []
    for log in logs:
        d = {col.name: getattr(log, col.name) for col in log.__table__.columns}
        d["id"] = str(d["id"])
        d["company_id"] = str(d["company_id"])
        result.append(d)
    return result


# ========== DASHBOARD ==========

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    today = date.today()
    week_ago = today - timedelta(days=7)

    orders_today_r = await db.execute(
        select(sa_func.count(DeliveryOrder.id)).where(
            DeliveryOrder.company_id == company_id,
            sa_func.date(DeliveryOrder.received_at) == today,
        )
    )

    orders_week_r = await db.execute(
        select(sa_func.count(DeliveryOrder.id)).where(
            DeliveryOrder.company_id == company_id,
            sa_func.date(DeliveryOrder.received_at) >= week_ago,
        )
    )

    sales_today_r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(DeliveryOrder.total), 0)).where(
            DeliveryOrder.company_id == company_id,
            sa_func.date(DeliveryOrder.received_at) == today,
            DeliveryOrder.status != "cancelled",
        )
    )

    sales_week_r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(DeliveryOrder.total), 0)).where(
            DeliveryOrder.company_id == company_id,
            sa_func.date(DeliveryOrder.received_at) >= week_ago,
            DeliveryOrder.status != "cancelled",
        )
    )

    commission_week_r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(DeliveryOrder.commission), 0)).where(
            DeliveryOrder.company_id == company_id,
            sa_func.date(DeliveryOrder.received_at) >= week_ago,
            DeliveryOrder.status != "cancelled",
        )
    )

    net_sales_week_r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(DeliveryOrder.net_amount), 0)).where(
            DeliveryOrder.company_id == company_id,
            sa_func.date(DeliveryOrder.received_at) >= week_ago,
            DeliveryOrder.status != "cancelled",
        )
    )

    avg_value_r = await db.execute(
        select(sa_func.avg(DeliveryOrder.total)).where(
            DeliveryOrder.company_id == company_id,
            DeliveryOrder.status != "cancelled",
        )
    )

    avg_prep_r = await db.execute(
        select(sa_func.avg(DeliveryDailyStats.avg_prep_time_minutes)).where(
            DeliveryDailyStats.company_id == company_id,
        )
    )

    active_integrations_r = await db.execute(
        select(sa_func.count(DeliveryIntegration.id)).where(
            DeliveryIntegration.company_id == company_id,
            DeliveryIntegration.enabled == True,
            DeliveryIntegration.is_active == True,
        )
    )

    orders_by_platform_r = await db.execute(
        select(DeliveryOrder.platform, sa_func.count(DeliveryOrder.id))
        .where(
            DeliveryOrder.company_id == company_id,
            sa_func.date(DeliveryOrder.received_at) >= week_ago,
        )
        .group_by(DeliveryOrder.platform)
    )

    sales_by_platform_r = await db.execute(
        select(
            DeliveryOrder.platform,
            sa_func.coalesce(sa_func.sum(DeliveryOrder.total), 0),
        )
        .where(
            DeliveryOrder.company_id == company_id,
            sa_func.date(DeliveryOrder.received_at) >= week_ago,
            DeliveryOrder.status != "cancelled",
        )
        .group_by(DeliveryOrder.platform)
    )

    status_dist_r = await db.execute(
        select(DeliveryOrder.status, sa_func.count(DeliveryOrder.id))
        .where(DeliveryOrder.company_id == company_id)
        .group_by(DeliveryOrder.status)
    )

    recent_r = await db.execute(
        select(DeliveryOrder)
        .where(DeliveryOrder.company_id == company_id)
        .order_by(DeliveryOrder.received_at.desc())
        .limit(10)
    )

    recent_orders = []
    for o in recent_r.scalars().all():
        recent_orders.append({
            "id": str(o.id),
            "platform": o.platform,
            "platform_order_id": o.platform_order_id,
            "status": o.status,
            "customer_name": o.customer_name,
            "total": o.total,
            "received_at": o.received_at.isoformat() if o.received_at else None,
        })

    daily_trend_r = await db.execute(
        select(
            DeliveryDailyStats.stat_date,
            sa_func.sum(DeliveryDailyStats.orders_count),
            sa_func.sum(DeliveryDailyStats.net_sales),
        )
        .where(
            DeliveryDailyStats.company_id == company_id,
            DeliveryDailyStats.stat_date >= week_ago,
        )
        .group_by(DeliveryDailyStats.stat_date)
        .order_by(DeliveryDailyStats.stat_date)
    )

    return {
        "total_orders_today": orders_today_r.scalar() or 0,
        "total_orders_week": orders_week_r.scalar() or 0,
        "total_sales_today": float(sales_today_r.scalar() or 0),
        "total_sales_week": float(sales_week_r.scalar() or 0),
        "total_commission_week": float(commission_week_r.scalar() or 0),
        "net_sales_week": float(net_sales_week_r.scalar() or 0),
        "avg_order_value": round(float(avg_value_r.scalar() or 0), 2),
        "avg_prep_time": round(float(avg_prep_r.scalar() or 0), 1) if avg_prep_r.scalar() else 0,
        "active_integrations": active_integrations_r.scalar() or 0,
        "orders_by_platform": [
            {"platform": r[0], "count": r[1]}
            for r in orders_by_platform_r.fetchall()
        ],
        "sales_by_platform": [
            {"platform": r[0], "total": float(r[1])}
            for r in sales_by_platform_r.fetchall()
        ],
        "recent_orders": recent_orders,
        "status_distribution": [
            {"status": r[0], "count": r[1]}
            for r in status_dist_r.fetchall()
        ],
        "daily_trend": [
            {"date": str(r[0]), "orders": int(r[1] or 0), "net_sales": float(r[2] or 0)}
            for r in daily_trend_r.fetchall()
        ],
    }
