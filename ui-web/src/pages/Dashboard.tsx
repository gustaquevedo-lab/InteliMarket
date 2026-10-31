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
import { api, type PurchaseOrder, type SupplierInvoice } from "../api"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { formatPYG, formatDate, formatCurrency } from "../utils/format"

type TimeRange = "hoy" | "7d" | "mes" | "30d" | "historico" | "custom"

function formatLocalDate(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function computeDateRange(range: TimeRange, customD?: string, customH?: string) {
  const now = new Date()
  const todayStr = formatLocalDate(now)
  
  if (range === "hoy") {
    return { fecha_desde: todayStr, fecha_hasta: todayStr, label: "Hoy", dias: 1, agrupar: "hora" }
  }
  if (range === "7d") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    return { fecha_desde: formatLocalDate(d), fecha_hasta: todayStr, label: "Últimos 7 Días", dias: 7, agrupar: "dia" }
  }
  if (range === "mes") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return { fecha_desde: formatLocalDate(d), fecha_hasta: todayStr, label: "Este Mes (MTD)", dias: Math.max(1, now.getDate()), agrupar: "dia" }
  }
  if (range === "30d") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
    return { fecha_desde: formatLocalDate(d), fecha_hasta: todayStr, label: "Últimos 30 Días", dias: 30, agrupar: "dia" }
  }
  if (range === "custom") {
    const desde = customD || todayStr
    const hasta = customH || todayStr
    const d1 = new Date(desde + "T00:00:00")
    const d2 = new Date(hasta + "T00:00:00")
    const diffDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    return {
      fecha_desde: desde,
      fecha_hasta: hasta,
      label: `${desde} al ${hasta}`,
      dias: diffDays,
      agrupar: diffDays <= 2 ? "hora" : diffDays <= 45 ? "dia" : "mes"
    }
  }
  return { fecha_desde: undefined, fecha_hasta: undefined, label: "Histórico Total", dias: 365, agrupar: "mes" }
}

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [timeRange, setTimeRange] = useState<TimeRange>("mes")
  const [customDesde, setCustomDesde] = useState<string>(() => formatLocalDate())
  const [customHasta, setCustomHasta] = useState<string>(() => formatLocalDate())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pacingMode, setPacingMode] = useState<"diario" | "acumulado">("diario")

  const [salesSummary, setSalesSummary] = useState<any>(null)
  const [salesByCat, setSalesByCat] = useState<any[]>([])
  const [salesByProd, setSalesByProd] = useState<any[]>([])
  const [salesPeriodData, setSalesPeriodData] = useState<any[]>([])
  const [replenishmentData, setReplenishmentData] = useState<any>(null)
  const [financialDash, setFinancialDash] = useState<any>(null)
  const [recentOrders, setRecentOrders] = useState<PurchaseOrder[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [agingData, setAgingData] = useState<any>(null)
  const [stockVal, setStockVal] = useState<any>(null)
  const [periodLoading, setPeriodLoading] = useState(false)

  // Cache en memoria para transiciones instantáneas
  const cacheRef = useMemo(() => new Map<string, { summary: any; byCat: any[]; byProd: any[]; period: any[] }>(), [])

  // 1. Carga robusta y garantizada de Ventas según período
  const loadSalesData = useCallback(async (currentRange: TimeRange, showSpinner = false, customD?: string, customH?: string) => {
    const dDesde = customD || customDesde
    const dHasta = customH || customHasta
    const cacheKey = currentRange === "custom" ? `custom:${dDesde}_${dHasta}` : currentRange
    const cached = cacheRef.get(cacheKey)
    if (cached) {
      setSalesSummary(cached.summary)
      setSalesByCat(cached.byCat)
      setSalesByProd(cached.byProd)
      setSalesPeriodData(cached.period)
    }

    if (showSpinner || !cached) setPeriodLoading(true)
    const { fecha_desde, fecha_hasta, agrupar } = computeDateRange(currentRange, dDesde, dHasta)

    try {
      const [summaryRes, byCatRes, byProdRes, periodRes] = await Promise.allSettled([
        api.reports.salesSummary(fecha_desde ? { fecha_desde, fecha_hasta } : {}),
        api.reports.salesByCategory(fecha_desde ? { fecha_desde, fecha_hasta } : {}),
        api.reports.salesByProduct(fecha_desde ? { fecha_desde, fecha_hasta, limit: 6 } : { limit: 6 }),
        api.reports.salesByPeriod(fecha_desde ? { fecha_desde, fecha_hasta, agrupar_por: agrupar } : { agrupar_por: agrupar }),
      ])

      const newSummary = summaryRes.status === "fulfilled" && summaryRes.value ? summaryRes.value : {
        total_ventas: 0,
        monto_total: 0,
        monto_iva_10: 0,
        monto_iva_5: 0,
        monto_exento: 0,
        ticket_promedio: 0,
        total_items: 0,
        total_pagado: 0,
        saldo_pendiente: 0,
      }
      const newByCat = byCatRes.status === "fulfilled" && Array.isArray(byCatRes.value) ? byCatRes.value : []
      const newByProd = byProdRes.status === "fulfilled" && Array.isArray(byProdRes.value) ? byProdRes.value : []
      const newPeriod = periodRes.status === "fulfilled" && Array.isArray(periodRes.value) ? periodRes.value : []

      setSalesSummary(newSummary)
      setSalesByCat(newByCat)
      setSalesByProd(newByProd)
      setSalesPeriodData(newPeriod)

      cacheRef.set(cacheKey, { summary: newSummary, byCat: newByCat, byProd: newByProd, period: newPeriod })
    } catch (e: any) {
      console.error("[Dashboard] Error al cargar ventas:", e)
    } finally {
      setPeriodLoading(false)
      setLoading(false)
      setRefreshing(false)
    }
  }, [cacheRef, customDesde, customHasta])

  // 2. Carga de estado operativo general (Compras, Stock, Finanzas, AR)
  const loadStaticData = useCallback(async () => {
    try {
      const [replenishRes, finRes, ordersRes, lowStockRes, agingRes] = await Promise.allSettled([
        api.purchases.smartReplenishmentPreview({ dias_cobertura: 30, limit: 100 }).catch(() => null),
        api.financial.dashboard().catch(() => null),
        api.purchases.listPOs().catch(() => []),
        api.stock.lowStock().catch(() => []),
        api.accountsReceivable.aging().catch(() => null),
      ])
      api.reports.inventoryValuation().then(setStockVal).catch(() => setStockVal(null))

      if (replenishRes.status === "fulfilled" && replenishRes.value) setReplenishmentData(replenishRes.value)
      if (finRes.status === "fulfilled" && finRes.value) setFinancialDash(finRes.value)
      if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value)) setRecentOrders(ordersRes.value)
      if (lowStockRes.status === "fulfilled" && Array.isArray(lowStockRes.value)) setLowStockItems(lowStockRes.value)
      if (agingRes.status === "fulfilled" && agingRes.value) setAgingData(agingRes.value)
    } catch {}
  }, [])

  useEffect(() => {
    loadSalesData(timeRange)
    loadStaticData()
  }, [])

  const handlePeriodChange = (newRange: TimeRange, cDesde?: string, cHasta?: string) => {
    setTimeRange(newRange)
    loadSalesData(newRange, true, cDesde ?? customDesde, cHasta ?? customHasta)
  }

  const handleManualRefresh = () => {
    setRefreshing(true)
    cacheRef.clear()
    loadSalesData(timeRange, true, customDesde, customHasta)
    loadStaticData()
  }

  // ---------------------------------------------------------------------------
  // KPIS PRINCIPALES & FÓRMULAS DE NEGOCIO REALES
  // ---------------------------------------------------------------------------
  const totalVentasMonto = useMemo(() => {
    if (salesSummary?.monto_total != null) return Number(salesSummary.monto_total)
    if (salesSummary?.total_monto != null) return Number(salesSummary.total_monto)
    return 0
  }, [salesSummary])

  const totalTickets = useMemo(() => {
    if (salesSummary?.total_ventas != null) return Number(salesSummary.total_ventas)
    return 0
  }, [salesSummary])

  const ticketPromedio = useMemo(() => {
    if (salesSummary?.ticket_promedio != null && Number(salesSummary.ticket_promedio) > 0) {
      return Math.round(Number(salesSummary.ticket_promedio))
    }
    if (totalTickets > 0) return Math.round(totalVentasMonto / totalTickets)
    return 0
  }, [salesSummary, totalVentasMonto, totalTickets])

  const margenBrutoGs = useMemo(() => {
    // utilidad bruta = venta SIN IVA - costo (la calcula el backend; aca no se supone nada)
    return Number(salesSummary?.margen_bruto_gs ?? 0)
  }, [salesSummary])

  const margenBrutoPct = useMemo(() => {
    return Number(salesSummary?.margen_bruto_pct ?? 0)
  }, [salesSummary])

  const costoTotalMercaderias = useMemo(() => {
    return Number(salesSummary?.costo_total ?? 0)
  }, [salesSummary])
  const ventasSinIva = Number(salesSummary?.monto_sin_iva ?? 0)

  // Seguimiento de Volumen PARESA / Bebidas
  const paresaVolumeData = useMemo(() => {
    const totalUC = Number(salesSummary?.paresa_uc ?? 0)
    const targetUC: number | null = salesSummary?.paresa_meta_uc ?? null
    const pctAlcanzado = targetUC ? Number(((totalUC / targetUC) * 100).toFixed(1)) : null
    return { totalUC, targetUC, pctAlcanzado }
  }, [salesSummary])

  // DOH & Stock en Depósito
  const stockMetrics = useMemo(() => {
    const totalSKUs: number | null = stockVal?.total_products ?? null
    const valorizacionTotalGs: number | null = stockVal?.total_value ?? null
    const quiebresCriticos = replenishmentData?.total_quiebres ?? lowStockItems.length
    return { totalSKUs, valorizacionTotalGs, quiebresCriticos }
  }, [replenishmentData, lowStockItems, stockVal])

  // ---------------------------------------------------------------------------
  // DATOS PARA GRÁFICOS RECHARTS
  // ---------------------------------------------------------------------------
  const salesTrendData = useMemo(() => {
    let acumuladoVenta = 0
    return (salesPeriodData || []).map((d: any, idx: number) => {
      const monto = Number(d.monto || d.venta_real || d.total || 0)
      acumuladoVenta += monto
      return {
        label: d.periodo ? String(d.periodo).slice(-5) : `Día ${idx + 1}`,
        fecha: d.periodo || d.fecha || "",
        actual: pacingMode === "diario" ? monto : acumuladoVenta,
        tickets: Number(d.cantidad || d.tickets || 0),
      }
    })
  }, [salesPeriodData, pacingMode])

  const categoryMixData = useMemo(() => {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"]
    const totalMonto = (salesByCat || []).reduce((acc: number, c: any) => acc + Number(c.monto || c.total || 0), 0)
    return (salesByCat || []).slice(0, 5).map((c: any, i: number) => {
      const val = Number(c.monto || c.total || 0)
      return {
        name: c.categoria || c.name || `Familia ${i + 1}`,
        value: val,
        percentage: totalMonto ? ((val / totalMonto) * 100).toFixed(1) : "0.0",
        color: colors[i % colors.length],
      }
    })
  }, [salesByCat])

  const topMovers = useMemo(() => (salesByProd || []).slice(0, 5), [salesByProd])

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
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> SIFEN & POS en Vivo
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              Casa Gonzalito — Distribución Mayorista
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Buenos días, {user?.nombre || "Admin Casa Gonzalito"}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-3xl">
            Panel de Control 360° en tiempo real con Inteligencia Artificial, Margen Bruto Comercial y seguimiento PARESA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-600 text-xs font-bold">
            {(["hoy", "7d", "mes", "30d", "historico", "custom"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => handlePeriodChange(r)}
                className={`px-3 py-1.5 rounded-lg transition-all capitalize font-mono flex items-center gap-1 ${
                  timeRange === r
                    ? "bg-indigo-600 text-white shadow-sm font-black"
                    : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-600"
                }`}
              >
                {r === "custom" && <Calendar className="w-3.5 h-3.5" />}
                {r === "7d" ? "7 Días" : r === "mes" ? "Este Mes" : r === "30d" ? "30 Días" : r === "historico" ? "Histórico" : r === "custom" ? "Rango" : "Hoy"}
              </button>
            ))}
          </div>

          {timeRange === "custom" && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl border border-slate-200 dark:border-slate-600 text-xs animate-fade-in">
              <input
                type="date"
                value={customDesde}
                onChange={(e) => setCustomDesde(e.target.value)}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              <span className="text-slate-400 font-bold">→</span>
              <input
                type="date"
                value={customHasta}
                onChange={(e) => setCustomHasta(e.target.value)}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={() => handlePeriodChange("custom", customDesde, customHasta)}
                className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Filtrar
              </button>
            </div>
          )}

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
                  InteliMarket AI Copilot — Diagnóstico ({timeRange === "mes" ? "Este Mes (MTD)" : computeDateRange(timeRange).label})
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {totalTickets.toLocaleString()} OPERACIONES REGISTRADAS
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Ventas en <strong>{formatPYG(totalVentasMonto)}</strong> con Margen Bruto Real de <strong>{margenBrutoPct.toFixed(1)}% ({formatPYG(margenBrutoGs)})</strong>. Volumen PARESA: <strong>{paresaVolumeData.totalUC.toLocaleString()} UC</strong> netas de devoluciones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/contratos-proveedores")} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-400/40 text-indigo-200 transition-colors flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Oportunidades
            </button>
            <button onClick={() => navigate("/purchases")} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Riesgos Quiebre ({stockMetrics.quiebresCriticos})
            </button>
          </div>
        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4 MAIN HERO CARDS — SUPERMERCADO RETAIL
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* HERO 1: VENTAS TOTALES */}
        <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Ventas ({timeRange === "mes" ? "Este Mes (MTD)" : computeDateRange(timeRange).label})
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {totalTickets.toLocaleString()} ventas
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-gray-900 dark:text-white tracking-tight">
            {formatPYG(totalVentasMonto)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 font-mono">
            <span>Ticket Prom: <strong className="text-gray-900 dark:text-gray-100">{formatPYG(ticketPromedio)}</strong></span>
            <span>Sin IVA: <strong className="text-gray-900 dark:text-gray-100">{formatPYG(ventasSinIva)}</strong></span>
          </div>
        </div>

        {/* HERO 2: MARGEN BRUTO COMERCIAL */}
        <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Margen Bruto ({timeRange === "mes" ? "Este Mes (MTD)" : computeDateRange(timeRange).label})
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {margenBrutoPct.toFixed(1)}% Bruto
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-teal-600 dark:text-teal-400 tracking-tight">
            {formatPYG(margenBrutoGs)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 font-mono">
            <span>Venta sin IVA: <strong className="text-gray-900 dark:text-gray-100">{formatPYG(ventasSinIva)}</strong></span>
            <span>Costo: <strong className="text-gray-700 dark:text-gray-300">{formatPYG(costoTotalMercaderias)}</strong></span>
          </div>
        </div>

        {/* HERO 3: VOLUMEN PARESA & REBATES */}
        <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              PARESA ({timeRange === "mes" ? "Este Mes (MTD)" : computeDateRange(timeRange).label})
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {paresaVolumeData.pctAlcanzado != null ? `${paresaVolumeData.pctAlcanzado}% Meta` : "Sin meta"}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400 tracking-tight">
            {paresaVolumeData.totalUC.toLocaleString()} <span className="text-sm font-bold text-gray-500 dark:text-gray-400">UC</span>
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 font-mono">
            <span>Meta: <strong className="text-gray-900 dark:text-gray-100">{paresaVolumeData.targetUC != null ? `${paresaVolumeData.targetUC.toLocaleString()} UC` : "sin cargar"}</strong></span>
            <button onClick={() => navigate("/supplier-kpis")} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Ver KPIs & Rebate →</button>
          </div>
        </div>

        {/* HERO 4: STOCK EN DEPÓSITO & WMS */}
        <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Stock en Depósito
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              a costo
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono text-purple-600 dark:text-purple-400 tracking-tight">
            {stockMetrics.valorizacionTotalGs != null ? formatPYG(stockMetrics.valorizacionTotalGs) : "—"}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 font-mono">
            <span>SKUs Activos: <strong className="text-gray-900 dark:text-gray-100">{stockMetrics.totalSKUs != null ? stockMetrics.totalSKUs.toLocaleString() : "—"}</strong></span>
            <span className="text-amber-600 font-bold">Quiebres: {stockMetrics.quiebresCriticos} SKUs</span>
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
                Ritmo y Evolución de Ventas ({timeRange === "mes" ? "Este Mes (MTD)" : computeDateRange(timeRange).label})
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Ventas reales por día vs períodos anteriores y meta de facturación.
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
            </div>

            <div className="h-48 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryMixData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                    {categoryMixData.map((entry, index) => (
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
              {categoryMixData.map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[140px]">{cat.name}</span>
                  </div>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {cat.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          TOP 5 SKUS DE ALTA ROTACIÓN & EFICIENCIA COMERCIAL
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="card p-6 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              Top 5 SKUs de Mayor Rotación ({timeRange === "mes" ? "Este Mes (MTD)" : computeDateRange(timeRange).label})
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Productos líderes en volumen, facturación total y rentabilidad sobre ventas.
            </p>
          </div>
          <button onClick={() => navigate("/sales")} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
            Ver todas las ventas <ChevronRight className="w-4 h-4" />
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
                <th className="p-3 text-center">Estado</th>
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
                      <div className="text-xs font-bold truncate max-w-xs">{p.producto || p.nombre}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{p.sku || "SKU-N/A"}</div>
                    </div>
                  </td>
                  <td className="p-3 text-right font-bold text-gray-700 dark:text-gray-200">
                    {Number(p.cantidad || 0).toLocaleString()} un.
                  </td>
                  <td className="p-3 text-right font-black text-gray-900 dark:text-white">
                    {formatPYG(p.monto || 0)}
                  </td>
                  <td className="p-3 text-right font-bold text-teal-600 dark:text-teal-400">
                    {p.margen != null ? `${Number(p.margen).toFixed(1)}%` : "—"}
                  </td>
                  <td className="p-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Óptimo
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
