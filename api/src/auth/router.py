"""Auth API router"""

import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select, update, text
from sqlalchemy.sql import func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.models import User, StaffShift
from api.src.auth.jwt import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from api.src.auth.schemas import (
    LoginRequest, RegisterRequest, TokenResponse, UserResponse,
    ChangePasswordRequest, ResetPasswordRequest, ResetPasswordResponse,
    AdminCreateUserRequest, AdminCreateUserResponse, UpdateUserRequest, TenantUserResponse,
    VerifySupervisorRequest, VerifySupervisorResponse,
    PosStaffItem, PosStaffListResponse, ActiveSupervisorResponse,
)
from api.src.auth.middleware import get_current_user
from api.src.tenants.service import create_tenant_with_schema, get_user_tenants, get_tenant_by_id
from api.src.tenants.models import UserTenant

router = APIRouter(prefix="/v1/auth", tags=["auth"])



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
    clean_input = (body.email or "").strip().lower()
    auto_email = f"{clean_input}@intelimarket.com.py" if "@" not in clean_input else clean_input

    from sqlalchemy import or_
    result = await db.execute(
        select(User).where(
            or_(
                func.lower(User.email) == clean_input,
                func.lower(User.email) == auto_email,
                func.lower(User.nombre) == clean_input,
                # Soportar variantes con y/i (ej: evelyn vs evelin)
                func.lower(User.email) == clean_input.replace("evelyn", "evelin"),
                func.lower(User.email) == auto_email.replace("evelyn", "evelin"),
            )
        )
    )
    user = result.scalars().first()


    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales invalidas")


    if not user.activo:
        raise HTTPException(status_code=403, detail="Usuario desactivado")

    # Generar token único de sesión activa para invalidar sesiones concurrentes
    session_id = secrets.token_hex(16)

    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(
            last_login=datetime.now(timezone.utc),
            current_session_id=session_id
        )
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
        "sid": session_id,
        "user_email": user.email,
        "user_nombre": user.nombre,
        "rol": user.rol,
        "is_superadmin": user.is_superadmin or user.rol == "super_admin",
        "tenant_id": tenant_id,
        "tenant_slug": tenant_slug,
    })
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token_endpoint(body: dict, db: AsyncSession = Depends(get_db)):
    raw_token = body.get("refresh_token")
    if not raw_token:
        raise HTTPException(status_code=400, detail="Falta refresh_token")
    try:
        payload = decode_token(raw_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Token no es de tipo refresh")
        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.activo:
            raise HTTPException(status_code=401, detail="Usuario inactivo o no encontrado")

        tenant_id = None
        tenant_slug = None
        user_tenants = await get_user_tenants(db, user.id)
        if user_tenants:
            primary = next((t for t in user_tenants if t.is_default), user_tenants[0])
            tenant = await get_tenant_by_id(db, primary.tenant_id)
            if tenant:
                tenant_id = str(tenant.id)
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
        new_refresh = create_refresh_token({"sub": str(user.id)})
        return TokenResponse(access_token=access_token, refresh_token=new_refresh)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token de refresco inválido o expirado")



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

    if user.rol not in ("admin", "supervisor") and not user.is_superadmin:
        return VerifySupervisorResponse(valid=False)

    return VerifySupervisorResponse(valid=True, id=str(user.id), nombre=user.nombre, rol=user.rol)


@router.get("/pos-staff", response_model=PosStaffListResponse)
async def list_pos_staff(db: AsyncSession = Depends(get_db)):
    """Lista publica (sin login previo) de cajeros/supervisores activos, para
    el selector de la pantalla de login de Electron -- reemplaza tener que
    tipear el usuario. Solo expone id/email/nombre/rol/foto (nunca password
    ni nada sensible); el login real sigue exigiendo contraseña."""
    result = await db.execute(
        select(User)
        .where(User.rol.in_(["cajero", "supervisor"]), User.activo == True)
        .order_by(User.nombre)
    )
    users = result.scalars().all()
    if not users:
        return PosStaffListResponse(staff=[])

    shifts_result = await db.execute(
        select(StaffShift.user_id).where(StaffShift.ended_at.is_(None))
    )
    on_shift_ids = {str(uid) for (uid,) in shifts_result.all()}

    return PosStaffListResponse(staff=[
        PosStaffItem(
            id=str(u.id), email=u.email, nombre=u.nombre, rol=u.rol,
            foto_url=u.foto_url, en_turno=str(u.id) in on_shift_ids,
        )
        for u in users
    ])


@router.get("/pos-supervisors", response_model=PosStaffListResponse)
async def list_pos_supervisors(db: AsyncSession = Depends(get_db)):
    """Lista publica (sin login previo) de supervisores activos, para el
    selector de la pantalla de login de la PWA de supervisora -- mismo
    espiritu que /pos-staff pero sin cajeros, para que la supervisora elija
    su nombre en vez de tipear un email largo. Solo rol supervisor -- a
    diferencia de /pos-authorizers (usado DENTRO del POS ya logueado para
    elegir quien autoriza una accion), esta pantalla es especificamente
    el panel de supervisoras, no de administradores."""
    result = await db.execute(
        select(User)
        .where(User.rol == "supervisor", User.activo == True)
        .order_by(User.nombre)
    )
    users = result.scalars().all()
    return PosStaffListResponse(staff=[
        PosStaffItem(id=str(u.id), email=u.email, nombre=u.nombre, rol=u.rol, foto_url=u.foto_url, en_turno=False)
        for u in users
    ])


@router.get("/pos-authorizers", response_model=PosStaffListResponse)
async def list_pos_authorizers(
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(get_current_user),
):
    """Lista de usuarios con nivel supervisor/admin/gerente, para el selector del
    modal de autorización de acciones sensibles dentro del POS (anular item,
    devolución, etc)."""
    result = await db.execute(
        select(User)
        .where(
            (User.rol.in_(["supervisor", "admin", "gerente"])) | (User.is_superadmin == True),
            User.activo == True,
        )
        .order_by(User.nombre)
    )
    users = result.scalars().all()
    return PosStaffListResponse(staff=[
        PosStaffItem(id=str(u.id), email=u.email, nombre=u.nombre, rol=u.rol, foto_url=u.foto_url, en_turno=False)
        for u in users
    ])


@router.post("/pos-shift/start")
async def start_pos_shift(
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(get_current_user),
):
    """Marca el inicio de turno del usuario ya autenticado (llamar justo
    despues de un login exitoso desde Electron). Si ya tenia un turno abierto
    (ej. cerro la app sin marcar salida), lo reutiliza en vez de duplicar."""
    user_id = token_data.get("sub")
    existing = await db.execute(
        select(StaffShift).where(StaffShift.user_id == user_id, StaffShift.ended_at.is_(None))
    )
    shift = existing.scalar_one_or_none()
    if shift:
        return {"shift_id": str(shift.id), "started_at": shift.started_at, "reused": True}

    shift = StaffShift(user_id=user_id, rol_en_turno=token_data.get("rol") or "cajero")
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return {"shift_id": str(shift.id), "started_at": shift.started_at, "reused": False}


@router.post("/pos-shift/end")
async def end_pos_shift(
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(get_current_user),
):
    user_id = token_data.get("sub")
    await db.execute(
        update(StaffShift)
        .where(StaffShift.user_id == user_id, StaffShift.ended_at.is_(None))
        .values(ended_at=func.now())
    )
    await db.commit()
    return {"success": True}


@router.get("/pos-active-supervisor", response_model=ActiveSupervisorResponse)
async def get_active_supervisor(
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(get_current_user),
):
    """Verifica si hay un supervisor con turno activo o autorizadores disponibles en el sistema
    para habilitar el flujo de autorización de acciones sensibles en el POS (devoluciones, anulaciones, etc)."""
    # 1. Buscar si hay algún usuario con turno abierto que sea supervisor, admin o gerente
    result = await db.execute(
        select(User.nombre)
        .join(StaffShift, StaffShift.user_id == User.id)
        .where(
            StaffShift.ended_at.is_(None),
            (StaffShift.rol_en_turno.in_(["supervisor", "admin", "gerente"])) | (User.rol.in_(["supervisor", "admin", "gerente"])) | (User.is_superadmin == True),
            User.activo == True
        )
        .limit(1)
    )
    row = result.first()
    if row:
        return ActiveSupervisorResponse(has_supervisor=True, nombre=row[0])
    
    # 2. Si no hay turno abierto registrado pero existen supervisores/administradores activos en la empresa:
    user_res = await db.execute(
        select(User.nombre)
        .where(
            (User.rol.in_(["supervisor", "admin", "gerente"])) | (User.is_superadmin == True),
            User.activo == True
        )
        .order_by(User.rol == "supervisor", User.created_at.asc())
        .limit(1)
    )
    user_row = user_res.first()
    if user_row:
        return ActiveSupervisorResponse(has_supervisor=True, nombre=user_row[0])

    return ActiveSupervisorResponse(has_supervisor=False)


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
        foto_url=user.foto_url,
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
            foto_url=user.foto_url,
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
        foto_url=body.foto_url,
        activo=True,
    )
    db.add(user)
    await db.flush()

    user_tenant = UserTenant(
        user_id=user.id,
        tenant_id=tenant_id,
        rol=body.rol,
    )
    db.add(user_tenant)

    if body.role_id:
        await db.execute(
            text("""
                INSERT INTO rbac_user_roles (user_id, role_id, tenant_id)
                VALUES (:user_id, :role_id, :tenant_id)
                ON CONFLICT DO NOTHING
            """),
            {"user_id": str(user.id), "role_id": str(body.role_id), "tenant_id": tenant_id},
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

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    tenant_id = token_data.get("tenant_id")
    user_tenant = None
    if tenant_id:
        ut_result = await db.execute(
            select(UserTenant).where(UserTenant.user_id == user_id, UserTenant.tenant_id == tenant_id)
        )
        user_tenant = ut_result.scalar_one_or_none()

    values = {}
    if body.nombre is not None:
        values["nombre"] = body.nombre
    if body.telefono is not None:
        values["telefono"] = body.telefono
    if body.activo is not None:
        values["activo"] = body.activo
    if body.rol is not None:
        values["rol"] = body.rol
        if user_tenant:
            user_tenant.rol = body.rol
    if body.foto_url is not None:
        values["foto_url"] = body.foto_url

    if values:
        await db.execute(update(User).where(User.id == user.id).values(**values))
    await db.commit()

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    role_names = []
    if tenant_id:
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
        foto_url=user.foto_url,
        is_superadmin=user.is_superadmin or False,
        last_login=user.last_login,
        created_at=user.created_at,
        tenant_rol=user_tenant.rol if user_tenant else user.rol,
        role_names=role_names,
    )


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    token_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Elimina permanentemente un usuario o lo desactiva si tiene referencias históricas."""
    if not _is_tenant_admin(token_data):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar usuarios")

    current_uid = str(token_data.get("user_id") or token_data.get("sub") or "")
    if current_uid and str(user_id) == current_uid:
        raise HTTPException(status_code=400, detail="No puede eliminar su propia cuenta de usuario en uso actual.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    try:
        await db.execute(text("DELETE FROM rbac_user_roles WHERE user_id = :uid"), {"uid": str(user_id)})
        await db.execute(text("DELETE FROM user_tenants WHERE user_id = :uid"), {"uid": str(user_id)})
        await db.execute(text("DELETE FROM staff_shifts WHERE user_id = :uid"), {"uid": str(user_id)})
        await db.execute(delete(User).where(User.id == user_id))
        await db.commit()
        return {"success": True, "message": f"Usuario {user.nombre} eliminado correctamente."}
    except Exception as e:
        await db.rollback()
        # Fallback de seguridad si hay ventas asociadas
        try:
            await db.execute(update(User).where(User.id == user_id).values(activo=False))
            await db.commit()
            return {"success": True, "message": f"Usuario {user.nombre} desactivado por integridad referencial de auditoría."}
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Error al eliminar usuario: {str(e2)}")


@router.post("/users/{user_id}/photo")
async def upload_user_photo(
    user_id: str,
    file: UploadFile = File(...),
    token_data: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not _is_tenant_admin(token_data) and str(token_data.get("sub")) != str(user_id):
        raise HTTPException(status_code=403, detail="No tienes permisos para modificar la foto de este usuario")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo excede el tamaño máximo permitido (10MB)")

    from pathlib import Path
    import time
    upload_dir = Path("uploads/avatars")
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "").suffix.lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp", ".svg"]:
        ext = ".png"

    filename = f"user_{user_id}_{int(time.time())}{ext}"
    file_path = upload_dir / filename
    file_path.write_bytes(content)

    foto_url = f"/uploads/avatars/{filename}"
    await db.execute(
        update(User).where(User.id == user.id).values(foto_url=foto_url)
    )
    await db.commit()

    return {
        "foto_url": f"{foto_url}?t={int(time.time())}",
        "message": "Foto de perfil actualizada y guardada con éxito"
    }
