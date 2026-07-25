"""Logistics router"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.logistics import service
from api.src.logistics.schemas import (
    DeliveryCreate,
    DeliveryUpdate,
    DeliveryResponse,
    RouteCreate,
    RouteResponse,
    RouteStopCreate,
    RouteStopResponse,
)

router = APIRouter(prefix="/api/v1/logistics", tags=["logistics"])


@router.post("/deliveries", response_model=DeliveryResponse)
async def create_delivery(
    data: DeliveryCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    data.company_id = user["company_id"]
    return await service.create_delivery(db, data)


@router.get("/deliveries", response_model=list[DeliveryResponse])
async def list_deliveries(
    estado: Optional[str] = None,
    driver_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_deliveries(db, user["company_id"], estado=estado, driver_name=driver_name)


@router.get("/deliveries/{delivery_id}", response_model=DeliveryResponse)
async def get_delivery(
    delivery_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    delivery = await service.get_delivery(db, delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return delivery


@router.patch("/deliveries/{delivery_id}", response_model=DeliveryResponse)
async def update_delivery(
    delivery_id: str,
    data: DeliveryUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    delivery = await service.update_delivery(db, delivery_id, data)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return delivery


@router.post("/routes", response_model=RouteResponse)
async def create_route(
    data: RouteCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    data.company_id = user["company_id"]
    return await service.create_route(db, data)


@router.get("/routes", response_model=list[RouteResponse])
async def list_routes(
    estado: Optional[str] = None,
    fecha: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_routes(db, user["company_id"], estado=estado, fecha=fecha)


@router.get("/routes/{route_id}", response_model=RouteResponse)
async def get_route(
    route_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    route = await service.get_route(db, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.patch("/routes/{route_id}/status")
async def update_route_status(
    route_id: str,
    estado: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    route = await service.update_route_status(db, route_id, estado)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return {"message": "Route status updated", "estado": estado}


@router.post("/routes/stops", response_model=RouteStopResponse)
async def add_route_stop(
    data: RouteStopCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.add_route_stop(db, data)


@router.get("/routes/{route_id}/stops", response_model=list[RouteStopResponse])
async def get_route_stops(
    route_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_route_stops(db, route_id)


@router.patch("/routes/stops/{stop_id}/status")
async def update_stop_status(
    stop_id: str,
    estado: str,
    observaciones: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    stop = await service.update_stop_status(db, stop_id, estado, observaciones=observaciones)
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
    return stop
