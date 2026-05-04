"""Tenant API router"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.tenants.models import Tenant
from api.src.tenants.schemas import TenantResponse
from api.src.tenants.service import get_tenant_by_id, get_tenant_by_slug

router = APIRouter(prefix="/api/v1/tenants", tags=["tenants"])


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: str, db: AsyncSession = Depends(get_db)):
    import uuid
    try:
        uid = uuid.UUID(tenant_id)
    except ValueError:
        tenant = await get_tenant_by_slug(db, tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant no encontrado")
        return TenantResponse.model_validate(tenant)

    tenant = await get_tenant_by_id(db, uid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    return TenantResponse.model_validate(tenant)
