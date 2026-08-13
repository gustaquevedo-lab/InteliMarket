import uuid
from decimal import Decimal

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.purchase_bonuses.models import PurchaseBonusScale
from api.src.purchase_bonuses.schemas import BonusScaleCreate, BonusScaleUpdate


async def create_scale(db: AsyncSession, company_id: str, data: BonusScaleCreate) -> PurchaseBonusScale:
    scale = PurchaseBonusScale(company_id=company_id, **data.model_dump())
    db.add(scale)
    await db.commit()
    await db.refresh(scale)
    return scale


async def list_scales(
    db: AsyncSession, company_id: str, supplier_id: str | None = None,
    product_id: str | None = None, activo: bool | None = None,
) -> list[PurchaseBonusScale]:
    q = select(PurchaseBonusScale).where(PurchaseBonusScale.company_id == company_id)
    if supplier_id:
        q = q.where(PurchaseBonusScale.supplier_id == supplier_id)
    if product_id:
        q = q.where(PurchaseBonusScale.product_id == product_id)
    if activo is not None:
        q = q.where(PurchaseBonusScale.activo == activo)
    q = q.order_by(PurchaseBonusScale.cantidad_minima)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_scale(db: AsyncSession, scale_id: str) -> PurchaseBonusScale | None:
    result = await db.execute(select(PurchaseBonusScale).where(PurchaseBonusScale.id == uuid.UUID(scale_id)))
    return result.scalar_one_or_none()


async def update_scale(db: AsyncSession, scale: PurchaseBonusScale, data: BonusScaleUpdate) -> PurchaseBonusScale:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(scale, field, value)
    await db.commit()
    await db.refresh(scale)
    return scale


async def delete_scale(db: AsyncSession, scale_id: str) -> None:
    await db.execute(delete(PurchaseBonusScale).where(PurchaseBonusScale.id == uuid.UUID(scale_id)))
    await db.commit()


async def suggest_bonus(
    db: AsyncSession, company_id: str, supplier_id: str, product_id: str, cantidad: Decimal,
) -> tuple[uuid.UUID | None, Decimal]:
    """La escala aplicable es la de mayor cantidad_minima que la cantidad
    comprada alcance a cubrir (ej. si hay escalas en 50 y 100 unidades y se
    compran 120, aplica la de 100, no la de 50)."""
    result = await db.execute(
        select(PurchaseBonusScale)
        .where(
            PurchaseBonusScale.company_id == company_id,
            PurchaseBonusScale.supplier_id == supplier_id,
            PurchaseBonusScale.product_id == product_id,
            PurchaseBonusScale.activo.is_(True),
            PurchaseBonusScale.cantidad_minima <= cantidad,
        )
        .order_by(PurchaseBonusScale.cantidad_minima.desc())
        .limit(1)
    )
    scale = result.scalar_one_or_none()
    if not scale:
        return None, Decimal("0")
    return scale.id, scale.cantidad_bonificada
