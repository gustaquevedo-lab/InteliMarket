from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.auth.middleware import require_auth
from api.src.db import get_db
from api.src.viajes import service
from api.src.viajes.schemas import (
    KmLlegadaInput,
    KmSalidaInput,
    PendingOrderForDispatch,
    StopConfirmInput,
    TripCreate,
    TripResponse,
    TripStopResponse,
    TripStopsUpdate,
    TripVehicleCreate,
    TripVehicleResponse,
)

router = APIRouter(prefix="/viajes", tags=["viajes"])


@router.get("/vehicles", response_model=List[TripVehicleResponse])
async def list_vehicles(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_vehicles(db, company_id)


@router.post("/vehicles", response_model=TripVehicleResponse, status_code=201)
async def create_vehicle(
    body: TripVehicleCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.create_vehicle(db, body)


@router.get("/pending-orders", response_model=List[PendingOrderForDispatch])
async def list_pending_orders(
    company_id: str,
    fecha: date,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_pending_orders(db, company_id, fecha)


@router.get("/mi-viaje-hoy", response_model=Optional[TripResponse])
async def get_mi_viaje_hoy(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    today = date.today()
    return await service.get_mi_viaje_hoy(db, company_id, current_user["sub"], today)


@router.get("/", response_model=List[TripResponse])
async def list_trips(
    company_id: str,
    fecha: date,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_trips(db, company_id, fecha)


@router.post("/", response_model=TripResponse, status_code=201)
async def create_trip(
    body: TripCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.create_trip(db, body)


@router.patch("/{trip_id}/stops", response_model=TripResponse)
async def update_trip_stops(
    trip_id: str,
    body: TripStopsUpdate,
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.update_trip_stops(db, trip_id, body.stops, company_id)


@router.post("/{trip_id}/confirm", response_model=TripResponse)
async def confirm_trip(
    trip_id: str,
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.confirm_trip(db, trip_id, company_id)


@router.post("/{trip_id}/salida", response_model=TripResponse)
async def register_salida(
    trip_id: str,
    body: KmSalidaInput,
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.register_salida(db, trip_id, body.km_salida, company_id)


@router.post("/{trip_id}/stops/{stop_id}/confirm", response_model=TripStopResponse)
async def confirm_stop(
    trip_id: str,
    stop_id: str,
    body: StopConfirmInput,
    company_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    return await service.confirm_stop(db, stop_id, body, company_id, current_user["sub"])


@router.post("/{trip_id}/llegada", response_model=TripResponse)
async def register_llegada(
    trip_id: str,
    body: KmLlegadaInput,
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.register_llegada(db, trip_id, body.km_llegada, company_id)
