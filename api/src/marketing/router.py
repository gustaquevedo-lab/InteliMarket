"""Marketing Automation — REST API for campaigns, segments, alerts, offers, surveys."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.features import require_feature
from api.src.auth.deps import get_current_user
from api.src.marketing import service

router = APIRouter(
    prefix="/api/v1/marketing",
    tags=["marketing"],
    dependencies=[Depends(require_feature("marketing_automation"))],
)


# ── Dashboard ───────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    return await service.get_dashboard(db, user["company_id"])


# ── Segments ───────────────────────────────────────────────────

@router.get("/segments")
async def list_segments(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    segs = await service.list_segments(db, user["company_id"])
    return [
        {"id": str(s.id), "nombre": s.nombre, "descripcion": s.descripcion,
         "filters": s.filters, "estimated_count": s.estimated_count,
         "last_calculated_at": s.last_calculated_at, "activo": s.activo,
         "created_at": s.created_at}
        for s in segs
    ]


@router.post("/segments")
async def create_segment(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    seg = await service.create_segment(db, user["company_id"], data)
    # Auto-estimate
    seg.estimated_count = await service.estimate_segment_count(db, user["company_id"], seg.filters)
    seg.last_calculated_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    await db.commit()
    return {"id": str(seg.id), "nombre": seg.nombre, "estimated_count": seg.estimated_count}


@router.put("/segments/{seg_id}")
async def update_segment(
    seg_id: str, data: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    seg = await service.update_segment(db, seg_id, user["company_id"], data)
    if not seg:
        raise HTTPException(404, "Segmento no encontrado")
    return {"ok": True}


@router.post("/segments/{seg_id}/estimate")
async def estimate_segment(
    seg_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    seg_r = await db.execute(
        __import__("sqlalchemy").select(service.CustomerSegment)
        .where(service.CustomerSegment.id == __import__("uuid").UUID(seg_id), service.CustomerSegment.company_id == __import__("uuid").UUID(user["company_id"]))
    )
    seg = seg_r.scalar_one_or_none()
    if not seg:
        raise HTTPException(404, "Segmento no encontrado")
    count = await service.estimate_segment_count(db, user["company_id"], seg.filters)
    seg.estimated_count = count
    seg.last_calculated_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    await db.commit()
    return {"estimated_count": count}


# ── Campaigns ──────────────────────────────────────────────────

@router.get("/campaigns")
async def list_campaigns(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    camps = await service.list_campaigns(db, user["company_id"], limit, offset)
    return [
        {"id": str(c.id), "segment_id": str(c.segment_id) if c.segment_id else None,
         "nombre": c.nombre, "descripcion": c.descripcion, "canal": c.canal, "tipo": c.tipo,
         "contenido": c.contenido, "scheduled_at": c.scheduled_at, "estado": c.estado,
         "total_recipients": c.total_recipients, "sent_count": c.sent_count,
         "delivered_count": c.delivered_count, "opened_count": c.opened_count,
         "clicked_count": c.clicked_count, "converted_count": c.converted_count,
         "created_at": c.created_at}
        for c in camps
    ]


@router.post("/campaigns")
async def create_campaign(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    camp = await service.create_campaign(db, user["company_id"], user["id"], data)
    return {"id": str(camp.id), "nombre": camp.nombre, "estado": camp.estado}


@router.get("/campaigns/{camp_id}")
async def get_campaign(
    camp_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    camp = await service.get_campaign(db, camp_id, user["company_id"])
    if not camp:
        raise HTTPException(404, "Campaña no encontrada")
    return {
        "id": str(camp.id),
        "nombre": camp.nombre, "descripcion": camp.descripcion,
        "canal": camp.canal, "tipo": camp.tipo, "contenido": camp.contenido,
        "estado": camp.estado, "scheduled_at": camp.scheduled_at,
        "total_recipients": camp.total_recipients, "sent_count": camp.sent_count,
        "delivered_count": camp.delivered_count, "opened_count": camp.opened_count,
        "clicked_count": camp.clicked_count, "converted_count": camp.converted_count,
        "segment_id": str(camp.segment_id) if camp.segment_id else None,
        "created_at": camp.created_at,
        "recipients": [
            {"id": str(r.id), "customer_id": str(r.customer_id),
             "customer_nombre": r.customer_nombre, "customer_telefono": r.customer_telefono,
             "estado": r.estado, "sent_at": r.sent_at, "opened_at": r.opened_at,
             "error_message": r.error_message}
            for r in (camp.recipients or [])
        ],
    }


@router.put("/campaigns/{camp_id}")
async def update_campaign(
    camp_id: str, data: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    camp = await service.update_campaign(db, camp_id, user["company_id"], data)
    if not camp:
        raise HTTPException(404, "Campaña no encontrada")
    return {"ok": True}


@router.post("/campaigns/{camp_id}/execute")
async def execute_campaign(
    camp_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    try:
        return await service.execute_campaign(db, camp_id, user["company_id"])
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Stock Alerts ───────────────────────────────────────────────

@router.get("/stock-alerts")
async def list_stock_alerts(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    alerts = await service.list_stock_alerts(db, user["company_id"])
    return [
        {"id": str(a.id), "customer_id": str(a.customer_id), "product_id": str(a.product_id),
         "activo": a.activo, "last_notified_at": a.last_notified_at, "created_at": a.created_at}
        for a in alerts
    ]


@router.post("/stock-alerts")
async def create_stock_alert(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    try:
        alert = await service.create_stock_alert(db, user["company_id"], data)
        return {"id": str(alert.id), "customer_id": str(alert.customer_id), "product_id": str(alert.product_id)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/stock-alerts/{alert_id}")
async def delete_stock_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    await service.delete_stock_alert(db, alert_id, user["company_id"])
    return {"ok": True}


@router.post("/stock-alerts/check")
async def check_stock_alerts(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    return await service.check_stock_alerts(db, user["company_id"])


# ── Offers ────────────────────────────────────────────────────

@router.get("/offers")
async def list_offers(
    customer_id: str = Query(""),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    cid = customer_id if customer_id else None
    offers = await service.list_offers(db, user["company_id"], cid)
    return [
        {"id": str(o.id), "customer_id": str(o.customer_id), "product_id": str(o.product_id) if o.product_id else None,
         "titulo": o.titulo, "descripcion": o.descripcion, "tipo": o.tipo, "valor": float(o.valor) if o.valor else None,
         "codigo_cupon": o.codigo_cupon, "valido_hasta": o.valido_hasta, "usado": o.usado, "created_at": o.created_at}
        for o in offers
    ]


@router.post("/offers")
async def create_offer(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    offer = await service.create_offer(db, user["company_id"], data)
    return {"id": str(offer.id), "titulo": offer.titulo}


@router.post("/offers/generate")
async def generate_offers(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    offers = await service.generate_personalized_offers(db, user["company_id"])
    return {"generated": len(offers), "offers": offers}


# ── Surveys ──────────────────────────────────────────────────

@router.get("/surveys")
async def list_surveys(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    surveys = await service.list_surveys(db, user["company_id"])
    return [
        {"id": str(s.id), "nombre": s.nombre, "preguntas": s.preguntas, "activo": s.activo, "created_at": s.created_at}
        for s in surveys
    ]


@router.post("/surveys")
async def create_survey(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    survey = await service.create_survey(db, user["company_id"], data)
    return {"id": str(survey.id), "nombre": survey.nombre}


@router.get("/surveys/{survey_id}/responses")
async def get_survey_responses(
    survey_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    responses = await service.list_survey_responses(db, survey_id, user["company_id"])
    return [
        {"customer_id": str(r.customer_id), "respuestas": r.respuestas, "created_at": r.created_at}
        for r in responses
    ]


# ── Scheduler endpoint ────────────────────────────────────────

@router.get("/scheduled")
async def list_scheduled(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Return campaigns that are scheduled for future execution."""
    from sqlalchemy import select as sel
    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    r = await db.execute(
        sel(service.MarketingCampaign).where(
            service.MarketingCampaign.company_id == __import__("uuid").UUID(user["company_id"]),
            service.MarketingCampaign.estado == "programada",
            service.MarketingCampaign.scheduled_at <= now,
        )
    )
    camps = list(r.scalars().all())
    return [{"id": str(c.id), "nombre": c.nombre, "scheduled_at": c.scheduled_at} for c in camps]
