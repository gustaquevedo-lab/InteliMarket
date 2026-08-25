import { useEntityLookup, getCustomerName } from "../../hooks/useEntityLookup"
import { useState, useEffect } from "react"
import {
  ShoppingCart, Scan, CreditCard, ShieldCheck, BarChart3, Loader2,
  ShoppingBag, Users, DollarSign, Clock, AlertTriangle, CheckCircle, XCircle,
  Search, RefreshCcw,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"


export default function ScanAndGoPage() {
  useEntityLookup()
  const [custMap, setCustMap] = useState<Record<string, string>>({})
  useEffect(() => {
    api.customers.list({ limit: 500 }).then((res: any) => {
      const list = Array.isArray(res) ? res : res?.data || []
      const map: Record<string, string> = {}
      list.forEach((c: any) => { if (c.id) map[c.id] = c.razon_social || c.nombre || c.ruc })
      setCustMap(map)
    }).catch(() => {})
  }, [])

  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Scan&Go — Autopago</h1>
          <p className="text-sm text-gray-500 mt-1">App mobile para escanear productos y pagar sin pasar por caja</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Dashboard",    icon: BarChart3 },
            { key: "sesiones",  label: "Sesiones",     icon: ShoppingBag },
            { key: "auditorias",label: "Auditorías",   icon: ShieldCheck },
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

      {tab === "dashboard"  && <DashboardTab />}
      {tab === "sesiones"   && <SesionesTab />}
      {tab === "auditorias" && <AuditoriasTab />}
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

  useEffect(() => {
    api.scanandgo.getDashboard(COMPANY_ID).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!data) return <p className="text-center text-gray-500 py-12">Sin datos de Scan&Go.</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={ShoppingBag} label="Sesiones Hoy" value={data.today_sessions} color="blue" />
        <KpiCard icon={ShoppingCart} label="Activas Ahora" value={data.active_sessions} color="green" />
        <KpiCard icon={DollarSign} label="Facturado Hoy" value={`Gs ${(data.today_amount / 1e6).toFixed(1)}M`} color="indigo" />
        <KpiCard icon={Users} label="Adopción" value={`${data.adoption_rate}%`} color="purple" />
        <KpiCard icon={ShieldCheck} label="Auditorías" value={data.total_audits} color="yellow" />
        <KpiCard icon={AlertTriangle} label="Con Diferencias" value={data.audits_with_issues} color="red" />
        <KpiCard icon={Search} label="Tasa Auditoría" value={`${data.audit_rate}%`} color="purple" />
        <KpiCard icon={DollarSign} label="Ticket Promedio" value={`Gs ${data.avg_session_value?.toLocaleString()}`} color="green" />
      </div>

      {data.hourly_breakdown?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Actividad por Hora</h3>
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 24 }, (_, h) => {
              const found = data.hourly_breakdown.find((hb: any) => hb.hour === h)
              const max = Math.max(...data.hourly_breakdown.map((hb: any) => hb.sessions), 1)
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-t"
                    style={{ height: `${((found?.sessions || 0) / max) * 100}%`, minHeight: found?.sessions ? 4 : 0 }}
                  ></div>
                  <span className="text-[10px] text-gray-400">{h}h</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data.recent_sessions?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Sesiones Recientes</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-gray-500">ID</th>
                <th className="px-3 py-2 font-medium text-gray-500">Estado</th>
                <th className="px-3 py-2 font-medium text-gray-500">Items</th>
                <th className="px-3 py-2 font-medium text-gray-500">Total</th>
                <th className="px-3 py-2 font-medium text-gray-500">Inicio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.recent_sessions.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-2 font-mono text-xs">{s.id?.slice(0, 8)}...</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                  </td>
                  <td className="px-3 py-2">{s.total_items}</td>
                  <td className="px-3 py-2 font-bold">Gs {s.total_amount?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-500">{s.started_at ? new Date(s.started_at).toLocaleTimeString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ===== SESIONES =====

function SesionesTab() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.scanandgo.listSessions().then(setSessions).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{sessions.length} sesiones</p>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
          <RefreshCcw className="w-4 h-4" /> Recargar
        </button>
      </div>

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-500">ID</th>
                <th className="px-4 py-2 font-medium text-gray-500">Cliente</th>
                <th className="px-4 py-2 font-medium text-gray-500">Estado</th>
                <th className="px-4 py-2 font-medium text-gray-500">Items</th>
                <th className="px-4 py-2 font-medium text-gray-500">Total</th>
                <th className="px-4 py-2 font-medium text-gray-500">Final</th>
                <th className="px-4 py-2 font-medium text-gray-500">Inicio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sessions.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2 font-mono text-xs">{s.id?.slice(0, 8)}...</td>
                  <td className="px-4 py-2">{getCustomerName(s.customer_id)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === "active" ? "bg-green-100 text-green-700" : s.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-2">{s.total_items}</td>
                  <td className="px-4 py-2">Gs {s.total_amount?.toLocaleString()}</td>
                  <td className="px-4 py-2 font-bold">Gs {s.final_amount?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-500">{s.started_at ? new Date(s.started_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Sin sesiones.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ===== AUDITORÍAS =====

function AuditoriasTab() {
  const [audits, setAudits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.scanandgo.listPendingAudits(50).then(setAudits).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{audits.length} auditorías pendientes</p>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">
          <RefreshCcw className="w-4 h-4" /> Recargar
        </button>
      </div>

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="space-y-4">
          {audits.map((a: any) => (
            <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">Auditoría #{a.id?.slice(0, 8)}</h3>
                  <p className="text-xs text-gray-500">Estado: {a.status} · {a.is_random_audit ? "Aleatoria" : "Manual"}</p>
                </div>
                {a.has_discrepancy ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Discrepancia</span>
                ) : a.status === "resolved" ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Resuelta</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pendiente</span>
                )}
              </div>
              {a.items_to_check && (
                <div className="text-xs text-gray-500 mb-2">Items a verificar: {a.items_to_check.length}</div>
              )}
              {a.discrepancies && a.discrepancies.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-xs">
                  <p className="font-medium text-red-700">Discrepancias encontradas:</p>
                  {a.discrepancies.map((d: any, i: number) => (
                    <p key={i} className="text-red-600">{d.product_name}: esperado {d.expected_qty}, encontrado {d.found_qty}</p>
                  ))}
                </div>
              )}
              {a.resolution && (
                <div className="mt-2 text-xs">
                  <span className="text-gray-500">Resolución: {a.resolution}</span>
                  {a.resolution_note && <span className="text-gray-400 ml-2">— {a.resolution_note}</span>}
                </div>
              )}
            </div>
          ))}
          {audits.length === 0 && (
            <p className="text-center text-gray-500 py-8">Sin auditorías pendientes.</p>
          )}
        </div>
      )}
    </div>
  )
}
