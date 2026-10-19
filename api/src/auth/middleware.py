"""Auth middleware"""

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.jwt import get_current_user_from_token

from sqlalchemy import select
from api.src.auth.models import User

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    token_str = None
    if credentials and credentials.credentials:
        token_str = credentials.credentials
    elif request and (request.query_params.get("token") or request.query_params.get("auth_token")):
        token_str = request.query_params.get("token") or request.query_params.get("auth_token")

    if not token_str:
        raise HTTPException(status_code=401, detail="No se proporcionó token de autenticación")

    try:
        user = get_current_user_from_token(token_str)
        if "sub" in user and "id" not in user:
            user["id"] = user["sub"]
        if "company_id" not in user:
            user["company_id"] = "00000000-0000-0000-0000-000000000010"
        if "tenant_id" not in user or not user["tenant_id"]:
            user["tenant_id"] = "00000000-0000-0000-0000-000000000001"

        # ── VALIDACIÓN DE USUARIO ACTIVO ────────────────────────────────────
        user_id = user.get("id")
        if user_id:
            import uuid
            uid = uuid.UUID(str(user_id)) if isinstance(user_id, str) else user_id
            db_res = await db.execute(select(User.activo).where(User.id == uid))
            db_user_row = db_res.first()
            if db_user_row and not db_user_row[0]:
                raise HTTPException(status_code=403, detail="Usuario desactivado")

        return user

    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


async def require_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await get_current_user(request, credentials, db)