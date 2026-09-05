"""Price list router"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.price_lists import service
from api.src.price_lists.schemas import (
    PriceListCreate, PriceListUpdate, PriceListResponse,
    PriceListItemCreate, PriceListItemUpdate, PriceListItemResponse,
)

router = APIRouter(prefix="/api/v1/price-lists", tags=["price-lists"])


@router.get("/tiers-summary")
async def tiers_summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_tiers_summary(db, user["company_id"])


@router.get("/products-with-tiers")
async def products_with_tiers(
    search: str | None = Query(None),
    min_qty: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_products_with_tiers(db, user["company_id"], search, min_qty, limit, offset)


@router.get("/lookup")
async def lookup_price(
    customer_id: str, product_id: str, quantity: int = 1,
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.resolve_customer_price(db, user["company_id"], customer_id, product_id, quantity)


@router.post("", response_model=PriceListResponse)
async def create_pl(data: PriceListCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data.company_id = user["company_id"]
    return await service.create_price_list(db, data)


@router.get("", response_model=list[PriceListResponse])
async def list_pls(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_price_lists(db, user["company_id"])


@router.get("/{pl_id}", response_model=PriceListResponse)
async def get_pl(pl_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    pl = await service.get_price_list(db, pl_id)
    if not pl:
        raise HTTPException(status_code=404)
    return pl


@router.patch("/{pl_id}", response_model=PriceListResponse)
async def update_pl(pl_id: str, data: PriceListUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    pl = await service.update_price_list(db, pl_id, data)
    if not pl:
        raise HTTPException(status_code=404)
    return pl


@router.delete("/{pl_id}")
async def delete_pl(pl_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    ok = await service.delete_price_list(db, pl_id)
    if not ok:
        raise HTTPException(status_code=404)
    return {"message": "Deleted"}


@router.post("/{pl_id}/items", response_model=PriceListItemResponse)
async def add_item(pl_id: str, data: PriceListItemCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data.price_list_id = pl_id
    return await service.add_item(db, data)


@router.get("/{pl_id}/items", response_model=list[PriceListItemResponse])
async def list_items(pl_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_items(db, pl_id)


@router.patch("/items/{item_id}", response_model=PriceListItemResponse)
async def update_item(item_id: str, data: PriceListItemUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    item = await service.update_item(db, item_id, data)
    if not item:
        raise HTTPException(status_code=404)
    return item


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    ok = await service.delete_item(db, item_id)
    if not ok:
        raise HTTPException(status_code=404)
    return {"message": "Deleted"}
