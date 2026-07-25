"""Tracking — Business logic for seller tracking, geofence detection, performance metrics."""

import json
import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from api.src.distribuidora import models as m
from api.src.distribuidora.tracking_models import (
    SellerProfile, SellerGPSTracking, RouteInstance, RouteStopVisit,
    GeofenceZone, GeofenceAlert, SellerPerformanceMetric,
)


# ═══════════════════════════════════════════════════════════════
# SELLER PROFILES
# ═══════════════════════════════════════════════════════════════

async def list_sellers(db: AsyncSession, company_id: str):
    r = await db.execute(
        select(SellerProfile).where(
            SellerProfile.company_id == UUID(company_id)
        ).order_by(SellerProfile.codigo_vendedor)
    )
    return r.scalars().all()


async def get_seller(db: AsyncSession, seller_id: str):
    r = await db.execute(select(SellerProfile).where(SellerProfile.id == UUID(seller_id)))
    return r.scalar_one_or_none()


async def get_seller_by_user(db: AsyncSession, user_id: str):
    r = await db.execute(select(SellerProfile).where(SellerProfile.user_id == UUID(user_id)))
    return r.scalar_one_or_none()


async def create_seller(db: AsyncSession, company_id: str, data: dict):
    obj = SellerProfile(company_id=UUID(company_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_seller(db: AsyncSession, seller_id: str, data: dict):
    obj = await get_seller(db, seller_id)
    if not obj:
        raise HTTPException(404, "Vendedor no encontrado")
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    obj.updated_at = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_sellers_with_users(db: AsyncSession, company_id: str):
    """Join SellerProfile with users table."""
    from api.src.auth.models import User
    r = await db.execute(
        select(SellerProfile, User.nombre, User.email)
        .join(User, SellerProfile.user_id == User.id)
        .where(SellerProfile.company_id == UUID(company_id))
        .order_by(User.nombre)
    )
    rows = r.all()
    result = []
    for sp, nombre, email in rows:
        d = {c.name: getattr(sp, c.name) for c in sp.__table__.columns}
        d["user_nombre"] = nombre
        d["user_email"] = email
        result.append(d)
    return result


# ═══════════════════════════════════════════════════════════════
# GPS TRACKING — Record and retrieve
# ═══════════════════════════════════════════════════════════════

async def record_gps_ping(db: AsyncSession, seller_id: str, data: dict):
    """Record a GPS ping and update seller's last location."""
    seller = await get_seller(db, seller_id)
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")

    now = datetime.now(timezone.utc)
    recorded = data.get("recorded_at") or now

    ping = SellerGPSTracking(
        seller_id=UUID(seller_id),
        lat=data["lat"],
        lng=data["lng"],
        battery_level=data.get("battery_level"),
        speed_kmh=data.get("speed_kmh"),
        accuracy_meters=data.get("accuracy_meters"),
        altitude_meters=data.get("altitude_meters"),
        recorded_at=recorded,
    )
    db.add(ping)

    # Update seller's live location
    seller.last_lat = data["lat"]
    seller.last_lng = data["lng"]
    seller.last_location_updated = now
    seller.last_speed_kmh = data.get("speed_kmh")
    if data.get("battery_level") is not None:
        seller.phone_battery_level = data["battery_level"]
        seller.phone_updated_at = now
    if seller.status == "offline":
        seller.status = "online"

    await db.commit()
    await db.refresh(ping)
    return ping


async def get_gps_trail(db: AsyncSession, seller_id: str, limit: int = 500):
    """Get the GPS breadcrumb trail for a seller."""
    r = await db.execute(
        select(SellerGPSTracking)
        .where(SellerGPSTracking.seller_id == UUID(seller_id))
        .order_by(SellerGPSTracking.recorded_at.desc())
        .limit(limit)
    )
    return list(reversed(list(r.scalars().all())))


# ═══════════════════════════════════════════════════════════════
# GEOFFENCE DETECTION ENGINE
# ═══════════════════════════════════════════════════════════════

def point_in_polygon(lat: float, lng: float, polygon: list) -> bool:
    """Ray-casting algorithm: is a point inside a polygon?"""
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        yi, xi = polygon[i][1], polygon[i][0]
        yj, xj = polygon[j][1], polygon[j][0]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def point_in_circle(lat: float, lng: float, center_lat: float, center_lng: float, radius_m: float) -> bool:
    """Haversine distance check."""
    R = 6371000
    dlat = math.radians(lat - center_lat)
    dlng = math.radians(lng - center_lng)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(center_lat)) * math.cos(math.radians(lat)) * math.sin(dlng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    dist = R * c
    return dist <= radius_m


def is_zone_active(zone: GeofenceZone, now: datetime | None = None) -> bool:
    """Check if a geofence zone's time-based rules are active."""
    if not zone.is_active:
        return False
    if not zone.active_start_time or not zone.active_end_time:
        return True

    now = now or datetime.now(timezone.utc)
    current_dow = now.weekday()  # 0=Monday
    # Convert to Sunday=0 format
    current_dow_sun = (current_dow + 1) % 7

    if zone.active_days and current_dow_sun not in zone.active_days:
        return False

    try:
        start_h, start_m = map(int, zone.active_start_time.split(":"))
        end_h, end_m = map(int, zone.active_end_time.split(":"))
        current_minutes = now.hour * 60 + now.minute
        start_minutes = start_h * 60 + start_m
        end_minutes = end_h * 60 + end_m

        if start_minutes <= end_minutes:
            return start_minutes <= current_minutes <= end_minutes
        else:
            return current_minutes >= start_minutes or current_minutes <= end_minutes
    except (ValueError, AttributeError):
        return True


async def check_geofence_violations(db: AsyncSession, seller_id: str, lat: Decimal, lng: Decimal):
    """Check if a seller's location triggers any geofence alerts."""
    seller = await get_seller(db, seller_id)
    if not seller:
        return []

    company_id = seller.company_id
    now = datetime.now(timezone.utc)
    alerts_created = []

    r = await db.execute(
        select(GeofenceZone).where(
            GeofenceZone.company_id == company_id,
            GeofenceZone.is_active == True,
        )
    )
    zones = r.scalars().all()

    for zone in zones:
        if not is_zone_active(zone, now):
            continue

        lat_f = float(lat)
        lng_f = float(lng)
        inside = False

        if zone.geometry_type == "polygon":
            coords = zone.coordinates if isinstance(zone.coordinates, list) else json.loads(zone.coordinates)
            inside = point_in_polygon(lat_f, lng_f, coords)
        elif zone.geometry_type == "circle":
            coords = zone.coordinates if isinstance(zone.coordinates, dict) else json.loads(zone.coordinates)
            inside = point_in_circle(lat_f, lng_f, float(coords["lat"]), float(coords["lng"]), float(coords.get("radius_m", 100)))

        if not inside:
            continue

        # Seller is inside a restricted/off_limits zone — create alert
        if zone.zone_type in ("restricted", "off_limits") and zone.alert_on_entry:
            # Check if there's already an active alert for this seller + zone
            r = await db.execute(
                select(GeofenceAlert).where(
                    GeofenceAlert.zone_id == zone.id,
                    GeofenceAlert.seller_id == UUID(seller_id),
                    GeofenceAlert.status.in_(["active", "acknowledged"]),
                ).limit(1)
            )
            existing = r.scalar_one_or_none()
            if existing:
                continue  # Still has active alert, no need to create another

            alert = GeofenceAlert(
                zone_id=zone.id,
                seller_id=UUID(seller_id),
                event_type="entry",
                lat=lat,
                lng=lng,
                detected_at=now,
                status="active",
            )
            db.add(alert)
            await db.flush()
            alerts_created.append(alert)

    if alerts_created:
        await db.commit()

    return alerts_created


# ═══════════════════════════════════════════════════════════════
# ROUTE INSTANCES
# ═══════════════════════════════════════════════════════════════

async def list_route_instances(db: AsyncSession, company_id: str, seller_id: str | None = None, fecha: str | None = None):
    q = select(RouteInstance).where(RouteInstance.company_id == UUID(company_id))
    if seller_id:
        q = q.where(RouteInstance.seller_id == UUID(seller_id))
    if fecha:
        q = q.where(func.date(RouteInstance.fecha) == date.fromisoformat(fecha))
    q = q.order_by(RouteInstance.fecha.desc()).limit(100)
    r = await db.execute(q)
    return r.scalars().all()


async def create_route_instance(db: AsyncSession, company_id: str, data: dict):
    obj = RouteInstance(company_id=UUID(company_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_route_instance(db: AsyncSession, instance_id: str):
    r = await db.execute(select(RouteInstance).where(RouteInstance.id == UUID(instance_id)))
    return r.scalar_one_or_none()


async def update_route_instance(db: AsyncSession, instance_id: str, data: dict):
    obj = await get_route_instance(db, instance_id)
    if not obj:
        raise HTTPException(404, "Instancia de ruta no encontrada")
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    obj.updated_at = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


async def start_route(db: AsyncSession, instance_id: str):
    return await update_route_instance(db, instance_id, {"status": "in_progress", "started_at": datetime.now(timezone.utc)})


async def end_route(db: AsyncSession, instance_id: str):
    return await update_route_instance(db, instance_id, {"status": "completed", "ended_at": datetime.now(timezone.utc)})


# ═══════════════════════════════════════════════════════════════
# ROUTE STOPS / VISITS
# ═══════════════════════════════════════════════════════════════

async def list_route_stops(db: AsyncSession, instance_id: str):
    r = await db.execute(
        select(RouteStopVisit)
        .where(RouteStopVisit.instance_id == UUID(instance_id))
        .order_by(RouteStopVisit.planned_order)
    )
    return r.scalars().all()


async def create_route_stop(db: AsyncSession, instance_id: str, data: dict):
    obj = RouteStopVisit(instance_id=UUID(instance_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def complete_route_stop(db: AsyncSession, stop_id: str, data: dict):
    r = await db.execute(select(RouteStopVisit).where(RouteStopVisit.id == UUID(stop_id)))
    obj = r.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Parada no encontrada")
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_route_stop(db: AsyncSession, stop_id: str):
    r = await db.execute(select(RouteStopVisit).where(RouteStopVisit.id == UUID(stop_id)))
    return r.scalar_one_or_none()


# ═══════════════════════════════════════════════════════════════
# GEOFENCE ZONES CRUD
# ═══════════════════════════════════════════════════════════════

async def list_geofence_zones(db: AsyncSession, company_id: str):
    r = await db.execute(
        select(GeofenceZone).where(GeofenceZone.company_id == UUID(company_id)).order_by(GeofenceZone.nombre)
    )
    return r.scalars().all()


async def create_geofence_zone(db: AsyncSession, company_id: str, data: dict):
    obj = GeofenceZone(company_id=UUID(company_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_geofence_zone(db: AsyncSession, zone_id: str):
    r = await db.execute(select(GeofenceZone).where(GeofenceZone.id == UUID(zone_id)))
    return r.scalar_one_or_none()


async def update_geofence_zone(db: AsyncSession, zone_id: str, data: dict):
    obj = await get_geofence_zone(db, zone_id)
    if not obj:
        raise HTTPException(404, "Zona no encontrada")
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    obj.updated_at = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_geofence_zone(db: AsyncSession, zone_id: str):
    obj = await get_geofence_zone(db, zone_id)
    if not obj:
        raise HTTPException(404, "Zona no encontrada")
    await db.delete(obj)
    await db.commit()
    return True


# ═══════════════════════════════════════════════════════════════
# GEOFENCE ALERTS
# ═══════════════════════════════════════════════════════════════

async def list_geofence_alerts(db: AsyncSession, company_id: str, status_filter: str | None = None, limit: int = 100):
    q = (
        select(GeofenceAlert)
        .join(GeofenceZone, GeofenceAlert.zone_id == GeofenceZone.id)
        .where(GeofenceZone.company_id == UUID(company_id))
    )
    if status_filter:
        q = q.where(GeofenceAlert.status == status_filter)
    q = q.order_by(GeofenceAlert.detected_at.desc()).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


async def acknowledge_alert(db: AsyncSession, alert_id: str, data: dict):
    r = await db.execute(select(GeofenceAlert).where(GeofenceAlert.id == UUID(alert_id)))
    obj = r.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Alerta no encontrada")
    obj.status = "acknowledged"
    obj.acknowledged_at = datetime.now(timezone.utc)
    obj.acknowledged_by = UUID(data["acknowledged_by"])
    if data.get("notas"):
        obj.notas = data["notas"]
    await db.commit()
    await db.refresh(obj)
    return obj


async def resolve_alert(db: AsyncSession, alert_id: str):
    r = await db.execute(select(GeofenceAlert).where(GeofenceAlert.id == UUID(alert_id)))
    obj = r.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Alerta no encontrada")
    obj.status = "resolved"
    obj.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(obj)
    return obj


# ═══════════════════════════════════════════════════════════════
# PERFORMANCE METRICS
# ═══════════════════════════════════════════════════════════════

async def calculate_seller_performance(db: AsyncSession, seller_id: str, period_type: str = "daily"):
    """Calculate performance metrics for a seller for a given period."""
    seller = await get_seller(db, seller_id)
    if not seller:
        raise HTTPException(404, "Vendedor no encontrado")

    company_id = seller.company_id
    today = date.today()

    if period_type == "daily":
        start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
    elif period_type == "weekly":
        start = datetime.combine(today - timedelta(days=today.weekday()), datetime.min.time()).replace(tzinfo=timezone.utc)
        end = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
    else:
        start = today.replace(day=1)
        start = datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)

    # Get route instances for this seller in period
    r = await db.execute(
        select(RouteInstance).where(
            RouteInstance.seller_id == UUID(seller_id),
            RouteInstance.fecha >= start,
            RouteInstance.fecha <= end,
        )
    )
    routes = r.scalars().all()

    total_visits = 0
    completed_visits = 0
    missed_visits = 0
    no_answer_count = 0
    total_orders = 0
    total_amount = Decimal("0")
    total_payment = Decimal("0")
    total_traveled_km = Decimal("0")
    total_work_seconds = 0
    productive_seconds = 0
    total_rating = 0
    rating_count = 0
    visit_durations = []
    travel_times = []

    for route in routes:
        total_traveled_km += route.total_traveled_km or Decimal("0")
        if route.started_at and route.ended_at:
            dur = (route.ended_at - route.started_at).total_seconds()
            total_work_seconds += dur
        else:
            # Estimate from visits
            pass

        r = await db.execute(
            select(RouteStopVisit).where(RouteStopVisit.instance_id == route.id)
            .order_by(RouteStopVisit.planned_order)
        )
        stops = r.scalars().all()

        for i, stop in enumerate(stops):
            total_visits += 1
            if stop.status == "completed":
                completed_visits += 1
            elif stop.status == "missed":
                missed_visits += 1
            elif stop.status == "no_answer":
                no_answer_count += 1 if stop.no_answer_count else 0

            if stop.order_amount and stop.order_amount > 0:
                total_orders += 1
                total_amount += stop.order_amount

            total_payment += stop.payment_collected or Decimal("0")

            if stop.actual_arrival and stop.actual_departure:
                dur = (stop.actual_departure - stop.actual_arrival).total_seconds()
                visit_durations.append(dur)
                productive_seconds += dur

            if stop.customer_rating:
                total_rating += stop.customer_rating
                rating_count += 1

            # Travel time between stops
            if i > 0:
                prev = stops[i - 1]
                if prev.actual_departure and stop.actual_arrival:
                    tt = (stop.actual_arrival - prev.actual_departure).total_seconds()
                    if 0 < tt < 7200:  # Sensible range: < 2 hours
                        travel_times.append(tt)

    work_hours = Decimal(str(round(total_work_seconds / 3600, 2)))
    productive_h = Decimal(str(round(productive_seconds / 3600, 2)))
    orders_per_h = Decimal("0")
    amount_per_h = Decimal("0")
    visits_per_h = Decimal("0")
    avg_duration = 0
    avg_travel = 0
    avg_rating = Decimal("0")

    if work_hours > 0:
        orders_per_h = Decimal(str(round(total_orders / float(work_hours), 2)))
        amount_per_h = Decimal(str(round(float(total_amount) / float(work_hours), 2)))
        visits_per_h = Decimal(str(round(total_visits / float(work_hours), 2)))

    if visit_durations:
        avg_duration = int(sum(visit_durations) / len(visit_durations) / 60)

    if travel_times:
        avg_travel = int(sum(travel_times) / len(travel_times) / 60)

    if rating_count > 0:
        avg_rating = Decimal(str(round(total_rating / rating_count, 2)))

    # Composite performance score (0-100)
    score = 0
    if total_visits > 0:
        completion_rate = completed_visits / total_visits
        order_rate = total_orders / total_visits if total_visits > 0 else 0
        score = int((
            completion_rate * 30 +
            order_rate * 25 +
            min(float(orders_per_h) / 3, 1) * 20 +
            min(float(avg_duration) / 30 if avg_duration > 0 else 1, 1) * 15 +
            min(float(avg_rating or 0) / 5, 1) * 10
        ))

    # Save metric
    metric = SellerPerformanceMetric(
        seller_id=UUID(seller_id),
        company_id=company_id,
        period_type=period_type,
        period_start=start,
        period_end=end,
        total_visits=total_visits,
        completed_visits=completed_visits,
        missed_visits=missed_visits,
        no_answer_count=no_answer_count,
        total_orders=total_orders,
        total_amount=total_amount,
        total_payment_collected=total_payment,
        total_traveled_km=total_traveled_km,
        total_work_hours=work_hours,
        productive_hours=productive_h,
        orders_per_hour=orders_per_h,
        amount_per_hour=amount_per_h,
        visits_per_hour=visits_per_h,
        avg_visit_duration_minutes=avg_duration,
        avg_travel_between_visits_minutes=avg_travel,
        avg_customer_rating=avg_rating,
        performance_score=score,
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return metric


async def get_seller_metrics_history(db: AsyncSession, seller_id: str, period_type: str = "daily", limit: int = 30):
    r = await db.execute(
        select(SellerPerformanceMetric)
        .where(
            SellerPerformanceMetric.seller_id == UUID(seller_id),
            SellerPerformanceMetric.period_type == period_type,
        )
        .order_by(SellerPerformanceMetric.period_start.desc())
        .limit(limit)
    )
    return list(reversed(list(r.scalars().all())))


async def get_performance_ranking(db: AsyncSession, company_id: str, period_type: str = "daily"):
    """Get performance scores for all sellers for ranking."""
    r = await db.execute(
        select(SellerPerformanceMetric)
        .where(
            SellerPerformanceMetric.company_id == UUID(company_id),
            SellerPerformanceMetric.period_type == period_type,
        )
        .order_by(SellerPerformanceMetric.period_start.desc())
    )
    metrics = r.scalars().all()

    # Get latest metric per seller
    latest: dict[str, SellerPerformanceMetric] = {}
    for mtr in metrics:
        if mtr.seller_id not in latest:
            latest[mtr.seller_id] = mtr

    # Sort by performance score
    ranked = sorted(latest.values(), key=lambda x: x.performance_score or 0, reverse=True)
    return ranked


# ═══════════════════════════════════════════════════════════════
# LIVE MAP DATA
# ═══════════════════════════════════════════════════════════════

async def get_live_map_data(db: AsyncSession, company_id: str):
    """Aggregate all data needed for the real-time map view."""
    sellers = await get_sellers_with_users(db, company_id)
    zones = await list_geofence_zones(db, company_id)
    alerts = await list_geofence_alerts(db, company_id, status_filter="active", limit=50)

    today = date.today()
    r = await db.execute(
        select(func.count(RouteStopVisit.id))
        .select_from(RouteStopVisit)
        .join(RouteInstance, RouteStopVisit.instance_id == RouteInstance.id)
        .where(
            RouteInstance.company_id == UUID(company_id),
            func.date(RouteInstance.fecha) == today,
        )
    )
    today_visits = r.scalar() or 0

    r = await db.execute(
        select(func.count(RouteStopVisit.id))
        .select_from(RouteStopVisit)
        .join(RouteInstance, RouteStopVisit.instance_id == RouteInstance.id)
        .where(
            RouteInstance.company_id == UUID(company_id),
            func.date(RouteInstance.fecha) == today,
            RouteStopVisit.status == "completed",
        )
    )
    today_completed = r.scalar() or 0

    r = await db.execute(
        select(func.coalesce(func.sum(RouteStopVisit.order_amount), 0))
        .select_from(RouteStopVisit)
        .join(RouteInstance, RouteStopVisit.instance_id == RouteInstance.id)
        .where(
            RouteInstance.company_id == UUID(company_id),
            func.date(RouteInstance.fecha) == today,
            RouteStopVisit.order_amount > 0,
        )
    )
    today_amount = r.scalar() or Decimal("0")

    r = await db.execute(
        select(func.count(RouteStopVisit.id))
        .select_from(RouteStopVisit)
        .join(RouteInstance, RouteStopVisit.instance_id == RouteInstance.id)
        .where(
            RouteInstance.company_id == UUID(company_id),
            func.date(RouteInstance.fecha) == today,
            RouteStopVisit.order_amount > 0,
        )
    )
    today_orders = r.scalar() or 0

    # Build sellers list for map
    map_sellers = []
    for s in sellers:
        map_sellers.append({
            "seller_id": str(s["id"]),
            "user_id": str(s["user_id"]),
            "nombre": s["user_nombre"],
            "photo_url": s.get("photo_url"),
            "status": s.get("status", "offline"),
            "lat": s.get("last_lat"),
            "lng": s.get("last_lng"),
            "battery_level": s.get("phone_battery_level", 100),
            "speed_kmh": s.get("last_speed_kmh"),
            "last_updated": s.get("last_location_updated"),
            "current_route_id": None,
            "current_route_name": None,
        })

    zones_data = []
    for z in zones:
        zd = {c.name: getattr(z, c.name) for c in z.__table__.columns}
        zones_data.append(zd)

    alerts_data = []
    for a in alerts:
        ad = {c.name: getattr(a, c.name) for c in a.__table__.columns}
        ad["zone_id"] = str(ad["zone_id"])
        ad["seller_id"] = str(ad["seller_id"])
        alerts_data.append(ad)

    return {
        "sellers": map_sellers,
        "geofence_zones": zones_data,
        "active_alerts": alerts_data,
        "today_visits": today_visits,
        "today_completed": today_completed,
        "today_orders": today_orders,
        "today_amount": today_amount,
    }
