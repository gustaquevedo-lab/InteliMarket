"""JWT authentication for Supplier Portal users (separate from internal staff auth)."""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

SUPPLIER_JWT_SECRET = os.getenv("SUPPLIER_JWT_SECRET", settings.jwt_secret_key)
SUPPLIER_JWT_ALGORITHM = "HS256"
SUPPLIER_JWT_EXPIRY_HOURS = 72


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_supplier_token(supplier_user_id: str, supplier_id: str, company_id: str, email: str) -> str:
    payload = {
        "sub": supplier_user_id,
        "supplier_id": supplier_id,
        "company_id": company_id,
        "email": email,
        "type": "bearer_supplier",
        "exp": datetime.now(timezone.utc) + timedelta(hours=SUPPLIER_JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SUPPLIER_JWT_SECRET, algorithm=SUPPLIER_JWT_ALGORITHM)


async def require_supplier(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> dict:
    """Dependency: requires valid supplier JWT token. Returns token payload."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Se requiere autenticación")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SUPPLIER_JWT_SECRET, algorithms=[SUPPLIER_JWT_ALGORITHM])
        if payload.get("type") != "bearer_supplier":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
        return {
            "supplier_user_id": payload["sub"],
            "supplier_id": payload["supplier_id"],
            "company_id": payload["company_id"],
            "email": payload["email"],
        }
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")
