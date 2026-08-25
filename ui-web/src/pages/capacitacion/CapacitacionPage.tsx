import { useState, useEffect } from "react"
import {
  BookOpen, GraduationCap, Users, BarChart3, CheckCircle, Clock,
  AlertTriangle, FileText, Play, HelpCircle, Award, Loader2, RefreshCcw,
  ChevronRight, Search, Filter, Plus, X,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function CapacitacionPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Capacitación & Onboarding</h1>
          <p className="text-sm text-gray-500 mt-1">Cursos precargados, asignación por puesto, progreso, certificaciones y recertificación</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Dashboard", icon: BarChart3 },
            { key: "courses", label: "Cursos", icon: BookOpen },
            { key: "assignments", label: "Asignaciones", icon: Users },
            { key: "certificates", label: "Certificados", icon: Award },
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
      {tab === "courses" && <CoursesTab />}
      {tab === "assignments" && <AssignmentsTab />}
      {tab === "certificates" && <CertificatesTab />}
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

function ContentIcon({ type }: { type: string }) {
  if (type === "video") return <Play className="w-3.5 h-3.5 text-blue-500" />
  if (type === "quiz") return <HelpCircle className="w-3.5 h-3.5 text-orange-500" />
  return <FileText className="w-3.5 h-3.5 text-gray-500" />
}

// ===== DASHBOARD =====

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.capacitacion.getDashboard(COMPANY_ID).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={BookOpen} label="Cursos Activos" value={data?.total_courses} color="blue" />
        <KpiCard icon={Users} label="Asignaciones" value={data?.total_assignments} color="indigo" />
        <KpiCard icon={GraduationCap} label="Empleados Certificados" value={data?.certified_employees} color="green" />
        <KpiCard icon={Clock} label="Pendientes" value={data?.pending_employees} sub={`${data?.avg_progress_pct ?? 0}% progreso prom.`} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cumplimiento por Área</h3>
          <div className="space-y-3">
            {(data?.compliance_by_area ?? []).map((a: any, i: number) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 dark:text-gray-400 capitalize">{a.area}</span>
                  <span className="font-medium">{a.completed}/{a.total} ({a.pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${a.pct}%` }} />
                </div>
              </div>
            ))}
            {(!data?.compliance_by_area || data.compliance_by_area.length === 0) && (
              <p className="text-xs text-gray-400">Sin datos por área</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cursos Más Asignados</h3>
          <div className="space-y-2">
            {(data?.most_assigned_courses ?? []).map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs py-1">
                <span className="text-gray-700 dark:text-gray-300">{c.title}</span>
                <span className="font-bold text-blue-600">{c.count} asign.</span>
              </div>
            ))}
            {(!data?.most_assigned_courses || data.most_assigned_courses.length === 0) && (
              <p className="text-xs text-gray-400">Sin asignaciones</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Certificaciones Recientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                <th className="pb-2 pr-2">Empleado</th>
                <th className="pb-2 pr-2">Curso</th>
                <th className="pb-2 pr-2">Nota</th>
                <th className="pb-2 pr-2">Emitido</th>
                <th className="pb-2 pr-2">Vence</th>
                <th className="pb-2">Válido</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_certificates ?? []).map((c: any, i: number) => (
                <tr key={i} className="border-b dark:border-gray-700/50">
                  <td className="py-2 pr-2 font-medium">{c.employee_name || c.employee_id?.slice(0, 8)}</td>
                  <td className="py-2 pr-2">{c.course_title || "—"}</td>
                  <td className="py-2 pr-2">{c.score ?? "—"}</td>
                  <td className="py-2 pr-2">{c.issued_at?.slice(0, 10)}</td>
                  <td className="py-2 pr-2">{c.expires_at || "—"}</td>
                  <td className="py-2">{c.is_valid ? <CheckCircle className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}</td>
                </tr>
              ))}
              {(!data?.recent_certificates || data.recent_certificates.length === 0) && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-400">Sin certificaciones</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ===== COURSES =====

function CoursesTab() {
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.capacitacion.listCourses(COMPANY_ID).then(setCourses).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {courses.map((c: any) => (
        <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{c.title}</h3>
            {c.is_mandatory && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Obligatorio</span>}
          </div>
          {c.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{c.description}</p>}
          <div className="flex flex-wrap gap-1 mb-3">
            {c.category && <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">{c.category}</span>}
            {c.area && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded capitalize">{c.area}</span>}
            {c.position && <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded capitalize">{c.position}</span>}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.estimated_minutes} min</span>
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{c.module_count || 0} módulos</span>
          </div>
        </div>
      ))}
      {courses.length === 0 && (
        <div className="col-span-full text-center py-12 text-gray-400">No hay cursos disponibles</div>
      )}
    </div>
  )
}

// ===== ASSIGNMENTS =====

function AssignmentsTab() {
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.capacitacion.listAssignments(COMPANY_ID, { limit: 100 }).then(setAssignments).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
      assigned: "bg-blue-100 text-blue-700",
      in_progress: "bg-yellow-100 text-yellow-700",
      completed: "bg-green-100 text-green-700",
      expired: "bg-red-100 text-red-700",
    }
    return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[status] || "bg-gray-100 text-gray-600"}`}>{status.replace("_", " ")}</span>
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-2">Empleado</th>
              <th className="pb-2 pr-2">Curso</th>
              <th className="pb-2 pr-2">Estado</th>
              <th className="pb-2 pr-2">Progreso</th>
              <th className="pb-2 pr-2">Asignado</th>
              <th className="pb-2">Vence</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a: any, i: number) => (
              <tr key={i} className="border-b dark:border-gray-700/50">
                <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{a.employee_name || a.employee_id?.slice(0, 8)}</td>
                <td className="py-2 pr-2">{a.course_title || a.course_id?.slice(0, 8)}</td>
                <td className="py-2 pr-2"><StatusBadge status={a.status} /></td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${a.progress_pct}%` }} />
                    </div>
                    <span className="text-gray-500">{a.progress_pct}%</span>
                  </div>
                </td>
                <td className="py-2 pr-2 text-gray-500">{a.assigned_at?.slice(0, 10)}</td>
                <td className="py-2 text-gray-500">{a.due_date || "—"}</td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-gray-400">Sin asignaciones</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== CERTIFICATES =====

function CertificatesTab() {
  const [certs, setCerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.capacitacion.listCertificates(COMPANY_ID).then(setCerts).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function isExpiring(expiresAt: string | null) {
    if (!expiresAt) return false
    const days = (new Date(expiresAt).getTime() - Date.now()) / 86400000
    return days < 30 && days > 0
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="pb-2 pr-2">Empleado</th>
              <th className="pb-2 pr-2">Curso</th>
              <th className="pb-2 pr-2">Nota</th>
              <th className="pb-2 pr-2">Emitido</th>
              <th className="pb-2 pr-2">Vence</th>
              <th className="pb-2 pr-2">Válido</th>
              <th className="pb-2">Recertificado</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((c: any, i: number) => (
              <tr key={i} className="border-b dark:border-gray-700/50">
                <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{c.employee_name || c.employee_id?.slice(0, 8)}</td>
                <td className="py-2 pr-2">{c.course_title || "—"}</td>
                <td className="py-2 pr-2 font-medium">{c.score ?? "—"}</td>
                <td className="py-2 pr-2 text-gray-500">{c.issued_at?.slice(0, 10)}</td>
                <td className="py-2 pr-2">
                  {c.expires_at ? (
                    <span className={`${isExpiring(c.expires_at) ? "text-orange-500 font-medium" : "text-gray-500"}`}>
                      {c.expires_at} {isExpiring(c.expires_at) && "(próximo a vencer)"}
                    </span>
                  ) : "—"}
                </td>
                <td className="py-2 pr-2">
                  {c.is_valid ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                </td>
                <td className="py-2 text-gray-500">{c.recertified_at?.slice(0, 10) || "—"}</td>
              </tr>
            ))}
            {certs.length === 0 && (
              <tr><td colSpan={7} className="py-4 text-center text-gray-400">Sin certificaciones emitidas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
