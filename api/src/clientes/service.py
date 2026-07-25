from sqlalchemy import select, func as sa_func, and_, desc, delete, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid, math, random, string

from api.src.clientes.models import (
    RfmScore, BehavioralSegment, CustomerSegmentAssignment,
    LoyaltyProgram, LoyaltyTransaction, PersonalizedOffer, CouponCode,
)
from api.src.clientes.schemas import (
    RfmScoreOut, BehavioralSegmentCreate, BehavioralSegmentUpdate, BehavioralSegmentOut,
    LoyaltyProgramOut, LoyaltyProgramUpdate, LoyaltyTransactionCreate, LoyaltyTransactionOut,
    LoyaltySummary, PersonalizedOfferCreate, PersonalizedOfferUpdate, PersonalizedOfferOut,
    CouponCodeGenerate, CouponCodeOut, CouponValidateRequest, CouponValidateResponse,
    ClientesDashboard,
)
from api.src.customers.models import Partner
from api.src.sales.models import Sale


# --- RFM Calculation ---

RFM_SEGMENTS = {
    (5, 5): "Leales Premium",
    (4, 4): "Leales",
    (3, 3): "Regulares",
    (2, 2): "Ocasionales",
    (1, 1): "Perdidos",
}

SYSTEM_SEGMENTS = [
    {"nombre": "Leales Premium", "slug": "leales-premium", "rfm_min": 13, "rfm_max": 15, "color": "#8b5cf6"},
    {"nombre": "Leales", "slug": "leales", "rfm_min": 10, "rfm_max": 12, "color": "#22c55e"},
    {"nombre": "Regulares", "slug": "regulares", "rfm_min": 7, "rfm_max": 9, "color": "#3b82f6"},
    {"nombre": "Ocasionales", "slug": "ocasionales", "rfm_min": 4, "rfm_max": 6, "color": "#f59e0b"},
    {"nombre": "Perdidos", "slug": "perdidos", "rfm_min": 3, "rfm_max": 3, "color": "#ef4444"},
    {"nombre": "En Riesgo", "slug": "en-riesgo", "rfm_max": 6, "rules": {"recency_high": True}, "color": "#f97316"},
    {"nombre": "Nuevos", "slug": "nuevos", "rules": {"is_new": True}, "color": "#06b6d4"},
    {"nombre": "High Value", "slug": "high-value", "rfm_min": 10, "rules": {"monetary_high": True}, "color": "#d946ef"},
    {"nombre": "Promocionales", "slug": "promocionales", "rules": {"promo_lover": True}, "color": "#14b8a6"},
]


async def _compute_rfm(db: AsyncSession, company_id: str, customer_id: str) -> Optional[RfmScore]:
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Partner).where(Partner.id == customer_id, Partner.company_id == company_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        return None

    result = await db.execute(
        select(Sale).where(
            Sale.customer_id == customer_id,
            Sale.company_id == company_id,
        ).order_by(desc(Sale.fecha)).limit(1)
    )
    last_sale = result.scalar_one_or_none()

    result = await db.execute(
        select(sa_func.count(), sa_func.coalesce(sa_func.sum(Sale.total), 0))
        .where(Sale.customer_id == customer_id, Sale.company_id == company_id)
    )
    total_count, total_amount = result.one()

    recency_days = (now - last_sale.fecha.replace(tzinfo=timezone.utc)).days if last_sale and last_sale.fecha else 999
    frequency_count = total_count or 0
    monetary_total = float(total_amount or 0)

    recency_score = 5 if recency_days <= 7 else 4 if recency_days <= 30 else 3 if recency_days <= 60 else 2 if recency_days <= 180 else 1
    frequency_score = 5 if frequency_count >= 20 else 4 if frequency_count >= 10 else 3 if frequency_count >= 5 else 2 if frequency_count >= 2 else 1
    monetary_score = 5 if monetary_total >= 50000000 else 4 if monetary_total >= 10000000 else 3 if monetary_total >= 5000000 else 2 if monetary_total >= 1000000 else 1

    rfm_total = recency_score + frequency_score + monetary_score

    segment_name = "Indefinido"
    for (r_min, f_min), seg in sorted(RFM_SEGMENTS.items(), reverse=True):
        if recency_score >= r_min and frequency_score >= f_min:
            segment_name = seg
            break

    result = await db.execute(
        select(RfmScore).where(RfmScore.customer_id == customer_id, RfmScore.company_id == company_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.recency_days = recency_days
        existing.recency_score = recency_score
        existing.frequency_count = frequency_count
        existing.frequency_score = frequency_score
        existing.monetary_total = monetary_total
        existing.monetary_score = monetary_score
        existing.rfm_total = rfm_total
        existing.rfm_segment = segment_name
        existing.last_evaluation_date = now
        await db.flush()
        return existing
    else:
        rfm = RfmScore(
            company_id=uuid.UUID(company_id),
            customer_id=uuid.UUID(customer_id),
            recency_days=recency_days,
            recency_score=recency_score,
            frequency_count=frequency_count,
            frequency_score=frequency_score,
            monetary_total=monetary_total,
            monetary_score=monetary_score,
            rfm_total=rfm_total,
            rfm_segment=segment_name,
        )
        db.add(rfm)
        await db.flush()
        return rfm


async def evaluate_rfm(db: AsyncSession, company_id: str, customer_id: str) -> Optional[dict]:
    rfm = await _compute_rfm(db, company_id, customer_id)
    if not rfm:
        return None
    await _assign_auto_segments(db, company_id, customer_id)
    return RfmScoreOut.model_validate(rfm).model_dump()


async def bulk_evaluate_rfm(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(Partner).where(Partner.company_id == company_id, Partner.activo == True)
    )
    customers = result.scalars().all()
    evaluated = 0
    for c in customers:
        rfm = await _compute_rfm(db, company_id, str(c.id))
        if rfm:
            evaluated += 1
            await _assign_auto_segments(db, company_id, str(c.id))
    return {"evaluated": evaluated}


async def list_rfm_scores(
    db: AsyncSession, company_id: str,
    segment: Optional[str] = None, rfm_min: Optional[int] = None,
    limit: int = 100, offset: int = 0,
) -> list[dict]:
    query = select(RfmScore).where(RfmScore.company_id == company_id)
    if segment:
        query = query.where(RfmScore.rfm_segment == segment)
    if rfm_min:
        query = query.where(RfmScore.rfm_total >= rfm_min)
    query = query.order_by(desc(RfmScore.rfm_total)).offset(offset).limit(limit)
    result = await db.execute(query)
    scores = result.scalars().all()
    return [RfmScoreOut.model_validate(s).model_dump() for s in scores]


async def get_rfm_summary(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(
            sa_func.count(), sa_func.avg(RfmScore.rfm_total),
            sa_func.avg(RfmScore.recency_days),
        ).where(RfmScore.company_id == company_id)
    )
    count, avg_rfm, avg_recency = result.one()

    result = await db.execute(
        select(RfmScore.rfm_segment, sa_func.count())
        .where(RfmScore.company_id == company_id)
        .group_by(RfmScore.rfm_segment)
    )
    distribution = {row[0]: row[1] for row in result.all()}

    return {
        "total_with_rfm": count or 0,
        "average_rfm": round(float(avg_rfm), 1) if avg_rfm else 0,
        "average_recency_days": round(float(avg_recency), 1) if avg_recency else 0,
        "distribution": distribution,
    }


# --- Behavioral Segments ---

async def _ensure_system_segments(db: AsyncSession, company_id: str):
    for seg in SYSTEM_SEGMENTS:
        result = await db.execute(
            select(BehavioralSegment).where(
                BehavioralSegment.company_id == company_id,
                BehavioralSegment.slug == seg["slug"],
            )
        )
        existing = result.scalar_one_or_none()
        if not existing:
            bs = BehavioralSegment(
                company_id=uuid.UUID(company_id),
                nombre=seg["nombre"],
                slug=seg["slug"],
                color=seg["color"],
                rfm_min=seg.get("rfm_min"),
                rfm_max=seg.get("rfm_max"),
                rules=seg.get("rules"),
                is_system=True,
            )
            db.add(bs)


async def _assign_auto_segments(db: AsyncSession, company_id: str, customer_id: str):
    result = await db.execute(
        select(BehavioralSegment).where(
            BehavioralSegment.company_id == company_id,
            BehavioralSegment.activo == True,
        )
    )
    segments = result.scalars().all()

    result = await db.execute(
        select(RfmScore).where(RfmScore.customer_id == customer_id, RfmScore.company_id == company_id)
    )
    rfm = result.scalar_one_or_none()
    if not rfm:
        return

    result = await db.execute(
        select(Partner).where(Partner.id == customer_id, Partner.company_id == company_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        return

    for seg in segments:
        matches = True
        if seg.rfm_min is not None and rfm.rfm_total < seg.rfm_min:
            matches = False
        if seg.rfm_max is not None and rfm.rfm_total > seg.rfm_max:
            matches = False
        if seg.rules:
            if seg.rules.get("recency_high") and rfm.recency_days and rfm.recency_days <= 60:
                pass
            elif seg.rules.get("recency_high"):
                matches = False
            if seg.rules.get("monetary_high") and rfm.monetary_total and float(rfm.monetary_total) >= 10000000:
                pass
            elif seg.rules.get("monetary_high"):
                matches = False
            if seg.rules.get("is_new"):
                created = customer.created_at.replace(tzinfo=timezone.utc) if customer.created_at else None
                if created and (datetime.now(timezone.utc) - created).days > 90:
                    matches = False

        result = await db.execute(
            select(CustomerSegmentAssignment).where(
                CustomerSegmentAssignment.company_id == company_id,
                CustomerSegmentAssignment.customer_id == customer_id,
                CustomerSegmentAssignment.segment_id == seg.id,
            )
        )
        existing_assign = result.scalar_one_or_none()

        if matches and not existing_assign:
            assign = CustomerSegmentAssignment(
                company_id=uuid.UUID(company_id),
                customer_id=uuid.UUID(customer_id),
                segment_id=seg.id,
                assigned_by="auto",
            )
            db.add(assign)
            seg.customer_count = (seg.customer_count or 0) + 1
        elif not matches and existing_assign:
            await db.delete(existing_assign)
            seg.customer_count = max(0, (seg.customer_count or 0) - 1)


async def create_segment(db: AsyncSession, company_id: str, data: BehavioralSegmentCreate) -> dict:
    seg = BehavioralSegment(
        company_id=uuid.UUID(company_id),
        nombre=data.nombre,
        descripcion=data.descripcion,
        slug=data.slug,
        color=data.color or "#6366f1",
        rfm_min=data.rfm_min,
        rfm_max=data.rfm_max,
        rules=data.rules,
    )
    db.add(seg)
    await db.flush()
    return BehavioralSegmentOut.model_validate(seg).model_dump()


async def list_segments(db: AsyncSession, company_id: str) -> list[dict]:
    await _ensure_system_segments(db, company_id)
    result = await db.execute(
        select(BehavioralSegment).where(BehavioralSegment.company_id == company_id).order_by(BehavioralSegment.nombre)
    )
    segments = result.scalars().all()
    return [BehavioralSegmentOut.model_validate(s).model_dump() for s in segments]


async def update_segment(db: AsyncSession, company_id: str, seg_id: str, data: BehavioralSegmentUpdate) -> Optional[dict]:
    result = await db.execute(
        select(BehavioralSegment).where(BehavioralSegment.id == seg_id, BehavioralSegment.company_id == company_id)
    )
    seg = result.scalar_one_or_none()
    if not seg:
        return None
    if data.nombre is not None:
        seg.nombre = data.nombre
    if data.descripcion is not None:
        seg.descripcion = data.descripcion
    if data.color is not None:
        seg.color = data.color
    if data.rfm_min is not None:
        seg.rfm_min = data.rfm_min
    if data.rfm_max is not None:
        seg.rfm_max = data.rfm_max
    if data.rules is not None:
        seg.rules = data.rules
    if data.activo is not None:
        seg.activo = data.activo
    await db.flush()
    return BehavioralSegmentOut.model_validate(seg).model_dump()


async def get_segment_customers(db: AsyncSession, company_id: str, seg_id: str, limit: int = 100, offset: int = 0) -> list[dict]:
    result = await db.execute(
        select(CustomerSegmentAssignment).where(
            CustomerSegmentAssignment.company_id == company_id,
            CustomerSegmentAssignment.segment_id == seg_id,
        ).offset(offset).limit(limit)
    )
    assigns = result.scalars().all()

    from api.src.customers.schemas import PartnerResponse
    customers = []
    for a in assigns:
        r = await db.execute(select(Partner).where(Partner.id == a.customer_id))
        cust = r.scalar_one_or_none()
        if cust:
            customers.append(PartnerResponse.model_validate(cust).model_dump())
    return customers


# --- Loyalty ---

async def get_or_create_program(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.company_id == company_id)
    )
    prog = result.scalar_one_or_none()
    if not prog:
        prog = LoyaltyProgram(company_id=uuid.UUID(company_id))
        db.add(prog)
        await db.flush()
    return LoyaltyProgramOut.model_validate(prog).model_dump()


async def update_program(db: AsyncSession, company_id: str, data: LoyaltyProgramUpdate) -> Optional[dict]:
    result = await db.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.company_id == company_id)
    )
    prog = result.scalar_one_or_none()
    if not prog:
        return None
    for field in data.model_dump(exclude_none=True):
        setattr(prog, field, getattr(data, field))
    await db.flush()
    return LoyaltyProgramOut.model_validate(prog).model_dump()


async def create_loyalty_transaction(db: AsyncSession, company_id: str, data: LoyaltyTransactionCreate, user_id: Optional[str] = None) -> dict:
    txn = LoyaltyTransaction(
        company_id=uuid.UUID(company_id),
        customer_id=data.customer_id,
        tipo=data.tipo,
        puntos=data.puntos,
        concepto=data.concepto,
        order_id=data.order_id,
        reference_type=data.reference_type,
        reference_id=data.reference_id,
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(txn)
    await db.flush()

    result = await db.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.company_id == company_id)
    )
    prog = result.scalar_one_or_none()

    if not prog:
        total_points = data.puntos if data.tipo == "acumulacion" else -data.puntos
        return {**LoyaltyTransactionOut.model_validate(txn).model_dump(), "current_balance": total_points}

    result = await db.execute(
        select(sa_func.coalesce(sa_func.sum(LoyaltyTransaction.puntos).filter(LoyaltyTransaction.tipo == "acumulacion"), 0),
               sa_func.coalesce(sa_func.sum(LoyaltyTransaction.puntos).filter(LoyaltyTransaction.tipo == "canje"), 0))
        .where(LoyaltyTransaction.company_id == company_id, LoyaltyTransaction.customer_id == data.customer_id)
    )
    earned, redeemed = result.one()
    balance = (earned or 0) - (redeemed or 0)
    return {**LoyaltyTransactionOut.model_validate(txn).model_dump(), "current_balance": balance}


async def list_loyalty_transactions(
    db: AsyncSession, company_id: str, customer_id: Optional[str] = None,
    tipo: Optional[str] = None, limit: int = 100, offset: int = 0,
) -> list[dict]:
    query = select(LoyaltyTransaction).where(LoyaltyTransaction.company_id == company_id)
    if customer_id:
        query = query.where(LoyaltyTransaction.customer_id == customer_id)
    if tipo:
        query = query.where(LoyaltyTransaction.tipo == tipo)
    query = query.order_by(desc(LoyaltyTransaction.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    txns = result.scalars().all()
    return [LoyaltyTransactionOut.model_validate(t).model_dump() for t in txns]


async def get_loyalty_summary(db: AsyncSession, company_id: str, customer_id: str) -> Optional[dict]:
    result = await db.execute(
        select(sa_func.coalesce(sa_func.sum(LoyaltyTransaction.puntos).filter(LoyaltyTransaction.tipo == "acumulacion"), 0),
               sa_func.coalesce(sa_func.sum(LoyaltyTransaction.puntos).filter(LoyaltyTransaction.tipo == "canje"), 0))
        .where(LoyaltyTransaction.company_id == company_id, LoyaltyTransaction.customer_id == customer_id)
    )
    earned, redeemed = result.one()
    earned = earned or 0
    redeemed = redeemed or 0
    balance = earned - redeemed

    result = await db.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.company_id == company_id)
    )
    prog = result.scalar_one_or_none()

    current_tier = "Bronze"
    next_tier = None
    points_to_next_tier = 0

    if prog and prog.tier_enabled:
        if balance >= prog.tier_platinum_min:
            current_tier = "Platinum"
        elif balance >= prog.tier_gold_min:
            current_tier = "Gold"
            next_tier = "Platinum"
            points_to_next_tier = prog.tier_platinum_min - balance
        elif balance >= prog.tier_silver_min:
            current_tier = "Silver"
            next_tier = "Gold"
            points_to_next_tier = prog.tier_gold_min - balance
        else:
            current_tier = "Bronze"
            next_tier = "Silver"
            points_to_next_tier = prog.tier_silver_min - balance

    return LoyaltySummary(
        total_points=balance,
        lifetime_earned=earned,
        lifetime_redeemed=redeemed,
        current_tier=current_tier,
        next_tier=next_tier,
        points_to_next_tier=max(0, points_to_next_tier),
    ).model_dump()


# --- Personalized Offers ---

async def create_offer(db: AsyncSession, company_id: str, data: PersonalizedOfferCreate) -> dict:
    offer = PersonalizedOffer(
        company_id=uuid.UUID(company_id),
        nombre=data.nombre,
        descripcion=data.descripcion,
        offer_type=data.offer_type,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        min_purchase=data.min_purchase or 0,
        target_type=data.target_type,
        target_segment_id=data.target_segment_id,
        target_customer_id=data.target_customer_id,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        max_redemptions=data.max_redemptions or 0,
    )
    db.add(offer)
    await db.flush()
    return PersonalizedOfferOut.model_validate(offer).model_dump()


async def list_offers(
    db: AsyncSession, company_id: str,
    offer_type: Optional[str] = None, target_type: Optional[str] = None,
    activo: Optional[bool] = None, limit: int = 100, offset: int = 0,
) -> list[dict]:
    query = select(PersonalizedOffer).where(PersonalizedOffer.company_id == company_id)
    if offer_type:
        query = query.where(PersonalizedOffer.offer_type == offer_type)
    if target_type:
        query = query.where(PersonalizedOffer.target_type == target_type)
    if activo is not None:
        query = query.where(PersonalizedOffer.activo == activo)
    query = query.order_by(desc(PersonalizedOffer.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    offers = result.scalars().all()
    return [PersonalizedOfferOut.model_validate(o).model_dump() for o in offers]


async def update_offer(db: AsyncSession, company_id: str, offer_id: str, data: PersonalizedOfferUpdate) -> Optional[dict]:
    result = await db.execute(
        select(PersonalizedOffer).where(PersonalizedOffer.id == offer_id, PersonalizedOffer.company_id == company_id)
    )
    offer = result.scalar_one_or_none()
    if not offer:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(offer, field, value)
    await db.flush()
    return PersonalizedOfferOut.model_validate(offer).model_dump()


# --- Coupon Codes ---

def _generate_coupon_code(length: int = 10) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


async def generate_coupons(db: AsyncSession, company_id: str, data: CouponCodeGenerate) -> list[dict]:
    codes = []
    for _ in range(data.count or 1):
        coupon = CouponCode(
            company_id=uuid.UUID(company_id),
            offer_id=data.offer_id,
            customer_id=data.customer_id,
            code=_generate_coupon_code(),
            discount_type=data.discount_type,
            discount_value=data.discount_value,
            min_purchase=data.min_purchase or 0,
            is_percentage=data.is_percentage if data.is_percentage is not None else True,
            max_uses=data.max_uses or 1,
            expires_at=data.expires_at,
            starts_at=datetime.now(timezone.utc),
        )
        db.add(coupon)
        codes.append(coupon)
    await db.flush()
    return [CouponCodeOut.model_validate(c).model_dump() for c in codes]


async def list_coupons(
    db: AsyncSession, company_id: str,
    is_active: Optional[bool] = None, customer_id: Optional[str] = None,
    limit: int = 100, offset: int = 0,
) -> list[dict]:
    query = select(CouponCode).where(CouponCode.company_id == company_id)
    if is_active is not None:
        query = query.where(CouponCode.is_active == is_active)
    if customer_id:
        query = query.where(CouponCode.customer_id == customer_id)
    query = query.order_by(desc(CouponCode.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    coupons = result.scalars().all()
    return [CouponCodeOut.model_validate(c).model_dump() for c in coupons]


async def validate_coupon(db: AsyncSession, company_id: str, data: CouponValidateRequest) -> dict:
    result = await db.execute(
        select(CouponCode).where(CouponCode.code == data.code, CouponCode.company_id == company_id)
    )
    coupon = result.scalar_one_or_none()

    if not coupon:
        return CouponValidateResponse(valid=False, message="Cupón no encontrado").model_dump()
    if not coupon.is_active:
        return CouponValidateResponse(valid=False, message="Cupón desactivado").model_dump()
    if coupon.max_uses > 0 and coupon.current_uses >= coupon.max_uses:
        return CouponValidateResponse(valid=False, message="Cupón agotado").model_dump()
    if coupon.expires_at and coupon.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return CouponValidateResponse(valid=False, message="Cupón vencido").model_dump()
    if coupon.customer_id and data.customer_id and str(coupon.customer_id) != data.customer_id:
        return CouponValidateResponse(valid=False, message="Cupón no válido para este cliente").model_dump()

    purchase = data.purchase_amount or 0
    if purchase < float(coupon.min_purchase):
        return CouponValidateResponse(
            valid=False,
            message=f"Compra mínima: Gs. {float(coupon.min_purchase):,.0f}",
        ).model_dump()

    discount = float(coupon.discount_value)
    if coupon.is_percentage:
        discount_amount = purchase * discount / 100
    else:
        discount_amount = discount

    final = max(0, purchase - discount_amount)

    return CouponValidateResponse(
        valid=True,
        message="Cupón válido",
        discount_amount=round(discount_amount),
        final_amount=round(final),
    ).model_dump()


async def redeem_coupon(db: AsyncSession, company_id: str, code: str) -> Optional[dict]:
    result = await db.execute(
        select(CouponCode).where(CouponCode.code == code, CouponCode.company_id == company_id)
    )
    coupon = result.scalar_one_or_none()
    if not coupon:
        return None
    coupon.current_uses = (coupon.current_uses or 0) + 1
    coupon.used_at = datetime.now(timezone.utc)
    if coupon.max_uses > 0 and coupon.current_uses >= coupon.max_uses:
        coupon.is_active = False
    await db.flush()
    return CouponCodeOut.model_validate(coupon).model_dump()


# --- Dashboard ---

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(sa_func.count()).where(RfmScore.company_id == company_id)
    )
    total_with_rfm = result.scalar() or 0

    result = await db.execute(
        select(RfmScore.rfm_segment, sa_func.count())
        .where(RfmScore.company_id == company_id)
        .group_by(RfmScore.rfm_segment)
    )
    rfm_distribution = {row[0]: row[1] for row in result.all()}

    result = await db.execute(
        select(BehavioralSegment.nombre, BehavioralSegment.customer_count, BehavioralSegment.color)
        .where(BehavioralSegment.company_id == company_id, BehavioralSegment.activo == True)
    )
    segment_breakdown = [
        {"nombre": row[0], "count": row[1] or 0, "color": row[2]}
        for row in result.all()
    ]

    result = await db.execute(
        select(
            sa_func.coalesce(sa_func.sum(LoyaltyTransaction.puntos).filter(LoyaltyTransaction.tipo == "acumulacion"), 0),
            sa_func.coalesce(sa_func.sum(LoyaltyTransaction.puntos).filter(LoyaltyTransaction.tipo == "canje"), 0),
        ).where(LoyaltyTransaction.company_id == company_id)
    )
    total_earned, total_redeemed = result.one()

    result = await db.execute(
        select(sa_func.count()).where(
            PersonalizedOffer.company_id == company_id,
            PersonalizedOffer.activo == True,
            PersonalizedOffer.ends_at >= datetime.now(timezone.utc),
        )
    )
    active_offers = result.scalar() or 0

    result = await db.execute(
        select(sa_func.count()).where(
            CouponCode.company_id == company_id,
            CouponCode.is_active == True,
        )
    )
    active_coupons = result.scalar() or 0

    result = await db.execute(
        select(sa_func.count()).where(
            CouponCode.company_id == company_id,
            CouponCode.current_uses > 0,
        )
    )
    redeemed_coupons = result.scalar() or 0

    return ClientesDashboard(
        total_customers_with_rfm=total_with_rfm,
        rfm_distribution=rfm_distribution,
        segment_breakdown=segment_breakdown,
        loyalty_summary={
            "total_earned": float(total_earned or 0),
            "total_redeemed": float(total_redeemed or 0),
            "active_program": True,
        },
        active_offers=active_offers,
        active_coupons=active_coupons,
        redeemed_coupons=redeemed_coupons,
    ).model_dump()
