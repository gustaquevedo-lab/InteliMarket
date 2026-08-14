import { useState, useEffect } from "react"
import { Shield, Plus, Edit, Trash2, Search, Loader2, X, Check, ChevronDown, ChevronRight, Key } from "lucide-react"
import { api, type Permission, type Role } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { Modal } from "../../components/Modal"

const MODULES = [
  "Auth",
  "Ventas",
  "Compras",
  "Inventario",
  "Productos",
  "Clientes",
  "Caja",
  "Reportes",
  "SIFEN",
  "Integraciones",
  "Admin",
]

const PERMISSIONS_BY_MODULE: Record<string, { name: string; description: string }[]> = {
  Auth: [
    { name: "auth:view", description: "Ver usuarios" },
    { name: "auth:create", description: "Crear usuarios" },
    { name: "auth:update", description: "Actualizar usuarios" },
    { name: "auth:delete", description: "Eliminar usuarios" },
  ],
  Ventas: [
    { name: "sales:view", description: "Ver ventas" },
    { name: "sales:create", description: "Crear ventas" },
    { name: "sales:cancel", description: "Cancelar ventas" },
    { name: "sales:refund", description: "Reembolsar ventas" },
  ],
  Compras: [
    { name: "suppliers:view", description: "Ver proveedores" },
    { name: "suppliers:create", description: "Crear proveedores" },
    { name: "purchases:view", description: "Ver órdenes de compra" },
    { name: "purchases:create", description: "Crear órdenes de compra" },
    { name: "purchases:approve", description: "Aprobar órdenes" },
  ],
  Inventario: [
    { name: "inventory:view", description: "Ver inventario" },
    { name: "inventory:adjust", description: "Ajustar inventario" },
    { name: "inventory:transfer", description: "Transferir stock" },
    { name: "inventory:valuation", description: "Ver valoración" },
  ],
  Productos: [
    { name: "products:view", description: "Ver productos" },
    { name: "products:create", description: "Crear productos" },
    { name: "products:update", description: "Editar productos" },
    { name: "products:delete", description: "Eliminar productos" },
    { name: "variants:manage", description: "Gestionar variantes" },
  ],
  Clientes: [
    { name: "customers:view", description: "Ver clientes" },
    { name: "customers:create", description: "Crear clientes" },
    { name: "customers:update", description: "Editar clientes" },
    { name: "customers:delete", description: "Eliminar clientes" },
    { name: "credit:manage", description: "Gestionar crédito" },
  ],
  Caja: [
    { name: "caja:view", description: "Ver caja" },
    { name: "caja:open", description: "Abrir/cerrar caja" },
    { name: "caja:retiro", description: "Registrar retiros" },
  ],
  Reportes: [
    { name: "reports:view", description: "Ver reportes" },
    { name: "reports:export", description: "Exportar reportes" },
    { name: "reports:fiscal", description: "Ver libros fiscales" },
  ],
  SIFEN: [
    { name: "sifen:view", description: "Ver SIFEN" },
    { name: "sifen:emitir", description: "Emitir comprobantes" },
    { name: "sifen:anular", description: "Anular comprobantes" },
  ],
  Integraciones: [
    { name: "integrations:view", description: "Ver integraciones" },
    { name: "integrations:configure", description: "Configurar integraciones" },
  ],
  Admin: [
    { name: "admin:view", description: "Ver admin" },
    { name: "admin:roles", description: "Gestionar roles" },
    { name: "branches:view", description: "Ver sucursales" },
    { name: "logistics:manage", description: "Gestionar logística" },
    { name: "price_lists:view", description: "Ver listas de precios" },
    { name: "verticals:configure", description: "Gestionar verticales" },
  ],
}

export default function RbacPage() {
  const [tab, setTab] = useState<"roles" | "permissions">("roles")
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [searchRoles, setSearchRoles] = useState("")
  const [searchPermissions, setSearchPermissions] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(["Auth", "Ventas"]))
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [rolesData, permsData] = await Promise.all([
        api.rbac.listRoles(),
        api.rbac.listPermissions(),
      ])
      setRoles(rolesData)
      setPermissions(permsData)
    } catch {
      toast.error("Error de conexión", "Conectá el backend para ver RBAC")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredRoles = roles.filter(
    (r) =>
      !searchRoles ||
      (r.name ?? "").toLowerCase().includes(searchRoles.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchRoles.toLowerCase())
  )

  const filteredPermissions = permissions.filter(
    (p) =>
      !searchPermissions ||
      (p.name ?? "").toLowerCase().includes(searchPermissions.toLowerCase()) ||
      (p.module ?? "").toLowerCase().includes(searchPermissions.toLowerCase())
  )

  const permissionsByModule = MODULES.reduce(
    (acc, module) => {
      acc[module] = filteredPermissions.filter((p) => p.module === module)
      return acc
    },
    {} as Record<string, Permission[]>
  )

  const handleSubmit = async (form: { name: string; description: string; permissions: string[] }) => {
    if (!form.name) {
      toast.error("Error", "El nombre es obligatorio")
      return
    }
    setSubmitting(true)
    try {
      const validPermIds = form.permissions
        .map((p) => permissions.find((perm) => perm.id === p || perm.name === p)?.id)
        .filter(Boolean) as string[]
      if (editingRole) {
        await api.rbac.updateRole(editingRole.id, {
          name: form.name,
          description: form.description || undefined,
        })
        await api.rbac.setRolePermissions(editingRole.id, validPermIds)
        toast.success("Actualizado", "Rol actualizado correctamente")
      } else {
        const newRole = await api.rbac.createRole({
          name: form.name,
          description: form.description || undefined,
        })
        await api.rbac.setRolePermissions(newRole.id, validPermIds)
        toast.success("Creado", "Rol creado correctamente")
      }
      setShowModal(false)
      setEditingRole(null)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo guardar el rol")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (roleId: string) => {
    try {
      await api.rbac.deleteRole(roleId)
      toast.success("Eliminado", "Rol eliminado correctamente")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo eliminar el rol")
    }
  }

  const handleSeed = async () => {
    try {
      await api.rbac.seedRoles()
      toast.success("Éxito", "Roles inicializados correctamente")
      fetchData()
    } catch {
      toast.error("Error", "No se pudieron inicializar los roles")
    }
  }

  const toggleModule = (module: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(module)) {
        next.delete(module)
      } else {
        next.add(module)
      }
      return next
    })
  }

  const totalSystemRoles = roles.filter((r) => r.is_system).length
  const totalCustomRoles = roles.filter((r) => !r.is_system).length
  const totalPermissions = permissions.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            RBAC
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de roles y permisos</p>
        </div>
        <button onClick={handleSeed} className="btn-outline">
          <Key className="w-4 h-4" />
          Inicializar roles
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab("roles")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "roles"
              ? "border-primary text-primary"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Roles
        </button>
        <button
          onClick={() => setTab("permissions")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "permissions"
              ? "border-primary text-primary"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Permisos
        </button>
      </div>

      {tab === "roles" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Roles</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{roles.length}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <Check className="w-5 h-5 text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sistema</span>
              </div>
              <p className="text-2xl font-bold text-blue-500">{totalSystemRoles}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <X className="w-5 h-5 text-green-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Personalizados</span>
              </div>
              <p className="text-2xl font-bold text-green-500">{totalCustomRoles}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <Key className="w-5 h-5 text-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Permisos</span>
              </div>
              <p className="text-2xl font-bold text-amber-500">{permissions.length}</p>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input-field pl-10"
                placeholder="Buscar roles..."
                value={searchRoles}
                onChange={(e) => setSearchRoles(e.target.value)}
              />
            </div>
            <button
              onClick={() => {
                setEditingRole(null)
                setShowModal(true)
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              Nuevo rol
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Nombre</th>
                  <th className="table-cell">Descripción</th>
                  <th className="table-cell">Tipo</th>
                  <th className="table-cell">Permisos</th>
                  <th className="table-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </td>
                  </tr>
                ) : filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400">
                      No hay roles
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role) => (
                    <tr key={role.id} className="table-row">
                      <td className="table-td font-medium">{role.name}</td>
                      <td className="table-td text-sm text-gray-500">{role.description || "—"}</td>
                      <td className="table-td">
                        <StatusBadge
                          status={role.is_system ? "sistema" : "personalizado"}
                          map={{
                            sistema: "badge-info",
                            personalizado: "badge-success",
                          }}
                        />
                      </td>
                      <td className="table-td">
                        <span className="text-sm text-gray-500">{role.permissions?.length || 0}</span>
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1">
                          <button
                            className="btn-ghost"
                            title="Editar"
                            onClick={() => {
                              setEditingRole(role)
                              setShowModal(true)
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!role.is_system && (
                            <button
                              className="btn-ghost text-red-400 hover:text-red-500"
                              title="Eliminar"
                              onClick={() => handleDelete(role.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "permissions" && (
        <>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input-field pl-10"
                placeholder="Buscar permisos..."
                value={searchPermissions}
                onChange={(e) => setSearchPermissions(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((module) => (
              <div key={module} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{module}</h3>
                  <span className="text-xs text-gray-500">{permissionsByModule[module]?.length || 0}</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {permissionsByModule[module]?.map((perm) => (
                    <div key={perm.id} className="text-sm">
                      <div className="font-medium text-gray-700 dark:text-gray-300">{perm.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{perm.action}</div>
                    </div>
                  ))}
                  {(!permissionsByModule[module] || permissionsByModule[module].length === 0) && (
                    <div className="text-xs text-gray-400">Sin permisos</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <RoleModal
          role={editingRole}
          permissions={permissions}
          onClose={() => {
            setShowModal(false)
            setEditingRole(null)
          }}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  )
}

interface RoleModalProps {
  role: Role | null
  permissions: Permission[]
  onClose: () => void
  onSubmit: (form: { name: string; description: string; permissions: string[] }) => void
  submitting: boolean
}

function RoleModal({ role, permissions, onClose, onSubmit, submitting }: RoleModalProps) {
  const [name, setName] = useState(role?.name || "")
  const [description, setDescription] = useState(role?.description || "")
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(role?.permissions?.map((p) => p.id) || [])
  )
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(["Auth", "Ventas"]))

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(permId)) {
        next.delete(permId)
      } else {
        next.add(permId)
      }
      return next
    })
  }

  const toggleModule = (module: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(module)) {
        next.delete(module)
      } else {
        next.add(module)
      }
      return next
    })
  }

  const getModulePermissions = (module: string) => {
    const modulePerms = PERMISSIONS_BY_MODULE[module] || []
    return modulePerms.map((p) => {
      const existing = permissions.find((perm) => perm.name === p.name)
      return existing ? { ...p, id: existing.id } : { ...p, id: p.name }
    })
  }

  return (
    <Modal open onClose={onClose} title={role ? "Editar rol" : "Nuevo rol"} size="xl">
      <div className="space-y-4">
        <div>
          <label className="input-label label-required">Nombre</label>
          <input
            className="input-field"
            placeholder="Administrador"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="input-label">Descripción</label>
          <input
            className="input-field"
            placeholder="Rol con acceso total al sistema"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="input-label">Permisos</label>
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl max-h-80 overflow-y-auto">
            {MODULES.map((module) => {
              const modulePerms = getModulePermissions(module)
              const isExpanded = expandedModules.has(module)
              const allSelected = modulePerms.every((p) => selectedPermissions.has(p.id))
              const someSelected = modulePerms.some((p) => selectedPermissions.has(p.id))

              return (
                <div key={module} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                  <button
                    type="button"
                    onClick={() => toggleModule(module)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="font-medium text-gray-900 dark:text-white">{module}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {someSelected && (
                        <span className="text-xs text-gray-500">
                          {allSelected ? "Todos" : `${modulePerms.filter((p) => selectedPermissions.has(p.id)).length}/${modulePerms.length}`}
                        </span>
                      )}
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected && !allSelected
                        }}
                        onChange={() => {
                          setSelectedPermissions((prev) => {
                            const next = new Set(prev)
                            if (allSelected) {
                              modulePerms.forEach((p) => next.delete(p.id))
                            } else {
                              modulePerms.forEach((p) => next.add(p.id))
                            }
                            return next
                          })
                        }}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-2">
                      {modulePerms.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.has(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <div>
                            <div className="text-sm text-gray-700 dark:text-gray-300">{perm.description}</div>
                            <div className="text-xs text-gray-400 font-mono">{perm.name}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button className="btn-outline flex-1" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary flex-1"
            onClick={() => onSubmit({ name, description, permissions: Array.from(selectedPermissions) })}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : role ? "Actualizar" : "Crear"}
          </button>
        </div>
      </div>
    </Modal>
  )
}