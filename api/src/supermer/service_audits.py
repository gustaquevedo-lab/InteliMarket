"""Fase 1 — Store Audits service: templates, executions, scoring"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import StoreAuditTemplate, StoreAuditTemplateItem, StoreAuditExecution, StoreAuditAnswer


# ---------------------------------------------------------------------------
# TEMPLATES
# ---------------------------------------------------------------------------

async def list_templates(company_id: UUID, db: AsyncSession, area: Optional[str] = None, activo: Optional[bool] = None):
    q = select(StoreAuditTemplate).where(StoreAuditTemplate.company_id == company_id)
    if area:
        q = q.where(StoreAuditTemplate.area == area)
    if activo is not None:
        q = q.where(StoreAuditTemplate.activo == activo)
    q = q.order_by(StoreAuditTemplate.nombre)
    result = await db.execute(q)
    return result.scalars().all()


async def get_template(template_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(StoreAuditTemplate)
        .options(selectinload(StoreAuditTemplate.items))
        .where(StoreAuditTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Audit template not found")
    t.items.sort(key=lambda i: i.orden)
    return t


async def create_template(company_id: UUID, data, db: AsyncSession):
    t = StoreAuditTemplate(
        company_id=company_id,
        **data.model_dump(exclude={"items"}, exclude_none=True),
    )
    db.add(t)
    await db.flush()
    for item_data in data.items or []:
        item = StoreAuditTemplateItem(template_id=t.id, **item_data.model_dump())
        db.add(item)
    await db.commit()
    await db.refresh(t)
    return await get_template(t.id, db)


async def update_template(template_id: UUID, data, db: AsyncSession):
    t = await get_template(template_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    await db.commit()
    await db.refresh(t)
    return await get_template(template_id, db)


async def delete_template(template_id: UUID, db: AsyncSession):
    t = await get_template(template_id, db)
    await db.delete(t)
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# TEMPLATE ITEMS
# ---------------------------------------------------------------------------

async def add_template_item(template_id: UUID, data, db: AsyncSession):
    t = await get_template(template_id, db)
    item = StoreAuditTemplateItem(template_id=template_id, **data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_template_item(item_id: UUID, data, db: AsyncSession):
    result = await db.execute(select(StoreAuditTemplateItem).where(StoreAuditTemplateItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Template item not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return item


async def delete_template_item(item_id: UUID, db: AsyncSession):
    result = await db.execute(select(StoreAuditTemplateItem).where(StoreAuditTemplateItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Template item not found")
    await db.delete(item)
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# EXECUTIONS
# ---------------------------------------------------------------------------

async def list_executions(
    company_id: UUID, db: AsyncSession,
    area: Optional[str] = None,
    fecha: Optional[date] = None,
    estado: Optional[str] = None,
):
    q = select(StoreAuditExecution).join(
        StoreAuditTemplate, StoreAuditExecution.template_id == StoreAuditTemplate.id
    ).where(
        StoreAuditTemplate.company_id == company_id,
    )
    if area:
        q = q.where(StoreAuditTemplate.area == area)
    if fecha:
        q = q.where(StoreAuditExecution.fecha == fecha)
    if estado:
        q = q.where(StoreAuditExecution.estado == estado)
    q = q.order_by(StoreAuditExecution.fecha.desc(), StoreAuditExecution.hora.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def get_execution(execution_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(StoreAuditExecution)
        .options(selectinload(StoreAuditExecution.answers))
        .where(StoreAuditExecution.id == execution_id)
    )
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Audit execution not found")
    return e


async def start_execution(company_id: UUID, user_id: UUID, data, db: AsyncSession):
    t = await get_template(data.template_id, db)
    e = StoreAuditExecution(
        company_id=company_id,
        template_id=data.template_id,
        ejecutado_por=user_id,
        fecha=date.today(),
        hora=datetime.utcnow(),
        estado="en_curso",
        **data.model_dump(exclude={"template_id"}, exclude_none=True),
    )
    db.add(e)
    await db.commit()
    await db.refresh(e)
    return await get_execution(e.id, db)


async def submit_answers(execution_id: UUID, user_id: UUID, answers_data: list, db: AsyncSession):
    e = await get_execution(execution_id, db)
    e.ejecutado_por = user_id
    await db.execute(
        StoreAuditAnswer.__table__.delete().where(StoreAuditAnswer.execution_id == execution_id)
    )
    for ans in answers_data:
        answer = StoreAuditAnswer(
            execution_id=execution_id,
            **ans.model_dump(),
        )
        db.add(answer)
    await db.commit()
    await db.refresh(e)
    return await get_execution(execution_id, db)


async def complete_execution(execution_id: UUID, db: AsyncSession):
    e = await get_execution(execution_id, db)
    t = await get_template(e.template_id, db)
    # Score calculation
    total = Decimal("0")
    max_score = Decimal("0")
    for item in t.items:
        max_score += item.peso
    # Sum weights for conforming answers
    for answer in e.answers:
        matched = [it for it in t.items if str(it.id) == str(answer.template_item_id)]
        if matched and answer.conforme:
            total += matched[0].peso
    pct = Decimal("0")
    if max_score > 0:
        pct = (total / max_score) * 100
    e.puntaje_total = total
    e.puntaje_maximo = max_score
    e.porcentaje = round(pct, 2)
    e.aprobado = pct >= t.puntaje_minimo_aprobacion
    e.estado = "completado"
    await db.commit()
    await db.refresh(e)
    return await get_execution(execution_id, db)


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def audit_dashboard(company_id: UUID, db: AsyncSession):
    today = date.today()
    executions_today = (await db.execute(
        select(func.count()).select_from(StoreAuditExecution).join(
            StoreAuditTemplate, StoreAuditExecution.template_id == StoreAuditTemplate.id
        ).where(
            StoreAuditTemplate.company_id == company_id,
            StoreAuditExecution.fecha == today,
        )
    )).scalar()
    week_ago = date.today()
    from datetime import timedelta
    week_ago = today - timedelta(days=7)
    result = await db.execute(
        select(StoreAuditExecution).join(
            StoreAuditTemplate, StoreAuditExecution.template_id == StoreAuditTemplate.id
        ).where(
            StoreAuditTemplate.company_id == company_id,
            StoreAuditExecution.estado == "completado",
        )
    )
    all_executions = result.scalars().all()
    approved = sum(1 for e in all_executions if e.aprobado)
    rejected = sum(1 for e in all_executions if e.aprobado is False)
    avg = Decimal("0")
    if all_executions:
        scores = [e.porcentaje or 0 for e in all_executions]
        avg = sum(scores) / len(scores)
    return {
        "ejecuciones_hoy": executions_today,
        "ejecuciones_semana": len(all_executions),
        "promedio_porcentaje": round(avg, 2),
        "aprobadas": approved,
        "rechazadas": rejected,
        "por_area": [],
        "tendencia_semanal": [],
    }
