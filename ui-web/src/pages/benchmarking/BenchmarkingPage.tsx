import { useState, useEffect } from "react"
import { BarChart3, TrendingUp, Shield, MapPin, Settings, Trophy, Store, ChevronUp, ChevronDown, Minus, Building2, Target, Users, DollarSign, ShoppingCart, Percent, Activity, Loader2 } from "lucide-react"
import { useToast } from "../../hooks/useToast"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"

type Tab = "dashboard" | "rankings" | "scores" | "comparison" | "config"

const KPI_LABELS: Record<string, string> = {
  sales_per_sqm: "Ventas/m²",
  gross_margin_pct: "Margen Bruto %",
  shrinkage_pct: "Shrinkage %",
  inventory_turnover: "Rotación Inventario",
  avg_ticket: "Ticket Promedio",
  transactions_per_day: "Transacciones/día",
  labor_productivity: "Productividad Laboral",
}

const KPI_UNITS: Record<string, string> = {
  sales_per_sqm: "Gs",
  gross_margin_pct: "%",
  shrinkage_pct: "%",
  inventory_turnover: "x",
  avg_ticket: "Gs",
  transactions_per_day: "trans/día",
  labor_productivity: "Gs/hora",
}

const BRANCHES = [
  { id: "b001", name: "Suc. Central" },
  { id: "b002", name: "Suc. Shopping" },
  { id: "b003", name: "Suc. Centro" },
  { id: "b004", name: "Suc. Norte" },
  { id: "b005", name: "Suc. Sur" },
]

const MOCK_DASHBOARD = {
  total_stores: 5,
  periods_analyzed: 12,
  avg_overall_score: 71.3,
  green_stores: 2,
  yellow_stores: 2,
  red_stores: 1,
  top_store: { branch_id: "b001", branch_name: "Suc. Central", score: 88.5 },
  bottom_store: { branch_id: "b005", branch_name: "Suc. Sur", score: 45.2 },
  best_kpi: { branch: "Suc. Central", kpi: "Margen Bruto %", value: 34.5 },
  worst_kpi: { branch: "Suc. Sur", kpi: "Shrinkage %", value: 4.8 },
  rankings: [] as any[],
  trend_data: [
    { period_start: "2026-04-14", avg_score: 65.2 },
    { period_start: "2026-04-21", avg_score: 67.8 },
    { period_start: "2026-04-28", avg_score: 69.1 },
    { period_start: "2026-05-05", avg_score: 68.4 },
    { period_start: "2026-05-12", avg_score: 72.0 },
    { period_start: "2026-05-19", avg_score: 70.5 },
    { period_start: "2026-05-26", avg_score: 73.8 },
    { period_start: "2026-06-02", avg_score: 71.3 },
  ],
}

const MOCK_RANKINGS: any[] = [
  { branch_id: "b001", branch_name: "Suc. Central", kpi_key: "gross_margin_pct", kpi_label: "Margen Bruto %", value: 34.5, rank: 1, total: 5, percentile: 20, direction: "higher", unit: "%", trend: "up" },
  { branch_id: "b002", branch_name: "Suc. Shopping", kpi_key: "gross_margin_pct", kpi_label: "Margen Bruto %", value: 31.2, rank: 2, total: 5, percentile: 40, direction: "higher", unit: "%", trend: "stable" },
  { branch_id: "b003", branch_name: "Suc. Centro", kpi_key: "gross_margin_pct", kpi_label: "Margen Bruto %", value: 29.8, rank: 3, total: 5, percentile: 60, direction: "higher", unit: "%", trend: "down" },
  { branch_id: "b004", branch_name: "Suc. Norte", kpi_key: "gross_margin_pct", kpi_label: "Margen Bruto %", value: 27.5, rank: 4, total: 5, percentile: 80, direction: "higher", unit: "%", trend: "up" },
  { branch_id: "b005", branch_name: "Suc. Sur", kpi_key: "gross_margin_pct", kpi_label: "Margen Bruto %", value: 24.1, rank: 5, total: 5, percentile: 100, direction: "higher", unit: "%", trend: "down" },
  { branch_id: "b003", branch_name: "Suc. Centro", kpi_key: "sales_per_sqm", kpi_label: "Ventas/m²", value: 1850000, rank: 1, total: 5, percentile: 20, direction: "higher", unit: "Gs", trend: "up" },
  { branch_id: "b001", branch_name: "Suc. Central", kpi_key: "sales_per_sqm", kpi_label: "Ventas/m²", value: 1720000, rank: 2, total: 5, percentile: 40, direction: "higher", unit: "Gs", trend: "stable" },
  { branch_id: "b002", branch_name: "Suc. Shopping", kpi_key: "sales_per_sqm", kpi_label: "Ventas/m²", value: 1650000, rank: 3, total: 5, percentile: 60, direction: "higher", unit: "Gs", trend: "down" },
  { branch_id: "b004", branch_name: "Suc. Norte", kpi_key: "sales_per_sqm", kpi_label: "Ventas/m²", value: 1450000, rank: 4, total: 5, percentile: 80, direction: "higher", unit: "Gs", trend: "up" },
  { branch_id: "b005", branch_name: "Suc. Sur", kpi_key: "sales_per_sqm", kpi_label: "Ventas/m²", value: 1280000, rank: 5, total: 5, percentile: 100, direction: "higher", unit: "Gs", trend: "stable" },
  { branch_id: "b001", branch_name: "Suc. Central", kpi_key: "shrinkage_pct", kpi_label: "Shrinkage %", value: 1.8, rank: 1, total: 5, percentile: 20, direction: "lower", unit: "%", trend: "down" },
  { branch_id: "b002", branch_name: "Suc. Shopping", kpi_key: "shrinkage_pct", kpi_label: "Shrinkage %", value: 2.1, rank: 2, total: 5, percentile: 40, direction: "lower", unit: "%", trend: "stable" },
  { branch_id: "b004", branch_name: "Suc. Norte", kpi_key: "shrinkage_pct", kpi_label: "Shrinkage %", value: 2.5, rank: 3, total: 5, percentile: 60, direction: "lower", unit: "%", trend: "up" },
  { branch_id: "b003", branch_name: "Suc. Centro", kpi_key: "shrinkage_pct", kpi_label: "Shrinkage %", value: 2.8, rank: 4, total: 5, percentile: 80, direction: "lower", unit: "%", trend: "stable" },
  { branch_id: "b005", branch_name: "Suc. Sur", kpi_key: "shrinkage_pct", kpi_label: "Shrinkage %", value: 4.8, rank: 5, total: 5, percentile: 100, direction: "lower", unit: "%", trend: "up" },
]

const MOCK_SCORES: any[] = [
  { branch_id: "b001", branch_name: "Suc. Central", overall_score: 88.5, traffic_light: "green", rank: 1, total_stores: 5, percentile: 20, kpi_scores: { sales_per_sqm: 85, gross_margin_pct: 92, shrinkage_pct: 90, inventory_turnover: 78, avg_ticket: 82, transactions_per_day: 88, labor_productivity: 95 } },
  { branch_id: "b002", branch_name: "Suc. Shopping", overall_score: 76.2, traffic_light: "green", rank: 2, total_stores: 5, percentile: 40, kpi_scores: { sales_per_sqm: 72, gross_margin_pct: 80, shrinkage_pct: 85, inventory_turnover: 70, avg_ticket: 75, transactions_per_day: 78, labor_productivity: 82 } },
  { branch_id: "b003", branch_name: "Suc. Centro", overall_score: 68.4, traffic_light: "yellow", rank: 3, total_stores: 5, percentile: 60, kpi_scores: { sales_per_sqm: 78, gross_margin_pct: 65, shrinkage_pct: 72, inventory_turnover: 62, avg_ticket: 70, transactions_per_day: 68, labor_productivity: 65 } },
  { branch_id: "b004", branch_name: "Suc. Norte", overall_score: 61.8, traffic_light: "yellow", rank: 4, total_stores: 5, percentile: 80, kpi_scores: { sales_per_sqm: 58, gross_margin_pct: 72, shrinkage_pct: 78, inventory_turnover: 55, avg_ticket: 60, transactions_per_day: 65, labor_productivity: 58 } },
  { branch_id: "b005", branch_name: "Suc. Sur", overall_score: 45.2, traffic_light: "red", rank: 5, total_stores: 5, percentile: 100, kpi_scores: { sales_per_sqm: 42, gross_margin_pct: 48, shrinkage_pct: 35, inventory_turnover: 40, avg_ticket: 50, transactions_per_day: 45, labor_productivity: 52 } },
]

const MOCK_COMPARISON: any[] = [
  { region_id: "r1", region_name: "Zona Centro", store_count: 2, avg_score: 82.4, avg_sales_per_sqm: 1785000, avg_margin: 32.9, avg_shrinkage: 1.95, avg_ticket: 48500, best_store: "Suc. Central", worst_store: "Suc. Shopping" },
  { region_id: "r2", region_name: "Zona Periferia", store_count: 2, avg_score: 55.0, avg_sales_per_sqm: 1365000, avg_margin: 25.8, avg_shrinkage: 3.65, avg_ticket: 38000, best_store: "Suc. Norte", worst_store: "Suc. Sur" },
  { region_id: "unassigned", region_name: "Sin Región", store_count: 1, avg_score: 68.4, avg_sales_per_sqm: 1650000, avg_margin: 29.8, avg_shrinkage: 2.8, avg_ticket: 42000, best_store: null, worst_store: null },
]

const MOCK_CONFIGS: any[] = [
  { kpi_key: "sales_per_sqm", kpi_label: "Ventas/m²", weight: 1.0, target_value: 1500000, target_direction: "higher", green_threshold: 80, red_threshold: 40, unit: "Gs/m²", is_active: true },
  { kpi_key: "gross_margin_pct", kpi_label: "Margen Bruto %", weight: 1.5, target_value: 30, target_direction: "higher", green_threshold: 80, red_threshold: 40, unit: "%", is_active: true },
  { kpi_key: "shrinkage_pct", kpi_label: "Shrinkage %", weight: 1.5, target_value: 2.5, target_direction: "lower", green_threshold: 80, red_threshold: 40, unit: "%", is_active: true },
  { kpi_key: "inventory_turnover", kpi_label: "Rotación Inventario", weight: 0.8, target_value: 8, target_direction: "higher", green_threshold: 60, red_threshold: 30, unit: "x", is_active: true },
  { kpi_key: "avg_ticket", kpi_label: "Ticket Promedio", weight: 0.8, target_value: 40000, target_direction: "higher", green_threshold: 70, red_threshold: 35, unit: "Gs", is_active: true },
  { kpi_key: "transactions_per_day", kpi_label: "Transacciones/día", weight: 0.7, target_value: 500, target_direction: "higher", green_threshold: 70, red_threshold: 35, unit: "trans/día", is_active: true },
  { kpi_key: "labor_productivity", kpi_label: "Productividad Laboral", weight: 0.7, target_value: 150000, target_direction: "higher", green_threshold: 70, red_threshold: 35, unit: "Gs/hora", is_active: true },
]

function TrendIcon({ trend }: { trend?: string }) {
  if (trend === "up") return <ChevronUp className="w-4 h-4 text-green-500" />
  if (trend === "down") return <ChevronDown className="w-4 h-4 text-red-500" />
  return <Minus className="w-4 h-4 text-gray-400" />
}

function TrafficLightBadge({ color }: { color: string }) {
  const colors: Record<string, string> = {
    green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  }
  const labels: Record<string, string> = { green: "✅ Bueno", yellow: "⚠️ Regular", red: "🔴 Crítico" }
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${colors[color] || colors.yellow}`}>{labels[color] || labels.yellow}</span>
}

export default function BenchmarkingPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [filterKpi, setFilterKpi] = useState<string>("gross_margin_pct")
  const toast = useToast()

  const [dashboard, setDashboard] = useState<any>(MOCK_DASHBOARD)
  const [rankings, setRankings] = useState<any[]>(MOCK_RANKINGS)
  const [scores, setScores] = useState<any[]>(MOCK_SCORES)
  const [comparison, setComparison] = useState<any[]>(MOCK_COMPARISON)
  const [configs, setConfigs] = useState<any[]>(MOCK_CONFIGS)
  const [historyModal, setHistoryModal] = useState<any>(null)

  const fetchAll = async () => {
    setLoading(true)
    const companyId = "00000000-0000-0000-0000-000000000010"
    try {
      const promises: Promise<any>[] = []
      if (tab === "dashboard") promises.push(api.benchmarking.getDashboard(companyId).then(setDashboard).catch(() => {}))
      if (tab === "rankings") promises.push(api.benchmarking.getRankings(companyId).then(d => setRankings(d?.rankings || [])).catch(() => {}))
      if (tab === "scores") promises.push(api.benchmarking.getScores(companyId).then(d => setScores(d?.scores || [])).catch(() => {}))
      if (tab === "comparison") promises.push(api.benchmarking.getComparison(companyId).then(setComparison).catch(() => {}))
      if (tab === "config") promises.push(api.benchmarking.listConfigs(companyId).then(setConfigs).catch(() => {}))
      await Promise.all(promises.map(p => p.catch(e => console.warn("Benchmarking fetch warning:", e))))
    } catch (e) { console.warn("Benchmarking fetch error:", e) } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [tab])

  const tabs: { k: Tab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "rankings", l: "Rankings", i: Trophy },
    { k: "scores", l: "Puntajes", i: Activity },
    { k: "comparison", l: "Comparativa", i: MapPin },
    { k: "config", l: "Configuración", i: Settings },
  ]

  const filteredRankings = rankings.filter(r => r.kpi_key === filterKpi)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-600 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 bg-indigo-300 opacity-20 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold tracking-wider uppercase mb-4 backdrop-blur-sm border border-white/10">
              <BarChart3 className="w-4 h-4" />
              Fase 6 — Analítica
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
              Store Benchmarking
            </h1>
            <p className="text-indigo-50 text-lg mt-3 font-medium max-w-xl opacity-90">
              KPIs gerenciales, rankings por tienda, score compuesto y comparativa regional
            </p>
          </div>
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold uppercase tracking-wider opacity-80">Score Promedio</p>
              <p className="text-white text-2xl font-bold">{dashboard?.avg_overall_score ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto scrollbar-hide shadow-inner">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
              tab === t.k
                ? "bg-white dark:bg-slate-700 text-primary dark:text-blue-400 shadow-md ring-1 ring-black/5 dark:ring-white/10 scale-100"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-slate-700/50 hover:scale-[1.02]"
            }`}>
            {tab === t.k && <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50" />}
            <t.i className={`w-3.5 h-3.5 relative z-10 transition-transform ${tab === t.k ? "scale-110" : ""}`} />
            <span className="relative z-10">{t.l}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {tab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3"><Store className="w-5 h-5 text-violet-500" /><span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tiendas</span></div>
                  <p className="text-2xl font-bold">{dashboard?.total_stores ?? 0}</p>
                  <p className="text-xs text-gray-400 mt-1">{dashboard?.periods_analyzed ?? 0} períodos analizados</p>
                </div>
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3"><Activity className="w-5 h-5 text-emerald-500" /><span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Score Promedio</span></div>
                  <p className="text-2xl font-bold">{dashboard?.avg_overall_score ?? 0}</p>
                  <div className="flex gap-2 mt-2 text-xs">
                    <span className="text-green-600 dark:text-green-400">{dashboard?.green_stores ?? 0} ✅</span>
                    <span className="text-yellow-600 dark:text-yellow-400">{dashboard?.yellow_stores ?? 0} ⚠️</span>
                    <span className="text-red-600 dark:text-red-400">{dashboard?.red_stores ?? 0} 🔴</span>
                  </div>
                </div>
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3"><Trophy className="w-5 h-5 text-amber-500" /><span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Mejor Tienda</span></div>
                  <p className="text-lg font-bold truncate">{dashboard?.top_store?.branch_name ?? "-"}</p>
                  <p className="text-xs text-gray-400 mt-1">Score: {dashboard?.top_store?.score ?? 0}</p>
                </div>
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3"><Target className="w-5 h-5 text-rose-500" /><span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Mejor KPI</span></div>
                  <p className="text-lg font-bold truncate">{dashboard?.best_kpi?.kpi ?? "-"}</p>
                  <p className="text-xs text-gray-400 mt-1">{dashboard?.best_kpi?.branch ?? ""}: {dashboard?.best_kpi?.value ?? 0}</p>
                </div>
              </div>

              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Score Promedio — Tendencia</h3>
                <div className="space-y-2">
                  {(dashboard?.trend_data ?? []).map((d: any, i: number) => {
                    const min = Math.min(...(dashboard?.trend_data ?? []).map((t: any) => t.avg_score))
                    const max = Math.max(...(dashboard?.trend_data ?? []).map((t: any) => t.avg_score))
                    const range = max - min || 1
                    const pct = ((d.avg_score - min) / range) * 100
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-24 shrink-0">{d.period_start}</span>
                        <div className="flex-1 h-6 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{d.avg_score}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" />Mejores Performance</h3>
                  {dashboard?.top_store && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200/50 dark:border-green-700/30 mb-3">
                      <p className="font-bold text-green-700 dark:text-green-400">{dashboard.top_store.branch_name}</p>
                      <p className="text-sm text-green-600 dark:text-green-500">Score general: {dashboard.top_store.score} — 🥇 Primer lugar</p>
                    </div>
                  )}
                  {dashboard?.best_kpi && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-700/30">
                      <p className="font-bold text-blue-700 dark:text-blue-400">{dashboard.best_kpi.kpi}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-500">{dashboard.best_kpi.branch}: {dashboard.best_kpi.value}</p>
                    </div>
                  )}
                </div>
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-rose-500" />Áreas de Mejora</h3>
                  {dashboard?.bottom_store && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200/50 dark:border-red-700/30 mb-3">
                      <p className="font-bold text-red-700 dark:text-red-400">{dashboard.bottom_store.branch_name}</p>
                      <p className="text-sm text-red-600 dark:text-red-500">Score general: {dashboard.bottom_store.score} — Requiere atención</p>
                    </div>
                  )}
                  {dashboard?.worst_kpi && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200/50 dark:border-orange-700/30">
                      <p className="font-bold text-orange-700 dark:text-orange-400">{dashboard.worst_kpi.kpi}</p>
                      <p className="text-sm text-orange-600 dark:text-orange-500">{dashboard.worst_kpi.branch}: {dashboard.worst_kpi.value}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "rankings" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Object.entries(KPI_LABELS).map(([key, label]) => (
                  <button key={key} onClick={() => setFilterKpi(key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      filterKpi === key
                        ? "bg-primary text-white shadow-md"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-2 font-semibold text-gray-500">#</th>
                      <th className="text-left py-3 px-2 font-semibold text-gray-500">Tienda</th>
                      <th className="text-right py-3 px-2 font-semibold text-gray-500">Valor</th>
                      <th className="text-right py-3 px-2 font-semibold text-gray-500">Percentil</th>
                      <th className="text-center py-3 px-2 font-semibold text-gray-500">Tendencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRankings.map((r, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            r.rank === 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            r.rank === 2 ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300" :
                            r.rank === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                            "bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400"
                          }`}>{r.rank}</span>
                        </td>
                        <td className="py-3 px-2 font-medium">{r.branch_name}</td>
                        <td className="py-3 px-2 text-right font-bold">{r.direction === "lower" ? "↓" : "↑"} {r.unit === "Gs" || r.unit === "Gs/m²" || r.unit === "Gs/hora" ? formatPYG(r.value) : r.value}{r.unit && r.unit !== "Gs" && r.unit !== "Gs/m²" && r.unit !== "Gs/hora" ? ` ${r.unit}` : ""}</td>
                        <td className="py-3 px-2 text-right">{r.percentile}%</td>
                        <td className="py-3 px-2 text-center"><TrendIcon trend={r.trend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "scores" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {scores.map((s, i) => (
                  <div key={i} onClick={() => setHistoryModal(s)}
                    className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-lg">{s.branch_name}</h3>
                      <TrafficLightBadge color={s.traffic_light} />
                    </div>
                    <div className="flex items-end gap-2 mb-4">
                      <p className="text-3xl font-extrabold">{s.overall_score}</p>
                      <p className="text-sm text-gray-400 mb-1">/ 100</p>
                    </div>
                    <div className="w-full h-3 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${
                        s.traffic_light === "green" ? "bg-green-500" : s.traffic_light === "yellow" ? "bg-yellow-500" : "bg-red-500"
                      }`} style={{ width: `${s.overall_score}%` }}></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                      {Object.entries(KPI_LABELS).slice(0, 6).map(([key, label]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-bold">{s.kpi_scores?.[key] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">#{s.rank} de {s.total_stores} · {s.percentile}% percentil</p>
                  </div>
                ))}
              </div>

              {historyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setHistoryModal(null)}>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold mb-4">{historyModal.branch_name} — Detalle</h3>
                    <div className="space-y-3">
                      {Object.entries(KPI_LABELS).map(([key, label]) => {
                        const score = historyModal.kpi_scores?.[key] ?? 0
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-sm w-40 shrink-0">{label}</span>
                            <div className="flex-1 h-2.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${
                                score >= 75 ? "bg-green-500" : score >= 45 ? "bg-yellow-500" : "bg-red-500"
                              }`} style={{ width: `${score}%` }}></div>
                            </div>
                            <span className="text-sm font-bold w-10 text-right">{score}</span>
                          </div>
                        )
                      })}
                    </div>
                    <button onClick={() => setHistoryModal(null)} className="btn-primary mt-6 w-full">Cerrar</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "comparison" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {comparison.map((r, i) => (
                  <div key={i} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        {r.region_name}
                      </h3>
                      <span className="text-sm bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full font-medium">{r.store_count} tiendas</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-gray-500">Score Promedio</p><p className="font-bold text-lg">{r.avg_score}</p></div>
                      <div><p className="text-gray-500">Ventas/m²</p><p className="font-bold text-lg">{formatPYG(r.avg_sales_per_sqm)}</p></div>
                      <div><p className="text-gray-500">Margen Bruto</p><p className="font-bold">{r.avg_margin}%</p></div>
                      <div><p className="text-gray-500">Shrinkage</p><p className="font-bold">{r.avg_shrinkage}%</p></div>
                      <div><p className="text-gray-500">Ticket Promedio</p><p className="font-bold">{formatPYG(r.avg_ticket)}</p></div>
                    </div>
                    {r.best_store && (
                      <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-xl text-xs">
                        🏆 Mejor: {r.best_store} · ⚠️ Peor: {r.worst_store}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "config" && (
            <div className="space-y-4">
              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                <h3 className="text-lg font-bold mb-4">Ponderación de KPIs</h3>
                <p className="text-sm text-gray-500 mb-4">Configurá el peso relativo y targets de cada KPI para el cálculo del score compuesto (0-100).</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-2 font-semibold text-gray-500">KPI</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-500">Peso</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-500">Target</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-500">Dirección</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-500">Verde ≥</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-500">Rojo ≤</th>
                        <th className="text-center py-3 px-2 font-semibold text-gray-500">Unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configs.map((c, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                          <td className="py-3 px-2 font-medium">{c.kpi_label}</td>
                          <td className="py-3 px-2 text-center">{c.weight}x</td>
                          <td className="py-3 px-2 text-center">{c.target_value ?? "-"}</td>
                          <td className="py-3 px-2 text-center">{c.target_direction === "higher" ? "↑ Mayor" : "↓ Menor"}</td>
                          <td className="py-3 px-2 text-center text-green-600 font-bold">{c.green_threshold ?? 75}</td>
                          <td className="py-3 px-2 text-center text-red-600 font-bold">{c.red_threshold ?? 40}</td>
                          <td className="py-3 px-2 text-center">{c.unit || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
