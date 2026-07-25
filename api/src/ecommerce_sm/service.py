import uuid
from datetime import datetime, date, time, timedelta
from typing import Optional, Any
from sqlalchemy import select, func as sa_func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.ecommerce_sm.models import (
    EcommerceProduct, EcommerceOrder, EcommerceOrderItem,
    EcommercePickupSlot, EcommerceDeliveryZone, EcommerceDeliverySlot,
    EcommercePickingList, EcommercePickingItem, EcommercePayment,
)
from api.src.ecommerce_sm.schemas import (
    EcommerceProductCreate, EcommerceProductUpdate,
    OrderCreate, OrderItemInput,
    PickupSlotCreate, DeliveryZoneCreate, DeliverySlotCreate,
    PickingListAssign, PickingScanItem, PaymentRecord, BulkSlotGenerate,
)

ORDER_STATUSES = [
    "pending", "confirmed", "preparing", "ready",
    "picked_up", "in_transit", "delivered", "cancelled",
]

PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"]
PAYMENT_METHODS = ["pagopar", "kuapay", "bancard", "spi", "cash_on_delivery"]

ORDER_PREFIX = "ECOMM"


async def _next_order_number(db: AsyncSession, company_id: str) -> str:
    today = date.today()
    r = await db.execute(
        select(sa_func.count(EcommerceOrder.id)).where(
            EcommerceOrder.company_id == company_id,
            sa_func.date(EcommerceOrder.created_at) == today,
        )
    )
    count = r.scalar() or 0
    return f"{ORDER_PREFIX}-{today.strftime('%y%m%d')}-{count + 1:04d}"


try:
    from api.src.products.models import Product as ProductModel
except ImportError:
    class ProductModel:
        id: Any
        nombre: str


async def _get_product_name(db: AsyncSession, product_id: str) -> str:
    try:
        r = await db.execute(select(ProductModel.nombre).where(ProductModel.id == product_id))
        row = r.scalar_one_or_none()
        if row:
            return str(row)
    except Exception:
        pass
    return product_id[:8]


async def _get_branch_name(db: AsyncSession, branch_id: str) -> str:
    try:
        from api.src.branches.models import Branch as BrModel
        r = await db.execute(select(BrModel.nombre).where(BrModel.id == branch_id))
        row = r.scalar_one_or_none()
        if row:
            return str(row)
    except Exception:
        pass
    return branch_id[:8]


# ========== CATALOG ==========

async def list_catalog(
    db: AsyncSession, company_id: str,
    branch_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    q = select(EcommerceProduct).where(
        EcommerceProduct.company_id == company_id,
        EcommerceProduct.is_active == True,
        EcommerceProduct.online_visible == True,
    )
    if branch_id:
        q = q.where(EcommerceProduct.branch_id == branch_id)
    if category:
        q = q.where(EcommerceProduct.category_online == category)
    if search:
        q = q.where(EcommerceProduct.description_online.ilike(f"%{search}%"))

    q = q.order_by(EcommerceProduct.sort_order.asc(), EcommerceProduct.created_at.desc())
    q = q.limit(limit).offset(offset)
    r = await db.execute(q)
    products = r.scalars().all()

    result = []
    for p in products:
        d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
        d["id"] = str(d["id"])
        d["company_id"] = str(d["company_id"])
        d["branch_id"] = str(d["branch_id"])
        d["product_id"] = str(d["product_id"])
        d["product_name"] = await _get_product_name(db, d["product_id"])
        result.append(d)
    return result


async def upsert_product(db: AsyncSession, company_id: str, data: EcommerceProductCreate) -> dict:
    r = await db.execute(
        select(EcommerceProduct).where(
            EcommerceProduct.company_id == company_id,
            EcommerceProduct.branch_id == data.branch_id,
            EcommerceProduct.product_id == data.product_id,
        )
    )
    existing = r.scalar_one_or_none()
    if existing:
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(existing, k, v)
    else:
        existing = EcommerceProduct(company_id=company_id, **data.model_dump())
        db.add(existing)
    await db.commit()
    d = {c.name: getattr(existing, c.name) for c in existing.__table__.columns}
    for k in ("id", "company_id", "branch_id", "product_id"):
        d[k] = str(d[k])
    return d


async def update_product(db: AsyncSession, company_id: str, product_id: str, data: EcommerceProductUpdate) -> Optional[dict]:
    r = await db.execute(
        select(EcommerceProduct).where(
            EcommerceProduct.id == product_id,
            EcommerceProduct.company_id == company_id,
        )
    )
    p = r.scalar_one_or_none()
    if not p:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await db.commit()
    d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
    for k in ("id", "company_id", "branch_id", "product_id"):
        d[k] = str(d[k])
    return d


# ========== ORDERS ==========

async def create_order(db: AsyncSession, company_id: str, data: OrderCreate) -> dict:
    if data.order_type not in ("pickup", "delivery"):
        raise ValueError("order_type must be 'pickup' or 'delivery'")

    order_number = await _next_order_number(db, company_id)
    subtotal = sum(item.quantity * item.unit_price for item in data.items)
    total = subtotal + data.shipping_cost

    order = EcommerceOrder(
        company_id=company_id,
        branch_id=data.branch_id,
        customer_id=data.customer_id,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        customer_phone=data.customer_phone,
        order_number=order_number,
        order_type=data.order_type,
        status="confirmed" if data.payment_method else "pending",
        subtotal=subtotal,
        shipping_cost=data.shipping_cost,
        total=total,
        payment_method=data.payment_method,
        payment_status="pending",
        notes=data.notes,
        pickup_slot_id=data.pickup_slot_id,
        pickup_date=data.pickup_date,
        pickup_start=data.pickup_start,
        pickup_end=data.pickup_end,
        delivery_zone_id=data.delivery_zone_id,
        delivery_address=data.delivery_address,
        delivery_lat=data.delivery_lat,
        delivery_lng=data.delivery_lng,
        delivery_date=data.delivery_date,
        delivery_start=data.delivery_start,
        delivery_end=data.delivery_end,
        confirmed_at=datetime.utcnow(),
    )
    db.add(order)
    await db.flush()

    for item in data.items:
        oi = EcommerceOrderItem(
            order_id=order.id,
            product_id=item.product_id,
            product_name=item.product_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.quantity * item.unit_price,
        )
        db.add(oi)

    if data.pickup_slot_id:
        await _increment_slot_count(db, data.pickup_slot_id, "pickup")
    if data.delivery_zone_id and data.delivery_date and data.delivery_start:
        await _increment_delivery_slot_count(db, data.delivery_zone_id, data.delivery_date, data.delivery_start)

    await db.commit()

    return await get_order_detail(db, company_id, str(order.id))


async def _increment_slot_count(db: AsyncSession, slot_id: str, slot_type: str):
    if slot_type == "pickup":
        r = await db.execute(select(EcommercePickupSlot).where(EcommercePickupSlot.id == slot_id))
        slot = r.scalar_one_or_none()
        if slot:
            slot.current_orders = (slot.current_orders or 0) + 1


async def _increment_delivery_slot_count(db: AsyncSession, zone_id: str, d: date, start: time):
    r = await db.execute(
        select(EcommerceDeliverySlot).where(
            EcommerceDeliverySlot.zone_id == zone_id,
            EcommerceDeliverySlot.slot_date == d,
            EcommerceDeliverySlot.start_time == start,
        )
    )
    slot = r.scalar_one_or_none()
    if slot:
        slot.current_orders = (slot.current_orders or 0) + 1


async def get_order_detail(db: AsyncSession, company_id: str, order_id: str) -> Optional[dict]:
    r = await db.execute(
        select(EcommerceOrder).where(EcommerceOrder.id == order_id, EcommerceOrder.company_id == company_id)
    )
    order = r.scalar_one_or_none()
    if not order:
        return None

    d = {c.name: getattr(order, c.name) for c in order.__table__.columns}
    for k in ("id", "company_id", "branch_id", "customer_id", "pickup_slot_id", "delivery_zone_id", "picking_list_id"):
        if d.get(k):
            d[k] = str(d[k])

    items_r = await db.execute(
        select(EcommerceOrderItem).where(EcommerceOrderItem.order_id == order.id)
    )
    items = []
    for it in items_r.scalars().all():
        id = {c.name: getattr(it, c.name) for c in it.__table__.columns}
        for k in ("id", "order_id", "product_id"):
            id[k] = str(id[k])
        items.append(id)
    d["items"] = items

    payments_r = await db.execute(
        select(EcommercePayment).where(EcommercePayment.order_id == order.id)
    )
    payments = []
    for pm in payments_r.scalars().all():
        pd = {c.name: getattr(pm, c.name) for c in pm.__table__.columns}
        for k in ("id", "company_id", "order_id"):
            pd[k] = str(pd[k])
        payments.append(pd)
    d["payments"] = payments

    d["branch_name"] = await _get_branch_name(db, d["branch_id"])
    return d


async def list_orders(
    db: AsyncSession, company_id: str,
    status: Optional[str] = None,
    order_type: Optional[str] = None,
    branch_id: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    q = select(EcommerceOrder).where(EcommerceOrder.company_id == company_id)
    if status:
        q = q.where(EcommerceOrder.status == status)
    if order_type:
        q = q.where(EcommerceOrder.order_type == order_type)
    if branch_id:
        q = q.where(EcommerceOrder.branch_id == branch_id)
    q = q.order_by(EcommerceOrder.created_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    orders = r.scalars().all()

    result = []
    for o in orders:
        d = {c.name: getattr(o, c.name) for c in o.__table__.columns}
        for k in ("id", "company_id", "branch_id", "customer_id", "pickup_slot_id", "delivery_zone_id", "picking_list_id"):
            if d.get(k):
                d[k] = str(d[k])
        items_r = await db.execute(
            select(EcommerceOrderItem).where(EcommerceOrderItem.order_id == o.id)
        )
        d["items"] = [
            {c.name: str(getattr(it, c.name)) if isinstance(getattr(it, c.name), uuid.UUID) else getattr(it, c.name)
             for c in it.__table__.columns}
            for it in items_r.scalars().all()
        ]
        d["branch_name"] = await _get_branch_name(db, d["branch_id"])
        result.append(d)
    return result


async def update_order_status(db: AsyncSession, company_id: str, order_id: str, status: str, cancel_reason: Optional[str] = None) -> Optional[dict]:
    if status not in ORDER_STATUSES:
        raise ValueError(f"Invalid status: {status}")

    r = await db.execute(
        select(EcommerceOrder).where(EcommerceOrder.id == order_id, EcommerceOrder.company_id == company_id)
    )
    order = r.scalar_one_or_none()
    if not order:
        return None

    order.status = status
    now = datetime.utcnow()

    status_map = {
        "confirmed": "confirmed_at",
        "preparing": "preparing_at",
        "ready": "ready_at",
        "picked_up": "picked_up_at",
        "in_transit": "in_transit_at",
        "delivered": "delivered_at",
        "cancelled": "cancelled_at",
    }
    attr = status_map.get(status)
    if attr:
        setattr(order, attr, now)
    if status == "cancelled":
        order.cancel_reason = cancel_reason
    if status == "delivered":
        order.payment_status = "paid"

    await db.commit()
    return await get_order_detail(db, company_id, order_id)


# ========== PICKUP SLOTS ==========

async def list_pickup_slots(
    db: AsyncSession, company_id: str,
    branch_id: Optional[str] = None,
    slot_date: Optional[date] = None,
) -> list[dict]:
    q = select(EcommercePickupSlot).where(
        EcommercePickupSlot.company_id == company_id,
        EcommercePickupSlot.is_active == True,
        EcommercePickupSlot.slot_date >= date.today(),
    )
    if branch_id:
        q = q.where(EcommercePickupSlot.branch_id == branch_id)
    if slot_date:
        q = q.where(EcommercePickupSlot.slot_date == slot_date)
    q = q.order_by(EcommercePickupSlot.slot_date, EcommercePickupSlot.start_time)
    r = await db.execute(q)
    slots = r.scalars().all()

    branch_name_cache = {}
    result = []
    for s in slots:
        d = {c.name: getattr(s, c.name) for c in s.__table__.columns}
        d["id"] = str(d["id"])
        d["company_id"] = str(d["company_id"])
        d["branch_id"] = str(d["branch_id"])
        d["available"] = max(0, (s.max_orders or 10) - (s.current_orders or 0))
        if s.branch_id not in branch_name_cache:
            branch_name_cache[s.branch_id] = await _get_branch_name(db, str(s.branch_id))
        d["branch_name"] = branch_name_cache[s.branch_id]
        result.append(d)
    return result


async def create_pickup_slot(db: AsyncSession, company_id: str, data: PickupSlotCreate) -> dict:
    slot = EcommercePickupSlot(company_id=company_id, **data.model_dump())
    db.add(slot)
    await db.commit()
    d = {c.name: getattr(slot, c.name) for c in slot.__table__.columns}
    d["id"] = str(d["id"])
    d["company_id"] = str(d["company_id"])
    d["branch_id"] = str(d["branch_id"])
    return d


# ========== DELIVERY ZONES ==========

async def list_delivery_zones(db: AsyncSession, company_id: str) -> list[dict]:
    r = await db.execute(
        select(EcommerceDeliveryZone).where(
            EcommerceDeliveryZone.company_id == company_id,
        ).order_by(EcommerceDeliveryZone.name)
    )
    zones = r.scalars().all()
    result = []
    for z in zones:
        d = {c.name: getattr(z, c.name) for c in z.__table__.columns}
        d["id"] = str(d["id"])
        d["company_id"] = str(d["company_id"])
        result.append(d)
    return result


async def create_delivery_zone(db: AsyncSession, company_id: str, data: DeliveryZoneCreate) -> dict:
    z = EcommerceDeliveryZone(company_id=company_id, **data.model_dump())
    db.add(z)
    await db.commit()
    d = {c.name: getattr(z, c.name) for c in z.__table__.columns}
    d["id"] = str(d["id"])
    d["company_id"] = str(d["company_id"])
    return d


async def calculate_shipping(db: AsyncSession, company_id: str, zone_id: str, distance_km: float = 0, order_total: float = 0) -> dict:
    r = await db.execute(
        select(EcommerceDeliveryZone).where(
            EcommerceDeliveryZone.id == zone_id,
            EcommerceDeliveryZone.company_id == company_id,
        )
    )
    zone = r.scalar_one_or_none()
    if not zone:
        raise ValueError("Delivery zone not found")

    base = zone.base_price or 0
    per_km = zone.price_per_km or 0
    distance_charge = per_km * distance_km
    free_delivery = zone.free_from_amount is not None and order_total >= zone.free_from_amount
    total = 0 if free_delivery else (base + distance_charge)

    return {
        "base_price": base,
        "distance_charge": round(distance_charge, 2),
        "free_delivery": free_delivery,
        "total_shipping": round(total, 2),
        "estimated_minutes": zone.estimated_minutes or 30,
    }


async def list_delivery_slots(
    db: AsyncSession, company_id: str,
    zone_id: Optional[str] = None,
    slot_date: Optional[date] = None,
) -> list[dict]:
    q = select(EcommerceDeliverySlot).where(
        EcommerceDeliverySlot.company_id == company_id,
        EcommerceDeliverySlot.is_active == True,
        EcommerceDeliverySlot.slot_date >= date.today(),
    )
    if zone_id:
        q = q.where(EcommerceDeliverySlot.zone_id == zone_id)
    if slot_date:
        q = q.where(EcommerceDeliverySlot.slot_date == slot_date)
    q = q.order_by(EcommerceDeliverySlot.slot_date, EcommerceDeliverySlot.start_time)
    r = await db.execute(q)
    slots = r.scalars().all()

    zone_names = {}
    result = []
    for s in slots:
        d = {c.name: getattr(s, c.name) for c in s.__table__.columns}
        d["id"] = str(d["id"])
        d["company_id"] = str(d["company_id"])
        d["zone_id"] = str(d["zone_id"])
        d["available"] = max(0, (s.max_orders or 10) - (s.current_orders or 0))
        if str(s.zone_id) not in zone_names:
            zr = await db.execute(select(EcommerceDeliveryZone.name).where(EcommerceDeliveryZone.id == s.zone_id))
            zn = zr.scalar_one_or_none()
            zone_names[str(s.zone_id)] = zn or str(s.zone_id)[:8]
        d["zone_name"] = zone_names[str(s.zone_id)]
        result.append(d)
    return result


async def create_delivery_slot(db: AsyncSession, company_id: str, data: DeliverySlotCreate) -> dict:
    s = EcommerceDeliverySlot(company_id=company_id, **data.model_dump())
    db.add(s)
    await db.commit()
    d = {c.name: getattr(s, c.name) for c in s.__table__.columns}
    d["id"] = str(d["id"])
    d["company_id"] = str(d["company_id"])
    d["zone_id"] = str(d["zone_id"])
    return d


# ========== BULK SLOT GENERATION ==========

async def bulk_generate_slots(db: AsyncSession, company_id: str, data: BulkSlotGenerate) -> dict:
    created = 0
    current = data.start_date
    while current <= data.end_date:
        if current.weekday() in data.weekdays:
            for slot_def in data.slots:
                start = datetime.strptime(slot_def["start"], "%H:%M").time()
                end = datetime.strptime(slot_def["end"], "%H:%M").time()
                if data.slot_type == "pickup":
                    existing_r = await db.execute(
                        select(EcommercePickupSlot).where(
                            EcommercePickupSlot.company_id == company_id,
                            EcommercePickupSlot.branch_id == data.branch_id,
                            EcommercePickupSlot.slot_date == current,
                            EcommercePickupSlot.start_time == start,
                        )
                    )
                    if existing_r.scalar_one_or_none():
                        continue
                    s = EcommercePickupSlot(
                        company_id=company_id,
                        branch_id=data.branch_id,
                        slot_date=current,
                        start_time=start,
                        end_time=end,
                        max_orders=slot_def.get("max_orders", 10),
                    )
                else:
                    existing_r = await db.execute(
                        select(EcommerceDeliverySlot).where(
                            EcommerceDeliverySlot.company_id == company_id,
                            EcommerceDeliverySlot.zone_id == data.zone_id,
                            EcommerceDeliverySlot.slot_date == current,
                            EcommerceDeliverySlot.start_time == start,
                        )
                    )
                    if existing_r.scalar_one_or_none():
                        continue
                    s = EcommerceDeliverySlot(
                        company_id=company_id,
                        zone_id=data.zone_id,
                        slot_date=current,
                        start_time=start,
                        end_time=end,
                        max_orders=slot_def.get("max_orders", 10),
                    )
                db.add(s)
                created += 1
        current += timedelta(days=1)

    if created > 0:
        await db.commit()

    return {"created": created, "start_date": str(data.start_date), "end_date": str(data.end_date)}


# ========== PICKING ==========

async def generate_picking_list(db: AsyncSession, company_id: str, order_id: str) -> dict:
    r = await db.execute(
        select(EcommerceOrder).where(EcommerceOrder.id == order_id, EcommerceOrder.company_id == company_id)
    )
    order = r.scalar_one_or_none()
    if not order:
        raise ValueError("Order not found")
    if order.is_picked:
        raise ValueError("Order already has a picking list")

    items_r = await db.execute(
        select(EcommerceOrderItem).where(EcommerceOrderItem.order_id == order.id)
    )
    items = items_r.scalars().all()

    if not items:
        raise ValueError("Order has no items")

    picking_list = EcommercePickingList(
        company_id=company_id,
        order_id=order.id,
        branch_id=order.branch_id,
        total_items=sum(it.quantity for it in items),
        status="pending",
    )
    db.add(picking_list)
    await db.flush()

    for item in items:
        prod_r = await db.execute(
            select(EcommerceProduct).where(
                EcommerceProduct.company_id == company_id,
                EcommerceProduct.product_id == item.product_id,
            )
        )
        ecom_prod = prod_r.scalar_one_or_none()
        aisle = ecom_prod.aisle_location if ecom_prod else None

        pi = EcommercePickingItem(
            picking_list_id=picking_list.id,
            product_id=item.product_id,
            product_name=item.product_name,
            quantity=item.quantity,
            aisle_location=aisle,
            status="pending",
        )
        db.add(pi)

    order.is_picked = True
    order.picking_list_id = picking_list.id

    await db.commit()
    return await get_picking_list(db, company_id, str(picking_list.id))


async def get_picking_list(db: AsyncSession, company_id: str, picking_list_id: str) -> dict:
    r = await db.execute(
        select(EcommercePickingList).where(
            EcommercePickingList.id == picking_list_id,
            EcommercePickingList.company_id == company_id,
        )
    )
    pl = r.scalar_one_or_none()
    if not pl:
        raise ValueError("Picking list not found")

    d = {c.name: getattr(pl, c.name) for c in pl.__table__.columns}
    d["id"] = str(d["id"])
    d["company_id"] = str(d["company_id"])
    d["order_id"] = str(d["order_id"])
    d["branch_id"] = str(d["branch_id"])

    order_r = await db.execute(
        select(EcommerceOrder).where(EcommerceOrder.id == pl.order_id)
    )
    order = order_r.scalar_one_or_none()
    if order:
        d["order_number"] = order.order_number
        d["customer_name"] = order.customer_name

    items_r = await db.execute(
        select(EcommercePickingItem).where(EcommercePickingItem.picking_list_id == pl.id)
        .order_by(EcommercePickingItem.aisle_location, EcommercePickingItem.product_name)
    )
    d["items"] = []
    for pi in items_r.scalars().all():
        pid = {c.name: getattr(pi, c.name) for c in pi.__table__.columns}
        pid["id"] = str(pid["id"])
        pid["picking_list_id"] = str(pid["picking_list_id"])
        pid["product_id"] = str(pid["product_id"])
        d["items"].append(pid)

    return d


async def assign_picking_list(db: AsyncSession, company_id: str, picking_list_id: str, data: PickingListAssign) -> dict:
    r = await db.execute(
        select(EcommercePickingList).where(
            EcommercePickingList.id == picking_list_id,
            EcommercePickingList.company_id == company_id,
        )
    )
    pl = r.scalar_one_or_none()
    if not pl:
        raise ValueError("Picking list not found")

    pl.assigned_to = data.assigned_to
    pl.status = "in_progress"
    pl.started_at = datetime.utcnow()
    await db.commit()

    return await get_picking_list(db, company_id, picking_list_id)


async def scan_picking_item(db: AsyncSession, company_id: str, data: PickingScanItem) -> dict:
    r = await db.execute(
        select(EcommercePickingItem).where(EcommercePickingItem.id == data.picking_item_id)
    )
    pi = r.scalar_one_or_none()
    if not pi:
        raise ValueError("Picking item not found")

    pl_r = await db.execute(
        select(EcommercePickingList).where(
            EcommercePickingList.id == pi.picking_list_id,
            EcommercePickingList.company_id == company_id,
        )
    )
    pl = pl_r.scalar_one_or_none()
    if not pl:
        raise ValueError("Picking list not found")

    pi.picked_quantity = data.scanned_quantity
    pi.scanned = True
    pi.status = "picked" if data.scanned_quantity >= pi.quantity else "partial"

    pl.picked_items = (pl.picked_items or 0) + min(data.scanned_quantity, pi.quantity)

    if pl.picked_items >= pl.total_items:
        pl.status = "completed"
        pl.completed_at = datetime.utcnow()

    await db.commit()
    return await get_picking_list(db, company_id, str(pl.id))


async def list_picking_lists(
    db: AsyncSession, company_id: str,
    status: Optional[str] = None,
    branch_id: Optional[str] = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    q = select(EcommercePickingList).where(EcommercePickingList.company_id == company_id)
    if status:
        q = q.where(EcommercePickingList.status == status)
    if branch_id:
        q = q.where(EcommercePickingList.branch_id == branch_id)
    q = q.order_by(EcommercePickingList.created_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    lists = r.scalars().all()

    result = []
    for pl in lists:
        d = {c.name: getattr(pl, c.name) for c in pl.__table__.columns}
        d["id"] = str(d["id"])
        d["company_id"] = str(d["company_id"])
        d["order_id"] = str(d["order_id"])
        d["branch_id"] = str(d["branch_id"])

        order_r = await db.execute(select(EcommerceOrder).where(EcommerceOrder.id == pl.order_id))
        order = order_r.scalar_one_or_none()
        d["order_number"] = order.order_number if order else None
        d["customer_name"] = order.customer_name if order else None
        result.append(d)
    return result


# ========== PAYMENTS ==========

async def record_payment(db: AsyncSession, company_id: str, data: PaymentRecord) -> dict:
    r = await db.execute(
        select(EcommerceOrder).where(EcommerceOrder.id == data.order_id, EcommerceOrder.company_id == company_id)
    )
    order = r.scalar_one_or_none()
    if not order:
        raise ValueError("Order not found")

    pm = EcommercePayment(
        company_id=company_id,
        order_id=data.order_id,
        gateway=data.gateway,
        transaction_id=data.transaction_id,
        amount=data.amount,
        currency=data.currency,
        status="paid",
        paid_at=datetime.utcnow(),
    )
    db.add(pm)

    order.payment_status = "paid"

    await db.commit()

    pd = {c.name: getattr(pm, c.name) for c in pm.__table__.columns}
    pd["id"] = str(pd["id"])
    pd["company_id"] = str(pd["company_id"])
    pd["order_id"] = str(pd["order_id"])
    return pd


# ========== DASHBOARD ==========

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    today = date.today()
    week_ago = today - timedelta(days=7)

    today_r = await db.execute(
        select(sa_func.count(EcommerceOrder.id)).where(
            EcommerceOrder.company_id == company_id,
            sa_func.date(EcommerceOrder.created_at) == today,
        )
    )
    total_today = today_r.scalar() or 0

    week_r = await db.execute(
        select(sa_func.count(EcommerceOrder.id)).where(
            EcommerceOrder.company_id == company_id,
            sa_func.date(EcommerceOrder.created_at) >= week_ago,
        )
    )
    total_week = week_r.scalar() or 0

    pending = await db.execute(
        select(sa_func.count(EcommerceOrder.id)).where(
            EcommerceOrder.company_id == company_id,
            EcommerceOrder.status.in_(["pending", "confirmed"]),
        )
    )

    preparing = await db.execute(
        select(sa_func.count(EcommerceOrder.id)).where(
            EcommerceOrder.company_id == company_id,
            EcommerceOrder.status == "preparing",
        )
    )

    ready = await db.execute(
        select(sa_func.count(EcommerceOrder.id)).where(
            EcommerceOrder.company_id == company_id,
            EcommerceOrder.status == "ready",
        )
    )

    in_transit = await db.execute(
        select(sa_func.count(EcommerceOrder.id)).where(
            EcommerceOrder.company_id == company_id,
            EcommerceOrder.status == "in_transit",
        )
    )

    delivered_today_r = await db.execute(
        select(sa_func.count(EcommerceOrder.id)).where(
            EcommerceOrder.company_id == company_id,
            EcommerceOrder.status == "delivered",
            sa_func.date(EcommerceOrder.delivered_at) == today,
        )
    )

    avg_r = await db.execute(
        select(sa_func.avg(EcommerceOrder.total)).where(
            EcommerceOrder.company_id == company_id,
            EcommerceOrder.status != "cancelled",
        )
    )

    rev_today_r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(EcommerceOrder.total), 0)).where(
            EcommerceOrder.company_id == company_id,
            sa_func.date(EcommerceOrder.created_at) == today,
            EcommerceOrder.status != "cancelled",
        )
    )

    rev_week_r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(EcommerceOrder.total), 0)).where(
            EcommerceOrder.company_id == company_id,
            sa_func.date(EcommerceOrder.created_at) >= week_ago,
            EcommerceOrder.status != "cancelled",
        )
    )

    pickup_vs_delivery_r = await db.execute(
        select(EcommerceOrder.order_type, sa_func.count(EcommerceOrder.id))
        .where(EcommerceOrder.company_id == company_id)
        .group_by(EcommerceOrder.order_type)
    )
    order_type_counts = {row[0]: row[1] for row in pickup_vs_delivery_r.fetchall()}

    top_products_r = await db.execute(
        select(
            EcommerceOrderItem.product_id,
            EcommerceOrderItem.product_name,
            sa_func.sum(EcommerceOrderItem.quantity).label("total_qty"),
        )
        .join(EcommerceOrder, EcommerceOrder.id == EcommerceOrderItem.order_id)
        .where(
            EcommerceOrder.company_id == company_id,
            EcommerceOrder.status != "cancelled",
        )
        .group_by(EcommerceOrderItem.product_id, EcommerceOrderItem.product_name)
        .order_by(desc("total_qty"))
        .limit(10)
    )

    recent_r = await db.execute(
        select(EcommerceOrder)
        .where(EcommerceOrder.company_id == company_id)
        .order_by(EcommerceOrder.created_at.desc())
        .limit(10)
    )

    picking_pending_r = await db.execute(
        select(sa_func.count(EcommercePickingList.id)).where(
            EcommercePickingList.company_id == company_id,
            EcommercePickingList.status == "pending",
        )
    )

    picking_in_progress_r = await db.execute(
        select(sa_func.count(EcommercePickingList.id)).where(
            EcommercePickingList.company_id == company_id,
            EcommercePickingList.status == "in_progress",
        )
    )

    recent_orders = []
    for o in recent_r.scalars().all():
        recent_orders.append({
            "id": str(o.id),
            "order_number": o.order_number,
            "customer_name": o.customer_name,
            "order_type": o.order_type,
            "status": o.status,
            "total": o.total,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })

    return {
        "total_orders_today": total_today,
        "total_orders_week": total_week,
        "pending_orders": pending.scalar() or 0,
        "preparing_orders": preparing.scalar() or 0,
        "ready_orders": ready.scalar() or 0,
        "in_transit_orders": in_transit.scalar() or 0,
        "delivered_today": delivered_today_r.scalar() or 0,
        "avg_order_value": round(float(avg_r.scalar() or 0), 2),
        "total_revenue_today": float(rev_today_r.scalar() or 0),
        "total_revenue_week": float(rev_week_r.scalar() or 0),
        "pickup_vs_delivery": order_type_counts,
        "top_products": [
            {"product_id": str(r[0]), "product_name": r[1], "total_quantity": int(r[2])}
            for r in top_products_r.fetchall()
        ],
        "recent_orders": recent_orders,
        "picking_pending": picking_pending_r.scalar() or 0,
        "picking_in_progress": picking_in_progress_r.scalar() or 0,
    }
