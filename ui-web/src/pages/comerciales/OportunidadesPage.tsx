import { useState, useEffect } from "react"
import {
  BarChart3, TrendingUp, AlertTriangle, ShoppingCart, Target, DollarSign, Plus, Search, Loader2,
  Users, Package, Zap, CheckCircle, XCircle, Clock, BrainCircuit, Lightbulb, Star,
  RefreshCcw, ShoppingBag, CreditCard, ArrowUpRight,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function OportunidadesPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Oportunidades Comerciales</h1>
          <p className="text-sm text-gray-500 mt-1">Churn detection, cross-selling, up-selling, productos dormantes, potencial crédito</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",    label: "Dashboard",      icon: BarChart3 },
            { key: "oportunidades", label: "Oportunidades",  icon: Lightbulb },
            { key: "detectar",     label: "Detectar",        icon: BrainCircuit },
            { key: "afinidad",     label: "Af. Productos",   icon: ShoppingBag },
            { key: "churn",        label: "Churn",           icon: AlertTriangle },
            { key: "recomendaciones", label: "Recomendaciones", icon: Star },
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

      {tab === "dashboard"      && <DashboardTab />}
      {tab === "oportunidades"  && <OportunidadesListTab />}
      {tab === "detectar"       && <DetectarTab />}
      {tab === "afinidad"       && <AfinidadTab />}
      {tab === "churn"          && <ChurnTab />}
      {tab === "recomendaciones" && <RecomendacionesTab />}
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

function PriorityBadge({ p }: { p: string }) {
  const colors: Record<string, string> = {
    high: "bg-red-100 text-red-700", medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700", critical: "bg-red-100 text-red-700",
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[p] || colors.medium}`}>{p}</span>
}

function StatusBadge({ s }: { s: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700", contacted: "bg-blue-100 text-blue-700",
    converted: "bg-green-100 text-green-700", dismissed: "bg-gray-100 text-gray-700",
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || colors.pending}`}>{s}</span>
}

function TypeIcon({ t }: { t: string }) {
  switch (t) {
    case "churn": return <AlertTriangle className="w-4 h-4 text-red-500" />
    case "dormant_product": return <Package className="w-4 h-4 text-orange-500" />
    case "cross_sell": return <ShoppingCart className="w-4 h-4 text-blue-500" />
    case "credit_potential": return <CreditCard className="w-4 h-4 text-green-500" />
    case "up_sell": return <ArrowUpRight className="w-4 h-4 text-purple-500" />
    default: return <Lightbulb className="w-4 h-4" />
  }
}

// ===== DASHBOARD =====

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.oportunidades.getDashboard(COMPANY_ID).then(d => {
      const s = d.summary || d
      setData(s)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!data || !data.opportunities_found) return (
    <div className="text-center py-12 text-gray-500">
      <p>Sin oportunidades aún. Ejecutá una detección en la pestaña "Detectar".</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Lightbulb} label="Oportunidades" value={data.opportunities_found} color="blue" />
        <KpiCard icon={AlertTriangle} label="Churn Detectado" value={data.churn_detected} color="red" />
        <KpiCard icon={ShoppingCart} label="Cross-Selling" value={data.cross_sell_suggestions} color="indigo" />
        <KpiCard icon={ArrowUpRight} label="Up-Selling" value={data.up_sell_found} color="purple" />
        <KpiCard icon={Package} label="Prod. Dormantes" value={data.dormant_products_found} color="orange" />
        <KpiCard icon={CreditCard} label="Potencial Crédito" value={data.credit_potential_found} color="green" />
      </div>
    </div>
  )
}

// ===== OPORTUNIDADES LIST =====

function OportunidadesListTab() {
  const [opps, setOpps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  const load = () => {
    setLoading(true)
    api.oportunidades.list(COMPANY_ID, filterType, filterStatus).then(setOpps).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterType, filterStatus])

  const updateStatus = async (id: string, status: string) => {
    try { await api.oportunidades.update(COMPANY_ID, id, status); load() }
    catch (e: any) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex gap-3 items-center">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
            <option value="">Todos los tipos</option>
            <option value="churn">Churn</option><option value="dormant_product">Prod. Dormante</option>
            <option value="cross_sell">Cross-sell</option><option value="credit_potential">Pot. Crédito</option>
            <option value="up_sell">Up-sell</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
            <option value="">Todos los estados</option>
            <option value="pending">Pending</option><option value="contacted">Contacted</option>
            <option value="converted">Converted</option><option value="dismissed">Dismissed</option>
          </select>
          <button onClick={load} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><RefreshCcw className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : opps.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin oportunidades. Detectá primero.</p>
        : <div className="space-y-2">
            {opps.map((o: any) => (
              <div key={o.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1"><TypeIcon t={o.opportunity_type} /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{o.title}</span>
                        <PriorityBadge p={o.priority} />
                        <StatusBadge s={o.status} />
                      </div>
                      {o.description && <p className="text-xs text-gray-500 mt-1">{o.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>Score: {o.score}</span>
                        {o.suggested_discount_pct && <span>Dto: {o.suggested_discount_pct}%</span>}
                        {o.suggested_action && <span>Acción: {o.suggested_action}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {o.status === "pending" && (
                      <>
                        <button onClick={() => updateStatus(o.id, "contacted")} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">Contactar</button>
                        <button onClick={() => updateStatus(o.id, "converted")} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">Convertir</button>
                        <button onClick={() => updateStatus(o.id, "dismissed")} className="px-3 py-1.5 bg-gray-400 text-white rounded-lg text-xs font-medium hover:bg-gray-500">Descartar</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ===== DETECTAR =====

function DetectarTab() {
  const [loading, setLoading] = useState("")
  const [results, setResults] = useState<any>(null)
  const [affinityResult, setAffinityResult] = useState<any>(null)

  const detect = async (type: string, label: string) => {
    setLoading(type)
    try {
      const r = type === "all" ? await api.oportunidades.detectAll(COMPANY_ID)
        : await api.oportunidades.detect(COMPANY_ID, type)
      if (type === "all") setResults(r)
      else setResults(r)
    } catch (e: any) { alert(e.message) }
    setLoading("")
  }

  const computeAffinity = async () => {
    setLoading("affinity")
    try {
      const r = await api.oportunidades.computeAffinity(COMPANY_ID)
      setAffinityResult(r)
    } catch (e: any) { alert(e.message) }
    setLoading("")
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Detectar Oportunidades</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { key: "all", label: "Detectar Todo", icon: Zap, color: "bg-purple-600" },
            { key: "churn", label: "Churn", icon: AlertTriangle, color: "bg-red-600" },
            { key: "dormant", label: "Prod. Dormantes", icon: Package, color: "bg-orange-600" },
            { key: "cross-sell", label: "Cross-Selling", icon: ShoppingCart, color: "bg-blue-600" },
            { key: "credit-potential", label: "Pot. Crédito", icon: CreditCard, color: "bg-green-600" },
            { key: "up-sell", label: "Up-Selling", icon: ArrowUpRight, color: "bg-purple-600" },
          ].map((b) => (
            <button key={b.key} onClick={() => detect(b.key, b.label)} disabled={loading !== ""}
              className={`flex items-center justify-center gap-2 px-4 py-3 ${b.color} text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50`}>
              {loading === b.key ? <Spinner /> : <b.icon className="w-4 h-4" />} {b.label}
            </button>
          ))}
        </div>
      </div>

      {results && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 p-4">
          <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Resultados</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: "Total", value: results.total || results.length },
              { label: "Churn", value: results.churn ?? 0 },
              { label: "Dormantes", value: results.dormant_products ?? 0 },
              { label: "Cross-Sell", value: results.cross_sell ?? 0 },
              { label: "Pot. Crédito", value: results.credit_potential ?? 0 },
              { label: "Up-Sell", value: results.up_sell ?? 0 },
            ].map((c) => (
              <div key={c.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-xl font-bold">{c.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 p-4">
        <h3 className="text-sm font-semibold text-indigo-700 mb-3">Calcular Afinidad de Productos</h3>
        <p className="text-xs text-gray-500 mb-3">Analiza todas las ventas de los últimos 6 meses para encontrar productos que se compran juntos (market basket analysis).</p>
        <button onClick={computeAffinity} disabled={loading !== ""}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {loading === "affinity" ? <Spinner /> : <BrainCircuit className="w-4 h-4" />} Calcular Afinidad
        </button>
        {affinityResult && (
          <div className="mt-3 p-3 bg-indigo-50 rounded-lg text-sm">
            ✅ {affinityResult.affinity_rules_computed} reglas de afinidad calculadas sobre {affinityResult.total_transactions} transacciones
          </div>
        )}
      </div>
    </div>
  )
}

// ===== AFINIDAD =====

function AfinidadTab() {
  const [productId, setProductId] = useState("")
  const [affinity, setAffinity] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const search = async () => {
    if (!productId) return
    setLoading(true)
    try {
      const r = await api.oportunidades.getAffinity(COMPANY_ID, productId)
      setAffinity(r)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex gap-3">
          <input value={productId} onChange={e => setProductId(e.target.value)} placeholder="Product ID"
            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          <button onClick={search} disabled={loading || !productId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? <Spinner /> : "Buscar"}
          </button>
        </div>
      </div>

      {affinity.length > 0 ? (
        <div className="space-y-2">
          {affinity.map((a, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{a.product_name || a.product_id}</p>
                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                  <span>Confianza: {(a.confidence * 100).toFixed(0)}%</span>
                  <span>Lift: {a.lift.toFixed(2)}</span>
                  <span>Veces juntos: {a.times_bought_together}</span>
                </div>
              </div>
              <div className="w-24 bg-gray-100 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${a.confidence * 100}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 py-8">Buscá afinidad de un producto para ver resultados</p>
      )}
    </div>
  )
}

// ===== CHURN =====

function ChurnTab() {
  const [analysis, setAnalysis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.oportunidades.list(COMPANY_ID, "churn").then(setAnalysis).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div>
      {analysis.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin análisis de churn. Ejecutá detección primero.</p>
        : <div className="space-y-2">
            {analysis.map((a: any) => (
              <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold
                      ${a.score >= 80 ? "bg-red-100 text-red-700" : a.score >= 60 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {a.score}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-gray-500">{a.description}</p>
                    </div>
                  </div>
                  <PriorityBadge p={a.priority} />
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ===== RECOMENDACIONES =====

function RecomendacionesTab() {
  const [recs, setRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.oportunidades.list(COMPANY_ID).then(all => {
      const r = all.filter((o: any) => ["cross_sell", "up_sell", "dormant_product"].includes(o.opportunity_type))
      setRecs(r)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : recs.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin recomendaciones aún. Ejecutá detección.</p>
        : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recs.map((r: any) => (
              <div key={r.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50"><Star className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <PriorityBadge p={r.priority} /> <StatusBadge s={r.status} />
                      {r.suggested_discount_pct && <span className="text-xs text-green-600">Dto: {r.suggested_discount_pct}%</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}
