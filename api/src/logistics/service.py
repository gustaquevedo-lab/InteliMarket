"""Logistics service"""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timezone
import uuid

from api.src.logistics.models import Delivery, Route, RouteStop, DeliveryStatus
from api.src.logistics.schemas import DeliveryCreate, DeliveryUpdate, RouteCreate, RouteStopCreate


async def create_delivery(db: AsyncSession, data: DeliveryCreate) -> Delivery:
    delivery = Delivery(**data.model_dump())
    db.add(delivery)
    await db.commit()
    await db.refresh(delivery)
    return delivery


async def list_deliveries(db: AsyncSession, company_id: str, estado: Optional[str] = None, driver_name: Optional[str] = None) -> list[Delivery]:
    query = select(Delivery).where(Delivery.company_id == company_id)
    if estado:
        query = query.where(Delivery.estado == estado)
    if driver_name:
        query = query.where(Delivery.driver_name.ilike(f"%{driver_name}%"))
    query = query.order_by(Delivery.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_delivery(db: AsyncSession, delivery_id: str) -> Delivery | None:
    result = await db.execute(select(Delivery).where(Delivery.id == uuid.UUID(delivery_id)))
    return result.scalar_one_or_none()


async def update_delivery(db: AsyncSession, delivery_id: str, data: DeliveryUpdate) -> Delivery | None:
    delivery = await get_delivery(db, delivery_id)
    if not delivery:
        return None
    update_data = data.model_dump(exclude_unset=True)
    if "estado" in update_data:
        update_data["estado"] = DeliveryStatus(update_data["estado"])
    for key, value in update_data.items():
        setattr(delivery, key, value)
    await db.commit()
    await db.refresh(delivery)
    return delivery


async def create_route(db: AsyncSession, data: RouteCreate) -> Route:
    route = Route(**data.model_dump())
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return route


async def list_routes(db: AsyncSession, company_id: str, estado: Optional[str] = None, fecha: Optional[datetime] = None, limit: int = 50, offset: int = 0) -> list[Route]:
    # Sin limit/offset esto devolvia los 83.383 viajes migrados de Casa
    # Gonzalito de una sola vez.
    query = select(Route).where(Route.company_id == company_id)
    if estado:
        query = query.where(Route.estado == estado)
    if fecha:
        query = query.where(Route.fecha >= fecha)
    query = query.order_by(Route.fecha.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_route(db: AsyncSession, route_id: str) -> Route | None:
    result = await db.execute(select(Route).where(Route.id == uuid.UUID(route_id)))
    return result.scalar_one_or_none()


async def add_route_stop(db: AsyncSession, data: RouteStopCreate) -> RouteStop:
    stop = RouteStop(**data.model_dump())
    db.add(stop)

    await db.execute(
        update(Route)
        .where(Route.id == data.route_id)
        .values(total_deliveries=Route.total_deliveries + 1)
    )

    await db.commit()
    await db.refresh(stop)
    return stop


async def get_route_stops(db: AsyncSession, route_id: str) -> list[RouteStop]:
    query = select(RouteStop).where(RouteStop.route_id == uuid.UUID(route_id)).order_by(RouteStop.orden)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_stop_status(db: AsyncSession, stop_id: str, estado: str, observaciones: Optional[str] = None) -> RouteStop | None:
    result = await db.execute(select(RouteStop).where(RouteStop.id == uuid.UUID(stop_id)))
    stop = result.scalar_one_or_none()
    if not stop:
        return None

    stop.estado = estado
    if estado == "delivered":
        stop.fecha_llegada = datetime.now(timezone.utc)
    if observaciones:
        stop.observaciones = observaciones

    if estado == "delivered":
        await db.execute(
            update(Route)
            .where(Route.id == stop.route_id)
            .values(completed_deliveries=Route.completed_deliveries + 1)
        )

    await db.commit()
    await db.refresh(stop)
    return stop


async def update_route_status(db: AsyncSession, route_id: str, estado: str) -> Route | None:
    route = await get_route(db, route_id)
    if not route:
        return None
    route.estado = estado
    await db.commit()
    await db.refresh(route)
    return route
