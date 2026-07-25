import { useState, useEffect } from "react"
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Clock, Users,
  Target, Award, Loader2, RefreshCcw, Search, Filter, ChevronUp, ChevronDown,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"
const TODAY = new Date().toISOString().slice(0, 10)
const MONTH_AGO = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

const AREA_LABELS: Record<string, string> = {
  caja: "Caja", carniceria: "Carnicería", panaderia: "Panadería", reposicion: "Reposición",
}
const AREA_METRIC_DISPLAY: Record<string, string> = {
  caja: "Transacciones/hora", carniceria: "Kg procesados/hora", panaderia: "Unidades/hora", reposicion: "Cajas/hora",
}
const AREA_METRIC_FIELD: Record<string, string> = {
  caja: "transactions_processed", carniceria: "kg_processed", panaderia: "units_processed", reposicion: "boxes_processed",
}

export default function ProductividadPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Productividad Laboral</h1>
          <p className="text-sm text-gray-500 mt-1">Métricas por área, eficiencia vs presupuesto, ranking empleados, costo por unidad procesada</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Dashboard", icon: BarChart3 },
            { key: "records", label: "Registros", icon: Clock },
            { key: "targets", label: "Metas", icon: Target },
            { key: "ranking", label: "Ranking", icon: Award },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "records" && <RecordsTab />}
      {tab === "targets" && <TargetsTab />}
      {tab === "ranking" && <RankingTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600", yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600", indigo: "bg-indigo-50 text-indigo-600",
    orange: "bg-orange-50 text-orange-600",
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colors[color] || colors.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? "—"}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// ===== DASHBOARD =====

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.productividad.getDashboard(COMPANY_ID, MONTH_AGO, TODAY).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={Users} label="Empleados Evaluados" value={data?.total_employees_evaluated} color="blue" />
        <KpiCard icon={TrendingUp} label="Eficiencia Promedio" value={`${data?.overall_avg_efficiency ?? 0}%`} color="green" />
        <KpiCard icon={DollarSign} label="Costo Prom. por Unidad" value={`Gs ${(data?.overall_avg_cost_per_unit ?? 0).toLocaleString()}`} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(data?.area_metrics ?? []).map((m: any) => (
          <div key={m.area} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {AREA_LABELS[m.area] || m.area}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Empleados</p>
                <p className="font-bold text-gray-900 dark:text-white">{m.employees_count}</p>
              </div>
              <div>
                <p className="text-gray-500">Horas Reales</p>
                <p className="font-bold text-gray-900 dark:text-white">{m.total_hours}h</p>
              </div>
              <div>
                <p className="text-gray-500">Planificadas</p>
                <p className="font-bold text-gray-900 dark:text-white">{m.planned_hours}h</p>
              </div>
              <div>
                <p className="text-gray-500">Eficiencia</p>
                <p className="font-bold text-gray-900 dark:text-white">{m.avg_efficiency_pct}%</p>
              </div>
              <div>
                <p className="text-gray-500">{AREA_METRIC_DISPLAY[m.area] || "Métrica"}</p>
                <p className="font-bold text-green-600">{m.avg_metric_per_hour}</p>
              </div>
              <div>
                <p className="text-gray-500">Costo/Unidad</p>
                <p className="font-bold text-purple-600">Gs {m.avg_cost_per_unit.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs">
              <span className="flex items-center gap-1 text-green-600">
                <ChevronUp className="w-3 h-3" />{m.top_performer || "—"}
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <ChevronDown className="w-3 h-3" />{m.bottom_performer || "—"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {data?.weekly_trends && data.weekly_trends.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Tendencias Semanales (Productividad Promedio)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                  <th className="pb-2 pr-4">Semana</th>
                  <th className="pb-2">Productividad Prom.</th>
                </tr>
              </thead>
              <tbody>
                {data.weekly_trends.map((t: any, i: number) => (
                  <tr key={i} className="border-b dark:border-gray-700/50">
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{t.week}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(100, (t.avg_productivity || 0) * 10)}%` }} />
                        <span className="text-gray-600">{t.avg_productivity}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== RECORDS =====

function RecordsTab() {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [areaFilter, setAreaFilter] = useState("")

  useEffect(() => {
    api.productividad.listRecords(COMPANY_ID, { limit: 100, ...(areaFilter ? { area: areaFilter } : {}) })
      .then(setRecords).catch(() => {}).finally(() => setLoading(false))
  }, [areaFilter])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}
          className="text-xs border rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-700">
          <option value="">Todas las áreas</option>
          <option value="caja">Caja</option>
          <option value="carniceria">Carnicería</option>
          <option value="panaderia">Panadería</option>
          <option value="reposicion">Reposición</option>
        </select>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-2">Empleado</th>
              <th className="pb-2 pr-2">Área</th>
              <th className="pb-2 pr-2">Fecha</th>
              <th className="pb-2 pr-2">Transacc.</th>
              <th className="pb-2 pr-2">Kg</th>
              <th className="pb-2 pr-2">Unid.</th>
              <th className="pb-2 pr-2">Cajas</th>
              <th className="pb-2 pr-2">Ventas Gs</th>
              <th className="pb-2 pr-2">Horas</th>
              <th className="pb-2">Planif.</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r: any, i: number) => (
              <tr key={i} className="border-b dark:border-gray-700/50">
                <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{r.employee_name || r.employee_id?.slice(0, 8)}</td>
                <td className="py-2 pr-2">{AREA_LABELS[r.area] || r.area}</td>
                <td className="py-2 pr-2">{r.fecha}</td>
                <td className="py-2 pr-2">{r.transactions_processed}</td>
                <td className="py-2 pr-2">{r.kg_processed}</td>
                <td className="py-2 pr-2">{r.units_processed}</td>
                <td className="py-2 pr-2">{r.boxes_processed}</td>
                <td className="py-2 pr-2">{(r.sales_amount || 0).toLocaleString()}</td>
                <td className="py-2 pr-2">{r.hours_worked}</td>
                <td className="py-2">{r.planned_hours}</td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={10} className="py-4 text-center text-gray-400">Sin registros de productividad</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== TARGETS =====

function TargetsTab() {
  const [targets, setTargets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.productividad.listTargets(COMPANY_ID).then(setTargets).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Metas de Productividad por Área</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                <th className="pb-2 pr-2">Área</th>
                <th className="pb-2 pr-2">Métrica</th>
                <th className="pb-2 pr-2">Valor Meta</th>
                <th className="pb-2 pr-2">Costo/Unidad</th>
                <th className="pb-2 pr-2">Vigente Desde</th>
                <th className="pb-2">Hasta</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t: any, i: number) => (
                <tr key={i} className="border-b dark:border-gray-700/50">
                  <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{AREA_LABELS[t.area] || t.area}</td>
                  <td className="py-2 pr-2">{t.metric_name}</td>
                  <td className="py-2 pr-2 font-bold text-blue-600">{t.target_value}</td>
                  <td className="py-2 pr-2">Gs {(t.budget_cost_per_unit || 0).toLocaleString()}</td>
                  <td className="py-2 pr-2">{t.effective_from}</td>
                  <td className="py-2">{t.effective_to || "Indefinido"}</td>
                </tr>
              ))}
              {targets.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-400">Sin metas configuradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===== RANKING =====

function RankingTab() {
  const [ranking, setRanking] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [areaFilter, setAreaFilter] = useState("")
  const [orderBy, setOrderBy] = useState("efficiency_pct")

  useEffect(() => {
    api.productividad.getRanking(COMPANY_ID, { area: areaFilter || undefined, limit: 50, order_by: orderBy })
      .then(setRanking).catch(() => {}).finally(() => setLoading(false))
  }, [areaFilter, orderBy])

  function TrendIcon({ trend }: { trend: string }) {
    if (trend === "up") return <TrendingUp className="w-3 h-3 text-green-500" />
    if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-500" />
    return <span className="text-gray-400">—</span>
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-700">
            <option value="">Todas las áreas</option>
            <option value="caja">Caja</option>
            <option value="carniceria">Carnicería</option>
            <option value="panaderia">Panadería</option>
            <option value="reposicion">Reposición</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Orden:</span>
          <select value={orderBy} onChange={(e) => setOrderBy(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 dark:border-gray-700">
            <option value="efficiency_pct">Eficiencia</option>
            <option value="metric_per_hour">Productividad/hora</option>
            <option value="cost_per_unit">Menor Costo/Unidad</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-2">#</th>
              <th className="pb-2 pr-2">Empleado</th>
              <th className="pb-2 pr-2">Área</th>
              <th className="pb-2 pr-2">Eficiencia</th>
              <th className="pb-2 pr-2">Métrica/hora</th>
              <th className="pb-2 pr-2">Costo/Unidad</th>
              <th className="pb-2 pr-2">Rango Área</th>
              <th className="pb-2">Tendencia</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((e: any, i: number) => (
              <tr key={i} className="border-b dark:border-gray-700/50">
                <td className="py-2 pr-2 font-bold text-gray-500">{i + 1}</td>
                <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{e.employee_name || e.employee_id?.slice(0, 8)}</td>
                <td className="py-2 pr-2">{AREA_LABELS[e.area] || e.area}</td>
                <td className="py-2 pr-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    (e.efficiency_pct ?? 0) >= 90 ? "bg-green-100 text-green-700" :
                    (e.efficiency_pct ?? 0) >= 70 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>{e.efficiency_pct}%</span>
                </td>
                <td className="py-2 pr-2 font-medium">{e.metric_per_hour}</td>
                <td className="py-2 pr-2">Gs {(e.cost_per_unit || 0).toLocaleString()}</td>
                <td className="py-2 pr-2">#{e.ranking_in_area}</td>
                <td className="py-2"><TrendIcon trend={e.trend} /></td>
              </tr>
            ))}
            {ranking.length === 0 && (
              <tr><td colSpan={8} className="py-4 text-center text-gray-400">Sin datos de ranking</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
