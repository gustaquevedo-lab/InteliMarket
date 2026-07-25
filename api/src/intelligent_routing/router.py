from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.intelligent_routing import service
from api.src.intelligent_routing.schemas import (
    TSPOptimizeRequest, VehicleLoadOptimizeRequest, VehicleLoadOptimizeResponse,
    DynamicRerouteRequest, DynamicRerouteResponse,
    EtaPredictRequest, EtaPredictResponse,
)

router = APIRouter(
    prefix="/api/v1/intelligent-routing",
    tags=["intelligent-routing"],
    dependencies=[Depends(require_feature("intelligent_routing")), Depends(require_auth)],
)


# === TSP OPTIMIZATION ===

@router.post("/tsp/optimize")
async def optimize_route(
    data: TSPOptimizeRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.optimize_route(db, user["company_id"], data)


@router.get("/optimizations")
async def list_optimizations(
    driver_id: Optional[str] = Query(None),
    limit: int = Query(20),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_optimizations(db, user["company_id"], driver_id, limit)


# === VEHICLE LOAD ===

@router.post("/load/optimize", response_model=VehicleLoadOptimizeResponse)
async def optimize_load(
    data: VehicleLoadOptimizeRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.optimize_load(db, user["company_id"], data)


@router.get("/load/config/{vehicle_id}")
async def get_vehicle_config(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_or_create_vehicle_config(db, user["company_id"], vehicle_id)


@router.patch("/load/config/{vehicle_id}")
async def update_vehicle_config(
    vehicle_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.update_vehicle_config(db, user["company_id"], vehicle_id, data)


# === DYNAMIC REROUTE ===

@router.post("/reroute", response_model=DynamicRerouteResponse)
async def dynamic_reroute(
    data: DynamicRerouteRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.dynamic_reroute(db, user["company_id"], data)


@router.get("/reroutes")
async def list_reroute_requests(
    limit: int = Query(20),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_reroute_requests(db, user["company_id"], limit)


# === ETA PREDICTION ===

@router.post("/eta/predict", response_model=EtaPredictResponse)
async def predict_eta(
    data: EtaPredictRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.predict_eta(db, user["company_id"], data)


@router.post("/eta/record/{prediction_id}")
async def record_actual_eta(
    prediction_id: str,
    actual_duration_min: float,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.record_actual_eta(db, user["company_id"], prediction_id, actual_duration_min)
    if not result:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return result


# === EFFICIENCY DASHBOARD ===

@router.get("/efficiency")
async def get_efficiency_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_efficiency_dashboard(db, user["company_id"])


@router.post("/efficiency/record")
async def record_efficiency_metric(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.record_efficiency_metric(db, user["company_id"], data)
