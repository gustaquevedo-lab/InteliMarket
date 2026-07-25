"""Tenant admin API router — Super Admin panel for managing tenants, plans, verticals, and features."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.tenants.models import Tenant
from api.src.tenants.schemas import TenantResponse
from api.src.features.plans import PLANS, get_plan_features, get_all_plans
from api.src.verticals.presets import (
    get_all_verticals,
    get_vertical,
    get_features_for_vertical,
    get_config_defaults_for_vertical,
    get_payment_gateways_for_vertical,
    VERTICALS,
)
from api.src.features.plans import ALL_FEATURES, FEATURE_LABELS

from api.src.auth.middleware import require_auth
from api.src.common.cache import cache_delete, tenant_features_key


async def require_superadmin(user: dict = Depends(require_auth)) -> dict:
    if not user.get("is_superadmin", False):
        raise HTTPException(status_code=403, detail="Se requieren permisos de superadmin")
    return user


async def _clear_tenant_cache(tenant_id: str) -> None:
    await cache_delete(tenant_features_key(tenant_id))


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# ============================================================
# TENANT LISTING
# ============================================================

@router.get("/tenants")
async def list_tenants(
    estado: str | None = Query(None),
    plan: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    _: dict = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Tenant)
    if estado:
        query = query.where(Tenant.estado == estado)
    if plan:
        query = query.where(Tenant.plan == plan)
    if search:
        query = query.where(
            (Tenant.nombre.ilike(f"%{search}%")) |
            (Tenant.slug.ilike(f"%{search}%"))
        )
    query = query.order_by(Tenant.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    tenants = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "nombre": t.nombre,
            "slug": t.slug,
            "plan": t.plan,
            "estado": t.estado,
            "schema_name": t.schema_name,
            "fecha_inicio": t.fecha_inicio,
            "fecha_fin": t.fecha_fin,
            "config": t.config,
            "created_at": t.created_at,
        }
        for t in tenants
    ]


@router.get("/tenants/stats")
async def get_tenant_stats(
    _: dict = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(func.count(Tenant.id)))
    total = result.scalar() or 0

    result = await db.execute(select(Tenant.plan, func.count(Tenant.id)).group_by(Tenant.plan))
    by_plan = dict(result.all())

    result = await db.execute(select(Tenant.estado, func.count(Tenant.id)).group_by(Tenant.estado))
    by_estado = dict(result.all())

    total_mrr = sum(
        PLANS.get(plan, {}).get("precio_mensual_usd", 0) * count
        for plan, count in by_plan.items()
    )

    return {
        "total_tenants": total,
        "by_plan": by_plan,
        "by_estado": by_estado,
        "mrr_usd": total_mrr,
    }


# ============================================================
# PLANS
# ============================================================

@router.get("/plans")
async def list_plans(
    _: dict = Depends(require_superadmin),
):
    return get_all_plans()


@router.patch("/tenants/{tenant_id}/plan")
async def update_tenant_plan(
    tenant_id: str,
    body: dict,
    _: dict = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    new_plan = body.get("plan")
    if new_plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Plan inválido. Opciones: {', '.join(PLANS.keys())}")

    try:
        tid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")

    result = await db.execute(select(Tenant).where(Tenant.id == tid))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    old_plan = tenant.plan
    tenant.plan = new_plan

    # Auto-update features to match new plan (if no custom overrides)
    existing_config = tenant.config or {}
    if not existing_config.get("custom_features"):
        tenant.config = {**existing_config, "enabled_features": get_plan_features(new_plan)}

    await db.commit()
    await db.refresh(tenant)
    await _clear_tenant_cache(str(tenant.id))

    return {
        "tenant_id": str(tenant.id),
        "old_plan": old_plan,
        "new_plan": new_plan,
        "plan_details": PLANS[new_plan],
    }


@router.patch("/tenants/{tenant_id}/estado")
async def update_tenant_estado(
    tenant_id: str,
    body: dict,
    _: dict = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    new_estado = body.get("estado")
    if new_estado not in ("activo", "suspendido", "cancelado"):
        raise HTTPException(status_code=400, detail="Estado inválido")

    try:
        tid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")

    result = await db.execute(select(Tenant).where(Tenant.id == tid))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    tenant.estado = new_estado
    await db.commit()
    await db.refresh(tenant)

    return {"tenant_id": str(tenant.id), "estado": new_estado}


# ============================================================
# VERTICAL & FEATURE MANAGEMENT (per tenant)
# ============================================================

@router.get("/verticals")
async def list_verticals(
    _: dict = Depends(require_superadmin),
):
    return [
        {
            "slug": v.slug,
            "nombre": v.nombre,
            "descripcion": v.descripcion,
            "features": v.features,
            "config_defaults": v.config_defaults,
            "payment_gateways": v.payment_gateways,
            "icon": v.icon,
        }
        for v in get_all_verticals()
    ]


@router.get("/features")
async def list_features(
    _: dict = Depends(require_superadmin),
):
    return [
        {"key": k, "label": FEATURE_LABELS.get(k, k)}
        for k in ALL_FEATURES
    ]


@router.get("/tenants/me/config", tags=["admin"])
async def get_my_tenant_config(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get the vertical/features/payment-gateway config for the caller's own tenant.

    Unlike GET /tenants/{tenant_id}/config, this does not require superadmin —
    any authenticated user needs their own tenant's enabled features to render
    the correct menu/routes for their vertical. Must be registered before the
    dynamic /tenants/{tenant_id}/config route or "me" would be parsed as a tenant_id.
    """
    try:
        tid = uuid.UUID(user["tenant_id"])
    except (ValueError, KeyError):
        raise HTTPException(status_code=400, detail="Tenant inválido")

    result = await db.execute(select(Tenant).where(Tenant.id == tid))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    config = tenant.config or {}

    return {
        "tenant_id": str(tenant.id),
        "vertical_slug": config.get("vertical_slug"),
        "enabled_features": config.get("enabled_features", get_plan_features(tenant.plan)),
        "payment_gateways": config.get("payment_gateways", []),
        "plan": tenant.plan,
    }


@router.get("/tenants/{tenant_id}/config")
async def get_tenant_config(
    tenant_id: str,
    _: dict = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Get the vertical, features, and payment gateway config for a tenant."""
    try:
        tid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")

    result = await db.execute(select(Tenant).where(Tenant.id == tid))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    config = tenant.config or {}

    return {
        "tenant_id": str(tenant.id),
        "tenant_nombre": tenant.nombre,
        "plan": tenant.plan,
        "vertical_slug": config.get("vertical_slug"),
        "enabled_features": config.get("enabled_features", get_plan_features(tenant.plan)),
        "payment_gateways": config.get("payment_gateways", []),
        "config_defaults": config.get("config_defaults", {}),
        "custom_features": config.get("custom_features", False),
    }


@router.put("/tenants/{tenant_id}/config")
async def update_tenant_config(
    tenant_id: str,
    body: dict,
    _: dict = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Set the vertical, features, and payment gateway config for a tenant.

    Body:
    - vertical_slug: slug of the vertical preset (e.g., "farmacia")
    - enabled_features: list of feature keys (overrides vertical defaults)
    - payment_gateways: list of payment gateway keys
    - config_defaults: operational config overrides
    - custom_features: bool, if true, features are manually managed
    """
    try:
        tid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")

    result = await db.execute(select(Tenant).where(Tenant.id == tid))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    existing = tenant.config or {}

    vertical_slug = body.get("vertical_slug", existing.get("vertical_slug", "custom"))
    custom_features = body.get("custom_features", False)

    # If a vertical is set and features are not custom, use vertical defaults
    if vertical_slug and vertical_slug != "custom" and not custom_features:
        vertical = get_vertical(vertical_slug)
        if not vertical:
            raise HTTPException(status_code=400, detail=f"Vertical '{vertical_slug}' no existe")
        new_config = {
            "vertical_slug": vertical_slug,
            "enabled_features": list(vertical.features),
            "config_defaults": dict(vertical.config_defaults),
            "payment_gateways": list(vertical.payment_gateways),
            "custom_features": False,
        }
    else:
        # Custom mode: use provided features
        new_config = {
            "vertical_slug": vertical_slug,
            "custom_features": True,
            "enabled_features": body.get("enabled_features", existing.get("enabled_features", [])),
            "payment_gateways": body.get("payment_gateways", existing.get("payment_gateways", [])),
            "config_defaults": body.get("config_defaults", existing.get("config_defaults", {})),
        }

    tenant.config = new_config
    await db.commit()
    await db.refresh(tenant)
    await _clear_tenant_cache(str(tenant.id))

    return {
        "tenant_id": str(tenant.id),
        "tenant_nombre": tenant.nombre,
        "plan": tenant.plan,
        "vertical_slug": new_config["vertical_slug"],
        "enabled_features": new_config["enabled_features"],
        "payment_gateways": new_config["payment_gateways"],
        "config_defaults": new_config["config_defaults"],
        "custom_features": new_config["custom_features"],
    }


@router.post("/tenants/{tenant_id}/config/reset")
async def reset_tenant_config(
    tenant_id: str,
    _: dict = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Reset tenant config to plan defaults."""
    try:
        tid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")

    result = await db.execute(select(Tenant).where(Tenant.id == tid))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    config = {
        "enabled_features": get_plan_features(tenant.plan),
        "payment_gateways": [],
        "config_defaults": {},
        "custom_features": False,
    }
    tenant.config = config
    await db.commit()
    await _clear_tenant_cache(str(tenant.id))

    return {
        "tenant_id": str(tenant.id),
        "message": "Configuración restablecida a valores del plan",
        "config": config,
    }
