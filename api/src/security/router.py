"""Security router"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.security import service

router = APIRouter(prefix="/api/v1/security", tags=["security"])


@router.post("/api-keys")
async def create_api_key(
    label: str = "",
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    key = service.generate_api_key()
    await service.store_api_key(db, user["company_id"], key, label)
    return {"api_key": key, "prefix": key[:10], "label": label or "API Key"}


@router.get("/api-keys")
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_api_keys(db, user["company_id"])


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.revoke_api_key(db, key_id)
    if not ok:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key revoked"}
