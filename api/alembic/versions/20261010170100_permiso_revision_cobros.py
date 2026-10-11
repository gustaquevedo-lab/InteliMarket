"""permiso caja:revision_cobros

Revision ID: 20261010170100
Revises: 20261010170000
Create Date: 2026-10-10 17:01:00.000000

Permiso del panel "Revision de cobros" para Supervisor y Gerente. El tenant_id
se toma de rbac_role_permissions (no es el company_id). Una sentencia por
op.execute e idempotente.
"""
from typing import Sequence, Union
from alembic import op


revision: str = "20261010170100"
down_revision: Union[str, None] = "20261010170000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISO = "caja:revision_cobros"
DESCRIPCION = "Revisar cobros que no cuadran, huérfanos y multi-proveedor"
ROLES = ("Supervisor", "Gerente")


def upgrade() -> None:
    op.execute(
        "INSERT INTO rbac_permissions (id, name, description, module) "
        f"VALUES (gen_random_uuid(), '{PERMISO}', '{DESCRIPCION}', 'caja') "
        "ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, module = EXCLUDED.module"
    )
    roles = ", ".join(f"'{r}'" for r in ROLES)
    op.execute(
        f"""
        INSERT INTO rbac_role_permissions (tenant_id, role_id, permission_id)
        SELECT t.tenant_id, r.id, p.id
        FROM (SELECT DISTINCT tenant_id FROM rbac_role_permissions) t
        CROSS JOIN rbac_roles r
        JOIN rbac_permissions p ON p.name = '{PERMISO}'
        WHERE r.name IN ({roles})
        ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM rbac_role_permissions WHERE permission_id IN "
        f"(SELECT id FROM rbac_permissions WHERE name = '{PERMISO}')"
    )
    op.execute(f"DELETE FROM rbac_permissions WHERE name = '{PERMISO}'")
