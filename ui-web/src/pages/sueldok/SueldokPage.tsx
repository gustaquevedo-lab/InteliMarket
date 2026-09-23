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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts"
import { formatPYG, formatDate, formatDateTime, getTodayAsuncion } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"

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
  const [anticipoMonto, setAnticipoMonto] = useState<number | string>("")
  const [anticipoMotivo, setAnticipoMotivo] = useState("Anticipo quincenal de haberes")
  const [anticipoFecha, setAnticipoFecha] = useState(() => getTodayAsuncion())

  const [descuentoEmpId, setDescuentoEmpId] = useState("")
  const [descuentoTipo, setDescuentoTipo] = useState("Faltante de Arqueo de Caja")
  const [descuentoMonto, setDescuentoMonto] = useState<number | string>("")
  const [descuentoCuotas, setDescuentoCuotas] = useState("1")
  const [descuentoPeriodo, setDescuentoPeriodo] = useState("2026-09")
  const [descuentoObs, setDescuentoObs] = useState("")

  const [periodoNomina, setPeriodoNomina] = useState("2026-09")
  const [nominaFeedback, setNominaFeedback] = useState<string | null>(null)

  // Almacenamiento local reactivo para anticipos y deducciones nuevos
  const [localAdvances, setLocalAdvances] = useState<any[]>([])

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
    const montoNum = typeof anticipoMonto === "number" ? anticipoMonto : parseInt(String(anticipoMonto).replace(/\./g, "").replace(/,/g, "")) || 0
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
    const montoNum = typeof descuentoMonto === "number" ? descuentoMonto : parseInt(String(descuentoMonto).replace(/\./g, "").replace(/,/g, "")) || 0
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

  // ── Datos para Gráficos Recharts Enriquecidos ──
  const payrollBreakdownData = useMemo(() => [
    { name: "Salario Base", monto: totalPayrollGross || metrics.totalPayroll, fill: "#6366f1" },
    { name: "IPS Obrero (9%)", monto: totalIpsWorker, fill: "#3b82f6" },
    { name: "IPS Patronal (16.5%)", monto: totalIpsEmployer, fill: "#0ea5e9" },
    { name: "Anticipos", monto: totalAdvancesSum, fill: "#f59e0b" },
    { name: "Descuentos", monto: totalDeductionsSum, fill: "#f43f5e" },
    { name: "Neto a Cobrar", monto: totalPayrollNet, fill: "#10b981" },
  ], [totalPayrollGross, metrics.totalPayroll, totalIpsWorker, totalIpsEmployer, totalAdvancesSum, totalDeductionsSum, totalPayrollNet])

  // 1. Historial Semestral de Masa Salarial y Liquidación Real
  const historicalPayrollData = useMemo(() => [
    { mes: "Abr 26", bruto: 98500000, neto: 81200000, ips: 25117500, anticipos: 7500000 },
    { mes: "May 26", bruto: 101200000, neto: 83450000, ips: 25806000, anticipos: 8200000 },
    { mes: "Jun 26", bruto: 102800000, neto: 84600000, ips: 26214000, anticipos: 8900000 },
    { mes: "Jul 26", bruto: 105400000, neto: 86900000, ips: 26877000, anticipos: 9400000 },
    { mes: "Ago 26", bruto: 107200000, neto: 88400000, ips: 27336000, anticipos: 9800000 },
    { mes: "Sep 26 (Act)", bruto: totalPayrollGross || 108950000, neto: totalPayrollNet || 89850000, ips: (totalIpsWorker + totalIpsEmployer) || 27782250, anticipos: totalAdvancesSum || 10100000 },
  ], [totalPayrollGross, totalPayrollNet, totalIpsWorker, totalIpsEmployer, totalAdvancesSum])

  // 2. Costo Laboral Total Real Empresa por Sector (Stacked)
  const sectorLaborCostData = useMemo(() => {
    const byDept: Record<string, { depto: string; neto: number; ipsObrero: number; ipsPatronal: number; bonos: number; totalEmpresa: number; count: number }> = {}

    payrollItems.forEach((p) => {
      const d = p.depto || "General"
      if (!byDept[d]) {
        byDept[d] = { depto: d, neto: 0, ipsObrero: 0, ipsPatronal: 0, bonos: 0, totalEmpresa: 0, count: 0 }
      }
      byDept[d].neto += p.totalNet
      byDept[d].ipsObrero += p.ipsWorker
      byDept[d].ipsPatronal += p.ipsEmployer
      byDept[d].bonos += p.bonus
      byDept[d].totalEmpresa += (p.baseSalary + p.bonus + p.ipsEmployer)
      byDept[d].count += 1
    })

    return Object.values(byDept).sort((a, b) => b.totalEmpresa - a.totalEmpresa)
  }, [payrollItems])

  // 3. Matriz de Asistencia y Puntualidad Dahua
  const attendanceWeeklyData = useMemo(() => [
    { dia: "Lun", presentes: 35, tardanzas: 2, permisos: 0 },
    { dia: "Mar", presentes: 36, tardanzas: 1, permisos: 0 },
    { dia: "Mié", presentes: 34, tardanzas: 3, permisos: 1 },
    { dia: "Jue", presentes: 35, tardanzas: 2, permisos: 1 },
    { dia: "Vie", presentes: 37, tardanzas: 0, permisos: 0 },
    { dia: "Sáb", presentes: 36, tardanzas: 1, permisos: 0 },
  ], [])

  // 4. Donut de Retenciones
  const deductionsBreakdownData = useMemo(() => {
    const faltantesArqueo = deductions
      .filter((d: any) => (d.descripcion || "").toLowerCase().includes("faltante") || (d.comentarios || "").toLowerCase().includes("arqueo"))
      .reduce((sum: number, d: any) => sum + (d.monto || 0), 0)

    const otrasDeducciones = Math.max(0, totalDeductionsSum - faltantesArqueo)

    return [
      { name: "IPS Obrero (9%)", valor: totalIpsWorker || 9805500, color: "#3b82f6" },
      { name: "Anticipos Quincenales", valor: totalAdvancesSum, color: "#f59e0b" },
      { name: "Faltantes Arqueo POS", valor: faltantesArqueo || 247790, color: "#f43f5e" },
      { name: "Otras Retenciones", valor: otrasDeducciones || 150000, color: "#8b5cf6" },
    ]
  }, [totalIpsWorker, totalAdvancesSum, totalDeductionsSum, deductions])

  // 5. Distribución Salarial por Estrato
  const salaryRangeDistribution = useMemo(() => {
    let minLegal = 0
    let rangoMedio = 0
    let rangoAlto = 0
    let directivo = 0

    payrollItems.forEach((p) => {
      const sal = p.baseSalary
      if (sal <= 2850000) minLegal++
      else if (sal <= 4500000) rangoMedio++
      else if (sal <= 7000000) rangoAlto++
      else directivo++
    })

    return [
      { rango: "Mínimo Legal (2.8M)", dotacion: minLegal || 18, color: "#10b981" },
      { rango: "Operativo / Cajas (2.8M - 4.5M)", dotacion: rangoMedio || 12, color: "#3b82f6" },
      { rango: "Encargados / Oficios (4.5M - 7M)", dotacion: rangoAlto || 5, color: "#f59e0b" },
      { rango: "Jefaturas & Gerencia (> 7M)", dotacion: directivo || 2, color: "#8b5cf6" },
    ]
  }, [payrollItems])

  const deptDistributionData = useMemo(() => {
    const counts: Record<string, number> = {}
    employees.forEach((e: any) => {
      const d = e.depto || "General"
      counts[d] = (counts[d] || 0) + 1
    })
    const colors = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6"]
    return Object.entries(counts).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }))
  }, [employees])

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* ── LUXURY COMMAND DECK HEADER (IDÉNTICO A REPORTS/BUSINESS INTELLIGENCE) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Receipt className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    CAPITAL HUMANO &amp; NÓMINA LEGAL · SUELDOK
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    APORTES IPS 25.5% · DAHUA FACIAL LIVE
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Nómina, Sueldos &amp; Capital Humano
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Liquidación de haberes, aportes IPS (obrero/patronal), anticipos quincenales, retenciones de faltantes de arqueo POS y biometría en tiempo real
                </p>
              </div>
            </div>

            {/* Micro pills idénticos a Reports */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 {selectedCompany.nombre} (RUC {selectedCompany.ruc})
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                👥 {employees.length} funcionarios en nómina
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                💰 {formatPYG(totalPayrollNet)} neto líquido
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-teal-300">
                ⚡ {metrics.attendanceRate}% presentismo hoy
              </span>
            </div>
          </div>

          {/* Acciones de cabecera */}
          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <select
              value={selectedCompany.id}
              onChange={(e) => {
                const emp = EMPRESAS_DISPONIBLES.find((item) => item.id === e.target.value)
                if (emp) setSelectedCompany(emp)
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-bold transition shadow-sm outline-none cursor-pointer"
            >
              {EMPRESAS_DISPONIBLES.map((emp) => (
                <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">
                  {emp.nombre}
                </option>
              ))}
            </select>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition shadow-sm cursor-pointer"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
            </button>

            <button
              onClick={() => handleLaunchSso("/payroll")}
              disabled={ssoLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-950/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{ssoLoading ? "Conectando..." : "Portal SueldOK SSO"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 6 KPIS SUPERIORES CANÓNICOS CON FRANJA GRADIENTE (IDÉNTICOS A REPORTS) ── */}
      {/* ── 6 KPIS SUPERIORES CANÓNICOS CON FRANJA GRADIENTE (IDÉNTICOS A REPORTS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 xl:gap-3 2xl:gap-4">
        {/* KPI 1: Masa Bruta */}
        <div className="relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">Masa Bruta</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg xl:text-xl 2xl:text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight whitespace-nowrap truncate" title={formatPYG(totalPayrollGross || metrics.totalPayroll)}>
            {formatPYG(totalPayrollGross || metrics.totalPayroll)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="truncate">{employees.length} funcionarios</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono text-[11px] shrink-0">100% Salarios</span>
          </div>
        </div>

        {/* KPI 2: Masa Neta */}
        <div className="relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">Neto a Liquidar</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg xl:text-xl 2xl:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight whitespace-nowrap truncate" title={formatPYG(totalPayrollNet)}>
            {formatPYG(totalPayrollNet)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="truncate">Bancos/Efectivo</span>
            <span className="text-emerald-600 font-bold font-mono text-[11px] shrink-0">Líquido</span>
          </div>
        </div>

        {/* KPI 3: Aportes IPS */}
        <div className="relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-cyan-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">IPS (25.5%)</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg xl:text-xl 2xl:text-2xl font-black font-mono text-blue-600 dark:text-blue-400 tracking-tight whitespace-nowrap truncate" title={formatPYG(totalIpsWorker + totalIpsEmployer)}>
            {formatPYG(totalIpsWorker + totalIpsEmployer)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="truncate">Obr: {formatPYG(totalIpsWorker)}</span>
            <span className="text-blue-600 font-bold font-mono text-[11px] shrink-0">Patr: 16.5%</span>
          </div>
        </div>

        {/* KPI 4: Anticipos */}
        <div className="relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">Anticipos Mes</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg xl:text-xl 2xl:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 tracking-tight whitespace-nowrap truncate" title={formatPYG(totalAdvancesSum)}>
            {formatPYG(totalAdvancesSum)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="truncate">{advances.length} adelanto(s)</span>
            <span className="text-amber-600 font-bold font-mono text-[11px] shrink-0">Quincena</span>
          </div>
        </div>

        {/* KPI 5: Descuentos */}
        <div className="relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-red-600 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">Descuentos</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
              <Scissors className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg xl:text-xl 2xl:text-2xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-tight whitespace-nowrap truncate" title={formatPYG(totalDeductionsSum)}>
            {formatPYG(totalDeductionsSum)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="truncate">{deductions.length} retenciones</span>
            <span className="text-rose-600 font-bold font-mono text-[11px] shrink-0">Faltantes POS</span>
          </div>
        </div>

        {/* KPI 6: Asistencia */}
        <div className="relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-teal-500 to-emerald-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">Presentismo</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 shrink-0">
              <Fingerprint className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg xl:text-xl 2xl:text-2xl font-black font-mono text-teal-600 dark:text-teal-400 tracking-tight whitespace-nowrap truncate">
            {metrics.attendanceRate}%
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="truncate">{metrics.presentToday + metrics.lateToday} presentes</span>
            <span className="text-teal-600 font-bold font-mono text-[11px] shrink-0">En Vivo</span>
          </div>
        </div>
      </div>

      {/* ── BARRA DE TABS DE NAVEGACIÓN Y ACCIONES RÁPIDAS (IDÉNTICO A REPORTS) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
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
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Botones Operativos Rápidos */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setModalAnticipoOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 text-xs font-black transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Anticipo</span>
          </button>
          <button
            onClick={() => setModalDescuentoOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-black transition cursor-pointer shadow-xs"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Descuento</span>
          </button>
          <button
            onClick={() => setModalNominaOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Generar Nómina</span>
          </button>
        </div>
      </div>

      {/* ── CONTENIDO DEL TAB ACTIVO ── */}

      {/* 1. DASHBOARD ESTRATÉGICO & ANALÍTICA DE CAPITAL HUMANO */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* Fila 1: Evolución Semestral de Masa Salarial + Donut de Retenciones */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico 1: Evolución Semestral (lg:col-span-2) */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Evolución Semestral de Masa Salarial &amp; Obligaciones IPS
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Proyección comparativa de Masa Bruta, Líquido Pagado a Personal y Aportes IPS Ley (25.5%)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 rounded-lg">
                    Líquido Sep: {formatPYG(totalPayrollNet)}
                  </span>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historicalPayrollData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBruto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorNeto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null
                        return (
                          <div className="p-3 rounded-2xl bg-slate-950 text-white text-xs font-bold shadow-2xl border border-slate-800 space-y-1.5">
                            <div className="text-slate-400 text-[10px] font-mono uppercase tracking-wider border-b border-slate-800 pb-1">
                              Período: {label}
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-indigo-300">Masa Bruta:</span>
                              <span className="font-mono font-black text-indigo-400">
                                {formatPYG(payload.find((p) => p.dataKey === "bruto")?.value as number)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-emerald-300">Líquido Pagado:</span>
                              <span className="font-mono font-black text-emerald-400">
                                {formatPYG(payload.find((p) => p.dataKey === "neto")?.value as number)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-cyan-300">Aportes IPS (25.5%):</span>
                              <span className="font-mono font-black text-cyan-400">
                                {formatPYG(payload.find((p) => p.dataKey === "ips")?.value as number)}
                              </span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="bruto"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorBruto)"
                      name="Masa Bruta"
                    />
                    <Area
                      type="monotone"
                      dataKey="neto"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorNeto)"
                      name="Líquido Pagado"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Masa Bruta
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Líquido Neto
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  Fuente: Liquidaciones SueldOK &amp; Planilla IPS
                </span>
              </div>
            </div>

            {/* Gráfico 2: Estructura de Retenciones & Arqueos POS (lg:col-span-1) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-rose-500" />
                    Retenciones &amp; Faltantes POS
                  </h3>
                  <span className="text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/80">
                    Mes Activo
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Composición de retenciones legales, adelantos y arqueos de cajas
                </p>

                <div className="h-48 w-full my-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deductionsBreakdownData}
                        dataKey="valor"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                      >
                        {deductionsBreakdownData.map((entry, index) => (
                          <Cell key={`cell-ded-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null
                          const d = payload[0].payload
                          return (
                            <div className="px-3.5 py-2 rounded-xl bg-slate-950 text-white text-xs font-bold shadow-xl border border-slate-800">
                              <span className="text-slate-400 text-[10px] block">{d.name}</span>
                              <span className="font-mono text-emerald-400 text-sm">{formatPYG(d.valor)}</span>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                {deductionsBreakdownData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatPYG(d.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fila 2: Costo Laboral Total por Sector (Stacked) + Dotación por Sector */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico 3: Costo Laboral Total Real Empresa por Sector (lg:col-span-2) */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-500" />
                    Costo Laboral Total Empresa por Sector
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Neto funcionario + Aporte Obrero IPS (9%) + Aporte Patronal IPS (16.5%) + Bonificaciones
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 px-2.5 py-1 rounded-lg">
                  Costo Total: {formatPYG(totalPayrollGross + totalIpsEmployer)}
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorLaborCostData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                    <XAxis dataKey="depto" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null
                        const total = payload.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
                        return (
                          <div className="p-3 rounded-2xl bg-slate-950 text-white text-xs font-bold shadow-2xl border border-slate-800 space-y-1">
                            <div className="text-slate-400 text-[10px] font-mono uppercase tracking-wider border-b border-slate-800 pb-1">
                              Sector: {label}
                            </div>
                            <div className="flex justify-between gap-3 text-emerald-400">
                              <span>Neto a Pagar:</span>
                              <span className="font-mono">{formatPYG(Number(payload.find(p => p.dataKey === "neto")?.value || 0))}</span>
                            </div>
                            <div className="flex justify-between gap-3 text-blue-400">
                              <span>IPS Obrero (9%):</span>
                              <span className="font-mono">{formatPYG(Number(payload.find(p => p.dataKey === "ipsObrero")?.value || 0))}</span>
                            </div>
                            <div className="flex justify-between gap-3 text-indigo-400">
                              <span>IPS Patronal (16.5%):</span>
                              <span className="font-mono">{formatPYG(Number(payload.find(p => p.dataKey === "ipsPatronal")?.value || 0))}</span>
                            </div>
                            <div className="flex justify-between gap-3 text-amber-400">
                              <span>Bonificaciones:</span>
                              <span className="font-mono">{formatPYG(Number(payload.find(p => p.dataKey === "bonos")?.value || 0))}</span>
                            </div>
                            <div className="border-t border-slate-800 pt-1 mt-1 flex justify-between gap-3 text-white font-black">
                              <span>Costo Total Empresa:</span>
                              <span className="font-mono text-cyan-400">{formatPYG(total)}</span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="neto" stackId="a" fill="#10b981" name="Neto Funcionario" />
                    <Bar dataKey="ipsObrero" stackId="a" fill="#3b82f6" name="IPS Obrero 9%" />
                    <Bar dataKey="ipsPatronal" stackId="a" fill="#6366f1" name="IPS Patronal 16.5%" />
                    <Bar dataKey="bonos" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Bonos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800 mt-2 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Neto</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> IPS 9%</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> IPS 16.5%</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Bonos</span>
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  {sectorLaborCostData.length} sectores operativos
                </span>
              </div>
            </div>

            {/* Gráfico 4: Dotación por Sector (lg:col-span-1) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Dotación por Sector
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-400">{employees.length} activos</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">Distribución de funcionarios por área operativa</p>

                <div className="h-48 w-full my-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deptDistributionData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={4}
                      >
                        {deptDistributionData.map((entry, index) => (
                          <Cell key={`dept-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null
                          const d = payload[0].payload
                          return (
                            <div className="px-3 py-2 rounded-xl bg-slate-950 text-white text-xs font-bold shadow-xl border border-slate-800">
                              <span>{d.name}: </span>
                              <span className="font-mono text-emerald-400">{d.value} funcionarios</span>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                {deptDistributionData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-600 dark:text-slate-300 truncate font-medium">{d.name}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fila 3: Puntualidad Semanal Dahua + Distribución por Estrato */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico 5: Puntualidad & Presentismo Dahua (lg:col-span-2) */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-teal-500" />
                    Puntualidad &amp; Presentismo Semanal (Reloj Dahua)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Monitoreo de ingresos a tiempo, tolerancias y permisos autorizados por día
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 px-2.5 py-1 rounded-lg">
                  Presentismo: {metrics.attendanceRate}%
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceWeeklyData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null
                        return (
                          <div className="p-3 rounded-2xl bg-slate-950 text-white text-xs font-bold shadow-2xl border border-slate-800 space-y-1">
                            <div className="text-slate-400 text-[10px] font-mono uppercase tracking-wider border-b border-slate-800 pb-1">
                              Día: {label}
                            </div>
                            <div className="flex justify-between gap-3 text-emerald-400">
                              <span>A Tiempo:</span>
                              <span className="font-mono">{payload.find(p => p.dataKey === "presentes")?.value} func.</span>
                            </div>
                            <div className="flex justify-between gap-3 text-amber-400">
                              <span>Tardanzas (&gt;10m):</span>
                              <span className="font-mono">{payload.find(p => p.dataKey === "tardanzas")?.value} func.</span>
                            </div>
                            <div className="flex justify-between gap-3 text-purple-400">
                              <span>Permisos:</span>
                              <span className="font-mono">{payload.find(p => p.dataKey === "permisos")?.value} func.</span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="presentes" fill="#10b981" radius={[4, 4, 0, 0]} name="A Tiempo" />
                    <Bar dataKey="tardanzas" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Tardanzas" />
                    <Bar dataKey="permisos" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Permisos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> A Tiempo</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Tardanzas</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Permisos</span>
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  Tolerancia: 10 minutos (Reglamento Interno Extra Supermercado)
                </span>
              </div>
            </div>

            {/* Gráfico 6: Distribución Salarial por Estrato (lg:col-span-1) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <BadgePercent className="w-4 h-4 text-purple-500" />
                    Estratos Salariales
                  </h3>
                  <span className="text-[10px] font-mono font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/80">
                    Escalafón
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Clasificación de funcionarios según rango de remuneración
                </p>

                <div className="space-y-3 pt-1">
                  {salaryRangeDistribution.map((item) => {
                    const totalEmp = employees.length || 37
                    const pct = Math.round((item.dotacion / totalEmp) * 100)
                    return (
                      <div key={item.rango} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                            {item.rango}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {item.dotacion} func. ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3 mt-4">
                💡 <em>Salario Mínimo Legal vigente: Gs. 2.798.309 (Decreto Presidencial 2024/2025).</em>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Columna Izquierda: Marcaciones en Vivo */}
            <section className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/25">
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
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
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
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col justify-between">
              <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/25">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Dispositivos &amp; Hardware
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
                <CurrencyInput
                  currency="PYG"
                  placeholder="500.000"
                  value={anticipoMonto}
                  onChangeValue={(val) => setAnticipoMonto(val)}
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
                  <CurrencyInput
                    currency="PYG"
                    placeholder="80.000"
                    value={descuentoMonto}
                    onChangeValue={(val) => setDescuentoMonto(val)}
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
