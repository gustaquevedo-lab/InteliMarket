"""Fase 3 — Promotions service: calendar, budgets, effectiveness analysis
💡 Operators: Plan promotions by season. Track effectiveness to learn which promos work.
Lift >50% is great, but watch for canibalización >20% which eats margin."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import func, extract
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from .models import PromoCalendar, PromoBudget, PromoEffectiveness



# ---------------------------------------------------------------------------
# PROMO CALENDAR
# ---------------------------------------------------------------------------

async def list_promos(company_id: UUID, db: AsyncSession, tipo: Optional[str] = None, estado: Optional[str] = None, desde: Optional[date] = None, hasta: Optional[date] = None):
    q = db.query(PromoCalendar).filter(PromoCalendar.company_id == company_id)
    if tipo: q = q.filter(PromoCalendar.tipo == tipo)
    if estado: q = q.filter(PromoCalendar.estado == estado)
    if desde: q = q.filter(PromoCalendar.fecha_inicio >= desde)
    if hasta: q = q.filter(PromoCalendar.fecha_fin <= hasta)
    return q.order_by(PromoCalendar.fecha_inicio.desc()).all()

async def create_promo(company_id: UUID, data, db: AsyncSession):
    p = PromoCalendar(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(p); db.commit(); db.refresh(p)
    return p

async def update_promo(promo_id: UUID, data, db: AsyncSession):
    p = db.query(PromoCalendar).get(promo_id)
    if not p: raise HTTPException(404, "Promo not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return p


# ---------------------------------------------------------------------------
# PROMO BUDGETS
# ---------------------------------------------------------------------------

async def list_promo_budgets(promo_id: UUID, db: AsyncSession):
    return db.query(PromoBudget).filter(PromoBudget.promo_id == promo_id).all()

async def create_promo_budget(data, db: AsyncSession):
    b = PromoBudget(**data.model_dump(exclude_none=True))
    db.add(b); db.commit(); db.refresh(b)
    return b


# ---------------------------------------------------------------------------
# PROMO EFFECTIVENESS
# ---------------------------------------------------------------------------

async def list_promo_effectiveness(company_id: UUID, db: AsyncSession, promo_id: Optional[UUID] = None):
    q = db.query(PromoEffectiveness).filter(PromoEffectiveness.company_id == company_id)
    if promo_id: q = q.filter(PromoEffectiveness.promo_id == promo_id)
    return q.order_by(PromoEffectiveness.created_at.desc()).all()

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
    db.add(eff); db.commit(); db.refresh(eff)
    return eff


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_promo_dashboard(company_id: UUID, db: AsyncSession):
    hoy = date.today()
    mes_inicio = hoy.replace(day=1)
    return {
        "promos_activas": db.query(PromoCalendar).filter(
            PromoCalendar.company_id == company_id,
            PromoCalendar.fecha_inicio <= hoy,
            PromoCalendar.fecha_fin >= hoy,
        ).count(),
        "promos_planificadas": db.query(PromoCalendar).filter(
            PromoCalendar.company_id == company_id,
            PromoCalendar.estado == "planificado",
        ).count(),
        "completadas_mes": db.query(PromoCalendar).filter(
            PromoCalendar.company_id == company_id,
            PromoCalendar.estado == "completado",
            PromoCalendar.fecha_fin >= mes_inicio,
        ).count(),
        "presupuesto_total_mes": db.query(func.coalesce(func.sum(PromoCalendar.presupuesto_asignado), 0)).filter(
            PromoCalendar.company_id == company_id,
            PromoCalendar.fecha_inicio >= mes_inicio,
        ).scalar() or 0,
    }
