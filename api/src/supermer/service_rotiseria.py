"""Fase 1 — Rotisería service: recipes, production plans, temp logs, labels, markdowns"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import func, and_
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
    q = db.query(RotiseriaRecipe).filter(RotiseriaRecipe.company_id == company_id)
    if activa is not None:
        q = q.filter(RotiseriaRecipe.activa == activa)
    return q.order_by(RotiseriaRecipe.nombre).all()


async def get_recipe(recipe_id: UUID, db: AsyncSession):
    r = db.query(RotiseriaRecipe).options(selectinload(RotiseriaRecipe.items)).get(recipe_id)
    if not r:
        raise HTTPException(404, "Recipe not found")
    return r


async def create_recipe(company_id: UUID, data, db: AsyncSession):
    r = RotiseriaRecipe(
        company_id=company_id,
        **data.model_dump(exclude={"items"}, exclude_none=True),
    )
    db.add(r)
    db.flush()
    for item_data in data.items or []:
        item = RotiseriaRecipeItem(receta_id=r.id, **item_data.model_dump())
        db.add(item)
    db.commit()
    db.refresh(r)
    return await get_recipe(r.id, db)


async def update_recipe(recipe_id: UUID, data, db: AsyncSession):
    r = await get_recipe(recipe_id, db)
    for k, v in data.model_dump(exclude={"items"}, exclude_none=True).items():
        setattr(r, k, v)
    if data.items is not None:
        # Remove old items and replace
        db.query(RotiseriaRecipeItem).filter(RotiseriaRecipeItem.receta_id == recipe_id).delete()
        for item_data in data.items:
            item = RotiseriaRecipeItem(receta_id=recipe_id, **item_data.model_dump())
            db.add(item)
    db.commit()
    db.refresh(r)
    return await get_recipe(r.id, db)


async def delete_recipe(recipe_id: UUID, db: AsyncSession):
    r = await get_recipe(recipe_id, db)
    db.delete(r)
    db.commit()
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
    q = db.query(RotiseriaProductionPlan).join(RotiseriaRecipe).filter(
        RotiseriaRecipe.company_id == company_id,
    )
    if fecha:
        q = q.filter(RotiseriaProductionPlan.fecha == fecha)
    if estado:
        q = q.filter(RotiseriaProductionPlan.estado == estado)
    return q.order_by(RotiseriaProductionPlan.fecha.desc()).all()


async def get_plan(plan_id: UUID, db: AsyncSession):
    p = db.query(RotiseriaProductionPlan).options(
        selectinload(RotiseriaProductionPlan.temperature_logs),
        selectinload(RotiseriaProductionPlan.labels),
    ).get(plan_id)
    if not p:
        raise HTTPException(404, "Production plan not found")
    return p


async def create_plan(company_id: UUID, data, db: AsyncSession):
    # Verify recipe exists and belongs to company
    recipe = db.query(RotiseriaRecipe).filter(
        RotiseriaRecipe.id == data.receta_id,
        RotiseriaRecipe.company_id == company_id,
    ).first()
    if not recipe:
        raise HTTPException(404, "Recipe not found for this company")
    p = RotiseriaProductionPlan(
        **data.model_dump(exclude_none=True),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return await get_plan(p.id, db)


async def update_plan(plan_id: UUID, data, db: AsyncSession):
    p = await get_plan(plan_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    if p.estado == "completado" and not p.hora_fin:
        p.hora_fin = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return await get_plan(plan_id, db)


async def complete_plan(plan_id: UUID, data: dict, db: AsyncSession):
    p = await get_plan(plan_id, db)
    p.estado = "completado"
    p.cantidad_producida = data.get("cantidad_producida", p.cantidad_objetivo)
    p.hora_fin = datetime.utcnow()
    p.notas = data.get("notas", p.notas)
    db.commit()
    db.refresh(p)
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
    db.commit()
    db.refresh(log)
    return log


async def list_temp_logs(plan_id: UUID, db: AsyncSession):
    return db.query(RotiseriaTemperatureLog).filter(
        RotiseriaTemperatureLog.plan_id == plan_id,
    ).order_by(RotiseriaTemperatureLog.registrado_at.desc()).all()


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
    db.commit()
    for l in labels:
        db.refresh(l)
    return labels


async def list_labels(plan_id: UUID, db: AsyncSession):
    return db.query(RotiseriaLabelBatch).filter(
        RotiseriaLabelBatch.plan_id == plan_id,
    ).order_by(RotiseriaLabelBatch.created_at.desc()).all()


# ---------------------------------------------------------------------------
# AUTO MARKDOWN
# ---------------------------------------------------------------------------

async def suggest_markdowns(company_id: UUID, data: dict, db: AsyncSession):
    """Suggest markdowns for rotisería products nearing closing time."""
    now = datetime.utcnow()
    # Find production plans for today that are completed
    plans = db.query(RotiseriaProductionPlan).join(RotiseriaRecipe).filter(
        RotiseriaRecipe.company_id == company_id,
        RotiseriaProductionPlan.fecha == date.today(),
        RotiseriaProductionPlan.estado == "completado",
    ).all()
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
    orders_today = db.query(RotiseriaProductionPlan).join(RotiseriaRecipe).filter(
        RotiseriaRecipe.company_id == company_id,
        RotiseriaProductionPlan.fecha == today,
    ).count()
    total_produced = db.query(func.coalesce(func.sum(RotiseriaProductionPlan.cantidad_producida), 0)).join(RotiseriaRecipe).filter(
        RotiseriaRecipe.company_id == company_id,
        RotiseriaProductionPlan.fecha == today,
    ).scalar()
    active_recipes = db.query(RotiseriaRecipe).filter(
        RotiseriaRecipe.company_id == company_id, RotiseriaRecipe.activa == True,
    ).count()
    temp_alerts = db.query(RotiseriaTemperatureLog).filter(
        RotiseriaTemperatureLog.conforme == False,
    ).count()

    return {
        "ordenes_hoy": orders_today,
        "total_producido_hoy": float(total_produced),
        "recetas_activas": active_recipes,
        "puntos_calientes_activos": 0,
        "temp_fuera_rango": temp_alerts,
        "markdowns_sugeridos": 0,
        "produccion_por_receta": [],
    }
