"""RBAC schemas"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

DEFAULT_PERMISSIONS = [
    # Auth
    ("auth:view", "Ver usuarios", "auth"),
    ("auth:create", "Crear usuarios", "auth"),
    ("auth:update", "Actualizar usuarios", "auth"),
    ("auth:delete", "Eliminar usuarios", "auth"),
    # Tenants
    ("tenants:view", "Ver tenants", "tenants"),
    ("tenants:create", "Crear tenants", "tenants"),
    ("tenants:update", "Actualizar tenants", "tenants"),
    ("tenants:delete", "Eliminar tenants", "tenants"),
    # Companies
    ("companies:view", "Ver empresas", "companies"),
    ("companies:create", "Crear empresas", "companies"),
    ("companies:update", "Actualizar empresas", "companies"),
    ("companies:delete", "Eliminar empresas", "companies"),
    # Products
    ("products:view", "Ver productos", "products"),
    ("products:create", "Crear productos", "products"),
    ("products:update", "Actualizar productos", "products"),
    ("products:delete", "Eliminar productos", "products"),
    # Inventory
    ("inventory:view", "Ver inventario", "inventory"),
    ("inventory:transfer", "Transferir inventario", "inventory"),
    ("inventory:adjust", "Ajustar inventario", "inventory"),
    ("inventory:valuation", "Ver valoración de inventario", "inventory"),
    # Sales
    ("sales:view", "Ver ventas", "sales"),
    ("sales:create", "Crear ventas", "sales"),
    ("sales:cancel", "Cancelar ventas", "sales"),
    ("sales:refund", "Reembolsar ventas", "sales"),
    # POS
    ("pos:view", "Ver POS", "pos"),
    ("pos:sell", "Vender en POS", "pos"),
    ("pos:discount", "Aplicar descuentos en POS", "pos"),
    # Purchases
    ("purchases:view", "Ver compras", "purchases"),
    ("purchases:create", "Crear compras", "purchases"),
    ("purchases:approve", "Aprobar compras", "purchases"),
    # Customers
    ("customers:view", "Ver clientes", "customers"),
    ("customers:create", "Crear clientes", "customers"),
    ("customers:update", "Actualizar clientes", "customers"),
    ("customers:delete", "Eliminar clientes", "customers"),
    # Suppliers
    ("suppliers:view", "Ver proveedores", "suppliers"),
    ("suppliers:create", "Crear proveedores", "suppliers"),
    ("suppliers:update", "Actualizar proveedores", "suppliers"),
    # Payments
    ("payments:view", "Ver pagos", "payments"),
    ("payments:create", "Crear pagos", "payments"),
    ("payments:approve", "Aprobar pagos", "payments"),
    # Caja
    ("caja:view", "Ver caja", "caja"),
    ("caja:open", "Abrir caja", "caja"),
    ("caja:close", "Cerrar caja", "caja"),
    ("caja:retiro", "Registrar retiros", "caja"),
    # Reports
    ("reports:view", "Ver reportes", "reports"),
    ("reports:export", "Exportar reportes", "reports"),
    ("reports:fiscal", "Ver libros fiscales", "reports"),
    # SIFEN
    ("sifen:view", "Ver SIFEN", "sifen"),
    ("sifen:emitir", "Emitir comprobantes", "sifen"),
    ("sifen:anular", "Anular comprobantes", "sifen"),
    # Integrations
    ("integrations:view", "Ver integraciones", "integrations"),
    ("integrations:configure", "Configurar integraciones", "integrations"),
    # InteliCont
    ("intelicont:sync", "Sincronizar con InteliCont", "intelicont"),
    # InteliAudit
    ("inteliaudit:sync", "Sincronizar con InteliAudit", "inteliaudit"),
    # SueldOK
    ("sueldok:sync", "Sincronizar con SueldOK", "sueldok"),
    # Backups
    ("backups:view", "Ver backups", "backups"),
    ("backups:create", "Crear backups", "backups"),
    ("backups:restore", "Restaurar backups", "backups"),
    # Admin
    ("admin:view", "Ver admin", "admin"),
    ("admin:roles", "Gestionar roles", "admin"),
    ("admin:permissions", "Gestionar permisos", "admin"),
    # Branches
    ("branches:view", "Ver sucursales", "branches"),
    ("branches:create", "Crear sucursales", "branches"),
    ("branches:update", "Actualizar sucursales", "branches"),
    # Credit Accounts
    ("credit:view", "Ver cuentas de crédito", "credit"),
    ("credit:manage", "Gestionar crédito", "credit"),
    # Logistics
    ("logistics:view", "Ver logística", "logistics"),
    ("logistics:manage", "Gestionar logística", "logistics"),
    # Price Lists
    ("price_lists:view", "Ver listas de precios", "price_lists"),
    ("price_lists:manage", "Gestionar listas de precios", "price_lists"),
    # Variants
    ("variants:view", "Ver variantes", "variants"),
    ("variants:manage", "Gestionar variantes", "variants"),
    # Imports
    ("imports:view", "Ver importaciones", "imports"),
    ("imports:create", "Crear importaciones", "imports"),
    # Email
    ("email:send", "Enviar emails", "email"),
    # Verticals
    ("verticals:view", "Ver verticales", "verticals"),
    ("verticals:configure", "Configurar verticales", "verticals"),
]

DEFAULT_ROLES = [
    {
        "name": "Administrador",
        "description": "Acceso completo a todos los módulos y funciones del sistema",
        "is_system": True,
        "is_default": False,
    },
    {
        "name": "Vendedor",
        "description": "Acceso a ventas, POS, clientes y caja",
        "is_system": True,
        "is_default": True,
        "permissions": [
            "sales:view", "sales:create", "customers:view", "customers:create",
            "pos:view", "pos:sell", "pos:discount", "caja:view",
        ],
    },
    {
        "name": "Comprador",
        "description": "Acceso a compras, inventario y proveedores",
        "is_system": True,
        "is_default": False,
        "permissions": [
            "purchases:view", "purchases:create", "purchases:approve",
            "inventory:view", "inventory:transfer", "inventory:adjust",
            "suppliers:view", "suppliers:create", "suppliers:update",
        ],
    },
    {
        "name": "Contador",
        "description": "Acceso a reportes, ventas, compras, pagos y libros fiscales",
        "is_system": True,
        "is_default": False,
        "permissions": [
            "reports:view", "reports:export", "reports:fiscal",
            "sales:view", "purchases:view", "customers:view",
            "payments:view", "payments:create", "sifen:view",
            "intelicont:sync", "backups:view",
        ],
    },
    {
        "name": "Visualizador",
        "description": "Solo lectura en todos los módulos",
        "is_system": True,
        "is_default": False,
        "permissions": [
            "auth:view", "tenants:view", "companies:view",
            "products:view", "inventory:view", "sales:view",
            "purchases:view", "customers:view", "suppliers:view",
            "payments:view", "caja:view", "reports:view",
            "sifen:view", "branches:view", "credit:view",
            "logistics:view", "price_lists:view",
        ],
    },
]


class PermissionCreate(BaseModel):
    name: str
    description: str
    module: str


class PermissionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    module: Optional[str] = None


class PermissionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    module: str
    created_at: datetime

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permission_ids: List[uuid.UUID] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[uuid.UUID]] = None


class RoleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_system: bool
    is_default: bool
    created_at: datetime
    permissions: List[PermissionResponse] = []

    class Config:
        from_attributes = True


class RoleWithPermissions(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_system: bool
    is_default: bool
    created_at: datetime
    permissions: List[PermissionResponse]

    class Config:
        from_attributes = True


class UserRoleAssign(BaseModel):
    role_id: uuid.UUID


class UserRoleResponse(BaseModel):
    user_id: str
    tenant_id: str
    role_id: str
    role_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class SetRolePermissions(BaseModel):
    permission_ids: List[uuid.UUID]