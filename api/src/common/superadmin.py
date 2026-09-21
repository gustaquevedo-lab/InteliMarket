"""Guardia de superadministrador de plataforma.

Confia en el claim del token solo como primer filtro: para cualquier accion
que cambie configuracion se vuelve a leer el usuario en la base, asi un token
viejo de alguien al que se le quito el permiso (o desactivo) deja de servir.
"""
import uuid

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.auth.middleware import require_auth
from api.src.auth.models import User
from api.src.db import get_db


async def require_superadmin(user: dict = Depends(require_auth), db: AsyncSession = Depends(get_db)) -> dict:
    if not user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Solo el superadministrador puede hacer esto")
    try:
        uid = uuid.UUID(str(user.get("id") or user.get("sub")))
    except (ValueError, TypeError):
        raise HTTPException(status_code=403, detail="Solo el superadministrador puede hacer esto")
    row = (await db.execute(select(User.activo, User.is_superadmin, User.rol).where(User.id == uid))).first()
    if not row or not row[0] or not (row[1] or row[2] == "super_admin"):
        raise HTTPException(status_code=403, detail="Solo el superadministrador puede hacer esto")
    return user
