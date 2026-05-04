"""Auth API router"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.models import User
from api.src.auth.jwt import hash_password, verify_password, create_access_token, create_refresh_token
from api.src.auth.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from api.src.tenants.service import create_tenant_with_schema, get_user_tenants, get_tenant_by_id

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email ya registrado")

    tenant = await create_tenant_with_schema(
        db=db,
        nombre=body.tenant_nombre,
        slug=body.slug if hasattr(body, "slug") else body.tenant_nombre.lower().replace(" ", "-"),
        user_email=body.email,
        user_password=body.password,
        user_nombre=body.nombre,
    )

    await db.commit()

    access_token = create_access_token({"sub": body.email, "user_email": body.email})
    refresh_token = create_refresh_token({"sub": body.email})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    if not user.activo:
        raise HTTPException(status_code=403, detail="Usuario desactivado")

    await db.execute(
        update(User).where(User.id == user.id).values(last_login=datetime.now(timezone.utc))
    )
    await db.commit()

    access_token = create_access_token({"sub": str(user.id), "user_email": user.email, "rol": user.rol})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(
    email: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UserResponse(
        id=user.id,
        email=user.email,
        nombre=user.nombre,
        telefono=user.telefono,
        rol=user.rol,
        activo=user.activo,
        created_at=user.created_at,
    )


@router.get("/me/tenants")
async def get_my_tenants(
    email: str,
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user_tenants = await get_user_tenants(db, user.id)
    result = []
    for ut in user_tenants:
        tenant = await get_tenant_by_id(db, ut.tenant_id)
        if tenant:
            result.append({
                "tenant_id": str(tenant.id),
                "tenant_nombre": tenant.nombre,
                "tenant_slug": tenant.slug,
                "plan": tenant.plan,
                "rol": ut.rol,
            })
    return result
