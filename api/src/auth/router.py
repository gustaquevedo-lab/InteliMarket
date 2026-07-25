"""Auth API router"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.models import User
from api.src.auth.jwt import hash_password, verify_password, create_access_token, create_refresh_token
from api.src.auth.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from api.src.auth.middleware import get_current_user
from api.src.tenants.service import create_tenant_with_schema, get_user_tenants, get_tenant_by_id
from api.src.tenants.models import UserTenant

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

    access_token = create_access_token({
        "sub": str(tenant.id),
        "user_email": body.email,
        "tenant_id": str(tenant.id),
        "tenant_slug": tenant.slug,
    })
    refresh_token = create_refresh_token({"sub": str(tenant.id)})

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

    # Get user's primary tenant
    ut_result = await db.execute(
        select(UserTenant)
        .where(UserTenant.user_id == user.id, UserTenant.activo == True)
        .order_by(UserTenant.rol.desc())
        .limit(1)
    )
    user_tenant = ut_result.scalar_one_or_none()

    tenant_id = str(user_tenant.tenant_id) if user_tenant else None
    tenant_slug = None
    if tenant_id:
        tenant = await get_tenant_by_id(db, user_tenant.tenant_id)
        if tenant:
            tenant_slug = tenant.slug

    access_token = create_access_token({
        "sub": str(user.id),
        "user_email": user.email,
        "user_nombre": user.nombre,
        "rol": user.rol,
        "is_superadmin": user.is_superadmin or user.rol == "super_admin",
        "tenant_id": tenant_id,
        "tenant_slug": tenant_slug,
    })
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(
    token_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = token_data.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
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
        tenant_id=token_data.get("tenant_id"),
        tenant_slug=token_data.get("tenant_slug"),
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
