import { useState, useEffect } from "react"
import {
  BarChart3, Clock, Users, DollarSign, Calendar, Plus, Search, Filter,
  Loader2, RefreshCcw, AlertTriangle, Gift, CheckCircle, XCircle,
  ShoppingBag, TrendingUp, PieChart, Sun, Moon,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"
const TODAY = new Date().toISOString().slice(0, 10)
const WEEK_AGO = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

export default function SchedulePage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Turnos</h1>
          <p className="text-sm text-gray-500 mt-1">Planilla horaria, reloj fichar, swaps, cálculo de horas extras y costos</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Dashboard", icon: BarChart3 },
            { key: "plans", label: "Plan Semanal", icon: Calendar },
            { key: "templates", label: "Plantillas", icon: Clock },
            { key: "swaps", label: "Swaps", icon: Gift },
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
      {tab === "plans" && <PlansTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "swaps" && <SwapsTab />}
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
    api.schedule.getDashboard(COMPANY_ID, WEEK_AGO, TODAY).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Empleados Planificados" value={data?.total_employees_planned} color="blue" />
        <KpiCard icon={Clock} label="Horas Planificadas" value={`${data?.planned_hours ?? 0}h`} color="indigo" />
        <KpiCard icon={Clock} label="Horas Fichadas" value={`${data?.clocked_hours ?? 0}h`} sub={`${data?.attendance_rate ?? 0}% asistencia`} color="green" />
        <KpiCard icon={DollarSign} label="Costo Total" value={`Gs ${(data?.total_cost ?? 0).toLocaleString()}`} color="purple" />
        <KpiCard icon={TrendingUp} label="Horas Extra" value={`${data?.extra_hours ?? 0}h`} color="yellow" />
        <KpiCard icon={Moon} label="Horas Nocturnas" value={`${data?.night_hours ?? 0}h`} color="purple" />
        <KpiCard icon={Sun} label="Horas Feriadas" value={`${data?.holiday_hours ?? 0}h`} color="red" />
        <KpiCard icon={AlertTriangle} label="Ausentes" value={data?.absent_count ?? 0} sub={`${data?.pending_swaps ?? 0} swaps pendientes`} color="red" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Dotación por Área</h3>
        <div className="space-y-2">
          {(data?.by_area ?? []).map((a: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{a.area}</span>
              <span className="font-medium text-gray-900 dark:text-white">{a.count} empleados</span>
            </div>
          ))}
          {(!data?.by_area || data.by_area.length === 0) && <p className="text-xs text-gray-400">Sin datos</p>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Resumen por Empleado</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                <th className="pb-2 pr-2">Empleado</th>
                <th className="pb-2 pr-2">Área</th>
                <th className="pb-2 pr-2">Total h</th>
                <th className="pb-2 pr-2">Normal</th>
                <th className="pb-2 pr-2">Extra</th>
                <th className="pb-2 pr-2">Nocturna</th>
                <th className="pb-2 pr-2">Feriada</th>
                <th className="pb-2 pr-2">Fichado</th>
                <th className="pb-2 pr-2">Asist. %</th>
                <th className="pb-2">Costo Gs</th>
              </tr>
            </thead>
            <tbody>
              {(data?.employee_summaries ?? []).map((s: any, i: number) => (
                <tr key={i} className="border-b dark:border-gray-700/50">
                  <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{s.employee_name || s.employee_id?.slice(0, 8)}</td>
                  <td className="py-2 pr-2 text-gray-500">{s.area || "—"}</td>
                  <td className="py-2 pr-2">{s.total_hours}</td>
                  <td className="py-2 pr-2">{s.normal_hours}</td>
                  <td className="py-2 pr-2 text-yellow-600">{s.extra_hours}</td>
                  <td className="py-2 pr-2 text-purple-600">{s.night_hours}</td>
                  <td className="py-2 pr-2 text-red-600">{s.holiday_hours}</td>
                  <td className="py-2 pr-2">{s.clocked_hours}</td>
                  <td className="py-2 pr-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      (s.attendance_pct ?? 0) >= 80 ? "bg-green-100 text-green-700" :
                      (s.attendance_pct ?? 0) >= 50 ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {s.attendance_pct}%
                    </span>
                  </td>
                  <td className="py-2">{(s.total_cost ?? 0).toLocaleString()}</td>
                </tr>
              ))}
              {(!data?.employee_summaries || data.employee_summaries.length === 0) && (
                <tr><td colSpan={10} className="py-4 text-center text-gray-400">Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===== PLAN SEMANAL =====

function PlansTab() {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.schedule.listPlans(COMPANY_ID, { limit: 100 }).then(setPlans).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Planificación de Turnos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                <th className="pb-2 pr-2">Empleado</th>
                <th className="pb-2 pr-2">Área</th>
                <th className="pb-2 pr-2">Fecha</th>
                <th className="pb-2 pr-2">Inicio</th>
                <th className="pb-2 pr-2">Fin</th>
                <th className="pb-2 pr-2">Estado</th>
                <th className="pb-2">Conflicto</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p: any, i: number) => (
                <tr key={i} className="border-b dark:border-gray-700/50">
                  <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{p.employee_name || p.employee_id?.slice(0, 8)}</td>
                  <td className="py-2 pr-2 text-gray-500">{p.area}</td>
                  <td className="py-2 pr-2">{p.fecha}</td>
                  <td className="py-2 pr-2">{p.hora_inicio}</td>
                  <td className="py-2 pr-2">{p.hora_fin}</td>
                  <td className="py-2 pr-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      p.status === "planned" ? "bg-blue-100 text-blue-700" :
                      p.status === "confirmed" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{p.status}</span>
                  </td>
                  <td className="py-2">
                    {p.conflict_detected ? (
                      <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{p.conflict_detail || "Conflicto"}</span>
                    ) : <span className="text-green-500">—</span>}
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-gray-400">Sin turnos planificados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===== PLANTILLAS =====

function TemplatesTab() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.schedule.listTemplates(COMPANY_ID).then(setTemplates).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Plantillas de Turno</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                <th className="pb-2 pr-2">Nombre</th>
                <th className="pb-2 pr-2">Área</th>
                <th className="pb-2 pr-2">Rol</th>
                <th className="pb-2 pr-2">Inicio</th>
                <th className="pb-2 pr-2">Fin</th>
                <th className="pb-2 pr-2">Cant.</th>
                <th className="pb-2 pr-2">Nocturno</th>
                <th className="pb-2">Activo</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t: any, i: number) => (
                <tr key={i} className="border-b dark:border-gray-700/50">
                  <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{t.nombre}</td>
                  <td className="py-2 pr-2 text-gray-500">{t.area}</td>
                  <td className="py-2 pr-2">{t.rol || "—"}</td>
                  <td className="py-2 pr-2">{t.hora_inicio}</td>
                  <td className="py-2 pr-2">{t.hora_fin}</td>
                  <td className="py-2 pr-2">{t.quantity_required}</td>
                  <td className="py-2 pr-2">{t.is_night_shift ? "🌙" : "—"}</td>
                  <td className="py-2">{t.activo ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}</td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={8} className="py-4 text-center text-gray-400">Sin plantillas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===== SWAPS =====

function SwapsTab() {
  const [swaps, setSwaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.schedule.listSwaps(COMPANY_ID).then(setSwaps).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Solicitudes de Intercambio (Swaps)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                <th className="pb-2 pr-2">Solicitante</th>
                <th className="pb-2 pr-2">Receptor</th>
                <th className="pb-2 pr-2">Razón</th>
                <th className="pb-2 pr-2">Estado</th>
                <th className="pb-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {swaps.map((s: any, i: number) => (
                <tr key={i} className="border-b dark:border-gray-700/50">
                  <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{s.requester_id?.slice(0, 8)}</td>
                  <td className="py-2 pr-2 text-gray-900 dark:text-white">{s.receiver_id?.slice(0, 8)}</td>
                  <td className="py-2 pr-2 text-gray-500">{s.reason || "—"}</td>
                  <td className="py-2 pr-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      s.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                      s.status === "approved" ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-700"
                    }`}>{s.status}</span>
                  </td>
                  <td className="py-2 text-gray-500">{s.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
              {swaps.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-400">Sin solicitudes de swap</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
