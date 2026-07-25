from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.demand_forecast import service
from api.src.demand_forecast.schemas import (
    ForecastConfigCreate, ForecastConfigUpdate, ForecastConfigResponse,
    ForecastGenerateRequest, ForecastPredictionResponse,
    ForecastOverrideCreate, ForecastOverrideResponse,
    AnomalyDetectionResponse, AnomalyReviewRequest,
    PurchaseSuggestionResponse, PurchaseSuggestionUpdate,
    ForecastAccuracyResponse, ForecastDashboard,
)

router = APIRouter(
    prefix="/api/v1/demand-forecast",
    tags=["demand-forecast"],
    dependencies=[Depends(require_feature("demand_forecast")), Depends(require_auth)],
)


# === CONFIG ===

@router.get("/config", response_model=ForecastConfigResponse)
async def get_config(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_or_create_config(db, user["company_id"])


@router.patch("/config/{config_id}", response_model=ForecastConfigResponse)
async def update_config(
    config_id: str,
    data: ForecastConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_config(db, user["company_id"], config_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Config not found")
    return result


# === FORECAST ===

@router.post("/generate")
async def generate_forecast(
    data: ForecastGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.generate_forecast(db, user["company_id"], data)


@router.get("/predictions", response_model=list[ForecastPredictionResponse])
async def list_predictions(
    product_id: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    zone: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_predictions(
        db, user["company_id"], product_id, customer_id, zone, from_date, to_date, limit
    )


@router.get("/predictions/summary")
async def predictions_summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_predictions_summary(db, user["company_id"])


# === OVERRIDES ===

@router.post("/overrides", response_model=ForecastOverrideResponse)
async def create_override(
    data: ForecastOverrideCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_override(db, user["company_id"], data, user["user_id"])


@router.get("/overrides", response_model=list[ForecastOverrideResponse])
async def list_overrides(
    product_id: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_overrides(db, user["company_id"], product_id, limit)


# === ANOMALIES ===

@router.post("/anomalies/detect")
async def detect_anomalies(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.detect_anomalies(db, user["company_id"])


@router.get("/anomalies", response_model=list[AnomalyDetectionResponse])
async def list_anomalies(
    severity: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    reviewed: Optional[bool] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_anomalies(db, user["company_id"], severity, tipo, reviewed, limit)


@router.patch("/anomalies/{anomaly_id}", response_model=AnomalyDetectionResponse)
async def review_anomaly(
    anomaly_id: str,
    data: AnomalyReviewRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.review_anomaly(db, anomaly_id, data, user["user_id"])
    if not result:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return result


# === PURCHASE SUGGESTIONS ===

@router.post("/purchase-suggestions/generate")
async def generate_purchase_suggestions(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.generate_purchase_suggestions(db, user["company_id"])


@router.get("/purchase-suggestions", response_model=list[PurchaseSuggestionResponse])
async def list_purchase_suggestions(
    status: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_purchase_suggestions(db, user["company_id"], status, limit)


@router.patch("/purchase-suggestions/{suggestion_id}", response_model=PurchaseSuggestionResponse)
async def update_purchase_suggestion(
    suggestion_id: str,
    data: PurchaseSuggestionUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_purchase_suggestion(db, suggestion_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return result


# === ACCURACY ===

@router.post("/accuracy/record")
async def record_accuracy(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.record_accuracy(db, user["company_id"])


@router.get("/accuracy/summary")
async def get_accuracy_summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_accuracy_summary(db, user["company_id"])


# === DASHBOARD ===

@router.get("/dashboard", response_model=ForecastDashboard)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])
