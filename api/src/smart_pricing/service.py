from sqlalchemy import select, delete, func as sa_func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from typing import Optional
import uuid, math

from api.src.smart_pricing.models import (
    PriceListAssignment, TieredPrice, Promotion, PromotionReward,
    PromotionAssignment, PriceSuggestion, PriceChangeRequest, PriceChangeHistory,
)
from api.src.smart_pricing.schemas import (
    PriceListAssignmentCreate, TieredPriceCreate, TieredPriceUpdate,
    PromotionCreate, PromotionUpdate, PriceSuggestionCreate, PriceSuggestionUpdate,
    PriceChangeRequestCreate, PriceChangeRequestReview, DynamicPriceRequest,
)


# ===== PRICE LIST ASSIGNMENTS =====

async def create_assignment(db: AsyncSession, company_id: str, data: PriceListAssignmentCreate) -> dict:
    a = PriceListAssignment(company_id=uuid.UUID(company_id), **data.model_dump())
    db.add(a)
    await db.flush()
    await db.refresh(a)
    return _assignment_to_dict(a)


async def list_assignments(db: AsyncSession, company_id: str, price_list_id: Optional[str] = None) -> list[dict]:
    q = select(PriceListAssignment).where(
        PriceListAssignment.company_id == uuid.UUID(company_id)
    )
    if price_list_id:
        q = q.where(PriceListAssignment.price_list_id == uuid.UUID(price_list_id))
    q = q.order_by(PriceListAssignment.created_at.desc())
    result = await db.execute(q)
    return [_assignment_to_dict(r) for r in result.scalars().all()]


async def delete_assignment(db: AsyncSession, assignment_id: str) -> bool:
    result = await db.execute(select(PriceListAssignment).where(PriceListAssignment.id == uuid.UUID(assignment_id)))
    a = result.scalar_one_or_none()
    if not a:
        return False
    await db.delete(a)
    await db.commit()
    return True


# ===== TIERED PRICING =====

async def create_tiered_price(db: AsyncSession, company_id: str, data: TieredPriceCreate) -> dict:
    t = TieredPrice(company_id=uuid.UUID(company_id), **data.model_dump())
    db.add(t)
    await db.flush()
    await db.refresh(t)
    return _tiered_to_dict(t)


async def list_tiered_prices(
    db: AsyncSession, company_id: str, product_id: Optional[str] = None,
    price_list_id: Optional[str] = None
) -> list[dict]:
    q = select(TieredPrice).where(
        TieredPrice.company_id == uuid.UUID(company_id),
        TieredPrice.activo == True,
    )
    if product_id:
        q = q.where(TieredPrice.product_id == uuid.UUID(product_id))
    if price_list_id:
        q = q.where(TieredPrice.price_list_id == uuid.UUID(price_list_id))
    q = q.order_by(TieredPrice.min_qty.asc())
    result = await db.execute(q)
    return [_tiered_to_dict(r) for r in result.scalars().all()]


async def get_applicable_tier_price(
    db: AsyncSession, company_id: str, product_id: str, quantity: int,
    price_list_id: Optional[str] = None
) -> Optional[dict]:
    q = select(TieredPrice).where(
        TieredPrice.company_id == uuid.UUID(company_id),
        TieredPrice.product_id == uuid.UUID(product_id),
        TieredPrice.min_qty <= quantity,
        TieredPrice.activo == True,
    )
    if price_list_id:
        q = q.where(TieredPrice.price_list_id == uuid.UUID(price_list_id))
    else:
        q = q.where(TieredPrice.price_list_id.is_(None))
    q = q.order_by(TieredPrice.min_qty.desc())
    result = await db.execute(q)
    for t in result.scalars().all():
        if t.max_qty is None or quantity <= t.max_qty:
            return _tiered_to_dict(t)
    return None


async def update_tiered_price(db: AsyncSession, tier_id: str, data: TieredPriceUpdate) -> Optional[dict]:
    result = await db.execute(select(TieredPrice).where(TieredPrice.id == uuid.UUID(tier_id)))
    t = result.scalar_one_or_none()
    if not t:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(t, k, v)
    await db.flush()
    await db.refresh(t)
    return _tiered_to_dict(t)


async def delete_tiered_price(db: AsyncSession, tier_id: str) -> bool:
    result = await db.execute(select(TieredPrice).where(TieredPrice.id == uuid.UUID(tier_id)))
    t = result.scalar_one_or_none()
    if not t:
        return False
    await db.delete(t)
    await db.commit()
    return True


# ===== PROMOTIONS =====

async def create_promotion(db: AsyncSession, company_id: str, data: PromotionCreate) -> dict:
    cid = uuid.UUID(company_id)
    prom = Promotion(
        company_id=cid, nombre=data.nombre, descripcion=data.descripcion,
        tipo=data.tipo, fecha_inicio=data.fecha_inicio, fecha_fin=data.fecha_fin,
        condiciones=data.condiciones, prioridad=data.prioridad, max_usos=data.max_usos,
    )
    db.add(prom)
    await db.flush()

    for rd in data.rewards:
        r = PromotionReward(
            promotion_id=prom.id, product_id=uuid.UUID(rd["product_id"]),
            qty_required=rd.get("qty_required", 1), qty_free=rd.get("qty_free", 0),
            discount_pct=rd.get("discount_pct", 0), precio_fijo=rd.get("precio_fijo"),
        )
        db.add(r)
    for ad in data.assignments:
        a = PromotionAssignment(
            promotion_id=prom.id, tipo=ad["tipo"], ref_id=ad.get("ref_id"),
        )
        db.add(a)

    await db.flush()
    await db.refresh(prom)
    return await _promotion_to_full_dict(db, prom)


async def list_promotions(db: AsyncSession, company_id: str, activo: Optional[bool] = None) -> list[dict]:
    q = select(Promotion).where(Promotion.company_id == uuid.UUID(company_id))
    if activo is not None:
        q = q.where(Promotion.activo == activo)
    q = q.order_by(Promotion.created_at.desc())
    result = await db.execute(q)
    result_list = []
    for p in result.scalars().all():
        result_list.append(await _promotion_to_full_dict(db, p))
    return result_list


async def get_promotion(db: AsyncSession, promotion_id: str) -> Optional[dict]:
    result = await db.execute(select(Promotion).where(Promotion.id == uuid.UUID(promotion_id)))
    p = result.scalar_one_or_none()
    if not p:
        return None
    return await _promotion_to_full_dict(db, p)


async def update_promotion(db: AsyncSession, promotion_id: str, data: PromotionUpdate) -> Optional[dict]:
    result = await db.execute(select(Promotion).where(Promotion.id == uuid.UUID(promotion_id)))
    p = result.scalar_one_or_none()
    if not p:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(p, k, v)
    await db.flush()
    await db.refresh(p)
    return await _promotion_to_full_dict(db, p)


async def delete_promotion(db: AsyncSession, promotion_id: str) -> bool:
    pid = uuid.UUID(promotion_id)
    result = await db.execute(select(Promotion).where(Promotion.id == pid))
    p = result.scalar_one_or_none()
    if not p:
        return False
    # Delete associated rewards and assignments
    await db.execute(delete(PromotionReward).where(PromotionReward.promotion_id == pid))
    await db.execute(delete(PromotionAssignment).where(PromotionAssignment.promotion_id == pid))
    await db.delete(p)
    await db.commit()
    return True


async def get_active_promotions_for_customer(
    db: AsyncSession, company_id: str, customer_id: str,
    customer_group: Optional[str] = None, canal: Optional[str] = None, zona: Optional[str] = None
) -> list[dict]:
    now = datetime.now(timezone.utc)
    cid = uuid.UUID(company_id)

    q = select(Promotion).where(
        Promotion.company_id == cid,
        Promotion.activo == True,
        Promotion.fecha_inicio <= now,
        Promotion.fecha_fin >= now,
    )
    result = await db.execute(q)
    all_promos = result.scalars().all()

    eligible = []
    for p in all_promos:
        # Check assignments
        assign_result = await db.execute(
        select(PromotionAssignment).where(PromotionAssignment.promotion_id == p.id)
        )
        assigns = assign_result.scalars().all()
        if not assigns:
            # No assignments = applies to all
            eligible.append(p)
            continue
        for a in assigns:
            if a.tipo == "all":
                eligible.append(p)
                break
            elif a.tipo == "cliente" and customer_id and str(a.ref_id) == customer_id:
                eligible.append(p)
                break
            elif a.tipo == "grupo" and customer_group and a.ref_id == customer_group:
                eligible.append(p)
                break
            elif a.tipo == "canal" and canal and a.ref_id == canal:
                eligible.append(p)
                break
            elif a.tipo == "zona" and zona and a.ref_id == zona:
                eligible.append(p)
                break

    result_list = []
    for p in eligible:
        result_list.append(await _promotion_to_full_dict(db, p))
    return result_list


# ===== PRICE SUGGESTIONS (IA) =====

async def create_suggestion(db: AsyncSession, company_id: str, data: PriceSuggestionCreate) -> dict:
    s = PriceSuggestion(company_id=uuid.UUID(company_id), **data.model_dump())
    db.add(s)
    await db.flush()
    await db.refresh(s)
    return _suggestion_to_dict(s)


async def list_suggestions(
    db: AsyncSession, company_id: str, estado: Optional[str] = None,
    source: Optional[str] = None
) -> list[dict]:
    q = select(PriceSuggestion).where(
        PriceSuggestion.company_id == uuid.UUID(company_id)
    )
    if estado:
        q = q.where(PriceSuggestion.estado == estado)
    if source:
        q = q.where(PriceSuggestion.source == source)
    q = q.order_by(PriceSuggestion.created_at.desc())
    result = await db.execute(q)
    return [_suggestion_to_dict(r) for r in result.scalars().all()]


async def review_suggestion(db: AsyncSession, suggestion_id: str, data: PriceSuggestionUpdate) -> Optional[dict]:
    result = await db.execute(select(PriceSuggestion).where(PriceSuggestion.id == uuid.UUID(suggestion_id)))
    s = result.scalar_one_or_none()
    if not s:
        return None
    s.estado = data.estado
    s.reviewed_by = uuid.UUID(str(data.reviewed_by)) if data.reviewed_by else None
    s.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(s)
    return _suggestion_to_dict(s)


async def generate_dynamic_price(db: AsyncSession, company_id: str, data: DynamicPriceRequest) -> dict:
    """Generate a dynamic price suggestion based on cost, demand, seasonality, and margin target."""
    costo = data.costo_promedio or 0
    current = data.current_price
    factors = {}

    if costo > 0 and data.margen_objetivo:
        price_by_margin = costo / (1 - data.margen_objetivo / 100)
        factors["price_by_margin"] = round(price_by_margin, 2)
    else:
        price_by_margin = current * 1.15  # default 15% margin assumption
        factors["price_by_margin"] = round(price_by_margin, 2)

    if data.demanda_historica is not None:
        demand_factor = min(data.demanda_historica / 100, 2.0)
        factors["demand_factor"] = round(demand_factor, 2)
    else:
        demand_factor = 1.0
        factors["demand_factor"] = 1.0

    if data.estacionalidad:
        factors["seasonality"] = data.estacionalidad
        season_factor = data.estacionalidad
    else:
        season_factor = 1.0
        factors["seasonality"] = 1.0

    stock_factor = 1.0
    if data.stock_actual is not None and data.stock_actual > 100:
        stock_factor = 0.95  # excess stock → reduce price
        factors["stock_factor"] = 0.95
    elif data.stock_actual is not None and data.stock_actual < 10:
        stock_factor = 1.10  # low stock → increase price
        factors["stock_factor"] = 1.10
    else:
        factors["stock_factor"] = 1.0

    base_price = (price_by_margin * 0.5 + current * 0.5)
    suggested = base_price * demand_factor * season_factor * stock_factor

    # Constrain: not below cost and not above 3x cost
    if costo > 0 and suggested < costo:
        suggested = costo * 1.05
    if costo > 0 and suggested > costo * 3:
        suggested = costo * 2.5

    confidence = 85.0  # base
    confidence -= abs(1.0 - season_factor) * 10
    if data.demanda_historica is None:
        confidence -= 15
    if data.costo_promedio is None:
        confidence -= 10
    confidence = max(30, min(99, confidence))

    factors["base_price"] = round(base_price, 2)
    factors["cost"] = costo
    factors["current_price"] = current

    source_parts = []
    if data.costo_promedio and data.margen_objetivo:
        source_parts.append("costo_margen")
    if data.demanda_historica is not None:
        source_parts.append("demanda")
    if data.estacionalidad and data.estacionalidad != 1.0:
        source_parts.append("estacionalidad")
    if data.stock_actual is not None:
        source_parts.append("stock")
    source = "_".join(source_parts) if source_parts else "mixto"

    return {
        "suggested_price": round(suggested, 2),
        "confidence": round(confidence, 1),
        "factors": factors,
        "source": source,
    }


# ===== PRICE CHANGE REQUESTS (Approval Workflow) =====

async def create_change_request(db: AsyncSession, company_id: str, data: PriceChangeRequestCreate, user_id: str) -> dict:
    cr = PriceChangeRequest(
        company_id=uuid.UUID(company_id),
        product_id=data.product_id,
        price_list_id=data.price_list_id,
        old_price=data.old_price,
        new_price=data.new_price,
        reason=data.reason,
        requested_by=uuid.UUID(user_id),
        approval_level=data.approval_level,
    )
    db.add(cr)
    await db.flush()
    await db.refresh(cr)
    return _change_request_to_dict(cr)


async def list_change_requests(
    db: AsyncSession, company_id: str, status: Optional[str] = None
) -> list[dict]:
    q = select(PriceChangeRequest).where(
        PriceChangeRequest.company_id == uuid.UUID(company_id)
    )
    if status:
        q = q.where(PriceChangeRequest.status == status)
    q = q.order_by(PriceChangeRequest.created_at.desc())
    result = await db.execute(q)
    return [_change_request_to_dict(r) for r in result.scalars().all()]


async def review_change_request(db: AsyncSession, request_id: str, data: PriceChangeRequestReview) -> Optional[dict]:
    result = await db.execute(select(PriceChangeRequest).where(PriceChangeRequest.id == uuid.UUID(request_id)))
    cr = result.scalar_one_or_none()
    if not cr:
        return None
    if cr.status != "pending":
        raise ValueError("Request already reviewed")

    if data.status == "approved":
        if cr.approval_level == 2:
            cr.status = "approved_1"
        else:
            cr.status = "approved"
            cr.approved_by = uuid.UUID(str(data.approved_by))
            _log_price_change(db, cr.company_id, cr.product_id, cr.price_list_id,
                              cr.old_price, cr.new_price, data.approved_by, "approval", cr.reason)
    else:
        cr.status = "rejected"

    cr.comments = data.comments
    if not cr.approved_by and data.status == "approved":
        cr.approved_by = uuid.UUID(str(data.approved_by))
    await db.flush()
    await db.refresh(cr)
    return _change_request_to_dict(cr)


async def approve_level_2(db: AsyncSession, request_id: str, data: PriceChangeRequestReview) -> Optional[dict]:
    result = await db.execute(select(PriceChangeRequest).where(PriceChangeRequest.id == uuid.UUID(request_id)))
    cr = result.scalar_one_or_none()
    if not cr:
        return None
    if cr.status != "approved_1":
        raise ValueError("Level 1 approval required first")
    cr.status = "approved" if data.status == "approved" else "rejected"
    cr.approved_by = uuid.UUID(str(data.approved_by))
    cr.comments = data.comments
    if data.status == "approved":
        _log_price_change(db, cr.company_id, cr.product_id, cr.price_list_id,
                          cr.old_price, cr.new_price, data.approved_by, "approval", cr.reason)
    await db.flush()
    await db.refresh(cr)
    return _change_request_to_dict(cr)


def _log_price_change(db: AsyncSession, company_id, product_id, price_list_id,
                       old_price, new_price, changed_by, change_type, reason):
    h = PriceChangeHistory(
        company_id=company_id, product_id=product_id, price_list_id=price_list_id,
        old_price=old_price, new_price=new_price, changed_by=changed_by,
        change_type=change_type, reason=reason,
    )
    db.add(h)


# ===== PRICE CHANGE HISTORY =====

async def list_price_history(
    db: AsyncSession, company_id: str, product_id: Optional[str] = None,
    limit: int = 50
) -> list[dict]:
    q = select(PriceChangeHistory).where(
        PriceChangeHistory.company_id == uuid.UUID(company_id)
    )
    if product_id:
        q = q.where(PriceChangeHistory.product_id == uuid.UUID(product_id))
    q = q.order_by(PriceChangeHistory.created_at.desc()).limit(limit)
    result = await db.execute(q)
    return [_history_to_dict(r) for r in result.scalars().all()]


# ===== DASHBOARD =====

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)

    # Total price lists (from price_lists module)
    total_pl = 0
    try:
        from api.src.price_lists.models import PriceList
        result = await db.execute(
            select(sa_func.count(PriceList.id)).where(
                PriceList.company_id == cid
            )
        )
        total_pl = result.scalar() or 0
    except Exception:
        pass

    # Active promotions
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(sa_func.count(Promotion.id)).where(
            Promotion.company_id == cid,
            Promotion.activo == True,
            Promotion.fecha_inicio <= now,
            Promotion.fecha_fin >= now,
        )
    )
    active_promos = result.scalar() or 0

    # Pending suggestions
    result = await db.execute(
        select(sa_func.count(PriceSuggestion.id)).where(
            PriceSuggestion.company_id == cid,
            PriceSuggestion.estado == "pending",
        )
    )
    pending_suggestions = result.scalar() or 0

    # Pending requests
    result = await db.execute(
        select(sa_func.count(PriceChangeRequest.id)).where(
            PriceChangeRequest.company_id == cid,
            PriceChangeRequest.status == "pending",
        )
    )
    pending_requests = result.scalar() or 0

    # Recent changes
    recent = await list_price_history(db, company_id, limit=10)

    return {
        "total_price_lists": total_pl,
        "active_promotions": active_promos,
        "pending_suggestions": pending_suggestions,
        "pending_requests": pending_requests,
        "recent_changes": recent,
    }


# ===== HELPERS =====

def _assignment_to_dict(a: PriceListAssignment) -> dict:
    return {
        "id": str(a.id),
        "company_id": str(a.company_id),
        "price_list_id": str(a.price_list_id),
        "tipo": a.tipo,
        "ref_id": a.ref_id,
        "created_at": a.created_at,
    }


def _tiered_to_dict(t: TieredPrice) -> dict:
    return {
        "id": str(t.id),
        "company_id": str(t.company_id),
        "price_list_id": str(t.price_list_id) if t.price_list_id else None,
        "product_id": str(t.product_id),
        "min_qty": t.min_qty,
        "max_qty": t.max_qty,
        "precio_unitario": float(t.precio_unitario),
        "moneda": t.moneda,
        "activo": t.activo,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


async def _promotion_to_full_dict(db: AsyncSession, p: Promotion) -> dict:
    rewards_result = await db.execute(
        select(PromotionReward).where(PromotionReward.promotion_id == p.id)
    )
    rewards = [_reward_to_dict(r) for r in rewards_result.scalars().all()]

    assign_result = await db.execute(
        select(PromotionAssignment).where(PromotionAssignment.promotion_id == p.id)
    )
    assignments = [_assign_to_dict(a) for a in assign_result.scalars().all()]

    return {
        "id": str(p.id),
        "company_id": str(p.company_id),
        "nombre": p.nombre,
        "descripcion": p.descripcion,
        "tipo": p.tipo,
        "fecha_inicio": p.fecha_inicio,
        "fecha_fin": p.fecha_fin,
        "activo": p.activo,
        "condiciones": p.condiciones,
        "prioridad": p.prioridad,
        "max_usos": p.max_usos,
        "usos_actuales": p.usos_actuales,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "rewards": rewards,
        "assignments": assignments,
    }


def _reward_to_dict(r: PromotionReward) -> dict:
    return {
        "id": str(r.id),
        "promotion_id": str(r.promotion_id),
        "product_id": str(r.product_id),
        "qty_required": r.qty_required,
        "qty_free": r.qty_free,
        "discount_pct": float(r.discount_pct),
        "precio_fijo": float(r.precio_fijo) if r.precio_fijo else None,
        "created_at": r.created_at,
    }


def _assign_to_dict(a: PromotionAssignment) -> dict:
    return {
        "id": str(a.id),
        "promotion_id": str(a.promotion_id),
        "tipo": a.tipo,
        "ref_id": a.ref_id,
        "created_at": a.created_at,
    }


def _suggestion_to_dict(s: PriceSuggestion) -> dict:
    return {
        "id": str(s.id),
        "company_id": str(s.company_id),
        "product_id": str(s.product_id),
        "current_price": float(s.current_price),
        "suggested_price": float(s.suggested_price),
        "confidence": float(s.confidence) if s.confidence else None,
        "factors": s.factors,
        "source": s.source,
        "estado": s.estado,
        "reviewed_by": str(s.reviewed_by) if s.reviewed_by else None,
        "reviewed_at": s.reviewed_at,
        "created_at": s.created_at,
    }


def _change_request_to_dict(cr: PriceChangeRequest) -> dict:
    return {
        "id": str(cr.id),
        "company_id": str(cr.company_id),
        "product_id": str(cr.product_id),
        "price_list_id": str(cr.price_list_id) if cr.price_list_id else None,
        "old_price": float(cr.old_price),
        "new_price": float(cr.new_price),
        "reason": cr.reason,
        "requested_by": str(cr.requested_by),
        "approved_by": str(cr.approved_by) if cr.approved_by else None,
        "status": cr.status,
        "approval_level": cr.approval_level,
        "comments": cr.comments,
        "created_at": cr.created_at,
        "updated_at": cr.updated_at,
    }


def _history_to_dict(h: PriceChangeHistory) -> dict:
    return {
        "id": str(h.id),
        "company_id": str(h.company_id),
        "product_id": str(h.product_id),
        "price_list_id": str(h.price_list_id) if h.price_list_id else None,
        "old_price": float(h.old_price),
        "new_price": float(h.new_price),
        "changed_by": str(h.changed_by),
        "change_type": h.change_type,
        "reason": h.reason,
        "created_at": h.created_at,
    }
