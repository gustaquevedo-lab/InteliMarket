"""Retail router — KPIs dashboard, POS, coupons, calendar, online."""
from uuid import UUID
from typing import Optional, List
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.retail import service, schemas, models

router = APIRouter(prefix="/api/v1/retail", tags=["retail"])


def _cid(user: dict) -> UUID:
    """Get company_id from user or default."""
    c = user.get("company_id")
    if c:
        return UUID(str(c))
    return UUID("00000000-0000-0000-0000-000000000010")


# ── Dashboard ─────────────────────────────────────────────

@router.get("/dashboard", response_model=schemas.RetailDashboardData)
async def get_dashboard(
    branch_id: Optional[UUID] = Query(None, description="Branch filter"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Aggregated dashboard: KPIs, heatmap, top products, alerts, próximos eventos."""
    return await service.build_dashboard(db, _cid(user), branch_id)


@router.get("/kpi/{periodo}", response_model=schemas.KpiSnapshotResponse)
async def get_kpi(
    periodo: str,
    branch_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Get KPI snapshot for a specific period (dia/semana/mes)."""
    if periodo not in ("dia", "semana", "mes"):
        raise HTTPException(400, "Periodo debe ser: dia, semana o mes")
    return await service._build_kpi_snapshot(db, _cid(user), branch_id, date.today(), periodo)


@router.get("/heatmap")
async def get_heatmap(
    branch_id: Optional[UUID] = Query(None),
    dias: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Sales heatmap by hour x day."""
    dashboard = await service.build_dashboard(db, _cid(user), branch_id)
    return {
        "datos": [h.model_dump(mode="json") for h in dashboard.heatmap_7dias],
        "resumen": {
            "mejor_dia": dashboard.comparativa.get("mejor_dia_semana"),
            "mejor_hora": dashboard.comparativa.get("mejor_hora"),
        }
    }


# ── Store Config ──────────────────────────────────────────

@router.get("/store-config/{branch_id}", response_model=schemas.StoreConfigResponse)
async def get_store_config(
    branch_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cfg = await service.get_store_config(db, _cid(user), branch_id)
    if not cfg:
        raise HTTPException(404, "Configuración de tienda no encontrada")
    return cfg


@router.post("/store-config", response_model=schemas.StoreConfigResponse)
async def upsert_store_config(
    data: schemas.StoreConfigCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.upsert_store_config(db, _cid(user), data)


# ── Coupons ───────────────────────────────────────────────

@router.get("/coupons", response_model=List[schemas.CouponResponse])
async def list_coupons(
    estado: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_coupons(db, _cid(user), estado, limit)


@router.post("/coupons", response_model=schemas.CouponResponse)
async def create_coupon(
    data: schemas.CouponCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user.get("id")) if user and user.get("id") else None
    return await service.create_coupon(db, _cid(user), data, user_id)


@router.get("/coupons/{coupon_id}", response_model=schemas.CouponResponse)
async def get_coupon(
    coupon_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    c = await service.get_coupon(db, coupon_id)
    if not c:
        raise HTTPException(404, "Cupón no encontrado")
    return c


@router.patch("/coupons/{coupon_id}", response_model=schemas.CouponResponse)
async def update_coupon(
    coupon_id: UUID,
    data: schemas.CouponUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.update_coupon(db, coupon_id, data)


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(
    coupon_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    c = await service.get_coupon(db, coupon_id)
    if not c:
        raise HTTPException(404, "Cupón no encontrado")
    c.estado = "expirado"
    await db.commit()
    return {"ok": True, "id": str(coupon_id)}


@router.post("/coupons/validate", response_model=schemas.CouponValidateResponse)
async def validate_coupon(
    data: schemas.CouponValidateRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.validate_coupon(db, _cid(user), data)


@router.post("/coupons/{coupon_id}/redeem")
async def redeem_coupon(
    coupon_id: UUID,
    customer_id: Optional[UUID] = Body(None),
    sale_id: Optional[UUID] = Body(None),
    branch_id: Optional[UUID] = Body(None),
    descuento: float = Body(0),
    vendedor: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from decimal import Decimal
    red = await service.redeem_coupon(
        db, _cid(user), coupon_id, customer_id, sale_id, branch_id, Decimal(str(descuento)), vendedor
    )
    return {"ok": True, "redemption_id": str(red.id), "fecha": red.fecha}


@router.get("/coupons-stats")
async def coupons_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.coupons_dashboard(db, _cid(user))


# ── Calendar Events ───────────────────────────────────────

@router.post("/calendar/seed-py")
async def seed_calendar(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Seed the 15 Paraguay events for this company."""
    created = await service.seed_py_calendar(db, _cid(user))
    return {"ok": True, "created": len(created)}


@router.get("/calendar/events", response_model=List[schemas.CalendarEventResponse])
async def list_events(
    year: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_events(db, _cid(user), year)


@router.post("/calendar/events", response_model=schemas.CalendarEventResponse)
async def create_event(
    data: schemas.CalendarEventCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ev = await service.create_event(db, _cid(user), data)
    return schemas.CalendarEventResponse(
        id=ev.id, company_id=ev.company_id, codigo=ev.codigo, nombre=ev.nombre,
        descripcion=ev.descripcion, fecha_evento=ev.fecha_evento, fecha_fin=ev.fecha_fin,
        categoria=ev.categoria, icono=ev.icono, recurrente=ev.recurrente,
        notas_planificacion=ev.notas_planificacion, activo=ev.activo, created_at=ev.created_at,
        promos_count=0
    )


@router.patch("/calendar/events/{event_id}", response_model=schemas.CalendarEventResponse)
async def update_event(
    event_id: UUID,
    data: schemas.CalendarEventUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ev = await service.update_event(db, event_id, data)
    return schemas.CalendarEventResponse(
        id=ev.id, company_id=ev.company_id, codigo=ev.codigo, nombre=ev.nombre,
        descripcion=ev.descripcion, fecha_evento=ev.fecha_evento, fecha_fin=ev.fecha_fin,
        categoria=ev.categoria, icono=ev.icono, recurrente=ev.recurrente,
        notas_planificacion=ev.notas_planificacion, activo=ev.activo, created_at=ev.created_at,
        promos_count=0
    )


@router.get("/calendar/events/{event_id}/suggest")
async def suggest_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Get AI-style suggestions for a calendar event."""
    return await service.suggest_event_promos(db, _cid(user), event_id)


# ── Event Promos ──────────────────────────────────────────

@router.get("/calendar/promos", response_model=List[schemas.EventPromoResponse])
async def list_event_promos(
    event_id: Optional[UUID] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_event_promos(db, _cid(user), event_id, estado)


@router.post("/calendar/promos", response_model=schemas.EventPromoResponse)
async def create_event_promo(
    data: schemas.EventPromoCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    p = await service.create_event_promo(db, _cid(user), data)
    return await service.list_event_promos(db, _cid(user), p.event_id)


@router.patch("/calendar/promos/{promo_id}")
async def update_event_promo(
    promo_id: UUID,
    data: schemas.EventPromoUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.update_event_promo(db, promo_id, data)


# ── POS Cash Sessions ─────────────────────────────────────

@router.post("/pos/sessions/open", response_model=schemas.CashSessionResponse)
async def open_session(
    data: schemas.CashSessionOpen,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user["id"]) if user.get("id") else UUID("00000000-0000-0000-0000-000000000000")
    user_name = user.get("nombre", user.get("email", "Sistema"))
    return await service.open_cash_session(db, _cid(user), data, user_id, user_name)


@router.post("/pos/sessions/{session_id}/close", response_model=schemas.CashSessionResponse)
async def close_session(
    session_id: UUID,
    data: schemas.CashSessionClose,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.close_cash_session(db, session_id, data)


@router.get("/pos/sessions/active", response_model=Optional[schemas.CashSessionResponse])
async def get_active_session(
    branch_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = UUID(user["id"]) if user.get("id") else None
    if not user_id:
        return None
    return await service.get_open_session(db, _cid(user), branch_id, user_id)


# ── Quick Customer ────────────────────────────────────────

@router.post("/quick-customer/lookup", response_model=schemas.QuickCustomerResult)
async def quick_customer_lookup(
    data: schemas.QuickCustomerLookup,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Sub-200ms customer lookup by phone/DNI/RUC/QR for POS."""
    return await service.quick_customer_lookup(db, _cid(user), data)


# ── Online Storefront ─────────────────────────────────────

@router.get("/storefront/{branch_id}", response_model=schemas.OnlineStorefrontResponse)
async def get_storefront(
    branch_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    sf = await service.get_storefront(db, _cid(user), branch_id)
    if not sf:
        raise HTTPException(404, "Tienda online no configurada")
    return sf


@router.post("/storefront", response_model=schemas.OnlineStorefrontResponse)
async def upsert_storefront(
    data: schemas.OnlineStorefrontCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.upsert_storefront(db, _cid(user), data)


@router.patch("/storefront/{storefront_id}", response_model=schemas.OnlineStorefrontResponse)
async def update_storefront(
    storefront_id: UUID,
    data: schemas.OnlineStorefrontUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.update_storefront(db, storefront_id, data)


# ── Public storefront by slug (no auth for customer-facing) ──

@router.get("/public/storefront/{slug}")
async def public_storefront(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Public storefront for customers (no auth)."""
    sf = await service.get_storefront_by_slug(db, slug)
    if not sf or not sf.activo:
        raise HTTPException(404, "Tienda no encontrada")
    return {
        "nombre_publico": sf.nombre_publico,
        "mensaje_bienvenida": sf.mensaje_bienvenida,
        "color_primario": sf.color_primario,
        "logo_url": sf.logo_url,
        "banner_url": sf.banner_url,
        "metodos_pago": sf.metodos_pago,
        "delivery_activo": sf.delivery_activo,
        "delivery_km_max": sf.delivery_km_max,
        "delivery_costo_km": float(sf.delivery_costo_km),
        "pickup_activo": sf.pickup_activo,
        "pickup_horas": sf.pickup_horas,
        "senia_pct": float(sf.senia_pct),
        "productos_destacados": sf.productos_destacados,
        "horarios_atencion": sf.horarios_atencion,
        "politicas": sf.politicas,
    }
