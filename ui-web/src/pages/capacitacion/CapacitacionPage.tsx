import { useState, useEffect } from "react"
import {
  BookOpen, GraduationCap, Users, BarChart3, CheckCircle2, Clock,
  AlertTriangle, FileText, Play, HelpCircle, Award, Loader2, RefreshCcw,
  ChevronRight, Search, Filter, Plus, X, Sparkles, ShieldCheck, CheckCircle
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function CapacitacionPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6">
      {/* ── COMMAND DECK HERO HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/50">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
              <GraduationCap className="w-7 h-7 text-white" />
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-950 rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
                  Capacitación, Onboarding & Certificaciones
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  Campus Extra Supermercado
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300/90 mt-1 max-w-2xl font-normal">
                Inducción de cajeros, manipulación bromatológica INAN/HACCP, calibración de balanzas y certificación de servicio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-slate-800/80 border border-slate-700/60 text-indigo-300 shadow-inner">
              Nivel de Cumplimiento: 94.2%
            </span>
          </div>
        </div>

        {/* Mini KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Cursos Activos</span>
            <span className="text-lg font-black font-mono text-white mt-0.5 block">8 Programas</span>
            <span className="text-[10px] text-indigo-400 font-medium">100% interactivos</span>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Colaboradores</span>
            <span className="text-lg font-black font-mono text-emerald-400 mt-0.5 block">42 Asignados</span>
            <span className="text-[10px] text-emerald-500 font-medium">96% asistencia</span>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Certificados Vigentes</span>
            <span className="text-lg font-black font-mono text-cyan-400 mt-0.5 block">38 Empleados</span>
            <span className="text-[10px] text-cyan-500 font-medium">Con carnet bromatológico</span>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Progreso Promedio</span>
            <span className="text-lg font-black font-mono text-violet-400 mt-0.5 block">87.5%</span>
            <span className="text-[10px] text-violet-500 font-medium">Evaluaciones aprobadas</span>
          </div>
        </div>
      </div>

      {/* ── TABS NAVIGATION ── */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "dashboard", label: "Dashboard Ejecutivo", icon: BarChart3 },
          { key: "courses", label: "Catálogo de Cursos & Módulos", icon: BookOpen },
          { key: "assignments", label: "Asignaciones & Avance", icon: Users },
          { key: "certificates", label: "Certificados & Carnets INAN", icon: Award },
        ].map((t) => {
          const Icon = t.icon
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
                isActive
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 font-black"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "courses" && <CoursesTab />}
      {tab === "assignments" && <AssignmentsTab />}
      {tab === "certificates" && <CertificatesTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "indigo" }: any) {
  const colors: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", ring: "border-blue-500/20" },
    indigo: { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", ring: "border-indigo-500/20" },
    green: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", ring: "border-emerald-500/20" },
    yellow: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", ring: "border-amber-500/20" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", ring: "border-purple-500/20" },
  }
  const theme = colors[color] || colors.indigo

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${theme.bg} ${theme.text} border ${theme.ring} shadow-sm group-hover:scale-105 transition-transform`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">{value ?? "—"}</p>
          {sub && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
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
    api.capacitacion.getDashboard(COMPANY_ID).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  const complianceData = data?.compliance_by_area?.length ? data.compliance_by_area : [
    { area: "Cajas & Punto de Venta", completed: 12, total: 12, pct: 100 },
    { area: "Carnicería & Desposte", completed: 6, total: 6, pct: 100 },
    { area: "Panadería & Rotisería", completed: 5, total: 6, pct: 83 },
    { area: "Verdulería & Frutas", completed: 4, total: 5, pct: 80 },
    { area: "Salón & Reposición", completed: 11, total: 13, pct: 85 },
  ]

  const mostAssigned = data?.most_assigned_courses?.length ? data.most_assigned_courses : [
    { title: "Protocolo de Cobro Ágil & Arqueo Ciego POS", count: 14 },
    { title: "BPM & Manipulación Higiénica INAN (Carnicería/Rotisería)", count: 12 },
    { title: "Calibración de Balanzas Systel & Pesables", count: 10 },
    { title: "Prevención de Roturas, Vencimientos & Mermas", count: 8 },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={BookOpen} label="Cursos Activos" value={data?.total_courses || 8} color="blue" />
        <KpiCard icon={Users} label="Asignaciones Activas" value={data?.total_assignments || 42} color="indigo" />
        <KpiCard icon={GraduationCap} label="Colaboradores Certificados" value={data?.certified_employees || 38} color="green" />
        <KpiCard icon={Clock} label="En Curso / Pendientes" value={data?.pending_employees || 4} sub={`${data?.avg_progress_pct ?? 87.5}% avance`} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Cumplimiento por Sección de Supermercado
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-500">94.2% global</span>
          </div>
          <div className="space-y-4">
            {complianceData.map((a: any, i: number) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-300 capitalize">{a.area}</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{a.completed}/{a.total} ({a.pct}%)</span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      a.pct >= 90 ? "bg-gradient-to-r from-emerald-500 to-teal-400" :
                      a.pct >= 75 ? "bg-gradient-to-r from-indigo-500 to-blue-500" :
                      "bg-gradient-to-r from-amber-500 to-orange-500"
                    }`}
                    style={{ width: `${a.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Cursos Críticos de Operación
            </h3>
            <span className="text-xs font-mono text-slate-400">Asignaciones</span>
          </div>
          <div className="space-y-3">
            {mostAssigned.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold font-mono text-[11px]">
                    {i + 1}
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{c.title}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-black font-mono bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  {c.count} pers.
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Award className="w-4 h-4 text-indigo-500" />
          Certificaciones Emitidas Recientemente
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-3.5">Colaborador</th>
                <th className="p-3.5">Programa / Curso</th>
                <th className="p-3.5 text-center">Calificación</th>
                <th className="p-3.5">Fecha Emisión</th>
                <th className="p-3.5">Vencimiento</th>
                <th className="p-3.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {[
                { name: "NILDA AQUINO", curso: "Protocolo de Cobro Ágil & Arqueo Ciego POS", score: 98, date: "2026-08-15", exp: "2027-08-15", valid: true },
                { name: "LILIANA CRISTALDO", curso: "BPM & Manipulación Higiénica INAN", score: 95, date: "2026-08-10", exp: "2027-08-10", valid: true },
                { name: "EVELIN HERRERO", curso: "Calibración de Balanzas Systel & Pesables", score: 96, date: "2026-08-05", exp: "2027-08-05", valid: true },
                { name: "JESSICA FERRARI", curso: "Facturación Electrónica SIFEN en Terminales", score: 94, date: "2026-08-01", exp: "2027-08-01", valid: true },
              ].map((c, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                  <td className="p-3.5 font-bold text-slate-900 dark:text-white">{c.name}</td>
                  <td className="p-3.5 text-slate-600 dark:text-slate-300 font-medium">{c.curso}</td>
                  <td className="p-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{c.score} pts</td>
                  <td className="p-3.5 text-slate-500 font-mono">{c.date}</td>
                  <td className="p-3.5 text-slate-500 font-mono">{c.exp}</td>
                  <td className="p-3.5 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      VIGENTE
                    </span>
                  </td>
                </tr>
              ))}
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

  const defaultCourses = [
    {
      id: "c-01",
      title: "Protocolo de Cobro Ágil & Arqueo Ciego POS",
      description: "Operación de cajas rápidas, manejo de billetes falsos, POS Bancard/Dinelco y conciliación de turno.",
      is_mandatory: true,
      category: "Cajas",
      area: "salon",
      position: "Cajera",
      estimated_minutes: 90,
      module_count: 5,
    },
    {
      id: "c-02",
      title: "BPM & Manipulación Higiénica INAN / HACCP",
      description: "Higiene y sanitización para carnicería, rotisería y fiambrería. Control de temperatura en cámaras frías.",
      is_mandatory: true,
      category: "Bromatología",
      area: "frescos",
      position: "Carnicero / Rotisero",
      estimated_minutes: 120,
      module_count: 6,
    },
    {
      id: "c-03",
      title: "Calibración de Balanzas Systel & Lectura de Códigos 20",
      description: "Fijación de tara, cero y etiquetado con prefijo 20 (peso incrustado) para scanner de cajas.",
      is_mandatory: false,
      category: "Pesables",
      area: "verduleria",
      position: "Pesador",
      estimated_minutes: 45,
      module_count: 3,
    },
    {
      id: "c-04",
      title: "Facturación Electrónica SIFEN & Anulaciones",
      description: "Generación de KuDE, consulta de CDC y protocolo de contingencia offline ante caídas de la DNIT.",
      is_mandatory: true,
      category: "Fiscal",
      area: "administracion",
      position: "Supervisor",
      estimated_minutes: 60,
      module_count: 4,
    },
    {
      id: "c-05",
      title: "Prevención de Pérdidas, Fardos & Control de Mermas",
      description: "Detección de productos dañados, fardos desarmados y rotación FEFO/FIFO en góndola.",
      is_mandatory: false,
      category: "Logística",
      area: "deposito",
      position: "Repositor",
      estimated_minutes: 45,
      module_count: 3,
    },
    {
      id: "c-06",
      title: "Atención al Cliente Extra & Resolución de Conflictos",
      description: "Pautas de excelencia en servicio, manejo de reclamos, cambios y devoluciones en mostrador.",
      is_mandatory: false,
      category: "Servicio",
      area: "salon",
      position: "Atención al Cliente",
      estimated_minutes: 50,
      module_count: 3,
    }
  ]

  const displayCourses = courses.length > 0 ? courses : defaultCourses

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {displayCourses.map((c: any) => (
        <div key={c.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl hover:border-indigo-500/40 hover:shadow-2xl transition flex flex-col justify-between group">
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition leading-snug">
                {c.title}
              </h3>
              {c.is_mandatory && (
                <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-black flex-shrink-0">
                  OBLIGATORIO
                </span>
              )}
            </div>
            {c.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-3 leading-relaxed">
                {c.description}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {c.category && (
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-lg">
                  {c.category}
                </span>
              )}
              {c.area && (
                <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-lg capitalize">
                  {c.area}
                </span>
              )}
              {c.position && (
                <span className="text-[10px] font-bold bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-800 px-2.5 py-0.5 rounded-lg capitalize">
                  {c.position}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-100 dark:border-slate-800 font-mono">
            <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              {c.estimated_minutes} min
            </span>
            <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              {c.module_count || 0} módulos
            </span>
          </div>
        </div>
      ))}
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
      assigned: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-700",
      in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700",
      completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700",
      expired: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700",
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${styles[status] || "bg-slate-100 text-slate-600"}`}>
        {status.replace("_", " ")}
      </span>
    )
  }

  const defaultAssignments = [
    { employee_name: "NILDA AQUINO", course_title: "Protocolo de Cobro Ágil & Arqueo Ciego POS", status: "completed", progress_pct: 100, assigned_at: "2026-08-01", due_date: "2026-08-15" },
    { employee_name: "LILIANA CRISTALDO", course_title: "BPM & Manipulación Higiénica INAN", status: "completed", progress_pct: 100, assigned_at: "2026-08-01", due_date: "2026-08-15" },
    { employee_name: "EVELIN HERRERO", course_title: "Calibración de Balanzas Systel & Pesables", status: "completed", progress_pct: 100, assigned_at: "2026-08-01", due_date: "2026-08-15" },
    { employee_name: "JESSICA FERRARI", course_title: "Facturación Electrónica SIFEN en Terminales", status: "in_progress", progress_pct: 75, assigned_at: "2026-08-10", due_date: "2026-08-30" },
    { employee_name: "MARISTELA IBARRA", course_title: "Prevención de Roturas & Mermas", status: "in_progress", progress_pct: 60, assigned_at: "2026-08-10", due_date: "2026-08-30" },
    { employee_name: "ROCIO INSAURRALDE", course_title: "Atención al Cliente Extra", status: "assigned", progress_pct: 20, assigned_at: "2026-08-15", due_date: "2026-08-31" },
  ]

  const displayList = assignments.length > 0 ? assignments : defaultAssignments

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-black tracking-wider">
            <tr>
              <th className="p-3.5">Colaborador</th>
              <th className="p-3.5">Curso / Taller</th>
              <th className="p-3.5 text-center">Estado</th>
              <th className="p-3.5">Progreso</th>
              <th className="p-3.5">Fecha Asignación</th>
              <th className="p-3.5">Fecha Límite</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {displayList.map((a: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                <td className="p-3.5 font-bold text-slate-900 dark:text-white">{a.employee_name}</td>
                <td className="p-3.5 text-slate-600 dark:text-slate-300 font-medium">{a.course_title}</td>
                <td className="p-3.5 text-center"><StatusBadge status={a.status} /></td>
                <td className="p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-20 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{ width: `${a.progress_pct}%` }} />
                    </div>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">{a.progress_pct}%</span>
                  </div>
                </td>
                <td className="p-3.5 text-slate-500 font-mono">{a.assigned_at?.slice(0, 10)}</td>
                <td className="p-3.5 text-slate-500 font-mono">{a.due_date || "—"}</td>
              </tr>
            ))}
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

  const defaultCerts = [
    { employee_name: "NILDA AQUINO", course_title: "Protocolo de Cobro Ágil & Arqueo Ciego POS", score: 98, issued_at: "2026-08-15", expires_at: "2027-08-15", is_valid: true, recertified_at: "2026-08-15" },
    { employee_name: "LILIANA CRISTALDO", course_title: "BPM & Manipulación Higiénica INAN", score: 95, issued_at: "2026-08-10", expires_at: "2027-08-10", is_valid: true, recertified_at: null },
    { employee_name: "EVELIN HERRERO", course_title: "Calibración de Balanzas Systel & Pesables", score: 96, issued_at: "2026-08-05", expires_at: "2027-08-05", is_valid: true, recertified_at: null },
    { employee_name: "JESSICA FERRARI", course_title: "Facturación Electrónica SIFEN en Terminales", score: 94, issued_at: "2026-08-01", expires_at: "2027-08-01", is_valid: true, recertified_at: null },
  ]

  const displayCerts = certs.length > 0 ? certs : defaultCerts

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-black tracking-wider">
            <tr>
              <th className="p-3.5">Colaborador</th>
              <th className="p-3.5">Curso / Especialidad</th>
              <th className="p-3.5 text-center">Nota</th>
              <th className="p-3.5">Emitido</th>
              <th className="p-3.5">Vencimiento</th>
              <th className="p-3.5 text-center">Estado</th>
              <th className="p-3.5">Recertificado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {displayCerts.map((c: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                <td className="p-3.5 font-bold text-slate-900 dark:text-white">{c.employee_name}</td>
                <td className="p-3.5 text-slate-600 dark:text-slate-300 font-medium">{c.course_title || "—"}</td>
                <td className="p-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{c.score ?? "—"} pts</td>
                <td className="p-3.5 text-slate-500 font-mono">{c.issued_at?.slice(0, 10)}</td>
                <td className="p-3.5 text-slate-500 font-mono">{c.expires_at || "—"}</td>
                <td className="p-3.5 text-center">
                  {c.is_valid ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      VÁLIDO
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                      VENCIDO
                    </span>
                  )}
                </td>
                <td className="p-3.5 text-slate-500 font-mono">{c.recertified_at?.slice(0, 10) || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
