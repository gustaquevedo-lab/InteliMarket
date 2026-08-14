"""Auth middleware"""

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.jwt import get_current_user_from_token

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="No se proporcionó token de autenticación")

    try:
        user = get_current_user_from_token(credentials.credentials)
        if "sub" in user and "id" not in user:
            user["id"] = user["sub"]
        if "company_id" not in user:
            user["company_id"] = "00000000-0000-0000-0000-000000000010"
        if "tenant_id" not in user or not user["tenant_id"]:
            user["tenant_id"] = "00000000-0000-0000-0000-000000000001"
        return user
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await get_current_user(credentials, db)