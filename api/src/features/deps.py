"""Feature flag enforcement dependencies."""

import uuid
from functools import lru_cache
from typing import Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.tenants.models import Tenant
from api.src.features.plans import get_plan_features, ALL_FEATURES, FEATURE_LABELS


async def get_tenant_features(
    tenant_id: str,
    db: AsyncSession,
) -> dict:
    """Resolve the effective feature set for a tenant.

    Resolution order:
    1. Tenant config overrides (set by superadmin)
    2. Plan default features
    3. Vertical config defaults

    Returns dict with:
    - features: list of enabled feature keys
    - vertical_slug: current vertical
    - config_defaults: operational config
    - payment_gateways: list of enabled payment gateways
    """
    # Try Redis cache first
    from api.src.common.cache import cache_get, tenant_features_key

    cache_key = tenant_features_key(tenant_id)
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        tid = uuid.UUID(tenant_id)
    except ValueError:
        return {"features": ALL_FEATURES, "vertical_slug": None, "config_defaults": {}, "payment_gateways": []}

    result = await db.execute(select(Tenant).where(Tenant.id == tid))
    tenant = result.scalar_one_or_none()

    if not tenant:
        return {"features": ALL_FEATURES, "vertical_slug": None, "config_defaults": {}, "payment_gateways": []}

    config = tenant.config or {}

    # If tenant has explicit feature overrides, use them
    if config.get("enabled_features"):
        features = config["enabled_features"]
    else:
        # Fall back to plan defaults
        features = get_plan_features(tenant.plan)

    # Payment gateways are separate toggles
    payment_gateways = config.get("payment_gateways", [])

    # Config defaults from vertical
    config_defaults = config.get("config_defaults", {})

    result_dict = {
        "features": features,
        "vertical_slug": config.get("vertical_slug"),
        "config_defaults": config_defaults,
        "payment_gateways": payment_gateways,
        "plan": tenant.plan,
        "estado": tenant.estado,
    }

    # Cache for 5 minutes (tenant features change rarely)
    from api.src.common.cache import cache_set

    await cache_set(cache_key, result_dict, ttl=300)
    return result_dict


def require_feature(feature: str):
    """FastAPI dependency that checks if a feature is enabled for the current tenant.

    Usage:
        @router.get("/crm/leads", dependencies=[Depends(require_feature("crm"))])
        async def list_leads(...):
            ...

    Returns 403 Forbidden if the feature is not enabled.
    """

    async def _check_feature(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ):
        # Extract tenant_id from the request context
        # This can come from:
        # 1. Path param (e.g., /api/v1/tenants/{tenant_id}/...)
        # 2. User JWT claim (user["tenant_id"])
        # 3. Query param (fallback)

        tenant_id = _extract_tenant_id(request)

        if not tenant_id:
            # If we can't determine tenant, allow (public endpoint or misconfigured)
            return

        tenant_config = await get_tenant_features(tenant_id, db)
        enabled_features = tenant_config.get("features", [])

        if feature not in enabled_features:
            feature_name = FEATURE_LABELS.get(feature, feature)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FEATURE_DISABLED",
                    "message": f"El módulo '{feature_name}' no está habilitado para tu cuenta.",
                    "feature": feature,
                    "hint": "Contactá a tu administrador para habilitar este módulo.",
                },
            )

    return _check_feature


def require_payment_gateway(gateway: str):
    """FastAPI dependency that checks if a payment gateway is enabled for the current tenant."""

    async def _check_gateway(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ):
        tenant_id = _extract_tenant_id(request)
        if not tenant_id:
            return

        tenant_config = await get_tenant_features(tenant_id, db)
        payment_gateways = tenant_config.get("payment_gateways", [])

        if gateway not in payment_gateways:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "PAYMENT_GATEWAY_DISABLED",
                    "message": f"La pasarela de pago '{gateway}' no está habilitada para tu cuenta.",
                    "gateway": gateway,
                },
            )

    return _check_gateway


def _extract_tenant_id(request: Request) -> str | None:
    """Extract tenant_id from request context."""
    # Try path params first
    path_params = request.path_params
    if "tenant_id" in path_params:
        return str(path_params["tenant_id"])

    # Try user context (set by auth middleware)
    if hasattr(request.state, "user") and request.state.user:
        user = request.state.user
        if isinstance(user, dict) and user.get("tenant_id"):
            return str(user["tenant_id"])

    # Try query params
    query_params = request.query_params
    if "tenant_id" in query_params:
        return query_params["tenant_id"]

    return None


class FeatureChecker:
    """Utility class for checking features in service layer (not endpoints)."""

    def __init__(self, enabled_features: list[str]):
        self.enabled_features = set(enabled_features)

    def has(self, feature: str) -> bool:
        return feature in self.enabled_features

    def has_any(self, *features: str) -> bool:
        return bool(self.enabled_features & set(features))

    def has_all(self, *features: str) -> bool:
        return set(features).issubset(self.enabled_features)
