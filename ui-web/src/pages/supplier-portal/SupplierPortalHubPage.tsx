import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Globe, UserPlus, Users, FileText, CheckCircle2, XCircle,
  ExternalLink, Loader2, RefreshCw, Shield, KeyRound, Building2,
  Phone, Mail, Calendar, Eye, Search, AlertCircle, Info, Sparkles, Plus,
  ArrowRight
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatDate, formatDateTime } from "../../utils/format"

type HubTab = "usuarios" | "documentos" | "invitar"

export default function SupplierPortalHubPage() {
  const toast = useToast()
  const [tab, setTab] = useState<HubTab>("usuarios")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [users, setUsers] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [search, setSearch] = useState("")

  // Formulario nuevo usuario
  const [savingUser, setSavingUser] = useState(false)
  const [userForm, setUserForm] = useState({
    supplier_id: "", email: "", password: "", nombre: "",
    telefono: "", cargo: "Ejecutivo de Cuentas / Ventas"
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, docsRes, suppRes] = await Promise.allSettled([
        api.supplierPortal.admin.users.list(),
        api.supplierPortal.admin.documents.list(),
        api.purchases.listSuppliers().catch(() => []),
      ])

      if (usersRes.status === "fulfilled" && Array.isArray(usersRes.value)) setUsers(usersRes.value)
      if (docsRes.status === "fulfilled" && Array.isArray(docsRes.value)) setDocuments(docsRes.value)
      if (suppRes.status === "fulfilled" && Array.isArray(suppRes.value)) setSuppliers(suppRes.value)
    } catch (e: any) {
      toast.error("Error al cargar datos del portal de proveedores", e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const handleToggleUser = async (userId: string) => {
    try {
      const res = await api.supplierPortal.admin.users.toggle(userId)
      toast.success(res.activo ? "Usuario Activado" : "Usuario Desactivado", "")
      loadData()
    } catch (err: any) {
      toast.error("Error al modificar estado", err.message)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userForm.supplier_id) { toast.error("Seleccioná un proveedor", ""); return }
    if (!userForm.email || !userForm.password) { toast.error("Completá email y contraseña", ""); return }
    setSavingUser(true)
    try {
      await api.supplierPortal.admin.users.create(userForm)
      toast.success("Credenciales Emitidas", `Se creó el acceso para ${userForm.email}. El proveedor ya puede ingresar al portal.`)
      setUserForm({ supplier_id: "", email: "", password: "", nombre: "", telefono: "", cargo: "Ejecutivo de Cuentas / Ventas" })
      setTab("usuarios")
      loadData()
    } catch (err: any) {
      toast.error("Error al crear usuario", err.message)
    } finally {
      setSavingUser(false)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!search) return users
    const s = search.toLowerCase()
    return users.filter(u =>
      (u.nombre || "").toLowerCase().includes(s) ||
      (u.email || "").toLowerCase().includes(s) ||
      (u.supplier_nombre || "").toLowerCase().includes(s)
    )
  }, [users, search])

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/90 text-white p-7 border border-cyan-500/20 shadow-2xl shadow-cyan-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 border border-cyan-400/30 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <Globe className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-cyan-400 uppercase bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/20">
                    PORTAL B2B DE PROVEEDORES · AUTOSERVICIO & FACTURAS ELECTRÓNICAS
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    {users.filter(u => u.activo).length} Usuarios Activos
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Portal de Proveedores B2B
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Emisión de credenciales externas, consulta de órdenes de compra en línea y recepción de comprobantes
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-cyan-300">
                👥 {users.length} cuentas B2B configuradas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                📄 {documents.length} documentos recibidos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <a
              href="/portal/proveedores/login"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-cyan-300 hover:text-white bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Portal Externo
            </a>

            <button
              onClick={() => setTab("invitar")}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition shadow-lg shadow-cyan-500/25 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Nuevo Acceso
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Accesos Totales</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-cyan-300">
              {users.length}
            </p>
            <p className="text-[11px] text-slate-400">Cuentas creadas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Activos en Portal</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {users.filter(u => u.activo).length}
            </p>
            <p className="text-[11px] text-slate-400">Con acceso habilitado</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Proveedores Base</span>
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {suppliers.length}
            </p>
            <p className="text-[11px] text-slate-400">Padrón de proveedores</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Documentos</span>
              <FileText className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {documents.length}
            </p>
            <p className="text-[11px] text-slate-400">XML/PDF subidos</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "usuarios", label: `Usuarios del Portal`, count: users.length, icon: Users },
          { id: "documentos", label: `Documentos Recibidos`, count: documents.length, icon: FileText },
          { id: "invitar", label: "Emitir Nuevo Acceso", icon: UserPlus },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as HubTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: USUARIOS ══════════════════════ */}
      {tab === "usuarios" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por proveedor, contacto o email..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none text-slate-900 dark:text-white"
              />
            </div>
            <button onClick={() => setTab("invitar")} className="px-4 py-2 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 transition">
              <Plus className="w-3.5 h-3.5" />Nuevo Acceso
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-500" /> Cargando usuarios del portal...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin usuarios de proveedores creados</p>
                <p className="mt-1 max-w-xs mx-auto">Emití credenciales para que tus proveedores ingresen al portal B2B y gestionen sus pedidos en tiempo real.</p>
                <button onClick={() => setTab("invitar")} className="px-4 py-2 mt-4 rounded-2xl bg-cyan-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" />Emitir Primer Acceso
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[700px] text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-4">Proveedor Asociado</th>
                      <th className="p-4">Contacto & Email</th>
                      <th className="p-4">Cargo</th>
                      <th className="p-4">Último Acceso</th>
                      <th className="p-4 text-center">Estado</th>
                      <th className="p-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {filteredUsers.map((u: any) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="p-4">
                          <p className="font-extrabold text-slate-900 dark:text-white">{u.supplier_nombre || "Proveedor"}</p>
                          <p className="text-[10px] text-slate-400 font-mono">ID: {u.supplier_id?.slice(0, 8)}...</p>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{u.nombre}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</p>
                          {u.telefono && <p className="text-[10px] text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {u.telefono}</p>}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{u.cargo || "Ejecutivo"}</td>
                        <td className="p-4 text-slate-400 font-mono">
                          {u.last_login ? formatDateTime(u.last_login) : "Nunca ingresó"}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${u.activo ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20" : "text-slate-400 bg-slate-100 dark:bg-slate-800"}`}>
                            {u.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleToggleUser(u.id)}
                            className={`text-xs px-3 py-1 rounded-xl font-bold border transition ${u.activo ? "border-amber-500/30 text-amber-500 hover:bg-amber-500/10" : "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"}`}
                          >
                            {u.activo ? "Desactivar" : "Activar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: DOCUMENTOS ══════════════════════ */}
      {tab === "documentos" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
          {documents.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin documentos recibidos</p>
              <p className="mt-1 max-w-xs mx-auto">Las facturas electrónicas XML/PDF y certificados cargados por los proveedores aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Documento / Tipo</th>
                    <th className="p-4">Proveedor</th>
                    <th className="p-4">Fecha de Carga</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-right">Archivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {documents.map((d: any) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-4">
                        <p className="font-extrabold text-slate-900 dark:text-white">{d.nombre || d.filename}</p>
                        <p className="text-[10px] text-slate-400 uppercase">{d.tipo}</p>
                      </td>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{d.supplier_nombre}</td>
                      <td className="p-4 text-slate-400 font-mono">{d.created_at ? formatDate(d.created_at) : "—"}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${d.estado === "aprobado" ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20" : "text-blue-500 bg-blue-500/10 border border-blue-500/20"}`}>
                          {d.estado || "recibido"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {d.file_url ? (
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-xl text-xs font-bold text-cyan-600 bg-cyan-500/10 border border-cyan-500/20 inline-flex items-center gap-1 hover:bg-cyan-500/20">
                            <Eye className="w-3 h-3" /> Ver
                          </a>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 3: EMITIR ACCESO ══════════════════════ */}
      {tab === "invitar" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm max-w-xl">
          <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase mb-1 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-cyan-500" /> Emitir Credenciales de Acceso para Proveedor
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            El proveedor podrá iniciar sesión de inmediato con este correo y contraseña para gestionar órdenes de compra y documentos.
          </p>

          <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1">Proveedor Registrado *</label>
              <select required className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={userForm.supplier_id} onChange={e => setUserForm(f => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">Seleccionar proveedor de la lista...</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.razon_social || s.nombre} (RUC: {s.ruc})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nombre del Contacto *</label>
                <input required className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none" value={userForm.nombre} onChange={e => setUserForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Juan González" />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Cargo / Función</label>
                <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={userForm.cargo} onChange={e => setUserForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ej: Ejecutivo de Cuentas" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Email de Acceso *</label>
                <input required type="email" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="ventas@proveedor.com.py" />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Contraseña Temporal *</label>
                <input required type="text" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white outline-none" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Password123!" />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">Teléfono / WhatsApp de Contacto</label>
              <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={userForm.telefono} onChange={e => setUserForm(f => ({ ...f, telefono: e.target.value }))} placeholder="0981 123456" />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setTab("usuarios")} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
              <button type="submit" disabled={savingUser} className="px-5 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition">
                {savingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Emitir Acceso
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
