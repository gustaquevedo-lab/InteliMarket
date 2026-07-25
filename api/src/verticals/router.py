"""Verticals router — read-only endpoints for tenants to view their vertical config."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.verticals.presets import (
    get_all_verticals,
    get_vertical,
    VERTICALS,
)
from api.src.features.plans import ALL_FEATURES, FEATURE_LABELS

router = APIRouter(prefix="/api/v1/verticals", tags=["verticals"])


@router.get("")
async def list_verticals():
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
async def list_features():
    return [
        {"key": k, "label": FEATURE_LABELS.get(k, k)}
        for k in ALL_FEATURES
    ]


@router.get("/company")
async def get_company_vertical(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.companies.models import Company
    result = await db.execute(select(Company).where(Company.id == user.get("company_id")))
    company = result.scalar_one_or_none()

    if not company:
        return {"vertical": "custom", "features": ALL_FEATURES, "config": {}}

    cfg = getattr(company, "config", None) or {}
    return {
        "vertical": cfg.get("vertical", "custom"),
        "features": cfg.get("enabled_features", ALL_FEATURES),
        "config": cfg,
    }


@router.put("/company")
async def set_company_vertical(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.companies.models import Company
    vertical_slug = data.get("vertical", "custom")
    vertical = get_vertical(vertical_slug)

    result = await db.execute(select(Company).where(Company.id == user.get("company_id")))
    company = result.scalar_one_or_none()

    if not company:
        return {"error": "Company not found"}

    current_config = company.config or {}

    if vertical_slug != "custom" and vertical:
        current_config["vertical"] = vertical_slug
        current_config["enabled_features"] = vertical.features
        current_config.update(vertical.config_defaults)
    else:
        current_config["vertical"] = data.get("vertical", "custom")
        current_config["enabled_features"] = data.get("enabled_features", ALL_FEATURES)

    company.config = current_config
    await db.commit()

    return {
        "vertical": current_config.get("vertical", "custom"),
        "features": current_config.get("enabled_features", ALL_FEATURES),
        "config": current_config,
    }
