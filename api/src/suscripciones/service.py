import uuid
from datetime import datetime, date, timedelta
from typing import Optional, Any
from sqlalchemy import select, func as sa_func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.suscripciones.models import (
    SubscriptionPlan, SubscriptionPlanItem, GeneratedOrder,
    SubscriptionPayment, SubscriptionLog,
)
from api.src.suscripciones.schemas import (
    SubscriptionPlanCreate, SubscriptionPlanUpdate, PlanItemInput,
)

FREQUENCIES = ["weekly", "biweekly", "monthly"]
PLAN_STATUSES = ["active", "paused", "cancelled"]
ORDER_STATUSES = ["pending", "generated", "cancelled"]
ORDER_PREFIX = "SUSC"

AVAILABLE_PRODUCTS = [
    {"id": "sp1", "name": "Leche Entera 1L", "price": 7500, "category": "Lácteos", "image": "🥛"},
    {"id": "sp2", "name": "Yogurt Natural 1kg", "price": 14500, "category": "Lácteos", "image": "🫗"},
    {"id": "sp3", "name": "Queso Paraguay 500g", "price": 18500, "category": "Lácteos", "image": "🧀"},
    {"id": "sp4", "name": "Pan Molde 600g", "price": 8500, "category": "Panadería", "image": "🍞"},
    {"id": "sp5", "name": "Pan Hamburguesa 8un", "price": 9500, "category": "Panadería", "image": "🍔"},
    {"id": "sp6", "name": "Huevos 12un", "price": 12500, "category": "Huevos", "image": "🥚"},
    {"id": "sp7", "name": "Gaseosa Cola 2L", "price": 11200, "category": "Bebidas", "image": "🥤"},
    {"id": "sp8", "name": "Agua Mineral 1.5L", "price": 4200, "category": "Bebidas", "image": "💧"},
    {"id": "sp9", "name": "Cerveza 6un", "price": 28500, "category": "Bebidas", "image": "🍺"},
    {"id": "sp10", "name": "Arroz Tipo 1 5kg", "price": 28500, "category": "Almacén", "image": "🍚"},
    {"id": "sp11", "name": "Fideo Tallarín 500g", "price": 5500, "category": "Almacén", "image": "🍝"},
    {"id": "sp12", "name": "Aceite Girasol 1L", "price": 12800, "category": "Almacén", "image": "🫒"},
    {"id": "sp13", "name": "Azúcar 1kg", "price": 6200, "category": "Almacén", "image": "🍬"},
    {"id": "sp14", "name": "Yerba Mate 1kg", "price": 14500, "category": "Almacén", "image": "🧉"},
    {"id": "sp15", "name": "Carne Vacuna kg", "price": 38000, "category": "Carnes", "image": "🥩"},
    {"id": "sp16", "name": "Pollo Entero kg", "price": 16500, "category": "Carnes", "image": "🍗"},
    {"id": "sp17", "name": "Tomate kg", "price": 8500, "category": "Verduras", "image": "🍅"},
    {"id": "sp18", "name": "Cebolla kg", "price": 6200, "category": "Verduras", "image": "🧅"},
    {"id": "sp19", "name": "Papá kg", "price": 5500, "category": "Verduras", "image": "🥔"},
    {"id": "sp20", "name": "Banana kg", "price": 7800, "category": "Frutas", "image": "🍌"},
]


async def _next_order_number(db: AsyncSession, company_id: str) -> str:
    today = date.today()
    r = await db.execute(
        select(sa_func.count(GeneratedOrder.id)).where(
            GeneratedOrder.company_id == company_id,
            sa_func.date(GeneratedOrder.created_at) == today,
        )
    )
    count = r.scalar() or 0
    return f"{ORDER_PREFIX}-{today.strftime('%y%m%d')}-{count + 1:04d}"


async def _compute_next_generation(frequency: str, from_date: Optional[date] = None, delivery_day: Optional[int] = None) -> date:
    base = from_date or date.today()
    if frequency == "weekly":
        next_date = base + timedelta(days=7)
    elif frequency == "biweekly":
        next_date = base + timedelta(days=14)
    else:
        next_date = date(base.year + (base.month // 12), (base.month % 12) + 1, 1)
        max_day = 28
        if next_date.month in (4, 6, 9, 11):
            max_day = 30
        elif next_date.month == 2:
            max_day = 29 if (next_date.year % 4 == 0 and (next_date.year % 100 != 0 or next_date.year % 400 == 0)) else 28
        day = min(delivery_day or base.day, max_day)
        next_date = next_date.replace(day=day)
    return next_date


async def create_plan(db: AsyncSession, company_id: str, data: SubscriptionPlanCreate) -> dict:
    if data.frequency not in FREQUENCIES:
        raise ValueError(f"Frequency must be one of: {FREQUENCIES}")

    items_total = sum(i.quantity * i.unit_price for i in data.items)
    discount_amount = items_total * (data.discount_pct / 100)
    total = items_total - discount_amount + data.delivery_fee

    next_gen = await _compute_next_generation(data.frequency, data.start_date, data.delivery_day)

    plan = SubscriptionPlan(
        company_id=company_id,
        customer_id=data.customer_id,
        branch_id=data.branch_id,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        customer_phone=data.customer_phone,
        frequency=data.frequency,
        delivery_day=data.delivery_day,
        delivery_address=data.delivery_address,
        delivery_zone_id=data.delivery_zone_id,
        delivery_lat=data.delivery_lat,
        delivery_lng=data.delivery_lng,
        delivery_fee=data.delivery_fee,
        discount_pct=data.discount_pct,
        notes=data.notes,
        start_date=data.start_date,
        end_date=data.end_date,
        next_generation_date=next_gen,
        status="active",
        total_spent=0,
        total_generated=0,
    )
    db.add(plan)
    await db.flush()

    for item in data.items:
        pi = SubscriptionPlanItem(
            plan_id=plan.id,
            product_id=item.product_id,
            product_name=item.product_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
        )
        db.add(pi)

    db.add(SubscriptionLog(
        company_id=company_id, plan_id=plan.id,
        action="created",
        details={"frequency": data.frequency, "items_count": len(data.items), "total": total},
    ))

    await db.commit()
    return await get_plan(db, company_id, str(plan.id))


async def get_plan(db: AsyncSession, company_id: str, plan_id: str) -> Optional[dict]:
    r = await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.id == plan_id,
            SubscriptionPlan.company_id == company_id,
        )
    )
    plan = r.scalar_one_or_none()
    if not plan:
        return None

    d = {c.name: getattr(plan, c.name) for c in plan.__table__.columns}
    for k in ("id", "company_id", "customer_id", "branch_id", "delivery_zone_id"):
        if d.get(k):
            d[k] = str(d[k])

    items_r = await db.execute(
        select(SubscriptionPlanItem).where(SubscriptionPlanItem.plan_id == plan.id)
    )
    d["items"] = []
    for it in items_r.scalars().all():
        id = {c.name: getattr(it, c.name) for c in it.__table__.columns}
        id["id"] = str(id["id"])
        id["plan_id"] = str(id["plan_id"])
        id["product_id"] = str(id["product_id"])
        d["items"].append(id)

    return d


async def list_plans(
    db: AsyncSession, company_id: str,
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    q = select(SubscriptionPlan).where(SubscriptionPlan.company_id == company_id)
    if status:
        q = q.where(SubscriptionPlan.status == status)
    if customer_id:
        q = q.where(SubscriptionPlan.customer_id == customer_id)
    q = q.order_by(SubscriptionPlan.created_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    plans = r.scalars().all()

    result = []
    for plan in plans:
        d = {c.name: getattr(plan, c.name) for c in plan.__table__.columns}
        for k in ("id", "company_id", "customer_id", "branch_id", "delivery_zone_id"):
            if d.get(k):
                d[k] = str(d[k])
        items_r = await db.execute(
            select(SubscriptionPlanItem).where(SubscriptionPlanItem.plan_id == plan.id)
        )
        d["items"] = [
            {c.name: str(getattr(it, c.name)) if isinstance(getattr(it, c.name), uuid.UUID) else getattr(it, c.name)
             for c in it.__table__.columns}
            for it in items_r.scalars().all()
        ]
        result.append(d)
    return result


async def update_plan(db: AsyncSession, company_id: str, plan_id: str, data: SubscriptionPlanUpdate) -> Optional[dict]:
    r = await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.id == plan_id,
            SubscriptionPlan.company_id == company_id,
        )
    )
    plan = r.scalar_one_or_none()
    if not plan:
        return None

    changed_fields = []
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "items":
            continue
        setattr(plan, k, v)
        changed_fields.append(k)

    if data.items is not None:
        old_r = await db.execute(
            select(SubscriptionPlanItem).where(SubscriptionPlanItem.plan_id == plan.id)
        )
        for old in old_r.scalars().all():
            await db.delete(old)

        for item in data.items:
            pi = SubscriptionPlanItem(
                plan_id=plan.id,
                product_id=item.product_id,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            db.add(pi)
        changed_fields.append("items")

    db.add(SubscriptionLog(
        company_id=company_id, plan_id=plan.id,
        action="updated",
        details={"changed_fields": changed_fields},
    ))

    await db.commit()
    return await get_plan(db, company_id, plan_id)


async def delete_plan(db: AsyncSession, company_id: str, plan_id: str) -> bool:
    r = await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.id == plan_id,
            SubscriptionPlan.company_id == company_id,
        )
    )
    plan = r.scalar_one_or_none()
    if not plan:
        return False

    plan.is_active = False
    plan.status = "cancelled"

    db.add(SubscriptionLog(
        company_id=company_id, plan_id=plan.id,
        action="deleted",
        details={},
    ))
    await db.commit()
    return True


async def skip_next_generation(db: AsyncSession, company_id: str, plan_id: str) -> Optional[dict]:
    r = await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.id == plan_id,
            SubscriptionPlan.company_id == company_id,
        )
    )
    plan = r.scalar_one_or_none()
    if not plan:
        return None

    plan.skip_next = True
    db.add(SubscriptionLog(
        company_id=company_id, plan_id=plan.id,
        action="skip_next",
        details={},
    ))
    await db.commit()
    return await get_plan(db, company_id, plan_id)


async def pause_plan(db: AsyncSession, company_id: str, plan_id: str, reason: Optional[str] = None) -> Optional[dict]:
    r = await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.id == plan_id,
            SubscriptionPlan.company_id == company_id,
        )
    )
    plan = r.scalar_one_or_none()
    if not plan:
        return None

    plan.status = "paused"
    plan.pause_reason = reason
    db.add(SubscriptionLog(
        company_id=company_id, plan_id=plan.id,
        action="paused",
        details={"reason": reason},
    ))
    await db.commit()
    return await get_plan(db, company_id, plan_id)


async def resume_plan(db: AsyncSession, company_id: str, plan_id: str) -> Optional[dict]:
    r = await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.id == plan_id,
            SubscriptionPlan.company_id == company_id,
        )
    )
    plan = r.scalar_one_or_none()
    if not plan:
        return None

    plan.status = "active"
    plan.pause_reason = None
    plan.next_generation_date = await _compute_next_generation(
        plan.frequency, date.today(), plan.delivery_day
    )

    db.add(SubscriptionLog(
        company_id=company_id, plan_id=plan.id,
        action="resumed",
        details={},
    ))
    await db.commit()
    return await get_plan(db, company_id, plan_id)


async def generate_order_from_plan(db: AsyncSession, company_id: str, plan_id: str) -> dict:
    r = await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.id == plan_id,
            SubscriptionPlan.company_id == company_id,
            SubscriptionPlan.is_active == True,
        )
    )
    plan = r.scalar_one_or_none()
    if not plan:
        raise ValueError("Plan not found or inactive")

    if plan.status != "active":
        raise ValueError("Plan is not active")

    if plan.skip_next:
        plan.skip_next = False
        plan.next_generation_date = await _compute_next_generation(
            plan.frequency, date.today(), plan.delivery_day
        )
        await db.commit()
        raise ValueError("Skip was enabled for this generation — skipped")

    items_r = await db.execute(
        select(SubscriptionPlanItem).where(SubscriptionPlanItem.plan_id == plan.id)
    )
    items = items_r.scalars().all()
    if not items:
        raise ValueError("Plan has no items")

    subtotal = sum(it.quantity * it.unit_price for it in items)
    discount_amount = subtotal * (plan.discount_pct / 100)
    total = subtotal - discount_amount + (plan.delivery_fee or 0)

    order_number = await _next_order_number(db, company_id)

    items_data = [
        {
            "product_id": str(it.product_id),
            "product_name": it.product_name,
            "quantity": it.quantity,
            "unit_price": it.unit_price,
            "subtotal": it.quantity * it.unit_price,
        }
        for it in items
    ]

    gen_order = GeneratedOrder(
        company_id=company_id,
        plan_id=plan.id,
        customer_id=plan.customer_id,
        order_number=order_number,
        status="generated",
        subtotal=subtotal,
        discount=discount_amount,
        delivery_fee=plan.delivery_fee or 0,
        total=total,
        delivery_address=plan.delivery_address,
        scheduled_date=plan.next_generation_date,
        items_data=items_data,
        generated_at=datetime.utcnow(),
    )
    db.add(gen_order)
    await db.flush()

    plan.total_generated = (plan.total_generated or 0) + 1
    plan.total_spent = (plan.total_spent or 0) + total
    plan.next_generation_date = await _compute_next_generation(
        plan.frequency, plan.next_generation_date or date.today(), plan.delivery_day
    )

    db.add(SubscriptionLog(
        company_id=company_id, plan_id=plan.id,
        action="order_generated",
        details={"order_id": str(gen_order.id), "total": total},
    ))

    await db.commit()

    gd = {c.name: getattr(gen_order, c.name) for c in gen_order.__table__.columns}
    for k in ("id", "company_id", "plan_id", "customer_id", "ecommerce_order_id"):
        if gd.get(k):
            gd[k] = str(gd[k])
    return gd


async def generate_all_due(db: AsyncSession, company_id: str) -> dict:
    today = date.today()
    r = await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.company_id == company_id,
            SubscriptionPlan.is_active == True,
            SubscriptionPlan.status == "active",
            SubscriptionPlan.next_generation_date <= today,
            SubscriptionPlan.skip_next == False,
        )
    )
    plans = r.scalars().all()

    generated = 0
    errors = []
    for plan in plans:
        try:
            await generate_order_from_plan(db, company_id, str(plan.id))
            generated += 1
        except ValueError as e:
            errors.append({"plan_id": str(plan.id), "error": str(e)})

    return {"generated": generated, "errors": errors, "total_due": len(plans)}


async def list_generated_orders(
    db: AsyncSession, company_id: str,
    plan_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    q = select(GeneratedOrder).where(GeneratedOrder.company_id == company_id)
    if plan_id:
        q = q.where(GeneratedOrder.plan_id == plan_id)
    if status:
        q = q.where(GeneratedOrder.status == status)
    q = q.order_by(GeneratedOrder.generated_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    orders = r.scalars().all()

    result = []
    for o in orders:
        d = {c.name: getattr(o, c.name) for c in o.__table__.columns}
        for k in ("id", "company_id", "plan_id", "customer_id", "ecommerce_order_id"):
            if d.get(k):
                d[k] = str(d[k])
        result.append(d)
    return result


async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    total_r = await db.execute(
        select(sa_func.count(SubscriptionPlan.id)).where(
            SubscriptionPlan.company_id == company_id,
            SubscriptionPlan.is_active == True,
        )
    )

    active_r = await db.execute(
        select(sa_func.count(SubscriptionPlan.id)).where(
            SubscriptionPlan.company_id == company_id,
            SubscriptionPlan.is_active == True,
            SubscriptionPlan.status == "active",
        )
    )

    paused_r = await db.execute(
        select(sa_func.count(SubscriptionPlan.id)).where(
            SubscriptionPlan.company_id == company_id,
            SubscriptionPlan.is_active == True,
            SubscriptionPlan.status == "paused",
        )
    )

    cancelled_r = await db.execute(
        select(sa_func.count(SubscriptionPlan.id)).where(
            SubscriptionPlan.company_id == company_id,
            SubscriptionPlan.is_active == False,
        )
    )

    customers_r = await db.execute(
        select(sa_func.count(sa_func.distinct(SubscriptionPlan.customer_id))).where(
            SubscriptionPlan.company_id == company_id,
        )
    )

    mrr_r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(GeneratedOrder.total), 0)).where(
            GeneratedOrder.company_id == company_id,
            GeneratedOrder.status == "generated",
        )
    )

    avg_r = await db.execute(
        select(sa_func.avg(GeneratedOrder.total)).where(
            GeneratedOrder.company_id == company_id,
            GeneratedOrder.status == "generated",
        )
    )

    retention_r = await db.execute(
        select(
            (sa_func.count().filter(SubscriptionPlan.status == "cancelled").cast(sa_func.Float)
             / sa_func.nullif(sa_func.count(), 0)) * 100
        ).where(SubscriptionPlan.company_id == company_id)
    )

    total_orders_r = await db.execute(
        select(sa_func.count(GeneratedOrder.id)).where(
            GeneratedOrder.company_id == company_id,
        )
    )

    due_r = await db.execute(
        select(sa_func.count(SubscriptionPlan.id)).where(
            SubscriptionPlan.company_id == company_id,
            SubscriptionPlan.is_active == True,
            SubscriptionPlan.status == "active",
            SubscriptionPlan.next_generation_date <= date.today(),
            SubscriptionPlan.skip_next == False,
        )
    )

    freq_r = await db.execute(
        select(SubscriptionPlan.frequency, sa_func.count(SubscriptionPlan.id))
        .where(
            SubscriptionPlan.company_id == company_id,
            SubscriptionPlan.is_active == True,
        )
        .group_by(SubscriptionPlan.frequency)
    )

    recent_r = await db.execute(
        select(GeneratedOrder)
        .where(GeneratedOrder.company_id == company_id)
        .order_by(GeneratedOrder.generated_at.desc())
        .limit(10)
    )

    recent_gen = []
    for o in recent_r.scalars().all():
        recent_gen.append({
            "id": str(o.id),
            "order_number": o.order_number,
            "status": o.status,
            "total": o.total,
            "scheduled_date": str(o.scheduled_date) if o.scheduled_date else None,
            "generated_at": o.generated_at.isoformat() if o.generated_at else None,
        })

    top_r = await db.execute(
        select(
            SubscriptionPlanItem.product_name,
            sa_func.sum(SubscriptionPlanItem.quantity).label("total_qty"),
        )
        .join(SubscriptionPlan, SubscriptionPlan.id == SubscriptionPlanItem.plan_id)
        .where(
            SubscriptionPlan.company_id == company_id,
            SubscriptionPlan.is_active == True,
        )
        .group_by(SubscriptionPlanItem.product_name)
        .order_by(desc("total_qty"))
        .limit(10)
    )

    return {
        "total_plans": total_r.scalar() or 0,
        "active_plans": active_r.scalar() or 0,
        "paused_plans": paused_r.scalar() or 0,
        "cancelled_plans": cancelled_r.scalar() or 0,
        "total_customers": customers_r.scalar() or 0,
        "mrr": float(mrr_r.scalar() or 0),
        "avg_order_value": round(float(avg_r.scalar() or 0), 2),
        "retention_rate": round(100 - float(retention_r.scalar() or 0), 1),
        "orders_generated_total": total_orders_r.scalar() or 0,
        "next_due_generations": due_r.scalar() or 0,
        "plans_by_frequency": [
            {"frequency": r[0], "count": r[1]}
            for r in freq_r.fetchall()
        ],
        "recent_generations": recent_gen,
        "top_products": [
            {"product_name": r[0], "total_quantity": int(r[1])}
            for r in top_r.fetchall()
        ],
    }
