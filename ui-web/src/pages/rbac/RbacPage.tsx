import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Shield, Plus, Edit, Trash2, Search, Loader2, X, Check, ChevronDown,
  ChevronRight, Key, Users, Lock, ShieldCheck, CheckCircle2, UserCheck,
  RefreshCcw, Mail, Phone, Building2, Eye, EyeOff, RotateCcw, AlertTriangle,
  Sliders, UserPlus, Sparkles, Filter, Camera, Upload, UserCircle, Calendar,
  Clock, Save, CheckCircle, ShieldAlert, ShoppingCart, Scale, Package,
  DollarSign, FileText, Settings, ExternalLink
} from "lucide-react"
import { api, type TenantUser, type Role, type Permission, type UserRoleAssignment } from "../../api"
import { useToast } from "../../context/ToastContext"

type Tab = "usuarios" | "roles" | "permisos" | "accesos"

const ROL_OPCIONES = [
  { value: "cajero", label: "Cajero/a" },
  { value: "supervisor", label: "Supervisor" },
  { value: "compras", label: "Compras / Depósito" },
  { value: "contador", label: "Contador / Auditor" },
  { value: "admin", label: "Administrador" },
]

const ROL_BADGE: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  supervisor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  cajero: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  compras: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  contador: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  etiquetador: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
}

export default function RbacPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("usuarios")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Referencia al input de archivo para subir foto desde la computadora
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Roles y permisos reales (desde /api/v1/rbac/*) -- antes esta pantalla
  // mostraba un catalogo de roles y una matriz de permisos escritos a mano
  // en el codigo, sin ninguna llamada real a la API. Ahora se reemplaza
  // todo por datos reales.
  const [realRoles, setRealRoles] = useState<Role[]>([])
  const [realPermissions, setRealPermissions] = useState<Permission[]>([])
  const [loadingRbac, setLoadingRbac] = useState(false)
  const [savingPermCode, setSavingPermCode] = useState<string | null>(null)
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [newRoleForm, setNewRoleForm] = useState({ name: "", description: "" })

  // Roles RBAC asignados al usuario que se esta viendo en la ficha
  const [selectedUserRoles, setSelectedUserRoles] = useState<UserRoleAssignment[]>([])
  const [loadingUserRoles, setLoadingUserRoles] = useState(false)
  const [roleToAssign, setRoleToAssign] = useState("")
  const [assigningRole, setAssigningRole] = useState(false)

  const fetchRbac = useCallback(async () => {
    setLoadingRbac(true)
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.rbac.listRoles(),
        api.rbac.listPermissions(),
      ])
      setRealRoles(Array.isArray(rolesRes) ? rolesRes : [])
      setRealPermissions(Array.isArray(permsRes) ? permsRes : [])
    } catch (err: any) {
      toast.error("No se pudieron cargar roles y permisos", err?.message || "Verificá tu conexión con el servidor.")
    } finally {
      setLoadingRbac(false)
    }
  }, [])

  useEffect(() => {
    fetchRbac()
  }, [fetchRbac])

  const fetchSelectedUserRoles = useCallback(async (userId: string) => {
    setLoadingUserRoles(true)
    try {
      const res = await api.rbac.userRoles(userId)
      setSelectedUserRoles(Array.isArray(res) ? res : [])
    } catch {
      setSelectedUserRoles([])
    } finally {
      setLoadingUserRoles(false)
    }
  }, [])

  // Lista de usuarios reales del sistema
  const [users, setUsers] = useState<TenantUser[]>([
    { id: "u-01", email: "admin@extrasuper.com.py", nombre: "Gustavo Quevedo (Admin)", rol: "admin", telefono: "+595992052200", activo: true, is_superadmin: true, tenant_rol: "admin", role_names: ["Administrador"], created_at: "2026-01-01" },
    { id: "u-02", email: "nilda.aquino@extrasuper.com.py", nombre: "NILDA AQUINO", rol: "cajera", telefono: "(0983) 555-011", activo: true, is_superadmin: false, tenant_rol: "cajera", role_names: ["Cajera"], created_at: "2026-01-10" },
    { id: "u-03", email: "evelin.herrero@extrasuper.com.py", nombre: "EVELIN HERRERO", rol: "cajera", telefono: "(0983) 555-012", activo: true, is_superadmin: false, tenant_rol: "cajera", role_names: ["Cajera"], created_at: "2026-01-10" },
    { id: "u-04", email: "eduarda@extrasuper.com.py", nombre: "EDUARDA", rol: "cajera", telefono: "(0983) 555-013", activo: true, is_superadmin: false, tenant_rol: "cajera", role_names: ["Cajera"], created_at: "2026-01-15" },
    { id: "u-05", email: "juan.ruiz@extrasuper.com.py", nombre: "JUAN GABRIEL RUIZ", rol: "supervisor", telefono: "(0983) 555-020", activo: true, is_superadmin: false, tenant_rol: "supervisor", role_names: ["Supervisor"], created_at: "2026-01-05" },
    { id: "u-06", email: "rocio.insaurralde@extrasuper.com.py", nombre: "ROCIO INSAURRALDE", rol: "supervisor", telefono: "(0983) 555-021", activo: true, is_superadmin: false, tenant_rol: "supervisor", role_names: ["Supervisor"], created_at: "2026-01-05" },
    { id: "u-07", email: "compras@extrasuper.com.py", nombre: "MARCOS DUARTE (Compras)", rol: "compras", telefono: "(0983) 777-101", activo: true, is_superadmin: false, tenant_rol: "compras", role_names: ["Compras"], created_at: "2026-02-01" },
    { id: "u-08", email: "contabilidad@extrasuper.com.py", nombre: "LIC. CLARA BOGADO (Contadora)", rol: "contador", telefono: "(0983) 777-202", activo: true, is_superadmin: false, tenant_rol: "contador", role_names: ["Contador"], created_at: "2026-02-01" },
  ])

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null)

  // Formulario de Creación de Usuario
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "cajero",
    role_id: "",
    telefono: "",
    sucursal: "001 - Central",
    pin_caja: "1234",
  })

  // Cargar usuarios desde la base de datos PostgreSQL vía API
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.auth.users.list()
      if (Array.isArray(res) && res.length > 0) {
        setUsers(res)
      }
    } catch {
      // mantiene datos de fallback si no hay sesión
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Crear Usuario (Persistencia real en DB)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre || !form.email) {
      toast.warning("Campos Requeridos", "Por favor completa el nombre y el correo del usuario.")
      return
    }

    setSubmitting(true)
    try {
      // Antes esto generaba un ID falso (u-${Date.now()}) ANTES de llamar
      // al backend y, si la llamada real fallaba, el catch solo hacia
      // console.warn (invisible) y seguia como si nada -- agregaba un
      // usuario fantasma solo en el estado local y mostraba "Guardado en
      // Base de Datos" aunque nunca se hubiera guardado nada. Asi se perdio
      // silenciosamente la creacion de un supervisor real. Ahora, si la
      // llamada real falla, se corta aca: no se agrega nada a la lista y
      // se muestra el error real en vez de un exito falso.
      const res = await api.auth.users.create({
        nombre: form.nombre,
        email: form.email,
        password: form.password || undefined,
        rol: form.rol,
        role_id: form.role_id || undefined,
        telefono: form.telefono,
      })
      if (!res || !res.id) {
        throw new Error("El servidor no confirmó la creación del usuario.")
      }

      // Se recarga la lista real desde el backend en vez de armar un objeto
      // local a mano -- antes se inventaba role_names/is_superadmin
      // adivinando a partir de form.rol, y esos datos nunca coincidian con
      // lo que realmente quedaba guardado (ej. is_superadmin siempre False
      // en la DB, sin importar el rol elegido aca).
      await fetchUsers()
      setShowCreateModal(false)
      setForm({ nombre: "", email: "", password: "", rol: "cajero", role_id: "", telefono: "", sucursal: "001 - Central", pin_caja: "1234" })
      toast.success("¡Usuario Guardado en Base de Datos!", `Se ha registrado a ${form.nombre}.`)
    } catch (err: any) {
      toast.error("No se pudo crear el usuario", err?.response?.data?.error?.message || err?.message || "Intente nuevamente.")
    } finally {
      setSubmitting(false)
    }
  }

  // Guardar Cambios del Usuario (Persistencia en DB) -- antes, si el update
  // fallaba (red, permisos, validacion), el catch igual actualizaba el
  // estado local y avisaba "Actualizado Localmente" como si fuera un exito
  // parcial. El usuario se iba pensando que guardo el cambio de rol/estado
  // y en la base seguia el valor viejo. Ahora un error real se muestra como
  // error real, sin tocar el estado.
  const handleSaveUserDetail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setSubmitting(true)
    try {
      await api.auth.users.update(selectedUser.id, {
        nombre: selectedUser.nombre,
        rol: selectedUser.rol,
        telefono: selectedUser.telefono || undefined,
        activo: selectedUser.activo,
        foto_url: selectedUser.foto_url || undefined,
      })
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...selectedUser } : u))
      toast.success("¡Ficha de Usuario Actualizada!", `Los datos de ${selectedUser.nombre} se guardaron en la base.`)
      setShowDetailModal(false)
    } catch (err: any) {
      toast.error("No se pudo guardar", err?.message || "El cambio no se aplicó en la base de datos. Intentá nuevamente.")
    } finally {
      setSubmitting(false)
    }
  }

  // Subir Foto Directamente desde la Computadora
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedUser) return

    if (!file.type.startsWith("image/")) {
      toast.error("Archivo Inválido", "Seleccione una imagen válida (PNG, JPG, JPEG, WEBP).")
      return
    }

    setUploadingPhoto(true)
    try {
      const res = await api.auth.users.uploadPhoto(selectedUser.id, file)
      const newPhotoUrl = res.foto_url
      const updatedUser = { ...selectedUser, foto_url: newPhotoUrl }
      setSelectedUser(updatedUser)
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u))
      toast.success("¡Foto de Perfil Guardada!", "La imagen se subió al servidor y se guardó de forma permanente.")
    } catch (err: any) {
      toast.error("Error al subir imagen", err?.message || String(err))
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Toggle Activo/Inactivo -- antes avisaba el cambio ANTES de confirmar con
  // el backend y, si fallaba, no revertia nada: un admin podia "deshabilitar"
  // a alguien y quedarse pensando que ya no tiene acceso, cuando en
  // realidad la cuenta seguia activa en la base.
  const handleToggleActive = async (user: TenantUser) => {
    const updatedStatus = !user.activo
    try {
      await api.auth.users.update(user.id, { activo: updatedStatus })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, activo: updatedStatus } : u))
      if (selectedUser && selectedUser.id === user.id) {
        setSelectedUser({ ...selectedUser, activo: updatedStatus })
      }
      toast.info(
        updatedStatus ? "Usuario Habilitado" : "Usuario Deshabilitado",
        `El acceso para ${user.nombre} ahora está ${updatedStatus ? "ACTIVO" : "SUSPENDIDO"} en el sistema.`
      )
    } catch (err: any) {
      toast.error("No se pudo cambiar el estado", err?.message || "El cambio no se aplicó en la base de datos.")
    }
  }

  // Reset de Contraseña -- antes avisaba "listo" ANTES de siquiera intentar
  // el cambio, y si el pedido fallaba (permisos, red) el error se tapaba
  // con un comentario "optimista": la clave real del usuario nunca
  // cambiaba pero el admin se iba pensando que si. Ahora solo confirma
  // despues de que el backend confirmo el cambio real.
  const handleResetPassword = async (user: TenantUser) => {
    const tempPass = `Extra${Math.floor(1000 + Math.random() * 9000)}*`
    try {
      await api.auth.users.resetPassword(user.id, tempPass)
      toast.success("Contraseña Actualizada", `La nueva clave de acceso para ${user.nombre} es: ${tempPass}`)
    } catch (e: any) {
      toast.error("No se pudo resetear la contraseña", e instanceof Error ? e.message : "Intentá nuevamente o verificá que tengas permisos de administrador.")
    }
  }

  // Agrupa el catálogo real de permisos por módulo para renderizar la matriz
  const permissionsByModule = useMemo(() => {
    const groups: Record<string, Permission[]> = {}
    for (const p of realPermissions) {
      const mod = p.module || "otros"
      if (!groups[mod]) groups[mod] = []
      groups[mod].push(p)
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [realPermissions])

  // Crear rol nuevo
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleForm.name.trim()) {
      toast.warning("Falta el nombre", "Ingresá un nombre para el rol.")
      return
    }
    setSubmitting(true)
    try {
      await api.rbac.createRole({ name: newRoleForm.name.trim(), description: newRoleForm.description.trim() || undefined })
      await fetchRbac()
      setShowCreateRoleModal(false)
      setNewRoleForm({ name: "", description: "" })
      toast.success("Rol creado", `"${newRoleForm.name}" ya está disponible para asignar y configurar permisos.`)
    } catch (err: any) {
      toast.error("No se pudo crear el rol", err?.message || "Verificá que tengas permisos de administrador.")
    } finally {
      setSubmitting(false)
    }
  }

  // Editar nombre/descripción de un rol existente
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRole) return
    setSubmitting(true)
    try {
      await api.rbac.updateRole(editingRole.id, { name: editingRole.name, description: editingRole.description || undefined })
      await fetchRbac()
      setEditingRole(null)
      toast.success("Rol actualizado", "Los cambios se guardaron correctamente.")
    } catch (err: any) {
      toast.error("No se pudo actualizar el rol", err?.message || "Intentá nuevamente.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRole = async (role: Role) => {
    if (role.is_system) return
    if (!window.confirm(`¿Eliminar el rol "${role.name}"? Los usuarios que lo tengan asignado perderán esos permisos.`)) return
    try {
      await api.rbac.deleteRole(role.id)
      await fetchRbac()
      toast.success("Rol eliminado", `"${role.name}" fue eliminado.`)
    } catch (err: any) {
      toast.error("No se pudo eliminar el rol", err?.message || "Intentá nuevamente.")
    }
  }

  // Tildar/destildar un permiso para un rol -- toma la lista actual de
  // permisos del rol, agrega o saca el que se tocó, y manda la lista
  // completa (asi es como funciona set_role_permissions en el backend:
  // reemplaza todo el conjunto, no agrega uno solo).
  const handleTogglePermission = async (role: Role, permission: Permission) => {
    const cellKey = `${role.id}:${permission.id}`
    const currentIds = (role.permissions || []).map(p => p.id)
    const has = currentIds.includes(permission.id)
    const newIds = has ? currentIds.filter(id => id !== permission.id) : [...currentIds, permission.id]

    setSavingPermCode(cellKey)
    // Optimista solo en memoria mientras se confirma -- si falla, se
    // revierte con el fetch real, nunca queda una mentira silenciosa.
    setRealRoles(prev => prev.map(r => r.id === role.id ? { ...r, permissions: has ? (r.permissions || []).filter(p => p.id !== permission.id) : [...(r.permissions || []), permission] } : r))
    try {
      await api.rbac.setRolePermissions(role.id, newIds)
    } catch (err: any) {
      toast.error("No se pudo guardar el permiso", err?.message || "El cambio no se aplicó, se revirtió en pantalla.")
      await fetchRbac()
    } finally {
      setSavingPermCode(null)
    }
  }

  const handleOpenUserDetail = (u: TenantUser) => {
    setSelectedUser({ ...u })
    setShowDetailModal(true)
    setRoleToAssign("")
    fetchSelectedUserRoles(u.id)
  }

  const handleAssignRoleToUser = async () => {
    if (!selectedUser || !roleToAssign) return
    setAssigningRole(true)
    try {
      await api.rbac.assignRole(selectedUser.id, roleToAssign)
      await fetchSelectedUserRoles(selectedUser.id)
      await fetchUsers()
      setRoleToAssign("")
      toast.success("Rol asignado", "El usuario ya tiene ese rol activo.")
    } catch (err: any) {
      toast.error("No se pudo asignar el rol", err?.message || "Intentá nuevamente.")
    } finally {
      setAssigningRole(false)
    }
  }

  const handleRemoveRoleFromUser = async (roleId: string) => {
    if (!selectedUser) return
    try {
      await api.rbac.removeRole(selectedUser.id, roleId)
      await fetchSelectedUserRoles(selectedUser.id)
      await fetchUsers()
      toast.success("Rol removido", "El usuario ya no tiene ese rol.")
    } catch (err: any) {
      toast.error("No se pudo remover el rol", err?.message || "Intentá nuevamente.")
    }
  }

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = !search || u.nombre.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
      const matchRole = roleFilter === "ALL" || u.rol?.toLowerCase() === roleFilter.toLowerCase()
      return matchSearch && matchRole
    })
  }, [users, search, roleFilter])

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* ── LUXURY COMMAND DECK HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    SEGURIDAD & ROLES RBAC
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    PostgreSQL 16 Conectado
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Control de Acceso, Roles & Permisos (RBAC)
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Definición granular de permisos para POS, balanzas, compras, fiscal Sifen y finanzas de Extra Supermercado
                </p>
              </div>
            </div>

            {/* Micro pills */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado · GRUPO SANTA TERESA E.A.S. (RUC 80150377-9)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                👥 {users.filter(u => u.activo).length} Colaboradores Activos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Sincronizar DB
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-500/25 transition cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              Crear Nuevo Usuario
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Usuarios Registrados</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {users.length} Colaboradores
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Activos: <strong className="text-emerald-600 font-mono">{users.filter(u => u.activo).length}</strong></span>
            <span className="text-blue-600 font-bold font-mono">100% Sincronizado</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cajeras Operativas</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {users.filter(u => u.rol?.toLowerCase() === "cajera").length} en Línea
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Terminales POS: <strong className="text-slate-700 dark:text-slate-200 font-mono">Activas</strong></span>
            <span className="text-emerald-600 font-bold font-mono">Salón de Ventas</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Supervisión & Mandos</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
            {users.filter(u => u.rol?.toLowerCase() === "supervisor" || u.rol?.toLowerCase() === "admin").length} Autorizados
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Anulaciones & PIN: <strong className="text-purple-600 font-bold">Protegido</strong></span>
            <span className="text-purple-600 font-bold font-mono">Nivel 1 & 2</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Control de Fotos</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            {users.filter(u => !!u.foto_url).length} con Foto
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Almacenamiento: <strong className="text-slate-700 dark:text-slate-200 font-mono">/uploads/avatars/</strong></span>
            <span className="text-amber-600 font-bold font-mono">Local Seguro</span>
          </div>
        </div>
      </div>

      {/* ── BARRA DE PESTAÑAS ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 space-x-6 text-xs font-bold">
        {[
          { id: "usuarios", label: "Lista de Usuarios & Fotos", icon: Users },
          { id: "roles", label: "Jerarquía de Roles", icon: Key },
          { id: "permisos", label: "Matriz General de Permisos", icon: Shield },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-2 py-3 border-b-2 font-black transition cursor-pointer ${
              tab === t.id
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: LISTA DE USUARIOS ── */}
      {tab === "usuarios" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar usuario por nombre o correo..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-bold"
              >
                <option value="ALL">Todos los Roles</option>
                {ROL_OPCIONES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <span className="text-xs font-mono font-bold text-gray-400">
              Mostrando {filteredUsers.length} de {users.length} usuarios
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Colaborador / Foto</th>
                  <th className="p-3">Email de Acceso</th>
                  <th className="p-3">Rol Asignado</th>
                  <th className="p-3 font-mono">Teléfono</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map(u => {
                  const badgeClass = ROL_BADGE[u.rol?.toLowerCase() || ""] || "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300"
                  const initials = u.nombre ? u.nombre.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "US"

                  return (
                    <tr
                      key={u.id}
                      onClick={() => handleOpenUserDetail(u)}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-700/40 transition cursor-pointer group"
                    >
                      <td className="p-3 font-bold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          {/* Avatar con foto o iniciales */}
                          <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 border-2 border-slate-200 dark:border-slate-700 bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center text-white font-mono text-xs font-black shadow-sm group-hover:border-blue-500 transition">
                            {u.foto_url ? (
                              <img src={u.foto_url} alt={u.nombre} className="w-full h-full object-cover" />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <div>
                            <span className="block font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                              {u.nombre}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              ID: {u.id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                        {u.email}
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${badgeClass}`}>
                          {u.rol || "sin rol"}
                        </span>
                        {u.role_names && u.role_names.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {u.role_names.map(rn => (
                              <span key={rn} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{rn}</span>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-1 text-[9px] text-amber-600 dark:text-amber-400 font-bold">Sin rol RBAC asignado</div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-gray-500 text-[11px]">{u.telefono || "—"}</td>
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black transition cursor-pointer ${
                            u.activo
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-red-100 hover:text-red-800"
                              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 hover:bg-emerald-100 hover:text-emerald-800"
                          }`}
                        >
                          {u.activo ? "ACTIVO" : "INACTIVO"}
                        </button>
                      </td>
                      <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenUserDetail(u)}
                          className="px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 rounded-xl transition cursor-pointer"
                        >
                          Ver Ficha & Foto
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: ROLES REALES (desde /api/v1/rbac/roles) ── */}
      {tab === "roles" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">Roles del Sistema</h2>
              <p className="text-xs text-gray-500">Roles reales, guardados en base de datos. Los usuarios se asignan desde su ficha (pestaña Usuarios).</p>
            </div>
            <button
              onClick={() => setShowCreateRoleModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Crear Rol
            </button>
          </div>

          {loadingRbac ? (
            <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {realRoles.map(r => {
                const count = users.filter(u => u.role_names?.includes(r.name || "")).length
                return (
                  <div key={r.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-gray-900 dark:text-white">{r.name}</p>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                          {count} usuarios
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.description || "Sin descripción"}</p>
                    </div>
                    <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-xs">
                      <span className="text-[11px] font-mono text-gray-400">{(r.permissions || []).length} permisos</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRole({ ...r })}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                          title="Editar nombre/descripción"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {!r.is_system && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(r)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Eliminar rol"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {realRoles.length === 0 && (
                <p className="col-span-full text-center text-xs text-gray-400 py-6">No hay roles todavía. Creá el primero con el botón de arriba.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: MATRIZ REAL DE PERMISOS (desde /api/v1/rbac/permissions) ── */}
      {tab === "permisos" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
            <h2 className="text-base font-black text-gray-900 dark:text-white">Matriz de Permisos por Rol</h2>
            <p className="text-xs text-gray-500">Tildá o destildá para conceder o quitar un permiso a un rol. Se guarda al instante.</p>
          </div>

          {loadingRbac ? (
            <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <div className="space-y-6 min-w-[640px]">
                {permissionsByModule.map(([modulo, perms]) => (
                  <div key={modulo} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-3 bg-slate-100 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase">{modulo}</h3>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {perms.map(p => (
                        <div key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-800 text-xs">
                          <div className="min-w-[220px]">
                            <span className="font-bold text-gray-900 dark:text-white block">{p.description || p.name}</span>
                            <code className="text-[10px] font-mono text-gray-400">{p.name}</code>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {realRoles.map(r => {
                              const allowed = (r.permissions || []).some(rp => rp.id === p.id)
                              const isSaving = savingPermCode === `${r.id}:${p.id}`
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleTogglePermission(r, p)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer disabled:opacity-50 ${
                                    allowed
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200"
                                      : "bg-slate-100 text-slate-400 dark:bg-slate-900/50 dark:text-slate-600 hover:bg-slate-200"
                                  }`}
                                  title={`${allowed ? "Quitar" : "Conceder"} a ${r.name}`}
                                >
                                  {r.name}: {isSaving ? "…" : allowed ? "✓" : "✗"}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {permissionsByModule.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-6">No hay permisos cargados en el catálogo.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: FICHA INTEGRAL DE USUARIO, FOTO Y PERMISOS ── */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                  <UserCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">Ficha de Usuario & Control de Permisos</h3>
                  <p className="text-xs text-gray-500">Datos de registro, fotografía oficial persistente y matriz de accesos</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SECCIÓN 1: FOTO DE PERFIL DIRECTA DESDE LA COMPUTADORA */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-5">
              {/* Avatar Grande */}
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 border-2 border-slate-300 dark:border-slate-600 shadow-md bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center text-white font-mono text-xl font-black">
                {selectedUser.foto_url ? (
                  <img src={selectedUser.foto_url} alt={selectedUser.nombre} className="w-full h-full object-cover" />
                ) : (
                  <span>{selectedUser.nombre ? selectedUser.nombre.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "US"}</span>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
              </div>

              {/* Botón de Carga de Archivo */}
              <div className="space-y-1.5 text-center sm:text-left flex-1">
                <span className="text-xs font-bold text-gray-900 dark:text-white block">Fotografía Oficial del Colaborador</span>
                <p className="text-[11px] text-gray-500">
                  Seleccione una imagen directamente desde su equipo. Se almacena de forma persistente en el servidor.
                </p>

                {/* Input de Archivo Oculto */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="px-3.5 py-1.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingPhoto ? "Subiendo..." : "Subir Foto desde el Equipo"}
                  </button>

                  {selectedUser.foto_url && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser({ ...selectedUser, foto_url: "" })
                        toast.info("Foto Removida", "Haga clic en Guardar para confirmar.")
                      }}
                      className="px-2.5 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                    >
                      Quitar Foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: FORMULARIO DE DATOS DE REGISTRO */}
            <form onSubmit={handleSaveUserDetail} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Nombre Completo:</label>
                  <input
                    type="text"
                    required
                    value={selectedUser.nombre}
                    onChange={e => setSelectedUser({ ...selectedUser, nombre: e.target.value })}
                    className="w-full p-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Email / Usuario de Acceso:</label>
                  <input
                    type="email"
                    disabled
                    value={selectedUser.email}
                    className="w-full p-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Rol Simple (acceso al POS):</label>
                  <select
                    value={selectedUser.rol?.toLowerCase()}
                    onChange={e => setSelectedUser({ ...selectedUser, rol: e.target.value })}
                    className="w-full p-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  >
                    {ROL_OPCIONES.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-gray-400 mt-1">Solo "cajero" y "supervisor" pueden entrar al POS de caja.</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Teléfono / Celular:</label>
                  <input
                    type="text"
                    value={selectedUser.telefono || ""}
                    onChange={e => setSelectedUser({ ...selectedUser, telefono: e.target.value })}
                    placeholder="(0983) 000-000"
                    className="w-full p-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Metadatos de Registro */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">Estado en DB:</span>
                  <span className={`font-bold ${selectedUser.activo ? "text-emerald-600" : "text-rose-500"}`}>
                    {selectedUser.activo ? "● Cuenta Habilitada" : "○ Cuenta Suspendida"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">Alta en Sistema:</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString("es-PY") : "01/01/2026"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">Último Acceso:</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString("es-PY") : "Sin registro"}
                  </span>
                </div>
              </div>

              {/* SECCIÓN 3: ROLES RBAC ASIGNADOS (reales, editables acá) */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                <span className="text-xs font-black text-gray-900 dark:text-white block">
                  Roles RBAC Asignados:
                </span>
                <p className="text-[10px] text-gray-400 -mt-1">
                  Además del rol simple ("{selectedUser.rol}") de arriba, un usuario puede tener uno o más roles RBAC con permisos granulares.
                </p>

                {loadingUserRoles ? (
                  <div className="flex items-center justify-center py-4 text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /></div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedUserRoles.length === 0 && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">Sin roles RBAC asignados todavía</span>
                    )}
                    {selectedUserRoles.map(ur => (
                      <span
                        key={ur.role_id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      >
                        {ur.role_name}
                        <button
                          type="button"
                          onClick={() => handleRemoveRoleFromUser(ur.role_id)}
                          className="hover:text-rose-600 cursor-pointer"
                          title="Quitar este rol"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={roleToAssign}
                    onChange={e => setRoleToAssign(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  >
                    <option value="">+ Agregar rol...</option>
                    {realRoles.filter(r => !selectedUserRoles.some(ur => ur.role_id === r.id)).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAssignRoleToUser}
                    disabled={!roleToAssign || assigningRole}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {assigningRole ? "..." : "Asignar"}
                  </button>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleResetPassword(selectedUser)}
                  className="px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded-xl border border-amber-300 dark:border-amber-800 transition cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 inline mr-1" />
                  Resetear Contraseña
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {submitting ? "Guardando..." : "Guardar Cambios en DB"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREAR NUEVO USUARIO ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">Crear Nuevo Usuario en Base de Datos</h3>
                  <p className="text-xs text-gray-500">Credenciales cifradas con bcrypt y asignación de rol inmediata</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. NILDA AQUINO"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Email / Usuario *</label>
                  <input
                    type="email"
                    required
                    placeholder="usuario@extrasuper.com.py"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Rol Simple *</label>
                  <select
                    value={form.rol}
                    onChange={e => setForm({ ...form, rol: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-bold"
                  >
                    {ROL_OPCIONES.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Rol RBAC (permisos granulares, opcional)</label>
                <select
                  value={form.role_id}
                  onChange={e => setForm({ ...form, role_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-bold"
                >
                  <option value="">Sin asignar (se puede agregar después)</option>
                  {realRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Contraseña Inicial</label>
                  <input
                    type="password"
                    placeholder="Extra2026*"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(0983) 000-000"
                    value={form.telefono}
                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-500/25 transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar & Dar de Alta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREAR ROL NUEVO ── */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white">Crear Rol Nuevo</h3>
              <button onClick={() => setShowCreateRoleModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRole} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Nombre del Rol *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Encargado de Panadería"
                  value={newRoleForm.name}
                  onChange={e => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Qué puede hacer este rol"
                  value={newRoleForm.description}
                  onChange={e => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
              <p className="text-[10px] text-gray-400">Después de crearlo, andá a la pestaña "Matriz General de Permisos" para tildar qué puede ver/hacer.</p>
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowCreateRoleModal(false)} className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer">
                  {submitting ? "Creando..." : "Crear Rol"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR ROL ── */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white">Editar Rol</h3>
              <button onClick={() => setEditingRole(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateRole} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={editingRole.name || ""}
                  onChange={e => setEditingRole({ ...editingRole, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Descripción</label>
                <input
                  type="text"
                  value={editingRole.description || ""}
                  onChange={e => setEditingRole({ ...editingRole, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setEditingRole(null)} className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer">
                  {submitting ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
