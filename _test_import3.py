import sys
sys.path.insert(0, '/app')
import time, traceback
t0 = time.time()

def log(msg):
    print(f"{time.time()-t0:.1f}s {msg}", flush=True)

try:
    log("import uuid")
    import uuid
    log("from fastapi import APIRouter, Depends, HTTPException, Query")
    from fastapi import APIRouter, Depends, HTTPException, Query
    log("from sqlalchemy import select, func")
    from sqlalchemy import select, func
    log("from sqlalchemy.ext.asyncio import AsyncSession")
    from sqlalchemy.ext.asyncio import AsyncSession
    log("from api.src.db import get_db")
    from api.src.db import get_db
    log("from api.src.tenants.models import Tenant")
    from api.src.tenants.models import Tenant
    log("from api.src.features.plans import PLANS, get_plan_features, get_all_plans")
    from api.src.features.plans import PLANS, get_plan_features, get_all_plans
    log("from api.src.verticals.presets import get_all_verticals")
    from api.src.verticals.presets import get_all_verticals
    log("from api.src.features.plans import ALL_FEATURES, FEATURE_LABELS")
    from api.src.features.plans import ALL_FEATURES, FEATURE_LABELS
    log("from api.src.auth.middleware import require_auth")
    from api.src.auth.middleware import require_auth
    log("from api.src.common.cache import cache_delete, tenant_features_key")
    from api.src.common.cache import cache_delete, tenant_features_key
    log("Defining require_superadmin...")
    async def require_superadmin(user: dict = Depends(require_auth)) -> dict:
        if not user.get("is_superadmin", False):
            raise HTTPException(status_code=403, detail="Se requieren permisos de superadmin")
        return user
    log("require_superadmin defined OK")
    log("Defining _clear_tenant_cache...")
    async def _clear_tenant_cache(tenant_id: str) -> None:
        await cache_delete(tenant_features_key(tenant_id))
    log("_clear_tenant_cache defined OK")
    log("Creating router...")
    router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
    log("router created OK")
    log("ALL DONE")
except Exception as e:
    traceback.print_exc()
    log(f"ERROR: {e}")
