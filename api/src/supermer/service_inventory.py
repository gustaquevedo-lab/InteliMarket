"""Fase 2 — Physical Inventory service: sessions, items, adjustments, ABC counting"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import PhysicalCountSession, PhysicalCountItem, CountAdjustment



# ---------------------------------------------------------------------------
# COUNT SESSIONS
# ---------------------------------------------------------------------------

async def list_count_sessions(company_id: UUID, db: AsyncSession, area: Optional[str] = None, estado: Optional[str] = None):
    q = db.query(PhysicalCountSession).filter(PhysicalCountSession.company_id == company_id)
    if area:
        q = q.filter(PhysicalCountSession.area == area)
    if estado:
        q = q.filter(PhysicalCountSession.estado == estado)
    return q.order_by(PhysicalCountSession.fecha_inicio.desc()).all()


async def get_count_session(session_id: UUID, db: AsyncSession):
    s = db.query(PhysicalCountSession).options(
        selectinload(PhysicalCountSession.items),
    ).get(session_id)
    if not s:
        raise HTTPException(404, "Count session not found")
    return s


async def create_count_session(company_id: UUID, data, db: AsyncSession):
    s = PhysicalCountSession(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


async def update_count_session(session_id: UUID, data, db: AsyncSession):
    s = await get_count_session(session_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


async def complete_count_session(session_id: UUID, db: AsyncSession):
    s = await get_count_session(session_id, db)
    s.estado = "completada"
    s.fecha_fin = datetime.utcnow()

    # Calculate totals from items
    items = db.query(PhysicalCountItem).filter(PhysicalCountItem.session_id == session_id).all()
    discrepancias = [i for i in items if i.diferencia and abs(i.diferencia) > 0]
    s.total_items_contados = len(items)
    s.total_discrepancias = len(discrepancias)
    s.valor_discrepancia_total = sum(abs(i.valor_diferencia or 0) for i in discrepancias)

    # Mark items needing adjustment
    for i in discrepancias:
        i.requiere_ajuste = True

    db.commit()
    db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# COUNT ITEMS
# ---------------------------------------------------------------------------

async def list_count_items(session_id: UUID, db: AsyncSession, requiere_ajuste: Optional[bool] = None):
    q = db.query(PhysicalCountItem).filter(PhysicalCountItem.session_id == session_id)
    if requiere_ajuste is not None:
        q = q.filter(PhysicalCountItem.requiere_ajuste == requiere_ajuste)
    return q.order_by(PhysicalCountItem.created_at).all()


async def create_count_item(session_id: UUID, data, db: AsyncSession):
    item = PhysicalCountItem(session_id=session_id, **data.model_dump(exclude_none=True))
    if item.cantidad_contada is not None and item.cantidad_sistema is not None:
        item.diferencia = item.cantidad_contada - item.cantidad_sistema
    if item.costo_promedio and item.diferencia:
        item.valor_diferencia = item.diferencia * item.costo_promedio
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


async def update_count_item(item_id: UUID, data, db: AsyncSession):
    item = db.query(PhysicalCountItem).get(item_id)
    if not item:
        raise HTTPException(404, "Count item not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    if item.cantidad_contada is not None and item.cantidad_sistema is not None:
        item.diferencia = item.cantidad_contada - item.cantidad_sistema
    if item.costo_promedio and item.diferencia:
        item.valor_diferencia = item.diferencia * item.costo_promedio
    db.commit()
    db.refresh(item)
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
    db.commit()
    return items


# ---------------------------------------------------------------------------
# ADJUSTMENTS
# ---------------------------------------------------------------------------

async def list_adjustments(session_id: UUID, db: AsyncSession, estado: Optional[str] = None):
    q = db.query(CountAdjustment).filter(CountAdjustment.session_id == session_id)
    if estado:
        q = q.filter(CountAdjustment.estado == estado)
    return q.order_by(CountAdjustment.created_at.desc()).all()


async def create_adjustment(company_id: UUID, session_id: UUID, data, db: AsyncSession):
    adj = CountAdjustment(company_id=company_id, session_id=session_id, **data.model_dump(exclude_none=True))
    if adj.costo_unitario and adj.cantidad_ajuste:
        adj.valor_ajuste = adj.cantidad_ajuste * adj.costo_unitario
    db.add(adj)
    db.commit()
    db.refresh(adj)
    return adj


async def approve_adjustment(adjustment_id: UUID, approved_by: UUID, db: AsyncSession):
    adj = db.query(CountAdjustment).get(adjustment_id)
    if not adj:
        raise HTTPException(404, "Adjustment not found")
    adj.estado = "aprobado"
    adj.aprobado_por = approved_by
    adj.aprobado_at = datetime.utcnow()
    db.commit()
    db.refresh(adj)
    return adj


async def reject_adjustment(adjustment_id: UUID, db: AsyncSession):
    adj = db.query(CountAdjustment).get(adjustment_id)
    if not adj:
        raise HTTPException(404, "Adjustment not found")
    adj.estado = "rechazado"
    db.commit()
    db.refresh(adj)
    return adj


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_inventory_dashboard(company_id: UUID, db: AsyncSession):
    abiertas = db.query(PhysicalCountSession).filter(
        PhysicalCountSession.company_id == company_id,
        PhysicalCountSession.estado == "abierta",
    ).count()

    en_curso = db.query(PhysicalCountSession).filter(
        PhysicalCountSession.company_id == company_id,
        PhysicalCountSession.estado == "en_curso",
    ).count()

    completadas = db.query(PhysicalCountSession).filter(
        PhysicalCountSession.company_id == company_id,
        PhysicalCountSession.estado == "completada",
    ).count()

    ajustes_pendientes = db.query(CountAdjustment).filter(
        CountAdjustment.company_id == company_id,
        CountAdjustment.estado == "pendiente",
    ).count()

    return {
        "sesiones_abiertas": abiertas,
        "sesiones_en_curso": en_curso,
        "sesiones_completadas": completadas,
        "ajustes_pendientes": ajustes_pendientes,
    }
