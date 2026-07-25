from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.clientes import service
from api.src.clientes.schemas import (
    BehavioralSegmentCreate, BehavioralSegmentUpdate,
    LoyaltyProgramUpdate, LoyaltyTransactionCreate,
    PersonalizedOfferCreate, PersonalizedOfferUpdate,
    CouponCodeGenerate, CouponValidateRequest,
)

router = APIRouter(
    prefix="/api/v1/clientes",
    tags=["clientes"],
    dependencies=[Depends(require_feature("clientes_fidelizacion")), Depends(require_auth)],
)


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])


# --- RFM ---

@router.post("/rfm/evaluate/{customer_id}")
async def evaluate_rfm(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.evaluate_rfm(db, user["company_id"], customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")
    return result


@router.post("/rfm/evaluate-bulk")
async def bulk_evaluate_rfm(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.bulk_evaluate_rfm(db, user["company_id"])


@router.get("/rfm/scores")
async def list_rfm_scores(
    segment: Optional[str] = Query(None),
    rfm_min: Optional[int] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_rfm_scores(db, user["company_id"], segment, rfm_min, limit, offset)


@router.get("/rfm/summary")
async def get_rfm_summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_rfm_summary(db, user["company_id"])


# --- Segments ---

@router.get("/segments")
async def list_segments(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_segments(db, user["company_id"])


@router.post("/segments")
async def create_segment(
    data: BehavioralSegmentCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_segment(db, user["company_id"], data)


@router.put("/segments/{seg_id}")
async def update_segment(
    seg_id: str,
    data: BehavioralSegmentUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_segment(db, user["company_id"], seg_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Segment not found")
    return result


@router.get("/segments/{seg_id}/customers")
async def get_segment_customers(
    seg_id: str,
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_segment_customers(db, user["company_id"], seg_id, limit, offset)


# --- Loyalty ---

@router.get("/loyalty/program")
async def get_loyalty_program(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_or_create_program(db, user["company_id"])


@router.put("/loyalty/program")
async def update_loyalty_program(
    data: LoyaltyProgramUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_program(db, user["company_id"], data)
    if not result:
        raise HTTPException(status_code=404, detail="Program not found")
    return result


@router.get("/loyalty/transactions")
async def list_loyalty_transactions(
    customer_id: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_loyalty_transactions(db, user["company_id"], customer_id, tipo, limit, offset)


@router.post("/loyalty/transactions")
async def create_loyalty_transaction(
    data: LoyaltyTransactionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_loyalty_transaction(db, user["company_id"], data, user.get("id"))


@router.get("/loyalty/summary/{customer_id}")
async def get_loyalty_summary(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_loyalty_summary(db, user["company_id"], customer_id)


# --- Offers ---

@router.get("/offers")
async def list_offers(
    offer_type: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    activo: Optional[bool] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_offers(db, user["company_id"], offer_type, target_type, activo, limit, offset)


@router.post("/offers")
async def create_offer(
    data: PersonalizedOfferCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_offer(db, user["company_id"], data)


@router.put("/offers/{offer_id}")
async def update_offer(
    offer_id: str,
    data: PersonalizedOfferUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_offer(db, user["company_id"], offer_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Offer not found")
    return result


# --- Coupons ---

@router.post("/coupons/generate")
async def generate_coupons(
    data: CouponCodeGenerate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.generate_coupons(db, user["company_id"], data)


@router.get("/coupons")
async def list_coupons(
    is_active: Optional[bool] = Query(None),
    customer_id: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_coupons(db, user["company_id"], is_active, customer_id, limit, offset)


@router.post("/coupons/validate")
async def validate_coupon(
    data: CouponValidateRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.validate_coupon(db, user["company_id"], data)


@router.post("/coupons/{code}/redeem")
async def redeem_coupon(
    code: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.redeem_coupon(db, user["company_id"], code)
    if not result:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return result
