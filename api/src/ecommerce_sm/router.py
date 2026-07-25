from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.ecommerce_sm import service
from api.src.ecommerce_sm.schemas import (
    EcommerceProductCreate, EcommerceProductUpdate, EcommerceProductResponse,
    OrderCreate, OrderResponse, OrderStatusUpdate,
    PickupSlotCreate, PickupSlotResponse,
    DeliveryZoneCreate, DeliveryZoneResponse,
    DeliverySlotCreate, DeliverySlotResponse,
    PickingListAssign, PickingScanItem, PickingListResponse,
    PaymentRecord, ShippingCalcInput, DashboardResponse, BulkSlotGenerate,
)

router = APIRouter(
    prefix="/api/v1/ecommerce-sm",
    tags=["ecommerce-sm"],
    dependencies=[Depends(require_feature("ecommerce_sm")), Depends(require_auth)],
)

# ========== CATALOG ==========

@router.get("/catalog", response_model=list[EcommerceProductResponse])
async def list_catalog(
    branch_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_catalog(db, user["company_id"], branch_id, category, search, limit, offset)


@router.post("/catalog", response_model=EcommerceProductResponse)
async def upsert_product(
    data: EcommerceProductCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.upsert_product(db, user["company_id"], data)


@router.put("/catalog/{product_id}", response_model=EcommerceProductResponse)
async def update_product(
    product_id: str,
    data: EcommerceProductUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_product(db, user["company_id"], product_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    return result


# ========== ORDERS ==========

@router.post("/orders", response_model=OrderResponse)
async def create_order(
    data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.create_order(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders", response_model=list[OrderResponse])
async def list_orders(
    status: Optional[str] = Query(None),
    order_type: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_orders(db, user["company_id"], status, order_type, branch_id, limit, offset)


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_order_detail(db, user["company_id"], order_id)
    if not result:
        raise HTTPException(status_code=404, detail="Order not found")
    return result


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    data: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        result = await service.update_order_status(db, user["company_id"], order_id, data.status, data.cancel_reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Order not found")
    return result


# ========== PICKUP SLOTS ==========

@router.get("/pickup-slots", response_model=list[PickupSlotResponse])
async def list_pickup_slots(
    branch_id: Optional[str] = Query(None),
    slot_date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    d = None
    if slot_date:
        from datetime import date as dt_date
        d = dt_date.fromisoformat(slot_date)
    return await service.list_pickup_slots(db, user["company_id"], branch_id, d)


@router.post("/pickup-slots", response_model=PickupSlotResponse)
async def create_pickup_slot(
    data: PickupSlotCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_pickup_slot(db, user["company_id"], data)


# ========== DELIVERY ZONES ==========

@router.get("/delivery-zones", response_model=list[DeliveryZoneResponse])
async def list_delivery_zones(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_delivery_zones(db, user["company_id"])


@router.post("/delivery-zones", response_model=DeliveryZoneResponse)
async def create_delivery_zone(
    data: DeliveryZoneCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_delivery_zone(db, user["company_id"], data)


@router.post("/delivery-zones/calculate-shipping")
async def calculate_shipping(
    data: ShippingCalcInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.calculate_shipping(db, user["company_id"], data.zone_id, data.distance_km, data.order_total)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ========== DELIVERY SLOTS ==========

@router.get("/delivery-slots", response_model=list[DeliverySlotResponse])
async def list_delivery_slots(
    zone_id: Optional[str] = Query(None),
    slot_date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    d = None
    if slot_date:
        from datetime import date as dt_date
        d = dt_date.fromisoformat(slot_date)
    return await service.list_delivery_slots(db, user["company_id"], zone_id, d)


@router.post("/delivery-slots", response_model=DeliverySlotResponse)
async def create_delivery_slot(
    data: DeliverySlotCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_delivery_slot(db, user["company_id"], data)


# ========== BULK SLOTS ==========

@router.post("/slots/bulk-generate")
async def bulk_generate_slots(
    data: BulkSlotGenerate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.bulk_generate_slots(db, user["company_id"], data)


# ========== PICKING ==========

@router.post("/picking/generate/{order_id}", response_model=PickingListResponse)
async def generate_picking_list(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.generate_picking_list(db, user["company_id"], order_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/picking", response_model=list[PickingListResponse])
async def list_picking_lists(
    status: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_picking_lists(db, user["company_id"], status, branch_id, limit, offset)


@router.get("/picking/{picking_list_id}", response_model=PickingListResponse)
async def get_picking_list(
    picking_list_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.get_picking_list(db, user["company_id"], picking_list_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/picking/{picking_list_id}/assign", response_model=PickingListResponse)
async def assign_picking_list(
    picking_list_id: str,
    data: PickingListAssign,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.assign_picking_list(db, user["company_id"], picking_list_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/picking/scan", response_model=PickingListResponse)
async def scan_picking_item(
    data: PickingScanItem,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.scan_picking_item(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== PAYMENTS ==========

@router.post("/payments")
async def record_payment(
    data: PaymentRecord,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.record_payment(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== DASHBOARD ==========

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])
