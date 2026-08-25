import { useState, useEffect } from "react"
import { Users, Plus, Edit, KeyRound, Search, Loader2, Power, Copy, Check } from "lucide-react"
import { api, type TenantUser, type Role } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { Modal } from "../../components/Modal"

export default function UsuariosPage() {
  const [users, setUsers] = useState<TenantUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [tempPasswordFor, setTempPasswordFor] = useState<{ email: string; password: string } | null>(null)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersData, rolesData] = await Promise.all([api.auth.users.list(), api.rbac.listRoles()])
      setUsers(usersData)
      setRoles(rolesData)
    } catch {
      toast.error("Error", "No se pudieron cargar los usuarios")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredUsers = users.filter(
    (u) =>
      !search ||
      u.nombre.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async (form: {
    email: string
    nombre: string
    telefono: string
    rol: string
    role_id: string
    password: string
  }) => {
    if (!form.nombre || (!editingUser && !form.email)) {
      toast.error("Error", "Nombre y email son obligatorios")
      return
    }
    setSubmitting(true)
    try {
      if (editingUser) {
        await api.auth.users.update(editingUser.id, {
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          rol: form.rol || undefined,
        })
        toast.success("Actualizado", "Usuario actualizado correctamente")
      } else {
        const created = await api.auth.users.create({
          email: form.email,
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          rol: form.rol || "operador",
          role_id: form.role_id || undefined,
          password: form.password || undefined,
        })
        toast.success("Creado", "Usuario creado correctamente")
        if (created.temporary_password) {
          setTempPasswordFor({ email: created.email, password: created.temporary_password })
        }
      }
      setShowModal(false)
      setEditingUser(null)
      fetchData()
    } catch (e) {
      toast.error("Error", e instanceof Error ? e.message : "No se pudo guardar el usuario")
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActivo = async (u: TenantUser) => {
    try {
      await api.auth.users.update(u.id, { activo: !u.activo })
      toast.success(u.activo ? "Desactivado" : "Activado", `${u.nombre} fue ${u.activo ? "desactivado" : "activado"}`)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo cambiar el estado del usuario")
    }
  }

  const handleResetPassword = async (u: TenantUser) => {
    try {
      const result = await api.auth.users.resetPassword(u.id)
      if (result.temporary_password) {
        setTempPasswordFor({ email: u.email, password: result.temporary_password })
      }
      toast.success("Contraseña reseteada", `Se generó una contraseña temporal para ${u.email}`)
    } catch {
      toast.error("Error", "No se pudo resetear la contraseña")
    }
  }

  const totalUsers = users.length
  const totalActivos = users.filter((u) => u.activo).length
  const totalAdmins = users.filter((u) => u.is_superadmin || u.role_names.includes("Administrador")).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Usuarios
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de usuarios y accesos</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null)
            setShowModal(true)
          }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Usuarios</span>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white mt-2">{totalUsers}</p>
        </div>
        <div className="card p-5">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Activos</span>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-green-500 mt-2">{totalActivos}</p>
        </div>
        <div className="card p-5">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Administradores</span>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-amber-500 mt-2">{totalAdmins}</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-10"
            placeholder="Buscar usuarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Nombre</th>
              <th className="table-cell">Email</th>
              <th className="table-cell">Rol</th>
              <th className="table-cell">Roles RBAC</th>
              <th className="table-cell">Último acceso</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  No hay usuarios
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="table-row">
                  <td className="table-td font-medium">{u.nombre}</td>
                  <td className="table-td text-sm text-gray-500">{u.email}</td>
                  <td className="table-td text-sm capitalize">{u.tenant_rol}</td>
                  <td className="table-td text-sm text-gray-500">
                    {u.role_names.length > 0 ? u.role_names.join(", ") : u.is_superadmin ? "Superadmin" : "—"}
                  </td>
                  <td className="table-td text-sm text-gray-500">
                    {u.last_login ? new Date(u.last_login).toLocaleString("es-PY") : "Nunca"}
                  </td>
                  <td className="table-td">
                    <StatusBadge
                      status={u.activo ? "activo" : "inactivo"}
                      map={{ activo: "badge-success", inactivo: "badge-error" }}
                    />
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button
                        className="btn-ghost"
                        title="Editar"
                        onClick={() => {
                          setEditingUser(u)
                          setShowModal(true)
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="btn-ghost"
                        title="Resetear contraseña"
                        onClick={() => handleResetPassword(u)}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        className={`btn-ghost ${u.activo ? "text-red-400 hover:text-red-500" : "text-green-500"}`}
                        title={u.activo ? "Desactivar" : "Activar"}
                        onClick={() => handleToggleActivo(u)}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <UserModal
          user={editingUser}
          roles={roles}
          onClose={() => {
            setShowModal(false)
            setEditingUser(null)
          }}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}

      {tempPasswordFor && (
        <TempPasswordModal info={tempPasswordFor} onClose={() => setTempPasswordFor(null)} />
      )}
    </div>
  )
}

interface UserModalProps {
  user: TenantUser | null
  roles: Role[]
  onClose: () => void
  onSubmit: (form: {
    email: string
    nombre: string
    telefono: string
    rol: string
    role_id: string
    password: string
  }) => void
  submitting: boolean
}

const ROL_OPTIONS = ["admin", "operador", "vendedor", "comprador", "contador"]

function UserModal({ user, roles, onClose, onSubmit, submitting }: UserModalProps) {
  const [email, setEmail] = useState(user?.email || "")
  const [nombre, setNombre] = useState(user?.nombre || "")
  const [telefono, setTelefono] = useState(user?.telefono || "")
  const [rol, setRol] = useState(user?.tenant_rol || "operador")
  const [roleId, setRoleId] = useState("")
  const [password, setPassword] = useState("")

  return (
    <Modal open onClose={onClose} title={user ? "Editar usuario" : "Nuevo usuario"} size="md">
      <div className="space-y-4">
        <div>
          <label className="input-label label-required">Nombre</label>
          <input className="input-field" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        {!user && (
          <div>
            <label className="input-label label-required">Email</label>
            <input
              className="input-field"
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="input-label">Teléfono</label>
          <input className="input-field" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Rol (tenant)</label>
          <select className="input-field" value={rol} onChange={(e) => setRol(e.target.value)}>
            {ROL_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {!user && (
          <div>
            <label className="input-label">Rol RBAC (permisos)</label>
            <select className="input-field" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Sin asignar</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {!user && (
          <div>
            <label className="input-label">Contraseña inicial</label>
            <input
              className="input-field"
              type="text"
              placeholder="Dejar vacío para generar una automáticamente"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Si se deja vacío, se genera una contraseña temporal para compartir con el usuario.</p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button className="btn-outline flex-1" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary flex-1"
            onClick={() => onSubmit({ email, nombre, telefono, rol, role_id: roleId, password })}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : user ? "Actualizar" : "Crear"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function TempPasswordModal({ info, onClose }: { info: { email: string; password: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(info.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard no disponible, el usuario puede copiar manualmente
    }
  }

  return (
    <Modal open onClose={onClose} title="Contraseña temporal generada" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Compartí esta contraseña con <strong>{info.email}</strong> de forma segura. No se volverá a mostrar.
        </p>
        <div className="flex items-center gap-2">
          <code className="input-field flex-1 font-mono text-sm">{info.password}</code>
          <button className="btn-outline" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <button className="btn-primary w-full" onClick={onClose}>
          Listo
        </button>
      </div>
    </Modal>
  )
}
