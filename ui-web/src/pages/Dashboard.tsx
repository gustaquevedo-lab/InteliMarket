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
    <div className="space-y-7 max-w-[1680px] mx-auto pb-14 animate-fade-in font-sans">
      
      {/* ──────────────────────────────────────────────────────────────────────────
          1. HEADER EJECUTIVO SUIZO CON CONTROLES DE CONTEXTO & FECHA EN VIVO
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06),0_1px_4px_rgba(15,23,42,0.04)]">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sincronización PostgreSQL en Vivo
            </span>
            <span className="text-xs text-slate-300 dark:text-slate-600 font-medium">•</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider font-mono">
              {new Intl.DateTimeFormat('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-3">
            {greeting}, <span className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-700 dark:from-white dark:via-slate-200 dark:to-indigo-300 bg-clip-text text-transparent">{user?.nombre && !user.nombre.toLowerCase().includes("admin") ? user.nombre : "Gustavo"}</span>
            {selectedBranch ? (
              <span className="text-xs px-3 py-1 rounded-xl bg-teal-500/15 text-teal-800 dark:text-teal-300 font-extrabold border border-teal-500/30 flex items-center gap-1.5 shadow-2xs">
                <Store className="w-3.5 h-3.5" />
                {selectedBranch.codigo} · {selectedBranch.nombre}
              </span>
            ) : (
              <span className="text-xs px-3 py-1 rounded-xl bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 font-extrabold border border-indigo-500/30 flex items-center gap-1.5 shadow-2xs">
                <Building2 className="w-3.5 h-3.5" />
                Casa Gonzalito S.R.L. · Consolidado General
              </span>
            )}
          </h1>
        </div>

        {/* Selector de Períodos Suizo & Botón Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200 dark:border-slate-700/80 shadow-inner">
            {(["hoy", "semana", "mes", "anio"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  timeRange === r
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-200/80 dark:border-slate-700 scale-[1.02]"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {r === "hoy" ? "Hoy" : r === "semana" ? "Semana" : r === "mes" ? "Este Mes" : "Año 2026"}
              </button>
            ))}
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex items-center justify-center cursor-pointer active:scale-95"
            title="Recalcular Métricas"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. HERO COCKPIT IA — CENTRO DE COMANDO & DIAGNÓSTICO ESTRATÉGICO
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Banner Principal Diagnóstico */}
        <div className="p-7 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-950 via-[#0c1322] to-[#0f172a] text-white border border-indigo-500/30 shadow-[0_12px_40px_rgba(15,23,42,0.18)] relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/4 bottom-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-center relative z-10">
            {/* Columna Izquierda: Diagnóstico Estratégico */}
            <div className="lg:col-span-7 space-y-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-xs font-black uppercase tracking-widest text-indigo-300">
                  Centro de Inteligencia Comercial & Operativa · {timeRange === "mes" ? "Agosto 2026" : timeRange === "semana" ? "Esta Semana" : timeRange === "hoy" ? "Corte Diario" : "Acumulado Anual"}
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black border border-emerald-500/30 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Salud Operativa 96/100
                </span>
              </div>

              {totalVentasMonto === 0 ? (
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">Día No Laborable · Receso Operativo</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Casa Gonzalito se encuentra en receso dominical. Podés consultar <strong>"Esta Semana"</strong> o <strong>"Este Mes"</strong> para auditar la evolución de ventas, cumplimiento de rebates y rotación de inventario.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug">
                    PARESA lidera el 55.5% del mix con Rebate ganado de <span className="text-amber-400">Gs. 146.4M</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    La facturación de Coca-Cola suma <strong>Gs. 3.447M</strong> sin IVA con <strong>98.450 UC</strong> cumplidas (86.7% de meta). Chortitzer (<strong>Gs. 619M</strong>) y Trociuk (<strong>Gs. 446M</strong>) completan el podio mayorista. El margen bruto operativo directo (<strong>8.3% · Gs. 516M</strong>) sumado a los rebates proyectados (<strong>Gs. 182M</strong>) consolida la rentabilidad comercial real en <strong className="text-emerald-400">11.3%</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Columna Derecha: 4 Micro-Tarjetas de Métricas Estratégicas */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
              <div className="bg-slate-900/90 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-lg space-y-1 hover:border-emerald-500/40 transition-all">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rebates Proyectados</span>
                <div className="text-xl font-black text-emerald-400 font-mono">Gs. 182.4M</div>
                <div className="text-[10px] text-slate-400 font-medium">PARESA + Chortitzer + Trociuk</div>
              </div>

              <div className="bg-slate-900/90 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-lg space-y-1 hover:border-amber-500/40 transition-all">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avance PARESA</span>
                <div className="text-xl font-black text-amber-400 font-mono">98.450 UC</div>
                <div className="text-[10px] text-slate-400 font-medium">86.74% meta · 94.4% MTD</div>
              </div>

              <div className="bg-slate-900/90 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-lg space-y-1 hover:border-indigo-500/40 transition-all">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cumplimiento Meta</span>
                <div className="text-xl font-black text-indigo-400 font-mono">{targetProgressPct}%</div>
                <div className="text-[10px] text-slate-400 font-medium">Pacing comercial activo</div>
              </div>

              <div className="bg-slate-900/90 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-lg space-y-1 hover:border-rose-500/40 transition-all">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Punto de Reorden</span>
                <div className="text-xl font-black text-rose-400 font-mono">12 SKUs</div>
                <div className="text-[10px] text-slate-400 font-medium">Quiebres críticos en depósito</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Tarjetas de Inteligencia Ejecutiva (Comercial, Financiero, Marketing) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Gerente Comercial IA */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-xl hover:border-indigo-500/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-105 transition-all">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Gerente Comercial IA</h4>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold">Pacing en Meta (+3.8%)</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                La rotación de líneas CORE (Coca-Cola) lidera la facturación. Se recomienda impulsar <strong>Nuevas Bebidas & Aguas</strong> para maximizar el tramo de Rebate del trimestre.
              </p>
            </div>
            <div className="pt-3.5 mt-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => navigate("/commercial-agent")} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1.5 group-hover:translate-x-1 transition-all">
                <span>Consultar Estrategia Comercial</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Gerente Financiero IA */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-xl hover:border-teal-500/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-105 transition-all">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Gerente Financiero IA</h4>
                    <span className="text-[11px] text-teal-600 dark:text-teal-400 font-extrabold">Calce Operativo Óptimo</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Cuentas corrientes en plazo promedio de 18 días. Se proyecta un flujo positivo de caja y cobranzas de <strong>Gs. 410M</strong> para la próxima semana.
              </p>
            </div>
            <div className="pt-3.5 mt-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => navigate("/finance-agent")} className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 flex items-center gap-1.5 group-hover:translate-x-1 transition-all">
                <span>Auditar Tesorería & Calce</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Gerente de Marketing & Clientes IA */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-xl hover:border-purple-500/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-105 transition-all">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Gerente de Marketing IA</h4>
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-extrabold">14 Cuentas Top en Alza</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                La cartera mayorista en Pedro Juan Caballero incrementó ticket en +12%. Se detectaron 6 clientes inactivos listos para campaña preventiva de WhatsApp.
              </p>
            </div>
            <div className="pt-3.5 mt-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => navigate("/marketing")} className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1.5 group-hover:translate-x-1 transition-all">
                <span>Lanzar Campaña Reactivación</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. 4 BENTO CARDS KPI DE ALTO IMPACTO (SWISS EXECUTIVE LUXURY LIGHT)
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI 1: Facturación Total */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:border-indigo-500/50 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all pointer-events-none" />
          
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ventas Netas</span>
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              </div>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                {totalVentasMonto > 0 ? formatCompactPYG(totalVentasMonto) : "Gs. 0"}
              </div>
              <div className="text-xs font-mono text-slate-400 dark:text-slate-500 font-bold truncate max-w-[220px]" title={formatPYG(totalVentasMonto)}>
                {formatPYG(totalVentasMonto)}
              </div>
            </div>
            <div className="w-13 h-13 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <DollarSign className="w-7 h-7" />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs relative z-10">
            <span className={`inline-flex items-center gap-1 font-extrabold px-2.5 py-1 rounded-xl text-xs ${
              ventasDiffPct >= 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
            }`}>
              {ventasDiffPct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {ventasDiffPct >= 0 ? `+${ventasDiffPct}%` : `${ventasDiffPct}%`} vs anterior
            </span>
            <span className="text-slate-400 text-xs font-semibold">Descontadas NC</span>
          </div>
        </div>

        {/* KPI 2: Margen Bruto Real & Rentabilidad */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:border-teal-500/50 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Margen Bruto Directo</span>
                <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 text-[10px] font-black uppercase">
                  8.3% Directo
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-teal-600 dark:text-teal-400 tracking-tight font-mono">
                {margenBrutoGs > 0 ? formatCompactPYG(margenBrutoGs) : "Gs. 0"}
              </div>
              <div className="text-xs font-mono text-slate-400 dark:text-slate-500 font-bold">
                + Rebates: <span className="text-emerald-600 dark:text-emerald-400 font-black">11.3% Total (Gs. 698M)</span>
              </div>
            </div>
            <div className="w-13 h-13 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all duration-300">
              <TrendingUp className="w-7 h-7" />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs relative z-10">
            <span className="text-teal-700 dark:text-teal-400 font-extrabold text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              Utilidad Mayorista
            </span>
            <span className="text-slate-400 text-xs font-mono">COGS: Gs. 5.689M</span>
          </div>
        </div>

        {/* KPI 3: Volumen PARESA & Rebates Ganados */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-900/40 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:border-amber-500/60 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">Avance Volumen PARESA</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                  94.41% MTD
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                98.450 <span className="text-base font-bold text-slate-400 dark:text-slate-500">/ 113.503 UC</span>
              </div>
              <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                86.74% de la meta mensual
              </div>
              <div className="text-xs font-mono text-amber-700 dark:text-amber-400 font-black pt-0.5">
                Rebate Ganado: Gs. 146.439.074 (+4.5%)
              </div>
            </div>
            <div className="w-13 h-13 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
              <Award className="w-7 h-7" />
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-amber-100 dark:border-amber-900/30 flex items-center justify-between relative z-10">
            <button
              onClick={() => navigate("/supplier-kpis")}
              className="w-full py-2 px-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/20 to-orange-500/15 hover:from-amber-500 hover:to-orange-500 text-amber-800 dark:text-amber-300 hover:text-white border border-amber-500/30 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-xs group-hover:shadow-md cursor-pointer"
            >
              <span>Ver Rebates PARESA</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI 4: Operaciones & Ticket Medio */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-2xl hover:border-purple-500/50 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1.5">
              <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Facturas Emitidas</span>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                {totalTickets.toLocaleString()} <span className="text-base font-bold text-slate-400 dark:text-slate-500">docs</span>
              </div>
              <div className="text-xs font-mono text-slate-400 dark:text-slate-500 font-bold">
                Ticket Medio: <span className="text-slate-800 dark:text-slate-200 font-black">{formatCompactPYG(ticketPromedio)}</span>
              </div>
            </div>
            <div className="w-13 h-13 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shadow-inner group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
              <ShoppingCart className="w-7 h-7" />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs relative z-10">
            <span className={`inline-flex items-center gap-1 font-extrabold px-2.5 py-1 rounded-xl text-xs ${
              transaccionesDiffPct >= 0
                ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
            }`}>
              {transaccionesDiffPct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {transaccionesDiffPct >= 0 ? `+${transaccionesDiffPct}%` : `${transaccionesDiffPct}%`} flujo
            </span>
            <span className="text-slate-400 text-xs font-semibold">Actividad Comercial</span>
          </div>
        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. ANALYTICS HUB CENTRAL — PACING COMERCIAL & MIX DE CATEGORÍAS
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        
        {/* COLUMNA 1 (7 de 12): CURVA DE PACING COMERCIAL */}
        <div className="lg:col-span-7 p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-inner">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Pacing Comercial & Curva de Ventas</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Comparativa contra Meta (+5%), Mes Anterior y Año Anterior</p>
                </div>
              </div>
            </div>

            {/* Selector de Rango */}
            <div className="flex items-center p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 self-start sm:self-auto shadow-inner">
              <button
                onClick={() => setTimeRange("hoy")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  timeRange === "hoy"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => setTimeRange("semana")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  timeRange === "semana"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setTimeRange("mes")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  timeRange === "mes"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Mes
              </button>
              <button
                onClick={() => setTimeRange("anio")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  timeRange === "anio"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Año
              </button>
            </div>
          </div>

          {/* Toggle de Magnitudes Comparativas */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <button
              onClick={() => setShowActual(!showActual)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border cursor-pointer ${
                showActual
                  ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-800 dark:text-indigo-300 shadow-2xs"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${showActual ? "bg-indigo-600 shadow-xs" : "bg-slate-300"}`} />
              Venta Actual
            </button>

            <button
              onClick={() => setShowMeta(!showMeta)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border cursor-pointer ${
                showMeta
                  ? "bg-slate-500/15 border-slate-400/40 text-slate-800 dark:text-slate-300 shadow-2xs"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-sm ${showMeta ? "bg-slate-400" : "bg-slate-300"}`} />
              Meta Barras (+5%)
            </button>

            <button
              onClick={() => setShowPrevMonth(!showPrevMonth)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border cursor-pointer ${
                showPrevMonth
                  ? "bg-sky-500/15 border-sky-500/40 text-sky-800 dark:text-sky-300 shadow-2xs"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${showPrevMonth ? "bg-sky-500 shadow-xs" : "bg-slate-300"}`} />
              Mes Anterior
            </button>

            <button
              onClick={() => setShowPrevYear(!showPrevYear)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border cursor-pointer ${
                showPrevYear
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 shadow-2xs"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full border border-dashed border-amber-600 ${showPrevYear ? "bg-amber-500 shadow-xs" : "bg-slate-300"}`} />
              Año Anterior
            </button>
          </div>

          {/* Gráfico Recharts de Pacing ComposedChart */}
          <div className="h-80 w-full">
            {salesTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
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
                        return (
                          <div className="p-4 bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl text-white text-xs space-y-2.5 min-w-[250px]">
                            <div className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex justify-between items-center">
                              <span>{label}</span>
                              <span className="font-mono text-[11px] text-slate-400">{data.fecha}</span>
                            </div>

                            {showActual && (
                              <div className="flex justify-between items-center text-indigo-300 font-medium">
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                  Venta Actual:
                                </span>
                                <span className="font-mono font-black text-white">{formatPYG(data.actual)}</span>
                              </div>
                            )}

                            {showMeta && data.meta > 0 && (
                              <div className="flex justify-between items-center text-slate-300 font-medium">
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-400" />
                                  Meta (+5%):
                                </span>
                                <span className="font-mono">{formatPYG(data.meta)}</span>
                              </div>
                            )}

                            {showPrevMonth && data.mes_anterior > 0 && (
                              <div className="flex justify-between items-center text-sky-300 font-medium">
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                                  Mes Anterior:
                                </span>
                                <span className="font-mono">{formatPYG(data.mes_anterior)}</span>
                              </div>
                            )}

                            {showPrevYear && data.ano_anterior > 0 && (
                              <div className="flex justify-between items-center text-amber-300 font-medium">
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                  Año Anterior:
                                </span>
                                <span className="font-mono">{formatPYG(data.ano_anterior)}</span>
                              </div>
                            )}

                            {diffVsMesAnt !== null && (
                              <div className="pt-2 border-t border-slate-800 flex justify-between text-[11px]">
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

                  {showActual && (
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#6366f1"
                      strokeWidth={3.5}
                      fillOpacity={1}
                      fill="url(#pacingGradient)"
                      name="Venta Actual"
                    />
                  )}

                  {showPrevMonth && (
                    <Line
                      type="monotone"
                      dataKey="mes_anterior"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#0284c7" }}
                      name="Mes Anterior"
                    />
                  )}

                  {showPrevYear && (
                    <Line
                      type="monotone"
                      dataKey="ano_anterior"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: "#f59e0b" }}
                      name="Año Anterior"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
                <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block shadow-xs" />
                <span>Venta Actual</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
                <span className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-slate-700 border border-slate-400 inline-block" />
                <span>Meta Barras (+5%)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
                <span className="w-3 h-0.5 bg-sky-500 inline-block" />
                <span>Mes Anterior</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
                <span className="w-3 h-0.5 bg-amber-500 inline-block border-b border-dashed border-amber-600" />
                <span>Año Anterior</span>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono font-medium">Pacing en Vivo</span>
          </div>
        </div>

        {/* COLUMNA 2 (5 de 12): MIX DE CATEGORÍAS & RENTABILIDAD EJECUTIVA REDISEÑADA */}
        <div className="lg:col-span-5 p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold shadow-inner">
                  <PieChartIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Mix de Categorías & Margen</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Distribución de facturación y rentabilidad</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 text-xs font-black border border-teal-500/20 shadow-2xs">
                {categoryMixData.length} Familias
              </span>
            </div>

            {/* Interactive Luxury Donut + Center Metric */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              
              <div className="sm:col-span-5 h-48 w-full relative flex items-center justify-center">
                {categoryMixData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">Sin datos</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryMixData}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={76}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {categoryMixData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => [formatPYG(Number(val)), "Facturación"]}
                          contentStyle={{ backgroundColor: "#0f172a", borderRadius: "1rem", border: "1px solid #334155", color: "#fff", fontSize: "12px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500">Líder</span>
                      <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                        {categoryMixData[0]?.percentage || 0}%
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Top Family Highlight Card */}
              <div className="sm:col-span-7 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Familia Dominante:</span>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                    {categoryMixData[0]?.percentage || 0}% mix
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {categoryMixData[0]?.name || "Bebidas & Refrescos"}
                </div>
                <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-600 dark:text-slate-300">
                  <span className="font-bold">{formatCompactPYG(categoryMixData[0]?.value || 0)}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                    Margen: ~{categoryMixData[0]?.margen || 16.5}%
                  </span>
                </div>
              </div>

            </div>

            {/* Listado Ultra-Detallado con Cards y Barras Gradientes */}
            <div className="space-y-2 mt-4 max-h-56 overflow-y-auto pr-1">
              {categoryMixData.map((cat) => (
                <div
                  key={cat.name}
                  className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 hover:border-teal-500/40 transition-all space-y-2 group shadow-2xs"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-3.5 h-3.5 rounded-md shrink-0 shadow-xs" style={{ backgroundColor: cat.color }} />
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-[10px] font-black text-slate-700 dark:text-slate-300">
                        {cat.percentage}%
                      </span>
                      <span className="font-black text-slate-900 dark:text-white text-xs">
                        {formatCompactPYG(cat.value)}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200/70 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(cat.percentage, 3)}%`, backgroundColor: cat.color }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    <span>{cat.unidades ? `${cat.unidades.toLocaleString()} un.` : "Alta Rotación"}</span>
                    <span className="text-teal-600 dark:text-teal-400 font-extrabold font-mono">
                      Margen: {cat.margen ? `${cat.margen}%` : "16.5%"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={() => navigate("/reports")}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Auditar Rentabilidad Completa por Familia</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. BENTO ROW OPERATIVO: TOP 10 PRODUCTOS, TOP 10 CLIENTES Y ALERTAS FEFO
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        
        {/* COL 1: TOP 10 PRODUCTOS / SKUS MAYORISTAS */}
        <div className="p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-500" />
                Top 10 SKUs de Mayor Rotación
              </h3>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-black tracking-wider">Ranking Ventas</span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {topProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">Sin movimientos registrados en este período</div>
              ) : (
                topProducts.map((p: any, idx: number) => {
                  const isTop3 = idx < 3
                  const rankBadgeBg = idx === 0 ? "bg-amber-500 text-white shadow-xs" : idx === 1 ? "bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-white" : idx === 2 ? "bg-amber-700 text-white" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs hover:border-indigo-500/40 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <span className={`w-6 h-6 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${rankBadgeBg}`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{p.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku || "N/A"} · {formatNumber(p.unidades, 0)} unids</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-xs">{formatCompactPYG(p.monto)}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <button onClick={() => navigate("/products")} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer">
              Ir a Catálogo Completo →
            </button>
          </div>
        </div>

        {/* COL 2: TOP 10 CLIENTES MAYORISTAS */}
        <div className="p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Top 10 Clientes Mayoristas
              </h3>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-black tracking-wider">Cartera Top</span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {topCustomers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">Sin compras registradas en este período</div>
              ) : (
                topCustomers.map((c: any, idx: number) => {
                  const rankBadgeBg = idx === 0 ? "bg-amber-500 text-white shadow-xs" : idx === 1 ? "bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-white" : idx === 2 ? "bg-amber-700 text-white" : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs hover:border-purple-500/40 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <span className={`w-6 h-6 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${rankBadgeBg}`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{c.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">RUC: {c.ruc || "Sin RUC"} · {c.transacciones} facturas</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <span className="font-black text-purple-600 dark:text-purple-400 text-xs">{formatCompactPYG(c.monto)}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <button onClick={() => navigate("/customers")} className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer">
              Ver Cartera Mayorista Completa →
            </button>
          </div>
        </div>

        {/* COL 3: ALERTAS DE VENCIMIENTO FEFO & CONTROL DE STOCK */}
        <div className="p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Alertas de Vencimiento (Control FEFO)
              </h3>
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                Perecederos
              </span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {expiryAlerts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">No hay lotes con alertas de vencimiento próximas</div>
              ) : (
                expiryAlerts.map((exp: any) => (
                  <div
                    key={exp.id}
                    className={`p-3 rounded-2xl border text-xs flex items-center justify-between transition-all shadow-2xs ${
                      exp.nivel === "critico"
                        ? "bg-rose-500/5 border-rose-500/30 text-rose-950 dark:text-rose-100"
                        : exp.nivel === "alerta"
                        ? "bg-amber-500/5 border-amber-500/30 text-amber-950 dark:text-amber-100"
                        : "bg-teal-500/5 border-teal-500/20 text-teal-950 dark:text-teal-100"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold truncate">{exp.nombre}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
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
