"""Fase 2 — Supplier Returns & Backhaul service"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import SupplierReturn, SupplierReturnItem, ReturnAuthorization, BackhaulSchedule



# ---------------------------------------------------------------------------
# RETURNS
# ---------------------------------------------------------------------------

async def list_returns(company_id: UUID, db: AsyncSession, estado: Optional[str] = None, proveedor_id: Optional[UUID] = None):
    q = select(SupplierReturn).where(SupplierReturn.company_id == company_id)
    if estado:
        q = q.where(SupplierReturn.estado == estado)
    if proveedor_id:
        q = q.where(SupplierReturn.proveedor_id == proveedor_id)
    q = q.order_by(SupplierReturn.fecha_creacion.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def get_return(return_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(SupplierReturn)
        .options(selectinload(SupplierReturn.items))
        .where(SupplierReturn.id == return_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Supplier return not found")
    return r


async def create_return(company_id: UUID, data, db: AsyncSession):
    r = SupplierReturn(company_id=company_id, **data.model_dump(exclude={"items"}, exclude_none=True))
    db.add(r)
    await db.flush()
    for item_data in data.items or []:
        item = SupplierReturnItem(return_id=r.id, **item_data.model_dump(exclude_none=True))
        item.valor_total = None
        if item.valor_unitario and item.cantidad:
            item.valor_total = item.valor_unitario * item.cantidad
        db.add(item)
    await db.commit()
    await db.refresh(r)
    return await get_return(r.id, db)


async def update_return(return_id: UUID, data, db: AsyncSession):
    r = await get_return(return_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    await db.commit()
    await db.refresh(r)
    return r


async def authorize_return(return_id: UUID, user_id: UUID, db: AsyncSession):
    r = await get_return(return_id, db)
    r.estado = "autorizado"
    r.autorizado_por = user_id
    r.autorizado_at = datetime.utcnow()
    await db.commit()
    await db.refresh(r)
    return r


async def complete_return(return_id: UUID, user_id: UUID, db: AsyncSession):
    r = await get_return(return_id, db)
    r.estado = "completado"
    r.completado_por = user_id
    r.completado_at = datetime.utcnow()
    # Calculate total
    total = sum(item.valor_total or 0 for item in r.items)
    r.valor_total_estimado = total
    r.total_items = len(r.items)
    await db.commit()
    await db.refresh(r)
    return r


# ---------------------------------------------------------------------------
# RETURN ITEMS
# ---------------------------------------------------------------------------

async def create_return_item(return_id: UUID, data, db: AsyncSession):
    item = SupplierReturnItem(return_id=return_id, **data.model_dump(exclude_none=True))
    if item.valor_unitario and item.cantidad:
        item.valor_total = item.valor_unitario * item.cantidad
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# AUTHORIZATIONS
# ---------------------------------------------------------------------------

async def list_return_authorizations(return_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(ReturnAuthorization)
        .where(ReturnAuthorization.return_id == return_id)
        .order_by(ReturnAuthorization.fecha_autorizacion.desc())
    )
    return result.scalars().all()


async def create_return_authorization(return_id: UUID, data, db: AsyncSession):
    auth = ReturnAuthorization(return_id=return_id, **data.model_dump(exclude_none=True))
    db.add(auth)
    await db.commit()
    await db.refresh(auth)
    return auth


# ---------------------------------------------------------------------------
# BACKHAUL
# ---------------------------------------------------------------------------

async def list_backhauls(company_id: UUID, db: AsyncSession, estado: Optional[str] = None):
    q = select(BackhaulSchedule).where(BackhaulSchedule.company_id == company_id)
    if estado:
        q = q.where(BackhaulSchedule.estado == estado)
    q = q.order_by(BackhaulSchedule.fecha_programada)
    result = await db.execute(q)
    return result.scalars().all()


async def get_backhaul(backhaul_id: UUID, db: AsyncSession):
    result = await db.execute(select(BackhaulSchedule).where(BackhaulSchedule.id == backhaul_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(404, "Backhaul schedule not found")
    return b


async def create_backhaul(company_id: UUID, data, db: AsyncSession):
    b = BackhaulSchedule(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b


async def update_backhaul(backhaul_id: UUID, data, db: AsyncSession):
    b = await get_backhaul(backhaul_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(b, k, v)
    await db.commit()
    await db.refresh(b)
    return b


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_returns_dashboard(company_id: UUID, db: AsyncSession):
    pendientes = (await db.execute(
        select(func.count()).select_from(SupplierReturn).where(
            SupplierReturn.company_id == company_id,
            SupplierReturn.estado == "pendiente",
        )
    )).scalar()

    activos = (await db.execute(
        select(func.count()).select_from(SupplierReturn).where(
            SupplierReturn.company_id == company_id,
            SupplierReturn.estado.in_(["autorizado", "en_proceso"]),
        )
    )).scalar()

    completados_mes = (await db.execute(
        select(func.count()).select_from(SupplierReturn).where(
            SupplierReturn.company_id == company_id,
            SupplierReturn.estado == "completado",
            func.extract("month", SupplierReturn.completado_at) == func.extract("month", func.now()),
        )
    )).scalar()

    backhaul_programados = (await db.execute(
        select(func.count()).select_from(BackhaulSchedule).where(
            BackhaulSchedule.company_id == company_id,
            BackhaulSchedule.estado == "pendiente",
        )
    )).scalar()

    backhaul_pendientes = (await db.execute(
        select(func.count()).select_from(BackhaulSchedule).where(
            BackhaulSchedule.company_id == company_id,
            BackhaulSchedule.estado == "en_ruta",
        )
    )).scalar()

    return {
        "returns_pendientes": pendientes,
        "returns_activos": activos,
        "returns_completados_mes": completados_mes,
        "backhaul_programados": backhaul_programados,
        "backhaul_pendientes": backhaul_pendientes,
    }
