import { useState, useEffect } from "react"
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Percent, AlertTriangle,
  Shield, Eye, ShoppingCart, Scale, Zap, CheckCircle, XCircle,
  Loader2, RefreshCcw, ChevronUp, ChevronDown, Minus, Target,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"
const TODAY = new Date().toISOString().slice(0, 10)

export default function ShrinkagePage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shrinkage Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">Merma, robo externo/interno, error de precio — descomposición de pérdida desconocida</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Dashboard", icon: BarChart3 },
            { key: "alerts", label: "Alertas", icon: AlertTriangle },
            { key: "recommendations", label: "Recomendaciones", icon: Target },
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
      {tab === "alerts" && <AlertsTab />}
      {tab === "recommendations" && <RecommendationsTab />}
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

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    low: "bg-gray-100 text-gray-600", medium: "bg-yellow-100 text-yellow-700",
    high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700",
  }
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[severity] || "bg-gray-100 text-gray-600"}`}>{severity}</span>
}

// ===== DASHBOARD =====

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.shrinkage.getDashboard(COMPANY_ID, TODAY).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const refs: Record<string, string> = {
    external_theft: "Robo Externo", internal_theft: "Robo Interno",
    pricing_error: "Error Precio", unrecorded_waste: "Merma No Registrada", breakage: "Breakage",
  }
  const icons: Record<string, any> = {
    external_theft: Eye, internal_theft: Shield,
    pricing_error: DollarSign, unrecorded_waste: Scale, breakage: Zap,
  }
  const deptColors: Record<string, string> = {
    carniceria: "red", panaderia: "yellow", verduleria: "green",
    almacen: "blue", limpieza: "purple", bebidas: "indigo",
    lacteos: "orange", congelados: "cyan", perfumeria: "pink", bazar: "gray",
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Venta Teórica" value={`Gs ${(data?.total_theoretical_sales || 0).toLocaleString()}`} color="blue" />
        <KpiCard icon={DollarSign} label="Venta Real" value={`Gs ${(data?.total_actual_sales || 0).toLocaleString()}`} color="green" />
        <KpiCard icon={AlertTriangle} label="Shrinkage Total" value={`${data?.overall_shrinkage_pct ?? 0}%`}
          sub={`Gs ${(data?.total_shrinkage || 0).toLocaleString()}`}
          color={(data?.overall_shrinkage_pct ?? 0) > (data?.benchmark_pct ?? 3) ? "red" : "green"} />
        <KpiCard icon={Target} label="Benchmark" value={`${data?.benchmark_pct ?? 0}%`}
          sub={`Vs. ideal 2-3%: ${(data?.variance_vs_benchmark ?? 0) >= 0 ? "+" : ""}${data?.variance_vs_benchmark ?? 0}pp`}
          color={(data?.variance_vs_benchmark ?? 0) > 1 ? "red" : "green"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Descomposición del Shrinkage</h3>
          <div className="space-y-3">
            {Object.entries(refs).map(([key, label]) => {
              const val = data?.decomposition?.[key] ?? 0
              const Icon = icons[key] || AlertTriangle
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                      <Icon className="w-3 h-3" />{label}
                    </span>
                    <span className="font-bold">{val}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${val}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Shrinkage por Categoría</h3>
          <div className="space-y-3">
            {(data?.by_category ?? []).map((c: any) => (
              <div key={c.category}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">{c.category}</span>
                  <span className="font-bold">{c.shrinkage_pct}%
                    {c.is_anomaly && <span className="ml-1 text-red-500">⚠</span>}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${c.shrinkage_pct > 5 ? "bg-red-500" : c.shrinkage_pct > 3 ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(100, c.shrinkage_pct * 15)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>Teórico: Gs {(c.theoretical_sales || 0).toLocaleString()}</span>
                  <span>Real: Gs {(c.actual_sales || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data?.trends_7d && data.trends_7d.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Tendencia 7 Días (% Shrinkage)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                  <th className="pb-2 pr-4">Fecha</th>
                  <th className="pb-2 pr-4">Shrinkage %</th>
                  <th className="pb-2">Monto Gs</th>
                </tr>
              </thead>
              <tbody>
                {data.trends_7d.map((t: any, i: number) => (
                  <tr key={i} className="border-b dark:border-gray-700/50">
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{t.date}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${t.shrinkage_pct > 5 ? "bg-red-500" : "bg-yellow-500"}`}
                            style={{ width: `${Math.min(100, t.shrinkage_pct * 15)}%` }} />
                        </div>
                        <span className={`font-medium ${t.shrinkage_pct > 5 ? "text-red-500" : "text-gray-600"}`}>{t.shrinkage_pct}%</span>
                      </div>
                    </td>
                    <td className="py-2">Gs {(t.shrinkage_amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.active_alerts && data.active_alerts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-orange-500" /> Alertas Activas ({data.active_alerts.length})
          </h3>
          {data.active_alerts.map((a: any, i: number) => (
            <div key={i} className="flex items-start gap-2 py-2 border-b last:border-0 dark:border-gray-700/50">
              <SeverityBadge severity={a.severity} />
              <div className="flex-1">
                <p className="text-xs text-gray-900 dark:text-white font-medium">{a.description}</p>
                {a.recommendation && <p className="text-[10px] text-gray-500 mt-0.5">{a.recommendation}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== ALERTS =====

function AlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.shrinkage.listAlerts(COMPANY_ID).then(setAlerts).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleResolve(id: string) {
    await api.shrinkage.resolveAlert(COMPANY_ID, id)
    setLoading(true)
    api.shrinkage.listAlerts(COMPANY_ID).then(setAlerts).catch(() => {}).finally(() => setLoading(false))
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-2">Severidad</th>
              <th className="pb-2 pr-2">Categoría</th>
              <th className="pb-2 pr-2">Descripción</th>
              <th className="pb-2 pr-2">Patrón</th>
              <th className="pb-2 pr-2">Estado</th>
              <th className="pb-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a: any, i: number) => (
              <tr key={i} className="border-b dark:border-gray-700/50">
                <td className="py-2 pr-2"><SeverityBadge severity={a.severity} /></td>
                <td className="py-2 pr-2 font-medium capitalize">{a.category}</td>
                <td className="py-2 pr-2 max-w-[250px] truncate">{a.description}</td>
                <td className="py-2 pr-2 text-gray-500">{a.detected_pattern || "—"}</td>
                <td className="py-2 pr-2">
                  {a.is_resolved ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
                </td>
                <td className="py-2">
                  {!a.is_resolved && (
                    <button onClick={() => handleResolve(a.id)}
                      className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">
                      Resolver
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-gray-400">Sin alertas de shrinkage</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== RECOMMENDATIONS =====

function RecommendationsTab() {
  const [recs, setRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.shrinkage.listRecommendations(COMPANY_ID).then(setRecs).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleApply(id: string) {
    await api.shrinkage.applyRecommendation(COMPANY_ID, id)
    setLoading(true)
    api.shrinkage.listRecommendations(COMPANY_ID).then(setRecs).catch(() => {}).finally(() => setLoading(false))
  }

  const typeIcons: Record<string, any> = { surveillance: Eye, audit: Shield, price_review: DollarSign, process: Scale }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      {recs.map((r: any, i: number) => {
        const Icon = typeIcons[r.recommendation_type] || Target
        return (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  r.priority === "high" ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-600"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{r.title}</h3>
                  {r.description && <p className="text-xs text-gray-500 mt-1">{r.description}</p>}
                  <div className="flex items-center gap-2 mt-2 text-[10px]">
                    <span className="capitalize bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{r.category}</span>
                    {r.recommendation_type && <span className="text-gray-400">({r.recommendation_type})</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.potential_savings > 0 && (
                  <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium">
                    Ahorro: Gs {(r.potential_savings || 0).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className={`text-[10px] font-medium ${
                r.priority === "high" ? "text-red-500" : "text-yellow-600"
              }`}>{r.priority === "high" ? "Alta Prioridad" : "Prioridad Media"}</span>
              {!r.is_applied ? (
                <button onClick={() => handleApply(r.id)}
                  className="text-[10px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded hover:bg-blue-100">
                  Aplicar
                </button>
              ) : (
                <span className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Aplicada</span>
              )}
            </div>
          </div>
        )
      })}
      {recs.length === 0 && (
        <div className="text-center py-12 text-gray-400">Sin recomendaciones</div>
      )}
    </div>
  )
}
