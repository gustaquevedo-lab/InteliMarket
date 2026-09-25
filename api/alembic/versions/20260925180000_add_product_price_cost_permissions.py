"""add product price and cost permissions

Revision ID: 20260925180000
Revises: 20260924170000
Create Date: 2026-09-25 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20260925180000"
down_revision: Union[str, None] = "20260924170000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PERMISSIONS = [
    ("products:edit_cost", "Modificar costo de productos", "products"),
    ("products:edit_price", "Modificar precio de venta de productos", "products"),
]

ROLE_GRANTS = {
    "Comprador": [
        "products:view",
        "products:update",
        "products:edit_cost",
        "products:edit_price",
        "price_lists:view",
        "price_lists:manage",
    ],
    "Gerente": [
        "products:view",
        "products:update",
        "products:edit_cost",
        "products:edit_price",
        "price_lists:view",
        "price_lists:manage",
    ],
    "Supervisor": [
        "products:view",
        "price_lists:view",
    ],
}


def upgrade() -> None:
    # 1. Insertar nuevos permisos en rbac_permissions si no existen
    op.execute(
        "INSERT INTO rbac_permissions (id, name, description, module) "
        "SELECT gen_random_uuid(), p.name, p.description, p.module FROM (VALUES "
        + ", ".join(f"('{name}', '{desc}', '{module}')" for name, desc, module in NEW_PERMISSIONS)
        + ") AS p(name, description, module) "
        "ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, module = EXCLUDED.module"
    )

    # 2. Otorgar permisos a los roles para cada tenant existente
    for role_name, perm_names in ROLE_GRANTS.items():
        perm_list = ", ".join(f"'{p}'" for p in perm_names)
        op.execute(
            f"""
            INSERT INTO rbac_role_permissions (tenant_id, role_id, permission_id)
            SELECT t.id, r.id, p.id
            FROM tenants t
            CROSS JOIN rbac_roles r
            JOIN rbac_permissions p ON p.name IN ({perm_list})
            WHERE r.name = '{role_name}'
            ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING
            """
        )

    # 3. Asegurar que los usuarios Juan Gabriel tengan asignado el rol Comprador
    op.execute(
        """
        INSERT INTO rbac_user_roles (user_id, tenant_id, role_id)
        SELECT u.id, t.id, r.id
        FROM users u
        CROSS JOIN tenants t
        JOIN rbac_roles r ON r.name = 'Comprador'
        WHERE (u.email ILIKE '%juan%gabriel%' OR u.nombre ILIKE '%juan gabriel%')
        ON CONFLICT (user_id, tenant_id, role_id) DO NOTHING
        """
    )


def downgrade() -> None:
    perm_names = ", ".join(f"'{name}'" for name, _, _ in NEW_PERMISSIONS)
    op.execute(
        f"DELETE FROM rbac_role_permissions WHERE permission_id IN (SELECT id FROM rbac_permissions WHERE name IN ({perm_names}))"
    )
    op.execute(f"DELETE FROM rbac_permissions WHERE name IN ({perm_names})")
