import { useState, useEffect, useMemo } from "react"
import {
  Search, Plus, Users, Edit, Loader2, Upload, Download, X,
  Building2, UserCheck, CreditCard, ChevronLeft, ChevronRight,
  Phone, Mail, MapPin, RefreshCw, Eye, Trash2, CheckCircle2, ShieldCheck,
  Award, Sparkles, Filter
} from "lucide-react"
import { api, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG, formatDate } from "../../utils/format"

export default function CustomersPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"todos" | "fisica" | "juridica" | "con_credito" | "inactivos">("todos")

  // Paginación
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Modales
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    razon_social: "",
    ruc: "",
    ci: "",
    tipo_persona: "juridica",
    telefono: "",
    email: "",
    direccion: "",
    ciudad: "",
    departamento: "",
    credito_limite: 0,
    condicion_iva: "contribuyente",
    activo: true,
  })

  // Importación CSV
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ total_rows: number; success: number; errors: number; details: Array<{ row: number; status: string; message: string }> } | null>(null)
  const [importing, setImporting] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await api.customers.list()
      setCustomers(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Error", "No se pudieron cargar los clientes del servidor")
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // Métricas Consolidadas
  const kpis = useMemo(() => {
    const total = customers.length
    const conRuc = customers.filter(c => c.ruc && c.ruc.trim().length > 0).length
    const personasFisicas = customers.filter(c => (c.tipo_persona || "").toLowerCase() === "fisica").length
    const personasJuridicas = customers.filter(c => (c.tipo_persona || "juridica").toLowerCase() === "juridica").length
    const conCredito = customers.filter(c => Number(c.credito_limite || 0) > 0).length
    const totalCreditoOtorgado = customers.reduce((sum, c) => sum + Number(c.credito_limite || 0), 0)
    return { total, conRuc, personasFisicas, personasJuridicas, conCredito, totalCreditoOtorgado }
  }, [customers])

  // Filtrado
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const s = search.toLowerCase().trim()
      const matchSearch = !s ||
        (c.razon_social || "").toLowerCase().includes(s) ||
        (c.ruc || "").toLowerCase().includes(s) ||
        (c.ci || "").toLowerCase().includes(s) ||
        (c.telefono || "").toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s) ||
        (c.ciudad || "").toLowerCase().includes(s)

      let matchTab = true
      if (tab === "fisica") matchTab = (c.tipo_persona || "").toLowerCase() === "fisica"
      else if (tab === "juridica") matchTab = (c.tipo_persona || "juridica").toLowerCase() === "juridica"
      else if (tab === "con_credito") matchTab = Number(c.credito_limite || 0) > 0
      else if (tab === "inactivos") matchTab = c.activo === false

      return matchSearch && matchTab
    })
  }, [customers, search, tab])

  useEffect(() => {
    setPage(1)
  }, [search, tab, pageSize])

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1
  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredCustomers.slice(start, start + pageSize)
  }, [filteredCustomers, page, pageSize])

  const handleOpenCreate = () => {
    setEditingCustomer(null)
    setForm({
      razon_social: "",
      ruc: "",
      ci: "",
      tipo_persona: "juridica",
      telefono: "",
      email: "",
      direccion: "",
      ciudad: "Santa Teresa",
      departamento: "Alto Paraná",
      credito_limite: 0,
      condicion_iva: "contribuyente",
      activo: true,
    })
    setShowForm(true)
  }

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c)
    setForm({
      razon_social: c.razon_social || "",
      ruc: c.ruc || "",
      ci: c.ci || "",
      tipo_persona: c.tipo_persona || "juridica",
      telefono: c.telefono || "",
      email: c.email || "",
      direccion: c.direccion || "",
      ciudad: c.ciudad || "",
      departamento: (c as any).departamento || "",
      credito_limite: c.credito_limite || 0,
      condicion_iva: (c as any).condicion_iva || "contribuyente",
      activo: c.activo !== false,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.razon_social.trim()) {
      toast.error("Error", "La razón social o nombre es obligatorio")
      return
    }
    setSaving(true)
    try {
      if (editingCustomer) {
        await api.customers.update(editingCustomer.id, form)
        toast.success("Cliente Actualizado", `Se actualizaron los datos de ${form.razon_social}`)
      } else {
        await api.customers.create(form)
        toast.success("Cliente Creado", `Se registró a ${form.razon_social}`)
      }
      setShowForm(false)
      fetchData()
    } catch (err: any) {
      toast.error("Error al guardar", err?.message || "Ocurrió un error inesperado")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: Customer) => {
    const ok = await confirm({
      title: "Desactivar Cliente",
      message: `¿Estás seguro de que deseas desactivar a ${c.razon_social}?`,
      confirmText: "Desactivar",
      variant: "danger",
    })
    if (!ok) return
    try {
      await api.customers.delete(c.id)
      toast.success("Cliente Desactivado", `${c.razon_social} fue dado de baja`)
      fetchData()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo eliminar el cliente")
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Users className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    GESTIÓN DE CLIENTES & FIDELIZACIÓN
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    Cartera Activa: {kpis.total.toLocaleString()} Clientes
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Padrón de Clientes & Cuentas Corrientes
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Registro fiscal DNIT, scoring de crédito ExtraClub, historial de compras y segmentación de afinidad
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                ⭐ {kpis.conCredito} con Crédito ExtraClub
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                💳 Línea Total: {formatPYG(kpis.totalCreditoOtorgado)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Recargar
            </button>
            <button
              onClick={handleOpenCreate}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 transition shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Cliente
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Clientes</span>
              <span className="text-[10px] font-bold text-indigo-400">Padrón</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-indigo-300">
              {kpis.total.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400">{kpis.conRuc} con RUC registrado</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Personas Físicas</span>
              <span className="text-[10px] font-bold text-blue-400">Consumidor</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {kpis.personasFisicas.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400">C.I. / Particulares</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Personas Jurídicas</span>
              <span className="text-[10px] font-bold text-purple-400">Empresas</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {kpis.personasJuridicas.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400">RUC Comercial / Facturación</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Línea de Crédito</span>
              <span className="text-[10px] font-mono text-emerald-400">ExtraClub</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(kpis.totalCreditoOtorgado)}
            </p>
            <p className="text-[11px] text-slate-400">{kpis.conCredito} clientes habilitados</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "todos", label: "Todos los Clientes", count: kpis.total },
          { id: "fisica", label: "Personas Físicas (C.I.)", count: kpis.personasFisicas },
          { id: "juridica", label: "Empresas & RUC", count: kpis.personasJuridicas },
          { id: "con_credito", label: "Con Crédito ExtraClub", count: kpis.conCredito },
          { id: "inactivos", label: "Inactivos", count: customers.filter(c => c.activo === false).length },
        ].map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
              }`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 🔍 BARRA DE HERRAMIENTAS & FILTROS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Razón Social, RUC, C.I., Teléfono, Email o Ciudad..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>
      </div>

      {/* 📊 TABLA DE CLIENTES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Cliente / Razón Social</th>
                <th className="p-4">RUC / C.I.</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Contacto</th>
                <th className="p-4">Ubicación</th>
                <th className="p-4 text-right">Límite Crédito</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Cargando padrón de clientes...</span>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    No se encontraron clientes coincidentes con la búsqueda.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-bold text-slate-900 dark:text-white max-w-[220px] truncate">
                      {c.razon_social}
                    </td>
                    <td className="p-4 font-mono text-slate-500 text-[11px]">
                      {c.ruc || c.ci || "—"}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        (c.tipo_persona || "").toLowerCase() === "fisica"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                      }`}>
                        {c.tipo_persona || "juridica"}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 text-[11px]">
                      <div className="space-y-0.5">
                        {c.telefono && <p className="font-mono flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{c.telefono}</p>}
                        {c.email && <p className="truncate max-w-[150px]">{c.email}</p>}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 text-[11px]">
                      {c.ciudad || "—"}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">
                      {Number(c.credito_limite || 0) > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">{formatPYG(c.credito_limite)}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">₲ 0</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.activo !== false
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}>
                        {c.activo !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewingCustomer(c)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition"
                          title="Ver Ficha 360"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition"
                          title="Editar Cliente"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {c.activo !== false && (
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
                            title="Desactivar"
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

        {/* Paginador */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Mostrando {paginatedCustomers.length} de {filteredCustomers.length} clientes</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono font-bold">Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: CREAR / EDITAR CLIENTE ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {editingCustomer ? "Editar Ficha de Cliente" : "Registrar Nuevo Cliente"}
                </h3>
                <p className="text-xs text-slate-400">Datos fiscales y comerciales para facturación</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Razón Social / Nombre Completo *</label>
                <input
                  type="text"
                  value={form.razon_social}
                  onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
                  placeholder="Ej: Distribuidora Central S.R.L. o Juan Pérez"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">RUC con DV</label>
                  <input
                    type="text"
                    value={form.ruc}
                    onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))}
                    placeholder="80012345-6"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">C.I. / Documento</label>
                  <input
                    type="text"
                    value={form.ci}
                    onChange={e => setForm(f => ({ ...f, ci: e.target.value }))}
                    placeholder="3.456.789"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Tipo Persona</label>
                  <select
                    value={form.tipo_persona}
                    onChange={e => setForm(f => ({ ...f, tipo_persona: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                  >
                    <option value="juridica">Jurídica (Empresa)</option>
                    <option value="fisica">Física (Particular)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    placeholder="0981 123456"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="cliente@email.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Dirección</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                  placeholder="Avda. Principal c/ 1ro de Mayo"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Límite de Crédito (₲)</label>
                  <input
                    type="number"
                    value={form.credito_limite}
                    onChange={e => setForm(f => ({ ...f, credito_limite: Number(e.target.value) || 0 }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={form.ciudad}
                    onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                    placeholder="Santa Teresa"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{editingCustomer ? "Guardar Cambios" : "Crear Cliente"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER FICHA 360 ── */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{viewingCustomer.razon_social}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">RUC: {viewingCustomer.ruc || viewingCustomer.ci || "Sin documento"}</p>
                </div>
              </div>
              <button onClick={() => setViewingCustomer(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">Teléfono:</span><span className="font-mono font-bold text-slate-900 dark:text-white">{viewingCustomer.telefono || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Email:</span><span className="text-slate-700 dark:text-slate-300">{viewingCustomer.email || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Dirección:</span><span className="text-slate-700 dark:text-slate-300">{viewingCustomer.direccion || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Ciudad:</span><span className="text-slate-700 dark:text-slate-300">{viewingCustomer.ciudad || "Santa Teresa"}</span></div>
              </div>

              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Línea de Crédito</span>
                  <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(viewingCustomer.credito_limite || 0)}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  ExtraClub Habilitado
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setViewingCustomer(null)} className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
