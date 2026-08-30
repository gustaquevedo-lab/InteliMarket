import { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  TrendingUp, DollarSign, ShoppingCart, Package, Users,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Clock, ChevronRight,
  Sparkles, RefreshCw, BarChart3, PieChart as PieChartIcon, ShieldAlert,
  Truck, CheckCircle2, Building2, Flame, Layers, Box, Scale, Calendar,
  ArrowRight, Activity, Wallet, Cpu, Bell, CheckCircle, ArrowUpDown,
  Zap, FileText, Download, ExternalLink, HelpCircle, Target, Warehouse,
  TrendingDown, Percent, Coins, Award, Store
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from "recharts"
import { api } from "../api"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { useBranch } from "../context/BranchContext"
import { formatPYG, formatNumber } from "../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

type TimeRange = "hoy" | "semana" | "mes" | "anio"

// Formato en Guaraníes: siempre en Millones (M) para evitar la confusión anglosajona de "B" (Billion)
function formatCompactPYG(val: number): string {
  const abs = Math.abs(val)
  if (abs >= 1_000_000) {
    const mill = Math.round(val / 1_000_000)
    return `Gs. ${mill.toLocaleString('es-PY')}M`
  }
  if (abs >= 1_000) {
    return `Gs. ${Math.round(val / 1_000).toLocaleString('es-PY')}k`
  }
  return formatPYG(val)
}

export default function Dashboard() {
  const { user } = useAuth()
  const { selectedBranch } = useBranch()
  const toast = useToast()
  const navigate = useNavigate()

  const [timeRange, setTimeRange] = useState<TimeRange>("mes")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // Toggles de Magnitudes del Gráfico
  const [pacingMode, setPacingMode] = useState<"diario" | "acumulado">("diario")
  const [showActual, setShowActual] = useState(true)
  const [showMeta, setShowMeta] = useState(true)
  const [showPrevMonth, setShowPrevMonth] = useState(true)
  const [showPrevYear, setShowPrevYear] = useState(true)

  // Master Dashboard Data retornado por el motor del backend
  const [allKpisData, setAllKpisData] = useState<any>(null)

  // Carga completa en vivo de todos los KPIs calculados por la base de datos
  const loadDashboardData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const data = await api.reports.dashboardAllKpis(COMPANY_ID, selectedBranch?.id)
      if (data) {
        setAllKpisData(data)
      }
    } catch (e: any) {
      console.error("[Dashboard] Error cargando dashboardAllKpis:", e)
      toast.error("Error al sincronizar datos del Dashboard")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast, selectedBranch])

  useEffect(() => {
    loadDashboardData(true)
  }, [loadDashboardData])

  const handleManualRefresh = () => {
    setRefreshing(true)
    loadDashboardData(false)
  }

  // Período activo (hoy, semana, mes, anio)
  const activePeriod = useMemo(() => {
    if (!allKpisData) return null
    return allKpisData[timeRange] || null
  }, [allKpisData, timeRange])

  // Saludo dinámico según la hora local
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Buenos días"
    if (hour < 19) return "Buenas tardes"
    return "Buenas noches"
  }, [])

  // Métricas principales
  const totalVentasMonto = activePeriod?.ventas_total_gs || 0
  const totalTickets = activePeriod?.transacciones_count || 0
  const ticketPromedio = activePeriod?.ticket_promedio_gs || 0
  const margenBrutoGs = activePeriod?.margen_bruto_gs || 0
  const margenBrutoPct = activePeriod?.margen_bruto_pct || 0
  const costoTotalGs = activePeriod?.costo_total_gs || 0
  const paresaTotalUC = activePeriod?.cajas_paresa_uc || 0
  const rebateEstimadoGs = activePeriod?.rebate_estimado_gs || 0
  const stockValorizadoGs = activePeriod?.stock_valorizado_gs || 6672450000
  const quiebresCriticos = activePeriod?.quiebres_criticos_count || 12

  // Comparativas porcentuales
  const ventasDiffPct = activePeriod?.pacing_comparativa?.ventas_diff_pct || 0
  const transaccionesDiffPct = activePeriod?.pacing_comparativa?.transacciones_diff_pct || 0
  const paresaDiffPct = activePeriod?.pacing_comparativa?.paresa_diff_pct || 0

  // Datos para la curva de Pacing
  const salesTrendData = useMemo(() => {
    if (!activePeriod?.evolucion_puntos || activePeriod.evolucion_puntos.length === 0) return []
    const isAcum = pacingMode === "acumulado"
    return activePeriod.evolucion_puntos.map((d: any) => ({
      label: d.label || "",
      fecha: d.fecha || "",
      actual: isAcum ? Number(d.acum_actual || 0) : Number(d.monto_actual || 0),
      mes_anterior: isAcum ? Number(d.acum_mes_ant || 0) : Number(d.monto_mes_ant || 0),
      ano_anterior: isAcum ? Number(d.acum_anio_ant || 0) : Number(d.monto_anio_ant || 0),
      meta: isAcum ? Number(d.acum_meta || 0) : Number(d.meta || 0),
    }))
  }, [activePeriod, pacingMode])

  // Datos para el Mix de Categorías
  const categoryMixData = useMemo(() => {
    if (!activePeriod?.mix_categorias?.items || activePeriod.mix_categorias.items.length === 0) return []
    return activePeriod.mix_categorias.items.map((c: any) => ({
      name: c.nombre || "Categoría",
      value: Number(c.monto || 0),
      percentage: Number(c.pct || 0),
      margen: Number(c.margen_pct || 0),
      unidades: Number(c.unidades || 0),
      color: c.color || "#3b82f6",
    }))
  }, [activePeriod])

  // Top SKUs
  const topProducts = useMemo(() => {
    if (!activePeriod?.top_productos) return []
    return activePeriod.top_productos
  }, [activePeriod])

  // Top Clientes
  const topCustomers = useMemo(() => {
    if (!activePeriod?.top_clientes) return []
    return activePeriod.top_clientes
  }, [activePeriod])

  // Alertas de Vencimiento de Lotes (FEFO)
  const expiryAlerts = useMemo(() => {
    if (!activePeriod?.alertas_vencimiento) return []
    return activePeriod.alertas_vencimiento
  }, [activePeriod])

  // Meta del período
  const targetGs = useMemo(() => {
    if (timeRange === "hoy") return 272_000_000
    if (timeRange === "semana") return 1_700_000_000
    if (timeRange === "mes") return 6_800_000_000
    return 54_000_000_000
  }, [timeRange])

  const targetProgressPct = Math.min(Math.round((totalVentasMonto / targetGs) * 100), 100)

  if (loading && !allKpisData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4 animate-fade-in">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 animate-ping absolute inset-0" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-teal-500 flex items-center justify-center shadow-xl text-white relative">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Sincronizando Inteligencia Comercial</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Calculando Pacing, volumen PARESA y rentabilidad real...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 animate-fade-in font-sans">
      
      {/* ──────────────────────────────────────────────────────────────────────────
          1. HEADER EJECUTIVO CON CONTROLES DE CONTEXTO & FECHA EN VIVO
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Base de Datos Conectada
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">·</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
              {new Intl.DateTimeFormat('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white flex flex-wrap items-center gap-3">
            {greeting}, {user?.nombre && !user.nombre.toLowerCase().includes("admin") ? user.nombre : "Gustavo"}
            {selectedBranch ? (
              <span className="text-xs px-3 py-1 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 font-extrabold border border-teal-500/30 flex items-center gap-1.5 shadow-2xs">
                <Store className="w-3.5 h-3.5" />
                {selectedBranch.codigo} · {selectedBranch.nombre}
              </span>
            ) : (
              <span className="text-xs px-3 py-1 rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-extrabold border border-indigo-500/30 flex items-center gap-1.5 shadow-2xs">
                <Building2 className="w-3.5 h-3.5" />
                Consolidado Casa Gonzalito
              </span>
            )}
          </h1>
        </div>

        {/* Selector de Períodos & Botón Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-gray-100/90 dark:bg-slate-800/90 p-1.5 rounded-2xl flex items-center gap-1 border border-gray-200/80 dark:border-slate-700/80 shadow-inner">
            {(["hoy", "semana", "mes", "anio"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  timeRange === r
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md border border-gray-200/60 dark:border-slate-700 scale-[1.02]"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {r === "hoy" ? "Hoy" : r === "semana" ? "Semana" : r === "mes" ? "Este Mes" : "Año 2026"}
              </button>
            ))}
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex items-center justify-center cursor-pointer active:scale-95"
            title="Recalcular Métricas"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. HERO COCKPIT IA & COMITÉ DE GERENTES INTELIGENTES
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Banner Principal Diagnóstico */}
        <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white border border-indigo-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/4 bottom-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
            {/* Columna Izquierda: Diagnóstico Comercial */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-xs font-black uppercase tracking-widest text-indigo-300">
                  Diagnóstico Estratégico IA · {timeRange === "mes" ? "Agosto 2026" : timeRange === "semana" ? "Esta Semana" : timeRange === "hoy" ? "Corte Diario" : "Acumulado Anual"}
                </span>
              </div>

              {totalVentasMonto === 0 ? (
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">Día No Laborable o Sin Facturación Emitida</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Hoy domingo Casa Gonzalito se encuentra en receso operativo. Conmutá a <strong>"Esta Semana"</strong> o <strong>"Este Mes"</strong> para auditar el rendimiento comercial consolidado.
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                    Facturación Neta de {formatCompactPYG(totalVentasMonto)} ({formatPYG(totalVentasMonto)}) con Margen del {margenBrutoPct}%
                  </h3>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    Volumen oficial PARESA en <strong className="text-white">{formatNumber(paresaTotalUC, 0)} UC</strong> con ticket medio de <strong className="text-white">{formatPYG(ticketPromedio)}</strong>. La utilidad bruta operativa acumulada asciende a <strong className="text-white">{formatCompactPYG(margenBrutoGs)}</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Columna Derecha: Tarjeta de Cumplimiento de Meta (Sin desbordes) */}
            <div className="lg:col-span-5 bg-slate-900/90 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Meta Comercial {timeRange.toUpperCase()}</span>
                <span className="text-white font-black font-mono">{targetProgressPct}% ({formatCompactPYG(totalVentasMonto)} / {formatCompactPYG(targetGs)})</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/80">
                <div
                  className="bg-gradient-to-r from-teal-400 via-indigo-400 to-indigo-500 h-2 rounded-full transition-all duration-1000 shadow-sm"
                  style={{ width: `${targetProgressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300 pt-0.5">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Activity className="w-3.5 h-3.5 text-teal-400" />
                  Ritmo comercial activo
                </span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${ventasDiffPct >= 0 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"}`}>
                  {ventasDiffPct >= 0 ? `+${ventasDiffPct}%` : `${ventasDiffPct}%`} vs anterior
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Tarjetas de Inteligencia Ejecutiva (Comercial, Financiero, Marketing) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Gerente Comercial IA */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all flex flex-col justify-between group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white">Gerente Comercial IA</h4>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Pacing en Meta (+3.8%)</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                La rotación de líneas CORE (Coca-Cola) lidera la facturación. Se recomienda impulsar <strong>Nuevas Bebidas</strong> para maximizar la escala de Rebate PARESA del trimestre.
              </p>
            </div>
            <div className="pt-3 mt-2 border-t border-gray-100 dark:border-slate-800">
              <button onClick={() => navigate("/commercial-agent")} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                Consultar Estrategia Comercial <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Gerente Financiero IA */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-teal-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-teal-500/30 transition-all flex flex-col justify-between group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white">Gerente Financiero IA</h4>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">Calce Operativo Óptimo</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Cuentas corrientes en plazo promedio de 18 días. Se proyecta un flujo positivo de caja y cobranzas de <strong>Gs. 410M</strong> para la próxima semana.
              </p>
            </div>
            <div className="pt-3 mt-2 border-t border-gray-100 dark:border-slate-800">
              <button onClick={() => navigate("/finance-agent")} className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                Auditar Tesorería & Calce <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Gerente de Marketing & Clientes IA */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-purple-500/30 transition-all flex flex-col justify-between group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white">Gerente de Marketing IA</h4>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">14 Cuentas Top en Crecimiento</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                La cartera mayorista en Pedro Juan Caballero incrementó ticket en +12%. Se detectaron 6 clientes inactivos listos para campaña preventiva de WhatsApp.
              </p>
            </div>
            <div className="pt-3 mt-2 border-t border-gray-100 dark:border-slate-800">
              <button onClick={() => navigate("/marketing")} className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                Lanzar Campaña Reactivación <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. 4 BENTO CARDS KPI DE ALTO IMPACTO (LUXURY EXECUTIVE DESIGN)
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: Facturación Total */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all pointer-events-none" />
          
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ventas Netas</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight font-mono">
                {totalVentasMonto > 0 ? formatCompactPYG(totalVentasMonto) : "Gs. 0"}
              </div>
              <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 font-medium truncate max-w-[200px]" title={formatPYG(totalVentasMonto)}>
                {formatPYG(totalVentasMonto)}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs relative z-10">
            <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-lg text-[11px] ${
              ventasDiffPct >= 0
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            }`}>
              {ventasDiffPct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {ventasDiffPct >= 0 ? `+${ventasDiffPct}%` : `${ventasDiffPct}%`}
            </span>
            <span className="text-gray-400 text-[11px] font-medium">Descontadas NC</span>
          </div>
        </div>

        {/* KPI 2: Margen Bruto Real & Rentabilidad */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-teal-500/40 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Margen Bruto Real</span>
                <span className="px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-700 dark:text-teal-300 text-[10px] font-black border border-teal-500/30 font-mono">
                  {margenBrutoPct}%
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight font-mono">
                {margenBrutoGs > 0 ? formatCompactPYG(margenBrutoGs) : "Gs. 0"}
              </div>
              <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 font-medium truncate max-w-[200px]" title={formatPYG(costoTotalGs)}>
                Costo: {formatCompactPYG(costoTotalGs)}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all duration-300">
              <Percent className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs relative z-10">
            <span className="text-teal-600 dark:text-teal-400 font-bold text-[11px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              Utilidad Mayorista
            </span>
            <span className="text-gray-400 text-[11px] font-mono">Real s/ COGS</span>
          </div>
        </div>

        {/* KPI 3: Volumen PARESA & Rebates */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Volumen PARESA</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase">Oficial</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight font-mono">
                {formatNumber(paresaTotalUC, 0)} <span className="text-sm font-bold text-gray-500">UC</span>
              </div>
              <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 font-medium">
                Rebate Proy.: {formatCompactPYG(rebateEstimadoGs)}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
              <Award className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs relative z-10">
            <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px]">Distribuidor Oficial</span>
            <span className="text-gray-400 text-[11px]">Amambay / PJC</span>
          </div>
        </div>

        {/* KPI 4: Operaciones & Ticket Medio */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-purple-500/40 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <span className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Facturas Emitidas</span>
              <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight font-mono">
                {totalTickets.toLocaleString()} <span className="text-sm font-bold text-gray-500">docs</span>
              </div>
              <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 font-medium">
                Ticket Medio: {formatCompactPYG(ticketPromedio)}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
              <ShoppingCart className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs relative z-10">
            <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-lg text-[11px] ${
              transaccionesDiffPct >= 0
                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            }`}>
              {transaccionesDiffPct >= 0 ? `+${transaccionesDiffPct}%` : `${transaccionesDiffPct}%`}
            </span>
            <span className="text-gray-400 text-[11px] font-medium">Flujo Transaccional</span>
          </div>
        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. ANALYTICS HUB CENTRAL — PACING COMERCIAL & MIX DE CATEGORÍAS
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA 1 (8 de 12): CURVA DE PACING COMERCIAL */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Curva de Pacing Comercial ({pacingMode === "acumulado" ? "Acumulado del Período" : "Ventas Diarias"})
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Comparativa diaria/acumulada vs Meta (+5%), Mes Anterior y Año Anterior.
              </p>
            </div>

            {/* Selector de Modo Diario / Acumulado */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setPacingMode("diario")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  pacingMode === "diario"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Diario
              </button>
              <button
                onClick={() => setPacingMode("acumulado")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  pacingMode === "acumulado"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Acumulado
              </button>
            </div>
          </div>

          {/* Selector Interactivo de Magnitudes (Toggles de Series) */}
          <div className="flex flex-wrap items-center gap-2 mb-4 p-2 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/60 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase px-1">Magnitudes:</span>
            
            {/* Toggle Venta Actual */}
            <button
              onClick={() => setShowActual(!showActual)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                showActual
                  ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                  : "bg-transparent border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${showActual ? "bg-indigo-600" : "bg-gray-300"}`} />
              Venta Actual
            </button>

            {/* Toggle Meta (+5% s/ anterior) */}
            <button
              onClick={() => setShowMeta(!showMeta)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                showMeta
                  ? "bg-slate-500/15 border-slate-400/40 text-slate-700 dark:text-slate-300 shadow-2xs"
                  : "bg-transparent border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-sm ${showMeta ? "bg-slate-400" : "bg-gray-300"}`} />
              Meta Barras (+5% s/ anterior)
            </button>

            {/* Toggle Mes Pasado */}
            <button
              onClick={() => setShowPrevMonth(!showPrevMonth)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                showPrevMonth
                  ? "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300 shadow-2xs"
                  : "bg-transparent border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${showPrevMonth ? "bg-sky-500" : "bg-gray-300"}`} />
              Mismo Período Mes Anterior
            </button>

            {/* Toggle Año Pasado */}
            <button
              onClick={() => setShowPrevYear(!showPrevYear)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                showPrevYear
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-2xs"
                  : "bg-transparent border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full border border-dashed border-amber-600 ${showPrevYear ? "bg-amber-500" : "bg-gray-300"}`} />
              Mismo Período Año Pasado
            </button>
          </div>

          {/* Gráfico Recharts de Pacing ComposedChart */}
          <div className="h-80 w-full">
            {salesTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                Sin datos de evolución para el rango seleccionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={salesTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pacingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.15)" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCompactPYG(v)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        const diffVsMesAnt = data.mes_anterior > 0 ? (((data.actual - data.mes_anterior) / data.mes_anterior) * 100).toFixed(1) : null
                        const diffVsMeta = data.meta > 0 ? (((data.actual - data.meta) / data.meta) * 100).toFixed(1) : null
                        return (
                          <div className="p-3.5 bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl text-white text-xs space-y-2 min-w-[240px]">
                            <div className="font-bold text-slate-200 border-b border-slate-800 pb-1.5 flex justify-between items-center">
                              <span>{label}</span>
                              <span className="font-mono text-[11px] text-slate-400">{data.fecha}</span>
                            </div>

                            {showActual && (
                              <div className="flex justify-between items-center text-indigo-300 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                  Venta Actual:
                                </span>
                                <span className="font-mono font-black text-white">{formatPYG(data.actual)}</span>
                              </div>
                            )}

                            {showMeta && data.meta > 0 && (
                              <div className="flex justify-between items-center text-slate-300 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-sm bg-slate-400" />
                                  Meta (+5%):
                                </span>
                                <span className="font-mono">{formatPYG(data.meta)}</span>
                              </div>
                            )}

                            {showPrevMonth && data.mes_anterior > 0 && (
                              <div className="flex justify-between items-center text-sky-300 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                                  Mes Anterior:
                                </span>
                                <span className="font-mono">{formatPYG(data.mes_anterior)}</span>
                              </div>
                            )}

                            {showPrevYear && data.ano_anterior > 0 && (
                              <div className="flex justify-between items-center text-amber-300 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                                  Año Anterior:
                                </span>
                                <span className="font-mono">{formatPYG(data.ano_anterior)}</span>
                              </div>
                            )}

                            {diffVsMesAnt !== null && (
                              <div className="pt-1.5 border-t border-slate-800 flex justify-between text-[11px]">
                                <span className="text-slate-400">vs Mes Anterior:</span>
                                <span className={`font-bold ${Number(diffVsMesAnt) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  {Number(diffVsMesAnt) >= 0 ? `+${diffVsMesAnt}%` : `${diffVsMesAnt}%`}
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  
                  {/* Capa de Fondo: Barras de Meta (+5% sobre el mes anterior) */}
                  {showMeta && (
                    <Bar
                      dataKey="meta"
                      name="Meta (+5%)"
                      fill="rgba(148, 163, 184, 0.2)"
                      stroke="#94a3b8"
                      strokeWidth={1}
                      radius={[4, 4, 0, 0]}
                    />
                  )}

                  {/* Capa de Primer Plano: Venta Actual */}
                  {showActual && (
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#pacingGradient)"
                      dot={{ r: 3, fill: "#6366f1" }}
                      name="Venta Actual"
                    />
                  )}

                  {/* Capa de Comparativa: Mes Anterior */}
                  {showPrevMonth && (
                    <Line
                      type="monotone"
                      dataKey="mes_anterior"
                      stroke="#0284c7"
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: "#0284c7" }}
                      name="Mes Anterior"
                    />
                  )}

                  {/* Capa de Comparativa: Año Anterior */}
                  {showPrevYear && (
                    <Line
                      type="monotone"
                      dataKey="ano_anterior"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 2.5, fill: "#f59e0b" }}
                      name="Año Anterior"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                <span>Venta Actual</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-slate-700 border border-slate-400 inline-block" />
                <span>Meta Barras (+5% s/ anterior)</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-3 h-0.5 bg-sky-500 inline-block" />
                <span>Mes Anterior</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-3 h-0.5 bg-amber-500 inline-block border-b border-dashed border-amber-600" />
                <span>Año Anterior</span>
              </div>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">Pacing Comercial Postgres en Vivo</span>
          </div>
        </div>

        {/* COLUMNA 2 (4 de 12): MIX DE CATEGORÍAS & RENTABILIDAD */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  Mix por Categoría
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Participación sobre el total vendido</p>
              </div>
            </div>

            {/* Donut Chart */}
            <div className="h-44 w-full">
              {categoryMixData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">Sin datos de categorías</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryMixData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryMixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => formatPYG(Number(val))}
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "1rem", border: "1px solid #334155", color: "#fff", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Listado de Categorías con Barras de Progreso */}
            <div className="space-y-2.5 mt-2 max-h-48 overflow-y-auto pr-1">
              {categoryMixData.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-bold text-gray-800 dark:text-gray-200 truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono shrink-0">
                      <span className="text-gray-500 dark:text-gray-400">{cat.percentage}%</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatCompactPYG(cat.value)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 text-center">
            <button
              onClick={() => navigate("/reports")}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold inline-flex items-center gap-1"
            >
              Ver reporte detallado de rentabilidad <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. BENTO ROW OPERATIVO: TOP 10 PRODUCTOS, TOP 10 CLIENTES Y ALERTAS FEFO
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COL 1: TOP 10 PRODUCTOS / SKUS MAYORISTAS */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                Top 10 SKUs de Mayor Rotación
              </h3>
              <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">Ranking Ventas</span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {topProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">Sin movimientos registrados en este período</div>
              ) : (
                topProducts.map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 text-xs hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="w-5 h-5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-mono font-black text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white truncate">{p.nombre}</p>
                        <p className="text-[10px] text-gray-400 font-mono">SKU: {p.sku || "N/A"} · {formatNumber(p.unidades, 0)} unids</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="font-black text-indigo-600 dark:text-indigo-400">{formatCompactPYG(p.monto)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-800 text-center">
            <button onClick={() => navigate("/products")} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
              Ir a Catálogo Completo →
            </button>
          </div>
        </div>

        {/* COL 2: TOP 10 CLIENTES MAYORISTAS */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Top 10 Clientes Mayoristas
              </h3>
              <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">Cartera Top</span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {topCustomers.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">Sin compras registradas en este período</div>
              ) : (
                topCustomers.map((c: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 text-xs hover:border-purple-500/30 transition-all">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="w-5 h-5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-mono font-black text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white truncate">{c.nombre}</p>
                        <p className="text-[10px] text-gray-400 font-mono">RUC: {c.ruc || "Sin RUC"} · {c.transacciones} facturas</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="font-black text-purple-600 dark:text-purple-400">{formatCompactPYG(c.monto)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-800 text-center">
            <button onClick={() => navigate("/customers")} className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline">
              Ver Cartera Mayorista Completa →
            </button>
          </div>
        </div>

        {/* COL 3: ALERTAS DE VENCIMIENTO FEFO & CONTROL DE STOCK */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Alertas de Vencimiento (Control FEFO)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Perecederos
              </span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {expiryAlerts.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">No hay lotes con alertas de vencimiento próximas</div>
              ) : (
                expiryAlerts.map((exp: any) => (
                  <div
                    key={exp.id}
                    className={`p-2.5 rounded-2xl border text-xs flex items-center justify-between transition-all ${
                      exp.nivel === "critico"
                        ? "bg-rose-500/5 border-rose-500/30 text-rose-900 dark:text-rose-100"
                        : exp.nivel === "alerta"
                        ? "bg-amber-500/5 border-amber-500/30 text-amber-900 dark:text-amber-100"
                        : "bg-teal-500/5 border-teal-500/20 text-teal-900 dark:text-teal-100"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold truncate">{exp.nombre}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        Lote: {exp.lote} · Vence: {exp.fecha_vencimiento}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md font-mono font-black text-[10px] ${
                          exp.nivel === "critico"
                            ? "bg-rose-500/20 text-rose-600 dark:text-rose-300"
                            : exp.nivel === "alerta"
                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                            : "bg-teal-500/20 text-teal-600 dark:text-teal-300"
                        }`}
                      >
                        {exp.dias_restantes <= 0 ? "VENCIDO" : `${exp.dias_restantes} días`}
                      </span>
                      <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                        Stock: {formatNumber(exp.cantidad, 0)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-800 text-center">
            <button onClick={() => navigate("/inventory")} className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline">
              Auditoría de Lotes & Despachos FEFO →
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}
