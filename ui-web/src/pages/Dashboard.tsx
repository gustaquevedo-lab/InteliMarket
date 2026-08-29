import { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  TrendingUp, DollarSign, ShoppingCart, Package, Users,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Clock, ChevronRight,
  Sparkles, RefreshCw, BarChart3, PieChart as PieChartIcon, ShieldAlert,
  Truck, CheckCircle2, Building2, Flame, Layers, Box, Scale, Calendar,
  ArrowRight, Activity, Wallet, Cpu, Bell, CheckCircle, ArrowUpDown,
  Zap, FileText, Download, ExternalLink, HelpCircle, Target, Warehouse
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from "recharts"
import { api } from "../api"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { formatPYG, formatNumber } from "../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

type TimeRange = "hoy" | "semana" | "mes" | "anio"

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [timeRange, setTimeRange] = useState<TimeRange>("mes")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pacingMode, setPacingMode] = useState<"diario" | "acumulado">("diario")
  const [mixViewMode, setMixViewMode] = useState<"venta" | "margen">("venta")

  // Master Dashboard Data returned by backend calculation engine
  const [allKpisData, setAllKpisData] = useState<any>(null)

  // Carga completa en vivo de todos los KPIs calculados por la base de datos
  const loadDashboardData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const data = await api.reports.dashboardAllKpis(COMPANY_ID)
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
  }, [toast])

  useEffect(() => {
    loadDashboardData(true)
  }, [loadDashboardData])

  const handleManualRefresh = () => {
    setRefreshing(true)
    loadDashboardData(false)
  }

  // Active time-range period snapshot
  const activePeriod = useMemo(() => {
    if (!allKpisData) return null
    return allKpisData[timeRange] || allKpisData["mes"] || null
  }, [allKpisData, timeRange])

  // ---------------------------------------------------------------------------
  // MÉTRICAS Y DATOS REALES (CALCULADOS DIRECTAMENTE EN POSTGRESQL)
  // ---------------------------------------------------------------------------
  const totalVentasMonto = Number(activePeriod?.ventas_total_gs || 0)
  const totalTickets = Number(activePeriod?.transacciones_count || 0)
  const ticketPromedio = Number(activePeriod?.ticket_promedio_gs || (totalTickets > 0 ? Math.round(totalVentasMonto / totalTickets) : 0))
  const margenBrutoGs = Number(activePeriod?.margen_bruto_gs || 0)
  const margenBrutoPct = Number(activePeriod?.margen_bruto_pct || 0)
  const costoTotalMercaderias = Number(activePeriod?.costo_total_gs || Math.max(0, totalVentasMonto - margenBrutoGs))

  // PARESA UC & Rebate
  const paresaTotalUC = Number(activePeriod?.cajas_paresa_uc || 0)
  const paresaRebateGs = Number(activePeriod?.rebate_estimado_gs || 0)
  const paresaTargetUC = timeRange === "mes" ? 113503 : timeRange === "semana" ? 28375 : 4540
  const paresaPctAlcanzado = paresaTargetUC > 0 ? Math.min(100, Number(((paresaTotalUC / paresaTargetUC) * 100).toFixed(1))) : 0

  // Stock e Inventario
  const stockValorizado = Number(activePeriod?.stock_valorizado_gs || 0)
  const quiebresCriticos = Number(activePeriod?.quiebres_criticos_count || 0)

  // ---------------------------------------------------------------------------
  // GRÁFICO RECHARTS PACING (DIARIO VS ACUMULADO)
  // ---------------------------------------------------------------------------
  const salesTrendData = useMemo(() => {
    if (!activePeriod?.evolucion_puntos || activePeriod.evolucion_puntos.length === 0) return []
    return activePeriod.evolucion_puntos.map((d: any) => {
      const isAcum = pacingMode === "acumulado"
      return {
        label: d.label || "",
        fecha: d.fecha || "",
        actual: isAcum ? Number(d.acum_actual || 0) : Number(d.monto_actual || 0),
        mes_anterior: isAcum ? Number(d.acum_mes_ant || 0) : Number(d.monto_mes_ant || 0),
        ano_anterior: isAcum ? Number(d.acum_anio_ant || 0) : Number(d.monto_anio_ant || 0),
        meta: isAcum ? Number(d.acum_meta || 0) : Number(d.meta || 0),
      }
    })
  }, [activePeriod, pacingMode])

  // ---------------------------------------------------------------------------
  // CATEGORÍAS & MIX COMERCIAL REAL
  // ---------------------------------------------------------------------------
  const categoryMixData = useMemo(() => {
    if (!activePeriod?.mix_categorias?.items || activePeriod.mix_categorias.items.length === 0) return []
    return activePeriod.mix_categorias.items.map((c: any) => ({
      name: c.nombre || c.codigo,
      value: Number(c.monto || 0),
      percentage: Number(c.pct || 0).toFixed(1),
      margen: Number(c.margen_pct || 0).toFixed(1),
      unidades: Number(c.unidades || 0),
      color: c.color || "#3b82f6",
    }))
  }, [activePeriod])

  // ---------------------------------------------------------------------------
  // TOP PRODUCTOS / SKUS DE ALTA ROTACIÓN
  // ---------------------------------------------------------------------------
  const topMovers = useMemo(() => {
    if (!activePeriod?.top_productos || activePeriod.top_productos.length === 0) return []
    return activePeriod.top_productos.slice(0, 5)
  }, [activePeriod])

  // ---------------------------------------------------------------------------
  // TOP CLIENTES MAYORISTAS
  // ---------------------------------------------------------------------------
  const topClientes = useMemo(() => {
    if (!activePeriod?.top_clientes || activePeriod.top_clientes.length === 0) return []
    return activePeriod.top_clientes.slice(0, 5)
  }, [activePeriod])

  return (
    <div className="space-y-6 pb-20 max-w-full overflow-hidden animate-fade-in">
      {/* ──────────────────────────────────────────────────────────────────────────
          HEADER EJECUTIVO DISTRIBUIDORA MAYORISTA
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800/90 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" /> InteliMarket Enterprise AI Cockpit
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> SIFEN & Datos en Vivo
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              Casa Gonzalito — Distribución Mayorista Amambay
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Buenos días, {user?.nombre || "Gustavo"}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-3xl">
            Panel de Control 360° en tiempo real con Inteligencia Artificial, Margen Bruto Comercial y seguimiento de Metas PARESA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-600 text-xs font-bold">
            {(["hoy", "semana", "mes", "anio"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded-lg transition-all capitalize font-mono ${
                  timeRange === r
                    ? "bg-indigo-600 text-white shadow-sm font-black"
                    : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-600"
                }`}
              >
                {r === "hoy" ? "Hoy" : r === "semana" ? "Esta Semana" : r === "mes" ? "Este Mes" : "Año Completo"}
              </button>
            ))}
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-slate-600"
            title="Actualizar datos en vivo"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          AI COPILOT COCKPIT & 3 ACCIONES ESTRATÉGICAS DISTRIBUIDORA
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 border-b border-slate-700/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/40 border border-indigo-400/30 text-indigo-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">
                  InteliMarket AI Copilot — Diagnóstico ({timeRange === "mes" ? "Este Mes" : timeRange === "semana" ? "Esta Semana" : timeRange === "hoy" ? "Hoy" : "Año 2026"})
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {totalTickets.toLocaleString()} FACTURAS REGISTRADAS
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Ventas netas en <strong>{formatPYG(totalVentasMonto)}</strong> con Margen Bruto Real de <strong>{margenBrutoPct.toFixed(1)}% ({formatPYG(margenBrutoGs)})</strong>. Volumen PARESA: <strong>{formatNumber(paresaTotalUC, 0)} UC</strong> acumuladas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/proveedor-kpis")} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-400/40 text-indigo-200 transition-colors flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Metas PARESA
            </button>
            <button onClick={() => navigate("/purchases")} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Riesgos Quiebre
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div onClick={() => navigate("/proveedor-kpis")} className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-black text-indigo-300 tracking-wider">
                Destrabar Escalón Rebate Aguas PARESA
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                +{formatPYG(paresaRebateGs)}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cumplimiento del <strong>{paresaPctAlcanzado}%</strong> en volumen PARESA ({formatNumber(paresaTotalUC, 0)} UC). Faltan <strong>{formatNumber(Math.max(0, paresaTargetUC - paresaTotalUC), 0)} UC</strong> para consolidar la escala máxima del 4,5%.
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-indigo-400 font-bold group-hover:text-indigo-300">
              <span>Ver Tablero PARESA</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div onClick={() => navigate("/purchases")} className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-black text-indigo-300 tracking-wider">
                Reabastecimiento Trébol & Core
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Stock: {formatPYG(stockValorizado)}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {activePeriod?.mix_categorias?.ai_recommendation ? (
                <span dangerouslySetInnerHTML={{ __html: activePeriod.mix_categorias.ai_recommendation }} />
              ) : (
                "Monitoreo de líneas Larga Vida y Bebidas Core para asegurar stock en rutas mayoristas."
              )}
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-indigo-400 font-bold group-hover:text-indigo-300">
              <span>Revisar Compras & Depósito</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div onClick={() => navigate("/accounts-receivable")} className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-black text-indigo-300 tracking-wider">
                Cobranzas de Cartera Mayorista
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Top Clientes
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {topClientes.length > 0 ? (
                <span>Líder en compras: <strong>{topClientes[0]?.nombre}</strong> con {formatPYG(topClientes[0]?.total_compras || 0)}.</span>
              ) : (
                "Seguimiento de saldos vencidos y límites de crédito asignados por cliente."
              )}
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-indigo-400 font-bold group-hover:text-indigo-300">
              <span>Ver Cuentas a Cobrar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4 MAIN HERO CARDS — METRICAS OPERATIVAS REALES
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* HERO 1: VENTAS TOTALES */}
        <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Facturación ({timeRange === "mes" ? "Este Mes" : timeRange === "semana" ? "Esta Semana" : timeRange === "hoy" ? "Hoy" : "Año 2026"})
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {totalTickets.toLocaleString()} facturas
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-gray-900 dark:text-white tracking-tight">
            {formatPYG(totalVentasMonto)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 font-mono">
            <span>Ticket Prom: <strong className="text-gray-900 dark:text-gray-100">{formatPYG(ticketPromedio)}</strong></span>
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> En vivo
            </span>
          </div>
        </div>

        {/* HERO 2: MARGEN BRUTO COMERCIAL */}
        <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Margen Bruto ({timeRange === "mes" ? "Este Mes" : timeRange === "semana" ? "Esta Semana" : timeRange === "hoy" ? "Hoy" : "Año 2026"})
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {margenBrutoPct.toFixed(1)}% Bruto
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-teal-600 dark:text-teal-400 tracking-tight">
            {formatPYG(margenBrutoGs)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 font-mono">
            <span>Facturado: <strong className="text-gray-900 dark:text-gray-100">{formatPYG(totalVentasMonto)}</strong></span>
            <span>COGS: <strong className="text-gray-700 dark:text-gray-300">{formatPYG(costoTotalMercaderias)}</strong></span>
          </div>
        </div>

        {/* HERO 3: VOLUMEN PARESA & REBATES */}
        <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              PARESA ({timeRange === "mes" ? "Este Mes" : timeRange === "semana" ? "Esta Semana" : timeRange === "hoy" ? "Hoy" : "Año 2026"})
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {paresaPctAlcanzado}% Meta
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400 tracking-tight">
            {formatNumber(paresaTotalUC, 0)} <span className="text-sm font-bold text-gray-500 dark:text-gray-400">UC</span>
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 font-mono">
            <span>Rebate Estimado: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatPYG(paresaRebateGs)}</strong></span>
            <button onClick={() => navigate("/proveedor-kpis")} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Ver Tabla →</button>
          </div>
        </div>

        {/* HERO 4: STOCK EN DEPÓSITO */}
        <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Stock en Depósito
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Inventario Activo
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-purple-600 dark:text-purple-400 tracking-tight">
            {formatPYG(stockValorizado)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 font-mono">
            <span>Casa Gonzalito</span>
            <button onClick={() => navigate("/deposito")} className="text-purple-600 dark:text-purple-400 font-bold hover:underline">Ver Depósito →</button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          GRÁFICO DE RITMO Y EVOLUCIÓN (PACING) & MIX POR CATEGORÍA
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO PACING (2 COLUMNAS) */}
        <div className="lg:col-span-2 card p-6 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Ritmo y Evolución de Ventas ({timeRange === "mes" ? "Este Mes" : timeRange === "semana" ? "Esta Semana" : timeRange === "hoy" ? "Hoy" : "Año 2026"})
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Ventas reales por día vs mes anterior, mismo período del año anterior y meta de facturación.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-bold">
              <button
                onClick={() => setPacingMode("diario")}
                className={`px-3 py-1 rounded-lg transition-all ${pacingMode === "diario" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs font-black" : "text-slate-600 dark:text-slate-400"}`}
              >
                📊 Diario
              </button>
              <button
                onClick={() => setPacingMode("acumulado")}
                className={`px-3 py-1 rounded-lg transition-all ${pacingMode === "acumulado" ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs font-black" : "text-slate-600 dark:text-slate-400"}`}
              >
                🚀 Acumulado (Pacing)
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11, fontFamily: "monospace" }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fontFamily: "monospace" }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip
                  formatter={(value: any) => [formatPYG(Number(value)), ""]}
                  labelStyle={{ fontWeight: "bold", fontFamily: "monospace" }}
                  contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderColor: "#334155", borderRadius: "12px", color: "#fff" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Area type="monotone" dataKey="actual" name="Ventas Actuales" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" />
                <Area type="monotone" dataKey="mes_anterior" name="Mes Anterior" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" fill="none" />
                <Area type="monotone" dataKey="ano_anterior" name="Año Anterior" stroke="#06b6d4" strokeWidth={2} strokeDasharray="3 3" fill="none" />
                <Area type="monotone" dataKey="meta" name="Meta Pacing" stroke="#10b981" strokeWidth={2} strokeDasharray="2 2" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MIX POR CATEGORÍA (1 COLUMNA) */}
        <div className="card p-6 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Mix por Categoría
              </h2>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-lg text-[11px] font-bold">
                <button onClick={() => setMixViewMode("venta")} className={`px-2 py-0.5 rounded-md ${mixViewMode === "venta" ? "bg-white dark:bg-slate-800 text-indigo-600 font-bold" : "text-gray-500"}`}>% Venta</button>
                <button onClick={() => setMixViewMode("margen")} className={`px-2 py-0.5 rounded-md ${mixViewMode === "margen" ? "bg-white dark:bg-slate-800 text-indigo-600 font-bold" : "text-gray-500"}`}>% Margen</button>
              </div>
            </div>

            <div className="h-48 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryMixData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                    {categoryMixData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [formatPYG(Number(val)), ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Mix</span>
                <span className="text-xs font-black font-mono text-gray-900 dark:text-white">{formatPYG(totalVentasMonto).replace("Gs ", "")}</span>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {categoryMixData.map((cat: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[140px]">{cat.name}</span>
                  </div>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {mixViewMode === "venta" ? `${cat.percentage}%` : `${cat.margen}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          TOP 5 SKUS DE ALTA ROTACIÓN & TOP CLIENTES MAYORISTAS
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TABLA 1: TOP SKUS */}
        <div className="card p-6 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                Top 5 SKUs Líderes en Facturación
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Productos con mayor contribución al volumen y margen de Casa Gonzalito.
              </p>
            </div>
            <button onClick={() => navigate("/reports")} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              Ver reporte <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">
                <tr>
                  <th className="p-3">Producto / SKU</th>
                  <th className="p-3 text-right">Cantidad</th>
                  <th className="p-3 text-right">Facturación</th>
                  <th className="p-3 text-right">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono">
                {topMovers.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="p-3 font-sans font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-[10px] font-black shrink-0 font-mono">
                        #{i + 1}
                      </span>
                      <div>
                        <div className="text-xs font-bold truncate max-w-xs">{p.nombre || p.producto}</div>
                        <div className="text-[10px] text-gray-400 font-mono">SKU: {p.sku || "—"}</div>
                      </div>
                    </td>
                    <td className="p-3 text-right font-bold text-gray-700 dark:text-gray-200">
                      {Number(p.cantidad || 0).toLocaleString()} un.
                    </td>
                    <td className="p-3 text-right font-black text-gray-900 dark:text-white">
                      {formatPYG(p.total || p.monto || 0)}
                    </td>
                    <td className="p-3 text-right font-bold text-teal-600 dark:text-teal-400">
                      {Number(p.margen_pct || p.margen || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLA 2: TOP CLIENTES MAYORISTAS */}
        <div className="card p-6 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Top Cuentas Comerciales Clave
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Mayores compradores y volumen de crédito en Amambay.
              </p>
            </div>
            <button onClick={() => navigate("/customers")} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              Ver clientes <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 uppercase font-mono font-bold">
                <tr>
                  <th className="p-3">Cliente / RUC</th>
                  <th className="p-3 text-center">Compras</th>
                  <th className="p-3 text-right">Facturación</th>
                  <th className="p-3 text-right">Ticket Prom</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono">
                {topClientes.map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="p-3 font-sans font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-[10px] font-black shrink-0 font-mono">
                        #{i + 1}
                      </span>
                      <div>
                        <div className="text-xs font-bold truncate max-w-xs">{c.nombre}</div>
                        <div className="text-[10px] text-gray-400 font-mono">RUC: {c.ruc || "—"}</div>
                      </div>
                    </td>
                    <td className="p-3 text-center font-bold text-gray-700 dark:text-gray-200">
                      {c.compras_count || 0}
                    </td>
                    <td className="p-3 text-right font-black text-gray-900 dark:text-white">
                      {formatPYG(c.total_compras || 0)}
                    </td>
                    <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                      {formatPYG(c.ticket_promedio || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
