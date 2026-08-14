"""Auth API router"""

import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.models import User
from api.src.auth.jwt import hash_password, verify_password, create_access_token, create_refresh_token
from api.src.auth.schemas import (
    LoginRequest, RegisterRequest, TokenResponse, UserResponse,
    ChangePasswordRequest, ResetPasswordRequest, ResetPasswordResponse,
    AdminCreateUserRequest, AdminCreateUserResponse, UpdateUserRequest, TenantUserResponse,
    VerifySupervisorRequest, VerifySupervisorResponse,
)
from api.src.auth.middleware import get_current_user
from api.src.tenants.service import create_tenant_with_schema, get_user_tenants, get_tenant_by_id
from api.src.tenants.models import UserTenant

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _is_tenant_admin(token_data: dict) -> bool:
    # Admin de plataforma (is_superadmin real) o admin del propio tenant
    # (rol="admin" en users, el rol con el que se crean las cuentas admin de cada cliente).
    return bool(token_data.get("is_superadmin", False) or token_data.get("rol") == "admin")


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
        .where(UserTenant.user_id == user.id)
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


@router.post("/verify-supervisor", response_model=VerifySupervisorResponse)
async def verify_supervisor(
    body: VerifySupervisorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Verifica credenciales reales para autorizar una accion sensible en POS
    (anular item, aplicar descuento, cancelar venta, retiro de caja, confirmar
    entrega de efectivo) sin abrir una sesion nueva ni cerrar la del cajero.
    Requiere que quien llama ya este logueado (no es un endpoint anonimo) para
    no habilitar fuerza bruta. Ademas de la clave, exige que la cuenta tenga
    nivel de supervisor/admin — antes cualquier password valido alcanzaba,
    lo que permitia que un cajero se "auto-autorizara" con su propio login."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not user.activo or not verify_password(body.password, user.password_hash):
        return VerifySupervisorResponse(valid=False)

    if user.rol != "admin" and not user.is_superadmin:
        return VerifySupervisorResponse(valid=False)

    return VerifySupervisorResponse(valid=True, id=str(user.id), nombre=user.nombre, rol=user.rol)


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


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    token_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = token_data.get("sub") or token_data.get("id")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Contraseña actual incorrecta")

    await db.execute(
        update(User).where(User.id == user.id).values(password_hash=hash_password(body.new_password))
    )
    await db.commit()
    return {"message": "Contraseña actualizada"}


@router.post("/users/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    user_id: str,
    body: ResetPasswordRequest,
    token_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _is_tenant_admin(token_data):
        raise HTTPException(status_code=403, detail="Solo administradores pueden resetear contraseñas")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    generated = None
    new_password = body.new_password
    if not new_password:
        generated = secrets.token_urlsafe(9)
        new_password = generated

    await db.execute(
        update(User).where(User.id == user.id).values(password_hash=hash_password(new_password))
    )
    await db.commit()

    return ResetPasswordResponse(
        temporary_password=generated,
        message="Contraseña reseteada" if not generated else "Contraseña temporal generada",
    )


@router.get("/users", response_model=list[TenantUserResponse])
async def list_tenant_users(
    token_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _is_tenant_admin(token_data):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver usuarios")

    tenant_id = token_data.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Token sin tenant_id")

    result = await db.execute(
        select(User, UserTenant.rol)
        .join(UserTenant, UserTenant.user_id == User.id)
        .where(UserTenant.tenant_id == tenant_id)
        .order_by(User.nombre)
    )
    rows = result.all()

    role_names_by_user: dict[str, list[str]] = {}
    if rows:
        rbac_result = await db.execute(
            text("""
                SELECT ur.user_id, r.name
                FROM rbac_user_roles ur
                JOIN rbac_roles r ON r.id = ur.role_id
                WHERE ur.tenant_id = :tenant_id
            """),
            {"tenant_id": tenant_id},
        )
        for uid, role_name in rbac_result.all():
            role_names_by_user.setdefault(str(uid), []).append(role_name)

    return [
        TenantUserResponse(
            id=user.id,
            email=user.email,
            nombre=user.nombre,
            telefono=user.telefono,
            rol=user.rol,
            activo=user.activo,
            is_superadmin=user.is_superadmin or False,
            last_login=user.last_login,
            created_at=user.created_at,
            tenant_rol=tenant_rol,
            role_names=role_names_by_user.get(str(user.id), []),
        )
        for user, tenant_rol in rows
    ]


@router.post("/users", response_model=AdminCreateUserResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    body: AdminCreateUserRequest,
    token_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _is_tenant_admin(token_data):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear usuarios")

    tenant_id = token_data.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Token sin tenant_id")

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email ya registrado")

    generated = None
    password = body.password
    if not password:
        generated = secrets.token_urlsafe(9)
        password = generated

    user = User(
        email=body.email,
        password_hash=hash_password(password),
        nombre=body.nombre,
        telefono=body.telefono,
        rol=body.rol,
    )
    db.add(user)
    await db.flush()

    user_tenant = UserTenant(user_id=user.id, tenant_id=tenant_id, rol=body.rol)
    db.add(user_tenant)

    if body.role_id:
        await db.execute(
            text("""
                INSERT INTO rbac_user_roles (user_id, tenant_id, role_id)
                VALUES (:user_id, :tenant_id, :role_id)
                ON CONFLICT DO NOTHING
            """),
            {"user_id": str(user.id), "tenant_id": tenant_id, "role_id": str(body.role_id)},
        )

    await db.commit()

    return AdminCreateUserResponse(
        id=user.id,
        email=user.email,
        nombre=user.nombre,
        rol=user.rol,
        temporary_password=generated,
    )


@router.patch("/users/{user_id}", response_model=TenantUserResponse)
async def admin_update_user(
    user_id: str,
    body: UpdateUserRequest,
    token_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _is_tenant_admin(token_data):
        raise HTTPException(status_code=403, detail="Solo administradores pueden editar usuarios")

    tenant_id = token_data.get("tenant_id")
    ut_result = await db.execute(
        select(UserTenant).where(UserTenant.user_id == user_id, UserTenant.tenant_id == tenant_id)
    )
    user_tenant = ut_result.scalar_one_or_none()
    if not user_tenant:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en este tenant")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    values = {}
    if body.nombre is not None:
        values["nombre"] = body.nombre
    if body.telefono is not None:
        values["telefono"] = body.telefono
    if body.activo is not None:
        values["activo"] = body.activo
    if body.rol is not None:
        values["rol"] = body.rol
        user_tenant.rol = body.rol

    if values:
        await db.execute(update(User).where(User.id == user.id).values(**values))
    await db.commit()

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    rbac_result = await db.execute(
        text("""
            SELECT r.name FROM rbac_user_roles ur
            JOIN rbac_roles r ON r.id = ur.role_id
            WHERE ur.user_id = :user_id AND ur.tenant_id = :tenant_id
        """),
        {"user_id": str(user_id), "tenant_id": tenant_id},
    )
    role_names = [row[0] for row in rbac_result.all()]

    return TenantUserResponse(
        id=user.id,
        email=user.email,
        nombre=user.nombre,
        telefono=user.telefono,
        rol=user.rol,
        activo=user.activo,
        is_superadmin=user.is_superadmin or False,
        last_login=user.last_login,
        created_at=user.created_at,
        tenant_rol=user_tenant.rol,
        role_names=role_names,
    )
