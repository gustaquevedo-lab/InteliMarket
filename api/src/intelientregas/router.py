"""InteliEntregas router — delivery management API"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features import require_feature
from api.src.intelientregas import service
from api.src.intelientregas.schemas import (
    DriverCreate, DriverUpdate, VehicleCreate,
    DeliveryCreate, DeliveryAssign, DeliveryUpdateStatus,
    DeliveryProofCreate, RouteCreate, RouteAddDelivery,
    TrackingEventCreate, ZoneCreate,
    AutoAssignCandidate, AutoAssignResponse,
    DriverResponse, VehicleResponse, DeliveryResponse,
    RouteResponse, TrackingEventResponse, ZoneResponse,
)

router = APIRouter(
    prefix="/api/v1/intelientregas",
    tags=["intelientregas"],
    dependencies=[Depends(require_feature("intelientregas"))],
)


# ============================================================
# DRIVERS
# ============================================================

@router.get("/drivers", response_model=list[DriverResponse])
async def list_drivers(
    status_filter: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_drivers(db, user["company_id"], status_filter)


@router.post("/drivers", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
async def create_driver(
    data: DriverCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_driver(db, user["company_id"], data)


@router.patch("/drivers/{driver_id}", response_model=DriverResponse)
async def update_driver(
    driver_id: str,
    data: DriverUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_driver(db, driver_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Driver no encontrado")
    return result


@router.delete("/drivers/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_driver(
    driver_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_driver(db, driver_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Driver no encontrado")


# ============================================================
# VEHICLES
# ============================================================

@router.get("/vehicles", response_model=list[VehicleResponse])
async def list_vehicles(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_vehicles(db, user["company_id"])


@router.post("/vehicles", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    data: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_vehicle(db, user["company_id"], data)


# ============================================================
# DELIVERIES
# ============================================================

@router.get("/deliveries", response_model=list[DeliveryResponse])
async def list_deliveries(
    estado: str | None = Query(None),
    driver_id: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_deliveries(db, user["company_id"], estado, driver_id, limit, offset)


@router.get("/deliveries/{delivery_id}", response_model=DeliveryResponse)
async def get_delivery(
    delivery_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_delivery(db, delivery_id)
    if not result:
        raise HTTPException(status_code=404, detail="Delivery no encontrado")
    return result


@router.post("/deliveries", response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED)
async def create_delivery(
    data: DeliveryCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_delivery(db, user["company_id"], data)


@router.post("/deliveries/{delivery_id}/assign")
async def assign_delivery(
    delivery_id: str,
    data: DeliveryAssign,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.assign_delivery(db, delivery_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Delivery no encontrado")
    return result


@router.post("/deliveries/auto-assign-batch")
async def auto_assign_batch(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _feature=Depends(require_feature("auto_assignment")),
):
    return await service.auto_assign_batch(db, user["company_id"])


@router.post("/deliveries/{delivery_id}/auto-assign-candidates", response_model=AutoAssignResponse)
async def auto_assign_candidates(
    delivery_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _feature=Depends(require_feature("auto_assignment")),
):
    delivery = await service.get_delivery(db, delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery no encontrado")
    candidates = await service.auto_assign_candidates(db, user["company_id"], delivery_id)
    return AutoAssignResponse(delivery_id=delivery.id, candidates=[AutoAssignCandidate(**c) for c in candidates])


@router.patch("/deliveries/{delivery_id}/status")
async def update_delivery_status(
    delivery_id: str,
    data: DeliveryUpdateStatus,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_delivery_status(db, delivery_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Delivery no encontrado")
    return result


@router.post("/deliveries/{delivery_id}/proofs", status_code=status.HTTP_201_CREATED)
async def add_proof(
    delivery_id: str,
    data: DeliveryProofCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.add_proof(db, delivery_id, data)


@router.get("/deliveries/{delivery_id}/proofs")
async def get_proofs(
    delivery_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_proofs(db, delivery_id)


# ============================================================
# TRACKING
# ============================================================

@router.post("/tracking", response_model=TrackingEventResponse, status_code=status.HTTP_201_CREATED)
async def create_tracking_event(
    data: TrackingEventCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_tracking_event(db, data)


@router.get("/tracking/{delivery_id}")
async def get_tracking_history(
    delivery_id: str,
    limit: int = Query(100, le=1000),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_tracking_history(db, delivery_id, limit)


@router.get("/tracking/driver/{driver_id}/last-position")
async def get_driver_last_position(
    driver_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_driver_last_position(db, driver_id)
    if not result:
        raise HTTPException(status_code=404, detail="No hay posicion del driver")
    return result


# ============================================================
# ROUTES
# ============================================================

@router.get("/routes", response_model=list[RouteResponse])
async def list_routes(
    fecha: str | None = Query(None),
    estado: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from datetime import datetime
    fecha_dt = datetime.fromisoformat(fecha) if fecha else None
    return await service.list_routes(db, user["company_id"], fecha_dt, estado)


@router.post("/routes", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
async def create_route(
    data: RouteCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_route(db, user["company_id"], data)


@router.post("/routes/{route_id}/stops", status_code=status.HTTP_201_CREATED)
async def add_delivery_to_route(
    route_id: str,
    data: RouteAddDelivery,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.add_delivery_to_route(db, route_id, data)


@router.post("/routes/{route_id}/start")
async def start_route(
    route_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.start_route(db, route_id)
    if not result:
        raise HTTPException(status_code=404, detail="Route no encontrada")
    return result


@router.post("/routes/{route_id}/complete")
async def complete_route(
    route_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.complete_route(db, route_id)
    if not result:
        raise HTTPException(status_code=404, detail="Route no encontrada")
    return result


# ============================================================
# ZONES
# ============================================================

@router.get("/zones", response_model=list[ZoneResponse])
async def list_zones(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_zones(db, user["company_id"])


@router.post("/zones", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    data: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_zone(db, user["company_id"], data)


@router.post("/zones/calculate-cost")
async def calculate_delivery_cost(
    latitud: float,
    longitud: float,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.calculate_delivery_cost(db, user["company_id"], latitud, longitud)


# ============================================================
# STATS
# ============================================================

@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_stats(db, user["company_id"])
