"""RBAC router"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.rbac import service
from api.src.rbac.schemas import (
    PermissionCreate, PermissionUpdate, PermissionResponse,
    RoleCreate, RoleUpdate, RoleResponse, RoleWithPermissions,
    UserRoleAssign, UserRoleResponse, SetRolePermissions,
)

router = APIRouter(prefix="/api/v1/rbac", tags=["RBAC"])


def _is_tenant_admin(user: dict) -> bool:
    # Admin de plataforma (is_superadmin real) o admin del propio tenant
    # (rol="admin" en users, el rol con el que se crean las cuentas admin de cada cliente).
    return bool(user.get("is_superadmin", False) or user.get("rol") == "admin")


@router.get("/permissions", response_model=List[PermissionResponse])
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    perms = await service.get_permissions(db)
    return [
        PermissionResponse(id=str(p.id), name=p.name, description=p.description, module=p.module, created_at=p.created_at)
        for p in perms
    ]


@router.post("/permissions", response_model=PermissionResponse)
async def create_permission(
    data: PermissionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if not user.get("is_superadmin", False):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear permisos")
    p = await service.create_permission(db, data)
    return PermissionResponse(id=str(p.id), name=p.name, description=p.description, module=p.module, created_at=p.created_at)


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    roles = await service.get_roles(db, tenant_id)
    result = []
    for role in roles:
        perms = await service.get_role_permissions(db, role.id, tenant_id)
        result.append(RoleResponse(
            id=str(role.id),
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            is_default=role.is_default,
            created_at=role.created_at,
            permissions=[PermissionResponse(
                id=str(p.id), name=p.name, description=p.description,
                module=p.module, created_at=p.created_at
            ) for p in perms]
        ))
    return result


@router.post("/roles", response_model=RoleResponse)
async def create_role(
    data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if not _is_tenant_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear roles")
    tenant_id = uuid.UUID(user["tenant_id"])
    role = await service.create_role(db, data, tenant_id)
    perms = await service.get_role_permissions(db, role.id, tenant_id)
    return RoleResponse(
        id=str(role.id),
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        is_default=role.is_default,
        created_at=role.created_at,
        permissions=[PermissionResponse(
            id=str(p.id), name=p.name, description=p.description,
            module=p.module, created_at=p.created_at
        ) for p in perms]
    )


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if not _is_tenant_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden modificar roles")
    tenant_id = uuid.UUID(user["tenant_id"])
    role = await service.update_role(db, uuid.UUID(role_id), data, tenant_id)
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    perms = await service.get_role_permissions(db, role.id, tenant_id)
    return RoleResponse(
        id=str(role.id),
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        is_default=role.is_default,
        created_at=role.created_at,
        permissions=[PermissionResponse(
            id=str(p.id), name=p.name, description=p.description,
            module=p.module, created_at=p.created_at
        ) for p in perms]
    )


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if not _is_tenant_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden eliminar roles")
    role = await service.get_role(db, uuid.UUID(role_id))
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    if role.is_system:
        raise HTTPException(status_code=400, detail="No se puede eliminar un rol del sistema")
    success = await service.delete_role(db, uuid.UUID(role_id))
    if not success:
        raise HTTPException(status_code=400, detail="No se pudo eliminar el rol")
    return {"message": "Rol eliminado"}


@router.post("/roles/{role_id}/permissions")
async def set_role_permissions(
    role_id: str,
    data: SetRolePermissions,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if not _is_tenant_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden asignar permisos")
    tenant_id = uuid.UUID(user["tenant_id"])
    success = await service.set_role_permissions(db, uuid.UUID(role_id), data.permission_ids, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    return {"message": "Permisos actualizados"}


@router.get("/users/{user_id}/roles", response_model=List[UserRoleResponse])
async def get_user_roles(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    roles = await service.get_user_roles(db, uuid.UUID(user_id), tenant_id)
    return [UserRoleResponse(**r) for r in roles]


@router.post("/users/{user_id}/roles")
async def assign_user_role(
    user_id: str,
    data: UserRoleAssign,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if not _is_tenant_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden asignar roles")
    tenant_id = uuid.UUID(user["tenant_id"])
    success = await service.assign_user_role(db, uuid.UUID(user_id), tenant_id, data.role_id)
    if not success:
        raise HTTPException(status_code=400, detail="El usuario ya tiene este rol asignado")
    return {"message": "Rol asignado"}


@router.delete("/users/{user_id}/roles/{role_id}")
async def remove_user_role(
    user_id: str,
    role_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if not _is_tenant_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden remover roles")
    tenant_id = uuid.UUID(user["tenant_id"])
    success = await service.remove_user_role(db, uuid.UUID(user_id), tenant_id, uuid.UUID(role_id))
    if not success:
        raise HTTPException(status_code=404, detail="Asignación de rol no encontrada")
    return {"message": "Rol removido"}


@router.post("/seed")
async def seed_default_roles(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if not _is_tenant_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar seeding")
    tenant_id = uuid.UUID(user["tenant_id"])
    await service.seed_default_roles(db, tenant_id)
    return {"message": "Roles y permisos inicializados"}