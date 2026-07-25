"""InteliEntregas Fase 2 — Fleet, Routing, Analytics & Real-Time WebSocket."""

import io
from uuid import UUID
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features import require_feature
from api.src.intelientregas import service
from api.src.intelientregas.models import Delivery, Driver, Vehicle, Route, RouteStop
from api.src.intelientregas.fleet_models import (
    VehicleMaintenance, VehicleFuelEntry, VehicleExpense,
    VehicleChecklistItem, VehicleChecklistLog,
)
from api.src.intelientregas import fleet_service
from api.src.intelientregas.fleet_schemas import (
    MaintenanceCreate, MaintenanceUpdate, MaintenanceResponse,
    FuelEntryCreate, FuelEntryResponse,
    ExpenseCreate, ExpenseResponse,
    ChecklistItemCreate, ChecklistItemResponse,
    FleetDashboardResponse,
)
from api.src.intelientregas.routing_service import routing_service, optimize_stop_order, haversine_km
from api.src.intelientregas.ws_manager import manager, handle_driver_ws, handle_dispatcher_ws
from api.src.intelientregas import analytics_service
from api.src.intelientregas import export_service
from fastapi.responses import StreamingResponse

router = APIRouter(
    prefix="/api/v1/intelientregas",
    tags=["intelientregas-fase2"],
    dependencies=[Depends(require_feature("intelientregas"))],
)


# ============================================================
# ENHANCED STATS / ANALYTICS
# ============================================================

@router.get("/analytics")
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Comprehensive delivery analytics with trends and KPIs."""
    company_id = user["company_id"]

    # Basic stats from existing service
    base = await service.get_stats(db, company_id)

    # Today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    r = await db.execute(
        select(func.count(Delivery.id)).where(
            Delivery.company_id == company_id,
            Delivery.created_at >= today_start,
        )
    )
    today_deliveries = r.scalar() or 0

    r = await db.execute(
        select(func.count(Delivery.id)).where(
            Delivery.company_id == company_id,
            Delivery.estado == "delivered",
            Delivery.delivered_at >= today_start,
        )
    )
    today_delivered = r.scalar() or 0

    # On-time rate (delivered within scheduled window)
    r = await db.execute(
        select(func.count(Delivery.id)).where(
            Delivery.company_id == company_id,
            Delivery.estado == "delivered",
            Delivery.delivered_at.isnot(None),
            Delivery.scheduled_to.isnot(None),
            Delivery.delivered_at <= Delivery.scheduled_to,
        )
    )
    on_time = r.scalar() or 0

    total_ontime_base = base.get("delivered", 0)
    on_time_rate = round(on_time / total_ontime_base * 100, 1) if total_ontime_base > 0 else 0

    # Average delivery time (minutes from assignment to delivery)
    r = await db.execute(
        select(
            func.avg(
                func.extract("epoch", Delivery.delivered_at - Delivery.assigned_at) / 60
            )
        ).where(
            Delivery.company_id == company_id,
            Delivery.estado == "delivered",
            Delivery.assigned_at.isnot(None),
            Delivery.delivered_at.isnot(None),
        )
    )
    avg_delivery_min = round(float(r.scalar() or 0), 1)

    # Delivery by day (last 7 days)
    seven_days_ago = today_start - timedelta(days=7)
    r = await db.execute(
        select(
            func.date_trunc("day", Delivery.created_at).label("day"),
            func.count(Delivery.id),
        ).where(
            Delivery.company_id == company_id,
            Delivery.created_at >= seven_days_ago,
        ).group_by(func.date_trunc("day", Delivery.created_at))
        .order_by(func.date_trunc("day", Delivery.created_at))
    )
    by_day = [{"date": str(row[0]), "count": row[1]} for row in r.all()]

    # Top drivers by deliveries
    r = await db.execute(
        select(
            Driver.nombre,
            func.count(Delivery.id).label("deliveries"),
        )
        .join(Delivery, Delivery.driver_id == Driver.id)
        .where(
            Delivery.company_id == company_id,
            Driver.activo == True,
            Delivery.estado == "delivered",
        )
        .group_by(Driver.nombre)
        .order_by(func.count(Delivery.id).desc())
        .limit(10)
    )
    top_drivers = [{"nombre": row[0], "deliveries": row[1]} for row in r.all()]

    return {
        **base,
        "today_deliveries": today_deliveries,
        "today_delivered": today_delivered,
        "today_pending": today_deliveries - today_delivered,
        "on_time_rate": on_time_rate,
        "avg_delivery_time_min": avg_delivery_min,
        "trend_by_day": by_day,
        "top_drivers": top_drivers,
    }


# ============================================================
# FLEET MANAGEMENT
# ============================================================

@router.get("/fleet/dashboard", response_model=FleetDashboardResponse)
async def fleet_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await fleet_service.get_fleet_dashboard(db, UUID(user["tenant_id"]))


# ── Maintenance ──────────────────────────────────────────────────

@router.get("/fleet/maintenance", response_model=list[MaintenanceResponse])
async def list_maintenance(
    vehicle_id: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = UUID(user["tenant_id"])
    v_id = UUID(vehicle_id) if vehicle_id else None
    return await fleet_service.list_maintenance(db, tenant_id, v_id, status)


@router.post("/fleet/maintenance", response_model=MaintenanceResponse, status_code=201)
async def create_maintenance(
    data: MaintenanceCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    d = data.model_dump(exclude_none=True)
    d["vehicle_id"] = UUID(d.pop("vehicle_id"))
    return await fleet_service.create_maintenance(db, UUID(user["tenant_id"]), d)


@router.patch("/fleet/maintenance/{maintenance_id}", response_model=MaintenanceResponse)
async def update_maintenance(
    maintenance_id: UUID,
    data: MaintenanceUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await fleet_service.update_maintenance(db, maintenance_id, data.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(404, str(e))


# ── Fuel ─────────────────────────────────────────────────────────

@router.get("/fleet/fuel", response_model=list[FuelEntryResponse])
async def list_fuel(
    vehicle_id: str | None = Query(None),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = UUID(user["tenant_id"])
    v_id = UUID(vehicle_id) if vehicle_id else None
    return await fleet_service.list_fuel_entries(db, tenant_id, v_id, limit)


@router.post("/fleet/fuel", response_model=FuelEntryResponse, status_code=201)
async def add_fuel(
    data: FuelEntryCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    d = data.model_dump(exclude_none=True)
    d["vehicle_id"] = UUID(d.pop("vehicle_id"))
    if "driver_id" in d and d["driver_id"]:
        d["driver_id"] = UUID(d["driver_id"])
    return await fleet_service.create_fuel_entry(db, UUID(user["tenant_id"]), d)


# ── Expenses ─────────────────────────────────────────────────────

@router.get("/fleet/expenses", response_model=list[ExpenseResponse])
async def list_expenses(
    vehicle_id: str | None = Query(None),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = UUID(user["tenant_id"])
    v_id = UUID(vehicle_id) if vehicle_id else None
    return await fleet_service.list_expenses(db, tenant_id, v_id, limit)


@router.post("/fleet/expenses", response_model=ExpenseResponse, status_code=201)
async def add_expense(
    data: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    d = data.model_dump(exclude_none=True)
    d["vehicle_id"] = UUID(d.pop("vehicle_id"))
    return await fleet_service.create_expense(db, UUID(user["tenant_id"]), d)


# ── Checklists ──────────────────────────────────────────────────

@router.get("/fleet/checklist-items", response_model=list[ChecklistItemResponse])
async def list_checklist_items(
    categoria: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await fleet_service.list_checklist_items(db, UUID(user["tenant_id"]), categoria)


@router.post("/fleet/checklist-items", response_model=ChecklistItemResponse, status_code=201)
async def create_checklist_item(
    data: ChecklistItemCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await fleet_service.create_checklist_item(db, UUID(user["tenant_id"]), data.model_dump())


# ── Fleet Alerts ──────────────────────────────────────────────────

@router.get("/fleet/alerts")
async def fleet_alerts(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await fleet_service.get_fleet_alerts(db, user["company_id"])


@router.post("/fleet/checklist-submit")
async def submit_checklist(
    vehicle_id: str,
    driver_id: str,
    results: dict,
    observaciones: str | None = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    data = {
        "vehicle_id": UUID(vehicle_id),
        "driver_id": UUID(driver_id),
        "results": results,
        "observaciones": observaciones,
    }
    return await fleet_service.submit_checklist(db, UUID(user["tenant_id"]), data)


# ============================================================
# ROUTE OPTIMIZATION (Routing Service)
# ============================================================

@router.post("/routes/optimize")
async def optimize_route(
    route_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Optimize stop order using nearest-neighbor TSP heuristic."""
    r = await db.execute(
        select(Route).where(Route.id == UUID(route_id), Route.company_id == user["company_id"])
    )
    route = r.scalar_one_or_none()
    if not route:
        raise HTTPException(404, "Ruta no encontrada")

    r = await db.execute(
        select(RouteStop).where(RouteStop.route_id == route.id).order_by(RouteStop.orden)
    )
    stops = r.scalars().all()

    if len(stops) < 2:
        raise HTTPException(400, "Se necesitan al menos 2 paradas para optimizar")

    stop_dicts = [
        {"id": str(s.id), "lat": s.latitud or 0, "lng": s.longitud or 0, "direccion": s.direccion or ""}
        for s in stops
    ]

    ordered = optimize_stop_order(stop_dicts)

    # Update stop order in DB
    for i, s in enumerate(ordered):
        await db.execute(
            RouteStop.__table__.update().where(RouteStop.id == UUID(s["id"])).values(orden=i + 1)
        )

    # Calculate route totals
    coords = [(s["lat"], s["lng"]) for s in ordered]
    routing_result = await routing_service.get_route(coords)

    route.distancia_km = routing_result.get("distance_km", route.distancia_km)
    route.duracion_estimada_min = routing_result.get("duration_min", route.duracion_estimada_min)
    await db.commit()

    return {
        "route_id": route_id,
        "stops_optimized": len(ordered),
        **routing_result,
        "optimized_order": [{"orden": i + 1, "direccion": s["direccion"]} for i, s in enumerate(ordered)],
    }


@router.post("/routes/calculate-route")
async def calculate_route(
    stops: list[dict],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Calculate route distance and duration between a list of stops.
    Each stop: { lat: float, lng: float }
    """
    if len(stops) < 2:
        raise HTTPException(400, "Se necesitan al menos 2 puntos")
    coords = [(s["lat"], s["lng"]) for s in stops]
    result = await routing_service.get_route(coords)
    return result


# ============================================================
# LIVE MAP — All active driver positions
# ============================================================

@router.get("/live-map")
async def get_live_map(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Return all active driver positions + their current delivery info for map display."""
    company_id = user["company_id"]

    r = await db.execute(
        select(Driver).where(Driver.company_id == company_id, Driver.activo == True, Driver.status == "on_delivery")
    )
    drivers = r.scalars().all()

    result = []
    for driver in drivers:
        pos = manager.get_driver_position(str(driver.id))
        # Get current delivery
        dr = await db.execute(
            select(Delivery).where(
                Delivery.company_id == company_id,
                Delivery.driver_id == driver.id,
                Delivery.estado.in_(["in_transit", "picked_up"]),
            ).order_by(Delivery.created_at.desc()).limit(1)
        )
        current_delivery = dr.scalar_one_or_none()

        result.append({
            "driver_id": str(driver.id),
            "driver_nombre": driver.nombre,
            "driver_telefono": driver.telefono,
            "driver_status": driver.status,
            "driver_rating": driver.rating,
            "position": pos,
            "current_delivery": {
                "id": str(current_delivery.id),
                "customer": current_delivery.customer_nombre,
                "direccion": current_delivery.direccion,
                "estado": current_delivery.estado,
                "lat": current_delivery.latitud,
                "lng": current_delivery.longitud,
            } if current_delivery else None,
        })

    return result


# ============================================================
# PROFITABILITY ANALYTICS
# ============================================================

@router.get("/analytics/profitability")
async def analytics_profitability(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await analytics_service.get_profitability_summary(db, user["company_id"], days)


@router.get("/analytics/margins/routes")
async def analytics_margins_routes(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await analytics_service.get_margins_by_route(db, user["company_id"], days, limit)


@router.get("/analytics/margins/drivers")
async def analytics_margins_drivers(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await analytics_service.get_margins_by_driver(db, user["company_id"], days, limit)


@router.get("/analytics/margins/vehicles")
async def analytics_margins_vehicles(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await analytics_service.get_margins_by_vehicle(db, user["company_id"], days, limit)


@router.get("/analytics/margins/zones")
async def analytics_margins_zones(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await analytics_service.get_margins_by_zone(db, user["company_id"], days)


@router.get("/analytics/business-lines")
async def analytics_business_lines(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await analytics_service.get_business_line_summary(db, user["company_id"], days)


@router.get("/analytics/kpi")
async def analytics_kpi(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await analytics_service.get_delivery_performance_kpi(db, user["company_id"], days)


@router.get("/analytics/export/excel")
async def export_analytics_excel(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    data = await export_service.export_delivery_excel(db, user["company_id"], days)
    filename = f"analytics_entregas_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/analytics/export/pdf")
async def export_analytics_pdf(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    data = await export_service.export_delivery_pdf(db, user["company_id"], days)
    filename = f"analytics_entregas_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# WEBSOCKET — Real-Time Tracking
# ============================================================

@router.websocket("/ws/driver/{driver_id}")
async def driver_websocket(websocket: WebSocket, driver_id: str):
    await handle_driver_ws(websocket, driver_id)


@router.websocket("/ws/dispatcher/{tenant_id}")
async def dispatcher_websocket(websocket: WebSocket, tenant_id: str):
    await handle_dispatcher_ws(websocket, tenant_id)
