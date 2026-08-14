"""Fase 2 — Physical Inventory service: sessions, items, adjustments, ABC counting"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import PhysicalCountSession, PhysicalCountItem, CountAdjustment


# ---------------------------------------------------------------------------
# COUNT SESSIONS
# ---------------------------------------------------------------------------

async def list_count_sessions(company_id: UUID, db: AsyncSession, area: Optional[str] = None, estado: Optional[str] = None):
    q = select(PhysicalCountSession).where(PhysicalCountSession.company_id == company_id)
    if area:
        q = q.where(PhysicalCountSession.area == area)
    if estado:
        q = q.where(PhysicalCountSession.estado == estado)
    q = q.order_by(PhysicalCountSession.fecha_inicio.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def get_count_session(session_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(PhysicalCountSession)
        .options(selectinload(PhysicalCountSession.items))
        .where(PhysicalCountSession.id == session_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Count session not found")
    return s


async def create_count_session(company_id: UUID, data, db: AsyncSession):
    s = PhysicalCountSession(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


async def update_count_session(session_id: UUID, data, db: AsyncSession):
    s = await get_count_session(session_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    await db.commit()
    await db.refresh(s)
    return s


async def complete_count_session(session_id: UUID, db: AsyncSession):
    s = await get_count_session(session_id, db)
    s.estado = "completada"
    s.fecha_fin = datetime.now(timezone.utc)

    result = await db.execute(select(PhysicalCountItem).where(PhysicalCountItem.session_id == session_id))
    items = result.scalars().all()
    discrepancias = [i for i in items if i.diferencia and abs(i.diferencia) > 0]
    s.total_items_contados = len(items)
    s.total_discrepancias = len(discrepancias)
    s.valor_discrepancia_total = sum(abs(i.valor_diferencia or 0) for i in discrepancias)

    for i in discrepancias:
        i.requiere_ajuste = True

    await db.commit()
    await db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# COUNT ITEMS
# ---------------------------------------------------------------------------

async def list_count_items(session_id: UUID, db: AsyncSession, requiere_ajuste: Optional[bool] = None):
    q = select(PhysicalCountItem).where(PhysicalCountItem.session_id == session_id)
    if requiere_ajuste is not None:
        q = q.where(PhysicalCountItem.requiere_ajuste == requiere_ajuste)
    q = q.order_by(PhysicalCountItem.created_at)
    result = await db.execute(q)
    return result.scalars().all()


async def create_count_item(session_id: UUID, data, db: AsyncSession):
    item = PhysicalCountItem(session_id=session_id, **data.model_dump(exclude_none=True))
    if item.cantidad_contada is not None and item.cantidad_sistema is not None:
        item.diferencia = item.cantidad_contada - item.cantidad_sistema
    if item.costo_promedio and item.diferencia:
        item.valor_diferencia = item.diferencia * item.costo_promedio
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_count_item(item_id: UUID, data, db: AsyncSession):
    result = await db.execute(select(PhysicalCountItem).where(PhysicalCountItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Count item not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    if item.cantidad_contada is not None and item.cantidad_sistema is not None:
        item.diferencia = item.cantidad_contada - item.cantidad_sistema
    if item.costo_promedio and item.diferencia:
        item.valor_diferencia = item.diferencia * item.costo_promedio
    await db.commit()
    await db.refresh(item)
    return item


async def batch_create_count_items(session_id: UUID, items_data: list, db: AsyncSession):
    items = []
    for d in items_data:
        item = PhysicalCountItem(session_id=session_id, **d.model_dump(exclude_none=True))
        if item.cantidad_contada is not None and item.cantidad_sistema is not None:
            item.diferencia = item.cantidad_contada - item.cantidad_sistema
        if item.costo_promedio and item.diferencia:
            item.valor_diferencia = item.diferencia * item.costo_promedio
        db.add(item)
        items.append(item)
    await db.commit()
    return items


# ---------------------------------------------------------------------------
# ADJUSTMENTS
# ---------------------------------------------------------------------------

async def list_adjustments(session_id: UUID, db: AsyncSession, estado: Optional[str] = None):
    q = select(CountAdjustment).where(CountAdjustment.session_id == session_id)
    if estado:
        q = q.where(CountAdjustment.estado == estado)
    q = q.order_by(CountAdjustment.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def create_adjustment(company_id: UUID, session_id: UUID, data, db: AsyncSession):
    adj = CountAdjustment(company_id=company_id, session_id=session_id, **data.model_dump(exclude_none=True))
    if adj.costo_unitario and adj.cantidad_ajuste:
        adj.valor_ajuste = adj.cantidad_ajuste * adj.costo_unitario
    db.add(adj)
    await db.commit()
    await db.refresh(adj)
    return adj


async def approve_adjustment(adjustment_id: UUID, approved_by: UUID, db: AsyncSession):
    result = await db.execute(select(CountAdjustment).where(CountAdjustment.id == adjustment_id))
    adj = result.scalar_one_or_none()
    if not adj:
        raise HTTPException(404, "Adjustment not found")
    adj.estado = "aprobado"
    adj.aprobado_por = approved_by
    adj.aprobado_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(adj)
    return adj


async def reject_adjustment(adjustment_id: UUID, db: AsyncSession):
    result = await db.execute(select(CountAdjustment).where(CountAdjustment.id == adjustment_id))
    adj = result.scalar_one_or_none()
    if not adj:
        raise HTTPException(404, "Adjustment not found")
    adj.estado = "rechazado"
    await db.commit()
    await db.refresh(adj)
    return adj


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_inventory_dashboard(company_id: UUID, db: AsyncSession):
    abiertas = (await db.execute(
        select(func.count()).select_from(PhysicalCountSession).where(
            PhysicalCountSession.company_id == company_id,
            PhysicalCountSession.estado == "abierta",
        )
    )).scalar()

    en_curso = (await db.execute(
        select(func.count()).select_from(PhysicalCountSession).where(
            PhysicalCountSession.company_id == company_id,
            PhysicalCountSession.estado == "en_curso",
        )
    )).scalar()

    completadas = (await db.execute(
        select(func.count()).select_from(PhysicalCountSession).where(
            PhysicalCountSession.company_id == company_id,
            PhysicalCountSession.estado == "completada",
        )
    )).scalar()

    ajustes_pendientes = (await db.execute(
        select(func.count()).select_from(CountAdjustment).where(
            CountAdjustment.company_id == company_id,
            CountAdjustment.estado == "pendiente",
        )
    )).scalar()

    return {
        "sesiones_abiertas": abiertas,
        "sesiones_en_curso": en_curso,
        "sesiones_completadas": completadas,
        "ajustes_pendientes": ajustes_pendientes,
    }
