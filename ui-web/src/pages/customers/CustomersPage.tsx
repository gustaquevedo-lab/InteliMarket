import { useState, useEffect, useMemo } from "react"
import {
  Search, Plus, Users, Edit, Loader2, Upload, Download, X,
  Building2, UserCheck, CreditCard, ChevronLeft, ChevronRight,
  Phone, Mail, MapPin, RefreshCw, Eye, Trash2, CheckCircle2, ShieldCheck
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
      // Obtenemos los clientes desde la API de la empresa
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

  // Reset de página al cambiar filtro
  useEffect(() => {
    setPage(1)
  }, [search, tab, pageSize])

  // Paginación
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1
  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredCustomers.slice(start, start + pageSize)
  }, [filteredCustomers, page, pageSize])

  const openNew = () => {
    setEditingCustomer(null)
    setForm({
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
    setShowForm(true)
  }

  const openEdit = (c: Customer) => {
    setEditingCustomer(c)
    setForm({
      razon_social: c.razon_social || c.nombre || "",
      ruc: c.ruc || "",
      ci: c.ci || "",
      tipo_persona: c.tipo_persona || "juridica",
      telefono: c.telefono || "",
      email: c.email || "",
      direccion: c.direccion || "",
      ciudad: c.ciudad || "",
      departamento: (c as any).departamento || "",
      credito_limite: Number(c.credito_limite || c.limite_credito || 0),
      condicion_iva: (c as any).condicion_iva || "contribuyente",
      activo: c.activo !== false,
    })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.razon_social.trim()) {
      toast.error("Error", "La razón social es obligatoria")
      return
    }
    setSaving(true)
    try {
      if (editingCustomer) {
        await api.customers.update(editingCustomer.id, form)
        toast.success("Cliente actualizado", "Los cambios se guardaron correctamente")
      } else {
        await api.customers.create(form)
        toast.success("Cliente creado", "El cliente fue registrado exitosamente")
      }
      setShowForm(false)
      setEditingCustomer(null)
      fetchData()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo guardar el cliente")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: Customer) => {
    const ok = await confirm({
      title: "Eliminar Cliente",
      message: `¿Estás seguro de que deseas eliminar a "${c.razon_social || c.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      variant: "danger",
    })
    if (!ok) return
    try {
      await api.customers.delete(c.id)
      toast.success("Cliente eliminado", `"${c.razon_social || c.nombre}" fue eliminado`)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo eliminar el cliente (puede tener comprobantes asociados)")
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append("file", importFile)
      formData.append("type", "customers")
      const result = await api.imports.upload(formData)
      setImportResult(result as any)
      toast.success("Importación completa", `Archivo procesado correctamente`)
      fetchData()
    } catch {
      toast.error("Error", "Falló la importación del archivo CSV")
    } finally {
      setImporting(false)
    }
  }

  const exportCSV = () => {
    const headers = ["Razón Social", "RUC", "CI", "Tipo Persona", "Teléfono", "Email", "Ciudad", "Dirección", "Límite Crédito", "Estado"]
    const rows = filteredCustomers.map(c => [
      `"${(c.razon_social || "").replace(/"/g, '""')}"`,
      `"${c.ruc || ""}"`,
      `"${c.ci || ""}"`,
      `"${c.tipo_persona || "juridica"}"`,
      `"${c.telefono || ""}"`,
      `"${c.email || ""}"`,
      `"${c.ciudad || ""}"`,
      `"${(c.direccion || "").replace(/"/g, '""')}"`,
      c.credito_limite || 0,
      c.activo !== false ? "Activo" : "Inactivo",
    ])
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Clientes_InteliMarket_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER OPERATIVO ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate text-gray-900 dark:text-white">
              Gestión de Clientes
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Padrón Nemuha · {kpis.total.toLocaleString()} Registros
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Directorio maestro de clientes, validación de RUC ante la DNIT, cuentas corrientes y categorización comercial.
          </p>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-400 hover:text-primary rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            title="Recargar clientes"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setShowImport(true)}
            className="btn bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-800 font-bold text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-xs hover:bg-gray-50 dark:hover:bg-slate-800"
            title="Importar clientes desde CSV"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500" />
            <span>Importar</span>
          </button>

          <button
            onClick={exportCSV}
            className="btn bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-800 font-bold text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-xs hover:bg-gray-50 dark:hover:bg-slate-800"
            title="Exportar a CSV"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Exportar</span>
          </button>

          <button
            onClick={openNew}
            className="btn bg-primary text-white font-extrabold text-xs flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* ── HERO KPIS CONSOLIDADOS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-primary rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Padrón Total Clientes
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">
            {kpis.total.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Clientes registrados en el sistema
          </p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-emerald-500/30 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              RUC / CI Validados
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-2">
            {kpis.conRuc.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {kpis.total > 0 ? ((kpis.conRuc / kpis.total) * 100).toFixed(1) : 0}% con documento tributario
          </p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-blue-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Empresas / Jurídicas
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-blue-600 dark:text-blue-400 mt-2">
            {kpis.personasJuridicas.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {kpis.personasFisicas.toLocaleString()} personas físicas
          </p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-purple-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Crédito Habilitado
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-purple-600 dark:text-purple-400 mt-2">
            {kpis.conCredito}
          </div>
          <p className="text-[11px] text-gray-400 mt-1 font-mono">
            {formatPYG(kpis.totalCreditoOtorgado)} en líneas
          </p>
        </div>
      </div>

      {/* ── PESTAÑAS OPERATIVAS ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: "todos", label: "Todos los Clientes", icon: Users, count: kpis.total },
          { id: "juridica", label: "Empresas / Jurídicas", icon: Building2, count: kpis.personasJuridicas },
          { id: "fisica", label: "Personas Físicas", icon: UserCheck, count: kpis.personasFisicas },
          { id: "con_credito", label: "Con Línea de Crédito", icon: CreditCard, count: kpis.conCredito },
          { id: "inactivos", label: "Inactivos", icon: X, count: customers.filter(c => c.activo === false).length },
        ].map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${active ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── BARRA DE BÚSQUEDA Y PAGINACIÓN SUPERIOR ────────────────────────── */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 w-4 h-4 text-gray-400 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Razón Social, RUC, CI, Teléfono, Email o Ciudad..."
            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <span>Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          <div className="text-xs text-gray-400 font-mono">
            {filteredCustomers.length} resultados
          </div>
        </div>
      </div>

      {/* ── TABLA DE CLIENTES ──────────────────────────────────────────────── */}
      <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-3.5">Cliente / Razón Social</th>
                <th className="p-3.5">RUC / C.I.</th>
                <th className="p-3.5">Tipo Persona</th>
                <th className="p-3.5">Contacto</th>
                <th className="p-3.5">Ubicación</th>
                <th className="p-3.5 text-right">Límite Crédito</th>
                <th className="p-3.5 text-center">Estado</th>
                <th className="p-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Cargando padrón de clientes...</span>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    No se encontraron clientes coincidentes con el filtro.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c) => {
                  const isJuridica = (c.tipo_persona || "juridica").toLowerCase() === "juridica"
                  const hasCredit = Number(c.credito_limite || 0) > 0

                  return (
                    <tr key={c.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isJuridica ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600"}`}>
                            {isJuridica ? <Building2 className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <p className="font-extrabold text-xs text-gray-900 dark:text-white leading-tight">
                              {c.razon_social || c.nombre}
                            </p>
                            {(c as any).nombre_fantasia && (
                              <p className="text-[10px] text-gray-400 font-medium">{(c as any).nombre_fantasia}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono font-bold text-gray-700 dark:text-gray-300">
                        {c.ruc ? (
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-[11px] font-mono">
                            {c.ruc}
                          </span>
                        ) : c.ci ? (
                          <span className="text-gray-500 text-[11px]">CI: {c.ci}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isJuridica ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800" : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"}`}>
                          {isJuridica ? "Jurídica" : "Física"}
                        </span>
                      </td>

                      <td className="p-3.5 text-gray-600 dark:text-gray-300">
                        {c.telefono ? (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{c.telefono}</span>
                          </div>
                        ) : null}
                        {c.email ? (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5 truncate max-w-[150px]">
                            <Mail className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                            <span>{c.email}</span>
                          </div>
                        ) : null}
                        {!c.telefono && !c.email && <span className="text-gray-400 text-[11px]">—</span>}
                      </td>

                      <td className="p-3.5 text-gray-600 dark:text-gray-300 max-w-[160px] truncate">
                        {c.ciudad || c.direccion ? (
                          <div className="flex items-center gap-1 text-[11px]">
                            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{c.ciudad || c.direccion}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right font-mono font-black text-gray-900 dark:text-white">
                        {hasCredit ? (
                          <span className="text-purple-600 dark:text-purple-400 font-bold">
                            {formatPYG(Number(c.credito_limite))}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal">Gs. 0</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${c.activo !== false ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"}`}>
                          {c.activo !== false ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingCustomer(c)}
                            className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            title="Ver Detalle 360"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            title="Editar Cliente"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            title="Eliminar Cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINACIÓN INFERIOR ────────────────────────────────────────── */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            Mostrando <span className="font-bold text-gray-900 dark:text-white">{filteredCustomers.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> a <span className="font-bold text-gray-900 dark:text-white">{Math.min(page * pageSize, filteredCustomers.length)}</span> de <span className="font-bold text-gray-900 dark:text-white">{filteredCustomers.length}</span> clientes
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono font-bold px-2">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: CREAR / EDITAR CLIENTE ──────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-xl w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                  {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
                </h3>
                <p className="text-xs text-gray-400">Completá los datos tributarios y de contacto del cliente</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Razón Social / Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={form.razon_social}
                  onChange={e => setForm({ ...form, razon_social: e.target.value })}
                  placeholder="Ej: DISTRIBUIDORA DEL ESTE S.A."
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">RUC (Con Dígito Verificador)</label>
                  <input
                    type="text"
                    value={form.ruc}
                    onChange={e => setForm({ ...form, ruc: e.target.value })}
                    placeholder="80012345-6"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs font-mono font-bold outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Cédula de Identidad (C.I.)</label>
                  <input
                    type="text"
                    value={form.ci}
                    onChange={e => setForm({ ...form, ci: e.target.value })}
                    placeholder="1234567"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs font-mono font-bold outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Tipo de Persona</label>
                  <select
                    value={form.tipo_persona}
                    onChange={e => setForm({ ...form, tipo_persona: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs font-bold outline-none"
                  >
                    <option value="juridica">Persona Jurídica (Empresa)</option>
                    <option value="fisica">Persona Física (Particular)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Límite de Crédito (PYG)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.credito_limite}
                    onChange={e => setForm({ ...form, credito_limite: Number(e.target.value) || 0 })}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs font-mono font-bold outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={form.telefono}
                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                    placeholder="0981 123 456"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="cliente@ejemplo.com"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={form.ciudad}
                    onChange={e => setForm({ ...form, ciudad: e.target.value })}
                    placeholder="Ciudad del Este"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={e => setForm({ ...form, direccion: e.target.value })}
                    placeholder="Avda. San Blas e/ Curupayty"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn bg-primary text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:opacity-90"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{editingCustomer ? "Guardar Cambios" : "Crear Cliente"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VER DETALLE 360 CLIENTE ─────────────────────────────────── */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-md w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Ficha 360 del Cliente</h3>
                <p className="text-xs text-gray-400 font-mono">ID: {viewingCustomer.id.slice(0, 8)}</p>
              </div>
              <button onClick={() => setViewingCustomer(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Razón Social:</span>
                  <span className="font-extrabold text-gray-900 dark:text-white">{viewingCustomer.razon_social}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">RUC / C.I.:</span>
                  <span className="font-mono font-bold text-primary">{viewingCustomer.ruc || viewingCustomer.ci || "No registrado"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Tipo de Persona:</span>
                  <span className="font-bold text-gray-700 dark:text-gray-300 uppercase">{(viewingCustomer.tipo_persona || "juridica")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Teléfono:</span>
                  <span className="text-gray-700 dark:text-gray-300">{viewingCustomer.telefono || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Correo Electrónico:</span>
                  <span className="text-gray-700 dark:text-gray-300">{viewingCustomer.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Ciudad / Dirección:</span>
                  <span className="text-gray-700 dark:text-gray-300">{[viewingCustomer.ciudad, viewingCustomer.direccion].filter(Boolean).join(" · ") || "—"}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Línea de Crédito:</span>
                  <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-sm">
                    {formatPYG(Number(viewingCustomer.credito_limite || 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => {
                  const c = viewingCustomer
                  setViewingCustomer(null)
                  openEdit(c)
                }}
                className="btn bg-primary text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Editar Cliente</span>
              </button>
              <button onClick={() => setViewingCustomer(null)} className="btn bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs px-4 py-2 rounded-xl font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: IMPORTAR CSV ────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-md w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Importar Padrón de Clientes</h3>
                <p className="text-xs text-gray-400">Cargá un archivo CSV con columnas estándar</p>
              </div>
              <button onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-500">Columnas requeridas: <code className="font-mono text-[11px] bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">razon_social, ruc, ci, tipo_persona, direccion, ciudad, telefono, email, credito_limite</code></p>

              <div>
                <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Archivo CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs"
                />
              </div>

              {importFile && (
                <p className="text-xs text-emerald-600 font-medium">Archivo seleccionado: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
              )}

              {importResult && (
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-emerald-600">{importResult.success} importados con éxito</span>
                    <span className="text-red-500">{importResult.errors} con error</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }}
                className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs px-4 py-2 rounded-xl"
              >
                Cerrar
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="btn bg-primary text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:opacity-90"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{importing ? "Importando..." : "Iniciar Carga"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
