from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.viajes.models import Trip, TripStop, TripStopItem, TripVehicle
from api.src.viajes.schemas import (
    StopConfirmInput,
    TripCreate,
    TripStopAssign,
    TripVehicleCreate,
)
from api.src.sales_orders.models import SalesOrder, SalesOrderItem
from api.src.products.models import Product
from api.src.delivery_notes.service import DeliveryNoteService
from api.src.delivery_notes.schemas import DeliveryNoteCreate

logger = logging.getLogger(__name__)


async def list_vehicles(db: AsyncSession, company_id: str) -> List[TripVehicle]:
    result = await db.execute(
        select(TripVehicle)
        .where(TripVehicle.company_id == company_id, TripVehicle.activo == True)
        .order_by(TripVehicle.patente)
    )
    return result.scalars().all()


async def create_vehicle(db: AsyncSession, data: TripVehicleCreate) -> TripVehicle:
    vehicle = TripVehicle(**data.model_dump())
    db.add(vehicle)
    await db.flush()
    await db.commit()
    await db.refresh(vehicle)
    return vehicle


async def list_pending_orders(
    db: AsyncSession, company_id: str, fecha: date
) -> List[dict]:
    # SalesOrders facturados sin trip_stop del día
    subq = (
        select(TripStop.sales_order_id)
        .join(Trip, Trip.id == TripStop.trip_id)
        .where(Trip.company_id == company_id, Trip.fecha == fecha)
    )
    result = await db.execute(
        select(
            SalesOrder.id,
            SalesOrder.customer_id,
            SalesOrder.numero,
            SalesOrder.total,
        )
        .where(
            SalesOrder.company_id == company_id,
            SalesOrder.estado == "facturado",
            SalesOrder.id.not_in(subq),
        )
        .order_by(SalesOrder.numero)
    )
    rows = result.all()
    orders = []
    for row in rows:
        # Calcular peso estimado sumando (cantidad * peso_kg) de los ítems
        peso_result = await db.execute(
            select(func.coalesce(func.sum(SalesOrderItem.cantidad * Product.peso_kg), 0))
            .join(Product, Product.id == SalesOrderItem.product_id)
            .where(SalesOrderItem.order_id == row.id)
        )
        peso_kg = peso_result.scalar() or Decimal(0)
        orders.append(
            {
                "id": str(row.id),
                "customer_id": str(row.customer_id),
                "customer_name": str(row.customer_id),  # resoluble con join si se necesita
                "numero": row.numero,
                "total": row.total or Decimal(0),
                "peso_kg": peso_kg,
            }
        )
    return orders


async def list_trips(db: AsyncSession, company_id: str, fecha: date) -> List[Trip]:
    result = await db.execute(
        select(Trip)
        .where(Trip.company_id == company_id, Trip.fecha == fecha)
        .order_by(Trip.created_at)
    )
    return result.scalars().all()


async def create_trip(db: AsyncSession, data: TripCreate) -> Trip:
    existing = await db.execute(
        select(Trip).where(
            Trip.company_id == data.company_id,
            Trip.cobrador_id == data.cobrador_id,
            Trip.fecha == data.fecha,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ya existe un viaje para ese cobrador en esa fecha")
    trip = Trip(**data.model_dump())
    db.add(trip)
    await db.flush()
    await db.commit()
    await db.refresh(trip)
    return trip


async def update_trip_stops(
    db: AsyncSession,
    trip_id: str,
    stops: List[TripStopAssign],
    company_id: str,
) -> Trip:
    trip = await _get_trip_or_404(db, trip_id, company_id)
    if trip.estado != "armando":
        raise HTTPException(status_code=400, detail="Solo se pueden modificar paradas de trips en estado 'armando'")

    # Borrar paradas existentes (cascade borra los items)
    await db.execute(delete(TripStop).where(TripStop.trip_id == trip.id))

    for stop_data in stops:
        order_result = await db.execute(
            select(SalesOrder).where(SalesOrder.id == stop_data.sales_order_id)
        )
        order = order_result.scalar_one_or_none()

        stop = TripStop(
            trip_id=trip.id,
            sales_order_id=stop_data.sales_order_id,
            customer_id=stop_data.customer_id,
            orden_visita=stop_data.orden_visita,
        )
        db.add(stop)
        await db.flush()

        # Crear items desde los ítems del pedido
        if order:
            items_result = await db.execute(
                select(SalesOrderItem).where(SalesOrderItem.order_id == order.id)
            )
            for item in items_result.scalars().all():
                stop_item = TripStopItem(
                    stop_id=stop.id,
                    sales_order_item_id=item.id,
                    product_id=item.product_id,
                    cantidad_asignada=item.cantidad,
                )
                db.add(stop_item)

    await db.commit()
    await db.refresh(trip)
    return trip


async def confirm_trip(db: AsyncSession, trip_id: str, company_id: str) -> Trip:
    trip = await _get_trip_or_404(db, trip_id, company_id)

    # Calcular peso total
    stops_result = await db.execute(
        select(TripStop).where(TripStop.trip_id == trip.id)
    )
    stops = stops_result.scalars().all()

    total_weight = Decimal(0)
    for stop in stops:
        items_result = await db.execute(
            select(
                func.coalesce(func.sum(TripStopItem.cantidad_asignada * Product.peso_kg), 0)
            )
            .join(Product, Product.id == TripStopItem.product_id)
            .where(TripStopItem.stop_id == stop.id)
        )
        total_weight += items_result.scalar() or Decimal(0)

    # Validar capacidad del vehículo
    vehicle_result = await db.execute(
        select(TripVehicle).where(
            TripVehicle.company_id == company_id,
            TripVehicle.patente == trip.patente,
        )
    )
    vehicle = vehicle_result.scalar_one_or_none()
    if vehicle and total_weight > vehicle.max_weight_kg:
        raise HTTPException(
            status_code=400,
            detail=f"Peso total {total_weight}kg excede capacidad {vehicle.max_weight_kg}kg del vehículo",
        )

    trip.peso_total_kg = total_weight
    trip.estado = "listo"
    await db.commit()
    await db.refresh(trip)
    return trip


async def get_mi_viaje_hoy(
    db: AsyncSession, company_id: str, cobrador_id: str, fecha: date
) -> Optional[Trip]:
    result = await db.execute(
        select(Trip).where(
            Trip.company_id == company_id,
            Trip.cobrador_id == cobrador_id,
            Trip.fecha == fecha,
        )
    )
    return result.scalar_one_or_none()


async def register_salida(
    db: AsyncSession, trip_id: str, km_salida: int, company_id: str
) -> Trip:
    trip = await _get_trip_or_404(db, trip_id, company_id)
    if trip.estado != "listo":
        raise HTTPException(status_code=400, detail="El viaje debe estar en estado 'listo' para registrar salida")
    trip.km_salida = km_salida
    trip.estado = "en_ruta"
    await db.commit()
    await db.refresh(trip)
    return trip


async def confirm_stop(
    db: AsyncSession,
    stop_id: str,
    input_data: StopConfirmInput,
    company_id: str,
    cobrador_id: str,
) -> TripStop:
    stop_result = await db.execute(
        select(TripStop)
        .join(Trip, Trip.id == TripStop.trip_id)
        .where(TripStop.id == stop_id, Trip.company_id == company_id)
    )
    stop = stop_result.scalar_one_or_none()
    if not stop:
        raise HTTPException(status_code=404, detail="Parada no encontrada")
    if stop.estado != "pendiente":
        raise HTTPException(status_code=409, detail="La parada ya fue confirmada")

    # Obtener trip para validaciones
    trip_result = await db.execute(select(Trip).where(Trip.id == stop.trip_id))
    trip = trip_result.scalar_one_or_none()

    dn_service = DeliveryNoteService(db)
    total_rechazada = Decimal(0)
    total_asignada = Decimal(0)

    for item_input in input_data.items:
        item_result = await db.execute(
            select(TripStopItem).where(TripStopItem.id == item_input.stop_item_id)
        )
        item = item_result.scalar_one_or_none()
        if not item:
            continue

        # Validar que suma no excede lo asignado
        suma = item_input.cantidad_entregada + item_input.cantidad_rechazada + item_input.cantidad_faltante
        if suma > item.cantidad_asignada:
            raise HTTPException(
                status_code=422,
                detail=f"La suma de cantidades ({suma}) excede lo asignado ({item.cantidad_asignada})",
            )

        item.cantidad_entregada = item_input.cantidad_entregada
        item.cantidad_rechazada = item_input.cantidad_rechazada
        item.cantidad_faltante = item_input.cantidad_faltante
        total_asignada += item.cantidad_asignada
        total_rechazada += item_input.cantidad_rechazada

        # NC por rechazo (best-effort)
        if item_input.cantidad_rechazada > 0:
            try:
                precio_result = await db.execute(
                    select(SalesOrderItem.precio_unitario)
                    .where(SalesOrderItem.id == item.sales_order_item_id)
                )
                precio = precio_result.scalar() or Decimal(0)
                nc = await dn_service.create(
                    DeliveryNoteCreate(
                        company_id=company_id,
                        customer_id=str(stop.customer_id),
                        sale_id=str(stop.sales_order_id),
                        numero_nota=f"NC-RECH-{str(item.id)[:8]}",
                        fecha=datetime.now(timezone.utc).date(),
                        monto=precio * item_input.cantidad_rechazada,
                        concepto="no_es_su_pedido",
                    )
                )
                item.nc_id = nc.id
            except Exception:
                logger.exception("Error generando NC de rechazo para item %s", item.id)

        # NC por faltante (best-effort)
        if item_input.cantidad_faltante > 0:
            try:
                precio_result = await db.execute(
                    select(SalesOrderItem.precio_unitario)
                    .where(SalesOrderItem.id == item.sales_order_item_id)
                )
                precio = precio_result.scalar() or Decimal(0)
                nc = await dn_service.create(
                    DeliveryNoteCreate(
                        company_id=company_id,
                        customer_id=str(stop.customer_id),
                        sale_id=str(stop.sales_order_id),
                        numero_nota=f"NC-FALT-{str(item.id)[:8]}",
                        fecha=datetime.now(timezone.utc).date(),
                        monto=precio * item_input.cantidad_faltante,
                        concepto="faltante_deposito",
                    )
                )
                item.nc_id = nc.id if not item.nc_id else item.nc_id
            except Exception:
                logger.exception("Error generando NC de faltante para item %s", item.id)

    # Calcular estado de la parada
    items_result = await db.execute(
        select(TripStopItem).where(TripStopItem.stop_id == stop.id)
    )
    all_items = items_result.scalars().all()
    total_asig = sum(i.cantidad_asignada for i in all_items)
    total_rech = sum(i.cantidad_rechazada for i in all_items)
    total_falt = sum(i.cantidad_faltante for i in all_items)

    if total_rech >= total_asig:
        new_estado = "rechazado_total"
    elif total_rech > 0:
        new_estado = "rechazado_parcial"
    elif total_falt > 0:
        new_estado = "faltante"
    else:
        new_estado = "entregado"

    stop.estado = new_estado
    stop.firmado = input_data.firmado
    stop.observaciones = input_data.observaciones
    stop.visited_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(stop)
    return stop


async def register_llegada(
    db: AsyncSession, trip_id: str, km_llegada: int, company_id: str
) -> Trip:
    trip = await _get_trip_or_404(db, trip_id, company_id)

    # Validar que no queden paradas pendientes
    pending_result = await db.execute(
        select(func.count(TripStop.id)).where(
            TripStop.trip_id == trip.id,
            TripStop.estado == "pendiente",
        )
    )
    pending_count = pending_result.scalar() or 0
    if pending_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Hay {pending_count} parada(s) sin confirmar",
        )

    trip.km_llegada = km_llegada
    trip.estado = "completado"
    await db.commit()
    await db.refresh(trip)
    return trip


async def _get_trip_or_404(db: AsyncSession, trip_id: str, company_id: str) -> Trip:
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.company_id == company_id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Viaje no encontrado")
    return trip
