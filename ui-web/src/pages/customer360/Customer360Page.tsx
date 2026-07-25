import { useState, useEffect } from "react"
import {
  BarChart3, Users, ShoppingBag, TrendingDown, Target, Gift,
  Loader2, RefreshCcw, AlertTriangle, Clock, DollarSign, PieChart,
  ChevronRight, Search,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function Customer360Page() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer 360 Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Canasta analítica, penetración por categoría, predicción de abandono, ciclo de vida, campañas de recuperación</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Dashboard", icon: BarChart3 },
            { key: "churn", label: "Riesgo Abandono", icon: TrendingDown },
            { key: "lifecycle", label: "Ciclo de Vida", icon: Target },
            { key: "recovery", label: "Recuperación", icon: Gift },
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
      {tab === "churn" && <ChurnTab />}
      {tab === "lifecycle" && <LifecycleTab />}
      {tab === "recovery" && <RecoveryTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600", yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600", indigo: "bg-indigo-50 text-indigo-600",
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

  useEffect(() => { api.customer360.getDashboard(COMPANY_ID).then(setData).catch(() => {}).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  const d = data || {}

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Clientes Totales" value={d.total_customers} color="blue" />
        <KpiCard icon={Users} label="Activos (30d)" value={d.active_customers_30d} sub={`${d.new_customers_30d} nuevos`} color="green" />
        <KpiCard icon={AlertTriangle} label="Perdidos (30d)" value={d.lost_customers_30d} sub={`${d.churn_rate_pct}% churn rate`} color="red" />
        <KpiCard icon={ShoppingBag} label="Ticket Promedio" value={`Gs ${(d.avg_basket || 0).toLocaleString()}`} color="purple" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="LTV Promedio" value={`Gs ${(d.avg_ltv || 0).toLocaleString()}`} color="indigo" />
        <KpiCard icon={PieChart} label="Penetración Prom." value={`${d.avg_penetration_pct || 0}%`} color="green" />
        <KpiCard icon={TrendingDown} label="Alto Riesgo" value={d.high_risk_churn} sub="churn ≥ 50" color="red" />
        <KpiCard icon={Gift} label="Campañas Activas" value={d.active_recovery_campaigns} sub={`Gs ${(d.total_recovered_amount || 0).toLocaleString()} recuperados`} color="yellow" />
      </div>

      {d.by_stage && Object.keys(d.by_stage).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Distribución por Etapa del Ciclo de Vida</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(d.by_stage as Record<string, number>).map(([stage, count]) => {
              const colors: Record<string, string> = {
                new: "bg-purple-100 text-purple-700", active: "bg-blue-100 text-blue-700",
                regular: "bg-green-100 text-green-700", loyal: "bg-yellow-100 text-yellow-700",
                at_risk: "bg-orange-100 text-orange-700", lost: "bg-red-100 text-red-700",
              }
              return (
                <div key={stage} className={`rounded-lg p-3 text-center ${colors[stage] || "bg-gray-100"}`}>
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-xs capitalize">{stage.replace("_", " ")}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {d.churn_trend && d.churn_trend.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Tendencia de Churn Score por Mes</h3>
          <div className="flex items-end gap-3 h-32">
            {d.churn_trend.map((m: any) => {
              const h = Math.min(100, m.avg_score || 0)
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{h.toFixed(0)}</span>
                  <div className="w-full bg-blue-500 rounded-t" style={{ height: `${h}%`, minHeight: 4 }} />
                  <span className="text-xs text-gray-400">M{m.month}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button onClick={async () => { await api.customer360.bulkCompute(COMPANY_ID); window.location.reload() }}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
      >
        <RefreshCcw className="w-4 h-4" /> Re-calcular todo
      </button>
    </div>
  )
}

// ===== CHURN =====

function ChurnTab() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.customer360.listHighRiskChurn(COMPANY_ID).then(setCustomers).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = customers.filter((c) =>
    (c.customer_id || "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por ID cliente..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" />
        </div>
        <button onClick={async () => { await api.customer360.bulkCompute(COMPANY_ID); window.location.reload() }} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
          <RefreshCcw className="w-4 h-4" /> Predecir todo
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-2">Cliente</th>
                <th className="text-left py-3 px-2">Score</th>
                <th className="text-left py-3 px-2">Riesgo</th>
                <th className="text-left py-3 px-2">Días sin compra</th>
                <th className="text-left py-3 px-2">Frecuencia media</th>
                <th className="text-left py-3 px-2">Δ Ticket</th>
                <th className="text-left py-3 px-2">Δ Frecuencia</th>
                <th className="text-left py-3 px-2">Recuperación</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const riskColors: Record<string, string> = { critical: "text-red-600 bg-red-50", high: "text-orange-600 bg-orange-50", medium: "text-yellow-600 bg-yellow-50", low: "text-green-600 bg-green-50" }
                return (
                  <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-2 font-medium">{c.customer_id?.slice(0, 8)}...</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2"><div className="bg-blue-600 rounded-full h-2" style={{ width: `${c.churn_score}%` }} /></div>
                        <span className="text-xs font-bold">{c.churn_score}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColors[c.churn_risk] || ""}`}>{c.churn_risk}</span></td>
                    <td className="py-3 px-2">{c.days_since_last_purchase}d</td>
                    <td className="py-3 px-2">{c.avg_frequency_days}d</td>
                    <td className="py-3 px-2"><span className={c.avg_ticket_change_pct < 0 ? "text-red-600" : "text-green-600"}>{c.avg_ticket_change_pct > 0 ? "+" : ""}{c.avg_ticket_change_pct}%</span></td>
                    <td className="py-3 px-2"><span className={c.frequency_change_pct < 0 ? "text-red-600" : "text-green-600"}>{c.frequency_change_pct > 0 ? "+" : ""}{c.frequency_change_pct}%</span></td>
                    <td className="py-3 px-2">{c.is_recovery_triggered ? <span className="text-green-600 text-xs">✅</span> : "—"}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Sin datos de churn — ejecutá "Predecir todo"</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ===== LIFECYCLE =====

function LifecycleTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchId, setSearchId] = useState("")

  const loadCustomer = async (customerId: string) => {
    if (!customerId) return
    setLoading(true)
    try {
      const [lifecycle, basket, churn] = await Promise.all([
        api.customer360.getLifecycle(COMPANY_ID, customerId).catch(() => null),
        api.customer360.getBasket(COMPANY_ID, customerId).catch(() => null),
        api.customer360.getChurn(COMPANY_ID, customerId).catch(() => null),
      ])
      setData({ lifecycle, basket, churn })
    } catch {}
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Customer ID..." className="flex-1 max-w-md px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" />
        <button onClick={() => loadCustomer(searchId)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Consultar</button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : data ? (
        <div className="space-y-4">
          {data.lifecycle && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Ciclo de Vida</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><p className="text-xs text-gray-500">Etapa</p><p className="text-lg font-bold capitalize">{data.lifecycle.stage}</p></div>
                <div><p className="text-xs text-gray-500">Días en etapa</p><p className="text-lg font-bold">{data.lifecycle.days_in_stage}</p></div>
                <div><p className="text-xs text-gray-500">Antigüedad</p><p className="text-lg font-bold">{data.lifecycle.total_tenure_days} días</p></div>
                <div><p className="text-xs text-gray-500">LTV Total</p><p className="text-lg font-bold">Gs {(data.lifecycle.total_lifetime_value || 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">LTV Proyectado</p><p className="text-lg font-bold">Gs {(data.lifecycle.predicted_ltv || 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Tendencia</p><p className={`text-lg font-bold ${data.lifecycle.ltv_trend === "growing" ? "text-green-600" : data.lifecycle.ltv_trend === "declining" ? "text-red-600" : ""}`}>{data.lifecycle.ltv_trend}</p></div>
              </div>
              {data.lifecycle.segment_tags?.length > 0 && (
                <div className="flex gap-2 mt-3">{data.lifecycle.segment_tags.map((t: string) => <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">{t}</span>)}</div>
              )}
            </div>
          )}
          {data.basket && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Canasta Analítica</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><p className="text-xs text-gray-500">Ticket Promedio</p><p className="text-lg font-bold">Gs {(data.basket.avg_ticket || 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Items por ticket</p><p className="text-lg font-bold">{data.basket.avg_items_per_ticket}</p></div>
                <div><p className="text-xs text-gray-500">Gasto 30d</p><p className="text-lg font-bold">Gs {(data.basket.total_spent_30d || 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Gasto 90d</p><p className="text-lg font-bold">Gs {(data.basket.total_spent_90d || 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Transacciones 30d</p><p className="text-lg font-bold">{data.basket.total_transactions_30d}</p></div>
                <div><p className="text-xs text-gray-500">Días entre visitas</p><p className="text-lg font-bold">{data.basket.avg_days_between_visits}</p></div>
                <div><p className="text-xs text-gray-500">Día preferido</p><p className="text-lg font-bold capitalize">{data.basket.preferred_day || "—"}</p></div>
                <div><p className="text-xs text-gray-500">Hora preferida</p><p className="text-lg font-bold">{data.basket.preferred_hour ? `${data.basket.preferred_hour}:00` : "—"}</p></div>
              </div>
            </div>
          )}
          {data.churn && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Predicción de Abandono</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><p className="text-xs text-gray-500">Score</p><p className="text-lg font-bold">{data.churn.churn_score}</p></div>
                <div><p className="text-xs text-gray-500">Riesgo</p><p className={`text-lg font-bold font-bold ${data.churn.churn_risk === "critical" ? "text-red-600" : data.churn.churn_risk === "high" ? "text-orange-600" : ""}`}>{data.churn.churn_risk}</p></div>
                <div><p className="text-xs text-gray-500">Días sin compra</p><p className="text-lg font-bold">{data.churn.days_since_last_purchase}</p></div>
                <div><p className="text-xs text-gray-500">Δ Ticket</p><p className={`text-lg font-bold ${data.churn.avg_ticket_change_pct < 0 ? "text-red-600" : ""}`}>{data.churn.avg_ticket_change_pct}%</p></div>
              </div>
            </div>
          )}
        </div>
      ) : (
        !loading && <div className="text-center py-12 text-gray-400">Ingresá un Customer ID para ver el análisis completo</div>
      )}
    </div>
  )
}

// ===== RECOVERY CAMPAIGNS =====

function RecoveryTab() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  useEffect(() => { load() }, [filter])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.customer360.listRecovery(COMPANY_ID, filter || undefined)
      setCampaigns(data)
    } catch {}
    setLoading(false)
  }

  const notify = async (id: string) => {
    try { await api.customer360.notifyRecovery(COMPANY_ID, id); load() } catch {}
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700", notified: "bg-blue-100 text-blue-700",
    redeemed: "bg-green-100 text-green-700", expired: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="notified">Notificados</option>
          <option value="redeemed">Canjeados</option>
        </select>
        <button onClick={() => load()} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">
          <RefreshCcw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="grid gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status] || ""}`}>{c.status}</span>
                  <span className="text-xs text-gray-400">{c.customer_id?.slice(0, 8)}...</span>
                </div>
                <div className="flex gap-2">
                  {c.status === "pending" && <button onClick={() => notify(c.id)} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs">Notificar</button>}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><span className="text-gray-500">Score</span><p className="font-semibold">{c.trigger_score}</p></div>
                <div><span className="text-gray-500">Oferta</span><p className="font-semibold">{c.offer_type?.replace("_", " ")} — Gs {(c.offer_value || 0).toLocaleString()}</p></div>
                <div><span className="text-gray-500">Canal</span><p className="font-semibold">{c.channel}</p></div>
                <div>
                  {c.status === "redeemed" && <><span className="text-gray-500">Recuperado</span><p className="font-semibold text-green-600">Gs {(c.recovery_amount || 0).toLocaleString()}</p></>}
                  {c.notified_at && <><span className="text-gray-500">Notificado</span><p className="font-semibold">{new Date(c.notified_at).toLocaleDateString()}</p></>}
                </div>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && <div className="text-center py-12 text-gray-400">Sin campañas de recuperación</div>}
        </div>
      )}
    </div>
  )
}
