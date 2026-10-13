import { useState, useEffect, type ReactNode } from "react"
import {
  LayoutDashboard, Wrench, CalendarDays, FileText, ClipboardList, FileSignature,
  PackageSearch, Receipt, BarChart3, Users, Clock, AlertTriangle, CheckCircle, XCircle,
  Loader2, Plus, Search, X, ArrowUpDown, RefreshCw, Star, MapPin, Phone, Mail,
  User, ChevronRight, DollarSign, TrendingUp, Percent, Award, Zap, Settings,
  Play, Square, ExternalLink, Timer, Truck, Home, Filter, Calendar,
  Crown, Shield, type LucideIcon,
} from "lucide-react"
import { serviciosApi, type SvcDashboard, type SvcAppointment, type SvcWorkOrder,
  type SvcTechnician, type SvcTechSkill, type SvcCertification, type SvcVertical,
  type SvcSkill, type SvcQuote, type SvcQuoteItem, type SvcContract, type SvcContractVisit,
  type SvcTruckItem, type SvcInvMovement, type SvcInvoice, type SvcInvoicePayment,
  type SvcDispatchRanking, type SvcQuoteRequest, type SvcProperty, type SvcEquipment,
  type SvcReview, type SvcTimer } from "../../api/servicios"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type TabKey = "dashboard" | "tecnicos" | "calendario" | "cotizaciones" | "ordenes" | "contratos" | "inventario" | "facturacion"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard",    label: "Dashboard",     icon: LayoutDashboard },
  { key: "tecnicos",     label: "Tecnicos",      icon: Users },
  { key: "calendario",   label: "Calendario",    icon: CalendarDays },
  { key: "cotizaciones", label: "Cotizaciones",  icon: FileText },
  { key: "ordenes",      label: "Ordenes",       icon: ClipboardList },
  { key: "contratos",    label: "Contratos",     icon: FileSignature },
  { key: "inventario",   label: "Inventario",    icon: PackageSearch },
  { key: "facturacion",  label: "Facturacion",   icon: Receipt },
]

export default function ServiciosPage() {
  const [tab, setTab] = useState<TabKey>("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Servicios Profesionales</h1>
          <p className="text-sm text-gray-500 mt-1">Centro de operaciones para tecnicos, agenda, ordenes, contratos e inventario movil</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard"    && <DashboardTab />}
      {tab === "tecnicos"     && <TecnicosTab />}
      {tab === "calendario"   && <CalendarioTab />}
      {tab === "cotizaciones" && <CotizacionesTab />}
      {tab === "ordenes"      && <OrdenesTab />}
      {tab === "contratos"    && <ContratosTab />}
      {tab === "inventario"   && <InventarioTab />}
      {tab === "facturacion"  && <FacturacionTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: { icon: LucideIcon; label: string; value?: ReactNode; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
    pink: "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400",
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

function Badge({ children, color = "gray" }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200",
    green: "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200",
    red: "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200",
    yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200",
    pink: "bg-pink-100 text-pink-700 dark:bg-pink-800 dark:text-pink-200",
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color] || colors.gray}`}>{children}</span>
}

// ==================== DASHBOARD — "Centro de Mando" ====================
function DashboardTab() {
  const [data, setData] = useState<SvcDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    serviciosApi.getDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!data) return <div className="text-center py-12 text-gray-400">No se pudo cargar el dashboard</div>

  const kpis = data.kpis_principales || {}
  const hoy = data.agenda_hoy || []
  const enProgreso = data.wo_en_progreso || []
  const alertas = data.alertas_certificaciones || []
  const contratosPorVencer = data.contratos_por_vencer || []
  const leadQueue = data.queue_quote_requests || []
  const topTecnicos = data.top_tecnicos || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiCard icon={ClipboardList} label="Ordenes Hoy" value={kpis.ordenes_hoy ?? kpis.wo_hoy ?? "—"} color="blue" />
        <KpiCard icon={Users} label="Tecnicos Activos" value={kpis.tecnicos_activos ?? "—"} color="green" />
        <KpiCard icon={FileText} label="Cotizaciones Pend." value={kpis.cotizaciones_pendientes ?? "—"} color="yellow" />
        <KpiCard icon={DollarSign} label="Ingresos del Mes" value={kpis.ingresos_mes ? formatPYG(kpis.ingresos_mes) : "—"} color="indigo" />
        <KpiCard icon={FileSignature} label="Contratos" value={kpis.contratos_activos ?? "—"} color="purple" />
        <KpiCard icon={Users} label="Leads" value={kpis.leads ?? leadQueue.length} color="pink" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda Hoy */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Agenda de Hoy</h3>
          {hoy.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin visitas agendadas para hoy</p>
          ) : (
            <div className="space-y-0">
              {hoy.map((ap, idx) => (
                <div key={ap.id || idx} className="flex gap-3 py-2.5 border-l-2 border-gray-200 dark:border-gray-600 pl-4 ml-2 relative">
                  <div className="absolute left-0 top-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-white dark:border-gray-800" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{ap.titulo || ap.tipo}</span>
                      <Badge color={ap.estado === "confirmada" ? "green" : ap.estado === "en_camino" ? "blue" : "gray"}>{ap.estado || "agendada"}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <Clock className="w-3 h-3 inline mr-1" />{ap.hora_desde} — {ap.hora_hasta}
                      {ap.technician_nombre && <><span className="mx-1">|</span><User className="w-3 h-3 inline mr-1" />{ap.technician_nombre}</>}
                    </p>
                    {ap.customer_nombre && <p className="text-xs text-gray-500 mt-0.5">{ap.customer_nombre}{ap.direccion ? ` — ${ap.direccion}` : ""}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* En Progreso */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-amber-500" /> En Progreso</h3>
            {enProgreso.length === 0 ? (
              <p className="text-xs text-gray-400">Sin ordenes activas</p>
            ) : (
              <div className="space-y-2">
                {enProgreso.slice(0, 4).map((wo) => (
                  <div key={wo.id} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{wo.titulo || wo.numero}</p>
                      <p className="text-xs text-gray-400">{wo.technician_nombre}</p>
                    </div>
                    <Badge color={wo.prioridad === "urgente" ? "red" : "yellow"}>{wo.prioridad || "normal"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alertas */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Alertas
              {(alertas.length + contratosPorVencer.length + leadQueue.length) > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{alertas.length + contratosPorVencer.length + leadQueue.length}</span>
              )}
            </h3>
            {alertas.slice(0, 3).map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 py-1">
                <Shield className="w-3 h-3 text-red-400 shrink-0" />
                <span className="truncate">{a.nombre || a.technician_nombre} — cert. vence {a.dias_para_vencer != null ? `en ${a.dias_para_vencer}d` : "pronto"}</span>
              </div>
            ))}
            {contratosPorVencer.slice(0, 2).map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 py-1">
                <FileSignature className="w-3 h-3 shrink-0" />
                <span className="truncate">{c.customer_nombre} — contrato x vencer</span>
              </div>
            ))}
            {leadQueue.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 py-1">
                <Users className="w-3 h-3 shrink-0" />
                <span>{leadQueue.length} solicitudes de cotización pendientes</span>
              </div>
            )}
            {alertas.length + contratosPorVencer.length + leadQueue.length === 0 && (
              <p className="text-xs text-gray-400">Sin alertas activas</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== TECNICOS ====================
function TecnicosTab() {
  const [techs, setTechs] = useState<SvcTechnician[]>([])
  const [verticals, setVerticals] = useState<SvcVertical[]>([])
  const [skills, setSkills] = useState<SvcSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [editTech, setEditTech] = useState<SvcTechnician | null>(null)
  const [detailTech, setDetailTech] = useState<SvcTechnician | null>(null)
  const toast = useToast()

  async function load() {
    setLoading(true)
    try {
      const [t, v, s] = await Promise.all([
        serviciosApi.listTechnicians(),
        serviciosApi.listVerticals().catch(() => []),
        serviciosApi.listSkills().catch(() => []),
      ])
      setTechs(t); setVerticals(v); setSkills(s)
    } catch { toast.error("Error", "No se pudieron cargar tecnicos") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = filter ? techs.filter(t => t.nombre?.toLowerCase().includes(filter.toLowerCase()) || t.vertical_codigo?.includes(filter)) : techs

  if (detailTech) return <TechDetail tech={detailTech} verticals={verticals} skills={skills} onBack={() => setDetailTech(null)} onUpdated={load} />

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10 w-full" placeholder="Buscar tecnico..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo</button>
        <button onClick={load} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Users className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">No hay tecnicos</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailTech(t)}>
              <div className="h-16 bg-gradient-to-r from-primary/20 to-primary/5 dark:from-primary/10 dark:to-gray-800 relative">
                <div className="absolute -bottom-8 left-4 w-16 h-16 rounded-full bg-white dark:bg-gray-700 border-2 border-white dark:border-gray-600 flex items-center justify-center shadow-md">
                  <User className="w-7 h-7 text-primary/60" />
                </div>
                <div className="absolute top-2 right-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${t.disponible ? "bg-green-500" : "bg-red-400"}`} title={t.disponible ? "Disponible" : "Ocupado"} />
                </div>
              </div>
              <div className="pt-10 pb-4 px-4">
                <p className="font-semibold text-gray-900 dark:text-white truncate">{t.nombre}</p>
                <p className="text-xs text-gray-400">{t.vertical_codigo || "Sin vertical"} {t.tipo && `— ${t.tipo}`}</p>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`w-3 h-3 ${i <= Math.round(Number(t.rating_promedio || 0)) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />
                  ))}
                  <span className="text-xs text-gray-400 ml-1">({t.total_servicios || 0})</span>
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  <span className="text-xs text-gray-500">{t.modalidad}</span>
                  {t.tarifa_visita_pyg && Number(t.tarifa_visita_pyg) > 0 && (
                    <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 px-1.5 py-0.5 rounded">{formatPYG(Number(t.tarifa_visita_pyg))}/vis</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <TechForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} verticals={verticals} />}
      {editTech && <TechForm tech={editTech} onClose={() => setEditTech(null)} onCreated={() => { setEditTech(null); load() }} verticals={verticals} />}
    </div>
  )
}

function TechDetail({ tech, verticals, skills, onBack, onUpdated }: { tech: SvcTechnician; verticals: SvcVertical[]; skills: SvcSkill[]; onBack: () => void; onUpdated: () => void }) {
  const [subtab, setSubtab] = useState<"info" | "skills" | "certs">("info")
  const [techSkills, setTechSkills] = useState<SvcTechSkill[]>([])
  const [certs, setCerts] = useState<SvcCertification[]>([])
  const [showSkillForm, setShowSkillForm] = useState(false)
  const [showCertForm, setShowCertForm] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (tech.id) {
      serviciosApi.listTechSkills(tech.id).then(setTechSkills).catch(() => {})
      serviciosApi.listCertifications(tech.id).then(setCerts).catch(() => {})
    }
  }, [tech.id])

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-primary font-medium flex items-center gap-1"><ChevronRight className="w-3 h-3 rotate-180" /> Volver a tecnicos</button>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-8 h-8 text-primary" /></div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tech.nombre}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Badge color={tech.activo ? "green" : "gray"}>{tech.activo ? "Activo" : "Inactivo"}</Badge>
              <Badge color={tech.disponible ? "green" : "red"}>{tech.disponible ? "Disponible" : "Ocupado"}</Badge>
              <span>{tech.vertical_codigo}</span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm font-bold text-primary">{formatPYG(Number(tech.tarifa_visita_pyg))}/visita</p>
            <p className="text-xs text-gray-400">{tech.modalidad}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Servicios</p><p className="text-lg font-bold text-blue-600">{tech.total_servicios || 0}</p></div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Clientes</p><p className="text-lg font-bold text-green-600">{tech.total_clientes || 0}</p></div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Rating</p><p className="text-lg font-bold text-purple-600">{Number(tech.rating_promedio || 0).toFixed(1)}</p></div>
        </div>

        <div className="flex gap-2 mb-4">
          {(["info", "skills", "certs"] as const).map((s) => (
            <button key={s} onClick={() => setSubtab(s)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${subtab === s ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>
              {s === "info" ? "Informacion" : s === "skills" ? `Skills (${techSkills.length})` : `Certificaciones (${certs.length})`}
            </button>
          ))}
        </div>

        {subtab === "info" && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Telefono:</span> <span className="font-medium ml-1">{tech.telefono || "—"}</span></div>
            <div><span className="text-gray-500">Email:</span> <span className="font-medium ml-1">{tech.email || "—"}</span></div>
            <div><span className="text-gray-500">CI:</span> <span className="font-medium ml-1">{tech.ci || "—"}</span></div>
            <div><span className="text-gray-500">Tarifa hora:</span> <span className="font-medium ml-1">{formatPYG(Number(tech.tarifa_hora_pyg))}</span></div>
            <div className="col-span-2"><span className="text-gray-500">Zonas:</span> <span className="font-medium ml-1">{(tech.zonas_cobertura || []).join(", ") || "—"}</span></div>
            {tech.biografia && <div className="col-span-2"><span className="text-gray-500">Bio:</span> <p className="text-gray-700 dark:text-gray-300 mt-1">{tech.biografia}</p></div>}
          </div>
        )}

        {subtab === "skills" && (
          <div>
            <div className="flex justify-end mb-2">
              <button onClick={() => setShowSkillForm(true)} className="text-sm text-primary font-medium">+ Agregar skill</button>
            </div>
            {techSkills.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin skills registrados</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {techSkills.map((s) => (
                  <div key={s.id} className="bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                    <span className="font-medium">{s.skill_nombre || s.skill_codigo}</span>
                    <span className="text-xs text-gray-400">Nv.{s.nivel}</span>
                    {s.certificado && <CheckCircle className="w-3 h-3 text-green-500" />}
                  </div>
                ))}
              </div>
            )}
            {showSkillForm && <SkillForm techId={tech.id!} skills={skills} onClose={() => setShowSkillForm(false)} onCreated={() => { setShowSkillForm(false); serviciosApi.listTechSkills(tech.id!).then(setTechSkills).catch(() => {}) }} />}
          </div>
        )}

        {subtab === "certs" && (
          <div>
            <div className="flex justify-end mb-2">
              <button onClick={() => setShowCertForm(true)} className="text-sm text-primary font-medium">+ Agregar certificacion</button>
            </div>
            {certs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin certificaciones</p>
            ) : (
              <div className="space-y-2">
                {certs.map((c) => {
                  const daysLeft = c.dias_para_vencer ?? 999
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{c.nombre}</p>
                        <p className="text-xs text-gray-400">{c.institucion} {c.numero && `— ${c.numero}`}</p>
                      </div>
                      <div className="text-right">
                        {c.fecha_vencimiento && (
                          <Badge color={daysLeft <= 30 ? "red" : daysLeft <= 60 ? "yellow" : "green"}>
                            {daysLeft > 0 ? `${daysLeft}d restantes` : "Vencida"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {showCertForm && <CertForm techId={tech.id!} onClose={() => setShowCertForm(false)} onCreated={() => { setShowCertForm(false); serviciosApi.listCertifications(tech.id!).then(setCerts).catch(() => {}) }} />}
          </div>
        )}
      </div>
    </div>
  )
}

function TechForm({ tech, verticals, onClose, onCreated }: { tech?: SvcTechnician; verticals: SvcVertical[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    nombre: tech?.nombre || "", vertical_codigo: tech?.vertical_codigo || "", ci: tech?.ci || "",
    telefono: tech?.telefono || "", email: tech?.email || "", tipo: tech?.tipo || "interno",
    modalidad: tech?.modalidad || "tiempo_completo", tarifa_hora_pyg: Number(tech?.tarifa_hora_pyg || 0),
    tarifa_visita_pyg: Number(tech?.tarifa_visita_pyg || 0), comision_pct: Number(tech?.comision_pct || 0),
    biografia: tech?.biografia || "", color_calendario: tech?.color_calendario || "#3b82f6",
    zonas_cobertura: (tech?.zonas_cobertura || []).join(", "),
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.nombre) { toast.error("Error", "Nombre requerido"); return }
    setSaving(true)
    try {
      const payload = { ...form, zonas_cobertura: form.zonas_cobertura ? form.zonas_cobertura.split(",").map(s => s.trim()).filter(Boolean) : [] }
      if (tech) {
        await serviciosApi.updateTechnician(tech.id!, payload)
        toast.success("Actualizado", "Tecnico actualizado correctamente")
      } else {
        await serviciosApi.createTechnician(payload)
        toast.success("Creado", "Tecnico creado correctamente")
      }
      onCreated()
    } catch { toast.error("Error", "No se pudo guardar") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tech ? "Editar Tecnico" : "Nuevo Tecnico"}</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="block text-sm font-medium mb-1">Nombre *</label><input className="input-field w-full" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1">Vertical</label>
            <select className="input-field w-full" value={form.vertical_codigo} onChange={(e) => setForm({ ...form, vertical_codigo: e.target.value })}>
              <option value="">Sin vertical</option>
              {verticals.map((v) => <option key={v.codigo} value={v.codigo}>{v.nombre}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium mb-1">Tipo</label>
            <select className="input-field w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="interno">Interno</option><option value="contratista">Contratista</option><option value="freelance">Freelance</option>
            </select></div>
          <div><label className="block text-sm font-medium mb-1">Modalidad</label>
            <select className="input-field w-full" value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value })}>
              <option value="tiempo_completo">Tiempo Completo</option><option value="medio_tiempo">Medio Tiempo</option>
              <option value="por_horas">Por Horas</option><option value="por_visita">Por Visita</option>
            </select></div>
          <div><label className="block text-sm font-medium mb-1">Telefono</label><input className="input-field w-full" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1">Email</label><input className="input-field w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1">CI</label><input className="input-field w-full" value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1">Tarifa Hora</label><input className="input-field w-full" type="number" value={form.tarifa_hora_pyg} onChange={(e) => setForm({ ...form, tarifa_hora_pyg: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="block text-sm font-medium mb-1">Tarifa Visita</label><input className="input-field w-full" type="number" value={form.tarifa_visita_pyg} onChange={(e) => setForm({ ...form, tarifa_visita_pyg: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="block text-sm font-medium mb-1">Comision %</label><input className="input-field w-full" type="number" step="0.1" value={form.comision_pct} onChange={(e) => setForm({ ...form, comision_pct: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="block text-sm font-medium mb-1">Color Calendario</label><input className="input-field w-full" type="color" value={form.color_calendario} onChange={(e) => setForm({ ...form, color_calendario: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-sm font-medium mb-1">Zonas de Cobertura (coma separada)</label><input className="input-field w-full" value={form.zonas_cobertura} onChange={(e) => setForm({ ...form, zonas_cobertura: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-sm font-medium mb-1">Biografia</label><textarea className="input-field w-full" rows={2} value={form.biografia} onChange={(e) => setForm({ ...form, biografia: e.target.value })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : tech ? "Actualizar" : "Crear"}</button>
        </div>
      </div>
    </div>
  )
}

function SkillForm({ techId, skills, onClose, onCreated }: { techId: string; skills: SvcSkill[]; onClose: () => void; onCreated: () => void }) {
  const [skillId, setSkillId] = useState("")
  const [nivel, setNivel] = useState(1)
  const [certificado, setCertificado] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!skillId) return
    setSaving(true)
    try {
      await serviciosApi.addTechSkill(techId, { skill_id: skillId, nivel, certificado })
      toast.success("Skill agregado"); onCreated()
    } catch { toast.error("Error", "No se pudo agregar") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-4">Agregar Skill</h3>
        <select className="input-field w-full mb-3" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
          <option value="">Seleccionar skill</option>
          {skills.map((s) => <option key={s.id} value={s.id}>{s.nombre} ({s.categoria})</option>)}
        </select>
        <div className="flex gap-3 mb-3">
          <div className="flex-1"><label className="block text-xs mb-1">Nivel (1-{skills.find(s => s.id === skillId)?.nivel_maximo || 5})</label>
            <input className="input-field w-full" type="number" min={1} max={10} value={nivel} onChange={(e) => setNivel(parseInt(e.target.value) || 1)} /></div>
          <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={certificado} onChange={(e) => setCertificado(e.target.checked)} className="rounded" />Certificado</label></div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !skillId} className="btn-primary flex-1">{saving ? <Spinner /> : "Agregar"}</button>
        </div>
      </div>
    </div>
  )
}

function CertForm({ techId, onClose, onCreated }: { techId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ tipo: "curso", nombre: "", institucion: "", numero: "", fecha_emision: "", fecha_vencimiento: "", alerta_dias: 30, notas: "" })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.nombre) { toast.error("Error", "Nombre requerido"); return }
    setSaving(true)
    try {
      await serviciosApi.addCertification(techId, form)
      toast.success("Certificacion agregada"); onCreated()
    } catch { toast.error("Error", "No se pudo agregar") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-4">Agregar Certificacion</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs mb-1">Tipo</label>
            <select className="input-field w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="curso">Curso</option><option value="certificacion">Certificacion</option>
              <option value="licencia">Licencia</option><option value="diplomado">Diplomado</option>
            </select></div>
          <div><label className="block text-xs mb-1">Nombre *</label><input className="input-field w-full" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Institucion</label><input className="input-field w-full" value={form.institucion} onChange={(e) => setForm({ ...form, institucion: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Numero</label><input className="input-field w-full" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Emision</label><input className="input-field w-full" type="date" value={form.fecha_emision} onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Vencimiento</label><input className="input-field w-full" type="date" value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Alerta (dias antes)</label><input className="input-field w-full" type="number" value={form.alerta_dias} onChange={(e) => setForm({ ...form, alerta_dias: parseInt(e.target.value) || 30 })} /></div>
          <div className="col-span-2"><label className="block text-xs mb-1">Notas</label><input className="input-field w-full" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Agregar"}</button>
        </div>
      </div>
    </div>
  )
}

// ==================== CALENDARIO ====================
function CalendarioTab() {
  const [appts, setAppts] = useState<SvcAppointment[]>([])
  const [techs, setTechs] = useState<SvcTechnician[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0])
  const [dateTo, setDateTo] = useState("")
  const [techFilter, setTechFilter] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)
  const toast = useToast()

  async function load() {
    setLoading(true)
    try {
      const params: any = { fecha_desde: dateFrom || undefined, fecha_hasta: dateTo || undefined }
      if (techFilter) params.technician_id = techFilter
      const [a, t] = await Promise.all([
        serviciosApi.listAppointments(params),
        serviciosApi.listTechnicians().catch(() => []),
      ])
      setAppts(a); setTechs(t)
    } catch { toast.error("Error", "No se pudo cargar la agenda") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const estadoColors: Record<string, string> = {
    agendada: "bg-gray-100 text-gray-600", confirmada: "bg-blue-100 text-blue-700",
    en_camino: "bg-amber-100 text-amber-700", en_sitio: "bg-indigo-100 text-indigo-700",
    completada: "bg-green-100 text-green-700", cancelada: "bg-red-100 text-red-600",
    no_show: "bg-red-100 text-red-600", reagendada: "bg-purple-100 text-purple-700",
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div><label className="block text-xs text-gray-500 mb-1">Desde</label><input className="input-field" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Hasta</label><input className="input-field" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Tecnico</label>
          <select className="input-field" value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
            <option value="">Todos</option>
            {techs.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select></div>
        <div className="flex items-end gap-2">
          <button onClick={load} className="px-4 py-2 bg-primary text-white rounded-lg text-sm"><Filter className="w-4 h-4 inline mr-1" />Filtrar</button>
          <button onClick={() => setShowDispatch(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"><Zap className="w-4 h-4 inline mr-1" />Dispatch IA</button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"><Plus className="w-4 h-4 inline mr-1" />Agendar</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : appts.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><CalendarDays className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">Sin visitas en este rango</p></div>
      ) : (
        <div className="space-y-2">
          {appts.map((ap) => (
            <div key={ap.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="text-center w-12 shrink-0">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{ap.fecha ? new Date(ap.fecha).getDate() : "--"}</p>
                  <p className="text-xs text-gray-400">{ap.fecha ? new Date(ap.fecha).toLocaleDateString("es-PY", { month: "short" }) : ""}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{ap.titulo || ap.tipo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${estadoColors[ap.estado || ""] || "bg-gray-100"}`}>{ap.estado || "agendada"}</span>
                    {ap.prioridad === "urgente" && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Urgente</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <Clock className="w-3 h-3 inline mr-1" />{ap.hora_desde} — {ap.hora_hasta}
                    {ap.technician_nombre && <><span className="mx-1">|</span><User className="w-3 h-3 inline mr-1" />{ap.technician_nombre}</>}
                    {ap.customer_nombre && <><span className="mx-1">|</span>{ap.customer_nombre}</>}
                  </p>
                  {ap.direccion && <p className="text-xs text-gray-400 mt-0.5"><MapPin className="w-3 h-3 inline mr-1" />{ap.direccion}</p>}
                </div>
                <div className="flex gap-1">
                  {ap.recordatorio_enviado && <Badge color="green">Recordatorio</Badge>}
                  {ap.confirmada && <Badge color="blue">Confirmada</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <AppointmentForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} techs={techs} />}
      {showDispatch && <DispatchPanel onClose={() => setShowDispatch(false)} techs={techs} />}
    </div>
  )
}

function AppointmentForm({ techs, onClose, onCreated }: { techs: SvcTechnician[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    customer_id: "", customer_nombre: "", customer_telefono: "",
    technician_id: "", titulo: "", tipo: "consulta", prioridad: "normal",
    fecha: "", hora_desde: "08:00", hora_hasta: "09:00",
    direccion: "", descripcion: "",
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.customer_nombre || !form.fecha) { toast.error("Error", "Nombre de cliente y fecha requeridos"); return }
    setSaving(true)
    try {
      await serviciosApi.createAppointment(form)
      toast.success("Cita agendada"); onCreated()
    } catch { toast.error("Error", "No se pudo agendar") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-4">Nueva Cita</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="block text-xs mb-1">Cliente *</label><input className="input-field w-full" value={form.customer_nombre} onChange={(e) => setForm({ ...form, customer_nombre: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Telefono</label><input className="input-field w-full" value={form.customer_telefono} onChange={(e) => setForm({ ...form, customer_telefono: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Tecnico</label>
            <select className="input-field w-full" value={form.technician_id} onChange={(e) => setForm({ ...form, technician_id: e.target.value })}>
              <option value="">Sin asignar</option>
              {techs.filter(t => t.activo).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select></div>
          <div><label className="block text-xs mb-1">Tipo</label>
            <select className="input-field w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="consulta">Consulta</option><option value="cotizacion">Cotizacion</option>
              <option value="instalacion">Instalacion</option><option value="reparacion">Reparacion</option>
              <option value="mantenimiento">Mantenimiento</option><option value="emergencia">Emergencia</option>
            </select></div>
          <div><label className="block text-xs mb-1">Prioridad</label>
            <select className="input-field w-full" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
              <option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
            </select></div>
          <div><label className="block text-xs mb-1">Fecha *</label><input className="input-field w-full" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Hora Desde</label><input className="input-field w-full" type="time" value={form.hora_desde} onChange={(e) => setForm({ ...form, hora_desde: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Hora Hasta</label><input className="input-field w-full" type="time" value={form.hora_hasta} onChange={(e) => setForm({ ...form, hora_hasta: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-xs mb-1">Direccion</label><input className="input-field w-full" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-xs mb-1">Titulo / Descripcion</label><input className="input-field w-full" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Agendar"}</button>
        </div>
      </div>
    </div>
  )
}

function DispatchPanel({ techs, onClose }: { techs: SvcTechnician[]; onClose: () => void }) {
  const [lat, setLat] = useState("-25.282")
  const [lng, setLng] = useState("-57.635")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [hora, setHora] = useState("09:00")
  const [skillFilter, setSkillFilter] = useState("")
  const [ranking, setRanking] = useState<SvcDispatchRanking[]>([])
  const [loading, setLoading] = useState(false)

  async function handleDispatch() {
    setLoading(true)
    try {
      const params: any = { lat: parseFloat(lat), lng: parseFloat(lng), fecha, hora_desde: hora, duracion_min: 60 }
      if (skillFilter) params.skill_id = skillFilter
      const r = await serviciosApi.getDispatchRanking(params)
      const sorted = [...r].sort((a, b) => (b.score || 0) - (a.score || 0))
      setRanking(sorted)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" />Dispatch IA — Ranking de Tecnicos</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><label className="block text-xs mb-1">Latitud</label><input className="input-field w-full" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
          <div><label className="block text-xs mb-1">Longitud</label><input className="input-field w-full" value={lng} onChange={(e) => setLng(e.target.value)} /></div>
          <div><label className="block text-xs mb-1">Fecha</label><input className="input-field w-full" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div><label className="block text-xs mb-1">Hora</label><input className="input-field w-full" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
        </div>
        <button onClick={handleDispatch} disabled={loading} className="btn-primary w-full mb-4">{loading ? <Spinner /> : "Calcular Ranking"}</button>

        {ranking.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Mejores opciones:</p>
            {ranking.map((r, idx) => (
              <div key={r.technician_id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-700" : "bg-gray-300"}`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.nombre} <span className="text-xs text-gray-400">{r.vertical_codigo}</span></p>
                  <div className="flex gap-2 text-xs text-gray-400">
                    <span>{r.distancia_km?.toFixed(1)} km</span>
                    <span>Rating: {r.rating?.toFixed(1)}</span>
                    {r.disponible && <Badge color="green">Disponible</Badge>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{r.score?.toFixed(0)}</p>
                  <p className="text-xs text-gray-400">puntos</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== COTIZACIONES ====================
function CotizacionesTab() {
  const [quotes, setQuotes] = useState<SvcQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    serviciosApi.listQuotes({ estado: filter || undefined })
      .then(setQuotes)
      .catch(() => toast.error("Error", "No se pudieron cargar cotizaciones"))
      .finally(() => setLoading(false))
  }, [filter])

  const estadoColors: Record<string, string> = {
    borrador: "bg-gray-100 text-gray-600", enviada: "bg-blue-100 text-blue-700",
    aprobada: "bg-green-100 text-green-700", rechazada: "bg-red-100 text-red-600",
    vencida: "bg-yellow-100 text-yellow-700", convertida_wo: "bg-purple-100 text-purple-700",
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex gap-1 flex-wrap">
          {["", "borrador", "enviada", "aprobada", "rechazada", "convertida_wo"].map((e) => (
            <button key={e} onClick={() => setFilter(e)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${filter === e ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>
              {e || "Todas"}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva Cotizacion</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><FileText className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">No hay cotizaciones</p></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left px-4 py-3">Nro</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Titulo</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-center px-4 py-3">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {quotes.map((q) => (
                <tr key={q.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-mono text-xs">{q.numero}</td>
                  <td className="px-4 py-3">{q.customer_nombre || q.customer_id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-40 truncate">{q.titulo}</td>
                  <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[q.estado || ""] || "bg-gray-100"}`}>{q.estado}</span></td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatPYG(q.total)}</td>
                  <td className="px-4 py-3 text-center">
                    {q.estado === "aprobada" && (
                      <button onClick={async () => { try { await serviciosApi.convertQuoteToWO(q.id!); toast.success("Convertida a WO"); setFilter(filter) } catch { toast.error("Error") } }}
                        className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200">Convertir a WO</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <QuoteForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); serviciosApi.listQuotes({ estado: filter || undefined }).then(setQuotes).catch(() => {}) }} />}
    </div>
  )
}

function QuoteForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    customer_id: "", customer_nombre: "", titulo: "", descripcion: "",
    vertical_codigo: "", technician_id: "", property_id: "",
    descuento_pct: 0, iva_pct: 10, tiempo_validez_dias: 15,
  })
  const [items, setItems] = useState<SvcQuoteItem[]>([{ tipo: "mano_obra", descripcion: "", cantidad: 1, precio_unitario: 0 }])
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const subtotal = items.reduce((s, i) => s + (Number(i.cantidad || 1) * Number(i.precio_unitario || 0)), 0)
  const descMonto = subtotal * (form.descuento_pct / 100)
  const ivaMonto = (subtotal - descMonto) * (form.iva_pct / 100)
  const total = subtotal - descMonto + ivaMonto

  async function handleSubmit() {
    if (!form.customer_nombre || !form.titulo) { toast.error("Error", "Cliente y titulo requeridos"); return }
    if (items.length === 0 || items.some(i => !i.descripcion)) { toast.error("Error", "Items con descripcion requeridos"); return }
    setSaving(true)
    try {
      await serviciosApi.createQuote({ ...form, items })
      toast.success("Cotizacion creada"); onCreated()
    } catch { toast.error("Error", "No se pudo crear") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Nueva Cotizacion</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs mb-1">Cliente *</label><input className="input-field w-full" value={form.customer_nombre} onChange={(e) => setForm({ ...form, customer_nombre: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Titulo *</label><input className="input-field w-full" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-xs mb-1">Descripcion</label><textarea className="input-field w-full" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Dto %</label><input className="input-field w-full" type="number" value={form.descuento_pct} onChange={(e) => setForm({ ...form, descuento_pct: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="block text-xs mb-1">IVA %</label><input className="input-field w-full" type="number" value={form.iva_pct} onChange={(e) => setForm({ ...form, iva_pct: parseFloat(e.target.value) || 0 })} /></div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Items ({items.length})</h4>
            <button onClick={() => setItems([...items, { tipo: "material", descripcion: "", cantidad: 1, precio_unitario: 0 }])} className="text-sm text-primary font-medium">+ Agregar</button>
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select className="input-field w-24 text-xs" value={item.tipo} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], tipo: e.target.value }; setItems(n) }}>
                  <option value="mano_obra">Mano obra</option><option value="material">Material</option>
                  <option value="equipo">Equipo</option><option value="subcontrato">Subcontrato</option>
                </select>
                <input className="input-field flex-1 text-xs" placeholder="Descripcion" value={item.descripcion} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], descripcion: e.target.value }; setItems(n) }} />
                <input className="input-field w-16 text-xs" type="number" placeholder="Cant" value={item.cantidad} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], cantidad: parseInt(e.target.value) || 0 }; setItems(n) }} />
                <input className="input-field w-24 text-xs" type="number" placeholder="Precio" value={item.precio_unitario} onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], precio_unitario: parseFloat(e.target.value) || 0 }; setItems(n) }} />
                <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 p-1"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex justify-end text-sm text-gray-500 mt-2 space-x-4">
            <span>Subtotal: <b>{formatPYG(subtotal)}</b></span>
            <span>Dto: <b>{form.descuento_pct}%</b></span>
            <span>IVA: <b>{formatPYG(ivaMonto)}</b></span>
            <span className="text-primary font-bold">Total: {formatPYG(total)}</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Crear Cotizacion"}</button>
        </div>
      </div>
    </div>
  )
}

// ==================== ORDENES ====================
function OrdenesTab() {
  const [wos, setWos] = useState<SvcWorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEst, setFilterEst] = useState("")
  const [activeTimer, setActiveTimer] = useState<{ woId: string; timerId: string } | null>(null)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    serviciosApi.listWorkOrders({ estado: filterEst || undefined })
      .then(setWos)
      .catch(() => toast.error("Error", "No se pudieron cargar ordenes"))
      .finally(() => setLoading(false))
  }, [filterEst])

  const prioColors: Record<string, string> = {
    baja: "border-l-gray-300", normal: "border-l-blue-400",
    alta: "border-l-amber-400", urgente: "border-l-red-500", emergencia: "border-l-red-600",
  }
  const estadoColors: Record<string, string> = {
    pendiente: "bg-gray-100 text-gray-600", asignada: "bg-blue-100 text-blue-700",
    en_curso: "bg-amber-100 text-amber-700", completada: "bg-green-100 text-green-700",
    facturada: "bg-purple-100 text-purple-700", cancelada: "bg-red-100 text-red-600",
  }

  async function handleStartTimer(woId: string) {
    try {
      const timer = await serviciosApi.startTimer(woId)
      setActiveTimer({ woId, timerId: timer.id! })
      toast.success("Timer iniciado")
    } catch { toast.error("Error", "No se pudo iniciar timer") }
  }

  async function handleStopTimer(timerId: string) {
    try {
      await serviciosApi.stopTimer(timerId, true)
      setActiveTimer(null)
      toast.success("Timer detenido")
    } catch { toast.error("Error", "No se pudo detener timer") }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {["", "pendiente", "asignada", "en_curso", "completada", "facturada", "cancelada"].map((e) => (
          <button key={e} onClick={() => setFilterEst(e)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${filterEst === e ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>
            {e || "Todas"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : wos.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><ClipboardList className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">Sin ordenes de trabajo</p></div>
      ) : (
        <div className="space-y-3">
          {wos.map((wo) => (
            <div key={wo.id} className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 border-l-4 ${prioColors[wo.prioridad || "normal"]} p-4 hover:shadow-md transition-shadow`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{wo.titulo || wo.numero}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${estadoColors[wo.estado || ""] || "bg-gray-100"}`}>{wo.estado}</span>
                    <Badge color={wo.prioridad === "urgente" ? "red" : wo.prioridad === "alta" ? "yellow" : "gray"}>{wo.prioridad || "normal"}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {wo.customer_nombre && <><User className="w-3 h-3 inline mr-1" />{wo.customer_nombre} | </>}
                    {wo.technician_nombre && <><Wrench className="w-3 h-3 inline mr-1" />{wo.technician_nombre} | </>}
                    {wo.fecha_programada && <><CalendarDays className="w-3 h-3 inline mr-1" />{new Date(wo.fecha_programada).toLocaleDateString("es-PY")}</>}
                  </p>
                  {wo.problema_reportado && <p className="text-xs text-gray-400 mt-0.5 truncate">{wo.problema_reportado}</p>}
                  {wo.satisfaccion_nps != null && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-gray-400">NPS:</span>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={`w-3 h-3 ${i <= wo.satisfaccion_nps! ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {wo.estado === "en_curso" && (
                    activeTimer?.woId === wo.id
                      ? <button onClick={() => handleStopTimer(activeTimer!.timerId)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"><Square className="w-3 h-3" />Detener</button>
                      : <button onClick={() => handleStartTimer(wo.id!)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"><Play className="w-3 h-3" />Iniciar</button>
                  )}
                  {wo.estado === "completada" && !wo.invoice_id && (
                    <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">Pendiente factura</span>
                  )}
                  {wo.total != null && <span className="text-sm font-bold text-primary">{formatPYG(wo.total)}</span>}
                </div>
              </div>
              {wo.duracion_real_minutos != null && (
                <p className="text-xs text-gray-400 mt-2"><Timer className="w-3 h-3 inline mr-1" />Duracion: {Math.floor(wo.duracion_real_minutos / 60)}h {wo.duracion_real_minutos % 60}m</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== CONTRATOS ====================
function ContratosTab() {
  const [contracts, setContracts] = useState<SvcContract[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEst, setFilterEst] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [detailContract, setDetailContract] = useState<SvcContract | null>(null)
  const [visits, setVisits] = useState<SvcContractVisit[]>([])
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    serviciosApi.listContracts(filterEst || undefined)
      .then(setContracts)
      .catch(() => toast.error("Error", "No se pudieron cargar contratos"))
      .finally(() => setLoading(false))
  }, [filterEst])

  async function handleGenerateVisits(contractId: string) {
    try {
      const res = await serviciosApi.generateVisits(contractId)
      toast.success("Visitas generadas", `${res.visitas_creadas} visitas creadas`)
    } catch { toast.error("Error", "No se pudieron generar visitas") }
  }

  async function loadVisits(contractId: string) {
    try {
      const v = await serviciosApi.listContractVisits(contractId)
      setVisits(v)
    } catch { toast.error("Error", "No se pudieron cargar visitas") }
  }

  const estadoColors: Record<string, string> = {
    activo: "bg-green-100 text-green-700", pausado: "bg-yellow-100 text-yellow-700",
    vencido: "bg-red-100 text-red-600", cancelado: "bg-gray-100 text-gray-600",
    pendiente_renovacion: "bg-blue-100 text-blue-700",
  }

  if (detailContract) {
    return (
      <div className="space-y-4">
        <button onClick={() => setDetailContract(null)} className="text-sm text-primary font-medium flex items-center gap-1"><ChevronRight className="w-3 h-3 rotate-180" /> Volver</button>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold mb-4">{detailContract.customer_nombre} — {detailContract.titulo}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><span className="text-gray-500">Estado:</span> <Badge color={detailContract.estado === "activo" ? "green" : "gray"}>{detailContract.estado}</Badge></div>
            <div><span className="text-gray-500">Monto mensual:</span> <span className="font-bold">{formatPYG(detailContract.monto_mensual_pyg)}</span></div>
            <div><span className="text-gray-500">Visitas:</span> {detailContract.visitas_realizadas}/{detailContract.visitas_incluidas_anio} ({detailContract.visitas_restantes} restantes)</div>
            <div><span className="text-gray-500">Frecuencia:</span> {detailContract.frecuencia_visitas}</div>
            <div><span className="text-gray-500">Inicio:</span> {detailContract.fecha_inicio ? new Date(detailContract.fecha_inicio).toLocaleDateString("es-PY") : "—"}</div>
            <div><span className="text-gray-500">Fin:</span> {detailContract.fecha_fin ? new Date(detailContract.fecha_fin).toLocaleDateString("es-PY") : "—"}</div>
          </div>
          {/* Visit compliance bar */}
          {detailContract.visitas_incluidas_anio && detailContract.visitas_incluidas_anio > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Cumplimiento de visitas</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${Math.min(100, ((detailContract.visitas_realizadas || 0) / detailContract.visitas_incluidas_anio) * 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{detailContract.visitas_realizadas || 0} de {detailContract.visitas_incluidas_anio} realizadas</p>
            </div>
          )}
          <button onClick={() => handleGenerateVisits(detailContract.id!)} className="btn-primary text-sm px-3 py-1.5">Generar Visitas</button>

          {/* Visits list */}
          <div className="mt-6">
            <button onClick={() => loadVisits(detailContract.id!)} className="text-sm text-primary font-medium mb-2">Cargar visitas generadas</button>
            {visits.length > 0 && (
              <div className="space-y-1 mt-2">
                {visits.map((v) => (
                  <div key={v.id} className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm">
                    <span>{v.fecha_programada ? new Date(v.fecha_programada).toLocaleDateString("es-PY") : "—"}</span>
                    <span className="text-xs text-gray-400">{v.estado} {v.technician_id ? `— ${v.technician_id.slice(0, 8)}` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-1 flex-wrap">
          {["", "activo", "pausado", "vencido", "pendiente_renovacion"].map((e) => (
            <button key={e} onClick={() => setFilterEst(e)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${filterEst === e ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>
              {e || "Todos"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Contrato</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><FileSignature className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">Sin contratos</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contracts.map((c) => {
            const pct = c.visitas_incluidas_anio && c.visitas_incluidas_anio > 0 ? Math.min(100, ((c.visitas_realizadas || 0) / c.visitas_incluidas_anio) * 100) : 0
            return (
              <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setDetailContract(c); loadVisits(c.id!) }}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{c.customer_nombre}</p>
                    <p className="text-xs text-gray-400">{c.titulo} — {c.numero}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[c.estado || ""] || "bg-gray-100"}`}>{c.estado}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-primary font-bold">{formatPYG(c.monto_mensual_pyg)}/mes</span>
                  <span className="text-xs text-gray-400">{c.frecuencia_visitas}</span>
                </div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{c.visitas_realizadas || 0}/{c.visitas_incluidas_anio || 0} visitas</p>
                </div>
                <div className="flex gap-2 mt-2 text-xs text-gray-400">
                  {c.renovacion_auto && <Badge color="blue">Auto-renovable</Badge>}
                  {c.fecha_proximo_cobro && <span>Prox. cobro: {new Date(c.fecha_proximo_cobro).toLocaleDateString("es-PY")}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <ContractForm onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); serviciosApi.listContracts(filterEst || undefined).then(setContracts).catch(() => {}) }} />}
    </div>
  )
}

function ContractForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    customer_id: "", customer_nombre: "", titulo: "", duracion_meses: 12,
    frecuencia_visitas: "mensual", visitas_incluidas_anio: 12,
    monto_mensual_pyg: 0, renovacion_auto: true, fecha_inicio: new Date().toISOString().split("T")[0],
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.customer_nombre || !form.titulo) { toast.error("Error", "Cliente y titulo requeridos"); return }
    setSaving(true)
    try {
      await serviciosApi.createContract(form)
      toast.success("Contrato creado"); onCreated()
    } catch { toast.error("Error", "No se pudo crear") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-4">Nuevo Contrato</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="block text-xs mb-1">Cliente *</label><input className="input-field w-full" value={form.customer_nombre} onChange={(e) => setForm({ ...form, customer_nombre: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-xs mb-1">Titulo *</label><input className="input-field w-full" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Duracion (meses)</label><input className="input-field w-full" type="number" value={form.duracion_meses} onChange={(e) => setForm({ ...form, duracion_meses: parseInt(e.target.value) || 0 })} /></div>
          <div><label className="block text-xs mb-1">Frecuencia</label>
            <select className="input-field w-full" value={form.frecuencia_visitas} onChange={(e) => setForm({ ...form, frecuencia_visitas: e.target.value })}>
              <option value="mensual">Mensual</option><option value="bimestral">Bimestral</option>
              <option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option>
            </select></div>
          <div><label className="block text-xs mb-1">Visitas / anio</label><input className="input-field w-full" type="number" value={form.visitas_incluidas_anio} onChange={(e) => setForm({ ...form, visitas_incluidas_anio: parseInt(e.target.value) || 0 })} /></div>
          <div><label className="block text-xs mb-1">Monto mensual</label><input className="input-field w-full" type="number" value={form.monto_mensual_pyg} onChange={(e) => setForm({ ...form, monto_mensual_pyg: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="block text-xs mb-1">Inicio</label><input className="input-field w-full" type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} /></div>
          <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.renovacion_auto} onChange={(e) => setForm({ ...form, renovacion_auto: e.target.checked })} className="rounded" />Renovacion automatica</label></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Crear"}</button>
        </div>
      </div>
    </div>
  )
}

// ==================== INVENTARIO ====================
function InventarioTab() {
  const [techs, setTechs] = useState<SvcTechnician[]>([])
  const [techId, setTechId] = useState("")
  const [items, setItems] = useState<SvcTruckItem[]>([])
  const [movements, setMovements] = useState<SvcInvMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [showMovement, setShowMovement] = useState(false)
  const toast = useToast()

  useEffect(() => {
    serviciosApi.listTechnicians().then(setTechs).catch(() => {})
  }, [])

  async function loadInventory(tId: string) {
    if (!tId) return
    setLoading(true)
    try {
      const [inv, mov] = await Promise.all([
        serviciosApi.listTruckInventory(tId),
        serviciosApi.listInventoryMovements({ technician_id: tId, limit: 20 }),
      ])
      setItems(inv); setMovements(mov)
    } catch { toast.error("Error", "No se pudo cargar inventario") }
    finally { setLoading(false) }
  }

  useEffect(() => { if (techId) loadInventory(techId) }, [techId])

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="w-64">
          <label className="block text-xs text-gray-500 mb-1">Seleccionar Tecnico</label>
          <select className="input-field w-full" value={techId} onChange={(e) => setTechId(e.target.value)}>
            <option value="">Seleccionar...</option>
            {techs.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        {techId && <button onClick={() => setShowMovement(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Movimiento</button>}
      </div>

      {!techId ? (
        <div className="text-center py-12 text-gray-400"><Truck className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">Selecciona un tecnico para ver su inventario</p></div>
      ) : loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Inventario del Camion</h3>
            {items.length === 0 ? (
              <p className="text-sm text-gray-400">Sin items en inventario</p>
            ) : (
              <div className="space-y-2">
                {items.map((i) => {
                  const pct = i.stock_minimo && i.stock_minimo > 0 ? (i.cantidad / i.stock_minimo) * 100 : 100
                  return (
                    <div key={i.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{i.producto_nombre || i.producto_id}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`w-2.5 h-2.5 rounded-full ${pct <= 50 ? "bg-red-500" : pct <= 100 ? "bg-yellow-500" : "bg-green-500"}`} />
                          <span className="text-xs text-gray-400">Stock: {i.cantidad}</span>
                          {i.stock_minimo && <span className="text-xs text-gray-400">Min: {i.stock_minimo}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">{i.cantidad} UN</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Movimientos Recientes</h3>
            {movements.length === 0 ? (
              <p className="text-sm text-gray-400">Sin movimientos</p>
            ) : (
              <div className="space-y-1">
                {movements.map((m) => (
                  <div key={m.id} className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm">
                    <div>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${m.tipo === "consumo" ? "bg-red-100 text-red-700" : m.tipo === "reposicion" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{m.tipo}</span>
                      <span className="ml-2 text-gray-500">{m.motivo || "—"}</span>
                    </div>
                    <span className="font-mono text-xs">{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showMovement && <MovementForm techId={techId} onClose={() => setShowMovement(false)} onCreated={() => { setShowMovement(false); loadInventory(techId) }} />}
    </div>
  )
}

function MovementForm({ techId, onClose, onCreated }: { techId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ producto_id: "", producto_nombre: "", tipo: "consumo", cantidad: 1, motivo: "" })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.producto_nombre) { toast.error("Error", "Nombre de producto requerido"); return }
    setSaving(true)
    try {
      const cantidad = form.tipo === "consumo" ? -Math.abs(form.cantidad) : Math.abs(form.cantidad)
      await serviciosApi.createInventoryMovement({ ...form, technician_id: techId, cantidad })
      toast.success("Movimiento registrado"); onCreated()
    } catch { toast.error("Error", "No se pudo registrar") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-4">Registrar Movimiento</h3>
        <div className="space-y-3">
          <div><label className="block text-xs mb-1">Producto *</label><input className="input-field w-full" value={form.producto_nombre} onChange={(e) => setForm({ ...form, producto_nombre: e.target.value })} /></div>
          <div><label className="block text-xs mb-1">Tipo</label>
            <select className="input-field w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="consumo">Consumo</option><option value="reposicion">Reposicion</option>
              <option value="devolucion">Devolucion</option><option value="ajuste">Ajuste</option>
            </select></div>
          <div><label className="block text-xs mb-1">Cantidad</label><input className="input-field w-full" type="number" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: parseInt(e.target.value) || 0 })} /></div>
          <div><label className="block text-xs mb-1">Motivo</label><input className="input-field w-full" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Registrar"}</button>
        </div>
      </div>
    </div>
  )
}

// ==================== FACTURACION ====================
function FacturacionTab() {
  const [invoices, setInvoices] = useState<SvcInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEst, setFilterEst] = useState("")
  const [showPayment, setShowPayment] = useState<{ invoice: SvcInvoice; onDone: () => void } | null>(null)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    serviciosApi.listInvoices({ estado: filterEst || undefined })
      .then(setInvoices)
      .catch(() => toast.error("Error", "No se pudieron cargar facturas"))
      .finally(() => setLoading(false))
  }, [filterEst])

  const estadoColors: Record<string, string> = {
    borrador: "bg-gray-100 text-gray-600", emitida: "bg-blue-100 text-blue-700",
    pagada: "bg-green-100 text-green-700", parcial: "bg-yellow-100 text-yellow-700",
    vencida: "bg-red-100 text-red-600", anulada: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {["", "borrador", "emitida", "pagada", "parcial", "vencida", "anulada"].map((e) => (
          <button key={e} onClick={() => setFilterEst(e)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${filterEst === e ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>
            {e || "Todas"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Receipt className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">Sin facturas</p></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left px-4 py-3">Nro</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Emision</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Saldo</th>
                <th className="text-center px-4 py-3">Dias</th>
                <th className="text-center px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {invoices.map((inv) => {
                const saldo = inv.saldo ?? inv.total ?? 0
                const diasMora = inv.dias_mora ?? 0
                return (
                  <tr key={inv.id} className={`text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30 ${diasMora > 30 ? "bg-red-50 dark:bg-red-900/5" : diasMora > 0 ? "bg-yellow-50 dark:bg-yellow-900/5" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs">{inv.numero}</td>
                    <td className="px-4 py-3">{inv.customer_nombre || inv.customer_id?.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-gray-500">{inv.fecha_emision ? new Date(inv.fecha_emision).toLocaleDateString("es-PY") : "—"}</td>
                    <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[inv.estado || ""] || "bg-gray-100"}`}>{inv.estado}</span></td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{formatPYG(inv.total)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatPYG(saldo)}</td>
                    <td className="px-4 py-3 text-center">
                      {diasMora > 0 ? <span className="text-red-500 font-medium">{diasMora}d</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inv.estado !== "pagada" && inv.estado !== "anulada" && (
                        <button onClick={() => setShowPayment({ invoice: inv, onDone: () => { setShowPayment(null); serviciosApi.listInvoices({ estado: filterEst || undefined }).then(setInvoices) } })}
                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">Cobrar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showPayment && (
        <PaymentForm invoiceId={showPayment.invoice.id!} total={showPayment.invoice.total!} saldo={showPayment.invoice.saldo ?? showPayment.invoice.total!} onClose={() => setShowPayment(null)} onDone={showPayment.onDone} />
      )}
    </div>
  )
}

function PaymentForm({ invoiceId, total, saldo, onClose, onDone }: { invoiceId: string; total: number; saldo: number; onClose: () => void; onDone: () => void }) {
  const [monto, setMonto] = useState(saldo)
  const [metodo, setMetodo] = useState("efectivo")
  const [referencia, setReferencia] = useState("")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (monto <= 0) { toast.error("Error", "Monto debe ser mayor a 0"); return }
    setSaving(true)
    try {
      await serviciosApi.addInvoicePayment(invoiceId, { monto, metodo_pago: metodo, referencia: referencia || undefined })
      toast.success("Pago registrado"); onDone()
    } catch { toast.error("Error", "No se pudo registrar") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-4">Registrar Pago</h3>
        <p className="text-sm text-gray-500 mb-3">Total: <b>{formatPYG(total)}</b> | Saldo: <b>{formatPYG(saldo)}</b></p>
        <div className="space-y-3">
          <div><label className="block text-xs mb-1">Monto</label><input className="input-field w-full" type="number" value={monto} onChange={(e) => setMonto(parseFloat(e.target.value) || 0)} /></div>
          <div><label className="block text-xs mb-1">Metodo</label>
            <select className="input-field w-full" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option>
              <option value="tarjeta_credito">Tarjeta Credito</option><option value="tarjeta_debito">Tarjeta Debito</option>
              <option value="cheque">Cheque</option>
            </select></div>
          <div><label className="block text-xs mb-1">Referencia</label><input className="input-field w-full" value={referencia} onChange={(e) => setReferencia(e.target.value)} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">{saving ? <Spinner /> : "Pagar"}</button>
        </div>
      </div>
    </div>
  )
}
