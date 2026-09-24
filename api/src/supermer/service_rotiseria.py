"""Fase 1 — Rotisería service: recipes, production plans, temp logs, labels, markdowns"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import (
    RotiseriaRecipe, RotiseriaRecipeItem, RotiseriaProductionPlan,
    RotiseriaTemperatureLog, RotiseriaLabelBatch,
)



# ---------------------------------------------------------------------------
# RECIPES
# ---------------------------------------------------------------------------

async def list_recipes(company_id: UUID, db: AsyncSession, activa: Optional[bool] = None):
    q = select(RotiseriaRecipe).where(RotiseriaRecipe.company_id == company_id)
    if activa is not None:
        q = q.where(RotiseriaRecipe.activa == activa)
    q = q.order_by(RotiseriaRecipe.nombre)
    result = await db.execute(q)
    return result.scalars().all()


async def get_recipe(recipe_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(RotiseriaRecipe)
        .options(selectinload(RotiseriaRecipe.items))
        .where(RotiseriaRecipe.id == recipe_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Recipe not found")
    return r


async def create_recipe(company_id: UUID, data, db: AsyncSession):
    r = RotiseriaRecipe(
        company_id=company_id,
        **data.model_dump(exclude={"items"}, exclude_none=True),
    )
    db.add(r)
    await db.flush()
    for item_data in data.items or []:
        item = RotiseriaRecipeItem(receta_id=r.id, **item_data.model_dump())
        db.add(item)
    await db.commit()
    await db.refresh(r)
    return await get_recipe(r.id, db)


async def update_recipe(recipe_id: UUID, data, db: AsyncSession):
    r = await get_recipe(recipe_id, db)
    for k, v in data.model_dump(exclude={"items"}, exclude_none=True).items():
        setattr(r, k, v)
    if data.items is not None:
        # Remove old items and replace
        result = await db.execute(select(RotiseriaRecipeItem).where(RotiseriaRecipeItem.receta_id == recipe_id))
        for old_item in result.scalars().all():
            await db.delete(old_item)
        for item_data in data.items:
            item = RotiseriaRecipeItem(receta_id=recipe_id, **item_data.model_dump())
            db.add(item)
    await db.commit()
    await db.refresh(r)
    return await get_recipe(r.id, db)


async def delete_recipe(recipe_id: UUID, db: AsyncSession):
    r = await get_recipe(recipe_id, db)
    await db.delete(r)
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# PRODUCTION PLANS
# ---------------------------------------------------------------------------

async def list_plans(
    company_id: UUID, db: AsyncSession,
    fecha: Optional[date] = None,
    estado: Optional[str] = None,
):
    # Join through recipe to find company-owned plans
    q = select(RotiseriaProductionPlan).join(RotiseriaRecipe).where(
        RotiseriaRecipe.company_id == company_id,
    )
    if fecha:
        q = q.where(RotiseriaProductionPlan.fecha == fecha)
    if estado:
        q = q.where(RotiseriaProductionPlan.estado == estado)
    q = q.order_by(RotiseriaProductionPlan.fecha.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def get_plan(plan_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(RotiseriaProductionPlan)
        .options(
            selectinload(RotiseriaProductionPlan.temperature_logs),
            selectinload(RotiseriaProductionPlan.labels),
        )
        .where(RotiseriaProductionPlan.id == plan_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Production plan not found")
    return p


async def create_plan(company_id: UUID, data, db: AsyncSession):
    # Verify recipe exists and belongs to company
    result = await db.execute(
        select(RotiseriaRecipe).where(
            RotiseriaRecipe.id == data.receta_id,
            RotiseriaRecipe.company_id == company_id,
        )
    )
    recipe = result.scalars().first()
    if not recipe:
        raise HTTPException(404, "Recipe not found for this company")
    p = RotiseriaProductionPlan(
        **data.model_dump(exclude_none=True),
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return await get_plan(p.id, db)


async def update_plan(plan_id: UUID, data, db: AsyncSession):
    p = await get_plan(plan_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    if p.estado == "completado" and not p.hora_fin:
        p.hora_fin = datetime.utcnow()
    await db.commit()
    await db.refresh(p)
    return await get_plan(plan_id, db)


async def complete_plan(plan_id: UUID, data: dict, db: AsyncSession):
    p = await get_plan(plan_id, db)
    p.estado = "completado"
    p.cantidad_producida = data.get("cantidad_producida", p.cantidad_objetivo)
    p.hora_fin = datetime.utcnow()
    p.notas = data.get("notas", p.notas)
    await db.commit()
    await db.refresh(p)
    return await get_plan(plan_id, db)


# ---------------------------------------------------------------------------
# TEMPERATURE LOGS
# ---------------------------------------------------------------------------

async def add_temp_log(plan_id: UUID, company_id: UUID, data, db: AsyncSession):
    p = await get_plan(plan_id, db)
    log = RotiseriaTemperatureLog(
        plan_id=plan_id,
        registrado_por=company_id,  # context user id
        **data.model_dump(exclude_none=True),
    )
    if log.temp_min_requerida is not None and log.temp_max_requerida is not None:
        log.conforme = log.temp_min_requerida <= log.temperatura <= log.temp_max_requerida
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def list_temp_logs(plan_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(RotiseriaTemperatureLog)
        .where(RotiseriaTemperatureLog.plan_id == plan_id)
        .order_by(RotiseriaTemperatureLog.registrado_at.desc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# LABELS
# ---------------------------------------------------------------------------

async def generate_labels(plan_id: UUID, company_id: UUID, data: dict, db: AsyncSession):
    p = await get_plan(plan_id, db)
    labels = []
    for label_data in data.get("labels", []):
        label = RotiseriaLabelBatch(
            plan_id=plan_id,
            producto_id=label_data["producto_id"],
            cantidad=label_data["cantidad"],
            lote_codigo=label_data["lote_codigo"],
            fecha_elaboracion=label_data.get("fecha_elaboracion", date.today()),
            fecha_vencimiento=label_data["fecha_vencimiento"],
            alérgenos=label_data.get("alérgenos"),
            precio_unitario=label_data.get("precio_unitario"),
        )
        db.add(label)
        labels.append(label)
    await db.commit()
    for l in labels:
        await db.refresh(l)
    return labels


async def list_labels(plan_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(RotiseriaLabelBatch)
        .where(RotiseriaLabelBatch.plan_id == plan_id)
        .order_by(RotiseriaLabelBatch.created_at.desc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# AUTO MARKDOWN
# ---------------------------------------------------------------------------

async def suggest_markdowns(company_id: UUID, data: dict, db: AsyncSession):
    """Suggest markdowns for rotisería products nearing closing time."""
    now = datetime.utcnow()
    # Find production plans for today that are completed
    result = await db.execute(
        select(RotiseriaProductionPlan).join(RotiseriaRecipe).where(
            RotiseriaRecipe.company_id == company_id,
            RotiseriaProductionPlan.fecha == date.today(),
            RotiseriaProductionPlan.estado == "completado",
        )
    )
    plans = result.scalars().all()
    results = []
    for p in plans:
        # Check recipe time limit
        recipe = p.receta
        if recipe.tiempo_maximo_exhibicion_hs:
            age = (now - p.hora_fin).total_seconds() / 3600 if p.hora_fin else 0
            if age >= float(recipe.tiempo_maximo_exhibicion_hs) * 0.8:
                results.append({
                    "plan_id": str(p.id),
                    "receta": recipe.nombre,
                    "producto_id": str(recipe.producto_terminado_id),
                    "cantidad": float(p.cantidad_producida or 0),
                    "tiempo_exhibicion_hs": round(age, 1),
                    "precio_sugerido_original": float(recipe.precio_sugerido or 0),
                    "descuento_sugerido_pct": float(data.get("descuento_minimo", 20)),
                    "precio_markdown": float(recipe.precio_sugerido or 0) * (1 - float(data.get("descuento_minimo", 20)) / 100),
                    "razon": "Próximo a vencer tiempo de exhibición" if age >= float(recipe.tiempo_maximo_exhibicion_hs) else "Fin de jornada",
                })
    return results


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def rotiseria_dashboard(company_id: UUID, db: AsyncSession):
    today = date.today()
    orders_today = (await db.execute(
        select(func.count()).select_from(RotiseriaProductionPlan).join(RotiseriaRecipe).where(
            RotiseriaRecipe.company_id == company_id,
            RotiseriaProductionPlan.fecha == today,
        )
    )).scalar()
    total_produced = (await db.execute(
        select(func.coalesce(func.sum(RotiseriaProductionPlan.cantidad_producida), 0)).join(RotiseriaRecipe).where(
            RotiseriaRecipe.company_id == company_id,
            RotiseriaProductionPlan.fecha == today,
        )
    )).scalar()
    active_recipes = (await db.execute(
        select(func.count()).select_from(RotiseriaRecipe).where(
            RotiseriaRecipe.company_id == company_id, RotiseriaRecipe.activa == True,
        )
    )).scalar()
    temp_alerts = (await db.execute(
        select(func.count()).select_from(RotiseriaTemperatureLog).where(
            RotiseriaTemperatureLog.conforme == False,
        )
    )).scalar()

    return {
        "ordenes_hoy": orders_today,
        "total_producido_hoy": float(total_produced),
        "recetas_activas": active_recipes,
        "puntos_calientes_activos": 0,
        "temp_fuera_rango": temp_alerts,
        "markdowns_sugeridos": 0,
        "produccion_por_receta": [],
    }
