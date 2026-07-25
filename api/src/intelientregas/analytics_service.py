"""Delivery profitability analytics — margins by route, zone, driver, vehicle, business line."""

from datetime import datetime, timezone, timedelta
from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.intelientregas.models import Delivery, Driver, Vehicle, Route, RouteStop, DeliveryZone, DeliveryStatus
from api.src.intelientregas.fleet_models import VehicleFuelEntry, VehicleExpense, VehicleMaintenance


async def get_profitability_summary(db: AsyncSession, company_id: str, days: int = 30) -> dict:
    """Overall delivery P&L for last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    r = await db.execute(
        select(
            func.count(Delivery.id),
            func.coalesce(func.sum(Delivery.costo_delivery), 0),
        ).where(
            Delivery.company_id == company_id,
            Delivery.estado.in_(["delivered", "in_transit"]),
            Delivery.created_at >= since,
        )
    )
    row = r.one()
    total_deliveries = row[0]
    total_revenue = float(row[1])

    r = await db.execute(
        select(
            func.coalesce(func.sum(VehicleFuelEntry.costo_total), 0),
            func.coalesce(func.sum(VehicleExpense.monto), 0),
        ).where(
            VehicleFuelEntry.fecha >= since,
        )
    )
    fuel_row = r.one()
    fuel_cost = float(fuel_row[0])
    expense_cost = float(fuel_row[1])

    r = await db.execute(
        select(func.coalesce(func.sum(VehicleMaintenance.costo), 0)).where(
            VehicleMaintenance.status == "completed",
            VehicleMaintenance.completed_date >= since,
        )
    )
    maintenance_cost = float(r.scalar() or 0)

    total_cost = fuel_cost + expense_cost + maintenance_cost
    gross_margin = total_revenue - total_cost
    margin_pct = round((gross_margin / max(total_revenue, 1)) * 100, 1)

    return {
        "period_days": days,
        "total_deliveries": total_deliveries,
        "total_revenue": round(total_revenue, 0),
        "fuel_cost": round(fuel_cost, 0),
        "expense_cost": round(expense_cost, 0),
        "maintenance_cost": round(maintenance_cost, 0),
        "total_cost": round(total_cost, 0),
        "gross_margin": round(gross_margin, 0),
        "margin_pct": margin_pct,
        "avg_revenue_per_delivery": round(total_revenue / max(total_deliveries, 1), 0),
        "avg_cost_per_delivery": round(total_cost / max(total_deliveries, 1), 0),
    }


async def get_margins_by_route(db: AsyncSession, company_id: str, days: int = 30, limit: int = 20) -> list[dict]:
    """Revenue, cost, margin grouped by route."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    r = await db.execute(
        select(
            Route.nombre, Route.id,
            func.count(Delivery.id),
            func.coalesce(func.sum(Delivery.costo_delivery), 0),
            func.coalesce(Route.distancia_km, 0),
            func.coalesce(Route.total_stops, 0),
        )
        .select_from(Route)
        .outerjoin(Delivery, Delivery.route_id == Route.id)
        .where(
            Route.company_id == company_id,
            Delivery.estado.in_(["delivered", "in_transit"]),
            Delivery.created_at >= since,
        )
        .group_by(Route.id, Route.nombre, Route.distancia_km, Route.total_stops)
        .order_by(func.coalesce(func.sum(Delivery.costo_delivery), 0).desc())
        .limit(limit)
    )
    results = []
    for row in r.all():
        revenue = float(row[3])
        # Estimate route cost: fuel equivalent for distance
        route_cost = float(row[4] or 0) * 500  # ~Gs. 500/km fuel estimate
        margin = revenue - route_cost
        results.append({
            "route_id": str(row[1]),
            "route_nombre": row[0],
            "deliveries": row[2],
            "revenue": round(revenue, 0),
            "estimated_cost": round(route_cost, 0),
            "margin": round(margin, 0),
            "margin_pct": round((margin / max(revenue, 1)) * 100, 1),
            "distance_km": float(row[4] or 0),
            "stops": row[5],
        })
    return results


async def get_margins_by_zone(db: AsyncSession, company_id: str, days: int = 30) -> list[dict]:
    """Revenue, cost, margin grouped by delivery zone."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    zones = await db.execute(
        select(DeliveryZone).where(DeliveryZone.company_id == company_id, DeliveryZone.activo == True)
    )
    zone_results = []
    for zone in zones.scalars().all():
        r = await db.execute(
            select(
                func.count(Delivery.id),
                func.coalesce(func.sum(Delivery.costo_delivery), 0),
            ).where(
                Delivery.company_id == company_id,
                Delivery.estado.in_(["delivered", "in_transit"]),
                Delivery.created_at >= since,
            )
        )
        row = r.one()
        count = row[0]
        revenue = float(row[1])

        # Estimate delivery cost based on zone pricing
        estimated_cost = count * (float(zone.costo_base) + float(zone.costo_km or 0) * float(zone.radio_km or 5))
        margin = revenue - estimated_cost
        zone_results.append({
            "zone_id": str(zone.id),
            "zone_nombre": zone.nombre,
            "deliveries": count,
            "revenue": round(revenue, 0),
            "estimated_cost": round(estimated_cost, 0),
            "margin": round(margin, 0),
            "margin_pct": round((margin / max(revenue, 1)) * 100, 1),
        })
    return sorted(zone_results, key=lambda z: z["revenue"], reverse=True)


async def get_margins_by_driver(db: AsyncSession, company_id: str, days: int = 30, limit: int = 20) -> list[dict]:
    """Profitability per driver."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    r = await db.execute(
        select(
            Driver.nombre, Driver.id,
            func.count(Delivery.id),
            func.coalesce(func.sum(Delivery.costo_delivery), 0),
            func.coalesce(Driver.total_deliveries, 0),
            func.coalesce(Driver.rating, 0),
        )
        .select_from(Driver)
        .outerjoin(Delivery, and_(Delivery.driver_id == Driver.id, Delivery.estado.in_(["delivered", "in_transit"]), Delivery.created_at >= since))
        .where(Driver.company_id == company_id, Driver.activo == True)
        .group_by(Driver.id, Driver.nombre, Driver.total_deliveries, Driver.rating)
        .order_by(func.coalesce(func.sum(Delivery.costo_delivery), 0).desc())
        .limit(limit)
    )
    results = []
    for row in r.all():
        revenue = float(row[3])
        driver_cost = revenue * 0.3  # Estimate: 30% driver cost (salary/commission)
        margin = revenue - driver_cost
        results.append({
            "driver_id": str(row[1]),
            "driver_nombre": row[0],
            "deliveries": row[2],
            "revenue": round(revenue, 0),
            "estimated_cost": round(driver_cost, 0),
            "margin": round(margin, 0),
            "margin_pct": round((margin / max(revenue, 1)) * 100, 1),
            "total_lifetime": row[4],
            "rating": float(row[5]),
        })
    return results


async def get_margins_by_vehicle(db: AsyncSession, company_id: str, days: int = 30, limit: int = 20) -> list[dict]:
    """Profitability per vehicle."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Get actual costs per vehicle
    fuel_r = await db.execute(
        select(
            VehicleFuelEntry.vehicle_id,
            func.coalesce(func.sum(VehicleFuelEntry.costo_total), 0),
        ).where(VehicleFuelEntry.fecha >= since)
        .group_by(VehicleFuelEntry.vehicle_id)
    )
    fuel_by_vehicle = {str(r[0]): float(r[1]) for r in fuel_r.all()}

    exp_r = await db.execute(
        select(
            VehicleExpense.vehicle_id,
            func.coalesce(func.sum(VehicleExpense.monto), 0),
        ).where(VehicleExpense.fecha >= since)
        .group_by(VehicleExpense.vehicle_id)
    )
    exp_by_vehicle = {str(r[0]): float(r[1]) for r in exp_r.all()}

    maint_r = await db.execute(
        select(
            VehicleMaintenance.vehicle_id,
            func.coalesce(func.sum(VehicleMaintenance.costo), 0),
        ).where(
            VehicleMaintenance.status == "completed",
            VehicleMaintenance.completed_date >= since,
        )
        .group_by(VehicleMaintenance.vehicle_id)
    )
    maint_by_vehicle = {str(r[0]): float(r[1]) for r in maint_r.all()}

    r = await db.execute(
        select(
            Vehicle.marca, Vehicle.modelo, Vehicle.patente, Vehicle.tipo, Vehicle.id,
        ).where(Vehicle.company_id == company_id, Vehicle.activo == True)
    )
    results = []
    for row in r.all():
        vid = str(row[4])
        fuel = fuel_by_vehicle.get(vid, 0)
        exp = exp_by_vehicle.get(vid, 0)
        maint = maint_by_vehicle.get(vid, 0)
        total_cost = fuel + exp + maint

        dr = await db.execute(
            select(
                func.count(Delivery.id),
                func.coalesce(func.sum(Delivery.costo_delivery), 0),
            ).where(
                Delivery.vehicle_id == UUID(vid),
                Delivery.estado.in_(["delivered", "in_transit"]),
                Delivery.created_at >= since,
            )
        )
        drow = dr.one()
        deliveries = drow[0]
        revenue = float(drow[1])

        margin = revenue - total_cost
        results.append({
            "vehicle_id": vid,
            "vehicle_label": f"{row[0] or ''} {row[1] or ''} ({row[2] or 'sin patente'})",
            "vehicle_tipo": row[3],
            "deliveries": deliveries,
            "revenue": round(revenue, 0),
            "fuel_cost": round(fuel, 0),
            "expense_cost": round(exp, 0),
            "maintenance_cost": round(maint, 0),
            "total_cost": round(total_cost, 0),
            "margin": round(margin, 0),
            "margin_pct": round((margin / max(revenue, 1)) * 100, 1),
        })
    return sorted(results, key=lambda v: v["revenue"], reverse=True)[:limit]


async def get_business_line_summary(db: AsyncSession, company_id: str, days: int = 30) -> list[dict]:
    """Breakdown by business line — uses delivery priority as proxy for line of business."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    r = await db.execute(
        select(
            Delivery.prioridad,
            func.count(Delivery.id),
            func.coalesce(func.sum(Delivery.costo_delivery), 0),
        ).where(
            Delivery.company_id == company_id,
            Delivery.estado.in_(["delivered", "in_transit"]),
            Delivery.created_at >= since,
        )
        .group_by(Delivery.prioridad)
        .order_by(func.coalesce(func.sum(Delivery.costo_delivery), 0).desc())
    )
    results = []
    for row in r.all():
        revenue = float(row[2])
        cost = revenue * 0.4  # blended cost estimate
        margin = revenue - cost
        labels = {"normal": "Entregas Regulares", "high": "Entregas Prioritarias", "urgent": "Entregas Urgentes"}
        results.append({
            "linea": labels.get(row[0], row[0]),
            "deliveries": row[1],
            "revenue": round(revenue, 0),
            "estimated_cost": round(cost, 0),
            "margin": round(margin, 0),
            "margin_pct": round((margin / max(revenue, 1)) * 100, 1),
        })
    return results


async def get_delivery_performance_kpi(db: AsyncSession, company_id: str, days: int = 30) -> dict:
    """Delivery-specific KPIs: on-time rate, cost per km, fuel efficiency, etc."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    r = await db.execute(
        select(
            func.count(Delivery.id),
            func.sum(func.cast(Delivery.estado == "delivered", func.INT)),
            func.sum(func.cast(Delivery.estado == "failed", func.INT)),
            func.avg(Delivery.costo_delivery),
        ).where(
            Delivery.company_id == company_id,
            Delivery.created_at >= since,
        )
    )
    row = r.one()
    total = row[0] or 0
    delivered = row[1] or 0
    failed = row[2] or 0
    avg_fee = float(row[3] or 0)

    fuel_r = await db.execute(
        select(func.coalesce(func.sum(VehicleFuelEntry.litros), 0)).where(VehicleFuelEntry.fecha >= since)
    )
    total_liters = float(fuel_r.scalar() or 0)

    r = await db.execute(
        select(func.coalesce(func.sum(Route.distancia_km), 0)).where(Route.company_id == company_id)
    )
    total_km = float(r.scalar() or 0)

    return {
        "total_deliveries": total,
        "delivered": delivered,
        "failed": failed,
        "delivery_rate": round(delivered / max(total, 1) * 100, 1),
        "failed_rate": round(failed / max(total, 1) * 100, 1),
        "avg_fee": round(avg_fee, 0),
        "total_liters_fuel": round(total_liters, 1),
        "total_km": round(total_km, 1),
        "fuel_efficiency_kmpl": round(total_km / max(total_liters, 0.1), 1),
        "avg_cost_per_km": round(total_km > 0 and (avg_fee * total) / total_km or 0, 0),
    }
