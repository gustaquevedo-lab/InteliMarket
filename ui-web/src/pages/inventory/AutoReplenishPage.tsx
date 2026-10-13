import { useState, useEffect, useCallback } from "react"
import {
  ClipboardList,
  TrendingUp,
  Search,
  CheckCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Coins,
  Loader2,
  Settings,
  Zap,
  Plus,
  Check,
  X,
  Package,
  Boxes,
  ArrowRight,
  BarChart3,
  AlertCircle,
  Clock,
  Building2,
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, getTodayAsuncion } from "../../utils/format"

type Tab = "suggestions" | "rules" | "crossdock"

interface Suggestion {
  id: string
  producto_id: string
  producto_nombre?: string | null
  proveedor_id?: string | null
  proveedor_nombre?: string | null
  stock_actual: number
  stock_pendiente_recibir: number
  demanda_diaria_avg?: number | null
  demanda_pronosticada?: number | null
  cantidad_sugerida: number
  costo_unitario_estimado?: number | null
  costo_total_estimado?: number | null
  oc_generada: boolean
  oc_numero?: string | null
  estado: string
}

interface Dashboard {
  reglas_activas: number
  sugerencias_pendientes: number
  sugerencias_aprobadas: number
  productos_criticos: number
  crossdock_hoy: number
}

const emptyRuleForm = {
  producto_id: "",
  producto_nombre: "",
  proveedor_preferente_id: "",
  lead_time_dias: 2,
  stock_seguridad_dias: 3,
  stock_seguridad_unidades: "",
  lote_economico: "",
  multiplo_pedido: "",
  metodo_pronostico: "promedio",
  activa: true,
}

const emptyCrossdockForm = {
  producto_id: "",
  producto_nombre: "",
  proveedor_id: "",
  cantidad: "",
  fecha_crossdock: getTodayAsuncion(),
  destino: "gondola",
}

// Las sugerencias se calculan en el backend cruzando stock real, velocidad de
// venta real (ultimos 30 dias) y las reglas configuradas abajo — no hay datos
// inventados. Si no hay reglas configuradas para ningun producto, la tabla
// queda vacia: es esperable, significa que todavia no se definieron umbrales.
export default function AutoReplenishPage() {
  const [tab, setTab] = useState<Tab>("suggestions")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [crossdock, setCrossdock] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [search, setSearch] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [ruleForm, setRuleForm] = useState(emptyRuleForm)
  const [productQuery, setProductQuery] = useState("")
  const [productResults, setProductResults] = useState<any[]>([])
  const [showCrossdockModal, setShowCrossdockModal] = useState(false)
  const [crossdockForm, setCrossdockForm] = useState(emptyCrossdockForm)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const dash = await api.replenishment.dashboard()
      setDashboard(dash)
      if (tab === "suggestions") setSuggestions(await api.replenishment.suggestions.list({ estado: "pendiente" }))
      if (tab === "rules") setRules(await api.replenishment.rules.list())
      if (tab === "crossdock") setCrossdock(await api.replenishment.crossdock.list())
    } catch (e) {
      toast.error("Error", "No se pudo cargar la información de reabastecimiento")
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!showRuleModal && !showCrossdockModal) return
    api.purchases.suppliers().then(setSuppliers).catch(() => {})
  }, [showRuleModal, showCrossdockModal])

  useEffect(() => {
    if (productQuery.trim().length < 2) { setProductResults([]); return }
    const t = setTimeout(() => {
      api.products.list({ search: productQuery }).then(res => setProductResults(res.slice(0, 8))).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [productQuery])

  const handleToggleSelect = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleToggleAll = () => {
    if (selectedItems.length === filteredSuggestions.length) setSelectedItems([])
    else setSelectedItems(filteredSuggestions.map(s => s.id))
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const nuevas = await api.replenishment.generate({})
      toast.success("Sugerencias Generadas", `Se generaron ${nuevas.length} sugerencias nuevas a partir de las reglas activas`)
      load()
    } catch (e) {
      toast.error("Error", "No se pudieron generar sugerencias. ¿Hay reglas de reabastecimiento configuradas?")
    } finally {
      setGenerating(false)
    }
  }

  const handleReview = async (accion: "aprobar" | "rechazar") => {
    if (selectedItems.length === 0) { toast.error("Sin selección", "Seleccioná al menos una sugerencia"); return }
    try {
      await Promise.all(selectedItems.map(id => api.replenishment.suggestions.review(id, { accion })))
      toast.success(accion === "aprobar" ? "Aprobadas" : "Rechazadas", `${selectedItems.length} sugerencias actualizadas`)
      setSelectedItems([])
      load()
    } catch (e) {
      toast.error("Error", "No se pudo actualizar el estado de las sugerencias")
    }
  }

  const handleCreateRule = async () => {
    if (!ruleForm.producto_id) { toast.error("Falta producto", "Elegí un producto real de la lista"); return }
    setSaving(true)
    try {
      await api.replenishment.rules.create({
        producto_id: ruleForm.producto_id,
        proveedor_preferente_id: ruleForm.proveedor_preferente_id || undefined,
        lead_time_dias: Number(ruleForm.lead_time_dias),
        stock_seguridad_dias: Number(ruleForm.stock_seguridad_dias),
        stock_seguridad_unidades: ruleForm.stock_seguridad_unidades ? Number(ruleForm.stock_seguridad_unidades) : undefined,
        lote_economico: ruleForm.lote_economico ? Number(ruleForm.lote_economico) : undefined,
        multiplo_pedido: ruleForm.multiplo_pedido ? Number(ruleForm.multiplo_pedido) : undefined,
        metodo_pronostico: ruleForm.metodo_pronostico,
        activa: ruleForm.activa,
      })
      toast.success("Regla Creada", `Reabastecimiento configurado para ${ruleForm.producto_nombre}`)
      setShowRuleModal(false)
      setRuleForm(emptyRuleForm)
      setProductQuery("")
      load()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo crear la regla")
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCrossdock = async () => {
    if (!crossdockForm.producto_id || !crossdockForm.cantidad) { toast.error("Faltan datos", "Elegí un producto y una cantidad"); return }
    setSaving(true)
    try {
      await api.replenishment.crossdock.create({
        producto_id: crossdockForm.producto_id,
        proveedor_id: crossdockForm.proveedor_id || undefined,
        cantidad: Number(crossdockForm.cantidad),
        fecha_crossdock: crossdockForm.fecha_crossdock,
        destino: crossdockForm.destino,
      })
      toast.success("Orden de Cross-Dock Creada")
      setShowCrossdockModal(false)
      setCrossdockForm(emptyCrossdockForm)
      setProductQuery("")
      load()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo crear la orden")
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteCrossdock = async (id: string) => {
    try {
      const res = await api.replenishment.crossdock.complete(id)
      setCrossdock(prev => prev.map(c => c.id === id ? { ...c, ...res } : c))
      toast.success("Cross-Dock Completado")
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo completar la orden")
    }
  }

  const filteredSuggestions = suggestions.filter(
    s => !search || (s.producto_nombre || "").toLowerCase().includes(search.toLowerCase()) || (s.proveedor_nombre || "").toLowerCase().includes(search.toLowerCase())
  )
  const filteredRules = rules.filter(r => !search || (r.producto_nombre || "").toLowerCase().includes(search.toLowerCase()))

  const totalSuggestedCost = suggestions
    .filter(s => selectedItems.includes(s.id))
    .reduce((sum, s) => sum + (s.costo_total_estimado || 0), 0)

  const tabs: { k: Tab; l: string; i: any; count?: number; badge?: string }[] = [
    { k: "suggestions", l: "Sugerencias de Compra", i: ClipboardList, count: dashboard?.sugerencias_pendientes, badge: dashboard?.sugerencias_pendientes ? "amber" : undefined },
    { k: "rules", l: "Políticas por Producto", i: Settings, count: dashboard?.reglas_activas },
    { k: "crossdock", l: "Cross-Docking", i: Zap, count: dashboard?.crossdock_hoy },
  ]

  return (
    <div className="space-y-6 pb-20 animate-fade-in min-w-0">
      {/* ═══════════════════════════════════════════════════════════════════
          🌟 HERO INSTITUCIONAL — REABASTECIMIENTO PREDICTIVO
      ════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-black">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Motor Predictivo & Prevención de Quiebres
                  </span>
                  {(dashboard?.sugerencias_pendientes ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <AlertTriangle className="w-3 h-3" />
                      {dashboard?.sugerencias_pendientes} Sugerencias Pendientes
                    </span>
                  )}
                  {(dashboard?.productos_criticos ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                      {dashboard?.productos_criticos} Críticos
                    </span>
                  )}
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Reglas de Reposición Automática
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Sugerencias de compra calculadas desde ventas reales confirmadas en POS, stock físico y pronóstico de demanda. Reglas de reposición por producto y logística cross-docking.
                </p>
              </div>
            </div>

            {/* Micro pills */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                ⚙ {dashboard?.reglas_activas ?? "—"} reglas activas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                ✅ {dashboard?.sugerencias_aprobadas ?? "—"} aprobadas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-violet-300">
                ⚡ {dashboard?.crossdock_hoy ?? "—"} cross-dock hoy
              </span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={load}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition shadow-sm"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>

            <button
              onClick={() => { setShowCrossdockModal(true) }}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Zap className="w-4 h-4 text-violet-400" />
              <span>Nueva Cross-Dock</span>
            </button>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <TrendingUp className="w-4 h-4 text-indigo-400" />}
              <span>{generating ? "Generando..." : "Generar Sugerencias"}</span>
            </button>

            <button
              onClick={() => { setShowRuleModal(true) }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-md shadow-indigo-950/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Regla</span>
            </button>
          </div>
        </div>

        {/* ═══ KPI EJECUTIVAS ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          {/* Reglas activas */}
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reglas Activas</span>
              <Settings className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-indigo-300">{dashboard?.reglas_activas ?? "—"}</p>
            <p className="text-[11px] text-slate-400">Productos configurados</p>
          </div>

          {/* Sugerencias pendientes */}
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sugerencias</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">{dashboard?.sugerencias_pendientes ?? "—"}</p>
            <p className="text-[11px] text-amber-400 font-mono font-bold">Pendientes revisión</p>
          </div>

          {/* Inversión requerida */}
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inversión</span>
              <Coins className="w-4 h-4 text-orange-400" />
            </div>
            <p className="text-lg font-black font-mono tracking-tight text-orange-300 truncate" title={formatPYG(suggestions.reduce((s, x) => s + (x.costo_total_estimado || 0), 0))}>
              {formatPYG(suggestions.reduce((s, x) => s + (x.costo_total_estimado || 0), 0))}
            </p>
            <p className="text-[11px] text-slate-400">Costo estimado total</p>
          </div>

          {/* Aprobadas */}
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aprobadas</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">{dashboard?.sugerencias_aprobadas ?? "—"}</p>
            <p className="text-[11px] text-slate-400">Enviadas a compras</p>
          </div>

          {/* Cross-dock hoy */}
          <div
            onClick={() => { setTab("crossdock"); setSearch("") }}
            className="space-y-1 bg-slate-900/60 hover:bg-slate-850 p-3.5 rounded-2xl border border-slate-800/80 hover:border-violet-500/40 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 group-hover:text-violet-300 uppercase tracking-wider">Cross-Dock Hoy</span>
              <Zap className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-violet-300">{dashboard?.crossdock_hoy ?? "—"}</p>
            <p className="text-[11px] text-slate-400 group-hover:text-violet-400 flex items-center gap-1 font-bold">
              Ver órdenes <ArrowRight className="w-3 h-3" />
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          🧭 NAVEGACIÓN POR PESTAÑAS GLASSMORPHISM
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-100 dark:bg-slate-850/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 shadow-sm">
        {tabs.map(t => {
          const Icon = t.i
          const active = tab === t.k
          return (
            <button
              key={t.k}
              onClick={() => { setTab(t.k); setSearch(""); setSelectedItems([]) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.l}</span>
              {t.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  active
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    : t.badge === "amber" && (t.count ?? 0) > 0
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: SUGERENCIAS DE COMPRA
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "suggestions" && (
        <div className="space-y-4">
          {/* Barra de herramientas */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                placeholder="Buscar por producto o proveedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 ml-auto flex-wrap">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Regenerar
              </button>
              <button
                onClick={() => handleReview("aprobar")}
                disabled={selectedItems.length === 0}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Aprobar {selectedItems.length > 0 ? `(${selectedItems.length})` : ""}
              </button>
              <button
                onClick={() => handleReview("rechazar")}
                disabled={selectedItems.length === 0}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Rechazar
              </button>
            </div>
          </div>

          {/* Banner inversión seleccionada */}
          {selectedItems.length > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-3.5 flex items-center gap-3 text-xs">
              <Coins className="w-4 h-4 text-indigo-500" />
              <span className="text-slate-600 dark:text-slate-400 font-medium">Inversión seleccionada ({selectedItems.length} ítem{selectedItems.length !== 1 ? "s" : ""}):</span>
              <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono text-sm">{formatPYG(totalSuggestedCost)}</span>
            </div>
          )}

          {/* Tabla de sugerencias */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {filteredSuggestions.length === 0 && !loading ? (
              <div className="text-center py-20">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Sin sugerencias pendientes</p>
                <p className="text-xs text-slate-400 mt-1">Configurá reglas de reabastecimiento y generá sugerencias desde el motor predictivo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-850/80 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5 w-12 text-center">
                        <button onClick={handleToggleAll} className="p-1 hover:text-indigo-600 transition" title="Seleccionar todas">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            selectedItems.length > 0 && selectedItems.length === filteredSuggestions.length
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-slate-400 dark:border-slate-600"
                          }`}>
                            {selectedItems.length > 0 && selectedItems.length === filteredSuggestions.length && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </button>
                      </th>
                      <th className="p-3.5">Producto</th>
                      <th className="p-3.5">Proveedor</th>
                      <th className="p-3.5 text-right">Stock Físico</th>
                      <th className="p-3.5 text-right">Demanda Real /d</th>
                      <th className="p-3.5 text-right">Qty Sugerida</th>
                      <th className="p-3.5 text-right">Costo Estimado</th>
                      <th className="p-3.5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                          <p className="text-xs text-slate-400">Cargando sugerencias...</p>
                        </td>
                      </tr>
                    ) : (
                      filteredSuggestions.map(s => {
                        const selected = selectedItems.includes(s.id)
                        return (
                          <tr key={s.id} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition ${selected ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""}`}>
                            <td className="p-3.5 text-center">
                              <button onClick={() => handleToggleSelect(s.id)} className="p-1">
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                  selected
                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                    : "border-slate-300 dark:border-slate-600"
                                }`}>
                                  {selected && <Check className="w-2.5 h-2.5" />}
                                </div>
                              </button>
                            </td>
                            <td className="p-3.5">
                              <p className="font-extrabold text-slate-900 dark:text-white">{s.producto_nombre || s.producto_id}</p>
                            </td>
                            <td className="p-3.5 text-slate-600 dark:text-slate-400">{s.proveedor_nombre || "—"}</td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">{s.stock_actual}</td>
                            <td className="p-3.5 text-right font-mono text-slate-500 dark:text-slate-400">
                              {s.demanda_diaria_avg != null ? `${Number(s.demanda_diaria_avg).toFixed(1)}/d` : "—"}
                            </td>
                            <td className="p-3.5 text-right">
                              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black text-sm font-mono border border-indigo-200 dark:border-indigo-800/60">
                                {s.cantidad_sugerida}
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                              {s.costo_total_estimado ? formatPYG(s.costo_total_estimado) : "—"}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 uppercase">
                                <Clock className="w-3 h-3" />
                                {s.estado}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: POLÍTICAS Y REGLAS POR PRODUCTO
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "rules" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button
              onClick={() => setShowRuleModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Nueva Regla
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {filteredRules.length === 0 && !loading ? (
              <div className="text-center py-20">
                <Settings className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Sin reglas configuradas</p>
                <p className="text-xs text-slate-400 mt-1">Creá una regla por producto para que el motor predictivo pueda generar sugerencias de compra automáticas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-850/80 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Producto</th>
                      <th className="p-3.5">Proveedor Preferente</th>
                      <th className="p-3.5 text-right">Lead Time</th>
                      <th className="p-3.5 text-right">Stk Seg.</th>
                      <th className="p-3.5 text-right">EOQ</th>
                      <th className="p-3.5 text-right">Múltiplo</th>
                      <th className="p-3.5">Método</th>
                      <th className="p-3.5 text-center">Activa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
                        </td>
                      </tr>
                    ) : (
                      filteredRules.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3.5 font-extrabold text-slate-900 dark:text-white">{r.producto_nombre}</td>
                          <td className="p-3.5 text-slate-600 dark:text-slate-400">{r.proveedor_preferente_nombre || "—"}</td>
                          <td className="p-3.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.lead_time_dias}d</td>
                          <td className="p-3.5 text-right font-mono text-slate-700 dark:text-slate-300">{r.stock_seguridad_unidades ?? `${r.stock_seguridad_dias}d`}</td>
                          <td className="p-3.5 text-right font-mono text-slate-700 dark:text-slate-300">{r.lote_economico ?? "—"}</td>
                          <td className="p-3.5 text-right font-mono text-slate-700 dark:text-slate-300">{r.multiplo_pedido ?? "—"}</td>
                          <td className="p-3.5">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 capitalize">{r.metodo_pronostico}</span>
                          </td>
                          <td className="p-3.5 text-center">
                            {r.activa
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"><Check className="w-3 h-3" /> Activa</span>
                              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"><X className="w-3 h-3" /> Inactiva</span>
                            }
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: CROSS-DOCKING
      ════════════════════════════════════════════════════════════════════ */}
      {tab === "crossdock" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
            <p className="text-xs text-slate-500 dark:text-slate-400">Órdenes de transferencia directa hacia góndolas, exhibición o depósito. <span className="font-bold text-indigo-600 dark:text-indigo-400">{crossdock.length} órdenes registradas</span>.</p>
            <button
              onClick={() => setShowCrossdockModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Nueva Orden
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {crossdock.length === 0 && !loading ? (
              <div className="text-center py-20">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Sin órdenes de cross-dock</p>
                <p className="text-xs text-slate-400 mt-1">Las órdenes de cross-dock permiten trasladar mercadería directamente del proveedor a la góndola o exhibición.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-850/80 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Producto</th>
                      <th className="p-3.5">Proveedor</th>
                      <th className="p-3.5 text-right">Cantidad</th>
                      <th className="p-3.5">Fecha</th>
                      <th className="p-3.5">Destino</th>
                      <th className="p-3.5 text-center">Estado</th>
                      <th className="p-3.5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" /></td>
                      </tr>
                    ) : (
                      crossdock.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3.5 font-extrabold text-slate-900 dark:text-white">{c.producto_nombre}</td>
                          <td className="p-3.5 text-slate-600 dark:text-slate-400">{c.proveedor_nombre || "—"}</td>
                          <td className="p-3.5 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">{c.cantidad}</td>
                          <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{formatDate(c.fecha_crossdock)}</td>
                          <td className="p-3.5">
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 capitalize">{c.destino}</span>
                          </td>
                          <td className="p-3.5 text-center">
                            {c.estado === "completado"
                              ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"><Check className="w-3 h-3" /> Completado</span>
                              : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"><Clock className="w-3 h-3" /> Pendiente</span>
                            }
                          </td>
                          <td className="p-3.5 text-center">
                            {c.estado === "pendiente" && (
                              <button onClick={() => handleCompleteCrossdock(c.id)} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black inline-flex items-center gap-1 transition shadow-sm">
                                <Check className="w-3 h-3" /> Completar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ⚙ MODAL: NUEVA REGLA DE REABASTECIMIENTO
      ════════════════════════════════════════════════════════════════════ */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-lg space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">Nueva Regla de Reabastecimiento</h3>
                  <p className="text-xs text-slate-500">Configurar política de compra y umbrales de stock para un producto</p>
                </div>
              </div>
              <button onClick={() => { setShowRuleModal(false); setRuleForm(emptyRuleForm); setProductQuery("") }} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Producto */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Producto (*)</label>
                {ruleForm.producto_id ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">{ruleForm.producto_nombre}</span>
                    <button onClick={() => setRuleForm({ ...ruleForm, producto_id: "", producto_nombre: "" })} className="text-slate-400 hover:text-red-500 transition"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition" placeholder="Buscar producto por nombre o SKU..." value={productQuery} onChange={e => setProductQuery(e.target.value)} />
                    {productResults.length > 0 && (
                      <div className="absolute z-10 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mt-1 max-h-48 overflow-y-auto shadow-lg">
                        {productResults.map(p => (
                          <button key={p.id} onClick={() => { setRuleForm({ ...ruleForm, producto_id: p.id, producto_nombre: p.nombre }); setProductQuery(""); setProductResults([]) }} className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-xs font-medium">
                            <span className="font-bold text-slate-900 dark:text-white">{p.nombre}</span>
                            {p.sku && <span className="text-slate-400 ml-2 font-mono">{p.sku}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Proveedor preferente */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Proveedor Preferente</label>
                <select className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-indigo-500 transition" value={ruleForm.proveedor_preferente_id} onChange={e => setRuleForm({ ...ruleForm, proveedor_preferente_id: e.target.value })}>
                  <option value="">Sin especificar</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre || s.razon_social}</option>)}
                </select>
              </div>

              {/* Parámetros numéricos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Lead Time (días)</label>
                  <input type="number" min={0} value={ruleForm.lead_time_dias} onChange={e => setRuleForm({ ...ruleForm, lead_time_dias: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none transition" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Stock Seguridad (días)</label>
                  <input type="number" min={0} value={ruleForm.stock_seguridad_dias} onChange={e => setRuleForm({ ...ruleForm, stock_seguridad_dias: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none transition" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Stock Seguridad (uds)</label>
                  <input type="number" min={0} value={ruleForm.stock_seguridad_unidades} onChange={e => setRuleForm({ ...ruleForm, stock_seguridad_unidades: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none transition" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Lote Económico (EOQ)</label>
                  <input type="number" min={0} value={ruleForm.lote_economico} onChange={e => setRuleForm({ ...ruleForm, lote_economico: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none transition" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Múltiplo de Pedido</label>
                  <input type="number" min={0} value={ruleForm.multiplo_pedido} onChange={e => setRuleForm({ ...ruleForm, multiplo_pedido: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none transition" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Método de Pronóstico</label>
                  <select className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-indigo-500 transition" value={ruleForm.metodo_pronostico} onChange={e => setRuleForm({ ...ruleForm, metodo_pronostico: e.target.value })}>
                    <option value="promedio">Promedio</option>
                    <option value="ventana">Ventana móvil</option>
                    <option value="seasonal">Estacional</option>
                  </select>
                </div>
              </div>

              {/* Toggle activa */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setRuleForm({ ...ruleForm, activa: !ruleForm.activa })}
                  className={`w-10 h-5 rounded-full transition-colors relative ${ruleForm.activa ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform ${ruleForm.activa ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Regla activa (el motor la usará en la próxima corrida)</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => { setShowRuleModal(false); setRuleForm(emptyRuleForm); setProductQuery("") }} className="px-4 py-2 rounded-xl text-slate-500 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancelar</button>
                <button onClick={handleCreateRule} disabled={saving || !ruleForm.producto_id} className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 transition">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Crear Regla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ⚡ MODAL: NUEVA ORDEN CROSS-DOCK
      ════════════════════════════════════════════════════════════════════ */}
      {showCrossdockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">Nueva Orden Cross-Dock</h3>
                  <p className="text-xs text-slate-500">Transferencia directa proveedor → góndola / exhibición</p>
                </div>
              </div>
              <button onClick={() => { setShowCrossdockModal(false); setCrossdockForm(emptyCrossdockForm); setProductQuery("") }} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Producto */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Producto (*)</label>
                {crossdockForm.producto_id ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">{crossdockForm.producto_nombre}</span>
                    <button onClick={() => setCrossdockForm({ ...crossdockForm, producto_id: "", producto_nombre: "" })} className="text-slate-400 hover:text-red-500 transition"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-violet-500 outline-none transition" placeholder="Buscar producto..." value={productQuery} onChange={e => setProductQuery(e.target.value)} />
                    {productResults.length > 0 && (
                      <div className="absolute z-10 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mt-1 max-h-48 overflow-y-auto shadow-lg">
                        {productResults.map(p => (
                          <button key={p.id} onClick={() => { setCrossdockForm({ ...crossdockForm, producto_id: p.id, producto_nombre: p.nombre }); setProductQuery(""); setProductResults([]) }} className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-xs font-medium">
                            <span className="font-bold text-slate-900 dark:text-white">{p.nombre}</span>
                            {p.sku && <span className="text-slate-400 ml-2 font-mono">{p.sku}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Proveedor</label>
                <select className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-violet-500 transition" value={crossdockForm.proveedor_id} onChange={e => setCrossdockForm({ ...crossdockForm, proveedor_id: e.target.value })}>
                  <option value="">Sin especificar</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre || s.razon_social}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Cantidad (*)</label>
                  <input type="number" min={0} value={crossdockForm.cantidad} onChange={e => setCrossdockForm({ ...crossdockForm, cantidad: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-bold outline-none transition" />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Fecha Cross-Dock</label>
                  <input type="date" value={crossdockForm.fecha_crossdock} onChange={e => setCrossdockForm({ ...crossdockForm, fecha_crossdock: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none transition" />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Destino</label>
                <select className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-violet-500 transition" value={crossdockForm.destino} onChange={e => setCrossdockForm({ ...crossdockForm, destino: e.target.value })}>
                  <option value="gondola">Góndola</option>
                  <option value="exhibicion">Exhibición</option>
                  <option value="deposito">Depósito</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => { setShowCrossdockModal(false); setCrossdockForm(emptyCrossdockForm); setProductQuery("") }} className="px-4 py-2 rounded-xl text-slate-500 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancelar</button>
                <button onClick={handleCreateCrossdock} disabled={saving} className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 transition">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Crear Orden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
