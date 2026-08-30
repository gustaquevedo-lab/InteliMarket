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

// Formato compacto para cifras muy grandes en Guaraníes (evita desbordes)
function formatCompactPYG(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) {
    return `Gs. ${(val / 1_000_000_000).toFixed(2)}B`
  }
  if (Math.abs(val) >= 1_000_000) {
    return `Gs. ${(val / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(val) >= 1_000) {
    return `Gs. ${(val / 1_000).toFixed(0)}k`
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
  const [pacingMode, setPacingMode] = useState<"diario" | "acumulado">("diario")
  const [mixViewMode, setMixViewMode] = useState<"venta" | "margen">("venta")

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
            {greeting}, {user?.nombre || "Gustavo"}
            {selectedBranch ? (
              <span className="text-xs px-3 py-1 rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300 font-extrabold border border-teal-500/30 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                {selectedBranch.codigo} · {selectedBranch.nombre}
              </span>
            ) : (
              <span className="text-xs px-3 py-1 rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-extrabold border border-indigo-500/30 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Consolidado Casa Gonzalito
              </span>
            )}
          </h1>
        </div>

        {/* Selector de Períodos & Botón Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl flex items-center gap-1 border border-gray-200 dark:border-slate-700">
            {(["hoy", "semana", "mes", "anio"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  timeRange === r
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200/60 dark:border-slate-700"
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
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
            title="Recalcular Métricas"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. HERO COCKPIT IA — DIAGNÓSTICO ESTRATÉGICO DISTRIBUIDORA
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-indigo-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                Diagnóstico Comercial IA ({timeRange === "mes" ? "Agosto 2026" : timeRange === "semana" ? "Esta Semana" : timeRange === "hoy" ? "Corte Diario" : "Acumulado Anual"})
              </span>
            </div>

            {totalVentasMonto === 0 ? (
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white">Día No Laborable o Sin Facturación Emitida</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Hoy domingo Casa Gonzalito se encuentra en receso operativo. Podés conmutar a <strong>"Esta Semana"</strong> o <strong>"Este Mes"</strong> para auditar el rendimiento consolidado del período.
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Facturación en {formatPYG(totalVentasMonto)} con Margen Real del {margenBrutoPct}%
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Volumen PARESA en <strong>{formatNumber(paresaTotalUC, 0)} Cajas Unitarias</strong> con ticket promedio de <strong>{formatPYG(ticketPromedio)}</strong>. La rentabilidad bruta operativa acumula <strong>{formatPYG(margenBrutoGs)}</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Medidor de Meta del Período */}
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0 w-full lg:w-80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Meta {timeRange.toUpperCase()}</span>
              <span className="text-white font-bold">{targetProgressPct}% ({formatCompactPYG(totalVentasMonto)} / {formatCompactPYG(targetGs)})</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 to-indigo-500 h-2.5 rounded-full transition-all duration-1000"
                style={{ width: `${targetProgressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
              <span>Pacing comercial activo</span>
              <span className={ventasDiffPct >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {ventasDiffPct >= 0 ? `+${ventasDiffPct}%` : `${ventasDiffPct}%`} vs anterior
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. 4 BENTO CARDS KPI DE ALTO IMPACTO (ANTI-DESBORDE)
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Facturación Total */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ventas Netas</span>
              <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate max-w-[200px]" title={formatPYG(totalVentasMonto)}>
                {totalVentasMonto > 0 ? formatCompactPYG(totalVentasMonto) : "Gs. 0"}
              </div>
              <div className="text-[11px] font-mono text-gray-400 truncate">
                {formatPYG(totalVentasMonto)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className={`inline-flex items-center gap-1 font-bold ${ventasDiffPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {ventasDiffPct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {ventasDiffPct >= 0 ? `+${ventasDiffPct}%` : `${ventasDiffPct}%`}
            </span>
            <span className="text-gray-400 text-[11px]">vs período ant.</span>
          </div>
        </div>

        {/* KPI 2: Margen Bruto Real & Rentabilidad */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Margen Bruto Real</span>
                <span className="px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-black">{margenBrutoPct}%</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate max-w-[200px]" title={formatPYG(margenBrutoGs)}>
                {margenBrutoGs > 0 ? formatCompactPYG(margenBrutoGs) : "Gs. 0"}
              </div>
              <div className="text-[11px] font-mono text-gray-400 truncate">
                Costo: {formatCompactPYG(costoTotalGs)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Percent className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-teal-600 dark:text-teal-400 font-bold">Rentabilidad Real</span>
            <span className="text-gray-400 text-[11px]">Deducido s/ costo</span>
          </div>
        </div>

        {/* KPI 3: Volumen PARESA & Rebates */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Volumen PARESA</span>
              <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate max-w-[200px]">
                {formatNumber(paresaTotalUC, 0)} <span className="text-xs text-gray-500 font-bold">UC</span>
              </div>
              <div className="text-[11px] font-mono text-gray-400 truncate">
                Rebate: {formatCompactPYG(rebateEstimadoGs)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-amber-600 dark:text-amber-400 font-bold">Distribuidor Oficial</span>
            <span className="text-gray-400 text-[11px]">Amambay / Pedro Juan</span>
          </div>
        </div>

        {/* KPI 4: Operaciones & Ticket Medio */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Facturas Emitidas</span>
              <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate max-w-[200px]">
                {totalTickets.toLocaleString()} <span className="text-xs text-gray-500 font-bold">docs</span>
              </div>
              <div className="text-[11px] font-mono text-gray-400 truncate">
                Ticket: {formatCompactPYG(ticketPromedio)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className={`inline-flex items-center gap-1 font-bold ${transaccionesDiffPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {transaccionesDiffPct >= 0 ? `+${transaccionesDiffPct}%` : `${transaccionesDiffPct}%`}
            </span>
            <span className="text-gray-400 text-[11px]">flujo transaccional</span>
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
                Comparativa de facturación real contra meta proyectada y mes anterior.
              </p>
            </div>

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

          {/* Gráfico Recharts de Pacing */}
          <div className="h-72 w-full">
            {salesTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                Sin datos de evolución para el rango seleccionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={salesTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pacingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
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
                        return (
                          <div className="p-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl text-white text-xs space-y-1.5 min-w-[200px]">
                            <div className="font-bold text-slate-300 border-b border-slate-800 pb-1 flex justify-between">
                              <span>{label} ({data.fecha})</span>
                            </div>
                            <div className="flex justify-between items-center text-indigo-300">
                              <span>Actual:</span>
                              <span className="font-mono font-black">{formatPYG(data.actual)}</span>
                            </div>
                            {data.meta > 0 && (
                              <div className="flex justify-between items-center text-amber-300">
                                <span>Meta:</span>
                                <span className="font-mono">{formatPYG(data.meta)}</span>
                              </div>
                            )}
                            {data.mes_anterior > 0 && (
                              <div className="flex justify-between items-center text-slate-400">
                                <span>Mes Ant.:</span>
                                <span className="font-mono">{formatPYG(data.mes_anterior)}</span>
                              </div>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#pacingGradient)" name="Venta Actual" />
                  <Line type="monotone" dataKey="meta" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Meta" />
                  <Line type="monotone" dataKey="mes_anterior" stroke="#94a3b8" strokeWidth={1.5} dot={false} name="Mes Anterior" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                <span>Facturación Real</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                <span>Meta Proyectada</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span className="w-3 h-0.5 bg-gray-400 inline-block" />
                <span>Mes Anterior</span>
              </div>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">Actualizado con Postgres en Vivo</span>
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
          5. BENTO ROW OPERATIVO: TOP PRODUCTOS, QUIEBRES Y CLIENTES TOP
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* TOP PRODUCTOS / SKUS MAYORISTAS */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                SKUs de Mayor Rotación
              </h3>
              <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">Top 5</span>
            </div>

            <div className="space-y-3">
              {topProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">Sin movimientos registrados en este período</div>
              ) : (
                topProducts.map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-gray-900 dark:text-white truncate">{p.nombre}</p>
                      <p className="text-[10px] text-gray-400 font-mono">SKU: {p.sku || "N/A"} · {formatNumber(p.unidades, 0)} unids</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black font-mono text-indigo-600 dark:text-indigo-400">{formatCompactPYG(p.monto)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-800 text-center">
            <button onClick={() => navigate("/products")} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
              Ir a Catálogo de Productos →
            </button>
          </div>
        </div>

        {/* MONITOREO DE INVENTARIO & QUIEBRES */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Control de Depósitos & Stock
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400">
                Operativo
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/20 space-y-1">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Stock Valorizado Depósito Central</span>
                <p className="text-xl font-black text-gray-900 dark:text-white font-mono">{formatPYG(stockValorizadoGs)}</p>
                <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">98.4% de disponibilidad en líneas críticas PARESA</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{quiebresCriticos} SKUs en Punto de Reorden</p>
                    <p className="text-[10px] text-gray-500">Sugerencias de reposición automáticas listas</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-800 text-center">
            <button onClick={() => navigate("/inventory")} className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline">
              Gestionar Inventario & Compras →
            </button>
          </div>
        </div>

        {/* TOP CLIENTES MAYORISTAS */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Clientes Mayoristas Destacados
              </h3>
              <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">Top 5</span>
            </div>

            <div className="space-y-3">
              {topCustomers.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">Sin compras registradas en este período</div>
              ) : (
                topCustomers.map((c: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-gray-900 dark:text-white truncate">{c.nombre}</p>
                      <p className="text-[10px] text-gray-400 font-mono">RUC: {c.ruc || "Sin RUC"} · {c.transacciones} compras</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black font-mono text-purple-600 dark:text-purple-400">{formatCompactPYG(c.monto)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-800 text-center">
            <button onClick={() => navigate("/customers")} className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline">
              Ver Cartera de Clientes Mayoristas →
            </button>
          </div>
        </div>

      </div>

    </div>
  )
}
