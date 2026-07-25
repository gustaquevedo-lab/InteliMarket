"""Tracking — API router for seller tracking, geofencing, route instances, performance."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.distribuidora.tracking_models import (
    SellerProfile, SellerGPSTracking, RouteInstance, RouteStopVisit,
    GeofenceZone, GeofenceAlert, SellerPerformanceMetric,
)
from api.src.distribuidora.tracking_schemas import (
    SellerProfileCreate, SellerProfileUpdate, SellerWithUserResponse,
    GPSTrackingCreate, GPSTrackingResponse,
    RouteInstanceCreate, RouteInstanceUpdate, RouteInstanceResponse,
    RouteStopVisitCreate, RouteStopVisitComplete, RouteStopVisitResponse,
    GeofenceZoneCreate, GeofenceZoneUpdate, GeofenceZoneResponse,
    GeofenceAlertResponse, GeofenceAlertAck,
    SellerPerformanceResponse,
)
from api.src.distribuidora import tracking_service as svc

router = APIRouter(prefix="/api/v1/distribuidora", tags=["distribuidora-tracking"])


# ═══════════════════════════════════════════════════════════════
# SELLER PROFILES
# ═══════════════════════════════════════════════════════════════

@router.get("/sellers/{company_id}", dependencies=[Depends(require_feature("seller_tracking"))])
async def list_sellers(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    """List all seller profiles with user data."""
    return await svc.get_sellers_with_users(db, company_id)


@router.post("/sellers/{company_id}", status_code=201, dependencies=[Depends(require_feature("seller_tracking"))])
async def create_seller(
    company_id: str,
    body: SellerProfileCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.create_seller(db, company_id, body.model_dump())


@router.get("/sellers/detail/{seller_id}", dependencies=[Depends(require_feature("seller_tracking"))])
async def get_seller(
    seller_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    obj = await svc.get_seller(db, seller_id)
    if not obj:
        raise HTTPException(404, "Vendedor no encontrado")
    return obj


@router.put("/sellers/{seller_id}", dependencies=[Depends(require_feature("seller_tracking"))])
async def update_seller(
    seller_id: str,
    body: SellerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.update_seller(db, seller_id, body.model_dump(exclude_none=True))


# ═══════════════════════════════════════════════════════════════
# GPS TRACKING
# ═══════════════════════════════════════════════════════════════

@router.post("/tracking/{seller_id}/ping", dependencies=[Depends(require_feature("seller_tracking"))])
async def record_gps_ping(
    seller_id: str,
    body: GPSTrackingCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    """Record a GPS ping from a seller's device. Auto-checks geofence violations."""
    ping = await svc.record_gps_ping(db, seller_id, body.model_dump())
    # Check geofence violations asynchronously
    alerts = await svc.check_geofence_violations(db, seller_id, body.lat, body.lng)
    return {
        "ping": {"id": str(ping.id), "lat": ping.lat, "lng": ping.lng, "recorded_at": ping.recorded_at},
        "alerts_triggered": len(alerts),
    }


@router.get("/tracking/{seller_id}/trail", dependencies=[Depends(require_feature("seller_tracking"))])
async def get_gps_trail(
    seller_id: str,
    limit: int = Query(500, le=2000),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    """Get GPS breadcrumb trail for a seller."""
    return await svc.get_gps_trail(db, seller_id, limit)


# ═══════════════════════════════════════════════════════════════
# ROUTE INSTANCES
# ═══════════════════════════════════════════════════════════════

@router.get("/route-instances/{company_id}", dependencies=[Depends(require_feature("sales_routes"))])
async def list_route_instances(
    company_id: str,
    seller_id: str | None = Query(None),
    fecha: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.list_route_instances(db, company_id, seller_id, fecha)


@router.post("/route-instances/{company_id}", status_code=201, dependencies=[Depends(require_feature("sales_routes"))])
async def create_route_instance(
    company_id: str,
    body: RouteInstanceCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.create_route_instance(db, company_id, body.model_dump())


@router.get("/route-instances/detail/{instance_id}", dependencies=[Depends(require_feature("sales_routes"))])
async def get_route_instance(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    obj = await svc.get_route_instance(db, instance_id)
    if not obj:
        raise HTTPException(404, "Instancia de ruta no encontrada")
    return obj


@router.post("/route-instances/{instance_id}/start", dependencies=[Depends(require_feature("sales_routes"))])
async def start_route_instance(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.start_route(db, instance_id)


@router.post("/route-instances/{instance_id}/end", dependencies=[Depends(require_feature("sales_routes"))])
async def end_route_instance(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.end_route(db, instance_id)


# ═══════════════════════════════════════════════════════════════
# ROUTE STOPS / VISITS
# ═══════════════════════════════════════════════════════════════

@router.get("/route-stops/{instance_id}", dependencies=[Depends(require_feature("sales_routes"))])
async def list_route_stops(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.list_route_stops(db, instance_id)


@router.post("/route-stops/{instance_id}", status_code=201, dependencies=[Depends(require_feature("sales_routes"))])
async def create_route_stop(
    instance_id: str,
    body: RouteStopVisitCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.create_route_stop(db, instance_id, body.model_dump())


@router.post("/route-stops/{stop_id}/complete", dependencies=[Depends(require_feature("sales_routes"))])
async def complete_route_stop(
    stop_id: str,
    body: RouteStopVisitComplete,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.complete_route_stop(db, stop_id, body.model_dump(exclude_none=True))


# ═══════════════════════════════════════════════════════════════
# GEOFENCE ZONES
# ═══════════════════════════════════════════════════════════════

@router.get("/geofence-zones/{company_id}", dependencies=[Depends(require_feature("geofence_zones"))])
async def list_geofence_zones(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.list_geofence_zones(db, company_id)


@router.post("/geofence-zones/{company_id}", status_code=201, dependencies=[Depends(require_feature("geofence_zones"))])
async def create_geofence_zone(
    company_id: str,
    body: GeofenceZoneCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.create_geofence_zone(db, company_id, body.model_dump())


@router.get("/geofence-zones/detail/{zone_id}", dependencies=[Depends(require_feature("geofence_zones"))])
async def get_geofence_zone(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    obj = await svc.get_geofence_zone(db, zone_id)
    if not obj:
        raise HTTPException(404, "Zona no encontrada")
    return obj


@router.put("/geofence-zones/{zone_id}", dependencies=[Depends(require_feature("geofence_zones"))])
async def update_geofence_zone(
    zone_id: str,
    body: GeofenceZoneUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.update_geofence_zone(db, zone_id, body.model_dump(exclude_none=True))


@router.delete("/geofence-zones/{zone_id}", dependencies=[Depends(require_feature("geofence_zones"))])
async def delete_geofence_zone(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    await svc.delete_geofence_zone(db, zone_id)
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# GEOFENCE ALERTS
# ═══════════════════════════════════════════════════════════════

@router.get("/geofence-alerts/{company_id}", dependencies=[Depends(require_feature("geofence_zones"))])
async def list_geofence_alerts(
    company_id: str,
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.list_geofence_alerts(db, company_id, status)


@router.post("/geofence-alerts/{alert_id}/acknowledge", dependencies=[Depends(require_feature("geofence_zones"))])
async def acknowledge_alert(
    alert_id: str,
    body: GeofenceAlertAck,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.acknowledge_alert(db, alert_id, body.model_dump())


@router.post("/geofence-alerts/{alert_id}/resolve", dependencies=[Depends(require_feature("geofence_zones"))])
async def resolve_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.resolve_alert(db, alert_id)


# ═══════════════════════════════════════════════════════════════
# PERFORMANCE METRICS
# ═══════════════════════════════════════════════════════════════

@router.post("/performance/{seller_id}/calculate", dependencies=[Depends(require_feature("seller_performance"))])
async def calculate_performance(
    seller_id: str,
    period_type: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.calculate_seller_performance(db, seller_id, period_type)


@router.get("/performance/{seller_id}/history", dependencies=[Depends(require_feature("seller_performance"))])
async def get_performance_history(
    seller_id: str,
    period_type: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    limit: int = Query(30, le=365),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.get_seller_metrics_history(db, seller_id, period_type, limit)


@router.get("/performance/ranking/{company_id}", dependencies=[Depends(require_feature("seller_performance"))])
async def get_performance_ranking(
    company_id: str,
    period_type: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await svc.get_performance_ranking(db, company_id, period_type)


# ═══════════════════════════════════════════════════════════════
# LIVE MAP — Aggregated data for the frontend map
# ═══════════════════════════════════════════════════════════════

@router.get("/live-map/{company_id}", dependencies=[Depends(require_feature("real_time_map"))])
async def get_live_map(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    """Aggregate all data needed for the real-time map view."""
    return await svc.get_live_map_data(db, company_id)
