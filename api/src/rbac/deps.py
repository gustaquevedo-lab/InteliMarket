"""RBAC dependencies"""

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.rbac import service


def require_permission(permission: str):
    async def check(
        user: dict = Depends(require_auth),
        db: AsyncSession = Depends(get_db),
    ):
        if user.get("is_superadmin", False):
            return user

        allowed = await service.check_permission(
            db, uuid.UUID(user["id"]), uuid.UUID(user["tenant_id"]), permission
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="No tienes permiso para esta acción")
        return user
    return check