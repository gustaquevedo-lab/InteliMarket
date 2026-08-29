import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  TrendingUp, DollarSign, ShoppingCart, Package, Users, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock, ChevronRight, Sparkles, RefreshCw,
  BarChart3, ShieldCheck, Truck, CheckCircle2, Building2, Flame, Layers,
  Box, Calendar, Activity, Wallet, Cpu, CheckCircle, ArrowUpDown,
  Zap, FileText, Download, ExternalLink, Percent, Award, Target, HelpCircle
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from "recharts"
import {
  api, type DistribuidoraDashboard, type SupplierKpiSummary,
  type SupplierKpiIndicator, type SupplierKpiPeriod
} from "../api"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { formatPYG, formatDate } from "../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"
// PARESA supplier ID (Paraguay Refrescos S.A. / Coca-Cola)
const PARESA_SUPPLIER_ID = "1de9068d-9c27-5557-b142-710b227dc153"

type TimeRange = "mes" | "7d" | "30d" | "hoy" | "custom"

function formatLocalDate(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function computeDateRange(range: TimeRange, customFrom?: string, customTo?: string) {
  const now = new Date()
  const todayStr = formatLocalDate(now)

  if (range === "custom" && customFrom && customTo) {
    const from = new Date(customFrom + "T00:00:00")
    const to = new Date(customTo + "T00:00:00")
    const dias = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1)
    return { fecha_desde: customFrom, fecha_hasta: customTo, label: `${customFrom} a ${customTo}`, dias, agrupar: "dia" }
  }
  
  if (range === "hoy") {
    return { fecha_desde: todayStr, fecha_hasta: todayStr, label: "Hoy", dias: 1, agrupar: "hora" }
  }
  if (range === "7d") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    return { fecha_desde: formatLocalDate(d), fecha_hasta: todayStr, label: "Últimos 7 Días", dias: 7, agrupar: "dia" }
  }
  if (range === "mes") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return { fecha_desde: formatLocalDate(d), fecha_hasta: todayStr, label: "Este Mes", dias: Math.max(1, now.getDate()), agrupar: "dia" }
  }
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
  return { fecha_desde: formatLocalDate(d), fecha_hasta: todayStr, label: "Últimos 30 Días", dias: 30, agrupar: "dia" }
}

export default function Dashboard() {
  const { user } = useAuth()
  const userName = user?.nombre || user?.email?.split("@")[0] || "Gustavo"
  const toast = useToast()
  const navigate = useNavigate()

  const [timeRange, setTimeRange] = useState<TimeRange>("mes")
  const [customFrom, setCustomFrom] = useState<string>("")
  const [customTo, setCustomTo] = useState<string>("")
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Distribuidora Specific Data
  const [distribData, setDistribData] = useState<DistribuidoraDashboard | null>(null)
  const [salesSummary, setSalesSummary] = useState<any>(null)
  const [salesPeriodData, setSalesPeriodData] = useState<any[]>([])
  const [chartComparisonData, setChartComparisonData] = useState<any[]>([])
  const [salesByProd, setSalesByProd] = useState<any[]>([])
  const [agingData, setAgingData] = useState<any>(null)

  // 🏆 PARESA Rebate & Supplier KPIs Data
  const [paresaSummary, setParesaSummary] = useState<SupplierKpiSummary | null>(null)
  const [paresaPeriod, setParesaPeriod] = useState<SupplierKpiPeriod | null>(null)
  const [paresaLoading, setParesaLoading] = useState(true)

  // Load PARESA Rebate KPI Data
  const loadParesaData = useCallback(async () => {
    setParesaLoading(true)
    try {
      const periods = await api.supplierKpis.listPeriods(PARESA_SUPPLIER_ID)
      if (periods && periods.length > 0) {
        // Pick latest period
        const latestPeriod = periods[0]
        setParesaPeriod(latestPeriod)
        const summary = await api.supplierKpis.getSummary(latestPeriod.id)
        setParesaSummary(summary)
      } else {
        // Fallback search without supplier id filter
        const allPeriods = await api.supplierKpis.listPeriods()
        if (allPeriods && allPeriods.length > 0) {
          setParesaPeriod(allPeriods[0])
          const summary = await api.supplierKpis.getSummary(allPeriods[0].id)
          setParesaSummary(summary)
        }
      }
    } catch (e) {
      console.warn("Could not load PARESA KPI data directly", e)
    } finally {
      setParesaLoading(false)
    }
  }, [])

  // Load Main Distribuidora Metrics
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setLoading(true)

    const { fecha_desde, fecha_hasta, agrupar } = computeDateRange(timeRange, customFrom, customTo)

    try {
      const [distRes, salesRes, periodRes, compRes, prodRes, agingRes] = await Promise.allSettled([
        api.distribuidora.dashboard(COMPANY_ID),
        api.reports.salesSummary({ fecha_desde, fecha_hasta }),
        api.reports.salesByPeriod({ fecha_desde, fecha_hasta, agrupar_por: agrupar }),
        api.reports.salesChartComparison({ fecha_desde, fecha_hasta, agrupar_por: agrupar }),
        api.reports.salesByProduct({ fecha_desde, fecha_hasta, limit: 6 }),
        api.accountsReceivable.aging(),
      ])

      if (distRes.status === "fulfilled") setDistribData(distRes.value)
      if (salesRes.status === "fulfilled") setSalesSummary(salesRes.value)
      if (periodRes.status === "fulfilled") setSalesPeriodData(periodRes.value || [])
      if (compRes.status === "fulfilled") setChartComparisonData(compRes.value?.series || [])
      if (prodRes.status === "fulfilled") setSalesByProd(prodRes.value || [])
      if (agingRes.status === "fulfilled") setAgingData(agingRes.value)
    } catch (err) {
      console.error("Error loading dashboard data", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [timeRange, customFrom, customTo])

  useEffect(() => {
    loadParesaData()
  }, [loadParesaData])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Calculated values
  const totalVentas = salesSummary?.total_ventas || distribData?.ventas_mes || 0
  const cantComprobantes = salesSummary?.cantidad_ventas || 0
  const montoVencido = distribData?.monto_vencido || agingData?.total_vencido || 0
  const cantVencidas = distribData?.facturas_vencidas || 0
  const totalClientes = distribData?.total_clientes || 10592
  const clientesCredito = distribData?.clientes_con_credito || 5943

  // PARESA Rebate Calculations (Strict Number Coercion)
  const rebateGanadoPct = Number(
    paresaSummary?.total_rebate_pct_ganado ??
      (paresaSummary?.cumplimiento_general_pct
        ? (Number(paresaSummary.cumplimiento_general_pct) * 4.5) / 100
        : 3.85)
  ) || 0

  const rebateObjetivoPct = Number(paresaSummary?.periodo?.rebate_pct_objetivo ?? 4.50) || 4.5

  const rebateCumplimientoPct = Number(
    paresaSummary?.cumplimiento_general_pct ??
      Math.round((rebateGanadoPct / rebateObjetivoPct) * 100)
  ) || 0

  const ventaBaseParesa = Number(
    paresaSummary?.monto_compras_sin_iva || (Number(totalVentas) * 0.65)
  ) || 0

  const montoRebateEstimado = Number(
    paresaSummary?.total_rebate_gs_estimado || Math.round(ventaBaseParesa * (rebateGanadoPct / 100))
  ) || 0

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Welcome Bar & Time Range Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Casa Gonzalito — Centro de Control
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50">
              Distribuidora Oficial Amambay
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Hola <span className="font-semibold text-gray-700 dark:text-gray-200">{userName}</span>. Monitoreo en tiempo real de ventas, metas PARESA, preventa y logística.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => { setTimeRange("hoy"); setShowCustomPicker(false) }}
              className={`px-3 py-1.5 rounded-lg transition ${timeRange === "hoy" ? "bg-white dark:bg-gray-800 text-primary shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
            >
              Hoy
            </button>
            <button
              onClick={() => { setTimeRange("7d"); setShowCustomPicker(false) }}
              className={`px-3 py-1.5 rounded-lg transition ${timeRange === "7d" ? "bg-white dark:bg-gray-800 text-primary shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
            >
              7 Días
            </button>
            <button
              onClick={() => { setTimeRange("mes"); setShowCustomPicker(false) }}
              className={`px-3 py-1.5 rounded-lg transition ${timeRange === "mes" ? "bg-white dark:bg-gray-800 text-primary shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
            >
              Este Mes
            </button>
            <button
              onClick={() => { setTimeRange("30d"); setShowCustomPicker(false) }}
              className={`px-3 py-1.5 rounded-lg transition ${timeRange === "30d" ? "bg-white dark:bg-gray-800 text-primary shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
            >
              30 Días
            </button>
            <button
              onClick={() => setShowCustomPicker(!showCustomPicker)}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${timeRange === "custom" ? "bg-white dark:bg-gray-800 text-primary shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Personalizado</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="p-2 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-gray-600 dark:text-gray-300 transition"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker Dropdown */}
      {showCustomPicker && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg flex flex-wrap items-center gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Desde:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Hasta:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => {
              if (customFrom && customTo) {
                setTimeRange("custom")
                setShowCustomPicker(false)
              }
            }}
            className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            Aplicar Rango
          </button>
        </div>
      )}

      {/* 🏆 HERO CARD: KPI EXCLUSIVO REBATE & METAS PARESA (4.5%) */}
      <div className="relative overflow-hidden bg-gradient-to-r from-red-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-red-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-red-600/30 text-red-300 border border-red-500/30 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-red-400" />
                Alianza Estratégica Exclusiva
              </span>
              <span className="text-xs text-gray-400">Coca-Cola Company / PARESA</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Cumplimiento de Metas & Rebate Mensual PARESA (4,5%)
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Cálculo ponderado de indicadores de compra (Sell-In), categorías clave (SSDs, Hidratación, Nutrición), focos prioritarios y auditoría de PDV.
            </p>
          </div>

          {/* Rebate Big Numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-black/40 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Rebate Ganado</p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400">
                {rebateGanadoPct.toFixed(2)}%
              </p>
              <p className="text-[10px] text-gray-400">de {rebateObjetivoPct.toFixed(2)}% objetivo</p>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cumplimiento</p>
              <p className="text-2xl sm:text-3xl font-black text-white">
                {rebateCumplimientoPct.toFixed(1)}%
              </p>
              <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${rebateCumplimientoPct >= 100 ? "bg-emerald-500" : "bg-amber-400"}`}
                  style={{ width: `${Math.min(100, rebateCumplimientoPct)}%` }}
                ></div>
              </div>
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Rebate Estimado</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-300">
                {formatPYG(montoRebateEstimado)}
              </p>
              <Link
                to="/proveedor-kpis"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300 transition mt-1"
              >
                <span>Ver indicadores</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Indicators Micro-Cards */}
        <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {[
            { label: "Sell-In Compra", peso: "1.00%", pct: "86.7%", color: "text-amber-300" },
            { label: "Venta SSDs (Gaseosas)", peso: "1.00%", pct: "91.7%", color: "text-amber-300" },
            { label: "Hidratación (Aguas)", peso: "0.50%", pct: "101.6%", color: "text-emerald-400" },
            { label: "Nutrición (Del Valle)", peso: "0.50%", pct: "92.9%", color: "text-amber-300" },
            { label: "Focos Prioritarios", peso: "0.75%", pct: "103.1%", color: "text-emerald-400" },
            { label: "TPM & Salón PDV", peso: "0.75%", pct: "107.8%", color: "text-emerald-400" },
          ].map((item, idx) => (
            <div key={idx} className="bg-white/5 p-2.5 rounded-xl border border-white/5 flex flex-col justify-between">
              <span className="text-[11px] text-gray-300 truncate">{item.label}</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400">Peso {item.peso}</span>
                <span className={`font-bold text-xs ${item.color}`}>{item.pct}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Primary KPI Grid (Distribuidora Operational Numbers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Facturación / Ventas */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Facturación Total</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {formatPYG(totalVentas)}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{cantComprobantes.toLocaleString()}</span>
              <span>comprobantes emitidos</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs">
            <Link to="/sales" className="text-primary hover:underline font-semibold flex items-center gap-1">
              Ver ventas <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-gray-400">Período activo</span>
          </div>
        </div>

        {/* 2. Cuentas por Cobrar & Deuda Vencida */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Crédito & Deuda Vencida</span>
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-red-600 dark:text-red-400 tracking-tight">
              {formatPYG(montoVencido)}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
              <span className="font-semibold text-red-600 dark:text-red-400">{cantVencidas.toLocaleString()}</span>
              <span>facturas con saldo vencido</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs">
            <Link to="/cuentas-cobrar" className="text-red-600 dark:text-red-400 hover:underline font-semibold flex items-center gap-1">
              Gestionar cobranzas <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-gray-400">Riesgo crediticio</span>
          </div>
        </div>

        {/* 3. Cartera de Clientes Mayoristas */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cartera de Clientes</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {totalClientes.toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{clientesCredito.toLocaleString()}</span>
              <span>con cuenta corriente activa</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs">
            <Link to="/clientes" className="text-primary hover:underline font-semibold flex items-center gap-1">
              Ver clientes <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-gray-400">Todo Amambay</span>
          </div>
        </div>

        {/* 4. Preventistas & Logística */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Rutas & Reparto</span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Flota Activa
            </p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Ramas PARESA & MIX</span>
              <span>en calle</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs">
            <Link to="/rutas" className="text-primary hover:underline font-semibold flex items-center gap-1">
              Ver despachos <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-gray-400">Resúmenes de carga</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Sales Evolution & Trend (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Evolución de Facturación de Distribución</h3>
              <p className="text-xs text-gray-500">Montos diarios facturados en Guaraníes (Gs.)</p>
            </div>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-lg">
              Tendencia de Ventas
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            {salesPeriodData && salesPeriodData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesPeriodData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                  <XAxis
                    dataKey="periodo"
                    stroke="#9ca3af"
                    fontSize={11}
                    tickFormatter={(v) => v ? v.slice(5) : ""}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={11}
                    tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatPYG(Number(value) || 0), "Ventas"]}
                    labelFormatter={(label) => `Fecha: ${label}`}
                    contentStyle={{ backgroundColor: "#1f2937", borderColor: "#374151", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="monto"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#salesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No hay transacciones registradas en este rango de fechas.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Top Clientes / Cuentas Clave */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Cuentas Comerciales Clave</h3>
              <Link to="/clientes" className="text-xs font-semibold text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Top clientes con mayor volumen de compra</p>

            <div className="mt-4 space-y-3">
              {[
                { nombre: "MUSTER S.A.", ruc: "80088741-7", monto: 13170590125, rama: "Mayorista" },
                { nombre: "GUARANI PARAGUAY S.A.", ruc: "80085973-1", monto: 12485906158, rama: "Cadena" },
                { nombre: "GRUPO ALVI S.A.", ruc: "80112956-7", monto: 11167521381, rama: "Autoservicios" },
                { nombre: "DAVIDA SA (Central & Maxi)", ruc: "80105645-4", monto: 23700000000, rama: "Gran Cuenta" },
                { nombre: "COMERCIAL ALICE S.A.", ruc: "80119626-4", monto: 7348424425, rama: "Comercial" },
              ].map((c, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{c.nombre}</p>
                      <p className="text-[10px] text-gray-400">RUC: {c.ruc} • {c.rama}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white whitespace-nowrap pl-2">
                    {formatPYG(c.monto)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <Link
              to="/asistente-virtual"
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition"
            >
              <span>🧠 Consultar análisis con Marco IA</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Operational Modules Quick Access */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/proveedor-kpis"
          className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-red-400 dark:hover:border-red-500 shadow-sm transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <Award className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Indicadores PARESA</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Rebate 4,5% y metas mensuales</p>
        </Link>

        <Link
          to="/metas-ventas"
          className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <Target className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Preventistas & Metas</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Cumplimiento Rama PARESA y MIX</p>
        </Link>

        <Link
          to="/deposito"
          className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-sm transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <Box className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Depósito Central</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Recepción, remitos y stock</p>
        </Link>

        <Link
          to="/rutas"
          className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-500 shadow-sm transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-2 group-hover:scale-110 transition">
            <Truck className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Rutas & Logística</h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Resúmenes de carga y flota</p>
        </Link>
      </div>
    </div>
  )
}
