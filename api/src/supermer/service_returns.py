"""Fase 2 — Supplier Returns & Backhaul service"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import SupplierReturn, SupplierReturnItem, ReturnAuthorization, BackhaulSchedule



# ---------------------------------------------------------------------------
# RETURNS
# ---------------------------------------------------------------------------

async def list_returns(company_id: UUID, db: AsyncSession, estado: Optional[str] = None, proveedor_id: Optional[UUID] = None):
    q = db.query(SupplierReturn).filter(SupplierReturn.company_id == company_id)
    if estado:
        q = q.filter(SupplierReturn.estado == estado)
    if proveedor_id:
        q = q.filter(SupplierReturn.proveedor_id == proveedor_id)
    return q.order_by(SupplierReturn.fecha_creacion.desc()).all()


async def get_return(return_id: UUID, db: AsyncSession):
    r = db.query(SupplierReturn).options(
        selectinload(SupplierReturn.items),
    ).get(return_id)
    if not r:
        raise HTTPException(404, "Supplier return not found")
    return r


async def create_return(company_id: UUID, data, db: AsyncSession):
    r = SupplierReturn(company_id=company_id, **data.model_dump(exclude={"items"}, exclude_none=True))
    db.add(r)
    db.flush()
    for item_data in data.items or []:
        item = SupplierReturnItem(return_id=r.id, **item_data.model_dump(exclude_none=True))
        item.valor_total = None
        if item.valor_unitario and item.cantidad:
            item.valor_total = item.valor_unitario * item.cantidad
        db.add(item)
    db.commit()
    db.refresh(r)
    return await get_return(r.id, db)


async def update_return(return_id: UUID, data, db: AsyncSession):
    r = await get_return(return_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


async def authorize_return(return_id: UUID, user_id: UUID, db: AsyncSession):
    r = await get_return(return_id, db)
    r.estado = "autorizado"
    r.autorizado_por = user_id
    r.autorizado_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
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
    db.commit()
    db.refresh(r)
    return r


# ---------------------------------------------------------------------------
# RETURN ITEMS
# ---------------------------------------------------------------------------

async def create_return_item(return_id: UUID, data, db: AsyncSession):
    item = SupplierReturnItem(return_id=return_id, **data.model_dump(exclude_none=True))
    if item.valor_unitario and item.cantidad:
        item.valor_total = item.valor_unitario * item.cantidad
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# AUTHORIZATIONS
# ---------------------------------------------------------------------------

async def list_return_authorizations(return_id: UUID, db: AsyncSession):
    return db.query(ReturnAuthorization).filter(
        ReturnAuthorization.return_id == return_id,
    ).order_by(ReturnAuthorization.fecha_autorizacion.desc()).all()


async def create_return_authorization(return_id: UUID, data, db: AsyncSession):
    auth = ReturnAuthorization(return_id=return_id, **data.model_dump(exclude_none=True))
    db.add(auth)
    db.commit()
    db.refresh(auth)
    return auth


# ---------------------------------------------------------------------------
# BACKHAUL
# ---------------------------------------------------------------------------

async def list_backhauls(company_id: UUID, db: AsyncSession, estado: Optional[str] = None):
    q = db.query(BackhaulSchedule).filter(BackhaulSchedule.company_id == company_id)
    if estado:
        q = q.filter(BackhaulSchedule.estado == estado)
    return q.order_by(BackhaulSchedule.fecha_programada).all()


async def get_backhaul(backhaul_id: UUID, db: AsyncSession):
    b = db.query(BackhaulSchedule).get(backhaul_id)
    if not b:
        raise HTTPException(404, "Backhaul schedule not found")
    return b


async def create_backhaul(company_id: UUID, data, db: AsyncSession):
    b = BackhaulSchedule(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


async def update_backhaul(backhaul_id: UUID, data, db: AsyncSession):
    b = await get_backhaul(backhaul_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(b, k, v)
    db.commit()
    db.refresh(b)
    return b


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_returns_dashboard(company_id: UUID, db: AsyncSession):
    pendientes = db.query(SupplierReturn).filter(
        SupplierReturn.company_id == company_id,
        SupplierReturn.estado == "pendiente",
    ).count()

    activos = db.query(SupplierReturn).filter(
        SupplierReturn.company_id == company_id,
        SupplierReturn.estado.in_(["autorizado", "en_proceso"]),
    ).count()

    completados_mes = db.query(SupplierReturn).filter(
        SupplierReturn.company_id == company_id,
        SupplierReturn.estado == "completado",
        extract("month", SupplierReturn.completado_at) == func.extract("month", func.now()),
    ).count()

    return {
        "returns_pendientes": pendientes,
        "returns_activos": activos,
        "returns_completados_mes": completados_mes,
        "backhaul_programados": db.query(BackhaulSchedule).filter(
            BackhaulSchedule.company_id == company_id,
            BackhaulSchedule.estado == "pendiente",
        ).count(),
        "backhaul_pendientes": db.query(BackhaulSchedule).filter(
            BackhaulSchedule.company_id == company_id,
            BackhaulSchedule.estado == "en_ruta",
        ).count(),
    }
