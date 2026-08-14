"""Fase 2 — DSD Receiving service: schedules, receiving, items, rejections"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import (
    DsdReceivingSchedule, DsdReceivingLog, DsdReceivingItem, DsdReceivingRejection,
)



# ---------------------------------------------------------------------------
# SCHEDULES
# ---------------------------------------------------------------------------

async def list_dsd_schedules(company_id: UUID, db: AsyncSession, fecha: Optional[date] = None, proveedor_id: Optional[UUID] = None):
    q = select(DsdReceivingSchedule).where(DsdReceivingSchedule.company_id == company_id)
    if fecha:
        q = q.where(DsdReceivingSchedule.fecha_programada == fecha)
    if proveedor_id:
        q = q.where(DsdReceivingSchedule.proveedor_id == proveedor_id)
    q = q.order_by(DsdReceivingSchedule.ventana_inicio)
    result = await db.execute(q)
    return result.scalars().all()


async def get_dsd_schedule(schedule_id: UUID, db: AsyncSession):
    result = await db.execute(select(DsdReceivingSchedule).where(DsdReceivingSchedule.id == schedule_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "DSD schedule not found")
    return s


async def create_dsd_schedule(company_id: UUID, data, db: AsyncSession):
    s = DsdReceivingSchedule(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


async def update_dsd_schedule(schedule_id: UUID, data, db: AsyncSession):
    s = await get_dsd_schedule(schedule_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    await db.commit()
    await db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# RECEIVING LOGS
# ---------------------------------------------------------------------------

async def list_dsd_receivings(company_id: UUID, db: AsyncSession, fecha: Optional[date] = None, estado: Optional[str] = None):
    q = select(DsdReceivingLog).where(DsdReceivingLog.company_id == company_id)
    if fecha:
        q = q.where(func.date(DsdReceivingLog.fecha_recepcion) == fecha)
    if estado:
        q = q.where(DsdReceivingLog.estado == estado)
    q = q.order_by(DsdReceivingLog.fecha_recepcion.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def get_dsd_receiving(receiving_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(DsdReceivingLog).options(
            selectinload(DsdReceivingLog.items),
            selectinload(DsdReceivingLog.rechazos),
        ).where(DsdReceivingLog.id == receiving_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "DSD receiving not found")
    return r


async def create_dsd_receiving(company_id: UUID, data, db: AsyncSession):
    r = DsdReceivingLog(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return await get_dsd_receiving(r.id, db)


async def update_dsd_receiving(receiving_id: UUID, data, db: AsyncSession):
    r = await get_dsd_receiving(receiving_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    await db.commit()
    await db.refresh(r)
    return r


# ---------------------------------------------------------------------------
# RECEIVING ITEMS
# ---------------------------------------------------------------------------

async def list_dsd_items(receiving_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(DsdReceivingItem).where(
            DsdReceivingItem.receiving_id == receiving_id,
        ).order_by(DsdReceivingItem.created_at)
    )
    return result.scalars().all()


async def create_dsd_item(receiving_id: UUID, data, db: AsyncSession):
    item = DsdReceivingItem(receiving_id=receiving_id, **data.model_dump(exclude_none=True))
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def batch_create_dsd_items(receiving_id: UUID, items_data: list, db: AsyncSession):
    items = []
    for d in items_data:
        item = DsdReceivingItem(receiving_id=receiving_id, **d.model_dump(exclude_none=True))
        db.add(item)
        items.append(item)
    await db.commit()
    return items


# ---------------------------------------------------------------------------
# REJECTIONS
# ---------------------------------------------------------------------------

async def list_dsd_rejections(receiving_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(DsdReceivingRejection).where(
            DsdReceivingRejection.receiving_id == receiving_id,
        ).order_by(DsdReceivingRejection.created_at.desc())
    )
    return result.scalars().all()


async def create_dsd_rejection(company_id: UUID, receiving_id: UUID, data, db: AsyncSession):
    rej = DsdReceivingRejection(company_id=company_id, receiving_id=receiving_id, **data.model_dump(exclude_none=True))
    db.add(rej)
    await db.commit()
    await db.refresh(rej)
    return rej


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_dsd_dashboard(company_id: UUID, db: AsyncSession):
    hoy = date.today()
    programadas = (await db.execute(
        select(func.count()).select_from(DsdReceivingSchedule).where(
            DsdReceivingSchedule.company_id == company_id,
            DsdReceivingSchedule.fecha_programada == hoy,
            DsdReceivingSchedule.estado == "programada",
        )
    )).scalar()

    en_curso = (await db.execute(
        select(func.count()).select_from(DsdReceivingLog).where(
            DsdReceivingLog.company_id == company_id,
            func.date(DsdReceivingLog.fecha_recepcion) == hoy,
            DsdReceivingLog.estado == "en_curso",
        )
    )).scalar()

    completadas = (await db.execute(
        select(func.count()).select_from(DsdReceivingLog).where(
            DsdReceivingLog.company_id == company_id,
            func.date(DsdReceivingLog.fecha_recepcion) == hoy,
            DsdReceivingLog.estado.in_(["completada", "parcial"]),
        )
    )).scalar()

    rechazos_temp = (await db.execute(
        select(func.count()).select_from(DsdReceivingRejection).join(
            DsdReceivingLog, DsdReceivingRejection.receiving_id == DsdReceivingLog.id,
        ).where(
            DsdReceivingLog.company_id == company_id,
            func.date(DsdReceivingLog.fecha_recepcion) == hoy,
            DsdReceivingRejection.motivo == "temp_fuera_rango",
        )
    )).scalar()

    proximas_result = await db.execute(
        select(DsdReceivingSchedule).where(
            DsdReceivingSchedule.company_id == company_id,
            DsdReceivingSchedule.fecha_programada >= hoy,
            DsdReceivingSchedule.estado == "programada",
        ).order_by(DsdReceivingSchedule.ventana_inicio).limit(10)
    )
    proximas = proximas_result.scalars().all()

    return {
        "hoy_programadas": programadas,
        "en_curso": en_curso,
        "completadas_hoy": completadas,
        "proximas_programadas": [
            {
                "id": str(s.id),
                "proveedor_nombre": "",
                "numero_oc": s.numero_oc,
                "ventana_inicio": s.ventana_inicio.isoformat(),
                "tipo_carga": s.tipo_carga,
            }
            for s in proximas
        ],
    }
