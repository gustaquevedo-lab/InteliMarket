import { useState, useEffect } from "react"
import { 
  Landmark, Search, Loader2, X, History, CheckCircle2, XCircle, 
  ArrowRightLeft, Banknote, Plus, AlertTriangle, FileText, Calendar, 
  ShieldAlert, ShieldCheck, Clock, RefreshCw, ChevronRight, Check,
  CreditCard, DollarSign, Wallet, ArrowDownRight, User, Building2,
  FileCheck, AlertOctagon, Scale, Eye
} from "lucide-react"
import { api, type Check as CheckType, type CheckEvent, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

interface ChecksSummary {
  total_documentos: number
  total_cartera: number
  cant_cartera: number
  total_cartera_al_dia: number
  total_cartera_diferido: number
  total_depositado: number
  cant_depositado: number
  total_acreditado: number
  cant_acreditado: number
  total_rechazado: number
  cant_rechazado: number
  total_pagares_activos: number
  cant_pagares_activos: number
  total_pagares_vencidos: number
  cant_pagares_vencidos: number
  total_pagares: number
}

const REJECTION_REASONS = [
  "Causal 1: Sin fondos suficientes en cuenta",
  "Causal 2: Cuenta corriente inhabilitada o clausurada",
  "Causal 3: Firma disconforme con registro bancario",
  "Causal 4: Defecto formal en texto o fecha",
  "Causal 5: Orden de no pago / Denuncia de extravío",
  "Causal 6: Caducidad de plazo de presentación",
]

export default function ChecksPage() {
  const [activeTab, setActiveTab] = useState<"cartera" | "depositados" | "rechazados" | "pagares" | "todos">("cartera")
  const [universePreset, setUniversePreset] = useState<"vigentes" | "30days" | "month" | "all">("vigentes")
  const [dateFrom, setDateFrom] = useState<string>("2026-01-01")
  const [dateTo, setDateTo] = useState<string>("")
  
  const [checks, setChecks] = useState<any[]>([])
  const [summary, setSummary] = useState<ChecksSummary | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  
  // Modals
  const [selected, setSelected] = useState<any | null>(null)
  const [events, setEvents] = useState<CheckEvent[]>([])
  const [showDetail, setShowDetail] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCashSettleModal, setShowCashSettleModal] = useState(false)
  
  // Forms
  const [motivo, setMotivo] = useState(REJECTION_REASONS[0])
  const [replaceForm, setReplaceForm] = useState({ numero: "", banco: "", titular: "", fecha_vencimiento: "" })
  const [createForm, setCreateForm] = useState({ 
    customer_id: "", tipo: "cheque", numero: "", banco: "", titular: "", 
    monto: "", fecha_emision: "2026-08-14", fecha_vencimiento: "2026-09-14" 
  })
  const [cashSettleUser, setCashSettleUser] = useState("Tesorería Central")
  const [cashSettleObs, setCashSettleObs] = useState("Canje y recupero en efectivo por cheque rechazado")

  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const handleUniverseChange = (preset: "vigentes" | "30days" | "month" | "all") => {
    setUniversePreset(preset)
    if (preset === "vigentes") {
      setDateFrom("2026-01-01")
      setDateTo("")
    } else if (preset === "30days") {
      setDateFrom("2026-08-14")
      setDateTo("2026-09-14")
    } else if (preset === "month") {
      setDateFrom("2026-08-01")
      setDateTo("2026-08-31")
    } else if (preset === "all") {
      setDateFrom("")
      setDateTo("")
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const isVigente = universePreset === "vigentes"
      const params: any = {
        vigente_only: isVigente,
        limit: 300,
      }
      if (dateFrom && !isVigente) params.fecha_desde = dateFrom
      if (dateTo && !isVigente) params.fecha_hasta = dateTo

      const sumParams: any = {
        vigente_only: isVigente,
      }
      if (dateFrom && !isVigente) sumParams.fecha_desde = dateFrom
      if (dateTo && !isVigente) sumParams.fecha_hasta = dateTo

      const [checksData, summaryData, customersData] = await Promise.allSettled([
        api.checks.list(params),
        api.checks.summary(sumParams),
        api.customers.list({ activo: true }),
      ])
      if (checksData.status === "fulfilled") setChecks(checksData.value || [])
      if (summaryData.status === "fulfilled") setSummary(summaryData.value)
      if (customersData.status === "fulfilled") setCustomers(customersData.value || [])
    } catch {
      toast.error("Error", "No se pudo cargar la información de cheques y pagarés")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    fetchData() 
  }, [universePreset, dateFrom, dateTo])

  // Filter per active tab
  const filteredChecks = checks.filter(c => {
    const custName = c.customer_name || customers.find(cu => cu.id === c.customer_id)?.razon_social || ""
    const custRuc = c.customer_ruc || customers.find(cu => cu.id === c.customer_id)?.ruc || ""
    const term = search.toLowerCase()
    
    const matchSearch = !search || 
      (c.numero || "").toLowerCase().includes(term) ||
      (c.banco || "").toLowerCase().includes(term) ||
      (c.titular || "").toLowerCase().includes(term) ||
      custName.toLowerCase().includes(term) ||
      custRuc.toLowerCase().includes(term)

    if (!matchSearch) return false

    if (activeTab === "cartera") {
      return c.tipo === "cheque" && c.estado === "cartera"
    }
    if (activeTab === "depositados") {
      return c.tipo === "cheque" && c.estado === "depositado"
    }
    if (activeTab === "rechazados") {
      return c.tipo === "cheque" && c.estado === "rechazado"
    }
    if (activeTab === "pagares") {
      return c.tipo === "pagare"
    }
    return true // todos
  })

  const openDetail = async (check: any) => {
    setSelected(check)
    try {
      setEvents(await api.checks.events(check.id))
    } catch {
      setEvents([])
    }
    setShowDetail(true)
  }

  const handleAdvanceStatus = async (check: any, nuevoEstado: string) => {
    try {
      await api.checks.changeStatus(check.id, { estado: nuevoEstado })
      toast.success("Estado Actualizado", `El documento fue marcado como "${nuevoEstado.toUpperCase()}"`)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo actualizar el estado")
    }
  }

  const handleReject = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await api.checks.changeStatus(selected.id, { estado: "rechazado", motivo: motivo || undefined })
      toast.success("Cheque Rechazado", "El documento fue marcado como rechazado y se reabrió la deuda del cliente.")
      setShowReject(false)
      setMotivo(REJECTION_REASONS[0])
      fetchData()
    } catch {
      toast.error("Error", "No se pudo rechazar el cheque")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReplace = async () => {
    if (!selected || !replaceForm.numero || !replaceForm.fecha_vencimiento) {
      toast.error("Error", "Completá el número y la fecha de vencimiento del nuevo cheque")
      return
    }
    setSubmitting(true)
    try {
      await api.checks.replace(selected.id, {
        numero: replaceForm.numero,
        banco: replaceForm.banco || selected.banco,
        titular: replaceForm.titular || selected.titular,
        fecha_vencimiento: replaceForm.fecha_vencimiento,
      })
      toast.success("Canje Exitoso", "El cheque rechazado fue sustituido por el nuevo documento en cartera.")
      setShowReplace(false)
      setReplaceForm({ numero: "", banco: "", titular: "", fecha_vencimiento: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo canjear el cheque")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCashSettle = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await api.checks.changeStatus(selected.id, { 
        estado: "acreditado", 
        motivo: `[RECUPERO EFECTIVO]: ${cashSettleObs} · Recibido por ${cashSettleUser}` 
      })
      toast.success("Recupero Registrado", "El cheque rechazado fue cancelado por ingreso de efectivo en Tesorería.")
      setShowCashSettleModal(false)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo registrar el recupero")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.customer_id || !createForm.numero || !createForm.monto || !createForm.fecha_vencimiento) {
      toast.error("Error", "Completá los campos requeridos")
      return
    }
    setSubmitting(true)
    try {
      await api.checks.create({
        customer_id: createForm.customer_id,
        tipo: createForm.tipo,
        numero: createForm.numero,
        banco: createForm.tipo === "cheque" ? createForm.banco : undefined,
        titular: createForm.titular,
        monto: Number(createForm.monto),
        moneda: "PYG",
        fecha_emision: createForm.fecha_emision,
        fecha_vencimiento: createForm.fecha_vencimiento,
      } as any)
      toast.success("Documento Registrado", `${createForm.tipo === "cheque" ? "Cheque" : "Pagaré"} ingresado a cartera.`)
      setShowCreateModal(false)
      setCreateForm({ customer_id: "", tipo: "cheque", numero: "", banco: "", titular: "", monto: "", fecha_emision: "2026-08-14", fecha_vencimiento: "2026-09-14" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo registrar el documento")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-primary text-[10px] font-black uppercase tracking-widest">
              Tesorería & Custodia de Valores
            </span>
            <span className="text-xs text-gray-400 font-mono">Control de Cartera, Clearing & Recupero</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            Gestión de Cheques & Pagarés
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Custodia física, compensación bancaria, seguimiento activo de rechazos y pagarés exigibles
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="btn-ghost p-2" title="Recargar datos">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-1.5 text-xs">
            <Plus className="w-4 h-4" />
            <span>Nuevo Cheque / Pagaré</span>
          </button>
        </div>
      </div>

      {/* Universe Filter Selector */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            Universo:
          </span>
          {[
            { id: "vigentes", label: "⚡ Valores Vigentes 2026 (Activos)" },
            { id: "30days", label: "🗓️ Vencen Próximos 30 Días" },
            { id: "month", label: "📅 Mes Actual (Agosto)" },
            { id: "all", label: "📜 Histórico Completo" },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => handleUniverseChange(p.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                universePreset === p.id
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 text-[11px]">Desde:</span>
          <input
            type="date"
            className="input-field text-xs p-1 font-mono w-32"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setUniversePreset("all")
            }}
          />
          <span className="text-gray-400 text-[11px]">Hasta:</span>
          <input
            type="date"
            className="input-field text-xs p-1 font-mono w-32"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setUniversePreset("all")
            }}
          />
        </div>
      </div>

      {/* Differentiated KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Cheques en Cartera */}
        <div className="card p-3.5 border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-amber-700 dark:text-amber-300">En Cartera (Bóveda)</span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-base font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
            {summary ? formatPYG(summary.total_cartera) : "—"}
          </p>
          <div className="flex justify-between text-[10px] text-gray-500 mt-0.5 font-mono">
            <span>{summary?.cant_cartera || 0} cheques</span>
            <span className="text-amber-700 font-bold">₲ {summary ? formatPYG(summary.total_cartera_al_dia) : 0} al día</span>
          </div>
        </div>

        {/* 2. Cheques Depositados */}
        <div className="card p-3.5 border-l-4 border-l-blue-500 bg-blue-50/40 dark:bg-blue-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-blue-700 dark:text-blue-300">En Clearing Bancario</span>
            <Landmark className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-base font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
            {summary ? formatPYG(summary.total_depositado) : "—"}
          </p>
          <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">
            {summary?.cant_depositado || 0} cheques depositados
          </span>
        </div>

        {/* 3. Cheques Acreditados */}
        <div className="card p-3.5 border-l-4 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-700 dark:text-emerald-300">Acreditados / Cobrados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {summary ? formatPYG(summary.total_acreditado) : "—"}
          </p>
          <span className="text-[10px] text-emerald-600 mt-0.5 block font-bold font-mono">
            {summary?.cant_acreditado || 0} cheques efectivizados
          </span>
        </div>

        {/* 4. Cheques Rechazados */}
        <div className="card p-3.5 border-l-4 border-l-red-500 bg-red-50/40 dark:bg-red-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-red-700 dark:text-red-300">Rechazados (Riesgo)</span>
            <AlertOctagon className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-base font-black font-mono text-red-600 dark:text-red-400 mt-1">
            {summary ? formatPYG(summary.total_rechazado) : "—"}
          </p>
          <span className="text-[10px] text-red-600 mt-0.5 block font-bold font-mono">
            {summary?.cant_rechazado || 0} en gestión de recupero
          </span>
        </div>

        {/* 5. Pagarés Activos */}
        <div className="card p-3.5 border-l-4 border-l-purple-500 bg-purple-50/40 dark:bg-purple-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-purple-700 dark:text-purple-300">Pagarés Activos</span>
            <CreditCard className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-base font-black font-mono text-purple-900 dark:text-purple-200 mt-1">
            {summary ? formatPYG(summary.total_pagares_activos) : "—"}
          </p>
          <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">
            {summary?.cant_pagares_activos || 0} documentos firmados
          </span>
        </div>

        {/* 6. Pagarés Vencidos */}
        <div className="card p-3.5 border-l-4 border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-rose-700 dark:text-rose-300">Pagarés en Mora</span>
            <Scale className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-base font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
            {summary ? formatPYG(summary.total_pagares_vencidos) : "—"}
          </p>
          <span className="text-[10px] text-rose-600 mt-0.5 block font-bold font-mono">
            {summary?.cant_pagares_vencidos || 0} vencidos exigibles
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: "cartera", label: "🪙 En Cartera (Bóveda)", count: checks.filter(c => c.tipo === "cheque" && c.estado === "cartera").length },
            { id: "depositados", label: "🏦 En Clearing Bancario", count: checks.filter(c => c.tipo === "cheque" && c.estado === "depositado").length },
            { id: "rechazados", label: "🚨 Cheques Rechazados & Recupero", count: checks.filter(c => c.tipo === "cheque" && c.estado === "rechazado").length },
            { id: "pagares", label: "📜 Pagarés & Títulos Ejecutivos", count: checks.filter(c => c.tipo === "pagare").length },
            { id: "todos", label: "📋 Todos los Documentos", count: checks.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-9 text-xs font-medium w-full"
            placeholder="Buscar por N° cheque, banco, cliente, RUC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Tipo / Número</th>
                <th className="table-cell">Cliente / Librador</th>
                <th className="table-cell">Banco / Plaza</th>
                <th className="table-cell">F. Vencimiento</th>
                <th className="table-cell text-right">Monto (₲)</th>
                <th className="table-cell text-center">Plazo / Vencimiento</th>
                <th className="table-cell text-center">Estado</th>
                <th className="table-cell text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Cargando documentos de valor...</td></tr>
              ) : filteredChecks.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No se encontraron documentos para esta vista</td></tr>
              ) : (
                filteredChecks.map((c) => {
                  const custName = c.customer_name || customers.find(cu => cu.id === c.customer_id)?.razon_social || "Cliente General"
                  const custRuc = c.customer_ruc || customers.find(cu => cu.id === c.customer_id)?.ruc || ""
                  const diasVencido = Number(c.dias_vencido || 0)
                  const diasCobro = Number(c.dias_para_cobro || 0)

                  return (
                    <tr key={c.id} className="table-row hover:bg-gray-50 dark:hover:bg-slate-800/60">
                      <td className="table-td">
                        <div className="font-mono font-bold text-primary flex items-center gap-1.5">
                          {c.tipo === "cheque" ? (
                            <Banknote className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                          )}
                          <span>{c.tipo.toUpperCase()} #{c.numero}</span>
                        </div>
                        {c.reemplaza_check_id && (
                          <span className="text-[10px] text-indigo-500 font-medium block">
                            ↳ Reemplaza a cheque anterior
                          </span>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="font-semibold text-gray-900 dark:text-white">{custName}</div>
                        {custRuc && <div className="text-[10px] text-gray-400 font-mono">RUC: {custRuc}</div>}
                      </td>
                      <td className="table-td text-gray-700 dark:text-gray-300">
                        {c.banco ? (
                          <div className="font-medium flex items-center gap-1">
                            <Landmark className="w-3 h-3 text-gray-400" />
                            <span>{c.banco}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Pagaré Notarial</span>
                        )}
                        {c.titular && <div className="text-[10px] text-gray-400">Tit: {c.titular}</div>}
                      </td>
                      <td className="table-td font-mono font-medium text-gray-800 dark:text-gray-200">
                        {formatDate(c.fecha_vencimiento)}
                      </td>
                      <td className="table-td text-right font-mono font-black text-sm text-gray-900 dark:text-white">
                        {formatPYG(c.monto)}
                      </td>
                      <td className="table-td text-center font-mono text-[11px]">
                        {c.estado === "rechazado" ? (
                          <span className="text-red-600 font-bold bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">
                            {diasVencido > 0 ? `${diasVencido}d en mora` : "Rechazado"}
                          </span>
                        ) : diasVencido > 0 ? (
                          <span className="text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
                            Vencido ({diasVencido}d)
                          </span>
                        ) : diasCobro === 0 ? (
                          <span className="text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                            Al Día (Hoy)
                          </span>
                        ) : (
                          <span className="text-blue-600 font-medium bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
                            En {diasCobro} días
                          </span>
                        )}
                      </td>
                      <td className="table-td text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.estado === "cartera" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                          c.estado === "depositado" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" :
                          c.estado === "acreditado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                          c.estado === "rechazado" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" :
                          "bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300"
                        }`}>
                          {c.estado.toUpperCase()}
                        </span>
                      </td>
                      <td className="table-td text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openDetail(c)}
                            className="btn-ghost p-1.5 text-primary hover:bg-primary/10 rounded"
                            title="Ver trazabilidad e historial"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {c.estado === "cartera" && (
                            <button
                              onClick={() => handleAdvanceStatus(c, "depositado")}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] flex items-center gap-1 shadow-sm"
                              title="Depositar en banco"
                            >
                              <Landmark className="w-3 h-3" />
                              <span>Depositar</span>
                            </button>
                          )}

                          {c.estado === "depositado" && (
                            <>
                              <button
                                onClick={() => handleAdvanceStatus(c, "acreditado")}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] flex items-center gap-1 shadow-sm"
                                title="Confirmar fondos cobrados"
                              >
                                <Check className="w-3 h-3" />
                                <span>Acreditar</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelected(c)
                                  setShowReject(true)
                                }}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[10px] flex items-center gap-1 shadow-sm"
                                title="Registrar rechazo bancario"
                              >
                                <X className="w-3 h-3" />
                                <span>Rechazar</span>
                              </button>
                            </>
                          )}

                          {c.estado === "rechazado" && (
                            <>
                              <button
                                onClick={() => {
                                  setSelected(c)
                                  setShowCashSettleModal(true)
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] flex items-center gap-1 shadow-sm"
                                title="Canjear por efectivo en Tesorería"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>Efectivo</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelected(c)
                                  setReplaceForm({
                                    numero: "",
                                    banco: c.banco || "",
                                    titular: c.titular || "",
                                    fecha_vencimiento: new Date().toISOString().split("T")[0]
                                  })
                                  setShowReplace(true)
                                }}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-[10px] flex items-center gap-1 shadow-sm"
                                title="Sustituir por nuevo cheque"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Canjear Cheque</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Ficha & Trazabilidad del Documento */}
      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-900 to-slate-900 text-white rounded-t-xl">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/20 px-2.5 py-0.5 rounded-full">
                    Expediente de Valor
                  </span>
                  <h3 className="text-xl font-bold font-mono text-white mt-1">
                    {selected.tipo.toUpperCase()} #{selected.numero}
                  </h3>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Monto: <strong>₲ {formatPYG(selected.monto)}</strong> · Cliente: <strong>{selected.customer_name}</strong>
                  </p>
                </div>
                <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 space-y-6 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-gray-400 block">Banco Emisor:</span>
                  <span className="font-bold text-gray-900 dark:text-white text-sm">{selected.banco || "Pagaré"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Titular de Cuenta / Librador:</span>
                  <span className="font-bold text-gray-900 dark:text-white text-sm">{selected.titular || "S/Titular"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Fecha de Emisión:</span>
                  <span className="font-mono text-gray-800 dark:text-gray-200">{formatDate(selected.fecha_emision)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Fecha de Vencimiento / Cobro:</span>
                  <span className="font-mono font-bold text-primary">{formatDate(selected.fecha_vencimiento)}</span>
                </div>
              </div>

              {selected.observaciones && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/40">
                  <span className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300 block mb-1">Observaciones / Notas:</span>
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">{selected.observaciones}</p>
                </div>
              )}

              {/* Timeline of Check Events */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5 mb-3">
                  <History className="w-4 h-4 text-primary" />
                  Línea de Tiempo & Trazabilidad de Estados
                </h4>

                {events.length === 0 ? (
                  <p className="text-gray-400 italic">Sin eventos de cambio de estado registrados.</p>
                ) : (
                  <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700 pl-6">
                    {events.map((ev, idx) => (
                      <div key={ev.id || idx} className="relative">
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-white dark:ring-slate-900" />
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900 dark:text-white uppercase text-[11px]">
                              {ev.estado_anterior ? `${ev.estado_anterior} ➔ ${ev.estado_nuevo}` : `Ingreso inicial: ${ev.estado_nuevo}`}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400">{formatDate(ev.created_at)}</span>
                          </div>
                          {ev.motivo && (
                            <p className="text-gray-600 dark:text-gray-300 mt-1 italic">{ev.motivo}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowDetail(false)} className="btn-ghost">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Registrar Rechazo Bancario */}
      {showReject && selected && (
        <div className="modal-overlay" onClick={() => setShowReject(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-red-900 text-white rounded-t-xl">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <AlertOctagon className="w-5 h-5" />
                Registrar Rechazo Bancario
              </h3>
              <p className="text-xs text-red-200 mt-1">Cheque #{selected.numero} · {formatPYG(selected.monto)}</p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-gray-600 dark:text-gray-300">
                Al confirmar el rechazo, <strong>se reabrirá automáticamente el saldo deudor</strong> del cliente en Cuentas por Cobrar y se registrará en su historial de scoring.
              </p>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">Causal Bancaria de Rechazo</label>
                <select
                  className="input-field text-xs w-full"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                >
                  {REJECTION_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowReject(false)} className="btn-ghost">Cancelar</button>
                <button 
                  onClick={handleReject} 
                  disabled={submitting}
                  className="btn-primary bg-red-600 hover:bg-red-700 flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Confirmar Rechazo Bancario</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Canjear Cheque Rechazado por Nuevo Cheque */}
      {showReplace && selected && (
        <div className="modal-overlay" onClick={() => setShowReplace(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-indigo-900 text-white rounded-t-xl">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5" />
                Canjear por Nuevo Cheque
              </h3>
              <p className="text-xs text-indigo-200 mt-1">Reemplazo de Cheque #{selected.numero} (₲ {formatPYG(selected.monto)})</p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Nuevo Número de Cheque</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 0098472"
                  className="input-field text-xs w-full font-mono"
                  value={replaceForm.numero}
                  onChange={(e) => setReplaceForm({ ...replaceForm, numero: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Banco Emisor</label>
                <input
                  type="text"
                  placeholder="Ej: Banco Itaú, Continental..."
                  className="input-field text-xs w-full"
                  value={replaceForm.banco}
                  onChange={(e) => setReplaceForm({ ...replaceForm, banco: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Titular / Librador</label>
                <input
                  type="text"
                  placeholder="Nombre de la cuenta libradora"
                  className="input-field text-xs w-full"
                  value={replaceForm.titular}
                  onChange={(e) => setReplaceForm({ ...replaceForm, titular: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Nueva Fecha de Vencimiento / Cobro</label>
                <input
                  type="date"
                  required
                  className="input-field text-xs w-full font-mono"
                  value={replaceForm.fecha_vencimiento}
                  onChange={(e) => setReplaceForm({ ...replaceForm, fecha_vencimiento: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowReplace(false)} className="btn-ghost">Cancelar</button>
                <button 
                  onClick={handleReplace} 
                  disabled={submitting}
                  className="btn-primary bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Efectivizar Canje de Cheque</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Recupero en Efectivo Directo de Cheque Rechazado */}
      {showCashSettleModal && selected && (
        <div className="modal-overlay" onClick={() => setShowCashSettleModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-emerald-900 text-white rounded-t-xl">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Recupero en Efectivo Directo
              </h3>
              <p className="text-xs text-emerald-200 mt-1">Cheque #{selected.numero} · ₲ {formatPYG(selected.monto)}</p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900/40 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cliente:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selected.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monto a Ingresar en Caja:</span>
                  <span className="font-mono font-black text-emerald-600 text-sm">{formatPYG(selected.monto)}</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Responsable de Cobro / Tesorería</label>
                <input
                  type="text"
                  className="input-field text-xs w-full"
                  value={cashSettleUser}
                  onChange={(e) => setCashSettleUser(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Observación de Recupero</label>
                <input
                  type="text"
                  className="input-field text-xs w-full"
                  value={cashSettleObs}
                  onChange={(e) => setCashSettleObs(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowCashSettleModal(false)} className="btn-ghost">Cancelar</button>
                <button 
                  onClick={handleCashSettle} 
                  disabled={submitting}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Ingreso en Efectivo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Crear Nuevo Cheque / Pagaré */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-900 text-white rounded-t-xl">
              <h3 className="text-xl font-bold">Nuevo Ingreso de Cheque / Pagaré</h3>
              <p className="text-xs text-gray-400 mt-1">Registra la recepción física de un documento a la orden</p>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCreateForm({ ...createForm, tipo: "cheque" })}
                  className={`p-2.5 rounded-lg font-bold text-center border transition-all ${
                    createForm.tipo === "cheque"
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-gray-200 dark:border-gray-700 text-gray-500"
                  }`}
                >
                  🪙 Cheque de Tercero
                </button>
                <button
                  type="button"
                  onClick={() => setCreateForm({ ...createForm, tipo: "pagare" })}
                  className={`p-2.5 rounded-lg font-bold text-center border transition-all ${
                    createForm.tipo === "pagare"
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-gray-200 dark:border-gray-700 text-gray-500"
                  }`}
                >
                  📜 Pagaré Notarial
                </button>
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Cliente Librador</label>
                <select
                  required
                  className="input-field text-xs w-full"
                  value={createForm.customer_id}
                  onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}
                >
                  <option value="">Seleccionar cliente...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.razon_social} ({c.ruc})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Número de Documento</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 0018471"
                    className="input-field font-mono text-xs w-full"
                    value={createForm.numero}
                    onChange={(e) => setCreateForm({ ...createForm, numero: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Monto (₲)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="input-field font-mono text-xs w-full"
                    value={createForm.monto}
                    onChange={(e) => setCreateForm({ ...createForm, monto: e.target.value })}
                  />
                </div>
              </div>

              {createForm.tipo === "cheque" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Banco</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Banco Itaú"
                      className="input-field text-xs w-full"
                      value={createForm.banco}
                      onChange={(e) => setCreateForm({ ...createForm, banco: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Titular</label>
                    <input
                      type="text"
                      placeholder="Nombre del librador"
                      className="input-field text-xs w-full"
                      value={createForm.titular}
                      onChange={(e) => setCreateForm({ ...createForm, titular: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Fecha Emisión</label>
                  <input
                    type="date"
                    required
                    className="input-field font-mono text-xs w-full"
                    value={createForm.fecha_emision}
                    onChange={(e) => setCreateForm({ ...createForm, fecha_emision: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Fecha Vencimiento / Cobro</label>
                  <input
                    type="date"
                    required
                    className="input-field font-mono text-xs w-full"
                    value={createForm.fecha_vencimiento}
                    onChange={(e) => setCreateForm({ ...createForm, fecha_vencimiento: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary">Ingresar a Cartera</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
