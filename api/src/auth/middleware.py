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

        # ── VALIDACIÓN DE SESIÓN ÚNICA ACTIVA (solo para cajeros POS) ───────
        token_sid = user.get("sid")
        user_id = user.get("id")
        user_rol = user.get("rol")
        if token_sid and user_id and user_rol == "cajero":
            import uuid
            uid = uuid.UUID(str(user_id)) if isinstance(user_id, str) else user_id
            db_res = await db.execute(select(User.current_session_id, User.activo).where(User.id == uid))
            db_user_row = db_res.first()
            if db_user_row:
                active_sid, is_active = db_user_row
                if not is_active:
                    raise HTTPException(status_code=403, detail="Usuario desactivado")
                if active_sid and active_sid != token_sid:
                    raise HTTPException(
                        status_code=401,
                        detail="Esta sesión fue cerrada porque el usuario inició sesión en otra terminal o caja."
                    )

        return user
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await get_current_user(credentials, db)