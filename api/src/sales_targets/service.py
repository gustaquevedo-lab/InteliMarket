"""Sales targets (metas de venta) — service.

Scoping por rol se aplica aca (no solo en el router): un vendedor solo ve
su propia fila, un supervisor ve su equipo, gerente_comercial/admin ven todo.
"""

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.sales_targets.models import SalesRep, ProductLine, SalesTargetCascadeConfig
from api.src.sales_targets.schemas import SalesRepCreate, SalesRepUpdate, CascadeConfigUpdate


async def get_own_rep(db: AsyncSession, user_id: str) -> SalesRep | None:
    result = await db.execute(select(SalesRep).where(SalesRep.user_id == uuid.UUID(user_id)))
    return result.scalar_one_or_none()


async def list_sales_reps_scoped(db: AsyncSession, company_id: str, user: dict) -> list[SalesRep]:
    """Lista de sales_reps visibles segun el rol del usuario autenticado."""
    rol = user.get("rol")
    if user.get("is_superadmin") or rol in ("admin", "gerente_comercial"):
        result = await db.execute(select(SalesRep).where(SalesRep.company_id == uuid.UUID(company_id)))
        return list(result.scalars().all())

    own = await get_own_rep(db, user.get("sub"))
    if not own:
        return []

    if rol == "supervisor":
        result = await db.execute(
            select(SalesRep).where(
                SalesRep.company_id == uuid.UUID(company_id),
                (SalesRep.supervisor_id == own.id) | (SalesRep.id == own.id),
            )
        )
        return list(result.scalars().all())

    # vendedor: solo su propia fila
    return [own]


async def get_sales_rep(db: AsyncSession, rep_id: str) -> SalesRep | None:
    result = await db.execute(select(SalesRep).where(SalesRep.id == uuid.UUID(rep_id)))
    return result.scalar_one_or_none()


async def create_sales_rep(db: AsyncSession, company_id: str, data: SalesRepCreate) -> SalesRep:
    rep = SalesRep(
        company_id=uuid.UUID(company_id),
        nombre=data.nombre,
        cedula=data.cedula,
        rama=data.rama,
        rol=data.rol,
        supervisor_id=data.supervisor_id,
        activo=True,
    )
    db.add(rep)
    await db.flush()
    await db.refresh(rep)
    return rep


async def update_sales_rep(db: AsyncSession, rep_id: str, data: SalesRepUpdate) -> SalesRep | None:
    rep = await get_sales_rep(db, rep_id)
    if not rep:
        return None
    update_fields = data.model_dump(exclude_unset=True)
    for key, value in update_fields.items():
        setattr(rep, key, value)
    await db.flush()
    await db.refresh(rep)
    return rep


async def list_product_lines(db: AsyncSession, company_id: str) -> list[ProductLine]:
    result = await db.execute(
        select(ProductLine).where(ProductLine.company_id == uuid.UUID(company_id), ProductLine.activo == True)
        .order_by(ProductLine.nombre)
    )
    return list(result.scalars().all())


async def get_cascade_config(db: AsyncSession, company_id: str) -> SalesTargetCascadeConfig:
    result = await db.execute(
        select(SalesTargetCascadeConfig).where(SalesTargetCascadeConfig.company_id == uuid.UUID(company_id))
    )
    config = result.scalar_one_or_none()
    if not config:
        config = SalesTargetCascadeConfig(company_id=uuid.UUID(company_id), umbral_pct=80, activo=True)
        db.add(config)
        await db.flush()
        await db.refresh(config)
    return config


async def update_cascade_config(db: AsyncSession, company_id: str, data: CascadeConfigUpdate) -> SalesTargetCascadeConfig:
    config = await get_cascade_config(db, company_id)
    config.umbral_pct = data.umbral_pct
    if data.activo is not None:
        config.activo = data.activo
    await db.flush()
    await db.refresh(config)
    return config
