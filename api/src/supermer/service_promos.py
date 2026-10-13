"""Fase 3 — Promotions service: calendar, budgets, effectiveness analysis
💡 Operators: Plan promotions by season. Track effectiveness to learn which promos work.
Lift >50% is great, but watch for canibalización >20% which eats margin."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from .models import PromoCalendar, PromoBudget, PromoEffectiveness



# ---------------------------------------------------------------------------
# PROMO CALENDAR
# ---------------------------------------------------------------------------

async def list_promos(company_id: UUID, db: AsyncSession, tipo: Optional[str] = None, estado: Optional[str] = None, desde: Optional[date] = None, hasta: Optional[date] = None):
    q = select(PromoCalendar).where(PromoCalendar.company_id == company_id)
    if tipo: q = q.where(PromoCalendar.tipo == tipo)
    if estado: q = q.where(PromoCalendar.estado == estado)
    if desde: q = q.where(PromoCalendar.fecha_inicio >= desde)
    if hasta: q = q.where(PromoCalendar.fecha_fin <= hasta)
    q = q.order_by(PromoCalendar.fecha_inicio.desc())
    result = await db.execute(q)
    return result.scalars().all()

async def create_promo(company_id: UUID, data, db: AsyncSession):
    p = PromoCalendar(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p

async def update_promo(promo_id: UUID, data, db: AsyncSession):
    result = await db.execute(select(PromoCalendar).where(PromoCalendar.id == promo_id))
    p = result.scalar_one_or_none()
    if not p: raise HTTPException(404, "Promo not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p


# ---------------------------------------------------------------------------
# PROMO BUDGETS
# ---------------------------------------------------------------------------

async def list_promo_budgets(promo_id: UUID, db: AsyncSession):
    result = await db.execute(select(PromoBudget).where(PromoBudget.promo_id == promo_id))
    return result.scalars().all()

async def create_promo_budget(data, db: AsyncSession):
    b = PromoBudget(**data.model_dump(exclude_none=True))
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b


# ---------------------------------------------------------------------------
# PROMO EFFECTIVENESS
# ---------------------------------------------------------------------------

async def list_promo_effectiveness(company_id: UUID, db: AsyncSession, promo_id: Optional[UUID] = None):
    q = select(PromoEffectiveness).where(PromoEffectiveness.company_id == company_id)
    if promo_id: q = q.where(PromoEffectiveness.promo_id == promo_id)
    q = q.order_by(PromoEffectiveness.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()

async def create_promo_effectiveness(company_id: UUID, data, db: AsyncSession):
    """Record promo effectiveness with calculated metrics.
    lift_pct = (ventas_durante - ventas_antes) / ventas_antes * 100
    canibalizacion: if ventas_despues < ventas_antes, some demand was borrowed from future"""
    eff = PromoEffectiveness(company_id=company_id, **data.model_dump(exclude_none=True))
    if eff.ventas_antes and eff.ventas_antes > 0:
        if eff.ventas_durante:
            eff.lift_pct = ((eff.ventas_durante - eff.ventas_antes) / eff.ventas_antes) * 100
        if eff.ventas_despues:
            eff.canibalizacion_pct = max(0, ((eff.ventas_antes - eff.ventas_despues) / eff.ventas_antes) * 100)
        if eff.lift_pct and eff.ventas_durante and eff.ventas_despues:
            eff.margen_incremental = eff.ventas_durante - (eff.ventas_antes + eff.ventas_despues) / 2
    db.add(eff)
    await db.commit()
    await db.refresh(eff)
    return eff


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_promo_dashboard(company_id: UUID, db: AsyncSession):
    hoy = date.today()
    mes_inicio = hoy.replace(day=1)

    promos_activas = (await db.execute(
        select(func.count()).select_from(PromoCalendar).where(
            PromoCalendar.company_id == company_id,
            PromoCalendar.fecha_inicio <= hoy,
            PromoCalendar.fecha_fin >= hoy,
        )
    )).scalar()

    promos_planificadas = (await db.execute(
        select(func.count()).select_from(PromoCalendar).where(
            PromoCalendar.company_id == company_id,
            PromoCalendar.estado == "planificado",
        )
    )).scalar()

    completadas_mes = (await db.execute(
        select(func.count()).select_from(PromoCalendar).where(
            PromoCalendar.company_id == company_id,
            PromoCalendar.estado == "completado",
            PromoCalendar.fecha_fin >= mes_inicio,
        )
    )).scalar()

    presupuesto_total_mes = (await db.execute(
        select(func.coalesce(func.sum(PromoCalendar.presupuesto_asignado), 0)).where(
            PromoCalendar.company_id == company_id,
            PromoCalendar.fecha_inicio >= mes_inicio,
        )
    )).scalar()

    return {
        "promos_activas": promos_activas,
        "promos_planificadas": promos_planificadas,
        "completadas_mes": completadas_mes,
        "presupuesto_total_mes": presupuesto_total_mes or 0,
    }
