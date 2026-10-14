from datetime import datetime, timedelta
import uuid

from sqlalchemy import select, func as sa_func, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.loyalty.models import LoyaltyConfig, LoyaltyPoints, LoyaltyReward
from api.src.loyalty.schemas import LoyaltyConfigCreate, LoyaltyConfigUpdate, PointsCreate, LoyaltyRewardCreate, LoyaltyRewardUpdate


async def get_or_create_config(db: AsyncSession, company_id: str) -> LoyaltyConfig:
    result = await db.execute(
        select(LoyaltyConfig).where(LoyaltyConfig.company_id == uuid.UUID(company_id))
    )
    config = result.scalar_one_or_none()
    if not config:
        config = LoyaltyConfig(company_id=uuid.UUID(company_id))
        db.add(config)
        await db.flush()
        await db.refresh(config)
    return config


async def update_config(db: AsyncSession, company_id: str, data: LoyaltyConfigUpdate) -> LoyaltyConfig | None:
    config = await get_or_create_config(db, company_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    await db.flush()
    await db.refresh(config)
    return config


async def earn_points(db: AsyncSession, data: PointsCreate, config: LoyaltyConfig | None = None) -> LoyaltyPoints:
    if not config:
        config = await get_or_create_config(db, str(data.company_id))
    vence_en = None
    if config.vencimiento_dias > 0:
        vence_en = datetime.utcnow() + timedelta(days=config.vencimiento_dias)
    pts = LoyaltyPoints(
        company_id=data.company_id,
        customer_id=data.customer_id,
        tipo=data.tipo,
        puntos=data.puntos,
        referencia_tipo=data.referencia_tipo,
        referencia_id=data.referencia_id,
        descripcion=data.descripcion,
        vence_en=vence_en,
    )
    db.add(pts)
    await db.flush()
    await db.refresh(pts)
    return pts


async def get_balance(db: AsyncSession, customer_id: str, company_id: str) -> dict:
    now = datetime.utcnow()
    total = await db.execute(
        select(sa_func.coalesce(sa_func.sum(LoyaltyPoints.puntos), 0)).where(
            LoyaltyPoints.customer_id == uuid.UUID(customer_id),
            LoyaltyPoints.company_id == uuid.UUID(company_id),
        )
    )
    puntos_por_vencer = await db.execute(
        select(sa_func.coalesce(sa_func.sum(LoyaltyPoints.puntos), 0)).where(
            LoyaltyPoints.customer_id == uuid.UUID(customer_id),
            LoyaltyPoints.company_id == uuid.UUID(company_id),
            LoyaltyPoints.vence_en.isnot(None),
            LoyaltyPoints.vence_en <= now,
        )
    )
    return {
        "customer_id": uuid.UUID(customer_id),
        "total_puntos": int(total.scalar() or 0),
        "puntos_por_vencer": int(puntos_por_vencer.scalar() or 0),
    }


async def get_history(db: AsyncSession, customer_id: str, company_id: str, limit: int = 50) -> list[LoyaltyPoints]:
    result = await db.execute(
        select(LoyaltyPoints).where(
            LoyaltyPoints.customer_id == uuid.UUID(customer_id),
            LoyaltyPoints.company_id == uuid.UUID(company_id),
        ).order_by(LoyaltyPoints.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


async def create_reward(db: AsyncSession, data: LoyaltyRewardCreate) -> LoyaltyReward:
    reward = LoyaltyReward(**data.model_dump())
    db.add(reward)
    await db.flush()
    await db.refresh(reward)
    return reward


async def get_reward(db: AsyncSession, reward_id: str) -> LoyaltyReward | None:
    result = await db.execute(select(LoyaltyReward).where(LoyaltyReward.id == uuid.UUID(reward_id)))
    return result.scalar_one_or_none()


async def list_rewards(db: AsyncSession, company_id: str, activo: bool | None = None) -> list[LoyaltyReward]:
    query = select(LoyaltyReward).where(LoyaltyReward.company_id == uuid.UUID(company_id))
    if activo is not None:
        query = query.where(LoyaltyReward.activo == activo)
    query = query.order_by(LoyaltyReward.puntos_requeridos)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_reward(db: AsyncSession, reward_id: str, data: LoyaltyRewardUpdate) -> LoyaltyReward | None:
    reward = await get_reward(db, reward_id)
    if not reward:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(reward, field, value)
    await db.flush()
    await db.refresh(reward)
    return reward


async def delete_reward(db: AsyncSession, reward_id: str) -> bool:
    reward = await get_reward(db, reward_id)
    if not reward:
        return False
    await db.delete(reward)
    await db.flush()
    return True
