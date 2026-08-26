"""Price list service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from api.src.price_lists.models import PriceList, PriceListItem
from api.src.price_lists.schemas import PriceListCreate, PriceListUpdate, PriceListItemCreate, PriceListItemUpdate
from api.src.smart_pricing.models import PriceListAssignment
from api.src.smart_pricing.service import get_applicable_tier_price
from api.src.customers.models import Customer


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


async def resolve_customer_price(
    db: AsyncSession, company_id: str, customer_id: str, product_id: str, quantity: int = 1,
) -> Optional[dict]:
    """Precio real a cobrarle a un cliente por un producto, respetando (en orden):
    1) la lista de precios asignada al cliente via PriceListAssignment (tipo=cliente),
    2) si no hay asignacion, el campo legacy Customer.price_list_id (el que ya usa
       el portal de autoservicio client_app, para no romper ese camino);
    con esa lista resuelta (si la hay), prueba en orden: escalon por cantidad scoped a
    esa lista, escalon global, precio plano de la lista. Devuelve None si nada aplica
    -- el caller debe usar el precio de catalogo (comportamiento actual sin cambios)."""
    price_list_id = None

    assignment_result = await db.execute(
        select(PriceListAssignment).where(
            PriceListAssignment.company_id == uuid.UUID(company_id),
            PriceListAssignment.tipo == "cliente",
            PriceListAssignment.ref_id == str(customer_id),
        )
    )
    assignment = assignment_result.scalars().first()
    if assignment:
        price_list_id = str(assignment.price_list_id)
    else:
        customer_result = await db.execute(select(Customer).where(Customer.id == uuid.UUID(customer_id)))
        customer = customer_result.scalar_one_or_none()
        if customer and customer.price_list_id:
            price_list_id = str(customer.price_list_id)

    if price_list_id:
        tier = await get_applicable_tier_price(db, company_id, product_id, quantity, price_list_id)
        if tier:
            return {"precio": tier["precio_unitario"], "price_list_id": price_list_id, "source": "tier_lista"}

    global_tier = await get_applicable_tier_price(db, company_id, product_id, quantity, None)
    if global_tier:
        return {"precio": global_tier["precio_unitario"], "price_list_id": price_list_id, "source": "tier_global"}

    if price_list_id:
        item_result = await db.execute(
            select(PriceListItem).where(
                PriceListItem.price_list_id == uuid.UUID(price_list_id),
                PriceListItem.product_id == uuid.UUID(product_id),
                PriceListItem.activo == True,
            )
        )
        item = item_result.scalar_one_or_none()
        if item:
            return {"precio": float(item.precio), "price_list_id": price_list_id, "source": "lista_plana"}

    return None
