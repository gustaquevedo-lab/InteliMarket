import { useState, useEffect } from "react"
import {
  Plus, Search, Loader2, Wallet, Banknote, Award, TrendingUp, ArrowUpRight, ArrowDownRight,
  DollarSign, CheckCircle, XCircle, AlertCircle, CreditCard, AlertTriangle,
  Settings, X, ShieldCheck, Clock, EyeOff, Calculator, FileText, Download,
  Layers, Users, RefreshCw, Printer, Check, ChevronRight, Activity, ShieldAlert,
  Coins, Sparkles, Building2, Store, Lock, KeyRound, Heart, FileSpreadsheet,
  BarChart3, Calendar, Filter, PieChart, Receipt, ClipboardCheck
} from "lucide-react"
import {
  api,
  downloadAuthenticated,
  API_BASE,
  type CashRegister,
  type CashHandoff,
  type DonationStats,
  type DonationLiquidation,
  type DonationRecord,
  type CajeroSolidarioRankingItem,
  type BankAccount,
} from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDateTime, getTodayAsuncion, getAsuncionDateStr } from "../../utils/format"

const downloadPdf = (endpoint: string, filename: string) => downloadAuthenticated(endpoint, undefined, filename)

interface BankMappingItem {
  id: string
  canal_key: string
  canal_label: string
  bank_account_id?: string | null
  banco_nombre?: string | null
  numero_cuenta?: string | null
  moneda?: string | null
  activo: boolean
}

interface ShortageConfigData {
  umbral_aprobacion_gs: number
  requerir_aprobacion_siempre: boolean
  permitir_cuotas: boolean
  max_cuotas: number
}

interface ShortageRequestItem {
  id: string
  session_id: string
  user_id: string
  cajero_nombre: string
  monto_faltante_gs: number
  estado: "PENDIENTE" | "APROBADO_NOMINA" | "CONDONADO_EMPRESA" | "RECHAZADO"
  resolucion: string | null
  cuotas: number
  monto_cuota_gs: number
  periodo_nomina: string | null
  sueldok_sync_status: string
  sueldok_sync_id: string | null
  observaciones: string | null
  aprobado_por: string | null
  aprobado_at: string | null
  created_at: string
}

interface SessionSummary {
  id: string
  register_id: string
  user_id: string
  cajero_nombre: string | null
  fecha_apertura: string
  fecha_cierre: string | null
  monto_apertura: number
  monto_cierre: number | null
  monto_cierre_esperado: number | null
  diferencia: number | null
  diferencia_usd: number | null
  diferencia_brl: number | null
  monto_cobrado: number
  estado: string
  cash_drop_alert: boolean
  efectivo_acumulado: number
  efectivo_usd_acumulado: number
  efectivo_brl_acumulado: number
  ultimo_cash_drop_at: string | null
}

interface PaymentBreakdownItem {
  forma_pago: string
  cantidad: number
  monto: number
  porcentaje: number
}

interface OtraMonedaItem {
  forma_pago: string
  moneda: string
  cantidad: number
  monto: number
}

// Billetes y monedas oficiales de Paraguay (PYG)

const DENOMINACIONES_BRL = [
  { valor: 200, label: "R$ 200" },
  { valor: 100, label: "R$ 100" },
  { valor: 50, label: "R$ 50" },
  { valor: 20, label: "R$ 20" },
  { valor: 10, label: "R$ 10" },
  { valor: 5, label: "R$ 5" },
  { valor: 2, label: "R$ 2" },
  { valor: 1, label: "Moedas R$ 1" },
]

const DENOMINACIONES_USD = [
  { valor: 100, label: "USD 100" },
  { valor: 50, label: "USD 50" },
  { valor: 20, label: "USD 20" },
  { valor: 10, label: "USD 10" },
  { valor: 5, label: "USD 5" },
  { valor: 1, label: "USD 1" },
]

const DENOMINACIONES_PYG = [
  { valor: 100000, label: "₲ 100.000", tipo: "billete" },
  { valor: 50000, label: "₲ 50.000", tipo: "billete" },
  { valor: 20000, label: "₲ 20.000", tipo: "billete" },
  { valor: 10000, label: "₲ 10.000", tipo: "billete" },
  { valor: 5000, label: "₲ 5.000", tipo: "billete" },
  { valor: 2000, label: "₲ 2.000", tipo: "billete" },
  { valor: 1000, label: "₲ 1.000", tipo: "moneda" },
  { valor: 500, label: "₲ 500", tipo: "moneda" },
  { valor: 100, label: "₲ 100", tipo: "moneda" },
  { valor: 50, label: "₲ 50", tipo: "moneda" },
]

export default function CajaPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<"registers" | "sessions" | "entregas" | "historial" | "cajeros" | "donaciones" | "reportes" | "bancos_mapping" | "sueldok_faltantes">("registers")
  
  // ── CENTRO DE REPORTES DE CAJA (PARAGUAY TIMEZONE) ──
  const getInitialPyDate = () => {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date())
  }
  const [repFechaDesde, setRepFechaDesde] = useState(() => getInitialPyDate())
  const [repFechaHasta, setRepFechaHasta] = useState(() => getInitialPyDate())
  const [repCajeroFiltro, setRepCajeroFiltro] = useState("")
  const [repLoading, setRepLoading] = useState(false)
  const [salesByCashierData, setSalesByCashierData] = useState<any | null>(null)
  const [salesByPaymentData, setSalesByPaymentData] = useState<any | null>(null)
  const [repActiveSubTab, setRepActiveSubTab] = useState<"cajeros" | "medios_pago" | "actas">("cajeros")
  const [downloadingRepPdf, setDownloadingRepPdf] = useState(false)

  // ── DONACIONES & RSE ("ABRE TU CORAZÓN" - CENTRO AMOR Y ESPERANZA) ──
  const [donationStats, setDonationStats] = useState<DonationStats | null>(null)
  const [donationRanking, setDonationRanking] = useState<CajeroSolidarioRankingItem[]>([])
  const [donationLiquidations, setDonationLiquidations] = useState<DonationLiquidation[]>([])
  const [donationRecent, setDonationRecent] = useState<DonationRecord[]>([])
  const [donationsLoading, setDonationsLoading] = useState(false)
  const [showLiquidarModal, setShowLiquidarModal] = useState(false)
  const [liquidarDesde, setLiquidarDesde] = useState(() => {
    const today = getTodayAsuncion()
    const [year, month] = today.split("-")
    return `${year}-${month}-01`
  })
  const [liquidarHasta, setLiquidarHasta] = useState(() => getTodayAsuncion())
  const [liquidarEntregadoPor, setLiquidarEntregadoPor] = useState("")
  const [liquidarRecibidoPor, setLiquidarRecibidoPor] = useState("Lic. María Fernández (Directora)")
  const [liquidarRecibidoCi, setLiquidarRecibidoCi] = useState("3.456.789")
  const [liquidarComprobante, setLiquidarComprobante] = useState("")
  const [liquidarObservaciones, setLiquidarObservaciones] = useState("Entrega de fondos de redondeo solidario clientes Extra Supermercado.")
  const [liquidating, setLiquidating] = useState(false)
  const [selectedActaPdf, setSelectedActaPdf] = useState<DonationLiquidation | null>(null)

  const [cajeroPerformance, setCajeroPerformance] = useState<{
    cajero_nombre: string
    total_cierres: number
    monto_total_manejado: number
    diferencia_acumulada: number
    diferencia_promedio: number
    cierres_con_revision: number
    pct_con_revision: number
    ultimo_cierre: string | null
  }[]>([])
  const [cajeroPerformanceLoading, setCajeroPerformanceLoading] = useState(false)
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [historial, setHistorial] = useState<SessionSummary[]>([])
  const [historialLoading, setHistorialLoading] = useState(false)
  const [historialLimit, setHistorialLimit] = useState(250)
  const [handoffs, setHandoffs] = useState<CashHandoff[]>([])
  const [handoffsLoading, setHandoffsLoading] = useState(false)
  const [showConfirmHandoffModal, setShowConfirmHandoffModal] = useState<CashHandoff | null>(null)
  const [supervisorEmail, setSupervisorEmail] = useState("")
  const [supervisorPassword, setSupervisorPassword] = useState("")
  const [montoConfirmado, setMontoConfirmado] = useState("")
  const [confirmingHandoff, setConfirmingHandoff] = useState(false)
  const [closeResult, setCloseResult] = useState<{ diferencia: number; requiere_revision: boolean } | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  // Modales
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showBreakdownModal, setShowBreakdownModal] = useState(false)
  const [showThresholdModal, setShowThresholdModal] = useState<CashRegister | null>(null)
  const [showCashDropModal, setShowCashDropModal] = useState<SessionSummary | null>(null)
  const [breakdown, setBreakdown] = useState<PaymentBreakdownItem[]>([])
  const [otrasMonedas, setOtrasMonedas] = useState<OtraMonedaItem[]>([])
  const [breakdownLoading, setBreakdownLoading] = useState(false)

  // Estados de Formularios
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null)
  const [selectedRegister, setSelectedRegister] = useState<string>("")
  const [montoApertura, setMontoApertura] = useState("0")
  const [montoCierre, setMontoCierre] = useState("0")
  const [montoCierreUsd, setMontoCierreUsd] = useState("0")
  const [montoCierreBrl, setMontoCierreBrl] = useState("0")
  const [observacionesCierre, setObservacionesCierre] = useState("")
  const [newRegisterName, setNewRegisterName] = useState("")
  const [newRegisterCodigo, setNewRegisterCodigo] = useState("")
  const [thresholdValue, setThresholdValue] = useState("0")
  const [diferenciaToleradaValue, setDiferenciaToleradaValue] = useState("0")
  const [cashDropMonto, setCashDropMonto] = useState("0")
  const [cashDropObs, setCashDropObs] = useState("")

  // Reimpresión Térmica ESC/POS
  const [escposModalOpen, setEscposModalOpen] = useState(false)
  const [escposLoading, setEscposLoading] = useState(false)
  const [escposTicketData, setEscposTicketData] = useState<{ session_id: string; ticket_text: string; ticket_escpos_b64: string; reconciliation: any } | null>(null)

  // ── Planilla de Punteo de Arqueo Detallado (Fase 5) ──
  const [punteoModalOpen, setPunteoModalOpen] = useState(false)
  const [punteoLoading, setPunteoLoading] = useState(false)
  const [punteoData, setPunteoData] = useState<any | null>(null)
  const [punteoStatuses, setPunteoStatuses] = useState<Record<string, "conforme" | "faltante" | "discrepante">>({})
  const [punteoDiscrepanciasMonto, setPunteoDiscrepanciasMonto] = useState<Record<string, number>>({})
  const [punteoFilterCanal, setPunteoFilterCanal] = useState("todos")
  const [punteoSearch, setPunteoSearch] = useState("")
  const [punteoObsDictamen, setPunteoObsDictamen] = useState("")
  const [savingPunteoAudit, setSavingPunteoAudit] = useState(false)

  // ── Mapeos de Medios de Pago a Cuentas Bancarias ──
  const [bankMappings, setBankMappings] = useState<BankMappingItem[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankMappingsLoading, setBankMappingsLoading] = useState(false)
  const [savingMappingKey, setSavingMappingKey] = useState<string | null>(null)

  // ── Faltantes & SueldOK ──
  const [shortageConfig, setShortageConfig] = useState<ShortageConfigData | null>(null)
  const [shortageConfigLoading, setShortageConfigLoading] = useState(false)
  const [savingShortageConfig, setSavingShortageConfig] = useState(false)
  const [shortageRequests, setShortageRequests] = useState<ShortageRequestItem[]>([])
  const [shortagesLoading, setShortagesLoading] = useState(false)
  const [shortageFilterEstado, setShortageFilterEstado] = useState("TODOS")
  const [resolvingShortageModal, setResolvingShortageModal] = useState<ShortageRequestItem | null>(null)
  const [shortageResolutionAction, setShortageResolutionAction] = useState<"APROBAR_NOMINA" | "CONDONAR" | "RECHAZAR">("APROBAR_NOMINA")
  const [shortageCuotas, setShortageCuotas] = useState(1)
  const [shortagePeriodoNomina, setShortagePeriodoNomina] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [shortageObs, setShortageObs] = useState("")
  const [resolvingShortageLoading, setResolvingShortageLoading] = useState(false)

  // Asentamiento Bóveda y Bancos
  const [incorporatingSessionId, setIncorporatingSessionId] = useState<string | null>(null)

  // ── Resumen y Detalle de Ventas de la Caja ──
  const [sessionSalesModalOpen, setSessionSalesModalOpen] = useState(false)
  const [selectedSalesSessionId, setSelectedSalesSessionId] = useState<string | null>(null)
  const [sessionSalesData, setSessionSalesData] = useState<any>(null)
  const [sessionSalesLoading, setSessionSalesLoading] = useState(false)
  const [sessionSalesSearch, setSessionSalesSearch] = useState("")
  const [sessionSalesStatusFilter, setSessionSalesStatusFilter] = useState<"todas" | "confirmadas" | "anuladas">("todas")
  const [downloadingSalesPdf, setDownloadingSalesPdf] = useState(false)

  // ── Filtros Avanzados para Historial de Cierres ──
  const [historialCajeroFilter, setHistorialCajeroFilter] = useState("")
  const [historialFechaDesde, setHistorialFechaDesde] = useState("")
  const [historialFechaHasta, setHistorialFechaHasta] = useState("")

  const handleOpenSessionSalesModal = async (sessionId: string) => {
    setSelectedSalesSessionId(sessionId)
    setSessionSalesModalOpen(true)
    setSessionSalesLoading(true)
    setSessionSalesData(null)
    setSessionSalesSearch("")
    setSessionSalesStatusFilter("todas")
    try {
      const data = await api.caja.sessionSales(sessionId)
      setSessionSalesData(data)
    } catch (err: any) {
      toast.error("Error al cargar ventas", err?.message || "No se pudo obtener el detalle de ventas de la caja.")
      setSessionSalesModalOpen(false)
    } finally {
      setSessionSalesLoading(false)
    }
  }

  const handleOpenPunteoModal = async (sessionId: string) => {
    try {
      setPunteoLoading(true)
      setPunteoModalOpen(true)
      setPunteoStatuses({})
      setPunteoDiscrepanciasMonto({})
      setPunteoFilterCanal("todos")
      setPunteoSearch("")
      setPunteoObsDictamen("")
      const data = await api.caja.sessionPunteo(sessionId)
      setPunteoData(data)
      const initStatuses: Record<string, "conforme" | "faltante" | "discrepante"> = {}
      if (data?.vouchers) {
        data.vouchers.forEach((v: any) => {
          initStatuses[v.id] = "conforme"
        })
      }
      setPunteoStatuses(initStatuses)
    } catch (err: any) {
      toast.error("Error al cargar planilla", err?.message || "No se pudo obtener el detalle de vouchers de la sesión.")
      setPunteoModalOpen(false)
    } finally {
      setPunteoLoading(false)
    }
  }

  const handleSetVoucherStatus = (voucherId: string, status: "conforme" | "faltante" | "discrepante") => {
    setPunteoStatuses(prev => ({
      ...prev,
      [voucherId]: status
    }))
  }

  const handleSetAllVoucherStatus = (status: "conforme" | "faltante") => {
    if (!punteoData?.vouchers) return
    const next: Record<string, "conforme" | "faltante" | "discrepante"> = {}
    punteoData.vouchers.forEach((v: any) => {
      next[v.id] = status
    })
    setPunteoStatuses(next)
  }

  const handleSavePunteoAudit = async () => {
    if (!punteoData?.session_data?.id) return
    setSavingPunteoAudit(true)
    try {
      const vouchers = punteoData.vouchers || []
      let difVouchers = 0
      const itemsPayload = vouchers.map((v: any) => {
        const st = punteoStatuses[v.id] || "conforme"
        let montoFisico = v.monto_gs
        if (st === "faltante") {
          montoFisico = 0
          difVouchers -= v.monto_gs
        } else if (st === "discrepante") {
          montoFisico = punteoDiscrepanciasMonto[v.id] !== undefined ? punteoDiscrepanciasMonto[v.id] : v.monto_gs
          difVouchers += (montoFisico - v.monto_gs)
        }
        return {
          voucher_id: v.id,
          estado: st,
          monto_fisico: montoFisico,
        }
      })

      await api.caja.savePunteoAudit(punteoData.session_data.id, {
        items: itemsPayload,
        observaciones_dictamen: punteoObsDictamen.trim() || undefined,
        diferencia_vouchers_gs: difVouchers,
      })

      toast.success("Auditoría Asentada", "Dictamen de control de comprobantes guardado correctamente en la sesión.")
      fetchData()
      fetchHistorial()
    } catch (err: any) {
      toast.error("Error al asentar auditoría", err?.message || "No se pudo registrar el dictamen.")
    } finally {
      setSavingPunteoAudit(false)
    }
  }

  const handleOpenEscposTicket = async (sessionId: string) => {
    try {
      setEscposLoading(true)
      setEscposModalOpen(true)
      const data = await api.caja.sessions.ticketEscpos(sessionId)
      setEscposTicketData(data)
    } catch (err: any) {
      toast.error("Error al cargar ticket", err?.message || "No se pudo obtener el arqueo térmico.")
      setEscposModalOpen(false)
    } finally {
      setEscposLoading(false)
    }
  }

  const handlePrintEscpos = async () => {
    if (!escposTicketData) return
    try {
      if ((window as any).electronAPI?.printEscPos) {
        const res = await (window as any).electronAPI.printEscPos(escposTicketData.ticket_escpos_b64, "ZKP8008")
        if (res?.success) {
          toast.success("Imprimiendo", "Ticket enviado a la impresora térmica ZKP8008.")
          return
        }
      }
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Arqueo de Caja - InteliMarket</title>
              <style>
                body { font-family: monospace; font-size: 12px; white-space: pre; margin: 0; padding: 10px; width: 300px; }
                @media print { @page { margin: 0; size: 80mm auto; } body { width: 100%; } }
              </style>
            </head>
            <body>${escposTicketData.ticket_text}</body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
        printWindow.close()
      }
    } catch (err: any) {
      toast.error("Error al imprimir", err?.message || "Revise la impresora.")
    }
  }

  // Calculadora de Billetes
  const [conteoBilletes, setConteoBilletes] = useState<Record<number, number>>({})

  // Arqueo físico avanzado multimoneda y vouchers
  const [conteoBrl, setConteoBrl] = useState<Record<number, number>>({})
  const [conteoUsd, setConteoUsd] = useState<Record<number, number>>({})
  const [activeArqueoTab, setActiveArqueoTab] = useState<"efectivo" | "vouchers" | "cheques_vales">("efectivo")
  const [vouchersBancard, setVouchersBancard] = useState({ lote: "", cupones: "", total: "" })
  const [vouchersDinelco, setVouchersDinelco] = useState({ lote: "", cupones: "", total: "" })
  const [chequesRecibidos, setChequesRecibidos] = useState({ cantidad: "", total: "" })
  const [creditosClub, setCreditosClub] = useState({ vales: "", total: "" })

  const handleDenominacionBrlChange = (valor: number, cantidad: number) => {
    const next = { ...conteoBrl, [valor]: Math.max(0, cantidad) }
    setConteoBrl(next)
    const total = Object.entries(next).reduce((acc, [v, c]) => acc + Number(v) * c, 0)
    setMontoCierreBrl(String(total))
  }

  const handleDenominacionUsdChange = (valor: number, cantidad: number) => {
    const next = { ...conteoUsd, [valor]: Math.max(0, cantidad) }
    setConteoUsd(next)
    const total = Object.entries(next).reduce((acc, [v, c]) => acc + Number(v) * c, 0)
    setMontoCierreUsd(String(total))
  }

  const [usarCalculadora, setUsarCalculadora] = useState(false)

  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [regsData, sessionsData, handoffsData] = await Promise.allSettled([
        api.caja.registers.list(),
        api.caja.sessionsSummary({ estado: "abierta" }),
        api.caja.handoffs.list(),
      ])
      if (regsData.status === "fulfilled") setRegisters(regsData.value)
      if (sessionsData.status === "fulfilled") setSessions(sessionsData.value)
      if (handoffsData.status === "fulfilled") setHandoffs(handoffsData.value)
      if (regsData.status === "rejected") toast.error("Error de conexión", "Conectá el backend para ver datos reales")
    } catch {
      toast.error("Error", "No se pudieron cargar los datos de caja")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const pendingHandoffs = handoffs.filter(h => h.estado === "pendiente")

  const fetchHistorial = async (lim?: number, overrideFilters?: { fecha_desde?: string; fecha_hasta?: string; cajero?: string }) => {
    setHistorialLoading(true)
    const effectiveLimit = lim ?? historialLimit
    const fDesde = overrideFilters && "fecha_desde" in overrideFilters ? overrideFilters.fecha_desde : historialFechaDesde
    const fHasta = overrideFilters && "fecha_hasta" in overrideFilters ? overrideFilters.fecha_hasta : historialFechaHasta
    const cNom = overrideFilters && "cajero" in overrideFilters ? overrideFilters.cajero : historialCajeroFilter
    try {
      const data = await api.caja.sessionsSummary({
        estado: "cerrada",
        limit: effectiveLimit,
        fecha_desde: fDesde || undefined,
        fecha_hasta: fHasta || undefined,
        cajero_nombre: cNom || undefined,
      })
      setHistorial(data)
    } catch {
      toast.error("Error", "No se pudo cargar el historial de cierres")
    } finally {
      setHistorialLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "historial" && historial.length === 0) fetchHistorial()
  }, [activeTab])

  const fetchCajeroPerformance = async () => {
    setCajeroPerformanceLoading(true)
    try {
      const data = await api.caja.cajeros.performance()
      setCajeroPerformance(data)
    } catch {
      toast.error("Error", "No se pudo cargar el rendimiento de cajeros")
    } finally {
      setCajeroPerformanceLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "cajeros" && cajeroPerformance.length === 0) fetchCajeroPerformance()
  }, [activeTab])

  const fetchDonationsData = async () => {
    setDonationsLoading(true)
    try {
      const [st, rk, lq, rc] = await Promise.allSettled([
        api.donaciones.getStats(),
        api.donaciones.getRankingCajeros(),
        api.donaciones.getLiquidaciones(),
        api.donaciones.getHistorial({ limit: 50 }),
      ])
      if (st.status === "fulfilled") setDonationStats(st.value)
      if (rk.status === "fulfilled") setDonationRanking(rk.value || [])
      if (lq.status === "fulfilled") setDonationLiquidations(lq.value || [])
      if (rc.status === "fulfilled") setDonationRecent(rc.value || [])
    } catch (e) {
      console.error("Error cargando datos de donaciones:", e)
    } finally {
      setDonationsLoading(false)
    }
  }

  const fetchReportesCaja = async (desde = repFechaDesde, hasta = repFechaHasta, cajero = repCajeroFiltro) => {
    setRepLoading(true)
    try {
      const [cashierRes, paymentRes] = await Promise.all([
        api.caja.reports.salesByCashier({
          fecha_desde: desde,
          fecha_hasta: hasta,
          cajero_nombre: cajero.trim() || undefined,
        }),
        api.caja.reports.salesByPaymentMethod({
          fecha_desde: desde,
          fecha_hasta: hasta,
        }),
      ])
      setSalesByCashierData(cashierRes)
      setSalesByPaymentData(paymentRes)
    } catch {
      toast.error("Error", "No se pudieron cargar los reportes de caja")
    } finally {
      setRepLoading(false)
    }
  }

  // ── Mapeos Bancarios Handlers ──
  const fetchBankMappings = async () => {
    setBankMappingsLoading(true)
    try {
      const [maps, bks] = await Promise.all([
        api.caja.bankMappings.list(),
        api.financial.banks.list(),
      ])
      setBankMappings(maps)
      setBankAccounts(bks)
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudieron cargar los mapeos bancarios")
    } finally {
      setBankMappingsLoading(false)
    }
  }

  const handleUpdateBankMapping = async (canalKey: string, bankAccountId: string | null, activo: boolean) => {
    setSavingMappingKey(canalKey)
    try {
      await api.caja.bankMappings.update(canalKey, {
        bank_account_id: bankAccountId || null,
        activo,
      })
      toast.success("Mapeo Bancario Actualizado", `Canal ${canalKey} vinculado exitosamente.`)
      fetchBankMappings()
    } catch (err: any) {
      toast.error("Error al actualizar mapeo", err?.message)
    } finally {
      setSavingMappingKey(null)
    }
  }

  // ── Faltantes & SueldOK Handlers ──
  const fetchShortageData = async () => {
    setShortageConfigLoading(true)
    setShortagesLoading(true)
    try {
      const [cfg, reqs] = await Promise.all([
        api.caja.shortageConfig.get(),
        api.caja.shortages.list(),
      ])
      setShortageConfig(cfg)
      setShortageRequests(reqs)
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudieron cargar las solicitudes de faltantes")
    } finally {
      setShortageConfigLoading(false)
      setShortagesLoading(false)
    }
  }

  const handleSaveShortageConfig = async () => {
    if (!shortageConfig) return
    setSavingShortageConfig(true)
    try {
      await api.caja.shortageConfig.update(shortageConfig)
      toast.success("Configuración Guardada", "Políticas y umbrales de faltantes actualizados.")
    } catch (err: any) {
      toast.error("Error al guardar políticas", err?.message)
    } finally {
      setSavingShortageConfig(false)
    }
  }

  const handleResolveShortage = async () => {
    if (!resolvingShortageModal) return
    setResolvingShortageLoading(true)
    try {
      const res = await api.caja.shortages.resolve(resolvingShortageModal.id, {
        accion: shortageResolutionAction,
        cuotas: shortageResolutionAction === "APROBAR_NOMINA" ? shortageCuotas : 1,
        periodo_nomina: shortagePeriodoNomina,
        observaciones: shortageObs.trim() || undefined,
      })
      toast.success("Resolución Aplicada", res.mensaje || "La solicitud ha sido procesada.")
      setResolvingShortageModal(null)
      setShortageObs("")
      fetchShortageData()
    } catch (err: any) {
      toast.error("Error al resolver faltante", err?.message)
    } finally {
      setResolvingShortageLoading(false)
    }
  }

  // ── Asentar en Bóveda & Bancos ──
  const handleIncorporateVaultAndBanks = async (sessionId: string) => {
    setIncorporatingSessionId(sessionId)
    try {
      const res = await api.caja.incorporateVaultAndBanks(sessionId)
      toast.success(
        "Asentamiento Exitoso",
        `Sesión asentada. Bóveda: ${res.vault_entries_created} ingresos físicos. Bancos: ${res.bank_transactions_created} transacciones enviadas a conciliación.`
      )
      if (res.shortage_request_created) {
        toast.warning(
          "Faltante Detectado",
          `Se abrió un expediente de deducción por ₲ ${formatPYG(res.shortage_monto_gs)} para aprobación de Nómina (SueldOK).`
        )
      }
      fetchData()
      fetchHistorial()
      if (activeTab === "sueldok_faltantes") {
        fetchShortageData()
      }
    } catch (err: any) {
      toast.error("Error al asentar en bóveda/bancos", err?.message)
    } finally {
      setIncorporatingSessionId(null)
    }
  }

  useEffect(() => {
    if (activeTab === "donaciones") fetchDonationsData()
    if (activeTab === "reportes" && !salesByCashierData) fetchReportesCaja()
    if (activeTab === "bancos_mapping") fetchBankMappings()
    if (activeTab === "sueldok_faltantes") fetchShortageData()
  }, [activeTab])

  const handleLiquidarDonaciones = async () => {
    if (!donationStats?.campana_activa?.id) {
      toast.error("Error", "No hay campaña activa para liquidar")
      return
    }
    setLiquidating(true)
    try {
      const res = await api.donaciones.liquidar({
        company_id: donationStats.campana_activa.company_id,
        campana_id: donationStats.campana_activa.id,
        fecha_desde: `${liquidarDesde}T00:00:00Z`,
        fecha_hasta: `${liquidarHasta}T23:59:59Z`,
        entregado_por_nombre: liquidarEntregadoPor || user?.nombre || "Gerencia de Operaciones",
        recibido_por_nombre: liquidarRecibidoPor,
        recibido_por_ci: liquidarRecibidoCi,
        comprobante_transferencia: liquidarComprobante,
        observaciones: liquidarObservaciones,
      })
      toast.success("¡Acta Generada!", `Se generó el Acta ${res.numero_acta} por ${formatPYG(res.monto_total_pyg)} para ${donationStats.campana_activa.ong_nombre}.`)
      setShowLiquidarModal(false)
      fetchDonationsData()
      setSelectedActaPdf(res)
    } catch (err: any) {
      toast.error("Error al liquidar fondos", err?.message || "Ocurrió un problema")
    } finally {
      setLiquidating(false)
    }
  }

  const getPyDateStr = (dateObj: Date = new Date()) => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(dateObj)
  }

  const [exportingArqueo, setExportingArqueo] = useState(false)
  const [showExportArqueoModal, setShowExportArqueoModal] = useState(false)
  const [arqueoFechaDesde, setArqueoFechaDesde] = useState(() => getPyDateStr())
  const [arqueoFechaHasta, setArqueoFechaHasta] = useState(() => getPyDateStr())

  const handleExportArqueo = async (desdeCustom?: string, hastaCustom?: string) => {
    setExportingArqueo(true)
    try {
      const desde = desdeCustom || arqueoFechaDesde || getPyDateStr()
      const hasta = hastaCustom || arqueoFechaHasta || getPyDateStr()
      await downloadPdf(
        `/v1/caja/export/arqueo.pdf?fecha_desde=${desde}&fecha_hasta=${hasta}`,
        `acta_arqueo_consolidado_${desde}_${hasta}.pdf`
      )
      setShowExportArqueoModal(false)
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo generar el Acta de Arqueo Consolidada")
    } finally {
      setExportingArqueo(false)
    }
  }

  const getRegisterName = (registerId?: string) => registers.find(r => r.id === registerId)?.nombre || "Caja Principal"
  const getCajero = (s: SessionSummary) => s.cajero_nombre || "Cajero Asignado"

  const filteredRegisters = registers.filter(r =>
    !search || (r.nombre || "").toLowerCase().includes(search.toLowerCase()) || (r.codigo || "").toLowerCase().includes(search.toLowerCase())
  )

  const filteredSessions = sessions.filter(s =>
    !search || (s.cajero_nombre || "").toLowerCase().includes(search.toLowerCase()) || (s.estado || "").toLowerCase().includes(search.toLowerCase())
  )

  const cajerosDisponibles = Array.from(
    new Set(
      [
        ...historial.map(s => getCajero(s)),
        ...sessions.map(s => s.cajero_nombre || ""),
        ...cajeroPerformance.map(c => c.cajero_nombre),
      ].filter(n => n && n !== "Cajero Asignado" && n !== "—")
    )
  ).sort()

  const filteredHistorial = historial.filter(s => {
    const cajeroStr = getCajero(s).toLowerCase()
    const fechaStr = (s.fecha_cierre || s.fecha_apertura || "")
    const searchLower = search.toLowerCase()

    const matchesSearch =
      !search ||
      cajeroStr.includes(searchLower) ||
      fechaStr.includes(search) ||
      (s.id || "").toLowerCase().includes(searchLower)

    const matchesCajero = !historialCajeroFilter || getCajero(s) === historialCajeroFilter

    let matchesFechaDesde = true
    if (historialFechaDesde) {
      const fechaBase = s.fecha_cierre || s.fecha_apertura
      if (fechaBase) {
        matchesFechaDesde = fechaBase.slice(0, 10) >= historialFechaDesde
      }
    }

    let matchesFechaHasta = true
    if (historialFechaHasta) {
      const fechaBase = s.fecha_cierre || s.fecha_apertura
      if (fechaBase) {
        matchesFechaHasta = fechaBase.slice(0, 10) <= historialFechaHasta
      }
    }

    return matchesSearch && matchesCajero && matchesFechaDesde && matchesFechaHasta
  })

  // Totales en vivo
  const totalRegisters = registers.length
  const openSessionsCount = sessions.filter(s => s.estado === "abierta").length
  const totalApertura = sessions.reduce((a, s) => a + Number(s.monto_apertura || 0), 0)
  const totalEfectivoEnGaveta = sessions.reduce((a, s) => a + Number(s.efectivo_acumulado || 0), 0)
  const totalCobradoTurno = sessions.reduce((a, s) => a + Number(s.monto_cobrado || 0), 0)

  // Actualizar cálculo de billetes
  const handleDenominacionChange = (valor: number, cantidad: number) => {
    const next = { ...conteoBilletes, [valor]: Math.max(0, cantidad) }
    setConteoBilletes(next)
    const suma = Object.entries(next).reduce((acc, [val, cant]) => acc + Number(val) * Number(cant), 0)
    setMontoCierre(String(suma))
  }

  const handleOpenSession = async () => {
    if (!selectedRegister) {
      toast.error("Error", "Seleccioná una caja registradora")
      return
    }
    try {
      await api.caja.sessions.create({
        cash_register_id: selectedRegister,
        user_id: user?.id || "00000000-0000-0000-0000-000000000000",
        cajero_nombre: user?.nombre,
        monto_apertura: parseFloat(montoApertura) || 0,
      })
      toast.success("Caja abierta", "Turno de caja iniciado correctamente")
      setShowOpenModal(false)
      setMontoApertura("0")
      setSelectedRegister("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo abrir la caja")
    }
  }

  const handleCloseSession = async () => {
    if (!selectedSession) return
    try {
      const result = await api.caja.sessions.close(selectedSession.id, {
        monto_cierre_real: parseFloat(montoCierre) || 0,
        monto_cierre_usd: parseFloat(montoCierreUsd) || 0,
        monto_cierre_brl: parseFloat(montoCierreBrl) || 0,
        observaciones: observacionesCierre,
      })
      setCloseResult({ diferencia: result.diferencia, requiere_revision: result.requiere_revision })
      setShowCloseModal(false)
      setMontoCierre("0")
      setMontoCierreUsd("0")
      setMontoCierreBrl("0")
      setObservacionesCierre("")
      setConteoBilletes({})
      setUsarCalculadora(false)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo cerrar la caja")
    }
  }

  const printHandoffReceipt = (h: CashHandoff, supervisorNombre: string, montoConfirmadoNum: number) => {
    const now = new Date().toLocaleString("es-PY")
    const discrepancia = montoConfirmadoNum - h.monto_pyg
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Comprobante de Entrega de Efectivo</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 12px; }
  .center { text-align: center; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .total { font-size: 15px; font-weight: bold; }
  .row { display: flex; justify-content: space-between; margin: 3px 0; }
</style></head><body>
<div class="center">
  <h2 style="margin:0;font-size:16px;">EXTRA SUPERMERCADO</h2>
  <h3 style="margin:2px 0;font-size:12px;">Comprobante de Custodia a Bóveda</h3>
  <p style="margin:2px 0;font-size:10px;">${now}</p>
</div>
<div class="line"></div>
<p style="margin:3px 0;">Caja: <strong>${h.register_nombre || "-"}</strong></p>
<p style="margin:3px 0;">Cajero(a): <strong>${h.entregado_por_nombre || "-"}</strong></p>
<p style="margin:3px 0;">Supervisor(a): <strong>${supervisorNombre}</strong></p>
<div class="line"></div>
<div class="row"><span>Declarado por cajero:</span><span>₲ ${h.monto_pyg.toLocaleString("es-PY")}</span></div>
<div class="row"><span>Contado por supervisor:</span><span>₲ ${montoConfirmadoNum.toLocaleString("es-PY")}</span></div>
${discrepancia !== 0 ? `<div class="row" style="color:#c00;font-weight:bold;"><span>Discrepancia:</span><span>${discrepancia > 0 ? "+" : ""}₲ ${discrepancia.toLocaleString("es-PY")}</span></div>` : ""}
<div class="line"></div>
<div class="center" style="margin-top:24px;">
  <p style="font-size:10px;">Firma Cajero: _____________________</p>
  <p style="font-size:10px;margin-top:20px;">Firma Supervisor: _____________________</p>
</div>
<div class="line"></div>
<div class="center"><p style="font-size:9px;">InteliMarket Retail Platform</p></div>
</body></html>`
    const win = window.open("", "_blank", "width=320,height=600")
    if (win) {
      win.document.write(html)
      win.document.close()
      win.print()
    }
  }

  const handleConfirmHandoff = async () => {
    if (!showConfirmHandoffModal) return
    setConfirmingHandoff(true)
    try {
      const verif = await api.auth.verifySupervisor({ email: supervisorEmail, password: supervisorPassword })
      if (!verif.valid || !verif.id) {
        toast.error("Credenciales inválidas", "El usuario ingresado no tiene rol de supervisor autorizado")
        return
      }
      const montoConfirmadoNum = montoConfirmado ? parseFloat(montoConfirmado) : showConfirmHandoffModal.monto_pyg
      const result = await api.caja.handoffs.confirm(showConfirmHandoffModal.id, {
        recibido_por: verif.id,
        recibido_por_nombre: verif.nombre || supervisorEmail,
        monto_confirmado_pyg: montoConfirmadoNum,
      })
      if (result.discrepancia_confirmacion) {
        toast.error("Entrega confirmada con discrepancia", `Supervisor contó ${formatPYG(montoConfirmadoNum)}, cajero declaró ${formatPYG(showConfirmHandoffModal.monto_pyg)}`)
      } else {
        toast.success("Efectivo recibido en Bóveda", `${verif.nombre} confirmó la custodia`)
      }
      printHandoffReceipt(showConfirmHandoffModal, verif.nombre || supervisorEmail, montoConfirmadoNum)
      setShowConfirmHandoffModal(null)
      setSupervisorEmail("")
      setSupervisorPassword("")
      setMontoConfirmado("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo confirmar la entrega a bóveda")
    } finally {
      setConfirmingHandoff(false)
    }
  }

  const handleCreateRegister = async () => {
    if (!newRegisterName || !newRegisterCodigo) {
      toast.error("Error", "Ingresá nombre y código de caja")
      return
    }
    try {
      await api.caja.registers.create({
        nombre: newRegisterName,
        codigo: newRegisterCodigo,
      } as any)
      toast.success("Caja creada", "Nueva terminal POS registrada")
      setShowCreateModal(false)
      setNewRegisterName("")
      setNewRegisterCodigo("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear la caja — el código debe ser único")
    }
  }

  const handleOpenBreakdown = async (s: SessionSummary) => {
    setSelectedSession(s)
    setShowBreakdownModal(true)
    setBreakdownLoading(true)
    try {
      const data = await api.caja.paymentBreakdown(s.id)
      setBreakdown(data.pyg)
      setOtrasMonedas(data.otras_monedas)
    } catch {
      toast.error("Error", "No se pudo cargar el desglose")
      setBreakdown([])
      setOtrasMonedas([])
    } finally {
      setBreakdownLoading(false)
    }
  }

  const handleOpenThreshold = (r: CashRegister) => {
    setShowThresholdModal(r)
    setThresholdValue(String(r.cash_drop_threshold || 0))
    setDiferenciaToleradaValue(String(r.diferencia_maxima_tolerada || 0))
  }

  const handleSaveThreshold = async () => {
    if (!showThresholdModal) return
    try {
      await api.caja.registers.update(showThresholdModal.id, {
        cash_drop_threshold: parseFloat(thresholdValue) || 0,
        diferencia_maxima_tolerada: parseFloat(diferenciaToleradaValue) || 0,
      })
      toast.success("Guardado", "Límites de seguridad actualizados")
      setShowThresholdModal(null)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo guardar el umbral")
    }
  }

  const handleOpenCashDrop = (s: SessionSummary) => {
    setShowCashDropModal(s)
    setCashDropMonto(String(Math.round(s.efectivo_acumulado)))
    setCashDropObs("")
  }

  const handleConfirmCashDrop = async () => {
    if (!showCashDropModal) return
    try {
      await api.caja.cashDrop(showCashDropModal.id, {
        monto: parseFloat(cashDropMonto) || 0,
        observaciones: cashDropObs || undefined,
      })
      toast.success("Sangría / Cash drop registrado", "El retiro parcial se envió a Bóveda")
      setShowCashDropModal(null)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo registrar el cash drop")
    }
  }

  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Banknote className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    FINANZAS & TESORERÍA · LÍNEA DE CAJAS & ARQUEO CIEGO
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {openSessionsCount} de {totalRegisters} Turnos Abiertos
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Cajas, Turnos & Arqueo Físico
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Arqueos ciegos multimoneda (₲, R$, USD), control de gavetas, sangrías automáticas y remesas selladas a bóveda
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                💵 {formatPYG(totalEfectivoEnGaveta)} en gavetas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                💳 {formatPYG(totalCobradoTurno)} cobrado en turno
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
            <button
              onClick={() => setShowExportArqueoModal(true)}
              disabled={exportingArqueo}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              {exportingArqueo ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-emerald-400" />}
              <span>Acta PDF</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Terminal</span>
            </button>
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              <Wallet className="w-4 h-4" />
              <span>Abrir Turno</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Terminales POS Activas</span>
              <Store className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {openSessionsCount} <span className="text-xs text-slate-400 font-normal">/ {totalRegisters}</span>
            </p>
            <p className="text-[11px] text-slate-400">Turnos operando en vivo</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Efectivo en Gavetas</span>
              <DollarSign className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {formatPYG(totalEfectivoEnGaveta)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">Fondo inicial: {formatPYG(totalApertura)}</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ventas Cobradas (Turno)</span>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {formatPYG(totalCobradoTurno)}
            </p>
            <p className="text-[11px] text-slate-400">Multimoneda & Tarjetas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Custodia a Bóveda</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {pendingHandoffs.length}
            </p>
            <p className="text-[11px] text-amber-400 font-bold">Requieren firma de supervisor</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "registers", label: "Línea de Cajas & Terminales", icon: Store, count: totalRegisters },
          { key: "sessions", label: "Turnos Abiertos en Vivo", icon: Activity, count: openSessionsCount },
          { key: "entregas", label: "Entregas a Bóveda", icon: ShieldCheck, count: pendingHandoffs.length },
          { key: "historial", label: "Historial de Arqueos & Cierres", icon: Clock },
          { key: "cajeros", label: "Scorecard de Cajeros", icon: Users },
          { key: "donaciones", label: "❤️ Donaciones & RSE", icon: Heart, count: donationStats?.cantidad_donaciones },
          { key: "reportes", label: "📊 Centro de Reportes", icon: FileSpreadsheet },
          { key: "bancos_mapping", label: "🏦 Linkeo Bancario", icon: Building2 },
          { key: "sueldok_faltantes", label: "⚖️ Faltantes & SueldOK", icon: ShieldAlert, count: shortageRequests.filter(r => r.estado === 'PENDIENTE').length },
        ].map((t) => {
          const Icon = t.icon
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Buscador Rápido */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs outline-none text-slate-900 dark:text-white"
          placeholder="Buscar por nombre de caja, código, cajero o fecha..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* TAB 1: TERMINALES POS */}
      {activeTab === "registers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRegisters.map(r => {
            const activeSession = sessions.find(s => s.register_id === r.id && s.estado === "abierta")
            const isAlert = activeSession?.cash_drop_alert
            const threshold = Number(r.cash_drop_threshold || 5000000)
            const acumulado = Number(activeSession?.efectivo_acumulado || 0)
            const pct = threshold > 0 ? Math.min(100, Math.round((acumulado / threshold) * 100)) : 0

            return (
              <div
                key={r.id}
                className={`card p-5 border transition-all ${
                  isAlert
                    ? "border-amber-400 dark:border-amber-600 bg-amber-50/20 dark:bg-amber-950/10 shadow-md"
                    : "hover:border-emerald-300 dark:hover:border-emerald-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">
                        {r.codigo}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        activeSession ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {activeSession ? "● Turno Activo" : "Cerrada"}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-white mt-1">
                      {r.nombre}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleOpenThreshold(r)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                    title="Configurar límites de seguridad"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                {activeSession ? (
                  <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Cajero en turno:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{getCajero(activeSession)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Efectivo en gaveta:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatPYG(acumulado)}
                      </span>
                    </div>

                    {/* Barra de Umbral de Cash Drop */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>Límite de seguridad:</span>
                        <span>{pct}% ({formatPYG(threshold)})</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {isAlert && (
                      <div className="p-2.5 rounded-xl bg-amber-100/60 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-[11px] font-semibold">Alerta de Seguridad: Retirar efectivo a Bóveda</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => handleOpenCashDrop(activeSession)}
                        className="btn-outline !py-1.5 text-xs text-amber-700 dark:text-amber-400 border-amber-300 hover:bg-amber-50"
                      >
                        Retiro / Sangría
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSession(activeSession)
                          setShowCloseModal(true)
                        }}
                        className="btn-primary !bg-red-600 hover:!bg-red-500 !py-1.5 text-xs"
                      >
                        Cierre & Arqueo
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenBreakdown(activeSession)}
                      className="w-full text-center text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
                    >
                      Ver desglose de medios de cobro →
                    </button>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700/60 text-center py-4">
                    <p className="text-xs text-gray-400 mb-3">No hay turno abierto en esta caja</p>
                    <button
                      onClick={() => {
                        setSelectedRegister(r.id)
                        setShowOpenModal(true)
                      }}
                      className="btn-outline text-xs !py-1.5 mx-auto"
                    >
                      Abrir Turno
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* TAB 2: TURNOS ABIERTOS EN VIVO */}
      {activeTab === "sessions" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="p-3.5">Caja / Terminal</th>
                  <th className="p-3.5">Cajero</th>
                  <th className="p-3.5">Apertura</th>
                  <th className="p-3.5 text-right">Fondo Inicial</th>
                  <th className="p-3.5 text-right">Efectivo en Gaveta</th>
                  <th className="p-3.5 text-right">Total Cobrado</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      No hay turnos de caja abiertos en este momento.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                        {getRegisterName(s.register_id)}
                      </td>
                      <td className="p-3.5 text-gray-700 dark:text-gray-300">
                        {getCajero(s)}
                      </td>
                      <td className="p-3.5 font-mono text-gray-500">
                        {formatDateTime(s.fecha_apertura)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                        {formatPYG(s.monto_apertura)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPYG(s.efectivo_acumulado)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                        {formatPYG(s.monto_cobrado)}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenBreakdown(s)}
                            className="btn-outline !py-1 !px-2.5 text-[11px]"
                          >
                            Desglose
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSession(s)
                              setShowCloseModal(true)
                            }}
                            className="btn-primary !bg-red-600 hover:!bg-red-500 !py-1 !px-2.5 text-[11px]"
                          >
                            Arqueo
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ENTREGAS A BÓVEDA */}
      {activeTab === "entregas" && (
        <div className="space-y-4">
          <div className="card p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              <strong>Procedimiento de Custodia:</strong> Al cerrar un turno o realizar un retiro parcial (sangría), el efectivo declarado queda bajo custodia del cajero en estado <em>Pendiente</em> hasta que el supervisor de bóveda confirme el conteo físico con sus credenciales.
            </p>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="p-3.5">Cajero</th>
                  <th className="p-3.5">Caja</th>
                  <th className="p-3.5 text-right">Monto Declarado</th>
                  <th className="p-3.5">Fecha Cierre</th>
                  <th className="p-3.5">Estado</th>
                  <th className="p-3.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {handoffs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      No hay entregas registradas.
                    </td>
                  </tr>
                ) : (
                  handoffs.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                        {h.entregado_por_nombre || "Cajero"}
                      </td>
                      <td className="p-3.5 text-gray-600 dark:text-gray-300">
                        {h.register_nombre || "Caja Principal"}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatPYG(h.monto_pyg)}
                      </td>
                      <td className="p-3.5 font-mono text-gray-500">
                        {formatDateTime(h.created_at)}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          h.estado === "confirmado"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
                          {h.estado === "confirmado" ? "✓ En Bóveda" : "⏳ Pendiente"}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        {h.estado === "pendiente" ? (
                          <button
                            onClick={() => {
                              setShowConfirmHandoffModal(h)
                              setMontoConfirmado(String(h.monto_pyg))
                            }}
                            className="btn-primary !bg-indigo-600 hover:!bg-indigo-500 !py-1 !px-3 text-xs"
                          >
                            Recibir en Bóveda
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-medium">Recibido por {h.recibido_por_nombre || "Supervisor"}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORIAL DE ARQUEOS & CIERRES */}
      {activeTab === "historial" && (
        <div className="card overflow-hidden space-y-0">
          {/* Header y Filtros */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  Mostrando {filteredHistorial.length} arqueos históricos
                </span>
                <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
                  {[100, 250, 500, 1500].map(lim => (
                    <button
                      key={lim}
                      type="button"
                      onClick={() => {
                        setHistorialLimit(lim)
                        fetchHistorial(lim)
                      }}
                      className={`px-2 py-0.5 rounded font-medium transition ${
                        historialLimit === lim
                          ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 font-bold shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      {lim}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => fetchHistorial()}
                disabled={historialLoading}
                className="btn-ghost text-xs flex items-center gap-1 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historialLoading ? "animate-spin" : ""}`} /> Refrescar
              </button>
            </div>

            {/* Barra de Filtros: Cajera y Rango de Fechas */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {/* Filtro por Cajero */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={historialCajeroFilter}
                  onChange={(e) => {
                    setHistorialCajeroFilter(e.target.value)
                    fetchHistorial(undefined, { cajero: e.target.value })
                  }}
                  className="text-xs font-semibold bg-transparent text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                >
                  <option value="" className="dark:bg-slate-800">Todas las cajeras ({cajerosDisponibles.length})</option>
                  {cajerosDisponibles.map(c => (
                    <option key={c} value={c} className="dark:bg-slate-800">{c}</option>
                  ))}
                </select>
              </div>

              {/* Rango de Fechas */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500">Desde:</span>
                <input
                  type="date"
                  value={historialFechaDesde}
                  onChange={(e) => {
                    setHistorialFechaDesde(e.target.value)
                    fetchHistorial(undefined, { fecha_desde: e.target.value })
                  }}
                  className="bg-transparent text-xs font-mono text-slate-800 dark:text-slate-200 outline-none"
                />
                <span className="text-[11px] font-bold text-slate-500">Hasta:</span>
                <input
                  type="date"
                  value={historialFechaHasta}
                  onChange={(e) => {
                    setHistorialFechaHasta(e.target.value)
                    fetchHistorial(undefined, { fecha_hasta: e.target.value })
                  }}
                  className="bg-transparent text-xs font-mono text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              {/* Botones rápidos de fecha */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const hoy = getTodayAsuncion()
                    setHistorialFechaDesde(hoy)
                    setHistorialFechaHasta(hoy)
                    fetchHistorial(undefined, { fecha_desde: hoy, fecha_hasta: hoy })
                  }}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ayer = getAsuncionDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000))
                    setHistorialFechaDesde(ayer)
                    setHistorialFechaHasta(ayer)
                    fetchHistorial(undefined, { fecha_desde: ayer, fecha_hasta: ayer })
                  }}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                >
                  Ayer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const hoy = getTodayAsuncion()
                    const sem = getAsuncionDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                    setHistorialFechaDesde(sem)
                    setHistorialFechaHasta(hoy)
                    fetchHistorial(undefined, { fecha_desde: sem, fecha_hasta: hoy })
                  }}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                >
                  Últimos 7d
                </button>
                {(historialCajeroFilter || historialFechaDesde || historialFechaHasta) && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistorialCajeroFilter("")
                      setHistorialFechaDesde("")
                      setHistorialFechaHasta("")
                      fetchHistorial(undefined, { fecha_desde: "", fecha_hasta: "", cajero: "" })
                    }}
                    className="px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[550px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="p-3.5">Fecha Cierre</th>
                  <th className="p-3.5">Cajero</th>
                  <th className="p-3.5 text-right">Declarado (PYG)</th>
                  <th className="p-3.5 text-right">Esperado (POS)</th>
                  <th className="p-3.5 text-right">Descuadre</th>
                  <th className="p-3.5 text-center">Estado Cuadre</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {historialLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" /></td>
                  </tr>
                ) : filteredHistorial.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">No se encontraron cierres históricos con los filtros seleccionados.</td>
                  </tr>
                ) : (
                  filteredHistorial.map(s => {
                    const dif = s.diferencia !== null ? Number(s.diferencia) : 0
                    const isPerfect = dif === 0
                    const isSobrante = dif > 0
                    const isFaltante = dif < 0

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono text-gray-500">
                          {formatDateTime(s.fecha_cierre || s.fecha_apertura)}
                        </td>
                        <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                          {getCajero(s)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                          {formatPYG(s.monto_cierre || 0)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-gray-500">
                          {formatPYG(s.monto_cierre_esperado || 0)}
                        </td>
                        <td className={`p-3.5 text-right font-mono font-bold ${
                          isPerfect ? "text-emerald-600" : isSobrante ? "text-blue-600" : "text-red-600"
                        }`}>
                          {dif !== 0 ? (dif > 0 ? `+${formatPYG(dif)}` : formatPYG(dif)) : "₲ 0 (Exacto)"}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPerfect
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isSobrante
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          }`}>
                            {isPerfect ? "✓ Cuadrado" : isSobrante ? "↑ Sobrante" : "↓ Faltante"}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <button
                              type="button"
                              onClick={() => handleOpenSessionSalesModal(s.id)}
                              title="Ver resumen y detalle de todas las ventas que componen esta caja"
                              className="p-1.5 rounded-lg border border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 inline-flex items-center gap-1 font-bold text-[11px] transition-colors shadow-sm"
                            >
                              <Receipt className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              Ventas
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEscposTicket(s.id)}
                              title="Reimprimir Arqueo Térmico ESC/POS (80mm)"
                              className="p-1.5 rounded-lg border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 inline-flex items-center gap-1 font-bold text-[11px] transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              ESC/POS
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const safeCajero = (s.cajero_nombre || "caja").replace(/\s+/g, "_")
                                  const safeFecha = (s.fecha_apertura || "").slice(0, 10) || "sesion"
                                  await downloadPdf(`/v1/cash-sessions/${s.id}/export/cierre.pdf`, `cierre_${safeCajero}_${safeFecha}.pdf`)
                                  toast.success("Acta descargada", `Cierre de ${s.cajero_nombre || "caja"} descargado.`)
                                } catch {
                                  toast.error("Error", "No se pudo generar el PDF del cierre.")
                                }
                              }}
                              title="Descargar Acta Oficial en PDF"
                              className="p-1.5 rounded-lg border border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 inline-flex items-center gap-1 font-bold text-[11px]"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPunteoModal(s.id)}
                              title="Planilla de Punteo y Cotejo de Vouchers"
                              className="p-1.5 rounded-lg border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 inline-flex items-center gap-1 font-bold text-[11px] transition-colors"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" />
                              Punteo
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIncorporateVaultAndBanks(s.id)}
                              disabled={incorporatingSessionId === s.id}
                              title="Asentar sesión en Bóveda Central y registrar transacciones en Cuentas Bancarias"
                              className="p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 inline-flex items-center gap-1 font-bold text-[11px] transition-colors"
                            >
                              {incorporatingSessionId === s.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              ) : (
                                <Building2 className="w-3.5 h-3.5" />
                              )}
                              Bóveda & Bancos
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SCORECARD & RANKING DE CAJEROS */}
      {activeTab === "cajeros" && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Rendimiento y Precisión de Cajeros</h3>
              <p className="text-xs text-gray-400">Auditoría de faltantes, sobrantes y exactitud en arqueos de Extra Supermercado</p>
            </div>
            <button onClick={fetchCajeroPerformance} disabled={cajeroPerformanceLoading} className="btn-ghost text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${cajeroPerformanceLoading ? "animate-spin" : ""}`} /> Actualizar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="p-3.5">Cajero</th>
                  <th className="p-3.5 text-center">Turnos Operados</th>
                  <th className="p-3.5 text-right">Efectivo Total Manejado</th>
                  <th className="p-3.5 text-right">Descuadre Acumulado</th>
                  <th className="p-3.5 text-center">% Cierres con Revisión</th>
                  <th className="p-3.5 text-right">Último Cierre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {cajeroPerformanceLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" /></td></tr>
                ) : cajeroPerformance.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay datos de rendimiento disponibles.</td></tr>
                ) : (
                  cajeroPerformance.map((c, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px]">
                          {c.cajero_nombre.slice(0, 2).toUpperCase()}
                        </div>
                        {c.cajero_nombre}
                      </td>
                      <td className="p-3.5 text-center font-bold font-mono text-gray-700 dark:text-gray-300">
                        {c.total_cierres}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                        {formatPYG(c.monto_total_manejado)}
                      </td>
                      <td className={`p-3.5 text-right font-mono font-bold ${
                        c.diferencia_acumulada === 0 ? "text-emerald-600" : c.diferencia_acumulada > 0 ? "text-blue-600" : "text-red-600"
                      }`}>
                        {formatPYG(c.diferencia_acumulada)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.pct_con_revision > 10 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {c.pct_con_revision.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono text-gray-500">
                        {c.ultimo_cierre ? formatDateTime(c.ultimo_cierre) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: DONACIONES & RSE ("ABRE TU CORAZÓN" - CENTRO AMOR Y ESPERANZA) */}
      {activeTab === "donaciones" && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Panorámico RSE & Termómetro de Meta */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-950 via-slate-900 to-amber-950/80 text-white p-6 sm:p-8 border border-rose-500/20 shadow-2xl shadow-rose-950/30">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-black tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                  RESPONSABILIDAD SOCIAL EMPRESARIAL · EXTRA SUPERMERCADO
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                  <Heart className="w-8 h-8 text-rose-400 fill-rose-500" />
                  Campaña Solidaria "Abre tu corazón"
                </h2>
                <p className="text-sm text-slate-300 max-w-2xl font-sans">
                  Recaudación transparente por redondeo de vuelto fraccionario en cajas a beneficio de{" "}
                  <strong className="text-white">Centro Amor y Esperanza</strong>.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <a
                    href={`https://${donationStats?.campana_activa?.ong_web || "www.centroamoresperanza.org"}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all"
                  >
                    <span>{donationStats?.campana_activa?.ong_web || "www.centroamoresperanza.org"}</span>
                  </a>
                  <span className="text-xs text-rose-300/80">
                    Slogan: <em>"{donationStats?.campana_activa?.slogan || "Ayudanos a ayudar"}"</em>
                  </span>
                </div>
              </div>

              {/* Botón de Liquidación / Entrega Formal */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={() => setShowLiquidarModal(true)}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-rose-600/30 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Generar Acta de Entrega a la ONG</span>
                </button>
                <button
                  onClick={fetchDonationsData}
                  disabled={donationsLoading}
                  className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${donationsLoading ? "animate-spin" : ""}`} />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {/* Termómetro de Meta */}
            <div className="relative z-10 mt-6 pt-6 border-t border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Progreso hacia la Meta de la Campaña
                </span>
                <span className="text-xs font-mono font-black text-rose-300">
                  {formatPYG(donationStats?.total_recaudado_pyg || 0)} / {formatPYG(donationStats?.meta_pyg || 20000000)} ({donationStats?.progreso_meta_pct || 0}%)
                </span>
              </div>
              <div className="w-full h-3.5 bg-slate-900/80 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 rounded-full transition-all duration-1000 shadow-lg shadow-rose-500/50"
                  style={{ width: `${Math.min(100, donationStats?.progreso_meta_pct || 0)}%` }}
                />
              </div>
            </div>

            {/* Grid de 4 KPIs */}
            <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-rose-500/20">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Recaudado Histórico</span>
                <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white mt-0.5">
                  {formatPYG(donationStats?.total_recaudado_pyg || 0)}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {donationStats?.cantidad_donaciones || 0} micro-donaciones
                </span>
              </div>

              <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-rose-500/20">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recaudación Este Mes</span>
                <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-300 mt-0.5">
                  {formatPYG(donationStats?.total_mes_pyg || 0)}
                </div>
                <span className="text-[10px] text-rose-400 font-bold mt-1 block">En curso</span>
              </div>

              <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-rose-500/20">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recaudado Hoy en Cajas</span>
                <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-300 mt-0.5">
                  {formatPYG(donationStats?.total_hoy_pyg || 0)}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Cajas activas</span>
              </div>

              <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-rose-500/20">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custodia Pendiente de Entrega</span>
                <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-amber-300 mt-0.5">
                  {formatPYG(donationStats?.total_pendiente_pyg || 0)}
                </div>
                <span className="text-[10px] text-amber-400 font-bold mt-1 block">Listo para transferir</span>
              </div>
            </div>
          </div>

          {/* Grid de 2 Columnas: Ranking de Cajeros + Actas de Entrega */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Columna 1: Ranking de Cajeros Solidarios */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    Scorecard de Cajeros Solidarios
                  </h3>
                  <p className="text-xs text-gray-400">Ranking por recaudación y tasa de conversión de redondeo</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className="p-3">Pos.</th>
                      <th className="p-3">Cajero</th>
                      <th className="p-3 text-right">Recaudado</th>
                      <th className="p-3 text-center">Donaciones</th>
                      <th className="p-3 text-right">Tasa Conversión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {donationsLoading ? (
                      <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-600" /></td></tr>
                    ) : donationRanking.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-400">No hay registros de cajeros aún.</td></tr>
                    ) : (
                      donationRanking.map((rk, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3 font-bold text-center">
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                          </td>
                          <td className="p-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-center text-[10px]">
                              {rk.cajero_nombre.slice(0, 2).toUpperCase()}
                            </div>
                            <span>{rk.cajero_nombre}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            {formatPYG(rk.total_recaudado_pyg)}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-gray-700 dark:text-gray-300">
                            {rk.cantidad_donaciones}
                          </td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              {rk.tasa_adhesion_pct}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Columna 2: Actas de Entrega & Liquidaciones a la ONG */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Actas de Entrega a Centro Amor y Esperanza
                  </h3>
                  <p className="text-xs text-gray-400">Comprobantes formales de transferencia de fondos</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className="p-3">N° Acta</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3 text-right">Monto</th>
                      <th className="p-3">Recibido Por</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {donationsLoading ? (
                      <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></td></tr>
                    ) : donationLiquidations.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-400">No se han emitido actas de entrega aún.</td></tr>
                    ) : (
                      donationLiquidations.map((lq) => (
                        <tr key={lq.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {lq.numero_acta}
                          </td>
                          <td className="p-3 font-mono text-gray-500">
                            {formatDateTime(lq.created_at)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                            {formatPYG(lq.monto_total_pyg)}
                          </td>
                          <td className="p-3 text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                            {lq.recibido_por_nombre || "Directora"}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedActaPdf(lq)}
                              className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[10px] font-bold transition"
                            >
                              Ver Acta
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Tabla de Micro-Donaciones Recientes en Cajas */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  Registro de Micro-Donaciones en Vivo (Auditoría por Ticket)
                </h3>
                <p className="text-xs text-gray-400">Últimos redondeos registrados en cajas y puntos de venta</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="p-3">Fecha/Hora</th>
                    <th className="p-3">N° Ticket</th>
                    <th className="p-3">Cajero</th>
                    <th className="p-3">Tipo Origen</th>
                    <th className="p-3 text-right">Monto Venta</th>
                    <th className="p-3 text-right">Donación</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {donationsLoading ? (
                    <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" /></td></tr>
                  ) : donationRecent.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">No hay donaciones registradas aún en el período.</td></tr>
                  ) : (
                    donationRecent.map((dc) => (
                      <tr key={dc.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3 font-mono text-gray-500">
                          {formatDateTime(dc.created_at)}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {dc.numero_comprobante || "—"}
                        </td>
                        <td className="p-3 font-bold text-gray-700 dark:text-gray-300">
                          {dc.cajero_nombre || "Cajero"}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            {dc.tipo_origen === "redondeo_vuelto" ? "🪙 Redondeo Vuelto" : dc.tipo_origen}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-gray-500">
                          {formatPYG(dc.monto_total_venta_pyg)}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                          +{formatPYG(dc.monto_pyg)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            dc.estado === "liquidado"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}>
                            {dc.estado === "liquidado" ? "Entregado a ONG" : "En Custodia"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 📊 TAB 7: CENTRO DE REPORTES DE CAJA */}
      {activeTab === "reportes" && (
        <div className="space-y-6 animate-fade-in">
          {/* Barra Superior de Filtros de Reportes (Zona Horaria Paraguay) */}
          <div className="card p-4 space-y-4 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Centro de Reportes Analíticos de Caja & Arqueos
                </h2>
                <p className="text-xs text-gray-500">
                  Consolidados de ventas crudas por cajero, recaudación por medios de pago y reimpresión de actas formales.
                </p>
              </div>

              {/* Selector de Subpestaña de Reporte */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
                {[
                  { id: "cajeros", label: "Ventas por Cajero", icon: Users },
                  { id: "medios_pago", label: "Ventas por Medio de Pago", icon: CreditCard },
                  { id: "actas", label: "Reimpresión de Actas", icon: Printer },
                ].map(sub => {
                  const SubIcon = sub.icon
                  const isSel = repActiveSubTab === sub.id
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setRepActiveSubTab(sub.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        isSel
                          ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <SubIcon className="w-3.5 h-3.5" />
                      <span>{sub.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Controles de Filtro: Rango de Fechas & Cajero */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Fecha Desde (Hora PY)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={repFechaDesde}
                    onChange={e => setRepFechaDesde(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Fecha Hasta (Hora PY)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={repFechaHasta}
                    onChange={e => setRepFechaHasta(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Filtrar por Cajero (Opcional)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Todos los cajeros..."
                    value={repCajeroFiltro}
                    onChange={e => setRepCajeroFiltro(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchReportesCaja()}
                  disabled={repLoading}
                  className="flex-1 btn-primary py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  {repLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>Actualizar</span>
                </button>
              </div>
            </div>
          </div>

          {/* SUBTAB 1: REPORTE DE VENTAS POR CAJERO */}
          {repActiveSubTab === "cajeros" && (
            <div className="space-y-4">
              {/* Tarjetas KPI de Ventas por Cajero */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="card p-4 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Ventas Brutas</span>
                  <p className="text-xl font-black font-mono text-gray-900 dark:text-white mt-1">
                    {formatPYG(salesByCashierData?.totales?.total_ventas || 0)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Montos crudos facturados en caja</p>
                </div>

                <div className="card p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Tickets Emitidos</span>
                  <p className="text-xl font-black font-mono text-gray-900 dark:text-white mt-1">
                    {(salesByCashierData?.totales?.total_tickets || 0).toLocaleString("es-PY")}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Comprobantes procesados</p>
                </div>

                <div className="card p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Ticket Promedio General</span>
                  <p className="text-xl font-black font-mono text-gray-900 dark:text-white mt-1">
                    {formatPYG(salesByCashierData?.totales?.ticket_promedio_general || 0)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Promedio por comprobante</p>
                </div>

                <div className="card p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Cajeros Activos</span>
                  <p className="text-xl font-black font-mono text-gray-900 dark:text-white mt-1">
                    {salesByCashierData?.totales?.total_cajeros_activos || 0}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Personal con ventas registradas</p>
                </div>
              </div>

              {/* Tabla de Desglose por Cajero */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600" />
                      Planilla Consolidada de Ventas por Cajero
                    </h3>
                    <p className="text-xs text-gray-400">Totalización de ventas brutas, tickets y productividad por cajero</p>
                  </div>

                  <button
                    onClick={async () => {
                      setDownloadingRepPdf(true)
                      try {
                        await api.caja.reports.downloadSalesByCashierPdf(repFechaDesde, repFechaHasta, repCajeroFiltro.trim() || undefined)
                      } finally {
                        setDownloadingRepPdf(false)
                      }
                    }}
                    disabled={downloadingRepPdf}
                    className="btn-outline text-xs flex items-center gap-2 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                  >
                    {downloadingRepPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    <span>Descargar Reporte con Firmas (PDF)</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                      <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3">Nombre del Cajero / Usuario</th>
                        <th className="p-3 text-center">Turnos</th>
                        <th className="p-3 text-right">Tickets Emitidos</th>
                        <th className="p-3 text-right">Ticket Promedio</th>
                        <th className="p-3 text-right font-black">Total Facturado (₲)</th>
                        <th className="p-3 text-right">% Participación</th>
                        <th className="p-3 text-center">Horario Actividad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {repLoading ? (
                        <tr><td colSpan={8} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                      ) : !salesByCashierData || salesByCashierData.cajeros.length === 0 ? (
                        <tr><td colSpan={8} className="p-8 text-center text-gray-400">No se encontraron ventas para el período seleccionado.</td></tr>
                      ) : (
                        salesByCashierData.cajeros.map((c: any, idx: number) => {
                          const totGen = salesByCashierData.totales?.total_ventas || 1
                          const pct = ((c.total_ventas / totGen) * 100).toFixed(1)
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                              <td className="p-3 text-center font-bold text-gray-400">{idx + 1}</td>
                              <td className="p-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">
                                  {c.cajero_nombre.slice(0, 2).toUpperCase()}
                                </div>
                                <span>{c.cajero_nombre}</span>
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-gray-600 dark:text-gray-300">
                                {c.cantidad_turnos}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                                {c.cantidad_tickets.toLocaleString("es-PY")}
                              </td>
                              <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-300">
                                {formatPYG(c.ticket_promedio)}
                              </td>
                              <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                {formatPYG(c.total_ventas)}
                              </td>
                              <td className="p-3 text-right">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                  {pct}%
                                </span>
                              </td>
                              <td className="p-3 text-center text-[10px] text-gray-400 font-mono">
                                {c.primera_venta ? `${formatDateTime(c.primera_venta).slice(11, 16)} a ${formatDateTime(c.ultima_venta).slice(11, 16)}` : "—"}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 2: REPORTE DE VENTAS POR MEDIOS DE PAGO */}
          {repActiveSubTab === "medios_pago" && (
            <div className="space-y-4">
              {/* Tarjetas KPI de Medios de Pago */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="card p-4 bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Recaudado (PYG)</span>
                  <p className="text-xl font-black font-mono text-gray-900 dark:text-white mt-1">
                    {formatPYG(salesByPaymentData?.total_recaudado_pyg || 0)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Ingresos totales convertidos</p>
                </div>

                <div className="card p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Operaciones</span>
                  <p className="text-xl font-black font-mono text-gray-900 dark:text-white mt-1">
                    {(salesByPaymentData?.total_operaciones || 0).toLocaleString("es-PY")}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Cobros procesados</p>
                </div>

                <div className="card p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Reales en Gaveta (R$)</span>
                  <p className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
                    R$ {(salesByPaymentData?.efectivo_brl_recaudado || 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Cobro físico en moneda extranjera</p>
                </div>

                <div className="card p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Dólares en Gaveta (US$)</span>
                  <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    US$ {(salesByPaymentData?.efectivo_usd_recaudado || 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Cobro físico en moneda extranjera</p>
                </div>
              </div>

              {/* Tabla de Medios de Pago */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Distribución por Medio de Pago & Canal Operativo
                    </h3>
                    <p className="text-xs text-gray-400">Desglose de recaudación: efectivo, divisas, tarjetas, transferencias y convenios</p>
                  </div>

                  <button
                    onClick={async () => {
                      setDownloadingRepPdf(true)
                      try {
                        await api.caja.reports.downloadSalesByPaymentMethodPdf(repFechaDesde, repFechaHasta)
                      } finally {
                        setDownloadingRepPdf(false)
                      }
                    }}
                    disabled={downloadingRepPdf}
                    className="btn-outline text-xs flex items-center gap-2 font-bold hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-300"
                  >
                    {downloadingRepPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    <span>Descargar Informe de Recaudación (PDF)</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                      <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3">Medio de Pago / Canal</th>
                        <th className="p-3 text-center">Moneda</th>
                        <th className="p-3 text-right">Cantidad Cobros</th>
                        <th className="p-3 text-right font-black">Monto Recaudado</th>
                        <th className="p-3 text-right">% Participación (PYG)</th>
                        <th className="p-3 w-40">Proporción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {repLoading ? (
                        <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                      ) : !salesByPaymentData || salesByPaymentData.medios_pago.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-gray-400">No hay movimientos de pago registrados.</td></tr>
                      ) : (
                        salesByPaymentData.medios_pago.map((m: any, idx: number) => {
                          const isDivisa = m.moneda !== "PYG"
                          const montoFmt = isDivisa
                            ? `${m.moneda} ${m.monto.toLocaleString("es-PY", { minimumFractionDigits: 2 })}`
                            : formatPYG(m.monto)
                          return (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                              <td className="p-3 text-center font-bold text-gray-400">{idx + 1}</td>
                              <td className="p-3 font-bold text-gray-900 dark:text-white">
                                {m.label}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                                  m.moneda === "BRL" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                                  m.moneda === "USD" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                                  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}>
                                  {m.moneda}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                                {m.operaciones.toLocaleString("es-PY")}
                              </td>
                              <td className="p-3 text-right font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                                {montoFmt}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                                {isDivisa ? "Divisa" : `${m.porcentaje}%`}
                              </td>
                              <td className="p-3">
                                {!isDivisa && (
                                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full"
                                      style={{ width: `${Math.min(100, m.porcentaje)}%` }}
                                    />
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 3: REIMPRESIÓN CENTRALIZADA DE ACTAS */}
          {repActiveSubTab === "actas" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta 1: Acta de Arqueo Consolidada */}
              <div className="card p-6 space-y-4 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-white">
                      Acta de Arqueo Consolidado (PDF Horizontal)
                    </h3>
                    <p className="text-xs text-gray-400">
                      Documento formal en formato apaisado A4 con detalle de todas las terminales y horas de cierre
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                  Genera la planilla unificada que incluye todas las sesiones cerradas en el rango de fechas seleccionado (<b>{repFechaDesde}</b> al <b>{repFechaHasta}</b>), con el desglose de gaveta, fondos iniciales, canales de recaudación y espacio para las 3 firmas institucionales.
                </p>

                <div className="pt-2">
                  <button
                    onClick={() => api.caja.downloadArqueoConsolidadoPdf(repFechaDesde, repFechaHasta)}
                    className="w-full btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Acta de Arqueo Consolidado</span>
                  </button>
                </div>
              </div>

              {/* Tarjeta 2: Cierres Individuales de Sesión */}
              <div className="card p-6 space-y-4 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-white">
                      Acta de Cierre Individual de Turno
                    </h3>
                    <p className="text-xs text-gray-400">
                      Reimpresión directa del comprobante de cierre de una cajera específica
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                  Si necesitás reimprimir el acta de cierre de una sesión pasada con su conteo ciego, desglose bimonetario y firma de entrega a supervisión, podés acceder al historial de cierres.
                </p>

                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab("historial")}
                    className="w-full btn-outline py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span>Ir al Historial de Sesiones Cerradas</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 8: VINCULACIÓN DE MEDIOS DE PAGO CON CUENTAS BANCARIAS */}
      {activeTab === "bancos_mapping" && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Card */}
          <div className="card p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 shadow-xl rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    Linkeo Bancario de Medios de Pago Electrónico
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Dinámico & Configurable
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Asociá cada canal digital de cobro (POS Bancard, QR, POS Dinelco, PIX, Transferencias) a su cuenta bancaria correspondiente para conciliación automática inmediata.
                  </p>
                </div>
              </div>
              <button
                onClick={fetchBankMappings}
                disabled={bankMappingsLoading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 border border-slate-700 w-fit"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${bankMappingsLoading ? "animate-spin" : ""}`} />
                <span>Actualizar Mapeos</span>
              </button>
            </div>

            {/* Aviso informativo de Extra Club */}
            <div className="mt-4 p-3 rounded-xl bg-indigo-900/40 border border-indigo-500/30 text-xs text-indigo-200 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <b className="font-semibold text-white">Extra Club Mayorista:</b> Las ventas y vales de crédito de clientes fidelizados ya se registran automáticamente en el módulo de Cuentas Corrientes de Clientes (<code className="text-amber-300">credit_accounts</code>), sin requerir cuenta bancaria intermediaria.
              </div>
            </div>
          </div>

          {/* Grid de Canales Electrónicos */}
          {bankMappingsLoading ? (
            <div className="card p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span>Cargando canales y cuentas bancarias...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankMappings.map((m) => {
                const currentAcc = bankAccounts.find(b => b.id === m.bank_account_id)
                const isSaving = savingMappingKey === m.canal_key

                return (
                  <div
                    key={m.canal_key}
                    className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-indigo-500">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              {m.canal_label}
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">
                              {m.canal_key}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          m.activo
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                        }`}>
                          {m.activo ? "Activo" : "Inactivo"}
                        </span>
                      </div>

                      <div className="space-y-3 pt-3">
                        <div>
                          <label className="input-label text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                            Cuenta Bancaria Destino:
                          </label>
                          <select
                            value={m.bank_account_id || ""}
                            onChange={(e) => {
                              const newId = e.target.value || null
                              handleUpdateBankMapping(m.canal_key, newId, m.activo)
                            }}
                            disabled={isSaving}
                            className="input-field text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                          >
                            <option value="">-- Sin vincular (No genera asiento bancario) --</option>
                            {bankAccounts.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.banco} — Cta: {b.numero_cuenta} ({b.moneda})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Detalle visual de la cuenta */}
                        {currentAcc ? (
                          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1">
                            <div className="flex items-center justify-between font-bold">
                              <span>{currentAcc.banco}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-200/50 dark:bg-emerald-900/50">
                                {currentAcc.moneda}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              Nº {currentAcc.numero_cuenta} {currentAcc.alias ? `(${currentAcc.alias})` : ""}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Sin cuenta asignada: Las ventas en este canal no generarán transacciones bancarias automáticas.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={m.activo}
                          onChange={(e) => handleUpdateBankMapping(m.canal_key, m.bank_account_id || null, e.target.checked)}
                          disabled={isSaving}
                          className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Habilitar Canal
                        </span>
                      </label>
                      {isSaving && (
                        <div className="flex items-center gap-1 text-[11px] text-indigo-400 font-bold">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Guardando...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 9: GOBERNANZA DE FALTANTES & INTEGRACIÓN SUELDOK */}
      {activeTab === "sueldok_faltantes" && (
        <div className="space-y-6 animate-fade-in">
          {/* Configuración de Políticas y Umbrales */}
          <div className="card p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 shadow-xl rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    Gobernanza de Faltantes & Nómina SueldOK
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Paraguay Retail Laboral
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Definición de umbrales, dictamen de gerencia y deducción formal en recibos salariales de Extra Supermercado.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSaveShortageConfig}
                disabled={savingShortageConfig || !shortageConfig}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-600/25 w-fit"
              >
                {savingShortageConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Guardar Políticas</span>
              </button>
            </div>

            {shortageConfig && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Umbral de Aprobación Gerencial (₲)
                  </label>
                  <input
                    type="number"
                    value={shortageConfig.umbral_aprobacion_gs}
                    onChange={(e) => setShortageConfig({ ...shortageConfig, umbral_aprobacion_gs: Number(e.target.value) })}
                    className="input-field text-sm font-mono font-bold bg-slate-900 border-slate-700 text-white"
                  />
                  <p className="text-[10px] text-slate-400">
                    Faltantes mayores a este monto generan solicitud de revisión gerencial.
                  </p>
                </div>

                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Requerir Aprobación Siempre
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={shortageConfig.requerir_aprobacion_siempre}
                      onChange={(e) => setShortageConfig({ ...shortageConfig, requerir_aprobacion_siempre: e.target.checked })}
                      className="rounded border-slate-600 text-amber-500 focus:ring-amber-400 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-200">
                      Cero deducciones automáticas
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Todo faltante debe ser validado por el auditor o gerente antes de ir a nómina.
                  </p>
                </div>

                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Fraccionamiento en Cuotas
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={shortageConfig.permitir_cuotas}
                      onChange={(e) => setShortageConfig({ ...shortageConfig, permitir_cuotas: e.target.checked })}
                      className="rounded border-slate-600 text-amber-500 focus:ring-amber-400 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-200">
                      Permitir pago diferido
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Habilita dividir el faltante en 1 a N cuotas salariales.
                  </p>
                </div>

                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Máximo de Cuotas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={shortageConfig.max_cuotas}
                    onChange={(e) => setShortageConfig({ ...shortageConfig, max_cuotas: Number(e.target.value) })}
                    className="input-field text-sm font-mono font-bold bg-slate-900 border-slate-700 text-white"
                  />
                  <p className="text-[10px] text-slate-400">
                    Límite máximo de meses de descuento.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tabla de Expedientes de Faltantes */}
          <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Expedientes de Faltantes Registrados
                </h3>
                <p className="text-xs text-slate-400">
                  Control de arqueos cerrados con diferencias de caja pendientes de dictamen o ya sincronizados con SueldOK
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {["TODOS", "PENDIENTE", "APROBADO_NOMINA", "CONDONADO_EMPRESA", "RECHAZADO"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setShortageFilterEstado(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      shortageFilterEstado === st
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {st === "TODOS" ? "Todos" : st === "PENDIENTE" ? "Pendientes" : st === "APROBADO_NOMINA" ? "Aprobados Nómina" : st === "CONDONADO_EMPRESA" ? "Condonados" : "Rechazados"}
                  </button>
                ))}
                <button
                  onClick={fetchShortageData}
                  disabled={shortagesLoading}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-2"
                  title="Actualizar"
                >
                  <RefreshCw className={`w-4 h-4 ${shortagesLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Fecha & Sesión</th>
                    <th className="px-4 py-3">Cajero / Operador</th>
                    <th className="px-4 py-3 text-right">Faltante (₲)</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3">Resolución & Cuotas</th>
                    <th className="px-4 py-3 text-center">Sincronización SueldOK</th>
                    <th className="px-4 py-3">Dictamen / Observaciones</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(() => {
                    const filtered = shortageRequests.filter((r) => {
                      if (shortageFilterEstado === "TODOS") return true
                      return r.estado === shortageFilterEstado
                    })

                    if (shortagesLoading) {
                      return (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                            Cargando expedientes de faltantes...
                          </td>
                        </tr>
                      )
                    }

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            No se encontraron expedientes de faltantes en este estado.
                          </td>
                        </tr>
                      )
                    }

                    return filtered.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="px-4 py-3 font-mono">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {formatDateTime(req.created_at)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Caja {(req as any).register_codigo || "POS"} · {req.cajero_nombre}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {req.cajero_nombre}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-rose-500 text-sm">
                          -₲ {formatPYG(req.monto_faltante_gs)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            req.estado === "PENDIENTE"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : req.estado === "APROBADO_NOMINA"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : req.estado === "CONDONADO_EMPRESA"
                              ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                              : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                          }`}>
                            {req.estado === "PENDIENTE" ? "Pendiente" : req.estado === "APROBADO_NOMINA" ? "Aprobado Nómina" : req.estado === "CONDONADO_EMPRESA" ? "Condonado" : "Rechazado"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {req.resolucion ? (
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white">{req.resolucion}</span>
                              {req.cuotas > 1 && (
                                <span className="block text-[11px] text-slate-400">
                                  {req.cuotas} cuotas de ₲ {formatPYG(req.monto_cuota_gs)}
                                </span>
                              )}
                              {req.periodo_nomina && (
                                <span className="block text-[10px] text-slate-400 font-mono">
                                  Periodo: {req.periodo_nomina}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Sin dictaminar</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            req.sueldok_sync_status === "SINCRONIZADO" || req.sueldok_sync_status === "ENVIADO"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : req.sueldok_sync_status === "NO_APLICA"
                              ? "bg-slate-500/10 text-slate-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}>
                            {req.sueldok_sync_status}
                          </span>
                          {req.sueldok_sync_id && (
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                              {req.sueldok_sync_id}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          {req.observaciones || "—"}
                          {req.aprobado_por && (
                            <div className="text-[10px] text-slate-400">
                              Por: {req.aprobado_por} ({formatDateTime(req.aprobado_at || "")})
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {req.estado === "PENDIENTE" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingShortageModal(req)
                                setShortageResolutionAction("APROBAR_NOMINA")
                                setShortageCuotas(1)
                                setShortageObs("")
                              }}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-sm"
                            >
                              Dictaminar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingShortageModal(req)
                                setShortageResolutionAction("APROBAR_NOMINA")
                                setShortageCuotas(req.cuotas)
                                setShortageObs(req.observaciones || "")
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white text-[11px] font-bold transition"
                            >
                              Ver Detalle
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DICTAMEN DE FALTANTE DE CAJA (SUELDOK) */}
      {resolvingShortageModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Dictamen de Faltante de Caja
                  </h3>
                  <p className="text-xs text-slate-400">
                    Expediente: {resolvingShortageModal.cajero_nombre} · {formatDateTime(resolvingShortageModal.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResolvingShortageModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ficha Resumen */}
            <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Cajero / Funcionario:</span>
                <span className="font-bold text-white text-sm">{resolvingShortageModal.cajero_nombre}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Monto Faltante Arqueado:</span>
                <span className="font-mono font-black text-rose-400 text-base">
                  -₲ {formatPYG(resolvingShortageModal.monto_faltante_gs)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Sesión de Caja:</span>
                <span className="font-mono text-slate-300">{resolvingShortageModal.session_id}</span>
              </div>
            </div>

            {resolvingShortageModal.estado === "PENDIENTE" ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="input-label text-slate-300 font-bold block mb-2">
                    Resolución / Decisión de la Empresa:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setShortageResolutionAction("APROBAR_NOMINA")}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition ${
                        shortageResolutionAction === "APROBAR_NOMINA"
                          ? "bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500"
                          : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <span className="font-bold text-xs text-emerald-400">Descuento en Nómina</span>
                      <span className="text-[10px] text-slate-400">Envía deducción formal a SueldOK</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShortageResolutionAction("CONDONAR")}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition ${
                        shortageResolutionAction === "CONDONAR"
                          ? "bg-blue-950/40 border-blue-500 text-white ring-1 ring-blue-500"
                          : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <span className="font-bold text-xs text-blue-400">Condonar (Pérdida)</span>
                      <span className="text-[10px] text-slate-400">La empresa absorbe la diferencia</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShortageResolutionAction("RECHAZAR")}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition ${
                        shortageResolutionAction === "RECHAZAR"
                          ? "bg-slate-800 border-slate-400 text-white ring-1 ring-slate-400"
                          : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <span className="font-bold text-xs text-slate-300">Rechazar Reclamo</span>
                      <span className="text-[10px] text-slate-400">Rectificación o error de arqueo</span>
                    </button>
                  </div>
                </div>

                {shortageResolutionAction === "APROBAR_NOMINA" && (
                  <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="input-label text-slate-300 font-bold block mb-1">
                          Cantidad de Cuotas:
                        </label>
                        <select
                          value={shortageCuotas}
                          onChange={(e) => setShortageCuotas(Number(e.target.value))}
                          className="input-field bg-slate-900 border-slate-700 text-white text-xs font-bold"
                        >
                          {[1, 2, 3, 4, 5, 6].map((q) => (
                            <option key={q} value={q}>
                              {q} {q === 1 ? "cuota (100%)" : "cuotas mensuales"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="input-label text-slate-300 font-bold block mb-1">
                          Periodo Inicio Nómina:
                        </label>
                        <input
                          type="month"
                          value={shortagePeriodoNomina}
                          onChange={(e) => setShortagePeriodoNomina(e.target.value)}
                          className="input-field bg-slate-900 border-slate-700 text-white text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400">Monto a descontar por cuota:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ₲ {formatPYG(Math.round(resolvingShortageModal.monto_faltante_gs / shortageCuotas))} / mes
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="input-label text-slate-300 font-bold block mb-1">
                    Justificación / Observaciones del Dictamen:
                  </label>
                  <textarea
                    rows={3}
                    value={shortageObs}
                    onChange={(e) => setShortageObs(e.target.value)}
                    placeholder="Detalle la justificación de la decisión tomada (ej: 'Revisión de cámaras confirmó diferencia en gaveta; se acuerda descuento en 2 cuotas')..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setResolvingShortageModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleResolveShortage}
                    disabled={resolvingShortageLoading}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition flex items-center gap-2 shadow-lg shadow-amber-500/25"
                  >
                    {resolvingShortageLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirmar Dictamen</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 space-y-1">
                  <div className="font-bold text-white">Dictamen Asentado: {resolvingShortageModal.resolucion}</div>
                  <div className="text-slate-400">{resolvingShortageModal.observaciones || "Sin observaciones."}</div>
                  <div className="text-[10px] text-slate-500 pt-1">
                    Dictaminado por: {resolvingShortageModal.aprobado_por || "Supervisor"} ({formatDateTime(resolvingShortageModal.aprobado_at || "")})
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setResolvingShortageModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: APERTURA DE CAJA */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                Apertura de Turno de Caja
              </h3>
              <button onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="input-label">Seleccionar Terminal POS</label>
                <select
                  className="input-field"
                  value={selectedRegister}
                  onChange={e => setSelectedRegister(e.target.value)}
                >
                  <option value="">Seleccioná una caja...</option>
                  {registers.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} ({r.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Monto de Fondo Fijo / Cambio Inicial (PYG)</label>
                <input
                  type="number"
                  className="input-field font-mono font-bold text-sm"
                  placeholder="500000"
                  value={montoApertura}
                  onChange={e => setMontoApertura(e.target.value)}
                />
                <p className="text-[11px] text-gray-400 mt-1">Efectivo entregado para cambio inicial en gaveta.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowOpenModal(false)} className="btn-outline text-xs">
                Cancelar
              </button>
              <button onClick={handleOpenSession} className="btn-primary !bg-emerald-600 text-xs">
                Confirmar Apertura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CIERRE Y ARQUEO CIEGO CON CALCULADORA */}
      {showCloseModal && selectedSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div>
                <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-red-600" />
                  Arqueo Ciego Físico & Cierre de Caja
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                  Caja: <strong className="text-gray-800 dark:text-gray-200">{getRegisterName(selectedSession.register_id)}</strong> · Cajero: <strong className="text-gray-800 dark:text-gray-200">{getCajero(selectedSession)}</strong>
                </p>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas del Arqueo Ciego */}
            <div className="grid grid-cols-3 gap-2 bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveArqueoTab("efectivo")}
                className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  activeArqueoTab === "efectivo"
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>1. Efectivo Multimoneda</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveArqueoTab("vouchers")}
                className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  activeArqueoTab === "vouchers"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>2. POS & Tarjetas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveArqueoTab("cheques_vales")}
                className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  activeArqueoTab === "cheques_vales"
                    ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>3. Cheques & Vales</span>
              </button>
            </div>

            {/* TAB 1: EFECTIVO MULTIMONEDA */}
            {activeArqueoTab === "efectivo" && (
              <div className="space-y-4">
                {/* Conteo Guaraníes */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🇵🇾</span>
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-300">Conteo Billetes Guaraníes (₲)</span>
                    </div>
                    <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                      Total: {formatPYG(parseFloat(montoCierre) || 0)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {DENOMINACIONES_PYG.map(d => (
                      <div key={d.valor} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between gap-1 shadow-2xs">
                        <span className="font-bold text-gray-700 dark:text-gray-300">{d.label}</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-14 p-1 border border-gray-200 dark:border-gray-700 rounded-lg text-right font-mono font-black bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                          value={conteoBilletes[d.valor] || ""}
                          onChange={e => handleDenominacionChange(d.valor, parseInt(e.target.value) || 0)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conteo Reales y Dólares */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Reales */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🇧🇷</span>
                        <span className="text-xs font-black text-amber-900 dark:text-amber-300">Reales (BRL)</span>
                      </div>
                      <span className="font-mono font-black text-xs text-amber-700 dark:text-amber-300">
                        R$ {parseFloat(montoCierreBrl || "0").toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs max-h-36 overflow-y-auto pr-1">
                      {DENOMINACIONES_BRL.map(d => (
                        <div key={d.valor} className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/30 flex items-center justify-between gap-1">
                          <span className="font-bold text-[11px] text-gray-700 dark:text-gray-300">{d.label}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            className="w-12 p-1 border border-gray-200 dark:border-gray-700 rounded text-right font-mono font-bold bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white text-xs outline-none focus:border-amber-500"
                            value={conteoBrl[d.valor] || ""}
                            onChange={e => handleDenominacionBrlChange(d.valor, parseInt(e.target.value) || 0)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dólares */}
                  <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🇺🇸</span>
                        <span className="text-xs font-black text-blue-900 dark:text-blue-300">Dólares (USD)</span>
                      </div>
                      <span className="font-mono font-black text-xs text-blue-700 dark:text-blue-300">
                        $ {parseFloat(montoCierreUsd || "0").toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs max-h-36 overflow-y-auto pr-1">
                      {DENOMINACIONES_USD.map(d => (
                        <div key={d.valor} className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900/30 flex items-center justify-between gap-1">
                          <span className="font-bold text-[11px] text-gray-700 dark:text-gray-300">{d.label}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            className="w-12 p-1 border border-gray-200 dark:border-gray-700 rounded text-right font-mono font-bold bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white text-xs outline-none focus:border-blue-500"
                            value={conteoUsd[d.valor] || ""}
                            onChange={e => handleDenominacionUsdChange(d.valor, parseInt(e.target.value) || 0)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: VOUCHERS Y CIERRES DE LOTE POS */}
            {activeArqueoTab === "vouchers" && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-xs font-black text-gray-900 dark:text-white">Cierre de Lote Bancard (Infonet)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Nº de Lote</label>
                      <input
                        type="text"
                        placeholder="Ej: LOTE-042"
                        value={vouchersBancard.lote}
                        onChange={e => setVouchersBancard({ ...vouchersBancard, lote: e.target.value })}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Cant. Cupones</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={vouchersBancard.cupones}
                        onChange={e => setVouchersBancard({ ...vouchersBancard, cupones: e.target.value })}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Monto Total (₲)</label>
                      <input
                        type="text"
                        placeholder="₲ 0"
                        value={vouchersBancard.total}
                        onChange={e => setVouchersBancard({ ...vouchersBancard, total: e.target.value })}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs font-black text-gray-900 dark:text-white">Cierre de Lote Dinelco (Pronet)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Nº de Lote</label>
                      <input
                        type="text"
                        placeholder="Ej: LOTE-019"
                        value={vouchersDinelco.lote}
                        onChange={e => setVouchersDinelco({ ...vouchersDinelco, lote: e.target.value })}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Cant. Cupones</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={vouchersDinelco.cupones}
                        onChange={e => setVouchersDinelco({ ...vouchersDinelco, cupones: e.target.value })}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Monto Total (₲)</label>
                      <input
                        type="text"
                        placeholder="₲ 0"
                        value={vouchersDinelco.total}
                        onChange={e => setVouchersDinelco({ ...vouchersDinelco, total: e.target.value })}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CHEQUES EN CARTERA Y VALES */}
            {activeArqueoTab === "cheques_vales" && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-black text-gray-900 dark:text-white">Cheques Físicos Recibidos en Turno</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Cantidad de Cheques</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={chequesRecibidos.cantidad}
                        onChange={e => setChequesRecibidos({ ...chequesRecibidos, cantidad: e.target.value })}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Monto Total Cheques (₲)</label>
                      <input
                        type="text"
                        placeholder="₲ 0"
                        value={chequesRecibidos.total}
                        onChange={e => setChequesRecibidos({ ...chequesRecibidos, total: e.target.value })}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-black text-gray-900 dark:text-white">Vales & Créditos Extra Club</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Cantidad de Vales/Cupones</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={creditosClub.vales}
                        onChange={e => setCreditosClub({ ...creditosClub, vales: e.target.value })}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Monto Total Vales (₲)</label>
                      <input
                        type="text"
                        placeholder="₲ 0"
                        value={creditosClub.total}
                        onChange={e => setCreditosClub({ ...creditosClub, total: e.target.value })}
                        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Observaciones de Cierre */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                Observaciones del Arqueo / Justificación
              </label>
              <textarea
                rows={2}
                className="w-full p-2 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-red-500"
                placeholder="Indique sobre sellado de remesa, cupones o detalles relevantes..."
                value={observacionesCierre}
                onChange={e => setObservacionesCierre(e.target.value)}
              />
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="text-xs font-mono font-bold text-gray-500">
                Remesa a Bóveda Central
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCloseSession}
                  className="px-5 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Finalizar & Guardar Arqueo Ciego
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: RESULTADO DEL CIERRE (FEEDBACK INSTANTÁNEO) */}
      {closeResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in-up text-center">
            {closeResult.diferencia === 0 ? (
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}

            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              {closeResult.diferencia === 0
                ? "¡Arqueo Cuadrado a la Perfección!"
                : "Arqueo Registrado con Descuadre"}
            </h3>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/80 border space-y-2 font-mono">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Diferencia vs POS:</span>
                <span className={`font-bold ${
                  closeResult.diferencia === 0 ? "text-emerald-600" : closeResult.diferencia > 0 ? "text-blue-600" : "text-red-600"
                }`}>
                  {closeResult.diferencia > 0 ? `+${formatPYG(closeResult.diferencia)}` : formatPYG(closeResult.diferencia)}
                </span>
              </div>
              {closeResult.requiere_revision && (
                <div className="p-2 rounded bg-red-100 text-red-800 text-[11px] font-bold">
                  ⚠️ El descuadre supera la tolerancia configurada. Se notificó a Auditoría.
                </div>
              )}
            </div>

            <button
              onClick={() => setCloseResult(null)}
              className="btn-primary !bg-indigo-600 w-full text-xs"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ENTREGA A BÓVEDA CON PIN/CREDENCIALES DE SUPERVISOR */}
      {showConfirmHandoffModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-600" />
                Custodia de Efectivo a Bóveda
              </h3>
              <button onClick={() => setShowConfirmHandoffModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 text-xs text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
              Monto declarado por cajero: <strong className="font-mono">{formatPYG(showConfirmHandoffModal.monto_pyg)}</strong>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="input-label">Monto Contado por Supervisor (PYG)</label>
                <input
                  type="number"
                  className="input-field font-mono font-bold text-sm text-emerald-600"
                  value={montoConfirmado}
                  onChange={e => setMontoConfirmado(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Email de Supervisor</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="supervisor@extrasupermercado.com"
                  value={supervisorEmail}
                  onChange={e => setSupervisorEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Contraseña / PIN de Supervisor</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={supervisorPassword}
                  onChange={e => setSupervisorPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowConfirmHandoffModal(null)} className="btn-outline text-xs">
                Cancelar
              </button>
              <button
                onClick={handleConfirmHandoff}
                disabled={confirmingHandoff || !supervisorEmail || !supervisorPassword}
                className="btn-primary !bg-indigo-600 text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {confirmingHandoff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                Confirmar e Imprimir Recibo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CASH DROP / SANGRÍA */}
      {showCashDropModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                Retiro Parcial / Sangría de Caja
              </h3>
              <button onClick={() => setShowCashDropModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="input-label">Monto a Retirar a Bóveda (PYG)</label>
                <input
                  type="number"
                  className="input-field font-mono font-bold text-sm text-amber-600"
                  value={cashDropMonto}
                  onChange={e => setCashDropMonto(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Observaciones</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Retiro por acumulación de efectivo..."
                  value={cashDropObs}
                  onChange={e => setCashDropObs(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCashDropModal(null)} className="btn-outline text-xs">
                Cancelar
              </button>
              <button onClick={handleConfirmCashDrop} className="btn-primary !bg-amber-600 hover:!bg-amber-500 text-xs">
                Confirmar Retiro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DESGLOSE DE COBROS */}
      {showBreakdownModal && selectedSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                Desglose de Cobros del Turno
              </h3>
              <button onClick={() => setShowBreakdownModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {breakdownLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="card overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 font-bold uppercase">
                      <tr>
                        <th className="p-2.5">Medio de Pago</th>
                        <th className="p-2.5 text-center">Cant.</th>
                        <th className="p-2.5 text-right">Total</th>
                        <th className="p-2.5 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {breakdown.map((b, i) => (
                        <tr key={i}>
                          <td className="p-2.5 font-bold text-gray-900 dark:text-white">{b.forma_pago}</td>
                          <td className="p-2.5 text-center font-mono">{b.cantidad}</td>
                          <td className="p-2.5 text-right font-mono font-bold">{formatPYG(b.monto)}</td>
                          <td className="p-2.5 text-right font-mono text-gray-400">{b.porcentaje}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {otrasMonedas.length > 0 && (
                  <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                    <span className="font-bold text-purple-900 dark:text-purple-300 block mb-1">Monedas Extranjeras:</span>
                    {otrasMonedas.map((om, i) => (
                      <div key={i} className="flex justify-between font-mono">
                        <span>{om.forma_pago} ({om.moneda}):</span>
                        <span className="font-bold">{om.monto.toLocaleString("es-PY")} {om.moneda}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={async () => {
                  if (selectedSession) {
                    try {
                      const safeCajero = (selectedSession.cajero_nombre || "caja").replace(/\s+/g, "_")
                      const safeFecha = (selectedSession.fecha_apertura || "").slice(0, 10) || "sesion"
                      await downloadPdf(`/v1/cash-sessions/${selectedSession.id}/export/cierre.pdf`, `cierre_${safeCajero}_${safeFecha}.pdf`)
                      toast.success("Acta descargada", "Comprobante de cierre generado correctamente.")
                    } catch {
                      toast.error("Error", "No se pudo generar el PDF del cierre.")
                    }
                  }
                }}
                className="btn-outline !text-blue-600 dark:!text-blue-400 !border-blue-500/30 hover:!bg-blue-50 dark:hover:!bg-blue-950/30 text-xs flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                Descargar Acta Oficial (PDF)
              </button>
              <button onClick={() => setShowBreakdownModal(false)} className="btn-primary text-xs">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UMBRALES DE CAJA */}
      {showThresholdModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" />
                Límites de Seguridad: {showThresholdModal.nombre}
              </h3>
              <button onClick={() => setShowThresholdModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="input-label">Umbral de Alerta Cash Drop (PYG)</label>
                <input
                  type="number"
                  className="input-field font-mono font-bold"
                  value={thresholdValue}
                  onChange={e => setThresholdValue(e.target.value)}
                />
                <p className="text-[11px] text-gray-400 mt-1">Alerta al supervisor cuando el efectivo en gaveta supera este monto.</p>
              </div>

              <div>
                <label className="input-label">Diferencia Máxima Tolerada en Cierre (PYG)</label>
                <input
                  type="number"
                  className="input-field font-mono font-bold"
                  value={diferenciaToleradaValue}
                  onChange={e => setDiferenciaToleradaValue(e.target.value)}
                />
                <p className="text-[11px] text-gray-400 mt-1">Descuadre a partir del cual el arqueo se marca para revisión de auditoría.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowThresholdModal(null)} className="btn-outline text-xs">
                Cancelar
              </button>
              <button onClick={handleSaveThreshold} className="btn-primary text-xs">
                Guardar Umbrales
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR CAJA */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Registrar Nueva Terminal POS
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="input-label">Nombre de la Terminal</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: Caja 05 - Entrada Principal"
                  value={newRegisterName}
                  onChange={e => setNewRegisterName(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Código Único</label>
                <input
                  type="text"
                  className="input-field font-mono uppercase"
                  placeholder="POS-05"
                  value={newRegisterCodigo}
                  onChange={e => setNewRegisterCodigo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreateModal(false)} className="btn-outline text-xs">
                Cancelar
              </button>
              <button onClick={handleCreateRegister} className="btn-primary text-xs">
                Crear Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: GENERAR ACTA DE ENTREGA / LIQUIDACIÓN A CENTRO AMOR Y ESPERANZA ── */}
      {showLiquidarModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-600 fill-rose-500" />
                <span>Liquidación & Acta de Entrega a la ONG</span>
              </h3>
              <button onClick={() => setShowLiquidarModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs">
              <div className="font-bold text-rose-800 dark:text-rose-300">
                Campaña: {donationStats?.campana_activa?.nombre || "Abre tu corazón"}
              </div>
              <div className="text-rose-700 dark:text-rose-400 mt-0.5">
                Beneficiario: <strong>{donationStats?.campana_activa?.ong_nombre || "Centro Amor y Esperanza"}</strong> ({donationStats?.campana_activa?.ong_web || "www.centroamoresperanza.org"})
              </div>
              <div className="mt-2 text-xs font-mono font-bold text-rose-900 dark:text-rose-200">
                Fondos Pendientes en Custodia: {formatPYG(donationStats?.total_pendiente_pyg || 0)}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Fecha Desde</label>
                  <input
                    type="date"
                    className="input-field font-mono"
                    value={liquidarDesde}
                    onChange={(e) => setLiquidarDesde(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">Fecha Hasta</label>
                  <input
                    type="date"
                    className="input-field font-mono"
                    value={liquidarHasta}
                    onChange={(e) => setLiquidarHasta(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Entregado Por (Representante Extra Supermercado)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej: Gerencia de Operaciones"
                  value={liquidarEntregadoPor}
                  onChange={(e) => setLiquidarEntregadoPor(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Recibido Por (Representante ONG)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Lic. María Fernández (Directora)"
                    value={liquidarRecibidoPor}
                    onChange={(e) => setLiquidarRecibidoPor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label">C.I. del Receptor</label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="Ej: 3.456.789"
                    value={liquidarRecibidoCi}
                    onChange={(e) => setLiquidarRecibidoCi(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">N° Comprobante / Boleta Bancaria (opcional)</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="Ej: TRF-BNF-2026-98124"
                  value={liquidarComprobante}
                  onChange={(e) => setLiquidarComprobante(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Observaciones</label>
                <textarea
                  rows={2}
                  className="input-field"
                  value={liquidarObservaciones}
                  onChange={(e) => setLiquidarObservaciones(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowLiquidarModal(false)}
                className="btn-outline text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleLiquidarDonaciones}
                disabled={liquidating}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30"
              >
                {liquidating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Generar Acta & Entregar Fondos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VISOR DE ACTA OFICIAL IMPRIMIBLE ── */}
      {selectedActaPdf && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 max-w-2xl w-full p-8 rounded-3xl space-y-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">DOCUMENTO OFICIAL DE RENDICIÓN RSE</span>
                <h2 className="text-xl font-black text-slate-900 font-mono">{selectedActaPdf.numero_acta}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-slate-800"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir
                </button>
                <button onClick={() => setSelectedActaPdf(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="text-center space-y-1">
              <div className="text-sm font-black text-slate-900 uppercase">GRUPO SANTA TERESA E.A.S. · RUC 80150377-9</div>
              <div className="text-xs text-slate-500">ACTA DE ENTREGA DE FONDOS SOLIDARIOS POR REDONDEO DE VUELTO</div>
              <div className="text-xs font-bold text-rose-600">CAMPAÑA "ABRE TU CORAZÓN" · CENTRO AMOR Y ESPERANZA</div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Monto Total Entregado:</span>
                <span className="text-base font-black font-mono text-slate-900">{formatPYG(selectedActaPdf.monto_total_pyg)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cantidad de Micro-Donaciones:</span>
                <span className="font-mono font-bold text-slate-800">{selectedActaPdf.cantidad_donaciones} tickets</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Período de Recaudación:</span>
                <span className="font-mono text-slate-800">{formatDateTime(selectedActaPdf.fecha_desde)} al {formatDateTime(selectedActaPdf.fecha_hasta)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Entregado Por:</span>
                <span className="font-bold text-slate-800">{selectedActaPdf.entregado_por_nombre || "Extra Supermercado"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recibido Por (ONG):</span>
                <span className="font-bold text-slate-800">{selectedActaPdf.recibido_por_nombre} (CI: {selectedActaPdf.recibido_por_ci || "-"})</span>
              </div>
              {selectedActaPdf.comprobante_transferencia && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Comprobante Bancario:</span>
                  <span className="font-mono text-slate-800">{selectedActaPdf.comprobante_transferencia}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
              <div className="border-t border-slate-400 pt-2">
                <p className="font-bold text-slate-800">Firma Entregado</p>
                <p className="text-[10px] text-slate-500">Extra Supermercado</p>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <p className="font-bold text-slate-800">Firma & Sello Receptor</p>
                <p className="text-[10px] text-slate-500">Centro Amor y Esperanza</p>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
              Conocé más y auditá las obras de la campaña en: <strong className="text-blue-600">www.centroamoresperanza.org</strong>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REIMPRESIÓN TÉRMICA ESC/POS */}
      {escposModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Reimpresión de Arqueo Térmico</h3>
                  <p className="text-xs text-slate-400 font-mono">Formato ESC/POS 80mm · Consolidación en Guaraníes</p>
                </div>
              </div>
              <button
                onClick={() => setEscposModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {escposLoading ? (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-400" />
                <p className="text-xs text-slate-400">Generando reconciliación y ticket térmico...</p>
              </div>
            ) : escposTicketData ? (
              <div className="space-y-4">
                {/* Visualizador del ticket estilo papel térmico */}
                <div className="bg-amber-50 dark:bg-slate-950 p-4 rounded-xl border border-amber-200/60 dark:border-slate-800 font-mono text-[11px] leading-relaxed text-slate-800 dark:text-amber-100 shadow-inner max-h-[420px] overflow-y-auto whitespace-pre selection:bg-amber-300 selection:text-slate-900">
                  {escposTicketData.ticket_text}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(escposTicketData.ticket_text)
                        toast.success("Copiado", "Texto del ticket copiado al portapapeles.")
                      }}
                      className="btn-ghost text-xs text-slate-300 hover:text-white"
                    >
                      Copiar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([escposTicketData.ticket_text], { type: "text/plain;charset=utf-8" })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url
                        a.download = `cierre_${getTodayAsuncion().replace(/-/g, "")}.txt`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="btn-ghost text-xs text-slate-300 hover:text-white"
                    >
                      Descargar .txt
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEscposModalOpen(false)}
                      className="btn-ghost text-xs text-slate-400 hover:text-white"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintEscpos}
                      className="btn-primary text-xs !bg-amber-500 hover:!bg-amber-600 !text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir Ticket
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No se pudo cargar el ticket térmico.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📋 MODAL: PLANILLA DE PUNTEO DE ARQUEO DETALLADO (FASE 5) */}
      {punteoModalOpen && (
        <div className="fixed inset-0 lg:left-64 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-[96vw] lg:w-[calc(96vw-16rem)] max-w-6xl xl:max-w-7xl max-h-[92vh] flex flex-col p-5 sm:p-6 shadow-2xl my-auto">
            {/* Header fijo */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-500/30 shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">Planilla de Punteo de Arqueo y Control de Vouchers</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {punteoData?.session_data ? (
                      `Caja: ${punteoData.session_data.register_nombre || "Caja"} · Cajero/a: ${punteoData.session_data.cajero_nombre || "—"} · Apertura: ${formatDateTime(punteoData.session_data.fecha_apertura)}`
                    ) : "Cotejo físico comprobante por comprobante"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {punteoData?.session_data && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.caja.downloadSessionPunteoPdf(punteoData.session_data.id)
                        toast.success("Planilla Descargada", "PDF oficial de punteo generado con éxito.")
                      } catch {
                        toast.error("Error", "No se pudo generar el PDF de punteo.")
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-600/30 whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Descargar Planilla PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </button>
                )}
                <button
                  onClick={() => setPunteoModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {punteoLoading ? (
              <div className="py-24 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600 dark:text-purple-400" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Cargando transacciones y vouchers de la sesión...</p>
              </div>
            ) : punteoData ? (
              <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
                {/* 🌟 SECCIÓN 1: RENDICIÓN DE EFECTIVO FÍSICO EN BILLETES (GAVETA) */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white border border-slate-700/80 shadow-md space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-emerald-400">Rendición de Efectivo Físico (Billetes y Monedas en Gaveta)</h4>
                        <p className="text-[10px] sm:text-[11px] text-slate-400">
                          El efectivo se rinde contando billetes en el arqueo ciego. A continuación se cotejan exclusivamente los comprobantes no-efectivo.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                      <div className="text-right">
                        <span className="text-slate-400 text-[9px] block uppercase font-bold">Contado Físico</span>
                        <span className="font-bold text-white text-xs sm:text-sm">{formatPYG(punteoData.session_data?.monto_cierre || 0)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[9px] block uppercase font-bold">Esperado Sistema</span>
                        <span className="text-slate-300 text-xs sm:text-sm">{formatPYG(punteoData.session_data?.monto_cierre_esperado || 0)}</span>
                      </div>
                      <div className="text-right pl-2.5 border-l border-slate-700">
                        <span className="text-slate-400 text-[9px] block uppercase font-bold">Diferencia Efectivo</span>
                        {(() => {
                          const difEf = Number(punteoData.session_data?.monto_cierre || 0) - Number(punteoData.session_data?.monto_cierre_esperado || 0)
                          return (
                            <span className={`font-black text-xs sm:text-sm ${difEf === 0 ? "text-emerald-400" : difEf < 0 ? "text-rose-400" : "text-blue-400"}`}>
                              {difEf !== 0 ? (difEf > 0 ? `+${formatPYG(difEf)}` : formatPYG(difEf)) : "₲ 0 (Exacto)"}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🌟 SECCIÓN 2: COMPROBANTES DE PAGO NO EFECTIVO */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4" /> Comprobantes y Vouchers a Puntear (Medios No Efectivo)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Total comprobantes: <b>{punteoData.vouchers?.length || 0}</b>
                  </span>
                </div>

                {/* 1. Resumen de Comprobantes por Medio de Pago */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {Object.entries(punteoData.summary_by_method || {}).map(([key, val]: [string, any]) => {
                    const cant = val.cantidad || 0
                    const monto = Number(val.monto_gs || 0)
                    if (cant === 0 && monto === 0) return null

                    // Calcular comprobantes presentes y faltantes de este medio
                    const vouchersDelCanal = (punteoData.vouchers || []).filter((v: any) => v.canal_key === key || val.label?.includes(v.medio_pago))
                    const conformes = vouchersDelCanal.filter((v: any) => (punteoStatuses[v.id] || "conforme") === "conforme").length
                    const faltantes = vouchersDelCanal.filter((v: any) => punteoStatuses[v.id] === "faltante").length

                    return (
                      <div
                        key={key}
                        onClick={() => setPunteoFilterCanal(punteoFilterCanal === key ? "todos" : key)}
                        className={`p-2.5 rounded-xl border text-xs space-y-1.5 cursor-pointer transition-all ${
                          punteoFilterCanal === key
                            ? "bg-purple-50 dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/40"
                            : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/70 hover:border-purple-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 truncate block" title={val.label || key}>
                            {val.label || key}
                          </span>
                          {faltantes > 0 && (
                            <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[9px] font-bold rounded border border-rose-200 dark:border-rose-800 shrink-0 whitespace-nowrap">
                              {faltantes} faltante{faltantes !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div className="font-mono font-black text-slate-900 dark:text-white text-xs">
                          {formatPYG(monto)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between whitespace-nowrap">
                          <span>{cant} voucher{cant !== 1 ? "s" : ""}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{conformes} ✓</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 2. Balance Global y Cuadre de Comprobantes Físicos */}
                {(() => {
                  const allV = punteoData.vouchers || []
                  let totEsperado = 0
                  let totFisico = 0
                  let countConformes = 0
                  let countFaltantes = 0
                  let countDiscrepantes = 0

                  allV.forEach((v: any) => {
                    totEsperado += v.monto_gs
                    const st = punteoStatuses[v.id] || "conforme"
                    if (st === "conforme") {
                      totFisico += v.monto_gs
                      countConformes++
                    } else if (st === "faltante") {
                      countFaltantes++
                    } else if (st === "discrepante") {
                      const m = punteoDiscrepanciasMonto[v.id] !== undefined ? punteoDiscrepanciasMonto[v.id] : v.monto_gs
                      totFisico += m
                      countDiscrepantes++
                    }
                  })

                  const difVouchers = totFisico - totEsperado
                  const isCuadrado = difVouchers === 0 && countFaltantes === 0 && countDiscrepantes === 0

                  return (
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                            Arqueo de Comprobantes Físicos en Gaveta / Sobre
                          </span>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              Esperado: <strong className="font-mono text-slate-900 dark:text-white">{formatPYG(totEsperado)}</strong>
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              Físico Cotejado: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(totFisico)}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-3 py-1.5 rounded-xl text-xs font-black font-mono border whitespace-nowrap ${
                              isCuadrado
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700"
                                : difVouchers < 0
                                ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700"
                                : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700"
                            }`}
                          >
                            {isCuadrado
                              ? "✓ VOUCHERS CUADRADOS"
                              : `DIFERENCIA: ${difVouchers >= 0 ? "+" : ""}${formatPYG(difVouchers)}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ {countConformes} Conformes</span>
                          <span className={countFaltantes > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-slate-400 dark:text-slate-500"}>
                            ✕ {countFaltantes} Faltantes
                          </span>
                          <span className={countDiscrepantes > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-400 dark:text-slate-500"}>
                            ≠ {countDiscrepantes} Con Discrepancia
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetAllVoucherStatus("conforme")}
                            className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-bold transition whitespace-nowrap"
                          >
                            Marcar Todos Conformes
                          </button>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <button
                            type="button"
                            onClick={() => handleSetAllVoucherStatus("faltante")}
                            className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 font-semibold transition whitespace-nowrap"
                          >
                            Marcar Todos Faltantes
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* 3. Filtros y Búsqueda */}
                {(() => {
                  const allV = punteoData.vouchers || []
                  const filtered = allV.filter((v: any) => {
                    const matchSearch =
                      !punteoSearch ||
                      v.numero_ticket?.toLowerCase().includes(punteoSearch.toLowerCase()) ||
                      v.nro_boleta?.toLowerCase().includes(punteoSearch.toLowerCase()) ||
                      v.medio_pago?.toLowerCase().includes(punteoSearch.toLowerCase()) ||
                      v.codigo_autorizacion?.toLowerCase().includes(punteoSearch.toLowerCase()) ||
                      v.tarjeta_marca?.toLowerCase().includes(punteoSearch.toLowerCase()) ||
                      v.nsu?.toLowerCase().includes(punteoSearch.toLowerCase())
                    const matchCanal = punteoFilterCanal === "todos" || v.canal_key === punteoFilterCanal
                    return matchSearch && matchCanal
                  })

                  return (
                    <>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Buscar por nro ticket, boleta/voucher, código autorización, marca..."
                            value={punteoSearch}
                            onChange={(e) => setPunteoSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <select
                          value={punteoFilterCanal}
                          onChange={e => setPunteoFilterCanal(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 shrink-0"
                        >
                          <option value="todos">Todos los Canales ({allV.length})</option>
                          <option value="TARJETA_BANCARD">Bancard Tarjeta</option>
                          <option value="TARJETA_DINELCO">Dinelco Tarjeta</option>
                          <option value="BANCARD_QR">Bancard QR</option>
                          <option value="DINELCO_QR">Dinelco QR</option>
                          <option value="PIX">PIX Brasil</option>
                          <option value="TRANSFERENCIA">Transferencia SIPAP</option>
                          <option value="EXTRA_CLUB">Extra Club</option>
                          <option value="VALES">Vales & Cheques</option>
                          <option value="EFECTIVO">Efectivo Físico</option>
                          <option value="OTROS">Otros</option>
                        </select>
                      </div>

                      {/* 4. Tabla Detallada con Detalles de Transacción y Cotejo de Pertinencia */}
                      <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-x-auto max-h-[440px] overflow-y-auto bg-white dark:bg-slate-900 shadow-sm">
                        <table className="w-full min-w-[960px] text-left text-xs border-collapse">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider sticky top-0 text-[10px] z-10 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="p-2.5 whitespace-nowrap">Hora</th>
                              <th className="p-2.5 whitespace-nowrap">Ticket / Factura</th>
                              <th className="p-2.5 whitespace-nowrap">Instrumento / Canal</th>
                              <th className="p-2.5 whitespace-nowrap">Boleta / Voucher / Aut.</th>
                              <th className="p-2.5 whitespace-nowrap">Tarjeta / Titular</th>
                              <th className="p-2.5 text-right whitespace-nowrap">Monto Gs.</th>
                              <th className="p-2.5 text-center whitespace-nowrap">Cotejo Físico & Pertinencia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filtered.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-10 text-center text-slate-500 dark:text-slate-400">
                                  No hay comprobantes con el filtro aplicado.
                                </td>
                              </tr>
                            ) : (
                              filtered.map((v: any) => {
                                const st = punteoStatuses[v.id] || "conforme"
                                const isFaltante = st === "faltante"
                                const isDiscrepante = st === "discrepante"
                                const isConforme = st === "conforme"

                                return (
                                  <tr
                                    key={v.id}
                                    className={`transition-colors ${
                                      isFaltante
                                        ? "bg-rose-50/80 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200"
                                        : isDiscrepante
                                        ? "bg-amber-50/80 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200"
                                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-300"
                                    }`}
                                  >
                                    <td className="p-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                      {v.fecha ? new Date(v.fecha).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                                    </td>
                                    <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                      {v.numero_ticket}
                                    </td>
                                    <td className="p-2.5 whitespace-nowrap">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                                        v.canal_key?.includes("BANCARD")
                                          ? "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-700"
                                          : v.canal_key?.includes("DINELCO")
                                          ? "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700"
                                          : v.canal_key === "PIX"
                                          ? "bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-950/80 dark:text-teal-200 dark:border-teal-700"
                                          : v.canal_key === "TRANSFERENCIA"
                                          ? "bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-700"
                                          : v.canal_key === "EXTRA_CLUB"
                                          ? "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700"
                                          : "bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                                      }`}>
                                        {v.medio_pago}
                                      </span>
                                    </td>
                                    <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">
                                      {v.nro_boleta && v.nro_boleta !== "—" ? (
                                        <div className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                                          <span className="text-[9px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300 font-sans font-semibold bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">Boleta:</span>
                                          <span>{v.nro_boleta}</span>
                                        </div>
                                      ) : null}
                                      {v.codigo_autorizacion && v.codigo_autorizacion !== "—" ? (
                                        <div className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5 mt-0.5">
                                          <span className="text-[9px] text-slate-600 dark:text-slate-400 font-sans font-normal bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">Aut:</span>
                                          <span>{v.codigo_autorizacion}</span>
                                        </div>
                                      ) : (!v.nro_boleta || v.nro_boleta === "—") ? (
                                        <span className="text-slate-400 dark:text-slate-500">—</span>
                                      ) : null}
                                      {v.nsu && v.nsu !== "—" && (
                                        <div className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                                          NSU: {v.nsu}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-xs whitespace-nowrap">
                                      {v.tarjeta_marca !== "—" ? (
                                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                                          {v.tarjeta_marca} <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px]">{v.tarjeta_pan}</span>
                                        </div>
                                      ) : v.titular !== "—" ? (
                                        <span className="text-slate-700 dark:text-slate-300">{v.titular}</span>
                                      ) : (
                                        <span className="text-slate-400 dark:text-slate-500">—</span>
                                      )}
                                    </td>
                                    <td className="p-2.5 font-mono font-bold text-right text-slate-900 dark:text-white whitespace-nowrap">
                                      {formatPYG(v.monto_gs)}
                                      {v.moneda !== "PYG" && (
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                          {v.moneda} {v.monto_original?.toFixed(2)}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2 text-center whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                        <button
                                          type="button"
                                          title="Comprobante presente y conforme"
                                          onClick={() => handleSetVoucherStatus(v.id, "conforme")}
                                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                                            isConforme
                                              ? "bg-emerald-600 text-white shadow-sm"
                                              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700"
                                          }`}
                                        >
                                          ✓ Conforme
                                        </button>
                                        <button
                                          type="button"
                                          title="Comprobante físico no encontrado / faltante"
                                          onClick={() => handleSetVoucherStatus(v.id, "faltante")}
                                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                                            isFaltante
                                              ? "bg-rose-600 text-white shadow-sm"
                                              : "text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                          }`}
                                        >
                                          ✕ Faltante
                                        </button>
                                        <button
                                          type="button"
                                          title="Monto del voucher discrepa con el sistema"
                                          onClick={() => {
                                            handleSetVoucherStatus(v.id, "discrepante")
                                            const nuevoMonto = window.prompt(`Monto físico real que figura en el papel del comprobante (Gs.):`, String(v.monto_gs))
                                            if (nuevoMonto !== null && !isNaN(Number(nuevoMonto))) {
                                              setPunteoDiscrepanciasMonto(prev => ({
                                                ...prev,
                                                [v.id]: Number(nuevoMonto)
                                              }))
                                            }
                                          }}
                                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                                            isDiscrepante
                                              ? "bg-amber-600 text-white shadow-sm"
                                              : "text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                          }`}
                                        >
                                          ≠ Discrepancia
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                })()}

                {/* 5. Dictamen y Asiento de Auditoría de Comprobantes */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <label className="input-label text-slate-700 dark:text-slate-300 font-bold block text-xs">
                    Dictamen y Observaciones del Control de Comprobantes Físicos:
                  </label>
                  <textarea
                    rows={2}
                    value={punteoObsDictamen}
                    onChange={e => setPunteoObsDictamen(e.target.value)}
                    placeholder="Asiente cualquier discrepancia o faltante detectado en los comprobantes (ej: 'Voucher Bancard #1048 ausente en sobre; se corroboró cierre de lote POS digital exitoso')..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
                No se encontraron datos para la planilla de punteo.
              </div>
            )}

            {/* 6. Footer de Acciones Fijo */}
            {punteoData && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs shrink-0 mt-2">
                <span className="text-slate-500 dark:text-slate-400">
                  Total auditado: <b className="text-slate-900 dark:text-white">{punteoData.total_vouchers || 0}</b> comprobantes registrados.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPunteoModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePunteoAudit}
                    disabled={savingPunteoAudit}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold transition flex items-center gap-1.5 shadow-md"
                  >
                    {savingPunteoAudit ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Asentando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Guardar Auditoría</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIncorporateVaultAndBanks(punteoData.session_data.id)}
                    disabled={incorporatingSessionId === punteoData.session_data.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 whitespace-nowrap"
                  >
                    {incorporatingSessionId === punteoData.session_data.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Incorporando...</span>
                      </>
                    ) : (
                      <>
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Asentar en Bóveda & Bancos</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🧾 MODAL: RESUMEN Y DETALLE DE TODAS LAS VENTAS QUE COMPONEN LA CAJA */}
      {sessionSalesModalOpen && (
        <div className="fixed inset-0 lg:left-64 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-[96vw] lg:w-[calc(96vw-16rem)] max-w-6xl xl:max-w-7xl max-h-[92vh] flex flex-col p-5 sm:p-6 shadow-2xl my-auto">
            {/* Header fijo */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30 shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    Resumen y Composición de Ventas de la Caja
                    {sessionSalesData?.session?.estado && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        sessionSalesData.session.estado === "cerrada"
                          ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse"
                      }`}>
                        {sessionSalesData.session.estado}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {sessionSalesData?.session ? (
                      <>
                        <strong className="text-slate-700 dark:text-slate-200">{sessionSalesData.session.register_nombre}</strong> · Cajero/a: <strong className="text-slate-700 dark:text-slate-200">{sessionSalesData.session.cajero_nombre}</strong> · Apertura: <span className="font-mono">{sessionSalesData.session.fecha_apertura_local}</span> · Cierre: <span className="font-mono">{sessionSalesData.session.fecha_cierre_local}</span>
                      </>
                    ) : "Detalle comprobante a comprobante"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {sessionSalesData?.session && (
                  <button
                    type="button"
                    disabled={downloadingSalesPdf}
                    onClick={async () => {
                      if (!selectedSalesSessionId) return
                      try {
                        setDownloadingSalesPdf(true)
                        const safeCajero = (sessionSalesData?.session?.cajero_nombre || "caja").replace(/\s+/g, "_")
                        const safeFecha = (sessionSalesData?.session?.fecha_apertura_local || "").slice(0, 10).replace(/\//g, "-") || "sesion"
                        await api.caja.downloadSessionSalesPdf(selectedSalesSessionId, `ventas_${safeCajero}_${safeFecha}.pdf`)
                        toast.success("PDF generado", "Informe de ventas A4 descargado con éxito.")
                      } catch (err: any) {
                        toast.error("Error al exportar", err?.message || "No se pudo generar el PDF de ventas.")
                      } finally {
                        setDownloadingSalesPdf(false)
                      }
                    }}
                    title="Descargar Informe Completo de Ventas en PDF (Formato A4)"
                    className="px-3 py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    {downloadingSalesPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    )}
                    <span>Exportar PDF A4</span>
                  </button>
                )}
                <button
                  onClick={() => setSessionSalesModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {sessionSalesLoading ? (
              <div className="py-24 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 dark:text-indigo-400" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Cargando ventas y medios de pago de la sesión...</p>
              </div>
            ) : sessionSalesData ? (
              <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
                {/* 1. KPI Cards de la Sesión */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* KPI 1: Ventas Totales */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-200 dark:border-indigo-800/60 space-y-1">
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                      Total Facturado (PYG)
                    </span>
                    <div className="text-lg sm:text-xl font-black font-mono text-indigo-950 dark:text-indigo-100">
                      {formatPYG(sessionSalesData.totales.total_ventas_gs)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>{sessionSalesData.totales.cantidad_ventas} tickets emitidos</span>
                      <span>Prom: {formatPYG(sessionSalesData.totales.ticket_promedio_gs)}</span>
                    </div>
                  </div>

                  {/* KPI 2: Ventas en Efectivo */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                      Recaudación Efectivo
                    </span>
                    <div className="text-lg sm:text-xl font-black font-mono text-emerald-950 dark:text-emerald-100">
                      {formatPYG(sessionSalesData.totales.ventas_efectivo_gs)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Fondo Gs: {formatPYG(sessionSalesData.totales.fondo_apertura_gs)}</span>
                      {sessionSalesData.totales.total_drops_gs > 0 && (
                        <span className="text-amber-600">Drops: -{formatPYG(sessionSalesData.totales.total_drops_gs)}</span>
                      )}
                    </div>
                  </div>

                  {/* KPI 3: Medios No Efectivo (Tarjetas, QR, PIX) */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:from-purple-950/40 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800/60 space-y-1">
                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                      Medios Electrónicos / QR / Tarjetas
                    </span>
                    <div className="text-lg sm:text-xl font-black font-mono text-purple-950 dark:text-purple-100">
                      {formatPYG(sessionSalesData.totales.ventas_no_efectivo_gs)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {sessionSalesData.totales.total_ventas_gs > 0
                        ? `${((sessionSalesData.totales.ventas_no_efectivo_gs / sessionSalesData.totales.total_ventas_gs) * 100).toFixed(1)}% del total facturado`
                        : "0%"}
                    </div>
                  </div>

                  {/* KPI 4: Cuadre y Descuadre */}
                  {(() => {
                    const dif = Number(sessionSalesData.totales.diferencia_gs || 0)
                    const isPerfect = dif === 0
                    const isSobrante = dif > 0
                    return (
                      <div className={`p-3.5 rounded-2xl border space-y-1 ${
                        isPerfect
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60"
                          : isSobrante
                          ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60"
                          : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60"
                      }`}>
                        <span className={`text-[11px] font-bold uppercase tracking-wide ${
                          isPerfect ? "text-emerald-700 dark:text-emerald-300" : isSobrante ? "text-blue-700 dark:text-blue-300" : "text-rose-700 dark:text-rose-300"
                        }`}>
                          {isPerfect ? "✓ Cuadre Exacto" : isSobrante ? "↑ Sobrante en Caja" : "↓ Faltante en Caja"}
                        </span>
                        <div className={`text-lg sm:text-xl font-black font-mono ${
                          isPerfect ? "text-emerald-700 dark:text-emerald-300" : isSobrante ? "text-blue-700 dark:text-blue-300" : "text-rose-700 dark:text-rose-300"
                        }`}>
                          {dif !== 0 ? (dif > 0 ? `+${formatPYG(dif)}` : formatPYG(dif)) : "₲ 0 (Sin Descuadre)"}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                          <span>Esp: {formatPYG(sessionSalesData.totales.esperado_gaveta_gs)}</span>
                          <span>Rendido: {formatPYG(sessionSalesData.totales.declarado_gaveta_gs)}</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* 2. Chips de desglose por medios de pago */}
                {sessionSalesData.desglose_medios && sessionSalesData.desglose_medios.length > 0 && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <div className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider">
                      Desglose Consolidado por Medio de Pago (100% en Guaraníes)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sessionSalesData.desglose_medios.map((m: any, idx: number) => (
                        <div key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{m.label}:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{m.monto_formateado}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Buscador y Filtros de la Tabla de Ventas */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setSessionSalesStatusFilter("todas")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        sessionSalesStatusFilter === "todas"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                      }`}
                    >
                      Todas ({sessionSalesData.sales.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionSalesStatusFilter("confirmadas")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        sessionSalesStatusFilter === "confirmadas"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                      }`}
                    >
                      Confirmadas ({sessionSalesData.totales.cantidad_ventas})
                    </button>
                    {sessionSalesData.totales.cantidad_anuladas > 0 && (
                      <button
                        type="button"
                        onClick={() => setSessionSalesStatusFilter("anuladas")}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          sessionSalesStatusFilter === "anuladas"
                            ? "bg-rose-600 text-white shadow-sm"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        Anuladas ({sessionSalesData.totales.cantidad_anuladas})
                      </button>
                    )}
                  </div>

                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={sessionSalesSearch}
                      onChange={(e) => setSessionSalesSearch(e.target.value)}
                      placeholder="Buscar ticket, cliente, RUC o medio..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* 4. Tabla de Ventas */}
                {(() => {
                  const searchLower = sessionSalesSearch.toLowerCase()
                  const filteredSales = (sessionSalesData.sales || []).filter((s: any) => {
                    const matchesStatus =
                      sessionSalesStatusFilter === "todas"
                        ? true
                        : sessionSalesStatusFilter === "confirmadas"
                        ? ["confirmado", "completada", "completado", "pagado"].includes((s.estado || "").toLowerCase())
                        : ["cancelado", "anulado", "anulada", "devuelto"].includes((s.estado || "").toLowerCase())

                    const matchesText =
                      !sessionSalesSearch ||
                      (s.numero || "").toLowerCase().includes(searchLower) ||
                      (s.numero_interno || "").toLowerCase().includes(searchLower) ||
                      (s.cliente_nombre || "").toLowerCase().includes(searchLower) ||
                      (s.cliente_ruc || "").toLowerCase().includes(searchLower) ||
                      (s.forma_pago_resumen || "").toLowerCase().includes(searchLower)

                    return matchesStatus && matchesText
                  })

                  return (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto max-h-[420px]">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                              <th className="p-2.5">Hora</th>
                              <th className="p-2.5">N° Comprobante</th>
                              <th className="p-2.5">Tipo</th>
                              <th className="p-2.5">Cliente</th>
                              <th className="p-2.5">Medio(s) de Pago</th>
                              <th className="p-2.5 text-center">Ítems</th>
                              <th className="p-2.5 text-right">Total (PYG)</th>
                              <th className="p-2.5 text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredSales.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="p-8 text-center text-slate-400">
                                  No se encontraron ventas para este filtro.
                                </td>
                              </tr>
                            ) : (
                              filteredSales.map((s: any) => {
                                const isConfirmed = ["confirmado", "completada", "completado", "pagado"].includes((s.estado || "").toLowerCase())
                                return (
                                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                    <td className="p-2.5 font-mono text-slate-500 whitespace-nowrap">
                                      {s.hora_local || "-"}
                                    </td>
                                    <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                      {s.numero}
                                      {s.numero_interno && s.numero_interno !== s.numero && (
                                        <span className="text-[10px] text-slate-400 block font-normal">#{s.numero_interno}</span>
                                      )}
                                    </td>
                                    <td className="p-2.5 capitalize text-slate-600 dark:text-slate-300">
                                      {s.tipo_comprobante || "Ticket"}
                                    </td>
                                    <td className="p-2.5">
                                      <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]" title={s.cliente_nombre}>
                                        {s.cliente_nombre}
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {s.cliente_ruc !== "X" ? `RUC: ${s.cliente_ruc}` : "Consumidor Final"}
                                      </span>
                                    </td>
                                    <td className="p-2.5">
                                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                                        {s.forma_pago_resumen}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-center font-mono text-slate-500">
                                      {s.items_count}
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                      {formatPYG(s.total)}
                                    </td>
                                    <td className="p-2.5 text-center whitespace-nowrap">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        isConfirmed
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                          : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                      }`}>
                                        {s.estado}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {showExportArqueoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Acta de Arqueo Consolidada</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Formato oficial A4 Vertical · Auditoría de Cajas</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportArqueoModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Accesos rápidos */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Períodos Rápidos</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const hoy = getPyDateStr()
                    setArqueoFechaDesde(hoy)
                    setArqueoFechaHasta(hoy)
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition text-center"
                >
                  📅 Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ayer = new Date()
                    ayer.setDate(ayer.getDate() - 1)
                    const ayerStr = getPyDateStr(ayer)
                    setArqueoFechaDesde(ayerStr)
                    setArqueoFechaHasta(ayerStr)
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition text-center"
                >
                  ⏮ Ayer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() - 7)
                    setArqueoFechaDesde(getPyDateStr(d))
                    setArqueoFechaHasta(getPyDateStr())
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition text-center"
                >
                  🗓 Últimos 7 Días
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date()
                    d.setDate(d.getDate() - 30)
                    setArqueoFechaDesde(getPyDateStr(d))
                    setArqueoFechaHasta(getPyDateStr())
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition text-center"
                >
                  📊 Últimos 30 Días
                </button>
              </div>
            </div>

            {/* Selectores de Rango Manual */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Fecha Desde</label>
                <input
                  type="date"
                  value={arqueoFechaDesde}
                  onChange={(e) => setArqueoFechaDesde(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Fecha Hasta</label>
                <input
                  type="date"
                  value={arqueoFechaHasta}
                  onChange={(e) => setArqueoFechaHasta(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-750 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-300">Detalles incluidos en el documento:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                <li>Desglose por cajera y caja registradora</li>
                <li>Totales por efectivo (₲, R$, US$), tarjetas, transferencias y cheques</li>
                <li>Diferencias, faltantes/sobrantes y dictamen de auditoría</li>
                <li>Triple firma de conformidad legal y custodia de fondos</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowExportArqueoModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleExportArqueo(arqueoFechaDesde, arqueoFechaHasta)}
                disabled={exportingArqueo}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
              >
                {exportingArqueo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generando Acta...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Descargar Acta A4</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
