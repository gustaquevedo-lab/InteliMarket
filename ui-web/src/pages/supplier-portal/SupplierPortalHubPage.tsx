import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Globe, UserPlus, Users, FileText, CheckCircle2, XCircle,
  ExternalLink, Loader2, RefreshCw, Shield, KeyRound, Building2,
  Phone, Mail, Calendar, Eye, Search, AlertCircle, Info, Sparkles, Plus
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
  }, [])

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
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">
              Portal de Proveedores B2B
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 uppercase">
              Autoservicio & Colaboración
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Administración de accesos externos para proveedores: emisión de credenciales, consulta de órdenes de compra confirmadas en línea y recepción de facturas electrónicas y certificados.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={loadData} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /><span>Actualizar</span>
          </button>
          <a href="/portal/proveedores/login" target="_blank" rel="noopener noreferrer"
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/50">
            <ExternalLink className="w-3.5 h-3.5" /><span>Abrir Portal Externo</span>
          </a>
          <button onClick={() => setTab("invitar")} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /><span>Nuevo Acceso Proveedor</span>
          </button>
        </div>
      </div>

      {/* BANNER INFORMATIVO */}
      <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 flex items-start gap-3 text-xs text-purple-900 dark:text-purple-300">
        <Info className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-purple-950 dark:text-purple-200 mb-0.5">
            Autoservicio para Proveedores de InteliMarket
          </p>
          <p className="text-purple-800 dark:text-purple-400 leading-relaxed">
            Al crearle un usuario a tu proveedor, éste podrá iniciar sesión en el portal externo para ver las órdenes de compra emitidas, confirmar fechas de entrega estimadas, consultar pagos/retenciones y subir facturas electrónicas XML/PDF sin intermediación telefónica ni por email.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Accesos Habilitados", val: users.length, color: "text-purple-600", icon: Users },
          { label: "Usuarios Activos", val: users.filter(u => u.activo).length, color: "text-emerald-600", icon: CheckCircle2 },
          { label: "Proveedores en Base", val: suppliers.length, color: "text-blue-600", icon: Building2 },
          { label: "Documentos Subidos", val: documents.length, color: "text-amber-600", icon: FileText },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase leading-tight">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className={`text-xl font-black font-mono ${kpi.color}`}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: "usuarios", label: `Usuarios del Portal (${users.length})` },
            { id: "documentos", label: `Documentos Recibidos (${documents.length})` },
            { id: "invitar", label: "Emitir Nuevo Acceso" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as HubTab)}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-purple-600 text-purple-600 dark:text-purple-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB USUARIOS */}
      {tab === "usuarios" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por proveedor, nombre o email..."
                className="input text-xs pl-8 w-full" />
            </div>
            <button onClick={() => setTab("invitar")} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />Nuevo Acceso
            </button>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando usuarios del portal...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-xs">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin usuarios de proveedores creados</p>
                <p className="mt-1 max-w-xs mx-auto">Emití credenciales para que tus proveedores ingresen al portal B2B y gestionen sus pedidos en tiempo real.</p>
                <button onClick={() => setTab("invitar")} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" />Emitir Primer Acceso
                </button>
              </div>
            ) : (
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 text-left">Proveedor Asociado</th>
                    <th className="p-3.5 text-left">Contacto & Email</th>
                    <th className="p-3.5 text-left">Cargo</th>
                    <th className="p-3.5 text-left">Último Acceso</th>
                    <th className="p-3.5 text-center">Estado</th>
                    <th className="p-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {filteredUsers.map((u: any) => (
                    <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <p className="font-extrabold text-gray-900 dark:text-white">{u.supplier_nombre || "Proveedor"}</p>
                        <p className="text-[10px] text-gray-400 font-mono">ID: {u.supplier_id?.slice(0, 8)}...</p>
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-gray-800 dark:text-gray-200">{u.nombre}</p>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</p>
                        {u.telefono && <p className="text-[10px] text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {u.telefono}</p>}
                      </td>
                      <td className="p-3.5 text-gray-600 dark:text-gray-300">{u.cargo || "Ejecutivo"}</td>
                      <td className="p-3.5 text-gray-500 font-mono">
                        {u.last_login ? formatDateTime(u.last_login) : "Nunca ingresó"}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${u.activo ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "text-gray-400 bg-gray-100 dark:bg-slate-800"}`}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button onClick={() => handleToggleUser(u.id)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg font-bold border transition ${u.activo ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-400" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400"}`}>
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB DOCUMENTOS */}
      {tab === "documentos" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {documents.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin documentos recibidos</p>
              <p className="mt-1 max-w-xs mx-auto">Las facturas electrónicas XML/PDF y certificados cargados por los proveedores aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Documento / Tipo</th>
                  <th className="p-3.5 text-left">Proveedor</th>
                  <th className="p-3.5 text-left">Fecha de Carga</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-right">Archivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {documents.map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5">
                      <p className="font-extrabold text-gray-900 dark:text-white">{d.nombre || d.filename}</p>
                      <p className="text-[10px] text-gray-400 uppercase">{d.tipo}</p>
                    </td>
                    <td className="p-3.5 font-bold text-gray-800 dark:text-gray-200">{d.supplier_nombre}</td>
                    <td className="p-3.5 text-gray-500 font-mono">{d.created_at ? formatDate(d.created_at) : "—"}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${d.estado === "aprobado" ? "text-emerald-600 bg-emerald-50" : "text-blue-600 bg-blue-50"}`}>
                        {d.estado || "recibido"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {d.file_url ? (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-[10px] px-2.5 py-1 inline-flex items-center gap-1">
                          <Eye className="w-3 h-3" /> Ver
                        </a>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB EMITIR NUEVO ACCESO */}
      {tab === "invitar" && (
        <div className="card p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs max-w-xl">
          <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase mb-1 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-purple-600" /> Emitir Credenciales de Acceso para Proveedor
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
            El proveedor podrá iniciar sesión de inmediato con este correo y contraseña para gestionar órdenes de compra y documentos.
          </p>

          <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
            <div>
              <label className="label-sm">Proveedor Registrado *</label>
              <select required className="input text-xs" value={userForm.supplier_id} onChange={e => setUserForm(f => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">Seleccionar proveedor de la lista...</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.razon_social || s.nombre} (RUC: {s.ruc})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-sm">Nombre del Contacto *</label>
                <input required className="input text-xs" value={userForm.nombre} onChange={e => setUserForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Juan González" />
              </div>
              <div>
                <label className="label-sm">Cargo / Función</label>
                <input className="input text-xs" value={userForm.cargo} onChange={e => setUserForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ej: Ejecutivo de Cuentas" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-sm">Email de Acceso *</label>
                <input required type="email" className="input text-xs" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="ventas@proveedor.com.py" />
              </div>
              <div>
                <label className="label-sm">Contraseña Temporal *</label>
                <input required type="text" className="input text-xs font-mono" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Password123!" />
              </div>
            </div>

            <div>
              <label className="label-sm">Teléfono / WhatsApp de Contacto</label>
              <input className="input text-xs" value={userForm.telefono} onChange={e => setUserForm(f => ({ ...f, telefono: e.target.value }))} placeholder="0981 123456" />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button type="button" onClick={() => setTab("usuarios")} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
              <button type="submit" disabled={savingUser} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700">
                {savingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Emitir Acceso
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
