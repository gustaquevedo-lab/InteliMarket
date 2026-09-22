import { useState, useEffect } from "react"
import {
  Ticket,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign,
  Loader2,
  Printer,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  FileText,
  Copy,
  Plus,
  Check,
  X,
  ChevronDown,
  Info,
  BarChart3,
  Users,
  Wallet,
  Zap,
  FileCheck,
  Hash,
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDateTime, formatDate, getTodayAsuncion } from "../../utils/format"

interface VoucherItem {
  id: string
  numero_vale: string
  codigo_barras: string
  monto_inicial: number
  saldo_disponible: number
  estado: "ACTIVO" | "CANJEADO" | "ANULADO" | "VENCIDO"
  canjeado_at?: string | null
  canjeado_caja_numero?: string | null
  canjeado_en_sale_id?: string | null
  beneficiario_nombre?: string | null
}

interface ConvenioSummary {
  convenio_nombre: string
  total_emitidos: number
  total_canjeados: number
  total_activos: number
  monto_total_emitido: number
  monto_total_canjeado: number
  monto_saldo_calle: number
  factura_emision_numero?: string | null
  cliente_ruc?: string | null
  cliente_razon_social?: string | null
  vales: VoucherItem[]
}

interface ConvenioListItem {
  convenio_nombre: string
  cliente_ruc?: string | null
  cliente_razon_social?: string | null
  total_vales: number
  monto_total: number
  max_vencimiento?: string | null
  factura_numero?: string | null
}

type MainTab = "vales" | "convenios"

export default function VouchersPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [convenios, setConvenios] = useState<ConvenioListItem[]>([])
  const [selectedConvenio, setSelectedConvenio] = useState("Universidad del Pacífico")
  const [summary, setSummary] = useState<ConvenioSummary | null>(null)
  const [search, setSearch] = useState("")
  const [filterState, setFilterState] = useState<"ALL" | "ACTIVO" | "CANJEADO">("ALL")
  const [seeding, setSeeding] = useState(false)
  const [mainTab, setMainTab] = useState<MainTab>("vales")

  // Verificador en vivo
  const [quickCode, setQuickCode] = useState("")
  const [quickResult, setQuickResult] = useState<any>(null)
  const [checkingQuick, setCheckingQuick] = useState(false)

  // Facturación del Convenio
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceNumberInput, setInvoiceNumberInput] = useState("")
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [copiedData, setCopiedData] = useState(false)

  // Modal Nuevo Lote
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchForm, setBatchForm] = useState({
    convenio_nombre: "",
    cliente_ruc: "",
    cliente_razon_social: "",
    total_vales: 50,
    monto_por_vale: 100000,
    fecha_vencimiento: "2026-12-31",
    factura_numero: "",
    prefijo_codigo: "",
  })
  const [savingBatch, setSavingBatch] = useState(false)

  const loadConveniosList = async () => {
    try {
      const list = await api.vouchers.listConvenios()
      if (Array.isArray(list) && list.length > 0) {
        setConvenios(list)
        if (!list.some(c => c.convenio_nombre === selectedConvenio)) {
          setSelectedConvenio(list[0].convenio_nombre)
        }
      }
    } catch (e) {
      console.warn("Error cargando lista de convenios:", e)
    }
  }

  const fetchSummary = async (convenioTarget = selectedConvenio) => {
    try {
      setLoading(true)
      const data = await api.vouchers.summary(convenioTarget)
      setSummary(data)
      if (data?.factura_emision_numero) {
        setInvoiceNumberInput(data.factura_emision_numero)
      } else {
        setInvoiceNumberInput("")
      }
    } catch (err: any) {
      toast.error("Error al cargar vales", err?.message || "No se pudo obtener el resumen de convenios")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadConveniosList() }, [])
  useEffect(() => { fetchSummary(selectedConvenio) }, [selectedConvenio])

  const handleSeedUP = async () => {
    try {
      setSeeding(true)
      const res = await api.vouchers.seedUP({ total_vales: 75, monto_por_vale: 100000, fecha_vencimiento: "2026-12-31" })
      toast.success("Lote UP Inicializado", `Se sembraron ${res.creados} vales nuevos (${res.existentes} ya existían).`)
      fetchSummary(selectedConvenio)
    } catch (err: any) {
      toast.error("Error al sembrar vales", err?.message || "Error del servidor")
    } finally {
      setSeeding(false)
    }
  }

  const handleQuickCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickCode.trim()) return
    try {
      setCheckingQuick(true)
      setQuickResult(null)
      const res = await api.vouchers.check(quickCode.trim())
      setQuickResult(res)
    } catch (err: any) {
      toast.error("Error al verificar", err?.message || "No se pudo consultar el estado del vale")
    } finally {
      setCheckingQuick(false)
    }
  }

  const handleLinkInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoiceNumberInput.trim()) { toast.error("Falta número", "Ingresá el número de factura emitida"); return }
    try {
      setSavingInvoice(true)
      const res = await api.vouchers.linkInvoice({ convenio_nombre: selectedConvenio, factura_numero: invoiceNumberInput.trim() })
      toast.success("Factura Vinculada", `Factura N° ${res.factura_numero} vinculada a ${res.vales_actualizados} vales de '${selectedConvenio}'.`)
      setShowInvoiceModal(false)
      fetchSummary(selectedConvenio)
    } catch (err: any) {
      toast.error("Error al vincular", err?.message || "No se pudo guardar el número de factura")
    } finally {
      setSavingInvoice(false)
    }
  }

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchForm.convenio_nombre.trim() || batchForm.total_vales <= 0 || batchForm.monto_por_vale <= 0) {
      toast.error("Datos incompletos", "Completá nombre de convenio, cantidad de vales y monto"); return
    }
    try {
      setSavingBatch(true)
      const res = await api.vouchers.createBatch(batchForm)
      toast.success("Lote de Vales Creado", `Se crearon ${res.creados} vales para '${res.convenio}' por un total de Gs. ${res.monto_total.toLocaleString("es-PY")}.`)
      setShowBatchModal(false)
      setBatchForm({ convenio_nombre: "", cliente_ruc: "", cliente_razon_social: "", total_vales: 50, monto_por_vale: 100000, fecha_vencimiento: "2026-12-31", factura_numero: "", prefijo_codigo: "" })
      loadConveniosList()
      fetchSummary(selectedConvenio)
    } catch (err: any) {
      toast.error("Error al crear lote", err?.message || "No se pudo crear el lote de vales")
    } finally {
      setSavingBatch(false)
    }
  }

  const handleCopyBillingData = () => {
    const data = [
      `Convenio: VALES DE COMPRA PREPAGO - CONVENIO INSTITUCIONAL`,
      `Razón Social: ${summary?.cliente_razon_social || summary?.convenio_nombre || selectedConvenio}`,
      `RUC: ${summary?.cliente_ruc || "—"}`,
      `Concepto: VALES DE COMPRA PREPAGO - CONVENIO INSTITUCIONAL`,
      `IVA Aplicable: EXENTA (0%)`,
      `Cantidad: ${summary?.total_emitidos || 0} vales emitidos`,
      `Total a Facturar: ${formatPYG(summary?.monto_total_emitido || 0)}`,
    ].join("\n")
    navigator.clipboard.writeText(data).catch(() => {})
    setCopiedData(true)
    toast.success("Copiado al Portapapeles", "Datos fiscales listos para pegar en el emisor de facturas.")
    setTimeout(() => setCopiedData(false), 3000)
  }

  const filteredVales = (summary?.vales || []).filter(v => {
    const matchesSearch =
      v.numero_vale.toLowerCase().includes(search.toLowerCase()) ||
      v.codigo_barras.toLowerCase().includes(search.toLowerCase()) ||
      (v.beneficiario_nombre && v.beneficiario_nombre.toLowerCase().includes(search.toLowerCase())) ||
      (v.canjeado_caja_numero && v.canjeado_caja_numero.toLowerCase().includes(search.toLowerCase()))
    if (filterState === "ALL") return matchesSearch
    return matchesSearch && v.estado === filterState
  })

  // Analytics reactivas
  const pctCanjeado = summary?.total_emitidos
    ? Math.round(((summary.total_canjeados || 0) / summary.total_emitidos) * 100)
    : 0

  return (
    <div className="space-y-6 pb-20 animate-fade-in min-w-0">
      {/* ═══════════════════════════════════════════════════════════════════
          🌟 HERO INSTITUCIONAL — VALES Y CONVENIOS CORPORATIVOS
      ════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 border border-slate-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-600/30 text-white font-black">
                <Ticket className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Convenios Corporativos &amp; Vales Prepago
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    {convenios.length} Convenios Registrados
                  </span>
                  {summary?.factura_emision_numero && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      <FileCheck className="w-3 h-3" />
                      Fact. {summary.factura_emision_numero}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Vales y Convenios
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Control unitario de vales prepago institucionales, trazabilidad de canje en cajas, arqueo fiscal y facturación EXENTA (0% IVA).
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                🎟 {summary?.total_emitidos || 0} vales emitidos
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-orange-300">
                💰 {formatPYG(summary?.monto_total_emitido || 0)} facial total
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                ⏳ {formatPYG(summary?.monto_saldo_calle || 0)} en calle
              </span>
            </div>
          </div>

          {/* Acciones de cabecera */}
          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => fetchSummary(selectedConvenio)}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition shadow-sm"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-400" : ""}`} />
            </button>

            <button
              onClick={() => setShowInvoiceModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              <span>{summary?.factura_emision_numero ? `Fact. ${summary.factura_emision_numero}` : "Datos Fiscales"}</span>
            </button>

            {(!summary || summary.total_emitidos === 0) && (
              <button
                onClick={handleSeedUP}
                disabled={seeding}
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
                <span>Sembrar Lote UP</span>
              </button>
            )}

            <button
              onClick={() => {
                setBatchForm({ convenio_nombre: "", cliente_ruc: "", cliente_razon_social: "", total_vales: 50, monto_por_vale: 100000, fecha_vencimiento: "2026-12-31", factura_numero: "", prefijo_codigo: "" })
                setShowBatchModal(true)
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-md shadow-amber-950/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Convenio / Lote</span>
            </button>
          </div>
        </div>

        {/* ═══ SELECTOR DE CONVENIO + KPI EJECUTIVAS ════════════════════════════ */}
        <div className="mt-6 pt-6 border-t border-slate-800/80">
          {/* Selector de convenio */}
          {convenios.length > 0 && (
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Convenio activo:</span>
              <div className="relative inline-block">
                <select
                  value={selectedConvenio}
                  onChange={e => setSelectedConvenio(e.target.value)}
                  className="appearance-none bg-slate-800/80 border border-amber-500/40 text-amber-300 font-black text-xs px-3 py-1.5 pr-8 rounded-xl outline-none cursor-pointer hover:border-amber-400/60 transition"
                >
                  {convenios.map(c => (
                    <option key={c.convenio_nombre} value={c.convenio_nombre} className="bg-slate-900 text-white">
                      {c.convenio_nombre} ({c.total_vales} vales)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
              </div>
              {summary?.cliente_ruc && (
                <span className="font-mono text-[11px] text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60">
                  RUC: {summary.cliente_ruc}
                </span>
              )}
              {summary?.cliente_razon_social && (
                <span className="text-[11px] text-slate-400 font-medium truncate max-w-xs">
                  {summary.cliente_razon_social}
                </span>
              )}
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {/* Emitidos */}
            <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Emitidos</span>
                <Ticket className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-amber-400">{summary?.total_emitidos || 0}</p>
              <p className="text-[11px] text-slate-400 font-mono">{formatPYG(summary?.monto_total_emitido || 0)}</p>
            </div>

            {/* Canjeados */}
            <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Canjeados</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">{summary?.total_canjeados || 0}</p>
              <p className="text-[11px] text-emerald-400 font-mono font-bold">{formatPYG(summary?.monto_total_canjeado || 0)}</p>
            </div>

            {/* En Calle */}
            <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En Calle</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-amber-400">{summary?.total_activos || 0}</p>
              <p className="text-[11px] text-amber-400 font-mono font-bold">{formatPYG(summary?.monto_saldo_calle || 0)}</p>
            </div>

            {/* % Canje */}
            <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">% Canje</span>
                <BarChart3 className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-2xl font-black font-mono tracking-tight text-blue-300">{pctCanjeado}%</p>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 rounded-full transition-all" style={{ width: `${pctCanjeado}%` }} />
              </div>
            </div>

            {/* Factura Fiscal */}
            <div
              onClick={() => setShowInvoiceModal(true)}
              className="space-y-1 bg-slate-900/60 hover:bg-slate-850 p-3.5 rounded-2xl border border-slate-800/80 hover:border-blue-500/40 transition cursor-pointer group"
              title="Ver datos de facturación legal"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 group-hover:text-blue-300 uppercase tracking-wider">Factura Fiscal</span>
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-sm font-black font-mono tracking-tight text-blue-300 truncate">
                {summary?.factura_emision_numero || "Pendiente"}
              </p>
              <p className="text-[11px] text-slate-400 group-hover:text-blue-400 flex items-center gap-1 font-bold">
                EXENTA 0% IVA <ArrowRight className="w-3 h-3" />
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          🔍 VERIFICADOR EN VIVO DE CÓDIGO DE BARRAS
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-900 dark:text-white">Verificador de Vale en Vivo</p>
            <p className="text-[11px] text-slate-400">Escanee con pistola lectora o ingrese el código corto del vale</p>
          </div>
        </div>
        <div className="p-4">
          <form onSubmit={handleQuickCheck} className="flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={quickCode}
                onChange={e => setQuickCode(e.target.value)}
                placeholder="Ej: 001, VALE-001, UP-075, código de barras completo..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={checkingQuick || !quickCode.trim()}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
            >
              {checkingQuick ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verificar
            </button>
          </form>

          {quickResult && (
            <div className={`mt-4 p-4 rounded-xl border flex items-start justify-between gap-4 text-xs font-bold ${
              quickResult.es_valido
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800/60 text-red-800 dark:text-red-300"
            }`}>
              <div className="flex items-start gap-3">
                {quickResult.es_valido
                  ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
                  : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                }
                <div>
                  <p className="font-black text-sm">{quickResult.mensaje}</p>
                  <p className="font-normal opacity-80 mt-0.5">
                    Convenio: <strong>{quickResult.convenio_nombre}</strong>
                    {quickResult.fecha_vencimiento && ` • Vence: ${formatDate(quickResult.fecha_vencimiento)}`}
                    {quickResult.saldo_disponible != null && ` • Saldo: ${formatPYG(quickResult.saldo_disponible)}`}
                  </p>
                </div>
              </div>
              <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-black/10 dark:bg-white/10 shrink-0">
                {quickResult.estado}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          🧭 NAVEGACIÓN POR PESTAÑAS GLASSMORPHISM
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-100 dark:bg-slate-850/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 shadow-sm">
        {([
          { id: "vales" as MainTab, label: "Vales del Convenio", icon: Ticket, count: filteredVales.length },
          { id: "convenios" as MainTab, label: "Catálogo de Convenios", icon: Users, count: convenios.length },
        ]).map(t => {
          const Icon = t.icon
          const active = mainTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                active
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: LISTADO DE VALES
      ════════════════════════════════════════════════════════════════════ */}
      {mainTab === "vales" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Barra de filtros */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-slate-900 dark:text-white text-sm">
                Listado de Vales
              </h2>
              {summary?.factura_emision_numero && (
                <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
                  Factura N° {summary.factura_emision_numero}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Segmented control */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
                {([
                  { k: "ALL" as const, label: `Todos (${summary?.vales?.length || 0})` },
                  { k: "ACTIVO" as const, label: `Activos (${summary?.total_activos || 0})` },
                  { k: "CANJEADO" as const, label: `Canjeados (${summary?.total_canjeados || 0})` },
                ]).map(f => (
                  <button
                    key={f.k}
                    onClick={() => setFilterState(f.k)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      filterState === f.k
                        ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Buscador */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar código, caja..."
                  className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-mono outline-none focus:border-amber-500 w-44 transition"
                />
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850/80 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Vale N.º</th>
                  <th className="p-3.5">Código de Barras</th>
                  <th className="p-3.5 text-right">Monto Facial</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5">Fecha/Hora Canje</th>
                  <th className="p-3.5 text-center">Caja</th>
                  <th className="p-3.5">Beneficiario / Venta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                      <p className="text-xs text-slate-400">Cargando vales institucionales...</p>
                    </td>
                  </tr>
                ) : filteredVales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Ticket className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No se encontraron vales</p>
                      <p className="text-xs text-slate-400 mt-1">Probá cambiando el filtro o el término de búsqueda.</p>
                    </td>
                  </tr>
                ) : (
                  filteredVales.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-black font-mono text-slate-900 dark:text-white">
                        VALE N.º {v.numero_vale}
                      </td>
                      <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                        {v.codigo_barras}
                      </td>
                      <td className="p-3.5 text-right font-extrabold text-slate-900 dark:text-white font-mono">
                        {formatPYG(v.monto_inicial)}
                      </td>
                      <td className="p-3.5 text-center">
                        {v.estado === "ACTIVO" ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Activo
                          </span>
                        ) : v.estado === "CANJEADO" ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
                            <Check className="w-3 h-3" />
                            Canjeado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
                            {v.estado}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {v.canjeado_at ? formatDateTime(v.canjeado_at) : "—"}
                      </td>
                      <td className="p-3.5 text-center">
                        {v.canjeado_caja_numero ? (
                          <span className="font-mono font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                            Caja {v.canjeado_caja_numero}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400 text-[11px]">
                        {v.beneficiario_nombre || (v.canjeado_en_sale_id ? `Venta #${v.canjeado_en_sale_id.slice(0, 8)}` : "—")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: CATÁLOGO DE CONVENIOS
      ════════════════════════════════════════════════════════════════════ */}
      {mainTab === "convenios" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-slate-900 dark:text-white text-sm">Catálogo de Convenios</h2>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {convenios.length} convenios
              </span>
            </div>
            <button
              onClick={() => { setBatchForm({ convenio_nombre: "", cliente_ruc: "", cliente_razon_social: "", total_vales: 50, monto_por_vale: 100000, fecha_vencimiento: "2026-12-31", factura_numero: "", prefijo_codigo: "" }); setShowBatchModal(true) }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo Convenio
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850/80 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Institución / Empresa</th>
                  <th className="p-3.5">RUC</th>
                  <th className="p-3.5 text-right">Vales</th>
                  <th className="p-3.5 text-right">Monto Total</th>
                  <th className="p-3.5">Vencimiento</th>
                  <th className="p-3.5">Factura N°</th>
                  <th className="p-3.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {convenios.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No hay convenios registrados</p>
                      <p className="text-xs text-slate-400 mt-1">Creá el primer lote para comenzar a emitir vales corporativos.</p>
                    </td>
                  </tr>
                ) : (
                  convenios.map(c => (
                    <tr
                      key={c.convenio_nombre}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition ${c.convenio_nombre === selectedConvenio ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}
                    >
                      <td className="p-3.5">
                        <p className="font-extrabold text-slate-900 dark:text-white">{c.convenio_nombre}</p>
                        {c.cliente_razon_social && c.cliente_razon_social !== c.convenio_nombre && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{c.cliente_razon_social}</p>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {c.cliente_ruc || "—"}
                      </td>
                      <td className="p-3.5 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                        {c.total_vales}
                      </td>
                      <td className="p-3.5 text-right font-mono font-extrabold text-amber-600 dark:text-amber-400">
                        {formatPYG(c.monto_total)}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {c.max_vencimiento ? formatDate(c.max_vencimiento) : "—"}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                        {c.factura_numero || "—"}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => { setSelectedConvenio(c.convenio_nombre); setMainTab("vales") }}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                            c.convenio_nombre === selectedConvenio
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 dark:hover:text-amber-400"
                          }`}
                        >
                          {c.convenio_nombre === selectedConvenio ? "Activo" : "Ver Vales"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          🧾 MODAL: FACTURACIÓN LEGAL DEL CONVENIO
      ════════════════════════════════════════════════════════════════════ */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    Facturación Legal
                  </h3>
                  <p className="text-xs text-slate-500">
                    {summary?.cliente_razon_social || summary?.convenio_nombre || selectedConvenio}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowInvoiceModal(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ficha fiscal */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Razón Social Cliente</span>
                  <span className="font-bold text-slate-900 dark:text-white">{summary?.cliente_razon_social || summary?.convenio_nombre || selectedConvenio}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">RUC Cliente</span>
                  <span className="font-bold font-mono text-blue-600 dark:text-blue-400">{summary?.cliente_ruc || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Concepto</span>
                  <span className="font-bold text-slate-900 dark:text-white">VALES DE COMPRA PREPAGO - CONVENIO INSTITUCIONAL</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Tasa de IVA</span>
                  <span className="font-black text-amber-600 dark:text-amber-400">EXENTA (0% IVA)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Cantidad</span>
                  <span className="font-bold text-slate-900 dark:text-white">{summary?.total_emitidos || 0} vales emitidos</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total a Facturar</span>
                  <span className="font-black text-slate-900 dark:text-white">{formatPYG(summary?.monto_total_emitido || 0)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-start gap-2 text-[11px] text-slate-500">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p><strong>¿Por qué EXENTA?</strong> Se trata de un anticipo de fondos / medio de pago prepago. El IVA de mercaderías se liquida en las cajas al canjear los vales. El cliente corporativo deduce el 100% en IRE.</p>
              </div>
            </div>

            {/* Formulario de vinculación */}
            <form onSubmit={handleLinkInvoice} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Número de Factura Emitida (*):</label>
                <input
                  type="text"
                  value={invoiceNumberInput}
                  onChange={e => setInvoiceNumberInput(e.target.value)}
                  placeholder="Ej: 001-002-0001234 o número timbrado SIFEN..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">Este número quedará vinculado a todos los vales de este convenio para auditoría fiscal.</p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={handleCopyBillingData} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  {copiedData ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedData ? "Copiado" : "Copiar Ficha Fiscal"}
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setShowInvoiceModal(false)} className="px-4 py-2 rounded-xl text-slate-500 font-bold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cerrar</button>
                  <button type="submit" disabled={savingInvoice || !invoiceNumberInput.trim()} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 transition">
                    {savingInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Guardar Vinculación
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ➕ MODAL: NUEVO LOTE / CONVENIO
      ════════════════════════════════════════════════════════════════════ */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">Registrar Nuevo Lote de Vales</h3>
                  <p className="text-xs text-slate-500">Emisión de vales corporativos para cualquier cliente o institución</p>
                </div>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nombre del Convenio / Institución (*)</label>
                <input
                  type="text"
                  required
                  value={batchForm.convenio_nombre}
                  onChange={e => setBatchForm({ ...batchForm, convenio_nombre: e.target.value })}
                  placeholder="Ej: Banco Continental, Cooperativa PJC, Hospital..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold focus:ring-2 focus:ring-amber-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">RUC Cliente</label>
                  <input type="text" value={batchForm.cliente_ruc} onChange={e => setBatchForm({ ...batchForm, cliente_ruc: e.target.value })} placeholder="80012345-6" className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none transition" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Razón Social</label>
                  <input type="text" value={batchForm.cliente_razon_social} onChange={e => setBatchForm({ ...batchForm, cliente_razon_social: e.target.value })} placeholder="Razón Social Completa S.A." className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none transition" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Cantidad de Vales (*)</label>
                  <input type="number" min={1} max={1000} required value={batchForm.total_vales} onChange={e => setBatchForm({ ...batchForm, total_vales: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-bold outline-none transition" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Monto por Vale (₲) (*)</label>
                  <input type="number" step={1000} required value={batchForm.monto_por_vale} onChange={e => setBatchForm({ ...batchForm, monto_por_vale: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-bold outline-none transition" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Fecha de Vencimiento (*)</label>
                  <input type="date" required value={batchForm.fecha_vencimiento} onChange={e => setBatchForm({ ...batchForm, fecha_vencimiento: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none transition" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Prefijo Código (Opcional)</label>
                  <input type="text" value={batchForm.prefijo_codigo} onChange={e => setBatchForm({ ...batchForm, prefijo_codigo: e.target.value })} placeholder="Ej: BC- (genera BC-001...)" className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none transition" />
                </div>
              </div>

              {/* Resumen total reactivo */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <Wallet className="w-4 h-4" />
                  <span className="font-bold">Total a Emitir:</span>
                </div>
                <span className="font-black text-base text-amber-800 dark:text-amber-300 font-mono">
                  {formatPYG(batchForm.total_vales * batchForm.monto_por_vale)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2 rounded-xl text-slate-500 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancelar</button>
                <button type="submit" disabled={savingBatch} className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 transition">
                  {savingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Generar Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
