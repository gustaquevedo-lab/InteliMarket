"""Marketing Automation — business logic for segmentation, campaigns, alerts, offers, surveys."""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import UUID
from typing import Optional

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.marketing.models import (
    CustomerSegment, MarketingCampaign, CampaignRecipient,
    StockAlertConfig, CustomerOffer, SatisfactionSurvey, SurveyResponse,
)
from api.src.customers.models import Customer
from api.src.products.models import Product
from api.src.sales.models import Sale, SaleItem


# ══════════════════════════════════════════════════════════════════
# SEGMENTS
# ══════════════════════════════════════════════════════════════════

async def create_segment(db: AsyncSession, company_id: str, data: dict) -> CustomerSegment:
    seg = CustomerSegment(company_id=UUID(company_id), **data)
    db.add(seg)
    await db.commit()
    await db.refresh(seg)
    return seg


async def update_segment(db: AsyncSession, seg_id: str, company_id: str, data: dict) -> Optional[CustomerSegment]:
    r = await db.execute(
        select(CustomerSegment).where(CustomerSegment.id == UUID(seg_id), CustomerSegment.company_id == UUID(company_id))
    )
    seg = r.scalar_one_or_none()
    if not seg:
        return None
    for k, v in data.items():
        setattr(seg, k, v)
    await db.commit()
    await db.refresh(seg)
    return seg


async def list_segments(db: AsyncSession, company_id: str) -> list[CustomerSegment]:
    r = await db.execute(
        select(CustomerSegment).where(CustomerSegment.company_id == UUID(company_id))
        .order_by(CustomerSegment.created_at.desc())
    )
    return list(r.scalars().all())


async def estimate_segment_count(db: AsyncSession, company_id: str, filters: dict) -> int:
    """Estimate how many customers match segment filters."""
    q = select(func.count(Customer.id)).where(Customer.company_id == UUID(company_id), Customer.activo == True)

    if filters.get("zonas"):
        q = q.where(Customer.ciudad.in_(filters["zonas"]))
    if filters.get("tipo_persona"):
        q = q.where(Customer.tipo_persona == filters["tipo_persona"])
    if filters.get("antiguedad_dias_max"):
        cut = datetime.now(timezone.utc) - timedelta(days=filters["antiguedad_dias_max"])
        q = q.where(Customer.created_at >= cut)

    # Frequency/monto filters require subquery on sales
    if filters.get("frecuencia_min") or filters.get("frecuencia_max") or filters.get("monto_min") or filters.get("monto_max") or filters.get("ultima_compra_dias"):
        # Use a subquery for customer aggregation
        subq = (
            select(Sale.customer_id,
                   func.count(Sale.id).label("compra_count"),
                   func.coalesce(func.sum(Sale.total), 0).label("total_gastado"),
                   func.max(Sale.created_at).label("ultima_compra"))
            .where(Sale.company_id == UUID(company_id))
            .group_by(Sale.customer_id)
        ).subquery()

        q = select(func.count()).select_from(
            select(Customer.id).where(Customer.company_id == UUID(company_id), Customer.activo == True)
            .outerjoin(subq, Customer.id == subq.c.customer_id)
        )

        conditions = []
        if filters.get("frecuencia_min"):
            conditions.append(subq.c.compra_count >= filters["frecuencia_min"])
        if filters.get("frecuencia_max"):
            conditions.append(subq.c.compra_count <= filters["frecuencia_max"])
        if filters.get("monto_min"):
            conditions.append(subq.c.total_gastado >= filters["monto_min"])
        if filters.get("monto_max"):
            conditions.append(subq.c.total_gastado <= filters["monto_max"])
        if filters.get("ultima_compra_dias"):
            cut = datetime.now(timezone.utc) - timedelta(days=filters["ultima_compra_dias"])
            conditions.append(or_(subq.c.ultima_compra >= cut, subq.c.ultima_compra.is_(None)))
        if conditions:
            q = q.where(and_(*conditions))

        r = await db.execute(q)
        return r.scalar() or 0

    r = await db.execute(q)
    return r.scalar() or 0


# ══════════════════════════════════════════════════════════════════
# CAMPAIGNS
# ══════════════════════════════════════════════════════════════════

async def create_campaign(db: AsyncSession, company_id: str, user_id: str, data: dict) -> MarketingCampaign:
    camp = MarketingCampaign(
        company_id=UUID(company_id),
        segment_id=UUID(data["segment_id"]) if data.get("segment_id") else None,
        nombre=data["nombre"],
        descripcion=data.get("descripcion"),
        canal=data.get("canal", "whatsapp"),
        tipo=data.get("tipo", "promocion"),
        contenido=data.get("contenido"),
        template_id=UUID(data["template_id"]) if data.get("template_id") else None,
        scheduled_at=data.get("scheduled_at"),
        created_by=UUID(user_id),
    )
    db.add(camp)
    await db.commit()
    await db.refresh(camp)
    return camp


async def update_campaign(db: AsyncSession, camp_id: str, company_id: str, data: dict) -> Optional[MarketingCampaign]:
    r = await db.execute(
        select(MarketingCampaign).where(MarketingCampaign.id == UUID(camp_id), MarketingCampaign.company_id == UUID(company_id))
    )
    camp = r.scalar_one_or_none()
    if not camp:
        return None
    for k, v in data.items():
        setattr(camp, k, v)
    await db.commit()
    await db.refresh(camp)
    return camp


async def list_campaigns(db: AsyncSession, company_id: str, limit: int = 20, offset: int = 0) -> list[MarketingCampaign]:
    r = await db.execute(
        select(MarketingCampaign).where(MarketingCampaign.company_id == UUID(company_id))
        .order_by(MarketingCampaign.created_at.desc())
        .offset(offset).limit(limit)
    )
    return list(r.scalars().all())


async def get_campaign(db: AsyncSession, camp_id: str, company_id: str) -> Optional[MarketingCampaign]:
    r = await db.execute(
        select(MarketingCampaign).where(MarketingCampaign.id == UUID(camp_id), MarketingCampaign.company_id == UUID(company_id))
        .options(selectinload(MarketingCampaign.recipients))
    )
    return r.scalar_one_or_none()


async def execute_campaign(db: AsyncSession, camp_id: str, company_id: str) -> dict:
    """Execute a campaign: resolve segment, create recipients, mark as sent."""
    camp = await get_campaign(db, camp_id, company_id)
    if not camp:
        raise ValueError("Campaña no encontrada")

    # Resolve customers from segment or all active
    if camp.segment_id:
        r = await db.execute(select(CustomerSegment).where(CustomerSegment.id == camp.segment_id))
        seg = r.scalar_one_or_none()
        filters = seg.filters if seg else {}
    else:
        filters = {}

    q = select(Customer).where(Customer.company_id == UUID(company_id), Customer.activo == True)
    if filters.get("zonas"):
        q = q.where(Customer.ciudad.in_(filters["zonas"]))
    if filters.get("antiguedad_dias_max"):
        cut = datetime.now(timezone.utc) - timedelta(days=filters["antiguedad_dias_max"])
        q = q.where(Customer.created_at >= cut)

    r = await db.execute(q)
    customers = list(r.scalars().all())

    # Create recipients
    recipients = []
    for c in customers:
        if camp.canal == "whatsapp" and not c.telefono:
            continue
        if camp.canal == "email" and not c.email:
            continue
        recipients.append(CampaignRecipient(
            campaign_id=camp.id,
            company_id=UUID(company_id),
            customer_id=c.id,
            customer_nombre=c.nombre,
            customer_telefono=c.telefono,
            customer_email=c.email,
        ))

    if recipients:
        db.add_all(recipients)
        await db.flush()

    camp.estado = "enviando"
    camp.total_recipients = len(recipients)
    camp.sent_count = len(recipients)
    camp.sent_at = datetime.now(timezone.utc)
    for rcp in recipients:
        rcp.estado = "enviado"
        rcp.sent_at = datetime.now(timezone.utc)
    camp.estado = "completada"
    camp.completed_at = datetime.now(timezone.utc)
    await db.commit()

    return {"sent": len(recipients)}


# ══════════════════════════════════════════════════════════════════
# STOCK ALERTS
# ══════════════════════════════════════════════════════════════════

async def create_stock_alert(db: AsyncSession, company_id: str, data: dict) -> StockAlertConfig:
    alert = StockAlertConfig(
        company_id=UUID(company_id),
        customer_id=UUID(data["customer_id"]),
        product_id=UUID(data["product_id"]),
    )
    db.add(alert)
    try:
        await db.commit()
        await db.refresh(alert)
    except Exception:
        await db.rollback()
        raise ValueError("El cliente ya tiene una alerta para este producto")
    return alert


async def list_stock_alerts(db: AsyncSession, company_id: str) -> list[StockAlertConfig]:
    r = await db.execute(
        select(StockAlertConfig).where(StockAlertConfig.company_id == UUID(company_id))
        .order_by(StockAlertConfig.created_at.desc())
    )
    return list(r.scalars().all())


async def delete_stock_alert(db: AsyncSession, alert_id: str, company_id: str):
    r = await db.execute(
        select(StockAlertConfig).where(StockAlertConfig.id == UUID(alert_id), StockAlertConfig.company_id == UUID(company_id))
    )
    a = r.scalar_one_or_none()
    if a:
        await db.delete(a)
        await db.commit()


async def check_stock_alerts(db: AsyncSession, company_id: str) -> list[dict]:
    """Check products that were out of stock and came back."""
    alerts_r = await db.execute(
        select(StockAlertConfig).where(StockAlertConfig.company_id == UUID(company_id), StockAlertConfig.activo == True)
    )
    alerts = list(alerts_r.scalars().all())

    from api.src.inventory.models import Stock
    notifications = []
    for alert in alerts:
        sr = await db.execute(
            select(func.coalesce(func.sum(Stock.cantidad), 0))
            .where(Stock.product_id == alert.product_id, Stock.company_id == UUID(company_id))
        )
        stock = float(sr.scalar() or 0)
        if stock > 0:
            cr = await db.execute(select(Customer).where(Customer.id == alert.customer_id))
            customer = cr.scalar_one_or_none()
            pr = await db.execute(select(Product).where(Product.id == alert.product_id))
            product = pr.scalar_one_or_none()
            if customer and product:
                notifications.append({
                    "customer_id": str(alert.customer_id),
                    "customer_nombre": customer.nombre,
                    "product_id": str(alert.product_id),
                    "product_nombre": product.nombre,
                    "stock_actual": stock,
                })
                alert.last_notified_at = datetime.now(timezone.utc)
    await db.commit()
    return notifications


# ══════════════════════════════════════════════════════════════════
# OFFERS
# ══════════════════════════════════════════════════════════════════

async def create_offer(db: AsyncSession, company_id: str, data: dict) -> CustomerOffer:
    offer = CustomerOffer(
        company_id=UUID(company_id),
        customer_id=UUID(data["customer_id"]),
        campaign_id=UUID(data["campaign_id"]) if data.get("campaign_id") else None,
        product_id=UUID(data["product_id"]) if data.get("product_id") else None,
        titulo=data["titulo"],
        descripcion=data.get("descripcion"),
        tipo=data.get("tipo", "descuento"),
        valor=Decimal(str(data["valor"])) if data.get("valor") else None,
        codigo_cupon=data.get("codigo_cupon"),
        valido_desde=data.get("valido_desde"),
        valido_hasta=data.get("valido_hasta"),
    )
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    return offer


async def list_offers(db: AsyncSession, company_id: str, customer_id: Optional[str] = None) -> list[CustomerOffer]:
    q = select(CustomerOffer).where(CustomerOffer.company_id == UUID(company_id)).order_by(CustomerOffer.created_at.desc())
    if customer_id:
        q = q.where(CustomerOffer.customer_id == UUID(customer_id))
    r = await db.execute(q)
    return list(r.scalars().all())


async def generate_personalized_offers(db: AsyncSession, company_id: str) -> list[dict]:
    """Auto-generate offers based on customer purchase history (cross-sell)."""
    from collections import Counter
    from api.src.products.models import ProductCategory

    # Find top product categories per customer
    one_month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    r = await db.execute(
        select(Sale.customer_id, SaleItem.product_id)
        .join(SaleItem, Sale.id == SaleItem.sale_id)
        .where(Sale.company_id == UUID(company_id), Sale.created_at >= one_month_ago)
    )
    rows = r.all()

    customer_products: dict[str, list[str]] = {}
    for row in rows:
        cid = str(row.customer_id)
        if cid not in customer_products:
            customer_products[cid] = []
        customer_products[cid].append(str(row.product_id))

    # For each customer, find products they haven't bought but in same category
    offers_generated = []
    for cid, bought_pids in customer_products.items():
        if not bought_pids:
            continue
        # Get categories of bought products
        cat_r = await db.execute(
            select(Product.categoria_id).where(Product.company_id == UUID(company_id), Product.id.in_([UUID(p) for p in bought_pids[:50]]))
        )
        cat_ids = list(set(str(r[0]) for r in cat_r.all() if r[0]))

        if not cat_ids:
            continue

        # Find products in same categories not bought
        cross_r = await db.execute(
            select(Product).where(
                Product.company_id == UUID(company_id),
                Product.categoria_id.in_([UUID(c) for c in cat_ids]),
                Product.activo == True,
                ~Product.id.in_([UUID(p) for p in bought_pids]),
            ).limit(3)
        )
        cross_products = list(cross_r.scalars().all())

        for cp in cross_products:
            offer = CustomerOffer(
                company_id=UUID(company_id),
                customer_id=UUID(cid),
                product_id=cp.id,
                titulo=f"Oferta especial en {cp.nombre}",
                descripcion="Basado en tus compras recientes",
                tipo="descuento",
                valor=Decimal("10"),
                valido_hasta=datetime.now(timezone.utc) + timedelta(days=7),
            )
            db.add(offer)
            offers_generated.append({"customer_id": cid, "product_id": str(cp.id), "product_nombre": cp.nombre})

    await db.commit()
    return offers_generated


# ══════════════════════════════════════════════════════════════════
# SURVEYS
# ══════════════════════════════════════════════════════════════════

async def create_survey(db: AsyncSession, company_id: str, data: dict) -> SatisfactionSurvey:
    survey = SatisfactionSurvey(company_id=UUID(company_id), **data)
    db.add(survey)
    await db.commit()
    await db.refresh(survey)
    return survey


async def list_surveys(db: AsyncSession, company_id: str) -> list[SatisfactionSurvey]:
    r = await db.execute(
        select(SatisfactionSurvey).where(SatisfactionSurvey.company_id == UUID(company_id))
        .order_by(SatisfactionSurvey.created_at.desc())
    )
    return list(r.scalars().all())


async def submit_survey_response(db: AsyncSession, company_id: str, customer_id: str, data: dict) -> SurveyResponse:
    resp = SurveyResponse(
        survey_id=UUID(data["survey_id"]),
        company_id=UUID(company_id),
        customer_id=UUID(customer_id),
        campaign_id=UUID(data["campaign_id"]) if data.get("campaign_id") else None,
        respuestas=data["respuestas"],
    )
    db.add(resp)
    await db.commit()
    await db.refresh(resp)
    return resp


async def list_survey_responses(db: AsyncSession, survey_id: str, company_id: str) -> list[SurveyResponse]:
    r = await db.execute(
        select(SurveyResponse).where(SurveyResponse.survey_id == UUID(survey_id), SurveyResponse.company_id == UUID(company_id))
        .order_by(SurveyResponse.created_at.desc())
    )
    return list(r.scalars().all())


# ══════════════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════════════

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    async def count_t(t):
        r = await db.execute(select(func.count(t.id)).where(t.company_id == UUID(company_id)))
        return r.scalar() or 0

    total_campaigns = await count_t(MarketingCampaign)
    active_campaigns = (await db.execute(
        select(func.count(MarketingCampaign.id))
        .where(MarketingCampaign.company_id == UUID(company_id), MarketingCampaign.estado.in_(["programada", "enviando"]))
    )).scalar() or 0

    async def sum_field(field):
        r = await db.execute(
            select(func.coalesce(func.sum(field), 0))
            .where(MarketingCampaign.company_id == UUID(company_id))
        )
        return int(r.scalar() or 0)

    rc = await db.execute(
        select(MarketingCampaign).where(MarketingCampaign.company_id == UUID(company_id))
        .order_by(MarketingCampaign.created_at.desc()).limit(5)
    )
    recent = list(rc.scalars().all())

    return {
        "total_campaigns": total_campaigns,
        "active_campaigns": active_campaigns,
        "total_sent": await sum_field(MarketingCampaign.sent_count),
        "total_delivered": await sum_field(MarketingCampaign.delivered_count),
        "total_opened": await sum_field(MarketingCampaign.opened_count),
        "total_converted": await sum_field(MarketingCampaign.converted_count),
        "total_segments": await count_t(CustomerSegment),
        "total_alerts": await count_t(StockAlertConfig),
        "total_offers": await count_t(CustomerOffer),
        "total_offer_used": (await db.execute(
            select(func.count(CustomerOffer.id)).where(CustomerOffer.company_id == UUID(company_id), CustomerOffer.usado == True)
        )).scalar() or 0,
        "total_surveys": await count_t(SatisfactionSurvey),
        "total_survey_responses": await count_t(SurveyResponse),
        "recent_campaigns": [
            {"id": str(c.id), "nombre": c.nombre, "canal": c.canal, "tipo": c.tipo,
             "estado": c.estado, "total_recipients": c.total_recipients,
             "sent_count": c.sent_count, "delivered_count": c.delivered_count,
             "opened_count": c.opened_count, "clicked_count": c.clicked_count,
             "converted_count": c.converted_count, "created_at": c.created_at,
             "segment_id": str(c.segment_id) if c.segment_id else None}
            for c in recent
        ],
    }
