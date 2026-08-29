import { useState, useEffect } from "react"
import {
  Plus, Search, Loader2, Wallet, Banknote, Award, TrendingUp, ArrowUpRight, ArrowDownRight,
  DollarSign, CheckCircle, XCircle, AlertCircle, CreditCard, AlertTriangle,
  Settings, X, ShieldCheck, Clock, EyeOff, Calculator, FileText, Download,
  Layers, Users, RefreshCw, Printer, Check, ChevronRight, Activity, ShieldAlert,
  Coins, Sparkles, Building2, Store, Lock, KeyRound, Heart
} from "lucide-react"
import {
  api,
  type CashRegister,
  type CashHandoff,
  type DonationStats,
  type DonationLiquidation,
  type DonationRecord,
  type CajeroSolidarioRankingItem,
} from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDateTime } from "../../utils/format"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

async function downloadPdf(endpoint: string, filename: string) {
  const token = localStorage.getItem("access_token")
  const res = await fetch(`${API_BASE}${endpoint}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error("No se pudo generar el PDF")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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
  const [activeTab, setActiveTab] = useState<"registers" | "sessions" | "entregas" | "historial" | "cajeros" | "donaciones">("registers")
  
  // ── DONACIONES & RSE ("ABRE TU CORAZÓN" - CENTRO AMOR Y ESPERANZA) ──
  const [donationStats, setDonationStats] = useState<DonationStats | null>(null)
  const [donationRanking, setDonationRanking] = useState<CajeroSolidarioRankingItem[]>([])
  const [donationLiquidations, setDonationLiquidations] = useState<DonationLiquidation[]>([])
  const [donationRecent, setDonationRecent] = useState<DonationRecord[]>([])
  const [donationsLoading, setDonationsLoading] = useState(false)
  const [showLiquidarModal, setShowLiquidarModal] = useState(false)
  const [liquidarDesde, setLiquidarDesde] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [liquidarHasta, setLiquidarHasta] = useState(new Date().toISOString().slice(0, 10))
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

  const fetchHistorial = async () => {
    setHistorialLoading(true)
    try {
      const data = await api.caja.sessionsSummary({ estado: "cerrada", limit: 2500 })
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

  useEffect(() => {
    if (activeTab === "donaciones") fetchDonationsData()
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

  const [exportingArqueo, setExportingArqueo] = useState(false)
  const handleExportArqueo = async () => {
    setExportingArqueo(true)
    try {
      const hasta = new Date().toISOString().slice(0, 10)
      const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      await downloadPdf(`/v1/caja/export/arqueo.pdf?fecha_desde=${desde}&fecha_hasta=${hasta}`, "acta_arqueo_caja.pdf")
    } catch {
      toast.error("Error", "No se pudo generar el PDF de arqueo")
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

  const filteredHistorial = historial.filter(s =>
    !search || getCajero(s).toLowerCase().includes(search.toLowerCase()) || (s.fecha_cierre || "").includes(search)
  )

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
              onClick={handleExportArqueo}
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
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
              Mostrando {filteredHistorial.length} arqueos históricos
            </span>
            <button onClick={fetchHistorial} disabled={historialLoading} className="btn-ghost text-xs flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${historialLoading ? "animate-spin" : ""}`} /> Refrescar
            </button>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {historialLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" /></td>
                  </tr>
                ) : filteredHistorial.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">No se encontraron cierres históricos.</td>
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

            <div className="flex justify-end pt-2">
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
              <div className="text-sm font-black text-slate-900 uppercase">EXTRA SUPERMERCADO · RUC 80092451-2</div>
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
    </div>
  )
}
