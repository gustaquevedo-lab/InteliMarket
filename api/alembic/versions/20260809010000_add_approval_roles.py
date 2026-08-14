"""add Supervisor/Gerente/Finanzas roles + permisos de aprobacion para
cuentas por cobrar (excepcion de credito, baja de incobrables, recargo por
mora, dunning). check_permission() no tiene ningun bypass para estos roles
(solo "Administrador" bypassea), asi que hay que otorgar los permisos
explicitamente via rbac_role_permissions para cada tenant existente.

Revision ID: 20260809010000
Revises: 20260809000000
Create Date: 2026-08-09 01:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260809010000"
down_revision: Union[str, None] = "20260809000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    ("credit:approve_exception", "Aprobar venta a crédito que excede el límite", "credit"),
    ("receivables:writeoff_request", "Solicitar baja de incobrable", "receivables"),
    ("receivables:writeoff_approve", "Aprobar baja de incobrable", "receivables"),
    ("receivables:mora_apply", "Aplicar recargo por mora", "receivables"),
    ("receivables:dunning_manage", "Gestionar cobranza automática (dunning)", "receivables"),
]

NEW_ROLES = [
    ("Supervisor", "Aprueba excepciones de límite de crédito (primer nivel)", True, False),
    ("Gerente", "Aprueba excepciones de crédito y bajas de incobrables (segundo nivel)", True, False),
    ("Finanzas", "Aprueba bajas de incobrables junto a Gerencia", True, False),
]

# rol -> lista de permisos a otorgar en cada tenant existente
ROLE_GRANTS = {
    "Supervisor": ["credit:approve_exception"],
    "Gerente": ["credit:approve_exception", "receivables:writeoff_approve"],
    "Finanzas": ["receivables:writeoff_approve"],
    "Contador": ["receivables:mora_apply", "receivables:writeoff_request"],
}


def upgrade() -> None:
    op.execute(
        "INSERT INTO rbac_permissions (id, name, description, module) "
        "SELECT gen_random_uuid(), p.name, p.description, p.module FROM (VALUES "
        + ", ".join(f"('{name}', '{desc}', '{module}')" for name, desc, module in NEW_PERMISSIONS)
        + ") AS p(name, description, module) "
        "ON CONFLICT (name) DO NOTHING"
    )

    op.execute(
        "INSERT INTO rbac_roles (id, name, description, is_system, is_default) "
        "SELECT gen_random_uuid(), r.name, r.description, r.is_system, r.is_default FROM (VALUES "
        + ", ".join(f"('{name}', '{desc}', {sys}, {default})" for name, desc, sys, default in NEW_ROLES)
        + ") AS r(name, description, is_system, is_default) "
        "ON CONFLICT (name) DO NOTHING"
    )

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


def downgrade() -> None:
    role_names = ", ".join(f"'{name}'" for name, _, _, _ in NEW_ROLES)
    perm_names = ", ".join(f"'{name}'" for name, _, _ in NEW_PERMISSIONS)
    op.execute(
        f"DELETE FROM rbac_role_permissions WHERE role_id IN (SELECT id FROM rbac_roles WHERE name IN ({role_names})) "
        f"OR permission_id IN (SELECT id FROM rbac_permissions WHERE name IN ({perm_names}))"
    )
    op.execute(f"DELETE FROM rbac_roles WHERE name IN ({role_names})")
    op.execute(f"DELETE FROM rbac_permissions WHERE name IN ({perm_names})")
