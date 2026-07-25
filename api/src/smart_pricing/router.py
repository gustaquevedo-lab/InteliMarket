from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.smart_pricing import service
from api.src.smart_pricing.schemas import (
    PriceListAssignmentCreate, PriceListAssignmentResponse,
    TieredPriceCreate, TieredPriceUpdate, TieredPriceResponse,
    PromotionCreate, PromotionUpdate, PromotionResponse,
    PriceSuggestionCreate, PriceSuggestionUpdate, PriceSuggestionResponse,
    DynamicPriceRequest, DynamicPriceResponse,
    PriceChangeRequestCreate, PriceChangeRequestReview, PriceChangeRequestResponse,
    PriceChangeHistoryResponse, PriceManagementDashboard,
)

router = APIRouter(
    prefix="/api/v1/smart-pricing",
    tags=["smart-pricing"],
    dependencies=[Depends(require_feature("smart_pricing")), Depends(require_auth)],
)


# === PRICE LIST ASSIGNMENTS ===

@router.post("/assignments", response_model=PriceListAssignmentResponse)
async def create_assignment(
    data: PriceListAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_assignment(db, user["company_id"], data)


@router.get("/assignments", response_model=list[PriceListAssignmentResponse])
async def list_assignments(
    price_list_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_assignments(db, user["company_id"], price_list_id)


@router.delete("/assignments/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_assignment(db, assignment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"message": "Deleted"}


# === TIERED PRICING ===

@router.post("/tiered-prices", response_model=TieredPriceResponse)
async def create_tiered_price(
    data: TieredPriceCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_tiered_price(db, user["company_id"], data)


@router.get("/tiered-prices", response_model=list[TieredPriceResponse])
async def list_tiered_prices(
    product_id: Optional[str] = Query(None),
    price_list_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_tiered_prices(db, user["company_id"], product_id, price_list_id)


@router.get("/tiered-prices/calculate")
async def calculate_tiered_price(
    product_id: str = Query(...),
    quantity: int = Query(...),
    price_list_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_applicable_tier_price(
        db, user["company_id"], product_id, quantity, price_list_id
    )
    if not result:
        raise HTTPException(status_code=404, detail="No tiered price found for this quantity")
    return result


@router.patch("/tiered-prices/{tier_id}", response_model=TieredPriceResponse)
async def update_tiered_price(
    tier_id: str,
    data: TieredPriceUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_tiered_price(db, tier_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Tiered price not found")
    return result


@router.delete("/tiered-prices/{tier_id}")
async def delete_tiered_price(
    tier_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_tiered_price(db, tier_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Tiered price not found")
    return {"message": "Deleted"}


# === PROMOTIONS ===

@router.post("/promotions", response_model=PromotionResponse)
async def create_promotion(
    data: PromotionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_promotion(db, user["company_id"], data)


@router.get("/promotions", response_model=list[PromotionResponse])
async def list_promotions(
    activo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_promotions(db, user["company_id"], activo)


@router.get("/promotions/active")
async def get_active_promotions(
    customer_id: Optional[str] = Query(None),
    customer_group: Optional[str] = Query(None),
    canal: Optional[str] = Query(None),
    zona: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_active_promotions_for_customer(
        db, user["company_id"], customer_id, customer_group, canal, zona
    )


@router.get("/promotions/{promotion_id}", response_model=PromotionResponse)
async def get_promotion(
    promotion_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_promotion(db, promotion_id)
    if not result:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return result


@router.patch("/promotions/{promotion_id}", response_model=PromotionResponse)
async def update_promotion(
    promotion_id: str,
    data: PromotionUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_promotion(db, promotion_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return result


@router.delete("/promotions/{promotion_id}")
async def delete_promotion(
    promotion_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_promotion(db, promotion_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return {"message": "Deleted"}


# === PRICE SUGGESTIONS (IA) ===

@router.post("/suggestions", response_model=PriceSuggestionResponse)
async def create_suggestion(
    data: PriceSuggestionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_suggestion(db, user["company_id"], data)


@router.get("/suggestions", response_model=list[PriceSuggestionResponse])
async def list_suggestions(
    estado: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_suggestions(db, user["company_id"], estado, source)


@router.post("/suggestions/dynamic-price", response_model=DynamicPriceResponse)
async def dynamic_price(
    data: DynamicPriceRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.generate_dynamic_price(db, user["company_id"], data)


@router.patch("/suggestions/{suggestion_id}", response_model=PriceSuggestionResponse)
async def review_suggestion(
    suggestion_id: str,
    data: PriceSuggestionUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        result = await service.review_suggestion(db, suggestion_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return result


# === PRICE CHANGE REQUESTS (Approval Workflow) ===

@router.post("/change-requests", response_model=PriceChangeRequestResponse)
async def create_change_request(
    data: PriceChangeRequestCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_change_request(db, user["company_id"], data, user["user_id"])


@router.get("/change-requests", response_model=list[PriceChangeRequestResponse])
async def list_change_requests(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_change_requests(db, user["company_id"], status)


@router.post("/change-requests/{request_id}/review", response_model=PriceChangeRequestResponse)
async def review_change_request(
    request_id: str,
    data: PriceChangeRequestReview,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        result = await service.review_change_request(db, request_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Request not found")
    return result


@router.post("/change-requests/{request_id}/approve-level2", response_model=PriceChangeRequestResponse)
async def approve_level_2(
    request_id: str,
    data: PriceChangeRequestReview,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        result = await service.approve_level_2(db, request_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Request not found")
    return result


# === PRICE CHANGE HISTORY ===

@router.get("/history", response_model=list[PriceChangeHistoryResponse])
async def list_price_history(
    product_id: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_price_history(db, user["company_id"], product_id, limit)


# === DASHBOARD ===

@router.get("/dashboard", response_model=PriceManagementDashboard)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])
