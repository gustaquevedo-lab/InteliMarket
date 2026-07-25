import { useState, useEffect } from "react"
import {
  BarChart3, TrendingUp, AlertTriangle, Shield, History, Plus, Search, Loader2,
  Users, DollarSign, Zap, CheckCircle, XCircle, Lock, Unlock, FileSpreadsheet,
  RefreshCcw, BrainCircuit, Gauge, Target, ShieldAlert, Ban,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function CreditScoringPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scoring de Crédito Automático</h1>
          <p className="text-sm text-gray-500 mt-1">Evaluación ML, límites sugeridos, alertas de riesgo, bloqueo automático</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",  label: "Dashboard",    icon: BarChart3 },
            { key: "scores",     label: "Scores",        icon: Gauge },
            { key: "evaluar",    label: "Evaluar",       icon: BrainCircuit },
            { key: "alertas",    label: "Alertas",       icon: ShieldAlert },
            { key: "eventos",    label: "Historial",     icon: History },
            { key: "bloqueos",   label: "Bloqueos",      icon: Ban },
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
      {tab === "scores"    && <ScoresTab />}
      {tab === "evaluar"   && <EvaluarTab />}
      {tab === "alertas"   && <AlertasTab />}
      {tab === "eventos"   && <EventosTab />}
      {tab === "bloqueos"  && <BloqueosTab />}
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

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: "bg-green-100 text-green-700", medium: "bg-yellow-100 text-yellow-700",
    high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700",
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[level] || colors.medium}`}>{level}</span>
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-700", warning: "bg-yellow-100 text-yellow-700",
    blocked: "bg-red-100 text-red-700",
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.active}`}>{status}</span>
}

// ===== DASHBOARD =====

function DashboardTab() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.creditScoring.getSummary(COMPANY_ID).then(setSummary).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!summary) return <p className="text-center text-gray-500 py-12">Sin datos. Evaluá clientes primero.</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Clientes Evaluados" value={summary.total_customers} color="blue" />
        <KpiCard icon={Gauge} label="Score Promedio" value={summary.average_score} color="purple" />
        <KpiCard icon={DollarSign} label="Exposición Total" value={`Gs ${(summary.total_exposure / 1e6).toFixed(0)}M`} color="indigo" />
        <KpiCard icon={Shield} label="Límite Sugerido" value={`Gs ${(summary.total_suggested_limit / 1e6).toFixed(0)}M`} color="green" />
        <KpiCard icon={Ban} label="Bloqueados" value={summary.blocked_customers} color="red" />
        <KpiCard icon={AlertTriangle} label="En Alerta" value={summary.warning_customers} color="yellow" />
        <KpiCard icon={ShieldAlert} label="Críticos" value={summary.critical_customers} color="red" />
      </div>

      {summary.risk_distribution && Object.keys(summary.risk_distribution).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Distribución de Riesgo</h3>
          <div className="space-y-2">
            {Object.entries(summary.risk_distribution).map(([level, count]: any) => (
              <div key={level} className="flex items-center gap-2 text-sm">
                <RiskBadge level={level} />
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${level === "low" ? "bg-green-500" : level === "medium" ? "bg-yellow-500" : level === "high" ? "bg-orange-500" : "bg-red-500"}`}
                    style={{ width: `${(count / summary.total_customers) * 100}%` }}></div>
                </div>
                <span className="text-gray-500 text-xs">{count} ({((count / summary.total_customers) * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== SCORES =====

function ScoresTab() {
  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRisk, setFilterRisk] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  const load = () => {
    setLoading(true)
    api.creditScoring.listScores(COMPANY_ID, filterRisk, filterStatus).then(setScores).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterRisk, filterStatus])

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex gap-3 items-center">
          <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
            <option value="">Todos los riesgos</option>
            <option value="low">Low</option><option value="medium">Medium</option>
            <option value="high">High</option><option value="critical">Critical</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
            <option value="">Todos los estados</option>
            <option value="active">Active</option><option value="warning">Warning</option><option value="blocked">Blocked</option>
          </select>
          <button onClick={load} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><RefreshCcw className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : scores.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin scores aún. Evaluá clientes en la pestaña Evaluar.</p>
        : <div className="space-y-2">
            {scores.map((s: any) => (
              <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold 
                    ${s.score >= 800 ? "bg-green-100 text-green-700" : s.score >= 600 ? "bg-yellow-100 text-yellow-700" : s.score >= 400 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                    {s.score}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Cliente {s.customer_id?.slice(0, 8)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <RiskBadge level={s.risk_level} />
                      <StatusBadge status={s.status} />
                      {s.is_auto_blocked && <span className="text-xs text-red-600 flex items-center gap-1"><Lock className="w-3 h-3" /> Bloqueado</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>Límite: Gs {(s.current_credit_limit / 1e6).toFixed(0)}M</p>
                  <p>Usado: Gs {(s.used_credit / 1e6).toFixed(0)}M</p>
                  <p>Pago puntual: {(s.on_time_payment_rate * 100).toFixed(0)}%</p>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ===== EVALUAR =====

function EvaluarTab() {
  const [customerId, setCustomerId] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<any>(null)

  const evaluate = async () => {
    if (!customerId) return
    setLoading(true)
    try {
      const res = await api.creditScoring.evaluate(COMPANY_ID, customerId)
      setResult(res)
    } catch (e: any) { alert(e.message || "Error") }
    setLoading(false)
  }

  const bulkEvaluate = async () => {
    setBulkLoading(true)
    try {
      const res = await api.creditScoring.bulkEvaluate(COMPANY_ID)
      setBulkResult(res)
    } catch (e: any) { alert(e.message || "Error") }
    setBulkLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Evaluar Cliente Individual</h3>
        <div className="flex gap-3">
          <input value={customerId} onChange={e => setCustomerId(e.target.value)}
            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700"
            placeholder="Customer ID (UUID)" />
          <button onClick={evaluate} disabled={loading || !customerId}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
            {loading ? <Spinner /> : <BrainCircuit className="w-4 h-4" />} Evaluar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Evaluación Masiva</h3>
        <p className="text-xs text-gray-500 mb-3">Evaluar todos los clientes activos de la compañía. Genera scores, alertas y bloqueos automáticos.</p>
        <button onClick={bulkEvaluate} disabled={bulkLoading}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {bulkLoading ? <Spinner /> : <Zap className="w-4 h-4" />} Evaluar Todos
        </button>
        {bulkResult && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm">
            ✅ {bulkResult.evaluated} evaluados, {bulkResult.alerts_generated} alertas, {bulkResult.blocked_customers} bloqueados
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-800 p-4">
            <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Resultado</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`rounded-lg p-3 text-center ${result.credit_score.score >= 800 ? "bg-green-50" : result.credit_score.score >= 600 ? "bg-yellow-50" : "bg-red-50"}`}>
                <p className="text-xs text-gray-500">Score</p>
                <p className="text-2xl font-bold">{result.credit_score.score}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Nivel</p>
                <p className="text-xl font-bold capitalize">{result.credit_score.risk_level}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Límite Sugerido</p>
                <p className="text-xl font-bold text-green-700">Gs {(result.credit_score.suggested_credit_limit / 1e6).toFixed(1)}M</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Límite Actual</p>
                <p className="text-xl font-bold">Gs {(result.credit_score.current_credit_limit / 1e6).toFixed(1)}M</p>
              </div>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
              {[
                { label: "Pago Hist.", value: result.credit_score.payment_history_score, max: 300 },
                { label: "Antigüedad", value: result.credit_score.antiquity_score, max: 200 },
                { label: "Frecuencia", value: result.credit_score.frequency_score, max: 150 },
                { label: "Monto Prom.", value: result.credit_score.avg_amount_score, max: 150 },
                { label: "Industria", value: result.credit_score.industry_score, max: 100 },
                { label: "Utilización", value: result.credit_score.credit_utilization_score, max: 100 },
              ].map((c) => (
                <div key={c.label} className="text-center">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-lg font-bold">{c.value}/{c.max}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-xs text-gray-600">
              <p>Pago puntual: {(result.credit_score.on_time_payment_rate * 100).toFixed(0)}%</p>
              <p>Mora prom.: {result.credit_score.average_payment_delay_days} días</p>
              <p>Total mora: {result.credit_score.total_overdue_days} días</p>
              <p>Veces mora: {result.credit_score.times_overdue}</p>
              <p>Compras: {result.credit_score.total_purchases} ({result.credit_score.months_as_customer} meses)</p>
              <p>Status: {result.credit_score.status}{result.credit_score.is_auto_blocked ? " (bloqueado)" : ""}</p>
            </div>

            {result.limit_changed && <p className="mt-3 text-xs text-green-600">✓ Límite actualizado automáticamente</p>}
          </div>

          {result.alerts_generated?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-yellow-200 dark:border-yellow-800 p-4">
              <h3 className="font-semibold text-yellow-700 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Alertas Generadas ({result.alerts_generated.length})</h3>
              {result.alerts_generated.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 border-b last:border-0">
                  <AlertTriangle className={`w-4 h-4 ${a.severity === "critical" ? "text-red-500" : a.severity === "high" ? "text-orange-500" : "text-yellow-500"}`} />
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===== ALERTAS =====

function AlertasTab() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.creditScoring.listAlerts(COMPANY_ID).then(setAlerts).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const resolveAlert = async (id: string) => {
    try { await api.creditScoring.resolveAlert(COMPANY_ID, id); load() }
    catch (e: any) { alert(e.message) }
  }

  const severityColor = (s: string) =>
    s === "critical" ? "text-red-600 bg-red-50" : s === "high" ? "text-orange-600 bg-orange-50" : "text-yellow-600 bg-yellow-50"

  return (
    <div>
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : alerts.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin alertas pendientes</p>
        : <div className="space-y-2">
            {alerts.map((a: any) => (
              <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`w-5 h-5 ${a.severity === "critical" ? "text-red-500" : a.severity === "high" ? "text-orange-500" : "text-yellow-500"}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{a.alert_type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColor(a.severity)}`}>{a.severity}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{a.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Cliente {a.customer_id?.slice(0, 8)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!a.is_read && (
                    <button onClick={() => resolveAlert(a.id)}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                      Resolver
                    </button>
                  )}
                  {a.is_read && <span className="text-xs text-gray-400">Resuelta</span>}
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ===== EVENTOS / HISTORIAL =====

function EventosTab() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.creditScoring.listEvents(COMPANY_ID).then(setEvents).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const eventIcon = (t: string) => {
    switch (t) {
      case "limit_change": return <DollarSign className="w-4 h-4 text-blue-600" />
      case "block": case "auto_block": return <Lock className="w-4 h-4 text-red-600" />
      case "unblock": case "auto_unblock": return <Unlock className="w-4 h-4 text-green-600" />
      default: return <History className="w-4 h-4" />
    }
  }

  return (
    <div>
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : events.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin eventos registrados</p>
        : <div className="space-y-2">
            {events.map((e: any) => (
              <div key={e.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {eventIcon(e.event_type)}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{e.event_type.replace("_", " ")}</p>
                    <p className="text-xs text-gray-500">{e.reason}</p>
                    {e.previous_limit && <p className="text-xs text-gray-400">Gs {(e.previous_limit / 1e6).toFixed(1)}M → Gs {(e.new_limit / 1e6).toFixed(1)}M</p>}
                    {e.previous_score && <p className="text-xs text-gray-400">Score: {e.previous_score} → {e.new_score}</p>}
                  </div>
                </div>
                <span className="text-xs text-gray-400">{e.created_at ? new Date(e.created_at).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ===== BLOQUEOS =====

function BloqueosTab() {
  const [blocked, setBlocked] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState("")
  const [blockReason, setBlockReason] = useState("")
  const [unblockCustomerId, setUnblockCustomerId] = useState("")
  const [unblockReason, setUnblockReason] = useState("")

  const load = () => {
    setLoading(true)
    api.creditScoring.listScores(COMPANY_ID, undefined, "blocked").then(setBlocked).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const doBlock = async () => {
    if (!customerId || !blockReason) return
    try {
      await api.creditScoring.block(COMPANY_ID, customerId, blockReason)
      alert("Cliente bloqueado")
      setCustomerId(""); setBlockReason(""); load()
    } catch (e: any) { alert(e.message) }
  }

  const doUnblock = async () => {
    if (!unblockCustomerId || !unblockReason) return
    try {
      await api.creditScoring.unblock(COMPANY_ID, unblockCustomerId, unblockReason)
      alert("Cliente desbloqueado")
      setUnblockCustomerId(""); setUnblockReason(""); load()
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2"><Lock className="w-4 h-4" /> Bloquear Cliente</h3>
          <div className="space-y-2">
            <input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="Customer ID"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            <input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Motivo del bloqueo"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            <button onClick={doBlock} disabled={!customerId || !blockReason}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              Bloquear
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-green-200 dark:border-green-800 p-4">
          <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2"><Unlock className="w-4 h-4" /> Desbloquear Cliente</h3>
          <div className="space-y-2">
            <input value={unblockCustomerId} onChange={e => setUnblockCustomerId(e.target.value)} placeholder="Customer ID"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            <input value={unblockReason} onChange={e => setUnblockReason(e.target.value)} placeholder="Motivo del desbloqueo"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
            <button onClick={doUnblock} disabled={!unblockCustomerId || !unblockReason}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              Desbloquear
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Clientes Bloqueados ({blocked.length})</h3>
        {loading ? <Spinner /> : blocked.length === 0
          ? <p className="text-xs text-gray-500">No hay clientes bloqueados</p>
          : <div className="space-y-2">
              {blocked.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg text-sm">
                  <span className="font-medium">Cliente {s.customer_id?.slice(0, 8)}</span>
                  <span className="text-red-600">Score: {s.score}</span>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}
