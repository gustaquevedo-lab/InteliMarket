"""Price list service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from api.src.price_lists.models import PriceList, PriceListItem
from api.src.price_lists.schemas import PriceListCreate, PriceListUpdate, PriceListItemCreate, PriceListItemUpdate


async def create_price_list(db: AsyncSession, data: PriceListCreate) -> PriceList:
    pl = PriceList(**data.model_dump())
    db.add(pl)
    await db.commit()
    await db.refresh(pl)
    return pl


async def list_price_lists(db: AsyncSession, company_id: str) -> list[PriceList]:
    query = select(PriceList).where(PriceList.company_id == company_id).order_by(PriceList.nombre)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_price_list(db: AsyncSession, pl_id: str) -> PriceList | None:
    result = await db.execute(select(PriceList).where(PriceList.id == uuid.UUID(pl_id)))
    return result.scalar_one_or_none()


async def update_price_list(db: AsyncSession, pl_id: str, data: PriceListUpdate) -> PriceList | None:
    pl = await get_price_list(db, pl_id)
    if not pl:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(pl, k, v)
    await db.commit()
    await db.refresh(pl)
    return pl


async def delete_price_list(db: AsyncSession, pl_id: str) -> bool:
    pl = await get_price_list(db, pl_id)
    if not pl:
        return False
    items = await db.execute(select(PriceListItem).where(PriceListItem.price_list_id == pl.id))
    for item in items.scalars().all():
        await db.delete(item)
    await db.delete(pl)
    await db.commit()
    return True


async def add_item(db: AsyncSession, data: PriceListItemCreate) -> PriceListItem:
    item = PriceListItem(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def list_items(db: AsyncSession, pl_id: str) -> list[PriceListItem]:
    query = select(PriceListItem).where(PriceListItem.price_list_id == uuid.UUID(pl_id), PriceListItem.activo == True)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_item(db: AsyncSession, item_id: str, data: PriceListItemUpdate) -> PriceListItem | None:
    result = await db.execute(select(PriceListItem).where(PriceListItem.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return item


async def delete_item(db: AsyncSession, item_id: str) -> bool:
    result = await db.execute(select(PriceListItem).where(PriceListItem.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        return False
    await db.delete(item)
    await db.commit()
    return True


async def get_price_for_customer(db: AsyncSession, company_id: str, customer_id: str, product_id: str, variant_id: Optional[str] = None) -> Optional[float]:
    # Check customer-specific price list first
    pl_result = await db.execute(
        select(PriceList).where(
            PriceList.company_id == company_id,
            PriceList.activo == True,
            PriceList.tipo == "cliente",
            PriceList.customer_id == uuid.UUID(customer_id),
        )
    )
    pl = pl_result.scalar_one_or_none()
    
    if pl:
        item_query = select(PriceListItem).where(
            PriceListItem.price_list_id == pl.id,
            PriceListItem.product_id == uuid.UUID(product_id),
            PriceListItem.activo == True,
        )
        if variant_id:
            item_query = item_query.where(PriceListItem.variant_id == uuid.UUID(variant_id))
        item_result = await db.execute(item_query)
        item = item_result.scalar_one_or_none()
        if item:
            return float(item.precio)
    
    return None
