"""Fase 2 — DSD Receiving service: schedules, receiving, items, rejections"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import func, and_
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
    q = db.query(DsdReceivingSchedule).filter(DsdReceivingSchedule.company_id == company_id)
    if fecha:
        q = q.filter(DsdReceivingSchedule.fecha_programada == fecha)
    if proveedor_id:
        q = q.filter(DsdReceivingSchedule.proveedor_id == proveedor_id)
    return q.order_by(DsdReceivingSchedule.ventana_inicio).all()


async def get_dsd_schedule(schedule_id: UUID, db: AsyncSession):
    s = db.query(DsdReceivingSchedule).get(schedule_id)
    if not s:
        raise HTTPException(404, "DSD schedule not found")
    return s


async def create_dsd_schedule(company_id: UUID, data, db: AsyncSession):
    s = DsdReceivingSchedule(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


async def update_dsd_schedule(schedule_id: UUID, data, db: AsyncSession):
    s = await get_dsd_schedule(schedule_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# RECEIVING LOGS
# ---------------------------------------------------------------------------

async def list_dsd_receivings(company_id: UUID, db: AsyncSession, fecha: Optional[date] = None, estado: Optional[str] = None):
    q = db.query(DsdReceivingLog).filter(DsdReceivingLog.company_id == company_id)
    if fecha:
        q = q.filter(func.date(DsdReceivingLog.fecha_recepcion) == fecha)
    if estado:
        q = q.filter(DsdReceivingLog.estado == estado)
    return q.order_by(DsdReceivingLog.fecha_recepcion.desc()).all()


async def get_dsd_receiving(receiving_id: UUID, db: AsyncSession):
    r = db.query(DsdReceivingLog).options(
        selectinload(DsdReceivingLog.items),
        selectinload(DsdReceivingLog.rechazos),
    ).get(receiving_id)
    if not r:
        raise HTTPException(404, "DSD receiving not found")
    return r


async def create_dsd_receiving(company_id: UUID, data, db: AsyncSession):
    r = DsdReceivingLog(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(r)
    db.commit()
    db.refresh(r)
    return await get_dsd_receiving(r.id, db)


async def update_dsd_receiving(receiving_id: UUID, data, db: AsyncSession):
    r = await get_dsd_receiving(receiving_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


# ---------------------------------------------------------------------------
# RECEIVING ITEMS
# ---------------------------------------------------------------------------

async def list_dsd_items(receiving_id: UUID, db: AsyncSession):
    return db.query(DsdReceivingItem).filter(
        DsdReceivingItem.receiving_id == receiving_id,
    ).order_by(DsdReceivingItem.created_at).all()


async def create_dsd_item(receiving_id: UUID, data, db: AsyncSession):
    item = DsdReceivingItem(receiving_id=receiving_id, **data.model_dump(exclude_none=True))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


async def batch_create_dsd_items(receiving_id: UUID, items_data: list, db: AsyncSession):
    items = []
    for d in items_data:
        item = DsdReceivingItem(receiving_id=receiving_id, **d.model_dump(exclude_none=True))
        db.add(item)
        items.append(item)
    db.commit()
    return items


# ---------------------------------------------------------------------------
# REJECTIONS
# ---------------------------------------------------------------------------

async def list_dsd_rejections(receiving_id: UUID, db: AsyncSession):
    return db.query(DsdReceivingRejection).filter(
        DsdReceivingRejection.receiving_id == receiving_id,
    ).order_by(DsdReceivingRejection.created_at.desc()).all()


async def create_dsd_rejection(company_id: UUID, receiving_id: UUID, data, db: AsyncSession):
    rej = DsdReceivingRejection(company_id=company_id, receiving_id=receiving_id, **data.model_dump(exclude_none=True))
    db.add(rej)
    db.commit()
    db.refresh(rej)
    return rej


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_dsd_dashboard(company_id: UUID, db: AsyncSession):
    hoy = date.today()
    programadas = db.query(DsdReceivingSchedule).filter(
        DsdReceivingSchedule.company_id == company_id,
        DsdReceivingSchedule.fecha_programada == hoy,
        DsdReceivingSchedule.estado == "programada",
    ).count()

    en_curso = db.query(DsdReceivingLog).filter(
        DsdReceivingLog.company_id == company_id,
        func.date(DsdReceivingLog.fecha_recepcion) == hoy,
        DsdReceivingLog.estado == "en_curso",
    ).count()

    completadas = db.query(DsdReceivingLog).filter(
        DsdReceivingLog.company_id == company_id,
        func.date(DsdReceivingLog.fecha_recepcion) == hoy,
        DsdReceivingLog.estado.in_(["completada", "parcial"]),
    ).count()

    rechazos_temp = db.query(DsdReceivingRejection).join(
        DsdReceivingLog, DsdReceivingRejection.receiving_id == DsdReceivingLog.id,
    ).filter(
        DsdReceivingLog.company_id == company_id,
        func.date(DsdReceivingLog.fecha_recepcion) == hoy,
        DsdReceivingRejection.motivo == "temp_fuera_rango",
    ).count()

    proximas = db.query(DsdReceivingSchedule).filter(
        DsdReceivingSchedule.company_id == company_id,
        DsdReceivingSchedule.fecha_programada >= hoy,
        DsdReceivingSchedule.estado == "programada",
    ).order_by(DsdReceivingSchedule.ventana_inicio).limit(10).all()

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
