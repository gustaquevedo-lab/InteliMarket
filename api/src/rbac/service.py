"""RBAC service"""

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import uuid

from api.src.rbac.models import Permission, Role, RolePermission, UserRole
from api.src.rbac.schemas import (
    PermissionCreate, PermissionUpdate, RoleCreate, RoleUpdate,
    DEFAULT_PERMISSIONS, DEFAULT_ROLES,
)


async def get_permissions(db: AsyncSession) -> List[Permission]:
    result = await db.execute(select(Permission).order_by(Permission.module, Permission.name))
    return list(result.scalars().all())


async def get_permission_by_name(db: AsyncSession, name: str) -> Optional[Permission]:
    result = await db.execute(select(Permission).where(Permission.name == name))
    return result.scalar_one_or_none()


async def create_permission(db: AsyncSession, data: PermissionCreate) -> Permission:
    perm = Permission(**data.model_dump())
    db.add(perm)
    await db.commit()
    await db.refresh(perm)
    return perm


async def get_roles(db: AsyncSession, tenant_id: uuid.UUID) -> List[Role]:
    result = await db.execute(
        select(Role).order_by(Role.is_system.desc(), Role.name)
    )
    return list(result.scalars().all())


async def get_role(db: AsyncSession, role_id: uuid.UUID) -> Optional[Role]:
    result = await db.execute(select(Role).where(Role.id == role_id))
    return result.scalar_one_or_none()


async def create_role(db: AsyncSession, data: RoleCreate, tenant_id: uuid.UUID) -> Role:
    role = Role(name=data.name, description=data.description)
    db.add(role)
    await db.commit()
    await db.refresh(role)

    if data.permission_ids:
        for perm_id in data.permission_ids:
            rp = RolePermission(tenant_id=tenant_id, role_id=role.id, permission_id=perm_id)
            db.add(rp)
        await db.commit()

    return role


async def update_role(db: AsyncSession, role_id: uuid.UUID, data: RoleUpdate, tenant_id: uuid.UUID) -> Optional[Role]:
    role = await get_role(db, role_id)
    if not role:
        return None

    if data.name is not None:
        role.name = data.name
    if data.description is not None:
        role.description = data.description

    await db.commit()
    await db.refresh(role)

    if data.permission_ids is not None:
        await db.execute(
            delete(RolePermission).where(
                RolePermission.tenant_id == tenant_id,
                RolePermission.role_id == role_id
            )
        )
        for perm_id in data.permission_ids:
            rp = RolePermission(tenant_id=tenant_id, role_id=role_id, permission_id=perm_id)
            db.add(rp)
        await db.commit()

    return role


async def delete_role(db: AsyncSession, role_id: uuid.UUID) -> bool:
    role = await get_role(db, role_id)
    if not role:
        return False
    if role.is_system:
        return False
    await db.delete(role)
    await db.commit()
    return True


async def get_role_permissions(db: AsyncSession, role_id: uuid.UUID, tenant_id: uuid.UUID) -> List[Permission]:
    result = await db.execute(
        select(Permission).join(
            RolePermission, RolePermission.permission_id == Permission.id
        ).where(
            RolePermission.role_id == role_id,
            RolePermission.tenant_id == tenant_id
        )
    )
    return list(result.scalars().all())


async def set_role_permissions(db: AsyncSession, role_id: uuid.UUID, permission_ids: List[uuid.UUID], tenant_id: uuid.UUID) -> bool:
    await db.execute(
        delete(RolePermission).where(
            RolePermission.tenant_id == tenant_id,
            RolePermission.role_id == role_id
        )
    )
    for perm_id in permission_ids:
        rp = RolePermission(tenant_id=tenant_id, role_id=role_id, permission_id=perm_id)
        db.add(rp)
    await db.commit()
    return True


async def assign_user_role(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID, role_id: uuid.UUID) -> bool:
    existing = await db.execute(
        select(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.tenant_id == tenant_id,
            UserRole.role_id == role_id
        )
    )
    if existing.scalar_one_or_none():
        return False

    ur = UserRole(user_id=user_id, tenant_id=tenant_id, role_id=role_id)
    db.add(ur)
    await db.commit()
    return True


async def remove_user_role(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID, role_id: uuid.UUID) -> bool:
    result = await db.execute(
        delete(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.tenant_id == tenant_id,
            UserRole.role_id == role_id
        )
    )
    await db.commit()
    return result.rowcount > 0


async def get_user_roles(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID) -> List[dict]:
    result = await db.execute(
        select(UserRole, Role).join(Role, Role.id == UserRole.role_id).where(
            UserRole.user_id == user_id,
            UserRole.tenant_id == tenant_id
        )
    )
    return [
        {
            "user_id": str(ur.user_id),
            "tenant_id": str(ur.tenant_id),
            "role_id": str(role.id),
            "role_name": role.name,
            "created_at": ur.created_at,
        }
        for ur, role in result.all()
    ]


async def check_permission(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID, permission: str) -> bool:
    result = await db.execute(
        select(Permission).join(
            RolePermission, RolePermission.permission_id == Permission.id
        ).join(
            UserRole, UserRole.role_id == RolePermission.role_id
        ).where(
            UserRole.user_id == user_id,
            UserRole.tenant_id == tenant_id,
            Permission.name == permission
        )
    )
    if result.scalar_one_or_none():
        return True

    admin_role = await db.execute(
        select(Role).where(Role.name == "Administrador")
    )
    admin = admin_role.scalar_one_or_none()
    if admin:
        is_admin = await db.execute(
            select(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.tenant_id == tenant_id,
                UserRole.role_id == admin.id
            )
        )
        if is_admin.scalar_one_or_none():
            return True

    return False


async def seed_default_roles(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    existing_perms = await db.execute(select(Permission).limit(1))
    if existing_perms.scalar_one_or_none():
        return

    perm_map = {}
    for name, desc, module in DEFAULT_PERMISSIONS:
        perm = Permission(name=name, description=desc, module=module)
        db.add(perm)
        await db.flush()
        perm_map[name] = perm.id

    for role_data in DEFAULT_ROLES:
        role = Role(
            name=role_data["name"],
            description=role_data["description"],
            is_system=role_data.get("is_system", False),
            is_default=role_data.get("is_default", False),
        )
        db.add(role)
        await db.flush()

        if "permissions" in role_data:
            for perm_name in role_data["permissions"]:
                if perm_name in perm_map:
                    rp = RolePermission(
                        tenant_id=tenant_id,
                        role_id=role.id,
                        permission_id=perm_map[perm_name]
                    )
                    db.add(rp)

    await db.commit()


async def get_role_with_permissions(db: AsyncSession, role_id: uuid.UUID, tenant_id: uuid.UUID) -> Optional[Role]:
    role = await get_role(db, role_id)
    if not role:
        return None
    perms = await get_role_permissions(db, role_id, tenant_id)
    role.permissions = perms
    return role