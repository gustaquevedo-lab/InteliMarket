"""E-commerce customer auth — separate JWT, same pattern as client_app"""

import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.ecommerce.models import EcommerceCustomer
from api.src.db import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

ECOMMERCE_JWT_SECRET = os.getenv("ECOMMERCE_JWT_SECRET", os.getenv("CLIENT_JWT_SECRET", "ecommerce-secret-change-in-prod"))
ECOMMERCE_JWT_ALGORITHM = "HS256"
ECOMMERCE_JWT_EXPIRY_HOURS = 72


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(customer_id: str, company_id: str, email: str) -> str:
    payload = {
        "sub": customer_id,
        "company_id": company_id,
        "email": email,
        "type": "bearer_ecommerce",
        "exp": datetime.now(timezone.utc) + timedelta(hours=ECOMMERCE_JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, ECOMMERCE_JWT_SECRET, algorithm=ECOMMERCE_JWT_ALGORITHM)


async def require_ecommerce_customer(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: AsyncSession = Depends(get_db),
):
    if not credentials:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, ECOMMERCE_JWT_SECRET, algorithms=[ECOMMERCE_JWT_ALGORITHM])
        if payload.get("type") != "bearer_ecommerce":
            raise HTTPException(401, "Invalid token type")
        return {"id": payload["sub"], "company_id": payload["company_id"], "email": payload["email"]}
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")


async def get_ecommerce_customer_by_email(db: AsyncSession, email: str) -> EcommerceCustomer | None:
    r = await db.execute(select(EcommerceCustomer).where(EcommerceCustomer.email == email))
    return r.scalar_one_or_none()


async def get_ecommerce_customer_by_id(db: AsyncSession, customer_id: str) -> EcommerceCustomer | None:
    r = await db.execute(select(EcommerceCustomer).where(EcommerceCustomer.id == UUID(customer_id)))
    return r.scalar_one_or_none()
