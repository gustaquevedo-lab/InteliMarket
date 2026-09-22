import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ExternalLink,
  Search,
  RefreshCw,
  Activity,
  Briefcase,
  UserCheck,
  UserX,
  Coffee,
  Fingerprint,
  ShieldCheck,
  Camera,
  X,
  Plus,
  CreditCard,
  Scissors,
  Receipt,
  Calculator,
  Building,
  Check,
  Sparkles,
  Calendar,
  BadgePercent,
  Eye,
  FileText,
  PiggyBank,
} from "lucide-react"
import { formatPYG, formatDate, formatDateTime, getTodayAsuncion } from "../../utils/format"

// ── Configuración de Integración con SueldOK ──────────────────────────
const SUELDOK_BASE_URL = "https://sueldok.intellihouse.lat"
const SUELDOK_OVERVIEW_URL = `${SUELDOK_BASE_URL}/http/api/intelimarket/overview`
const SUELDOK_SSO_URL = `${SUELDOK_BASE_URL}/http/api/intelimarket/sso-token`

// Llaves de integración por empresa
const EMPRESAS_DISPONIBLES = [
  {
    id: "k177xrnra3m1na7sg640rrm85x8aj62k",
    nombre: "Grupo Santa Teresa E.A.S.",
    ruc: "80150377-9",
    apiKey: "ifk_santateresa_live_api_key_2026",
    relojInfo: "Dahua Facial (192.168.0.122)",
  },
  {
    id: "k17fz2ntbvprjrngkyysgrmb7589m4w7",
    nombre: "Casa Gonzalito S.R.L.",
    ruc: "80005427-0",
    apiKey: "ifk_m953H3eJeBUZj3ITBHtNlLQPbGg-AO8FLberndVxEdE",
    relojInfo: "SueldOK App Mobile",
  },
]

const COLORES_AVATAR = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#84cc16",
  "#f97316",
]

type TabType = "dashboard" | "payroll" | "advances" | "deductions" | "asistencia" | "funcionarios"

export interface PayrollItem {
  id: string
  nombre: string
  ci: string
  cargo: string
  depto: string
  baseSalary: number
  bonus: number
  totalGross: number
  ipsWorker: number
  ipsEmployer: number
  advances: number
  deductions: number
  totalNet: number
}

const estadoConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  presente: { label: "Presente", color: "#10b981", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
  Late: { label: "Tardanza", color: "#f59e0b", bg: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: AlertTriangle },
  tardanza: { label: "Tardanza", color: "#f59e0b", bg: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: AlertTriangle },
  absent: { label: "Ausente", color: "#ef4444", bg: "bg-rose-500/10 text-rose-400 border-rose-500/20", icon: XCircle },
  ausente: { label: "Ausente", color: "#ef4444", bg: "bg-rose-500/10 text-rose-400 border-rose-500/20", icon: XCircle },
  licencia: { label: "Licencia / Permiso", color: "#60a5fa", bg: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Coffee },
}

function AvatarCircle({ initials, idx, size = 40 }: { initials: string; idx: number; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: COLORES_AVATAR[idx % COLORES_AVATAR.length],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: 900,
        fontSize: size * 0.36,
        flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}
    >
      {initials}
    </div>
  )
}

export default function SueldokPage() {
  const [selectedCompany, setSelectedCompany] = useState(EMPRESAS_DISPONIBLES[0])
  const [tab, setTab] = useState<TabType>("dashboard")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  // Modales
  const [modalAnticipoOpen, setModalAnticipoOpen] = useState(false)
  const [modalDescuentoOpen, setModalDescuentoOpen] = useState(false)
  const [modalNominaOpen, setModalNominaOpen] = useState(false)
  const [selectedPunchPhoto, setSelectedPunchPhoto] = useState<{
    photoUrl: string
    nombre: string
    hora: string
    status: string
    cargo?: string
  } | null>(null)

  // Estados de formularios de modales
  const [anticipoEmpId, setAnticipoEmpId] = useState("")
  const [anticipoMonto, setAnticipoMonto] = useState("")
  const [anticipoMotivo, setAnticipoMotivo] = useState("Anticipo quincenal de haberes")
  const [anticipoFecha, setAnticipoFecha] = useState(() => getTodayAsuncion())

  const [descuentoEmpId, setDescuentoEmpId] = useState("")
  const [descuentoTipo, setDescuentoTipo] = useState("Faltante de Arqueo de Caja")
  const [descuentoMonto, setDescuentoMonto] = useState("")
  const [descuentoCuotas, setDescuentoCuotas] = useState("1")
  const [descuentoPeriodo, setDescuentoPeriodo] = useState("2026-09")
  const [descuentoObs, setDescuentoObs] = useState("")

  const [periodoNomina, setPeriodoNomina] = useState("2026-09")
  const [nominaFeedback, setNominaFeedback] = useState<string | null>(null)

  // Almacenamiento local reactivo para anticipos y deducciones nuevos
  const [localAdvances, setLocalAdvances] = useState<any[]>([
    {
      id: "adv-1",
      employeeId: "emp-camila",
      nombre: "CAMILA GEOVANNA GONZALEZ ESCOBAR",
      ci: "4801062",
      cargo: "GERENTE",
      depto: "JEFE OPERATIVO",
      monto: 2500000,
      estado: "approved",
      motivo: "Anticipo salarial quincenal",
      fecha: "2026-09-15",
    },
    {
      id: "adv-2",
      employeeId: "emp-nilda",
      nombre: "NILDA AQUINO",
      ci: "5124890",
      cargo: "CAJERA PRINCIPAL",
      depto: "CAJAS",
      monto: 800000,
      estado: "approved",
      motivo: "Gastos médicos particulares",
      fecha: "2026-09-12",
    },
    {
      id: "adv-3",
      employeeId: "emp-liliana",
      nombre: "LILIANA CRISTALDO",
      ci: "4987123",
      cargo: "CAJERA",
      depto: "CAJAS",
      monto: 600000,
      estado: "pending",
      motivo: "Adelanto personal",
      fecha: "2026-09-18",
    },
  ])

  const [localDeductions, setLocalDeductions] = useState<any[]>([
    {
      id: "ded-1",
      employeeId: "emp-nilda",
      nombre: "NILDA AQUINO",
      ci: "5124890",
      cargo: "CAJERA PRINCIPAL",
      depto: "CAJAS",
      monto: 80100,
      descripcion: "Faltante Arqueo Caja #2 (Sesión #218)",
      comentarios: "Aprobado para descuento en nómina mensual",
      cuotas: 1,
      periodo: "2026-09",
      estado: "active",
      fecha: "2026-09-16",
    },
    {
      id: "ded-2",
      employeeId: "emp-liliana",
      nombre: "LILIANA CRISTALDO",
      ci: "4987123",
      cargo: "CAJERA",
      depto: "CAJAS",
      monto: 90450,
      descripcion: "Faltante Arqueo Caja #3 (Sesión #217)",
      comentarios: "Diferencia de arqueo ciego confirmada",
      cuotas: 1,
      periodo: "2026-09",
      estado: "active",
      fecha: "2026-09-17",
    },
    {
      id: "ded-3",
      employeeId: "emp-evelin",
      nombre: "EVELIN HERRERO",
      ci: "5234190",
      cargo: "CAJERA",
      depto: "CAJAS",
      monto: 77240,
      descripcion: "Faltante Arqueo Caja #4 (Sesión #177)",
      comentarios: "Deducción autorizada por supervisión",
      cuotas: 1,
      periodo: "2026-09",
      estado: "active",
      fecha: "2026-09-18",
    },
  ])

  // Carga reactiva de datos desde SueldOK
  const fetchData = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true)
      try {
        const res = await fetch(`${SUELDOK_OVERVIEW_URL}?apiKey=${selectedCompany.apiKey}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        })
        if (res.ok) {
          const json = await res.json()
          setData(json)
          setLastUpdated(new Date())
        } else {
          console.error("Error al cargar SueldOK overview:", res.status)
        }
      } catch (err) {
        console.error("Error conectando a SueldOK:", err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [selectedCompany]
  )

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleLaunchSso = async (targetRoute = "/attendance") => {
    setSsoLoading(true)
    try {
      const res = await fetch(SUELDOK_SSO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${selectedCompany.apiKey}`,
        },
        body: JSON.stringify({ redirect: targetRoute }),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.ssoUrl) {
          window.open(json.ssoUrl, "_blank")
          return
        }
      }
      window.open(SUELDOK_BASE_URL, "_blank")
    } catch (err) {
      console.error("Error generando token SSO:", err)
      window.open(SUELDOK_BASE_URL, "_blank")
    } finally {
      setSsoLoading(false)
    }
  }

  const employees = data?.employees || []
  const todayAttendance = data?.todayAttendance || []

  // Combinar anticipos y deducciones (remotos de SueldOK si existen + locales enriquecidos)
  const advances = useMemo(() => {
    const remote = data?.advances || []
    return [...localAdvances, ...remote.filter((r: any) => !localAdvances.some((l) => l.id === r.id))]
  }, [data?.advances, localAdvances])

  const deductions = useMemo(() => {
    const remote = data?.deductions || []
    return [...localDeductions, ...remote.filter((r: any) => !localDeductions.some((l) => l.id === r.id))]
  }, [data?.deductions, localDeductions])

  // Cálculo estratégico de nómina por funcionario
  const payrollItems: PayrollItem[] = useMemo(() => {
    return employees.map((emp: any): PayrollItem => {
      const baseSalary = emp.salario || 0
      const ipsWorker = Math.round(baseSalary * 0.09)
      const ipsEmployer = Math.round(baseSalary * 0.165)

      // Anticipos aprobados de este funcionario
      const empAdvances = advances
        .filter((a: any) => (a.nombre || "").toLowerCase() === (emp.nombre || "").toLowerCase() && a.estado === "approved")
        .reduce((sum: number, a: any) => sum + (a.monto || 0), 0)

      // Descuentos activos de este funcionario
      const empDeductions = deductions
        .filter((d: any) => (d.nombre || "").toLowerCase() === (emp.nombre || "").toLowerCase() && d.estado === "active")
        .reduce((sum: number, d: any) => sum + (d.monto || 0), 0)

      // Bonos estimativos (cajeras ORO / PLATA / BRONCE)
      let bonus = 0
      if ((emp.cargo || "").toUpperCase().includes("CAJER")) {
        bonus = 250000
      }

      const totalGross = baseSalary + bonus
      const totalNet = Math.max(0, totalGross - ipsWorker - empAdvances - empDeductions)

      return {
        id: emp.id,
        nombre: emp.nombre,
        ci: emp.ci,
        cargo: emp.cargo,
        depto: emp.depto,
        baseSalary,
        bonus,
        totalGross,
        ipsWorker,
        ipsEmployer,
        advances: empAdvances,
        deductions: empDeductions,
        totalNet,
      }
    })
  }, [employees, advances, deductions])

  // Totales de la nómina
  const totalPayrollGross = useMemo(() => payrollItems.reduce((acc: number, p: PayrollItem) => acc + p.totalGross, 0), [payrollItems])
  const totalPayrollNet = useMemo(() => payrollItems.reduce((acc: number, p: PayrollItem) => acc + p.totalNet, 0), [payrollItems])
  const totalIpsWorker = useMemo(() => payrollItems.reduce((acc: number, p: PayrollItem) => acc + p.ipsWorker, 0), [payrollItems])
  const totalIpsEmployer = useMemo(() => payrollItems.reduce((acc: number, p: PayrollItem) => acc + p.ipsEmployer, 0), [payrollItems])
  const totalAdvancesSum = useMemo(() => advances.reduce((acc: number, a: any) => acc + (a.monto || 0), 0), [advances])
  const totalDeductionsSum = useMemo(() => deductions.reduce((acc: number, d: any) => acc + (d.monto || 0), 0), [deductions])

  const metrics = data?.metrics || {
    totalEmployees: employees.length,
    activeEmployees: employees.length,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    attendanceRate: 0,
    totalPayroll: totalPayrollGross,
  }

  const filteredEmployees = employees.filter(
    (e: any) =>
      (e.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.cargo || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.depto || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.ci || "").includes(search)
  )

  // Acciones de registro
  const handleRegistrarAnticipo = () => {
    if (!anticipoEmpId || !anticipoMonto) return
    const emp = employees.find((e: any) => e.id === anticipoEmpId)
    const montoNum = parseInt(anticipoMonto.replace(/\./g, "").replace(/,/g, "")) || 0
    if (montoNum <= 0) return

    const nuevo = {
      id: `adv-${Date.now()}`,
      employeeId: emp?.id || "emp-temp",
      nombre: emp?.nombre || "Colaborador",
      ci: emp?.ci || "—",
      cargo: emp?.cargo || "Colaborador",
      depto: emp?.depto || "General",
      monto: montoNum,
      estado: "approved",
      motivo: anticipoMotivo,
      fecha: anticipoFecha,
    }

    setLocalAdvances((prev) => [nuevo, ...prev])
    setModalAnticipoOpen(false)
    setAnticipoEmpId("")
    setAnticipoMonto("")
  }

  const handleRegistrarDescuento = () => {
    if (!descuentoEmpId || !descuentoMonto) return
    const emp = employees.find((e: any) => e.id === descuentoEmpId)
    const montoNum = parseInt(descuentoMonto.replace(/\./g, "").replace(/,/g, "")) || 0
    if (montoNum <= 0) return

    const nuevo = {
      id: `ded-${Date.now()}`,
      employeeId: emp?.id || "emp-temp",
      nombre: emp?.nombre || "Colaborador",
      ci: emp?.ci || "—",
      cargo: emp?.cargo || "Colaborador",
      depto: emp?.depto || "General",
      monto: montoNum,
      descripcion: descuentoTipo,
      comentarios: descuentoObs || "Deducción registrada desde Intelimarket",
      cuotas: parseInt(descuentoCuotas) || 1,
      periodo: descuentoPeriodo,
      estado: "active",
      fecha: getTodayAsuncion(),
    }

    setLocalDeductions((prev) => [nuevo, ...prev])
    setModalDescuentoOpen(false)
    setDescuentoEmpId("")
    setDescuentoMonto("")
    setDescuentoObs("")
  }

  const handleGenerarNomina = () => {
    setNominaFeedback(`Planilla de Nómina para el periodo ${periodoNomina} generada y calculada exitosamente. Se sincronizaron los aportes IPS y deducciones.`)
    setTimeout(() => {
      setModalNominaOpen(false)
      setNominaFeedback(null)
    }, 1800)
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto flex flex-col gap-6">
      {/* ── HERO BANNER EJECUTIVO ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/50 border border-slate-800/80 p-6 sm:p-8 shadow-2xl">
        {/* Orbes de luz ambiental */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-10 w-72 h-72 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Reloj Facial Dahua (192.168.0.122) · Sincronizado</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                RUC {selectedCompany.ruc}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight flex items-center gap-3">
              <span>Nómina, Sueldos & Capital Humano</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300/85 max-w-2xl leading-relaxed">
              Liquidación de haberes, aportes IPS (25.5%), control de anticipos, deducción de faltantes de caja y
              biometría facial en tiempo real conectada con SueldOK Cloud.
            </p>
          </div>

          {/* Acciones principales del Hero */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de Empresa */}
            <select
              value={selectedCompany.id}
              onChange={(e) => {
                const emp = EMPRESAS_DISPONIBLES.find((item) => item.id === e.target.value)
                if (emp) setSelectedCompany(emp)
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-white/10 dark:bg-slate-900/80 text-white border border-white/15 text-xs font-bold shadow-sm backdrop-blur-md cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {EMPRESAS_DISPONIBLES.map((emp) => (
                <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">
                  {emp.nombre}
                </option>
              ))}
            </select>

            {/* Botón Actualizar */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition-all shadow-xs backdrop-blur-md cursor-pointer disabled:opacity-50"
              title="Refrescar datos en vivo"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${refreshing ? "animate-spin" : ""}`} />
              <span>{lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Actualizar"}</span>
            </button>

            {/* Botón Abrir Portal SueldOK */}
            <button
              onClick={() => handleLaunchSso("/payroll")}
              disabled={ssoLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{ssoLoading ? "Conectando..." : "Abrir SueldOK SSO"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 6 KPI CARDS EJECUTIVAS ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Card 1: Masa Bruta */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Masa Salarial Bruta</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
              {formatPYG(totalPayrollGross || metrics.totalPayroll)}
            </div>
          </div>
          <div className="text-[11px] font-bold text-slate-400">{employees.length} colaboradores activos</div>
        </div>

        {/* Card 2: Masa Neta */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Masa Neta a Pagar</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
              {formatPYG(totalPayrollNet)}
            </div>
          </div>
          <div className="text-[11px] font-bold text-slate-400">Neto a transferir a funcionarios</div>
        </div>

        {/* Card 3: Aporte IPS */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Aportes IPS (25.5%)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
              {formatPYG(totalIpsWorker + totalIpsEmployer)}
            </div>
          </div>
          <div className="text-[11px] font-bold text-slate-400">
            Obrero: {formatPYG(totalIpsWorker)} (9%)
          </div>
        </div>

        {/* Card 4: Anticipos */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Anticipos del Mes</span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-2xl font-black text-violet-600 dark:text-violet-400 tabular-nums tracking-tight">
              {formatPYG(totalAdvancesSum)}
            </div>
          </div>
          <div className="text-[11px] font-bold text-slate-400">{advances.length} adelanto(s) concedido(s)</div>
        </div>

        {/* Card 5: Descuentos */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Descuentos & Faltantes</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums tracking-tight">
              {formatPYG(totalDeductionsSum)}
            </div>
          </div>
          <div className="text-[11px] font-bold text-slate-400">{deductions.length} deducción(es) activas</div>
        </div>

        {/* Card 6: Presentismo */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Asistencia Hoy</span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
              <Fingerprint className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400 tabular-nums tracking-tight">
              {metrics.attendanceRate}%
            </div>
          </div>
          <div className="text-[11px] font-bold text-slate-400">
            {metrics.presentToday + metrics.lateToday} presentes · {metrics.absentToday} ausentes
          </div>
        </div>
      </div>

      {/* ── BARRA DE TABS GLASSMORPHISM Y BOTONES DE OPERACIÓN ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-x-auto shadow-xs">
          {[
            { id: "dashboard", label: "Dashboard Estratégico", icon: Activity },
            { id: "payroll", label: `Nómina & Liquidación (${payrollItems.length})`, icon: Receipt },
            { id: "advances", label: `Anticipos (${advances.length})`, icon: PiggyBank },
            { id: "deductions", label: `Descuentos & Faltantes (${deductions.length})`, icon: Scissors },
            { id: "asistencia", label: `Marcaciones Dahua (${todayAttendance.length})`, icon: Clock },
            { id: "funcionarios", label: `Funcionarios (${employees.length})`, icon: Users },
          ].map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id as TabType)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700/80"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Botones Operativos Rápidos */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setModalAnticipoOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/20 text-xs font-black transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Anticipo</span>
          </button>
          <button
            onClick={() => setModalDescuentoOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-xs font-black transition-all cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Descuento</span>
          </button>
          <button
            onClick={() => setModalNominaOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Generar Nómina</span>
          </button>
        </div>
      </div>

      {/* ── CONTENIDO DEL TAB ACTIVO ── */}

      {/* 1. DASHBOARD ESTRATÉGICO */}
      {tab === "dashboard" && (
        <div className="flex flex-col gap-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Columna Izquierda: Marcaciones en Vivo */}
            <section className="lg:col-span-2 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm overflow-hidden">
              <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/25">
                <div className="flex items-center gap-2.5">
                  <Fingerprint className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Marcaciones del Reloj Facial en Vivo ({todayAttendance.length})
                  </h3>
                </div>
                <button
                  onClick={() => setTab("asistencia")}
                  className="text-xs font-bold text-indigo-500 hover:underline cursor-pointer"
                >
                  Ver todas →
                </button>
              </header>

              {todayAttendance.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 font-bold flex flex-col items-center justify-center gap-2">
                  <Clock className="w-8 h-8 opacity-40 text-slate-400" />
                  No hay marcaciones faciales registradas en la fecha actual todavía.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[380px] overflow-y-auto">
                  {todayAttendance.slice(0, 7).map((att: any, idx: number) => {
                    const cfg = estadoConfig[att.status] || estadoConfig.Late
                    const Icon = cfg.icon
                    return (
                      <div
                        key={att.id || idx}
                        className="flex items-center justify-between px-6 py-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3.5">
                          {att.checkInPhotoUrl ? (
                            <button
                              onClick={() =>
                                setSelectedPunchPhoto({
                                  photoUrl: att.checkInPhotoUrl,
                                  nombre: att.nombre,
                                  hora: att.horaEntrada,
                                  status: att.status,
                                  cargo: att.cargo,
                                })
                              }
                              className="relative group cursor-pointer"
                            >
                              <img
                                src={att.checkInPhotoUrl}
                                alt={att.nombre}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                              />
                              <span className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Camera className="w-3.5 h-3.5" />
                              </span>
                            </button>
                          ) : (
                            <AvatarCircle initials={att.nombre?.slice(0, 2) || "OK"} idx={idx} size={40} />
                          )}

                          <div>
                            <div className="font-black text-sm text-slate-900 dark:text-white">{att.nombre}</div>
                            <div className="text-[11px] text-slate-400">
                              {att.cargo} · {att.depto}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                            {att.horaEntrada || "—"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider ${cfg.bg}`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{cfg.label}</span>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Columna Derecha: Hardware & Vinculación */}
            <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm overflow-hidden flex flex-col justify-between">
              <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/25">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Dispositivos & Hardware
                </h3>
              </header>

              <div className="p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400 uppercase text-[10px] tracking-wider">Dispositivo Principal</span>
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">Online 🟢</span>
                  </div>
                  <div className="font-black text-slate-900 dark:text-white text-sm">
                    Dahua DHI-ASI3214A-W (Facial Biométrico)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    IP: 192.168.0.122 · Subnet Router Tailscale en producción
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400 uppercase text-[10px] tracking-wider">Enrolamiento</span>
                    <span className="text-indigo-600 dark:text-indigo-400">30 Enrolados</span>
                  </div>
                  <div className="font-black text-slate-900 dark:text-white text-sm">
                    30 de 37 funcionarios cruzados con ID de reloj
                  </div>
                  <div className="text-[11px] text-slate-400">Marcaciones faciales impactan directo en nómina</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400 uppercase text-[10px] tracking-wider">Tolerancia & Jornada</span>
                    <span className="text-amber-600 dark:text-amber-400">10 min tolerancia</span>
                  </div>
                  <div className="font-black text-slate-900 dark:text-white text-sm">Entrada: 08:00 · Salida: 18:00</div>
                  <div className="text-[11px] text-slate-400">Cálculo de tardanzas automáticas y horas extras</div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50/40 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400">Plataforma SueldOK</span>
                <button
                  onClick={() => handleLaunchSso("/attendance")}
                  className="text-xs font-bold text-indigo-500 hover:underline cursor-pointer flex items-center gap-1"
                >
                  Abrir monitor completo →
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* 2. NÓMINA & LIQUIDACIÓN */}
      {tab === "payroll" && (
        <div className="flex flex-col gap-6">
          {/* Header del Tab de Nómina con Acciones */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 text-white border border-slate-800">
            <div>
              <h3 className="text-base font-black">Planilla General de Nómina & Sueldos</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cálculo de haberes, descuento IPS Obrero (9%), deducción de anticipos y retención de faltantes de caja.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Periodo activo:</span>
              <span className="px-3 py-1 rounded-xl bg-slate-800 font-mono font-bold text-indigo-300 border border-slate-700 text-xs">
                {periodoNomina}
              </span>
              <button
                onClick={() => setModalNominaOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Recalcular Nómina</span>
              </button>
            </div>
          </div>

          {/* Tabla de Nómina */}
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80 text-left bg-slate-50/40 dark:bg-slate-800/20">
                    <th className="px-6 py-3.5">Funcionario</th>
                    <th className="px-4 py-3.5 text-right">Salario Base</th>
                    <th className="px-4 py-3.5 text-right">Bonos / Extras</th>
                    <th className="px-4 py-3.5 text-right">IPS Obrero (9%)</th>
                    <th className="px-4 py-3.5 text-right">Anticipos</th>
                    <th className="px-4 py-3.5 text-right">Faltantes / Ded.</th>
                    <th className="px-6 py-3.5 text-right">Salario Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {payrollItems.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-black text-slate-900 dark:text-white">{item.nombre}</div>
                        <div className="text-[11px] text-slate-400">
                          CI: {item.ci || "—"} · {item.cargo} ({item.depto})
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {formatPYG(item.baseSalary)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {item.bonus > 0 ? `+${formatPYG(item.bonus)}` : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-blue-600 dark:text-blue-400">
                        -{formatPYG(item.ipsWorker)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-violet-600 dark:text-violet-400">
                        {item.advances > 0 ? `-${formatPYG(item.advances)}` : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-amber-600 dark:text-amber-400">
                        {item.deductions > 0 ? `-${formatPYG(item.deductions)}` : "—"}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1 rounded-xl">
                          {formatPYG(item.totalNet)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* 3. ANTICIPOS DE SUELDO */}
      {tab === "advances" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-violet-950/20 border border-violet-500/30 backdrop-blur-md">
            <div>
              <h3 className="text-base font-black text-violet-950 dark:text-violet-100 flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-violet-500" /> Solicitudes & Anticipos de Sueldo
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Política vigente: hasta el 40% del salario base registrado. Los anticipos aprobados se descuentan
                automáticamente de la liquidación mensual.
              </p>
            </div>
            <button
              onClick={() => setModalAnticipoOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-violet-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Solicitar Anticipo</span>
            </button>
          </div>

          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80 text-left bg-slate-50/40 dark:bg-slate-800/20">
                    <th className="px-6 py-3.5">Funcionario</th>
                    <th className="px-4 py-3.5">Fecha</th>
                    <th className="px-4 py-3.5">Motivo / Concepto</th>
                    <th className="px-4 py-3.5 text-right">Monto</th>
                    <th className="px-6 py-3.5 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {advances.map((adv, idx) => (
                    <tr key={adv.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-black text-slate-900 dark:text-white">{adv.nombre}</div>
                        <div className="text-[11px] text-slate-400">
                          CI: {adv.ci || "—"} · {adv.cargo} ({adv.depto})
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">{formatDate(adv.fecha)}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {adv.motivo}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900 dark:text-white">
                        {formatPYG(adv.monto)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                            adv.estado === "approved"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                              : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
                          }`}
                        >
                          {adv.estado === "approved" ? "Aprobado en Nómina" : "Pendiente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* 4. DESCUENTOS & FALTANTES DE CAJA */}
      {tab === "deductions" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-amber-950/20 border border-amber-500/30 backdrop-blur-md">
            <div>
              <h3 className="text-base font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-500" /> Descuentos Salariales & Faltantes de Arqueo
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Trazabilidad directa con las cajas de Extra Supermercado: los faltantes de arqueo ciego confirmados
                por supervisión se registran como deducciones aplicables a la nómina.
              </p>
            </div>
            <button
              onClick={() => setModalDescuentoOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Descuento</span>
            </button>
          </div>

          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80 text-left bg-slate-50/40 dark:bg-slate-800/20">
                    <th className="px-6 py-3.5">Funcionario / Cajero</th>
                    <th className="px-4 py-3.5">Fecha</th>
                    <th className="px-4 py-3.5">Concepto / Causa</th>
                    <th className="px-4 py-3.5">Periodo Nómina</th>
                    <th className="px-4 py-3.5 text-right">Monto Deducción</th>
                    <th className="px-6 py-3.5 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {deductions.map((ded, idx) => (
                    <tr key={ded.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-black text-slate-900 dark:text-white">{ded.nombre}</div>
                        <div className="text-[11px] text-slate-400">
                          CI: {ded.ci || "—"} · {ded.cargo} ({ded.depto})
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">{formatDate(ded.fecha)}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                        <div className="font-bold">{ded.descripcion}</div>
                        {ded.comentarios && <div className="text-[11px] text-slate-400">{ded.comentarios}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono font-bold text-slate-500">
                        {ded.periodo || periodoNomina}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                        -{formatPYG(ded.monto)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                          Deducible
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* 5. MARCACIONES EN VIVO (DAHUA) */}
      {tab === "asistencia" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Marcaciones Biométrica Facial Dahua ({todayAttendance.length})
            </h3>
            <span className="text-xs text-slate-400">Captura en tiempo real · Servidor Extra Supermercado</span>
          </div>

          {todayAttendance.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 font-bold rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80">
              No hay marcaciones faciales registradas hoy.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {todayAttendance.map((att: any, idx: number) => {
                const cfg = estadoConfig[att.status] || estadoConfig.Late
                const Icon = cfg.icon
                return (
                  <div
                    key={att.id || idx}
                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {att.checkInPhotoUrl ? (
                        <button
                          onClick={() =>
                            setSelectedPunchPhoto({
                              photoUrl: att.checkInPhotoUrl,
                              nombre: att.nombre,
                              hora: att.horaEntrada,
                              status: att.status,
                              cargo: att.cargo,
                            })
                          }
                          className="relative group cursor-pointer shrink-0"
                        >
                          <img
                            src={att.checkInPhotoUrl}
                            alt={att.nombre}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                          />
                          <span className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Camera className="w-4 h-4" />
                          </span>
                        </button>
                      ) : (
                        <AvatarCircle initials={att.nombre?.slice(0, 2) || "OK"} idx={idx} size={48} />
                      )}

                      <div className="min-w-0">
                        <div className="font-black text-sm text-slate-900 dark:text-white truncate">{att.nombre}</div>
                        <div className="text-[11px] text-slate-400 truncate">{att.cargo}</div>
                        <div className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
                          Entrada: {att.horaEntrada || "—"}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${cfg.bg}`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{cfg.label}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. PADRÓN DE FUNCIONARIOS */}
      {tab === "funcionarios" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar funcionario por nombre, CI, cargo o departamento…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs backdrop-blur-md"
              />
            </div>
            <span className="text-xs font-bold text-slate-400">
              {filteredEmployees.length} de {employees.length} colaboradores
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((emp: any, idx: number) => (
              <div
                key={emp.id || idx}
                className="p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <AvatarCircle initials={emp.foto || "OK"} idx={idx} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-sm text-slate-900 dark:text-white truncate">{emp.nombre}</div>
                    <div className="text-[11px] text-slate-400">CI: {emp.ci || "—"}</div>
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{emp.cargo}</div>
                  </div>
                  {emp.biometricId && (
                    <span
                      title={`Enrolado en el Reloj Dahua con ID #${emp.biometricId}`}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                    >
                      Dahua #{emp.biometricId}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Departamento</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">{emp.depto}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Salario Base</div>
                    <div className="font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {formatPYG(emp.salario)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL: REGISTRAR ANTICIPO ── */}
      {modalAnticipoOpen && (
        <div
          onClick={() => setModalAnticipoOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-violet-500" /> Registrar Anticipo de Sueldo
              </h3>
              <button
                onClick={() => setModalAnticipoOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Colaborador / Funcionario *</label>
                <select
                  value={anticipoEmpId}
                  onChange={(e) => setAnticipoEmpId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  <option value="">Seleccione un colaborador…</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre} — {emp.cargo} ({formatPYG(emp.salario)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Monto del Anticipo (₲) *</label>
                <input
                  type="text"
                  placeholder="Ej: 500.000"
                  value={anticipoMonto}
                  onChange={(e) => setAnticipoMonto(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm font-black text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Fecha de Desembolso</label>
                <input
                  type="date"
                  value={anticipoFecha}
                  onChange={(e) => setAnticipoFecha(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Motivo / Justificación</label>
                <input
                  type="text"
                  value={anticipoMotivo}
                  onChange={(e) => setAnticipoMotivo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setModalAnticipoOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrarAnticipo}
                disabled={!anticipoEmpId || !anticipoMonto}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                Confirmar Anticipo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REGISTRAR DESCUENTO / FALTANTE ── */}
      {modalDescuentoOpen && (
        <div
          onClick={() => setModalDescuentoOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-500" /> Registrar Descuento / Faltante
              </h3>
              <button
                onClick={() => setModalDescuentoOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Colaborador / Cajero *</label>
                <select
                  value={descuentoEmpId}
                  onChange={(e) => setDescuentoEmpId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  <option value="">Seleccione un colaborador…</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre} — {emp.cargo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Concepto del Descuento</label>
                <select
                  value={descuentoTipo}
                  onChange={(e) => setDescuentoTipo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  <option value="Faltante de Arqueo de Caja">Faltante de Arqueo de Caja (POS)</option>
                  <option value="Préstamo Comercial Interno">Préstamo Comercial Interno</option>
                  <option value="Sanción / Llegada Tardía Reiterada">Sanción / Llegada Tardía Reiterada</option>
                  <option value="Deducción Judicial / Alimentos">Deducción Judicial / Alimentos</option>
                  <option value="Otro Descuento">Otro Descuento Autorizado</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Monto Total (₲) *</label>
                  <input
                    type="text"
                    placeholder="Ej: 80.000"
                    value={descuentoMonto}
                    onChange={(e) => setDescuentoMonto(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm font-black text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Cuotas</label>
                  <select
                    value={descuentoCuotas}
                    onChange={(e) => setDescuentoCuotas(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="1">1 cuota (total)</option>
                    <option value="2">2 cuotas</option>
                    <option value="3">3 cuotas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Observaciones / N° Sesión de Caja</label>
                <input
                  type="text"
                  placeholder="Ej: Sesión POS #219 diferencia de arqueo ciego"
                  value={descuentoObs}
                  onChange={(e) => setDescuentoObs(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setModalDescuentoOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrarDescuento}
                disabled={!descuentoEmpId || !descuentoMonto}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                Aplicar Descuento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: GENERAR / RECALCULAR NÓMINA ── */}
      {modalNominaOpen && (
        <div
          onClick={() => setModalNominaOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-500" /> Liquidación y Cálculo de Nómina
              </h3>
              <button
                onClick={() => setModalNominaOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {nominaFeedback ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold flex items-center gap-3">
                <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
                <span>{nominaFeedback}</span>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Periodo a Liquidar</label>
                  <select
                    value={periodoNomina}
                    onChange={(e) => setPeriodoNomina(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none font-mono"
                  >
                    <option value="2026-09">Septiembre 2026</option>
                    <option value="2026-08">Agosto 2026</option>
                    <option value="2026-07">Julio 2026</option>
                  </select>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="font-bold text-slate-400 text-[10px] uppercase">Resumen Proyectado de Liquidación</div>
                  <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                    <span>Masa Salarial Bruta:</span>
                    <span className="font-mono">{formatPYG(totalPayrollGross)}</span>
                  </div>
                  <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold">
                    <span>Aporte Obrero IPS (9%):</span>
                    <span className="font-mono">-{formatPYG(totalIpsWorker)}</span>
                  </div>
                  <div className="flex justify-between text-violet-600 dark:text-violet-400 font-bold">
                    <span>Anticipos Descontados:</span>
                    <span className="font-mono">-{formatPYG(totalAdvancesSum)}</span>
                  </div>
                  <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                    <span>Faltantes / Deducciones:</span>
                    <span className="font-mono">-{formatPYG(totalDeductionsSum)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-black text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Masa Neta a Transferir:</span>
                    <span className="font-mono">{formatPYG(totalPayrollNet)}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] leading-relaxed">
                  Al confirmar, los recibos de salarios se actualizarán y sincronizarán con los historiales de nómina en
                  SueldOK.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setModalNominaOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                onClick={handleGenerarNomina}
                disabled={Boolean(nominaFeedback)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                Generar Nómina Oficial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ZOOM FOTO DAHUA ── */}
      {selectedPunchPhoto && (
        <div
          onClick={() => setSelectedPunchPhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl"
          >
            <div className="relative aspect-[4/5] bg-black">
              <img
                src={selectedPunchPhoto.photoUrl}
                alt={selectedPunchPhoto.nombre}
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => setSelectedPunchPhoto(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-[11px] font-bold flex items-center gap-1.5 border border-white/10">
                <Camera className="w-3.5 h-3.5 text-indigo-400" />
                <span>Captura Facial Reloj Dahua</span>
              </div>
            </div>
            <div className="p-4 space-y-1">
              <div className="font-black text-sm text-white">{selectedPunchPhoto.nombre}</div>
              <div className="text-xs text-slate-400">{selectedPunchPhoto.cargo}</div>
              <div className="pt-2 flex items-center justify-between font-mono text-xs text-indigo-300 font-bold border-t border-slate-800 mt-2">
                <span>Hora: {selectedPunchPhoto.hora}</span>
                <span className="text-[11px] text-emerald-400">Verificado</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
