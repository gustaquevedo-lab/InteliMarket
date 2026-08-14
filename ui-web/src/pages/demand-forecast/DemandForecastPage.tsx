import { useState, useEffect } from "react"
import {
  BarChart3, TrendingUp, AlertTriangle, ShoppingCart, CheckCircle, History, Plus, Search, Loader2,
  Package, Users, MapPin, Calendar, DollarSign, Zap, ThumbsUp, ThumbsDown, Clock, X, Check,
  FileSpreadsheet, RefreshCcw, BrainCircuit, ArrowUpDown, LineChart, PieChart, Truck,
} from "lucide-react"
import { api } from "../../api/index"
import { formatDate } from "../../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function DemandForecastPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forecast Inteligente de Demanda</h1>
          <p className="text-sm text-gray-500 mt-1">Predicción ML, detección de anomalías, sugerencias de compra con proveedor comparado, cross-docking, precisión</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",     label: "Dashboard",       icon: BarChart3 },
            { key: "predicciones",  label: "Predicciones",    icon: TrendingUp },
            { key: "anomalias",     label: "Anomalías",       icon: AlertTriangle },
            { key: "compras",       label: "Sugerencias O/C", icon: ShoppingCart },
            { key: "crossdock",     label: "Cross-Dock",      icon: Truck },
            { key: "precision",     label: "Precisión",       icon: LineChart },
            { key: "overrides",     label: "Overrides",       icon: History },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard"    && <DashboardTab />}
      {tab === "predicciones" && <PrediccionesTab />}
      {tab === "anomalias"    && <AnomaliasTab />}
      {tab === "compras"      && <ComprasTab />}
      {tab === "crossdock"    && <CrossDockTab />}
      {tab === "precision"    && <PrecisionTab />}
      {tab === "overrides"    && <OverridesTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
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
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.demandForecast?.getDashboard(COMPANY_ID),
      api.demandForecast?.getPredictionsSummary(COMPANY_ID),
    ]).then(([d, s]) => { setData(d); setSummary(s) }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Package} label="Productos Pronosticados" value={data?.total_products_forecasted} color="blue" />
        <KpiCard icon={BarChart3} label="Predicciones Generadas" value={data?.total_predictions} color="green" />
        <KpiCard icon={AlertTriangle} label="Anomalías Activas" value={data?.active_anomalies} color={data?.active_anomalies > 0 ? "red" : "green"} />
        <KpiCard icon={ShoppingCart} label="Sugerencias O/C Pend." value={data?.pending_suggestions} color="purple" />
      </div>
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpiCard icon={TrendingUp} label="Demanda Pronosticada (7d)" value={Intl.NumberFormat().format(summary.week_demand || 0)} color="indigo" />
          <KpiCard icon={TrendingUp} label="Demanda Pronosticada (30d)" value={Intl.NumberFormat().format(summary.month_demand || 0)} color="indigo" />
        </div>
      )}
      {data?.overall_accuracy_pct != null && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Precisión del Modelo</h3>
          <div className="text-3xl font-bold text-green-600">{data.overall_accuracy_pct.toFixed(1)}%</div>
          <p className="text-xs text-gray-400 mt-1">MAPE general del modelo de forecasting</p>
        </div>
      )}
      {data?.recent_anomalies?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Anomalías Recientes</h3>
          <div className="space-y-2">
            {data.recent_anomalies.slice(0, 3).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-600 dark:text-gray-400">{a.tipo} — desv: {a.deviation_pct?.toFixed(1)}%</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  a.severity === "critical" ? "bg-red-50 text-red-600" : a.severity === "warning" ? "bg-yellow-50 text-yellow-600" : "bg-blue-50 text-blue-600"
                }`}>{a.severity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== PREDICCIONES =====

function PrediccionesTab() {
  const [predictions, setPredictions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState({ product_id: "", horizon_days: "90" })

  const load = () => {
    setLoading(true)
    api.demandForecast?.listPredictions(COMPANY_ID, { product_id: filter.product_id || undefined }).then(setPredictions).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    await api.demandForecast?.generateForecast({
      product_ids: filter.product_id ? [filter.product_id] : null,
      horizon_days: parseInt(filter.horizon_days),
      force: true,
    })
    setGenerating(false)
    load()
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={filter.product_id} onChange={e => setFilter({ ...filter, product_id: e.target.value })}
            placeholder="Producto ID (vacío = todos)" className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          <select value={filter.horizon_days} onChange={e => setFilter({ ...filter, horizon_days: e.target.value })}
            className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
            <option value="30">30 días</option>
            <option value="60">60 días</option>
            <option value="90">90 días</option>
            <option value="180">180 días</option>
          </select>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
            {generating ? <Spinner /> : <Zap className="w-4 h-4" />} Generar Forecast
          </button>
          <button onClick={load}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <RefreshCcw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Pronóstico</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Confianza</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Rango</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Modelo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {predictions.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{p.product_id?.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-gray-600">{p.forecast_date}</td>
                <td className="px-4 py-3 text-right font-semibold">{Intl.NumberFormat().format(p.predicted_qty)}</td>
                <td className="px-4 py-3 text-right">{p.confidence_score ? `${p.confidence_score}%` : "—"}</td>
                <td className="px-4 py-3 text-right text-xs text-gray-400">
                  {p.confidence_lower != null ? `${Intl.NumberFormat().format(p.confidence_lower)} — ${Intl.NumberFormat().format(p.confidence_upper)}` : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600">{p.model_used || "—"}</span>
                </td>
              </tr>
            ))}
            {predictions.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin predicciones. Generá un forecast.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== ANOMALÍAS =====

function AnomaliasTab() {
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)

  const load = () => {
    setLoading(true)
    api.demandForecast?.listAnomalies(COMPANY_ID).then(setAnomalies).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDetect = async () => {
    setDetecting(true)
    await api.demandForecast?.detectAnomalies(COMPANY_ID)
    setDetecting(false)
    load()
  }

  const handleReview = async (id: string) => {
    await api.demandForecast?.reviewAnomaly(id, { reviewed: true })
    load()
  }

  const severityColors: Record<string, string> = {
    critical: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    warning: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    info: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{anomalies.filter(a => !a.reviewed).length} sin revisar</p>
        <button onClick={handleDetect} disabled={detecting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
          {detecting ? <Spinner /> : <Zap className="w-4 h-4" />} Detectar Anomalías
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Severidad</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Esperado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Real</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Desv.</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {anomalies.map((a: any) => (
              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600">{a.tipo}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[a.severity] || "bg-gray-50 text-gray-600"}`}>{a.severity}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{a.product_id?.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-right">{a.expected_value != null ? Intl.NumberFormat().format(a.expected_value) : "—"}</td>
                <td className="px-4 py-3 text-right">{a.actual_value != null ? Intl.NumberFormat().format(a.actual_value) : "—"}</td>
                <td className={`px-4 py-3 text-right font-medium ${(a.deviation_pct || 0) > 0 ? "text-green-600" : "text-red-600"}`}>
                  {a.deviation_pct != null ? `${a.deviation_pct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {a.reviewed ? (
                    <CheckCircle className="w-4 h-4 text-green-500 inline" />
                  ) : (
                    <button onClick={() => handleReview(a.id)} className="text-xs text-blue-600 hover:text-blue-800">Revisar</button>
                  )}
                </td>
              </tr>
            ))}
            {anomalies.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin anomalías detectadas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== SUGERENCIAS DE COMPRA =====

function ComprasTab() {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [products, setProducts] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const sugs = await api.demandForecast?.listPurchaseSuggestions(COMPANY_ID) || []
      setSuggestions(sugs)
      const uniqueIds = Array.from(new Set(sugs.map((s: any) => s.product_id).filter(Boolean)))
      const missing = uniqueIds.filter((id: string) => !products[id])
      if (missing.length > 0) {
        const results = await Promise.all(missing.map((id: string) => api.products.get(id).catch(() => null)))
        setProducts((prev) => {
          const next = { ...prev }
          results.forEach((p: any, i: number) => { if (p) next[missing[i]] = p })
          return next
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    await api.demandForecast?.generatePurchaseSuggestions(COMPANY_ID)
    setGenerating(false)
    load()
  }

  const handleStatus = async (id: string, status: string) => {
    await api.demandForecast?.updatePurchaseSuggestion(id, { status })
    load()
  }

  const statusColors: Record<string, string> = {
    pending: "bg-gray-50 text-gray-600",
    suggested: "bg-blue-50 text-blue-600",
    converted: "bg-green-50 text-green-600",
    rejected: "bg-red-50 text-red-600",
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{suggestions.length} sugerencias</p>
        <button onClick={handleGenerate} disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
          {generating ? <Spinner /> : <Zap className="w-4 h-4" />} Generar Sugerencias
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Proveedor sugerido</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Cant.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Precio Esp.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Stock</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Demanda</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {suggestions.map((s: any) => {
              const candidates: any[] = s.supplier_candidates || []
              const best = candidates[0]
              return (
                <>
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{products[s.product_id]?.nombre || s.product_id?.slice(0, 8) + "..."}</td>
                    <td className="px-4 py-3">
                      {best ? (
                        <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="text-left hover:underline">
                          <span className="text-gray-700 dark:text-gray-300">{best.nombre}</span>
                          {candidates.length > 1 && <span className="text-xs text-blue-500 ml-1">+{candidates.length - 1} más</span>}
                        </button>
                      ) : <span className="text-gray-400 text-xs">Sin proveedor con historial</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{Intl.NumberFormat().format(s.suggested_qty)}</td>
                    <td className="px-4 py-3 text-gray-600">{s.suggested_date}</td>
                    <td className="px-4 py-3 text-right">{s.expected_price ? Intl.NumberFormat().format(s.expected_price) : "—"}</td>
                    <td className="px-4 py-3 text-right">{s.current_stock != null ? Intl.NumberFormat().format(s.current_stock) : "0"}</td>
                    <td className="px-4 py-3 text-right">{s.forecast_demand ? Intl.NumberFormat().format(s.forecast_demand) : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status] || "bg-gray-50 text-gray-600"}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.status === "suggested" && (
                        <div className="flex justify-center gap-1">
                          <button onClick={() => handleStatus(s.id, "converted")} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Convertir a O/C"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => handleStatus(s.id, "rejected")} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Rechazar"><ThumbsDown className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expanded === s.id && candidates.length > 0 && (
                    <tr key={s.id + "-detail"}>
                      <td colSpan={9} className="px-4 py-3 bg-gray-50 dark:bg-gray-900/30">
                        <p className="text-xs text-gray-500 mb-2">Proveedores candidatos, ordenados por mejor precio:</p>
                        <div className="flex flex-wrap gap-2">
                          {candidates.map((c: any, i: number) => (
                            <div key={c.supplier_id} className={`px-3 py-2 rounded-lg border text-xs ${i === 0 ? "border-green-300 bg-green-50 dark:bg-green-900/20" : "border-gray-200 dark:border-gray-700"}`}>
                              <div className="font-semibold text-gray-800 dark:text-gray-200">{c.nombre}</div>
                              <div className="text-gray-500">{Intl.NumberFormat().format(c.precio)} {c.moneda} · {c.lead_time_dias}d entrega</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
            {suggestions.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Sin sugerencias de compra. Generá primero un forecast.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== CROSS-DOCK =====

function CrossDockTab() {
  const [crossdock, setCrossdock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [productQuery, setProductQuery] = useState("")
  const [productResults, setProductResults] = useState<any[]>([])
  const [form, setForm] = useState({
    producto_id: "", producto_nombre: "", proveedor_id: "", cantidad: "",
    fecha_crossdock: new Date().toISOString().slice(0, 10), destino: "gondola",
  })

  const load = () => {
    setLoading(true)
    api.replenishment.crossdock.list().then(setCrossdock).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!showModal) return
    api.purchases.suppliers().then(setSuppliers).catch(() => {})
  }, [showModal])

  useEffect(() => {
    if (productQuery.trim().length < 2) { setProductResults([]); return }
    const t = setTimeout(() => {
      api.products.list({ search: productQuery }).then((res) => setProductResults(res.slice(0, 8))).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [productQuery])

  const handleCreate = async () => {
    if (!form.producto_id || !form.cantidad) return
    setSaving(true)
    try {
      await api.replenishment.crossdock.create({
        producto_id: form.producto_id,
        proveedor_id: form.proveedor_id || undefined,
        cantidad: Number(form.cantidad),
        fecha_crossdock: form.fecha_crossdock,
        destino: form.destino,
      })
      setShowModal(false)
      setForm({ producto_id: "", producto_nombre: "", proveedor_id: "", cantidad: "", fecha_crossdock: new Date().toISOString().slice(0, 10), destino: "gondola" })
      setProductQuery("")
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async (id: string) => {
    const res = await api.replenishment.crossdock.complete(id)
    setCrossdock((prev) => prev.map((c) => (c.id === id ? { ...c, ...res } : c)))
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nueva Orden
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Proveedor</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Cantidad</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Destino</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {crossdock.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{c.producto_nombre}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.proveedor_nombre || "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{c.cantidad}</td>
                <td className="px-4 py-3">{formatDate(c.fecha_crossdock)}</td>
                <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{c.destino}</span></td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.estado === "completado" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>{c.estado}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {c.estado === "pendiente" && (
                    <button onClick={() => handleComplete(c.id)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Completar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {crossdock.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin órdenes de cross-dock todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Orden de Cross-Dock</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Producto</label>
              {form.producto_id ? (
                <div className="flex items-center justify-between border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm">
                  <span>{form.producto_nombre}</span>
                  <button onClick={() => setForm({ ...form, producto_id: "", producto_nombre: "" })} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="relative">
                  <input className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" placeholder="Buscar producto por nombre o SKU..." value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
                  {productResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                      {productResults.map((p) => (
                        <button key={p.id} onClick={() => { setForm({ ...form, producto_id: p.id, producto_nombre: p.nombre }); setProductQuery(""); setProductResults([]) }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600">
                          {p.nombre} <span className="text-gray-400 text-xs">{p.sku}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Proveedor</label>
              <select className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.proveedor_id} onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}>
                <option value="">Sin especificar</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.razon_social || s.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Cantidad</label>
                <input type="number" min={0} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
                <input type="date" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.fecha_crossdock} onChange={(e) => setForm({ ...form, fecha_crossdock: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Destino</label>
              <select className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })}>
                <option value="gondola">Góndola</option>
                <option value="exhibicion">Exhibición</option>
                <option value="deposito">Depósito</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowModal(false); setProductQuery("") }} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={handleCreate} disabled={saving} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Spinner /> : "Crear Orden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== PRECISIÓN =====

function PrecisionTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)

  const load = () => {
    setLoading(true)
    api.demandForecast?.getAccuracySummary(COMPANY_ID).then(setData).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleRecord = async () => {
    setRecording(true)
    await api.demandForecast?.recordAccuracy(COMPANY_ID)
    setRecording(false)
    load()
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{data?.total_records || 0} registros</p>
        <button onClick={handleRecord} disabled={recording}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {recording ? <Spinner /> : <RefreshCcw className="w-4 h-4" />} Actualizar Precisión
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={CheckCircle} label="Precisión" value={data?.accuracy_pct != null ? `${data.accuracy_pct.toFixed(1)}%` : "—"} color="green" />
        <KpiCard icon={BarChart3} label="MAPE" value={data?.mape != null ? `${data.mape.toFixed(1)}%` : "—"} color={data?.mape != null && data.mape < 20 ? "green" : "yellow"} />
        <KpiCard icon={ArrowUpDown} label="MAE" value={data?.mae != null ? Intl.NumberFormat().format(data.mae) : "—"} color="blue" />
        <KpiCard icon={PieChart} label="RMSE" value={data?.rmse != null ? Intl.NumberFormat().format(data.rmse) : "—"} color="purple" />
      </div>

      {data?.by_model?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Precisión por Modelo</h3>
          <div className="space-y-2">
            {data.by_model.map((m: any) => (
              <div key={m.model} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <span className="font-medium text-gray-700 dark:text-gray-300">{m.model}</span>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500">MAPE: {m.mape}%</span>
                  <span className="text-gray-400 text-xs">{m.count} registros</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.trend?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><LineChart className="w-4 h-4" /> Tendencia de Precisión</h3>
          <div className="space-y-2">
            {data.trend.map((t: any) => (
              <div key={t.period} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-700 dark:text-gray-300">{t.period}</span>
                <span className="text-gray-500">MAPE: {t.mape}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== OVERRIDES =====

function OverridesTab() {
  const [overrides, setOverrides] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    product_id: "", forecast_date: "", adjusted_qty: "", reason: "",
  })

  const load = () => {
    setLoading(true)
    api.demandForecast?.listOverrides(COMPANY_ID).then(setOverrides).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    await api.demandForecast?.createOverride({
      product_id: form.product_id,
      forecast_date: form.forecast_date,
      adjusted_qty: parseFloat(form.adjusted_qty),
      reason: form.reason,
    })
    setShowForm(false)
    setForm({ product_id: "", forecast_date: "", adjusted_qty: "", reason: "" })
    load()
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{overrides.length} overrides</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo Override
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Producto ID</label>
              <input value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
              <input type="date" value={form.forecast_date} onChange={e => setForm({ ...form, forecast_date: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cantidad Ajustada</label>
              <input type="number" value={form.adjusted_qty} onChange={e => setForm({ ...form, adjusted_qty: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Motivo</label>
              <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Guardar</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Original</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Ajustado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Motivo</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {overrides.map((o: any) => (
              <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{o.product_id?.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-gray-600">{o.forecast_date}</td>
                <td className="px-4 py-3 text-right">{Intl.NumberFormat().format(o.original_qty)}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-600">{Intl.NumberFormat().format(o.adjusted_qty)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{o.reason}</td>
                <td className="px-4 py-3 text-right text-xs text-gray-400">
                  {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {overrides.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin overrides</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
