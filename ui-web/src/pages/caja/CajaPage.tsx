import { useState, useEffect } from "react"
import { Plus, Search, Loader2, Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign, CheckCircle, XCircle, AlertCircle, CreditCard, AlertTriangle, Settings, X, ShieldCheck, Clock, EyeOff } from "lucide-react"
import { api, type CashRegister, type CashHandoff } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

async function downloadPdf(endpoint: string, filename: string) {
  const token = localStorage.getItem("access_token")
  const res = await fetch(`${API_BASE}${endpoint}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error("No se pudo generar el PDF")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
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

const registerStatusMap: Record<string, string> = {
  activa: "badge-success",
  cerrada: "badge-danger",
}

export default function CajaPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<"registers" | "sessions" | "entregas" | "historial" | "cajeros">("registers")
  const [cajeroPerformance, setCajeroPerformance] = useState<{ cajero_nombre: string; total_cierres: number; monto_total_manejado: number; diferencia_acumulada: number; diferencia_promedio: number; cierres_con_revision: number; pct_con_revision: number; ultimo_cierre: string | null }[]>([])
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
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showBreakdownModal, setShowBreakdownModal] = useState(false)
  const [showThresholdModal, setShowThresholdModal] = useState<CashRegister | null>(null)
  const [showCashDropModal, setShowCashDropModal] = useState<SessionSummary | null>(null)
  const [breakdown, setBreakdown] = useState<PaymentBreakdownItem[]>([])
  const [otrasMonedas, setOtrasMonedas] = useState<OtraMonedaItem[]>([])
  const [breakdownLoading, setBreakdownLoading] = useState(false)
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
      toast.error("Error", "No se pudo cargar")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const pendingHandoffs = handoffs.filter(h => h.estado === "pendiente")

  const fetchHistorial = async () => {
    setHistorialLoading(true)
    try {
      // sessionsSummary (no sessions.list) trae el arqueo real (diferencia
      // de CashCount) via JOIN — sessions.list solo devuelve la sesion cruda,
      // sin eso el historial no podia mostrar un descuadre real.
      const data = await api.caja.sessionsSummary({ estado: "cerrada", limit: 2500 })
      setHistorial(data)
    } catch {
      toast.error("Error", "No se pudo cargar el historial de cierres")
    } finally {
      setHistorialLoading(false)
    }
  }

  useEffect(() => { if (activeTab === "historial" && historial.length === 0) fetchHistorial() }, [activeTab])

  const fetchCajeroPerformance = async () => {
    setCajeroPerformanceLoading(true)
    try {
      const data = await api.caja.cajeros.performance()
      setCajeroPerformance(data)
    } catch {
      toast.error("Error", "No se pudo cargar la performance de cajeros")
    } finally {
      setCajeroPerformanceLoading(false)
    }
  }

  useEffect(() => { if (activeTab === "cajeros" && cajeroPerformance.length === 0) fetchCajeroPerformance() }, [activeTab])

  const [exportingArqueo, setExportingArqueo] = useState(false)
  const handleExportArqueo = async () => {
    setExportingArqueo(true)
    try {
      const hasta = new Date().toISOString().slice(0, 10)
      const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      await downloadPdf(`/v1/caja/export/arqueo.pdf?fecha_desde=${desde}&fecha_hasta=${hasta}`, "arqueo_de_caja.pdf")
    } catch {
      toast.error("Error", "No se pudo generar el PDF de arqueo")
    } finally {
      setExportingArqueo(false)
    }
  }

  const getRegisterName = (registerId?: string) => registers.find(r => r.id === registerId)?.nombre || "Caja Principal"
  // cajero_nombre es un campo real de la sesion desde esta semana — antes se
  // intentaba extraer del texto de observaciones (que nunca lo contuvo para
  // las sesiones sincronizadas), mostrando "—" en todas las filas siempre.
  const getCajero = (s: SessionSummary) => s.cajero_nombre || "—"

  const filteredRegisters = registers.filter(r =>
    !search || r.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const filteredSessions = sessions.filter(s =>
    !search || (s.cajero_nombre || "").toLowerCase().includes(search.toLowerCase()) || (s.estado || "").toLowerCase().includes(search.toLowerCase())
  )

  const filteredHistorial = historial.filter(s =>
    !search || getCajero(s).toLowerCase().includes(search.toLowerCase())
  )

  const totalRegisters = registers.length
  const openSessions = sessions.filter(s => s.estado === "abierta").length
  const totalApertura = sessions.reduce((a, s) => a + Number(s.monto_apertura || 0), 0)

  const handleOpenSession = async () => {
    if (!selectedRegister) {
      toast.error("Error", "Seleccioná una caja")
      return
    }
    try {
      await api.caja.sessions.create({
        cash_register_id: selectedRegister,
        user_id: user?.id || "00000000-0000-0000-0000-000000000000",
        cajero_nombre: user?.nombre,
        monto_apertura: parseFloat(montoApertura) || 0,
      })
      toast.success("Caja abierta", "Sesión de caja iniciada correctamente")
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
      // Conteo ciego: recien ahora, despues de guardado el conteo de la
      // cajera, se le muestra el resultado de la comparacion contra lo
      // esperado por el sistema.
      setCloseResult({ diferencia: result.diferencia, requiere_revision: result.requiere_revision })
      setShowCloseModal(false)
      setMontoCierre("0")
      setMontoCierreUsd("0")
      setMontoCierreBrl("0")
      setObservacionesCierre("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo cerrar la caja")
    }
  }

  const printHandoffReceipt = (h: CashHandoff, supervisorNombre: string, montoConfirmadoNum: number) => {
    const now = new Date().toLocaleString("es-PY")
    const discrepancia = montoConfirmadoNum - h.monto_pyg
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Comprobante de entrega</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 8px; }
  .center { text-align: center; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  .total { font-size: 15px; font-weight: bold; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
</style></head><body>
<div class="center">
  <h3 style="margin:0">Comprobante de entrega de efectivo</h3>
  <p style="margin:2px 0;font-size:10px;">${now}</p>
</div>
<div class="line"></div>
<p style="margin:4px 0;">Caja: <strong>${h.register_nombre || "-"}</strong></p>
<p style="margin:4px 0;">Entregado por: <strong>${h.entregado_por_nombre || "-"}</strong></p>
<p style="margin:4px 0;">Recibido por: <strong>${supervisorNombre}</strong></p>
<div class="line"></div>
<div class="row"><span>Declarado por cajera:</span><span>Gs. ${h.monto_pyg.toLocaleString("es-PY")}</span></div>
<div class="row"><span>Contado por supervisor:</span><span>Gs. ${montoConfirmadoNum.toLocaleString("es-PY")}</span></div>
${discrepancia !== 0 ? `<div class="row" style="color:#c00;font-weight:bold;"><span>Discrepancia:</span><span>${discrepancia > 0 ? "+" : ""}Gs. ${discrepancia.toLocaleString("es-PY")}</span></div>` : ""}
<div class="line"></div>
<div class="center" style="margin-top:20px;">
  <p style="font-size:10px;">Firma cajera _____________________</p>
  <p style="font-size:10px;margin-top:16px;">Firma supervisor _____________________</p>
</div>
<div class="line"></div>
<div class="center"><p style="font-size:9px;">InteliMarket ERP</p></div>
</body></html>`
    const win = window.open("", "_blank", "width=300,height=600")
    if (win) { win.document.write(html); win.document.close(); win.print() }
  }

  const handleConfirmHandoff = async () => {
    if (!showConfirmHandoffModal) return
    setConfirmingHandoff(true)
    try {
      const verif = await api.auth.verifySupervisor({ email: supervisorEmail, password: supervisorPassword })
      if (!verif.valid || !verif.id) {
        toast.error("Credenciales inválidas", "No se pudo verificar al supervisor o no tiene nivel de supervisor")
        return
      }
      const montoConfirmadoNum = montoConfirmado ? parseFloat(montoConfirmado) : showConfirmHandoffModal.monto_pyg
      const result = await api.caja.handoffs.confirm(showConfirmHandoffModal.id, {
        recibido_por: verif.id, recibido_por_nombre: verif.nombre || supervisorEmail,
        monto_confirmado_pyg: montoConfirmadoNum,
      })
      if (result.discrepancia_confirmacion) {
        toast.error("Entrega confirmada — con discrepancia", `Vos contaste ${formatPYG(montoConfirmadoNum)}, la cajera declaró ${formatPYG(showConfirmHandoffModal.monto_pyg)}`)
      } else {
        toast.success("Entrega confirmada", `${verif.nombre} recibió el efectivo — ya está en bóveda`)
      }
      printHandoffReceipt(showConfirmHandoffModal, verif.nombre || supervisorEmail, montoConfirmadoNum)
      setShowConfirmHandoffModal(null)
      setSupervisorEmail("")
      setSupervisorPassword("")
      setMontoConfirmado("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo confirmar la entrega")
    } finally {
      setConfirmingHandoff(false)
    }
  }

  const handleCreateRegister = async () => {
    if (!newRegisterName || !newRegisterCodigo) {
      toast.error("Error", "Ingresá nombre y código")
      return
    }
    try {
      await api.caja.registers.create({
        nombre: newRegisterName,
        codigo: newRegisterCodigo,
      } as any)
      toast.success("Caja creada", "Caja registrada correctamente")
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
      toast.error("Error", "No se pudo cargar el desglose de cobros")
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
      toast.success("Guardado", "Umbrales actualizados")
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
      await api.caja.cashDrop(showCashDropModal.id, { monto: parseFloat(cashDropMonto) || 0, observaciones: cashDropObs || undefined })
      toast.success("Cash drop registrado", "El retiro quedó registrado y el acumulado se reinició")
      setShowCashDropModal(null)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo registrar el cash drop")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caja</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de cajas y sesiones de cobro</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateModal(true)} className="btn-outline">
            <Plus className="w-4 h-4" />
            Nueva caja
          </button>
          <button onClick={() => setShowOpenModal(true)} className="btn-primary">
            <Wallet className="w-4 h-4" />
            Abrir sesión
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cajas activas</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalRegisters}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sesiones abiertas</span></div>
          <p className="text-2xl font-bold text-green-500">{openSessions}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 text-secondary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monto apertura</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPYG(totalApertura)}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("registers")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "registers" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Cajas</button>
        <button onClick={() => setActiveTab("sessions")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "sessions" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Sesiones</button>
        <button onClick={() => setActiveTab("entregas")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "entregas" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>
          Entregas
          {pendingHandoffs.length > 0 && <span className="bg-amber-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">{pendingHandoffs.length}</span>}
        </button>
        <button onClick={() => setActiveTab("historial")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "historial" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Historial</button>
        <button onClick={() => setActiveTab("cajeros")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "cajeros" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Cajeros</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input-field pl-10" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {activeTab === "entregas" ? (
        <div className="space-y-4">
          <div className="card p-4 bg-blue-50/50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-gray-300">Cuando una cajera cierra su caja, el efectivo contado queda <strong>pendiente</strong> bajo su responsabilidad hasta que un supervisor confirme que lo recibió. Al confirmar, el monto entra a Bóveda.</p>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Cajero</th>
                  <th className="table-cell">Caja</th>
                  <th className="table-cell text-right">Monto</th>
                  <th className="table-cell">Cerrado</th>
                  <th className="table-cell">Estado</th>
                  <th className="table-cell"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : handoffs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">Sin entregas registradas</td></tr>
                ) : (
                  handoffs.map((h) => (
                    <tr key={h.id} className="table-row">
                      <td className="table-td font-bold text-gray-900 dark:text-white">{h.entregado_por_nombre || "—"}</td>
                      <td className="table-td text-sm text-gray-500">{h.register_nombre || "—"}</td>
                      <td className="table-td text-right font-mono font-bold">
                        {formatPYG(h.monto_pyg)}
                        {h.estado === "confirmado" && h.monto_confirmado_pyg != null && h.monto_confirmado_pyg !== h.monto_pyg && (
                          <div className="text-[10px] font-normal text-red-500">Contado: {formatPYG(h.monto_confirmado_pyg)}</div>
                        )}
                        {(h.monto_usd > 0 || h.monto_brl > 0) && (
                          <div className="text-[10px] font-normal text-gray-400">{h.monto_usd > 0 ? `USD ${h.monto_usd.toFixed(2)} ` : ""}{h.monto_brl > 0 ? `R$ ${h.monto_brl.toFixed(2)}` : ""}</div>
                        )}
                      </td>
                      <td className="table-td text-sm">{new Date(h.created_at).toLocaleString("es-PY")}</td>
                      <td className="table-td">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full w-max ${h.estado === "pendiente" ? "bg-amber-500/10 text-amber-600" : "bg-green-500/10 text-green-600"}`}>
                            {h.estado === "pendiente" ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                            {h.estado === "pendiente" ? "Pendiente" : `Confirmada por ${h.recibido_por_nombre || "supervisor"}`}
                          </span>
                          {h.requiere_revision && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full w-max">
                              <AlertTriangle className="w-3 h-3" /> Requiere revisión
                            </span>
                          )}
                          {h.discrepancia_confirmacion && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full w-max">
                              <AlertTriangle className="w-3 h-3" /> Discrepancia con recuento del supervisor
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-td">
                        {h.estado === "pendiente" && (
                          <button onClick={() => { setShowConfirmHandoffModal(h); setMontoConfirmado(""); setSupervisorEmail(""); setSupervisorPassword("") }} className="btn-primary text-xs">Confirmar recepción</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "historial" ? (
        <div className="card overflow-hidden">
          <div className="flex justify-end p-3 border-b border-gray-100 dark:border-gray-800">
            <button onClick={handleExportArqueo} disabled={exportingArqueo} className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-50">
              {exportingArqueo ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-red-500 font-bold text-xs">PDF</span>} Arqueo (30 días)
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Cajero</th>
                <th className="table-cell">Caja</th>
                <th className="table-cell">Apertura</th>
                <th className="table-cell">Cierre</th>
                <th className="table-cell text-right">Cobrado</th>
                <th className="table-cell text-right">Esperado</th>
                <th className="table-cell text-right">Contado</th>
                <th className="table-cell text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {historialLoading ? (
                <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredHistorial.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Sin cierres registrados</td></tr>
              ) : (
                filteredHistorial
                  .slice()
                  .sort((a, b) => new Date(b.fecha_cierre || b.fecha_apertura || 0).getTime() - new Date(a.fecha_cierre || a.fecha_apertura || 0).getTime())
                  .map((s) => {
                    // diferencia real del arqueo (CashCount, sincronizado del
                    // legado o calculado al cerrar) — no "cierre - apertura"
                    // (eso es la recaudacion del turno, no un descuadre).
                    const diferencia = s.diferencia
                    const tieneOtraMoneda = (s.diferencia_usd && s.diferencia_usd !== 0) || (s.diferencia_brl && s.diferencia_brl !== 0)
                    return (
                      <tr key={s.id} className="table-row">
                        <td className="table-td font-bold text-gray-900 dark:text-white">{getCajero(s)}</td>
                        <td className="table-td text-sm text-gray-500">{getRegisterName(s.register_id)}</td>
                        <td className="table-td text-sm">{s.fecha_apertura ? new Date(s.fecha_apertura).toLocaleString("es-PY") : "-"}</td>
                        <td className="table-td text-sm">{s.fecha_cierre ? new Date(s.fecha_cierre).toLocaleString("es-PY") : "-"}</td>
                        <td className="table-td text-right font-mono text-green-600">{formatPYG(s.monto_cobrado)}</td>
                        <td className="table-td text-right font-mono text-gray-500">{s.monto_cierre_esperado != null ? formatPYG(s.monto_cierre_esperado) : "—"}</td>
                        <td className="table-td text-right font-mono font-bold">{s.monto_cierre != null ? formatPYG(s.monto_cierre) : "—"}</td>
                        <td className={`table-td text-right font-mono font-bold ${diferencia == null ? "text-gray-400" : diferencia === 0 ? "text-gray-400" : diferencia < 0 ? "text-red-500" : "text-green-500"}`}>
                          {diferencia == null ? "s/d" : diferencia === 0 ? "—" : `${diferencia > 0 ? "+" : ""}${formatPYG(diferencia)}`}
                          {tieneOtraMoneda && (
                            <div className="text-[10px] font-normal text-amber-500">
                              {s.diferencia_usd ? `USD ${s.diferencia_usd > 0 ? "+" : ""}${s.diferencia_usd.toFixed(2)} ` : ""}
                              {s.diferencia_brl ? `R$ ${s.diferencia_brl > 0 ? "+" : ""}${s.diferencia_brl.toFixed(2)}` : ""}
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
      ) : activeTab === "cajeros" ? (
        <div className="space-y-4">
          <div className="card p-4 bg-blue-50/50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-gray-300">Ranking por descuadre de caja acumulado, calculado sobre los cierres reales de cada cajero. No hay datos de turnos/horarios porque el sistema anterior nunca los registró — este ranking se basa únicamente en arqueos reales.</p>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Cajero</th>
                  <th className="table-cell text-right">Cierres</th>
                  <th className="table-cell text-right">Monto manejado</th>
                  <th className="table-cell text-right">Diferencia acumulada</th>
                  <th className="table-cell text-right">Diferencia promedio</th>
                  <th className="table-cell text-right">% con revisión</th>
                  <th className="table-cell">Último cierre</th>
                </tr>
              </thead>
              <tbody>
                {cajeroPerformanceLoading ? (
                  <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : cajeroPerformance.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Sin datos</td></tr>
                ) : (
                  cajeroPerformance
                    .filter(c => !search || c.cajero_nombre.toLowerCase().includes(search.toLowerCase()))
                    .map((c) => (
                      <tr key={c.cajero_nombre} className="table-row">
                        <td className="table-td font-bold text-gray-900 dark:text-white">{c.cajero_nombre}</td>
                        <td className="table-td text-right font-mono">{c.total_cierres}</td>
                        <td className="table-td text-right font-mono text-gray-500">{formatPYG(c.monto_total_manejado)}</td>
                        <td className="table-td text-right font-mono font-bold text-red-500">{formatPYG(c.diferencia_acumulada)}</td>
                        <td className="table-td text-right font-mono text-gray-500">{formatPYG(c.diferencia_promedio)}</td>
                        <td className={`table-td text-right font-mono font-bold ${c.pct_con_revision >= 80 ? "text-red-500" : c.pct_con_revision >= 40 ? "text-amber-500" : "text-gray-500"}`}>
                          {c.pct_con_revision}% ({c.cierres_con_revision})
                        </td>
                        <td className="table-td text-sm">{c.ultimo_cierre ? new Date(c.ultimo_cierre).toLocaleDateString("es-PY") : "-"}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "registers" ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Nombre</th>
                <th className="table-cell">Estado</th>
                <th className="table-cell text-right">Umbral cash drop</th>
                <th className="table-cell">Fecha creación</th>
                <th className="table-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredRegisters.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No se encontraron cajas</td></tr>
              ) : (
                filteredRegisters.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-td font-bold text-gray-900 dark:text-white">{r.nombre}</td>
                    <td className="table-td"><StatusBadge status={r.activo ? "activa" : "cerrada"} map={registerStatusMap} /></td>
                    <td className="table-td text-right font-mono">{r.cash_drop_threshold ? formatPYG(r.cash_drop_threshold) : <span className="text-gray-400">Sin definir</span>}</td>
                    <td className="table-td text-sm text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString("es-PY") : "-"}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedRegister(r.id); setShowOpenModal(true) }} className="btn-ghost text-xs">Abrir sesión</button>
                        <button onClick={() => handleOpenThreshold(r)} className="btn-ghost text-xs" title="Configurar cash drop"><Settings className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Cajero</th>
                <th className="table-cell">Apertura</th>
                <th className="table-cell text-right">Monto apertura</th>
                <th className="table-cell text-right">Cobrado</th>
                <th className="table-cell">Estado</th>
                <th className="table-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredSessions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay sesiones abiertas</td></tr>
              ) : (
                filteredSessions.map((s) => (
                  <tr key={s.id} className="table-row cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={() => handleOpenBreakdown(s)}>
                    <td className="table-td">
                      <p className="font-bold text-gray-900 dark:text-white">{s.cajero_nombre || "—"}</p>
                      <p className="text-xs text-gray-400">{getRegisterName(s.register_id)}</p>
                    </td>
                    <td className="table-td text-sm">{s.fecha_apertura ? new Date(s.fecha_apertura).toLocaleString("es-PY") : "-"}</td>
                    <td className="table-td text-right font-mono">{formatPYG(s.monto_apertura)}</td>
                    <td className="table-td text-right font-mono font-bold text-green-600">{formatPYG(s.monto_cobrado)}</td>
                    <td className="table-td">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={s.estado || "-"} map={{ abierta: "badge-success", cerrada: "badge-danger" }} />
                        {s.cash_drop_alert && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full w-max">
                            <AlertTriangle className="w-3 h-3" /> Cash drop
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-td" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {s.cash_drop_alert && (
                          <button onClick={() => handleOpenCashDrop(s)} className="btn-ghost text-xs text-amber-600">Cash drop</button>
                        )}
                        {s.estado === "abierta" && (
                          <button onClick={() => { setSelectedSession(s); setMontoCierre("0"); setMontoCierreUsd("0"); setMontoCierreBrl("0"); setShowCloseModal(true) }} className="btn-ghost text-xs">Cerrar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Register Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nueva caja</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input-field" placeholder="Caja 1 — Frente" value={newRegisterName} onChange={(e) => setNewRegisterName(e.target.value)} />
              </div>
              <div>
                <label className="label">Código</label>
                <p className="text-xs text-gray-400 mb-1">Identificador único de esta caja física (ej: 01, 02, EXPRESS-1).</p>
                <input className="input-field" placeholder="02" value={newRegisterCodigo} onChange={(e) => setNewRegisterCodigo(e.target.value)} />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button className="btn-ghost" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleCreateRegister}>Crear</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open Session Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowOpenModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Abrir sesión de caja</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Caja</label>
                <select className="input-field" value={selectedRegister} onChange={(e) => setSelectedRegister(e.target.value)}>
                  <option value="">Seleccionar caja</option>
                  {registers.filter(r => r.activo).map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Monto de apertura (₲)</label>
                <input className="input-field" type="number" placeholder="0" value={montoApertura} onChange={(e) => setMontoApertura(e.target.value)} />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button className="btn-ghost" onClick={() => setShowOpenModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleOpenSession}>Abrir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Session Modal — conteo ciego: no se muestra lo esperado por el
          sistema hasta despues de guardado el conteo de la cajera. */}
      {showCloseModal && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCloseModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Cerrar sesión</h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Caja</span><span className="font-bold">{getRegisterName(selectedSession.register_id)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Cajero</span><span className="font-bold">{selectedSession.cajero_nombre || "-"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Apertura</span><span className="font-bold">{selectedSession.fecha_apertura ? new Date(selectedSession.fecha_apertura).toLocaleString("es-PY") : "-"}</span></div>
            </div>
            <div className="flex items-start gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-xs text-blue-700 dark:text-blue-300">
              <EyeOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p><strong>Conteo ciego</strong>: contá el efectivo real en la caja antes de continuar. El sistema te muestra la diferencia recién después de guardar tu conteo.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Efectivo contado (₲)</label>
                <input className="input-field" type="number" placeholder="0" value={montoCierre} onChange={(e) => setMontoCierre(e.target.value)} />
              </div>
              {(selectedSession.efectivo_usd_acumulado > 0 || selectedSession.efectivo_brl_acumulado > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Efectivo en USD</label>
                    <input className="input-field" type="number" placeholder="0" value={montoCierreUsd} onChange={(e) => setMontoCierreUsd(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Efectivo en Real (R$)</label>
                    <input className="input-field" type="number" placeholder="0" value={montoCierreBrl} onChange={(e) => setMontoCierreBrl(e.target.value)} />
                  </div>
                </div>
              )}
              <div>
                <label className="label">Observaciones</label>
                <textarea className="input-field" placeholder="Notas de cierre..." value={observacionesCierre} onChange={(e) => setObservacionesCierre(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button className="btn-ghost" onClick={() => setShowCloseModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleCloseSession}>Guardar conteo y cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Result Modal — recien aca se revela la diferencia, despues de
          guardado el conteo ciego. */}
      {closeResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setCloseResult(null); setShowCloseModal(false); setSelectedSession(null) }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
            {closeResult.diferencia === 0 ? (
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            ) : (
              <AlertTriangle className={`w-12 h-12 mx-auto mb-3 ${closeResult.requiere_revision ? "text-red-500" : "text-amber-500"}`} />
            )}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Caja cerrada</h3>
            <p className="text-sm text-gray-500 mb-4">
              {closeResult.diferencia === 0 ? "El conteo coincide exactamente con lo esperado." : closeResult.diferencia > 0 ? "Sobrante detectado" : "Faltante detectado"}
            </p>
            {closeResult.diferencia !== 0 && (
              <p className={`text-2xl font-extrabold font-mono mb-3 ${closeResult.diferencia > 0 ? "text-green-500" : "text-red-500"}`}>
                {closeResult.diferencia > 0 ? "+" : ""}{formatPYG(closeResult.diferencia)}
              </p>
            )}
            {closeResult.requiere_revision && (
              <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg p-2 mb-3">Supera la tolerancia configurada — quedó marcada para revisión.</p>
            )}
            <p className="text-sm text-gray-500 mb-4">El efectivo contado queda pendiente de entrega en la pestaña <strong>Entregas</strong> hasta que un supervisor confirme que lo recibió.</p>
            <button className="btn-primary w-full" onClick={() => { setCloseResult(null); setShowCloseModal(false); setSelectedSession(null); setActiveTab("entregas") }}>Ir a Entregas</button>
          </div>
        </div>
      )}

      {/* Confirm Handoff Modal — el supervisor se autentica con su propia
          clave (mismo mecanismo que verify-supervisor en POS) antes de
          confirmar que recibio el efectivo. */}
      {showConfirmHandoffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirmHandoffModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Confirmar recepción</h3>
            <p className="text-xs text-gray-400 mb-4">De {showConfirmHandoffModal.entregado_por_nombre} — {showConfirmHandoffModal.register_nombre}</p>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4 text-center">
              <p className="text-xs text-gray-500">Declarado por la cajera</p>
              <p className="text-2xl font-extrabold font-mono text-gray-900 dark:text-white">{formatPYG(showConfirmHandoffModal.monto_pyg)}</p>
            </div>
            <div className="mb-4">
              <label className="label">Tu propio recuento (₲)</label>
              <p className="text-xs text-gray-400 mb-1">Contá vos mismo el efectivo recibido — no aceptes el número de la cajera sin verificarlo.</p>
              <input className="input-field" type="number" placeholder="0" value={montoConfirmado} onChange={(e) => setMontoConfirmado(e.target.value)} />
            </div>
            <p className="text-xs text-gray-500 mb-3">Ingresá tus credenciales de supervisor para confirmar que recibiste este efectivo físicamente.</p>
            <div className="space-y-3">
              <div>
                <label className="label">Email</label>
                <input className="input-field" type="email" value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input className="input-field" type="password" value={supervisorPassword} onChange={(e) => setSupervisorPassword(e.target.value)} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button className="btn-ghost" onClick={() => setShowConfirmHandoffModal(null)}>Cancelar</button>
                <button className="btn-primary disabled:opacity-50" disabled={confirmingHandoff || !supervisorEmail || !supervisorPassword || !montoConfirmado} onClick={handleConfirmHandoff}>
                  {confirmingHandoff ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar recepción"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Breakdown Modal */}
      {showBreakdownModal && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBreakdownModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cobros por forma de pago</h3>
                <p className="text-xs text-gray-400">{selectedSession.cajero_nombre || "—"} · {getRegisterName(selectedSession.register_id)}</p>
              </div>
              <button onClick={() => setShowBreakdownModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">Total cobrado</span>
              <span className="text-xl font-extrabold text-green-600 font-mono">{formatPYG(selectedSession.monto_cobrado)}</span>
            </div>
            {breakdownLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : breakdown.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">Sin cobros registrados en esta sesión.</p>
            ) : (
              <div className="space-y-3">
                {breakdown.map((b, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300 w-32 flex-shrink-0 truncate">{b.forma_pago}</span>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                      <div className="h-full bg-primary rounded-md flex items-center justify-end px-2" style={{ width: `${Math.max(b.porcentaje, 4)}%` }}>
                        <span className="text-[10px] font-bold text-white">{b.porcentaje}%</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-gray-500 w-24 text-right flex-shrink-0">{formatPYG(b.monto)}</span>
                  </div>
                ))}
              </div>
            )}
            {otrasMonedas.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Otras monedas recibidas</p>
                <div className="space-y-1">
                  {otrasMonedas.map((o, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{o.forma_pago} ({o.moneda})</span>
                      <span className="font-mono font-bold">{o.monto.toLocaleString("es-PY")} {o.moneda} <span className="text-gray-400 font-normal">· {o.cantidad}x</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedSession.cash_drop_alert && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-600 text-sm font-bold">
                  <AlertTriangle className="w-4 h-4" /> Cash drop necesario ({formatPYG(selectedSession.efectivo_acumulado)} en efectivo)
                </div>
                <button className="btn-primary text-xs" onClick={() => { setShowBreakdownModal(false); handleOpenCashDrop(selectedSession) }}>Registrar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cash Drop Threshold Modal */}
      {showThresholdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowThresholdModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Umbrales de {showThresholdModal.nombre}</h3>
            <div className="space-y-4 mt-4">
              <div>
                <label className="label">Umbral de cash drop (₲)</label>
                <p className="text-xs text-gray-400 mb-1">Cuando el efectivo acumulado en una sesión abierta supere este monto, se muestra una alerta para retirarlo a la bóveda.</p>
                <input className="input-field" type="number" placeholder="1500000" value={thresholdValue} onChange={(e) => setThresholdValue(e.target.value)} />
              </div>
              <div>
                <label className="label">Diferencia máxima tolerada al cierre (₲)</label>
                <p className="text-xs text-gray-400 mb-1">Si el descuadre al cerrar una sesión supera este monto, se marca la sesión como "requiere revisión".</p>
                <input className="input-field" type="number" placeholder="0" value={diferenciaToleradaValue} onChange={(e) => setDiferenciaToleradaValue(e.target.value)} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button className="btn-ghost" onClick={() => setShowThresholdModal(null)}>Cancelar</button>
                <button className="btn-primary" onClick={handleSaveThreshold}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Drop Modal */}
      {showCashDropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCashDropModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Registrar cash drop</h3>
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Efectivo acumulado</p>
              <p className="text-xl font-extrabold text-amber-600 font-mono">{formatPYG(showCashDropModal.efectivo_acumulado)}</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Monto retirado (₲)</label>
                <input className="input-field" type="number" value={cashDropMonto} onChange={(e) => setCashDropMonto(e.target.value)} />
              </div>
              <div>
                <label className="label">Observaciones</label>
                <input className="input-field" placeholder="Ej: retiro a bóveda" value={cashDropObs} onChange={(e) => setCashDropObs(e.target.value)} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button className="btn-ghost" onClick={() => setShowCashDropModal(null)}>Cancelar</button>
                <button className="btn-primary" onClick={handleConfirmCashDrop}>Confirmar retiro</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
