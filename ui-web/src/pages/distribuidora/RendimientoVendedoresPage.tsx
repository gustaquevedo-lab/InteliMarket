import { useState, useEffect, useMemo } from "react"
import {
  TrendingUp, Download, RefreshCw, ChevronUp, ChevronDown,
  Users, Trophy, Target, DollarSign, Clock, Filter,
} from "lucide-react"
import { api, SellerPerformance } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"

const formatPYG = (n: number) => "Gs " + Math.round(n).toLocaleString("es-PY")
const fmt1 = (n: number) => n.toFixed(1)

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span className="text-slate-300 text-xs">—</span>
  const max = Math.max(...data, 1)
  const W = 60, H = 24
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * H}`).join(" ")
  return (
    <svg width={W} height={H} className="block">
      <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

type SortKey = keyof SellerPerformance
type SortDir = "asc" | "desc"

function toYMD(d: Date) {
  return d.toISOString().split("T")[0]
}

export default function RendimientoVendedoresPage() {
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"
  const toast = useToast()

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const [data, setData] = useState<SellerPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [sortCol, setSortCol] = useState<SortKey>("coverage_pct")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [fechaDesde, setFechaDesde] = useState(toYMD(thirtyDaysAgo))
  const [fechaHasta, setFechaHasta] = useState(toYMD(today))
  const [routeFilter, setRouteFilter] = useState("")
  const [routes, setRoutes] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { fecha_desde: fechaDesde, fecha_hasta: fechaHasta }
      if (routeFilter) params.route_id = routeFilter
      const res = await (api.distribuidora.tracking.sellers as any).performance(companyId, params)
      setData(res || [])
    } catch (e: any) {
      toast.error("Error al cargar rendimiento", e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [fechaDesde, fechaHasta, routeFilter])

  useEffect(() => {
    api.distribuidora.routes.list(companyId).then(setRoutes).catch(() => {})
  }, [companyId])

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortCol] as number
      const bv = b[sortCol] as number
      return sortDir === "desc" ? bv - av : av - bv
    })
  }, [data, sortCol, sortDir])

  const kpis = useMemo(() => {
    if (data.length === 0) return { activos: 0, totalMonto: 0, coberturaPromedio: 0 }
    const activos = data.filter(d => d.stops_completed > 0).length
    const totalMonto = data.reduce((sum, d) => sum + d.total_amount, 0)
    const coberturaPromedio = data.reduce((sum, d) => sum + d.coverage_pct, 0) / data.length
    return { activos, totalMonto, coberturaPromedio }
  }, [data])

  const handleSort = (col: SortKey) => {
    if (sortCol === col) {
      setSortDir(d => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortCol(col)
      setSortDir("desc")
    }
  }

  const exportCSV = () => {
    const headers = ["Vendedor", "Cobertura %", "Conversión %", "Ticket Gs.", "Monto Total", "Cobros", "Tiempo Promedio (min)"]
    const rows = sorted.map(d => [
      d.seller_name,
      fmt1(d.coverage_pct),
      fmt1(d.conversion_rate),
      Math.round(d.avg_ticket).toString(),
      Math.round(d.total_amount).toString(),
      Math.round(d.total_collected).toString(),
      d.avg_visit_minutes != null ? fmt1(d.avg_visit_minutes) : "",
    ])
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const url = window.URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `rendimiento-preventistas-${fechaDesde}-${fechaHasta}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const ColHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      onClick={() => handleSort(col)}
      className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none whitespace-nowrap"
    >
      <span className="flex items-center gap-1">
        {label}
        {sortCol === col
          ? sortDir === "desc"
            ? <ChevronDown className="w-3 h-3 text-blue-500" />
            : <ChevronUp className="w-3 h-3 text-blue-500" />
          : <span className="w-3 h-3 opacity-0" />}
      </span>
    </th>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Rendimiento de Preventistas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cobertura, conversión y ticket promedio por vendedor de campo.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          <button
            onClick={exportCSV}
            disabled={data.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 font-medium">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 font-medium">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
          />
        </div>
        <select
          value={routeFilter}
          onChange={e => setRouteFilter(e.target.value)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
        >
          <option value="">Todas las rutas</option>
          {routes.map(r => (
            <option key={r.id} value={r.id}>{r.nombre} ({r.codigo || "S/C"})</option>
          ))}
        </select>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Users className="w-4 h-4 text-blue-500" />} label="Preventistas activos" value={String(kpis.activos)} sub={`de ${data.length} totales`} />
        <KpiCard icon={<Target className="w-4 h-4 text-violet-500" />} label="Cobertura promedio" value={`${fmt1(kpis.coberturaPromedio)}%`} sub="visitas completadas" />
        <KpiCard icon={<DollarSign className="w-4 h-4 text-emerald-500" />} label="Monto total" value={formatPYG(kpis.totalMonto)} sub="pedidos del período" />
        <KpiCard icon={<TrendingUp className="w-4 h-4 text-amber-500" />} label="Vendedores en período" value={String(data.length)} sub={`${fechaDesde} → ${fechaHasta}`} />
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando datos...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Trophy className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm font-semibold">Sin datos para el período seleccionado</p>
            <p className="text-xs mt-1">Ajustá el rango de fechas o el filtro de ruta.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vendedor</th>
                  <ColHeader col="coverage_pct" label="Cobertura %" />
                  <ColHeader col="conversion_rate" label="Conversión %" />
                  <ColHeader col="avg_ticket" label="Ticket Gs." />
                  <ColHeader col="total_amount" label="Monto Total" />
                  <ColHeader col="total_collected" label="Cobros" />
                  <ColHeader col="avg_visit_minutes" label="Tiempo (min)" />
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tendencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sorted.map(d => (
                  <tr key={d.seller_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {d.photo_url ? (
                          <img src={d.photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300">
                            {(d.seller_name ?? "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-semibold text-slate-900 dark:text-white text-xs">{d.seller_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${Math.min(d.coverage_pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{fmt1(d.coverage_pct)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-mono text-slate-700 dark:text-slate-300">{fmt1(d.conversion_rate)}%</td>
                    <td className="px-3 py-3 text-xs font-mono text-slate-700 dark:text-slate-300">{formatPYG(d.avg_ticket)}</td>
                    <td className="px-3 py-3 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatPYG(d.total_amount)}</td>
                    <td className="px-3 py-3 text-xs font-mono text-slate-700 dark:text-slate-300">{formatPYG(d.total_collected)}</td>
                    <td className="px-3 py-3 text-xs font-mono text-slate-500">
                      {d.avg_visit_minutes != null ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt1(d.avg_visit_minutes)}</span> : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Sparkline data={d.weekly_coverage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <div className="text-lg font-black font-mono text-slate-900 dark:text-white">{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  )
}
