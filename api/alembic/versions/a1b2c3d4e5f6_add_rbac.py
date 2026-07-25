"""add rbac tables

Revision ID: a1b2c3d4e5f6
Revises: 
Create Date: 2026-05-10 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f8a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_superadmin', sa.Boolean(), server_default=sa.text('false')))

    op.create_table('rbac_permissions',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.String(500)),
        sa.Column('module', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('rbac_roles',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.String(500)),
        sa.Column('is_system', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('is_default', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('rbac_role_permissions',
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint('tenant_id', 'role_id', 'permission_id'),
    )
    op.create_foreign_key('fk_rbac_role_permissions_role', 'rbac_role_permissions', 'rbac_roles', ['role_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_rbac_role_permissions_permission', 'rbac_role_permissions', 'rbac_permissions', ['permission_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_rbac_role_permissions_tenant', 'rbac_role_permissions', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')

    op.create_table('rbac_user_roles',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('user_id', 'tenant_id', 'role_id'),
    )
    op.create_foreign_key('fk_rbac_user_roles_role', 'rbac_user_roles', 'rbac_roles', ['role_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_rbac_user_roles_tenant', 'rbac_user_roles', 'tenants', ['tenant_id'], ['id'], ondelete='CASCADE')

    permissions_data = [
        ('auth:view', 'Ver usuarios', 'auth'),
        ('auth:create', 'Crear usuarios', 'auth'),
        ('auth:update', 'Actualizar usuarios', 'auth'),
        ('auth:delete', 'Eliminar usuarios', 'auth'),
        ('tenants:view', 'Ver tenants', 'tenants'),
        ('tenants:create', 'Crear tenants', 'tenants'),
        ('tenants:update', 'Actualizar tenants', 'tenants'),
        ('tenants:delete', 'Eliminar tenants', 'tenants'),
        ('companies:view', 'Ver empresas', 'companies'),
        ('companies:create', 'Crear empresas', 'companies'),
        ('companies:update', 'Actualizar empresas', 'companies'),
        ('companies:delete', 'Eliminar empresas', 'companies'),
        ('products:view', 'Ver productos', 'products'),
        ('products:create', 'Crear productos', 'products'),
        ('products:update', 'Actualizar productos', 'products'),
        ('products:delete', 'Eliminar productos', 'products'),
        ('inventory:view', 'Ver inventario', 'inventory'),
        ('inventory:transfer', 'Transferir inventario', 'inventory'),
        ('inventory:adjust', 'Ajustar inventario', 'inventory'),
        ('inventory:valuation', 'Ver valoración de inventario', 'inventory'),
        ('sales:view', 'Ver ventas', 'sales'),
        ('sales:create', 'Crear ventas', 'sales'),
        ('sales:cancel', 'Cancelar ventas', 'sales'),
        ('sales:refund', 'Reembolsar ventas', 'sales'),
        ('pos:view', 'Ver POS', 'pos'),
        ('pos:sell', 'Vender en POS', 'pos'),
        ('pos:discount', 'Aplicar descuentos en POS', 'pos'),
        ('purchases:view', 'Ver compras', 'purchases'),
        ('purchases:create', 'Crear compras', 'purchases'),
        ('purchases:approve', 'Aprobar compras', 'purchases'),
        ('customers:view', 'Ver clientes', 'customers'),
        ('customers:create', 'Crear clientes', 'customers'),
        ('customers:update', 'Actualizar clientes', 'customers'),
        ('customers:delete', 'Eliminar clientes', 'customers'),
        ('suppliers:view', 'Ver proveedores', 'suppliers'),
        ('suppliers:create', 'Crear proveedores', 'suppliers'),
        ('suppliers:update', 'Actualizar proveedores', 'suppliers'),
        ('payments:view', 'Ver pagos', 'payments'),
        ('payments:create', 'Crear pagos', 'payments'),
        ('payments:approve', 'Aprobar pagos', 'payments'),
        ('caja:view', 'Ver caja', 'caja'),
        ('caja:open', 'Abrir caja', 'caja'),
        ('caja:close', 'Cerrar caja', 'caja'),
        ('caja:retiro', 'Registrar retiros', 'caja'),
        ('reports:view', 'Ver reportes', 'reports'),
        ('reports:export', 'Exportar reportes', 'reports'),
        ('reports:fiscal', 'Ver libros fiscales', 'reports'),
        ('sifen:view', 'Ver SIFEN', 'sifen'),
        ('sifen:emitir', 'Emitir comprobantes', 'sifen'),
        ('sifen:anular', 'Anular comprobantes', 'sifen'),
        ('integrations:view', 'Ver integraciones', 'integrations'),
        ('integrations:configure', 'Configurar integraciones', 'integrations'),
        ('intelicont:sync', 'Sincronizar con InteliCont', 'intelicont'),
        ('inteliaudit:sync', 'Sincronizar con InteliAudit', 'inteliaudit'),
        ('sueldok:sync', 'Sincronizar con SueldOK', 'sueldok'),
        ('backups:view', 'Ver backups', 'backups'),
        ('backups:create', 'Crear backups', 'backups'),
        ('backups:restore', 'Restaurar backups', 'backups'),
        ('admin:view', 'Ver admin', 'admin'),
        ('admin:roles', 'Gestionar roles', 'admin'),
        ('admin:permissions', 'Gestionar permisos', 'admin'),
        ('branches:view', 'Ver sucursales', 'branches'),
        ('branches:create', 'Crear sucursales', 'branches'),
        ('branches:update', 'Actualizar sucursales', 'branches'),
        ('credit:view', 'Ver cuentas de crédito', 'credit'),
        ('credit:manage', 'Gestionar crédito', 'credit'),
        ('logistics:view', 'Ver logística', 'logistics'),
        ('logistics:manage', 'Gestionar logística', 'logistics'),
        ('price_lists:view', 'Ver listas de precios', 'price_lists'),
        ('price_lists:manage', 'Gestionar listas de precios', 'price_lists'),
        ('variants:view', 'Ver variantes', 'variants'),
        ('variants:manage', 'Gestionar variantes', 'variants'),
        ('imports:view', 'Ver importaciones', 'imports'),
        ('imports:create', 'Crear importaciones', 'imports'),
        ('email:send', 'Enviar emails', 'email'),
        ('verticals:view', 'Ver verticales', 'verticals'),
        ('verticals:configure', 'Configurar verticales', 'verticals'),
    ]

    op.execute("""
        INSERT INTO rbac_permissions (id, name, description, module)
        SELECT gen_random_uuid(), p.name, p.description, p.module
        FROM (VALUES
            """ + ", ".join([f"('{name}', '{desc}', '{module}')" for name, desc, module in permissions_data]) + """
        ) AS p(name, description, module)
    """)

    roles_data = [
        ('Administrador', 'Acceso completo a todos los módulos y funciones del sistema', True, False),
        ('Vendedor', 'Acceso a ventas, POS, clientes y caja', True, True),
        ('Comprador', 'Acceso a compras, inventario y proveedores', True, False),
        ('Contador', 'Acceso a reportes, ventas, compras, pagos y libros fiscales', True, False),
        ('Visualizador', 'Solo lectura en todos los módulos', True, False),
    ]

    op.execute("""
        INSERT INTO rbac_roles (id, name, description, is_system, is_default)
        SELECT gen_random_uuid(), r.name, r.description, r.is_system, r.is_default
        FROM (VALUES
            """ + ", ".join([f"('{name}', '{desc}', {sys}, {def_})" for name, desc, sys, def_ in roles_data]) + """
        ) AS r(name, description, is_system, is_default)
    """)


def downgrade() -> None:
    op.drop_table('rbac_user_roles')
    op.drop_table('rbac_role_permissions')
    op.drop_table('rbac_roles')
    op.drop_table('rbac_permissions')
    op.drop_column('users', 'is_superadmin')