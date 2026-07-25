"""Client JWT auth — separate from internal staff auth."""

from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from api.src.config import settings
from api.src.db import get_db
from api.src.client_app.models import ClientUser

security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

CLIENT_JWT_SECRET = getattr(settings, "client_jwt_secret", settings.jwt_secret_key)
CLIENT_JWT_ALGORITHM = "HS256"
CLIENT_JWT_EXPIRY_HOURS = 72


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hash_: str) -> bool:
    return pwd_context.verify(password, hash_)


def create_client_token(client_user_id: str, customer_id: str, company_id: str, email: str) -> str:
    payload = {
        "sub": client_user_id,
        "customer_id": customer_id,
        "company_id": company_id,
        "email": email,
        "type": "client_access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=CLIENT_JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, CLIENT_JWT_SECRET, algorithm=CLIENT_JWT_ALGORITHM)


async def require_client(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token requerido")
    try:
        payload = jwt.decode(credentials.credentials, CLIENT_JWT_SECRET, algorithms=[CLIENT_JWT_ALGORITHM])
        if payload.get("type") != "client_access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
        client_id = payload["sub"]
        r = await db.execute(select(ClientUser).where(ClientUser.id == UUID(client_id), ClientUser.activo == True))
        client = r.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cliente no encontrado")
        return {
            "client_user_id": client_id,
            "customer_id": payload["customer_id"],
            "company_id": payload["company_id"],
            "email": payload["email"],
        }
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")
