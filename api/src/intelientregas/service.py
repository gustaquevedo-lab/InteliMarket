"""InteliEntregas service — delivery management"""

import uuid
import random
import string
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from api.src.intelientregas.models import (
    Driver, Vehicle, Delivery, Route, RouteStop,
    TrackingEvent, DeliveryProof, DeliveryZone,
    DeliveryStatus, DriverStatus,
)
from api.src.intelientregas.schemas import (
    DriverCreate, DriverUpdate, VehicleCreate,
    DeliveryCreate, DeliveryAssign, DeliveryUpdateStatus,
    DeliveryProofCreate, RouteCreate, RouteAddDelivery,
    TrackingEventCreate, ZoneCreate,
)
from api.src.auth.jwt import hash_password, verify_password, create_access_token
from api.src.integrations.service import send_webhook_async


# ============================================================
# DRIVERS
# ============================================================

async def list_drivers(db: AsyncSession, company_id: str, status: str | None = None) -> list[Driver]:
    query = select(Driver).where(Driver.company_id == company_id, Driver.activo == True)
    if status:
        query = query.where(Driver.status == status)
    query = query.order_by(Driver.nombre)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_driver(db: AsyncSession, driver_id: str) -> Driver | None:
    result = await db.execute(select(Driver).where(Driver.id == uuid.UUID(driver_id)))
    return result.scalar_one_or_none()


async def create_driver(db: AsyncSession, company_id: str, data: DriverCreate) -> Driver:
    kwargs = data.model_dump(exclude={"pin"})
    if data.pin:
        kwargs["pin_hash"] = hash_password(data.pin)
    driver = Driver(company_id=company_id, **kwargs)
    db.add(driver)
    await db.flush()
    await db.refresh(driver)
    return driver


async def update_driver(db: AsyncSession, driver_id: str, data: DriverUpdate) -> Driver | None:
    result = await db.execute(select(Driver).where(Driver.id == uuid.UUID(driver_id)))
    driver = result.scalar_one_or_none()
    if not driver:
        return None
    kwargs = data.model_dump(exclude_unset=True, exclude={"pin"})
    if data.pin is not None:
        kwargs["pin_hash"] = hash_password(data.pin)
    for key, value in kwargs.items():
        setattr(driver, key, value)
    await db.flush()
    await db.refresh(driver)
    return driver


async def driver_login(db: AsyncSession, telefono: str, pin: str) -> dict | None:
    result = await db.execute(select(Driver).where(Driver.telefono == telefono, Driver.activo == True))
    driver = result.scalar_one_or_none()
    if not driver or not driver.pin_hash:
        return None
    if not verify_password(pin, driver.pin_hash):
        return None
    token = create_access_token({
        "sub": str(driver.id),
        "driver_id": str(driver.id),
        "company_id": str(driver.company_id),
        "type": "driver_access",
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "driver_id": str(driver.id),
        "company_id": str(driver.company_id),
        "nombre": driver.nombre,
    }


async def delete_driver(db: AsyncSession, driver_id: str) -> bool:
    result = await db.execute(select(Driver).where(Driver.id == uuid.UUID(driver_id)))
    driver = result.scalar_one_or_none()
    if not driver:
        return False
    driver.activo = False
    await db.commit()
    return True


# ============================================================
# VEHICLES
# ============================================================

async def list_vehicles(db: AsyncSession, company_id: str) -> list[Vehicle]:
    result = await db.execute(
        select(Vehicle).where(Vehicle.company_id == company_id, Vehicle.activo == True).order_by(Vehicle.tipo)
    )
    return list(result.scalars().all())


async def create_vehicle(db: AsyncSession, company_id: str, data: VehicleCreate) -> Vehicle:
    vehicle = Vehicle(company_id=company_id, **data.model_dump())
    db.add(vehicle)
    await db.flush()
    await db.refresh(vehicle)
    return vehicle


# ============================================================
# DELIVERIES
# ============================================================

def _generate_tracking_code() -> str:
    return "IT-" + "".join(random.choices(string.digits, k=8))


async def list_deliveries(
    db: AsyncSession,
    company_id: str,
    estado: str | None = None,
    driver_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Delivery]:
    query = select(Delivery).where(Delivery.company_id == company_id, Delivery.activo == True)
    if estado:
        query = query.where(Delivery.estado == estado)
    if driver_id:
        query = query.where(Delivery.driver_id == uuid.UUID(driver_id))
    query = query.order_by(Delivery.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_delivery(db: AsyncSession, delivery_id: str) -> Delivery | None:
    result = await db.execute(
        select(Delivery).where(Delivery.id == uuid.UUID(delivery_id))
    )
    return result.scalar_one_or_none()


async def create_delivery(db: AsyncSession, company_id: str, data: DeliveryCreate) -> Delivery:
    delivery = Delivery(
        company_id=company_id,
        tracking_code=_generate_tracking_code(),
        **data.model_dump(),
    )
    db.add(delivery)
    await db.flush()
    await db.refresh(delivery)
    return delivery


async def assign_delivery(db: AsyncSession, delivery_id: str, data: DeliveryAssign) -> Delivery | None:
    result = await db.execute(select(Delivery).where(Delivery.id == uuid.UUID(delivery_id)))
    delivery = result.scalar_one_or_none()
    if not delivery:
        return None

    delivery.driver_id = data.driver_id
    delivery.vehicle_id = data.vehicle_id
    delivery.estado = DeliveryStatus.assigned
    delivery.assigned_at = datetime.now(timezone.utc)

    # Update driver status
    driver_result = await db.execute(select(Driver).where(Driver.id == data.driver_id))
    driver = driver_result.scalar_one_or_none()
    if driver:
        driver.status = DriverStatus.on_delivery

    await db.flush()
    await db.refresh(delivery)

    # Send WhatsApp notification
    await _send_whatsapp_notification(db, delivery, "assigned")

    # Fire webhook
    try:
        await send_webhook_async(db, "entrega.asignada", {
            "delivery_id": str(delivery.id),
            "company_id": delivery.company_id,
            "tracking_code": delivery.tracking_code,
            "driver_id": str(data.driver_id) if data.driver_id else None,
            "estado": delivery.estado.value if hasattr(delivery.estado, 'value') else str(delivery.estado),
        })
    except Exception:
        pass

    return delivery


async def update_delivery_status(
    db: AsyncSession, delivery_id: str, data: DeliveryUpdateStatus
) -> Delivery | None:
    result = await db.execute(select(Delivery).where(Delivery.id == uuid.UUID(delivery_id)))
    delivery = result.scalar_one_or_none()
    if not delivery:
        return None

    now = datetime.now(timezone.utc)
    estado = data.estado

    delivery.estado = estado

    if estado == "picked_up":
        delivery.picked_up_at = now
    elif estado == "in_transit":
        delivery.in_transit_at = now
    elif estado == "delivered":
        delivery.delivered_at = now
        # Free up driver
        if delivery.driver_id:
            driver_result = await db.execute(select(Driver).where(Driver.id == delivery.driver_id))
            driver = driver_result.scalar_one_or_none()
            if driver:
                driver.status = DriverStatus.available
                driver.total_deliveries = (driver.total_deliveries or 0) + 1
    elif estado == "failed":
        delivery.failed_at = now
        delivery.motivo_falla = data.motivo_falla
        if delivery.driver_id:
            driver_result = await db.execute(select(Driver).where(Driver.id == delivery.driver_id))
            driver = driver_result.scalar_one_or_none()
            if driver:
                driver.status = DriverStatus.available

    await db.flush()
    await db.refresh(delivery)

    # Send WhatsApp notification for significant status changes
    if estado in ("picked_up", "in_transit", "delivered", "failed"):
        await _send_whatsapp_notification(db, delivery, estado)

    # Fire webhook
    try:
        evento_map = {
            "picked_up": "entrega.recogida",
            "in_transit": "entrega.transito",
            "delivered": "entrega.entregada",
            "failed": "entrega.fallida",
        }
        evento = evento_map.get(estado)
        if evento:
            await send_webhook_async(db, evento, {
                "delivery_id": str(delivery.id),
                "company_id": delivery.company_id,
                "tracking_code": delivery.tracking_code,
                "estado": estado,
                "motivo_falla": data.motivo_falla if estado == "failed" else None,
            })
    except Exception:
        pass

    return delivery


async def add_proof(db: AsyncSession, delivery_id: str, data: DeliveryProofCreate) -> DeliveryProof:
    proof = DeliveryProof(delivery_id=uuid.UUID(delivery_id), **data.model_dump())
    db.add(proof)
    await db.flush()
    await db.refresh(proof)
    return proof


async def list_driver_deliveries(
    db: AsyncSession,
    driver_id: str,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Delivery]:
    query = select(Delivery).where(Delivery.driver_id == uuid.UUID(driver_id), Delivery.activo == True)
    if estado:
        query = query.where(Delivery.estado == estado)
    query = query.order_by(Delivery.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_proofs(db: AsyncSession, delivery_id: str) -> list[DeliveryProof]:
    result = await db.execute(
        select(DeliveryProof)
        .where(DeliveryProof.delivery_id == uuid.UUID(delivery_id))
        .order_by(DeliveryProof.created_at.desc())
    )
    return list(result.scalars().all())


# ============================================================
# TRACKING EVENTS
# ============================================================

async def create_tracking_event(db: AsyncSession, data: TrackingEventCreate) -> TrackingEvent:
    event = TrackingEvent(**data.model_dump())
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def get_tracking_history(
    db: AsyncSession, delivery_id: str, limit: int = 100
) -> list[TrackingEvent]:
    result = await db.execute(
        select(TrackingEvent)
        .where(TrackingEvent.delivery_id == uuid.UUID(delivery_id))
        .order_by(TrackingEvent.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_driver_last_position(db: AsyncSession, driver_id: str) -> TrackingEvent | None:
    result = await db.execute(
        select(TrackingEvent)
        .where(TrackingEvent.driver_id == uuid.UUID(driver_id))
        .order_by(TrackingEvent.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ============================================================
# ROUTES
# ============================================================

async def list_routes(
    db: AsyncSession,
    company_id: str,
    fecha: datetime | None = None,
    estado: str | None = None,
) -> list[Route]:
    query = select(Route).where(Route.company_id == company_id)
    if fecha:
        query = query.where(func.date(Route.fecha) == fecha.date())
    if estado:
        query = query.where(Route.estado == estado)
    query = query.order_by(Route.fecha.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_route(db: AsyncSession, company_id: str, data: RouteCreate) -> Route:
    route = Route(company_id=company_id, **data.model_dump())
    db.add(route)
    await db.flush()
    await db.refresh(route)
    return route


async def add_delivery_to_route(db: AsyncSession, route_id: str, data: RouteAddDelivery) -> RouteStop:
    stop = RouteStop(
        route_id=uuid.UUID(route_id),
        delivery_id=data.delivery_id,
        orden=data.orden,
    )
    db.add(stop)

    # Update route totals
    route_result = await db.execute(select(Route).where(Route.id == uuid.UUID(route_id)))
    route = route_result.scalar_one_or_none()
    if route:
        route.total_stops = (route.total_stops or 0) + 1

    # Update delivery route
    delivery_result = await db.execute(select(Delivery).where(Delivery.id == data.delivery_id))
    delivery = delivery_result.scalar_one_or_none()
    if delivery:
        delivery.route_id = uuid.UUID(route_id)

    await db.flush()
    await db.refresh(stop)
    return stop


async def start_route(db: AsyncSession, route_id: str) -> Route | None:
    result = await db.execute(select(Route).where(Route.id == uuid.UUID(route_id)))
    route = result.scalar_one_or_none()
    if not route:
        return None
    route.estado = "en_curso"
    route.started_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(route)
    return route


async def complete_route(db: AsyncSession, route_id: str) -> Route | None:
    result = await db.execute(select(Route).where(Route.id == uuid.UUID(route_id)))
    route = result.scalar_one_or_none()
    if not route:
        return None
    route.estado = "completada"
    route.completed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(route)
    return route


# ============================================================
# ZONES
# ============================================================

async def list_zones(db: AsyncSession, company_id: str) -> list[DeliveryZone]:
    result = await db.execute(
        select(DeliveryZone)
        .where(DeliveryZone.company_id == company_id, DeliveryZone.activo == True)
        .order_by(DeliveryZone.nombre)
    )
    return list(result.scalars().all())


async def create_zone(db: AsyncSession, company_id: str, data: ZoneCreate) -> DeliveryZone:
    zone = DeliveryZone(company_id=company_id, **data.model_dump())
    db.add(zone)
    await db.flush()
    await db.refresh(zone)
    return zone


async def calculate_delivery_cost(
    db: AsyncSession,
    company_id: str,
    latitud: float,
    longitud: float,
) -> dict:
    """Calculate delivery cost based on zones."""
    zones = await list_zones(db, company_id)

    for zone in zones:
        if zone.centro_lat and zone.centro_lon and zone.radio_km:
            # Simple distance calculation
            dist = _haversine_distance(zone.centro_lat, zone.centro_lon, latitud, longitud)
            if dist <= float(zone.radio_km):
                costo = float(zone.costo_base) + (dist * float(zone.costo_km))
                return {
                    "zone": zone.nombre,
                    "distance_km": round(dist, 2),
                    "cost": round(costo, 0),
                    "estimated_time_min": zone.tiempo_estimado_min,
                }

    return {
        "zone": "fuera_de_cobertura",
        "distance_km": None,
        "cost": None,
        "estimated_time_min": None,
    }


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two GPS coordinates."""
    from math import radians, sin, cos, sqrt, atan2
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


# ============================================================
# STATS
# ============================================================

# ============================================================
# AUTO ASSIGNMENT
# ============================================================

async def auto_assign_candidates(
    db: AsyncSession,
    company_id: str,
    delivery_id: str,
    limit: int = 5,
) -> list[dict]:
    """Find best drivers for a delivery based on distance, rating, and capacity."""
    delivery = await get_delivery(db, delivery_id)
    if not delivery:
        return []

    # Get available drivers with vehicles loaded
    result = await db.execute(
        select(Driver)
        .where(Driver.company_id == company_id, Driver.activo == True, Driver.status == "available")
        .order_by(Driver.nombre)
    )
    available_drivers = list(result.scalars().all())

    # Get all vehicles (for capacity info)
    veh_result = await db.execute(
        select(Vehicle).where(Vehicle.company_id == company_id, Vehicle.activo == True)
    )
    all_vehicles = {str(v.id): v for v in veh_result.scalars().all()}

    candidates = []
    for driver in available_drivers:
        # Find driver's vehicle (if assigned)
        vehicle = None
        for v in all_vehicles.values():
            if v.driver_id and str(v.driver_id) == str(driver.id):
                vehicle = v
                break

        # Get last known position
        last_pos = await get_driver_last_position(db, str(driver.id))

        # Calculate distance
        dist = None
        if last_pos and delivery.latitud and delivery.longitud and last_pos.latitud and last_pos.longitud:
            dist = _haversine_distance(
                float(last_pos.latitud), float(last_pos.longitud),
                float(delivery.latitud), float(delivery.longitud),
            )

        # Score calculation (0-100)
        score = 50.0  # base

        if dist is not None:
            distance_score = max(0, 100 - dist * 5)  # 0km=100, 20km=0
            score += distance_score * 0.5

        rating_score = (float(driver.rating or 0) / 5.0) * 100
        score += rating_score * 0.2

        if vehicle and vehicle.capacidad_kg:
            cap_score = min(100, float(vehicle.capacidad_kg) * 2)
            score += cap_score * 0.15

        if driver.total_deliveries > 0:
            exp_score = min(100, driver.total_deliveries)
            score += exp_score * 0.15

        candidates.append({
            "driver_id": driver.id,
            "driver_nombre": driver.nombre,
            "driver_rating": float(driver.rating or 0),
            "driver_total_deliveries": driver.total_deliveries or 0,
            "vehicle_id": vehicle.id if vehicle else None,
            "vehicle_tipo": vehicle.tipo if vehicle else None,
            "vehicle_capacidad_kg": float(vehicle.capacidad_kg) if vehicle and vehicle.capacidad_kg else None,
            "distance_km": round(dist, 2) if dist is not None else None,
            "score": round(score, 1),
        })

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates[:limit]


async def auto_assign_batch(db: AsyncSession, company_id: str) -> dict:
    """Auto-assign all pending deliveries to best available drivers."""
    result = await db.execute(
        select(Delivery)
        .where(Delivery.company_id == company_id, Delivery.activo == True, Delivery.estado == "pending")
        .order_by(Delivery.prioridad.desc(), Delivery.created_at.asc())
    )
    pending = list(result.scalars().all())

    assigned = 0
    errors = 0

    for delivery in pending:
        candidates = await auto_assign_candidates(db, company_id, str(delivery.id), limit=3)
        if not candidates:
            errors += 1
            continue

        best = candidates[0]
        assign_data = DeliveryAssign(
            driver_id=best["driver_id"],
            vehicle_id=best["vehicle_id"],
        )
        await assign_delivery(db, str(delivery.id), assign_data)
        assigned += 1

    return {"assigned": assigned, "pending": len(pending), "errors": errors}


# ============================================================
# WHATSAPP NOTIFICATIONS
# ============================================================

ENTREGA_WA_TIPO = {
    "assigned": "entrega.assigned",
    "picked_up": "entrega.picked_up",
    "in_transit": "entrega.in_transit",
    "delivered": "entrega.delivered",
    "failed": "entrega.failed",
}


async def _send_whatsapp_notification(db: AsyncSession, delivery: Delivery, estado: str):
    """Send WhatsApp notification to customer about delivery status."""
    if not delivery.customer_telefono:
        return

    from api.src.whatsapp.service import get_wa_template, format_wa_template, send_message_to_phone
    from uuid import UUID

    tipo = ENTREGA_WA_TIPO.get(estado)
    if not tipo:
        return

    template = await get_wa_template(db, UUID(delivery.company_id), tipo) if delivery.company_id else None
    if not template:
        return

    full_message = format_wa_template(template, NUMERO=delivery.tracking_code or delivery.id[:8].upper())
    if delivery.tracking_code:
        full_message += f"\n\nCódigo de seguimiento: {delivery.tracking_code}"

    await send_message_to_phone(db, delivery.company_id, delivery.customer_telefono, full_message)


async def get_stats(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(Delivery.estado, func.count(Delivery.id))
        .where(Delivery.company_id == company_id, Delivery.activo == True)
        .group_by(Delivery.estado)
    )
    by_estado = dict(result.all())

    result = await db.execute(
        select(func.avg(Driver.rating)).where(Driver.company_id == company_id, Driver.activo == True)
    )
    avg_rating = result.scalar() or 0

    return {
        "total_deliveries": sum(by_estado.values()),
        "by_estado": by_estado,
        "pending": by_estado.get("pending", 0),
        "in_transit": by_estado.get("in_transit", 0),
        "delivered": by_estado.get("delivered", 0),
        "failed": by_estado.get("failed", 0),
        "avg_driver_rating": round(float(avg_rating), 2),
    }
