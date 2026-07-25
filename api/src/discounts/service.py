from decimal import Decimal
from datetime import date
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.discounts.models import Discount
from api.src.discounts.schemas import DiscountCreate, DiscountUpdate


async def create_discount(db: AsyncSession, data: DiscountCreate) -> Discount:
    disc = Discount(**data.model_dump())
    db.add(disc)
    await db.flush()
    await db.refresh(disc)
    return disc


async def get_discount(db: AsyncSession, discount_id: str) -> Discount | None:
    result = await db.execute(select(Discount).where(Discount.id == uuid.UUID(discount_id)))
    return result.scalar_one_or_none()


async def list_discounts(db: AsyncSession, company_id: str, activo: bool | None = None) -> list[Discount]:
    query = select(Discount).where(Discount.company_id == company_id)
    if activo is not None:
        query = query.where(Discount.activo == activo)
    query = query.order_by(Discount.nombre)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_discount(db: AsyncSession, discount_id: str, data: DiscountUpdate) -> Discount | None:
    disc = await get_discount(db, discount_id)
    if not disc:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(disc, field, value)
    await db.flush()
    await db.refresh(disc)
    return disc


async def delete_discount(db: AsyncSession, discount_id: str) -> bool:
    disc = await get_discount(db, discount_id)
    if not disc:
        return False
    await db.delete(disc)
    await db.flush()
    return True


async def find_applicable_discounts(
    db: AsyncSession, company_id: str, product_ids: list[str], categoria_ids: list[str],
    total: Decimal, cantidad_items: int,
) -> list[dict]:
    today = date.today()
    result = await db.execute(
        select(Discount).where(
            Discount.company_id == company_id,
            Discount.activo == True,
            Discount.valido_desde <= today,
            Discount.valido_hasta >= today,
        )
    )
    discounts = result.scalars().all()
    applicable = []

    for d in discounts:
        applies = False
        max_reached = d.maximo_aplicaciones is not None and d.aplicaciones_usadas >= d.maximo_aplicaciones
        if max_reached:
            continue

        if d.aplica_a == "producto":
            if d.producto_ids:
                applies = any(str(pid) in [str(x) for x in d.producto_ids] for pid in product_ids)
            elif d.categoria_ids:
                applies = any(str(cid) in [str(x) for x in d.categoria_ids] for cid in categoria_ids)
        elif d.aplica_a == "total":
            applies = True

        if applies and d.monto_minimo and total < d.monto_minimo:
            applies = False
        if applies and d.cantidad_minima and cantidad_items < int(d.cantidad_minima):
            applies = False

        if applies:
            applicable.append({
                "id": str(d.id),
                "nombre": d.nombre,
                "tipo": d.tipo,
                "valor": float(d.valor or 0),
                "aplica_a": d.aplica_a,
            })

    return applicable


async def increment_discount_usage(db: AsyncSession, discount_id: str) -> None:
    disc = await get_discount(db, discount_id)
    if disc:
        disc.aplicaciones_usadas = (disc.aplicaciones_usadas or 0) + 1
        await db.flush()
