import { useState, useEffect, useCallback, useRef } from "react"
import {
  ShieldCheck, LogOut, RefreshCcw, Wallet, AlertTriangle, Clock, Loader2,
  CheckCircle2, ChevronRight, X, Banknote, ShieldAlert, Check, Eye, EyeOff,
  Sun, Moon, Home, Users, Landmark, TrendingDown, Inbox, ArrowDownToLine,
  User as UserIcon, ArrowLeft, Volume2, VolumeX, Sparkles, Send,
  DollarSign, Smartphone, ArrowUpRight, Flame, FileText, Printer, BarChart3, Download
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { useTheme } from "../../context/ThemeContext"
import { api } from "../../api"

const SUPERVISOR_ROLES = ["supervisor", "admin"]

interface PosStaffMember {
  id: string
  email: string
  nombre: string
  rol: string
  foto_url?: string | null
  en_turno: boolean
}

interface SessionSummary {
  id: string
  register_id: string
  cajero_nombre: string | null
  fecha_apertura: string
  fecha_cierre?: string | null
  monto_apertura: number
  monto_cobrado: number
  estado: string
  cash_drop_alert: boolean
  cash_drop_warning: boolean
  cash_drop_threshold: number | null
  efectivo_acumulado: number
  efectivo_usd_acumulado: number
  efectivo_brl_acumulado: number
  ultimo_cash_drop_at: string | null
}

interface Handoff {
  id: string
  register_nombre: string | null
  entregado_por_nombre: string | null
  monto_pyg: number
  monto_usd: number
  monto_brl: number
  estado: string
  created_at: string
}

interface RetiroPendiente {
  id: string
  session_id: string
  register_nombre: string | null
  solicitado_por_nombre: string | null
  monto_pyg: number
  monto_usd: number
  monto_brl: number
  observaciones: string | null
  estado: string
  created_at: string
}

interface AuthRequest {
  id: string
  tipo: string
  descripcion: string
  cajero_nombre?: string | null
  caja_nombre?: string | null
  estado: string
  resuelto_por_nombre?: string | null
  created_at: string
}

interface VaultApproval {
  id: string
  entry_ids: string[]
  monto_total_pyg: number
  estado: string
  aprobado_supervisor_id: string | null
  aprobado_gerente_id: string | null
  created_at: string
}

interface CajeroPerf {
  cajero_nombre: string
  total_cierres: number
  monto_total_manejado: number
  diferencia_acumulada: number
  diferencia_promedio: number
  cierres_con_revision: number
  pct_con_revision: number
  ultimo_cierre: string | null
}

const formatPYG = (n: number) => `₲ ${Math.round(n || 0).toLocaleString("es-PY")}`
const formatUSD = (n: number) => `US$ ${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function timeSince(iso: string) {
  if (!iso) return "reciente"
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return `hace ${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `hace ${mins} min`
  const hs = Math.floor(mins / 60)
  return `hace ${hs}h ${mins % 60}min`
}

const displayFont = { fontFamily: "'Archivo Expanded', system-ui, sans-serif" }
const monoFont = { fontFamily: "'IBM Plex Mono', 'SF Mono', monospace" }

type Tab = "inicio" | "cajas" | "boveda" | "equipo"

type PendingItem =
  | { kind: "auth"; id: string; created_at: string; data: AuthRequest }
  | { kind: "vault"; id: string; created_at: string; data: VaultApproval }

// ── SINTETIZADOR DE AUDIO (Web Audio API) ──────────────────────────────────
function playChime(freqs: number[], type: OscillatorType = "sine", duration = 0.12) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    let delay = 0
    for (const f of freqs) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(f, ctx.currentTime + delay)
      gain.gain.setValueAtTime(0.18, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + duration)
      delay += 0.08
    }
  } catch (e) {
    // Audio context bloqueado por el navegador
  }
}

export default function SupervisorPage() {
  const { user, loading: authLoading, login, logout } = useAuth()
  const toast = useToast()
  const { dark, toggle: toggleTheme } = useTheme()

  // ── SONIDO Y AVISOS SONOROS ──────────────────────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("supervisor_sound_enabled")
    return saved !== null ? saved === "true" : true
  })

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem("supervisor_sound_enabled", String(next))
    if (next) playChime([523, 659, 784])
  }

  const triggerAlertSound = useCallback(() => {
    if (!soundEnabled) return
    playChime([880, 1174], "triangle", 0.16)
    if (navigator.vibrate) navigator.vibrate([150, 80, 150])
  }, [soundEnabled])

  const triggerSuccessSound = useCallback(() => {
    if (!soundEnabled) return
    playChime([523, 659, 784, 1046], "sine", 0.1)
    if (navigator.vibrate) navigator.vibrate([60])
  }, [soundEnabled])

  // ── LOGIN CON SELECTOR DE SUPERVISORA ────────────────────────────────────
  const [staffList, setStaffList] = useState<PosStaffMember[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [staffError, setStaffError] = useState("")
  const [selectedStaff, setSelectedStaff] = useState<PosStaffMember | null>(null)
  const [loginPassword, setLoginPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    if (user) return
    let cancelled = false
    setStaffLoading(true)
    api.auth.posSupervisors()
      .then((res) => { if (!cancelled) setStaffList(res.staff || []) })
      .catch(() => { if (!cancelled) setStaffError("No se pudo cargar la lista de supervisores.") })
      .finally(() => { if (!cancelled) setStaffLoading(false) })
    return () => { cancelled = true }
  }, [user])

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaff) return
    setLoginError("")
    setLoggingIn(true)
    try {
      await login(selectedStaff.email, loginPassword)
      triggerSuccessSound()
    } catch (err: any) {
      setLoginError(err?.message || "Contraseña incorrecta")
    } finally {
      setLoggingIn(false)
    }
  }

  const isAuthorized = !!user && (SUPERVISOR_ROLES.includes((user.rol || "").toLowerCase()) || user.is_superadmin)

  const [tab, setTab] = useState<Tab>("inicio")
  const [onDuty, setOnDuty] = useState(false)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [handoffs, setHandoffs] = useState<Handoff[]>([])
  const [authRequests, setAuthRequests] = useState<AuthRequest[]>([])
  const [vaultApprovals, setVaultApprovals] = useState<VaultApproval[]>([])
  const [recentResolved, setRecentResolved] = useState<AuthRequest[]>([])
  const [vaultDashboard, setVaultDashboard] = useState<{
    saldo_en_boveda_pyg: number; saldo_en_boveda_usd: number; saldo_en_boveda_brl: number
    entradas_en_boveda: number
    movimientos_recientes: { id: string; origen: string; monto_pyg: number; estado: string; created_at: string; fecha_deposito: string | null }[]
  } | null>(null)
  const [cajeroPerf, setCajeroPerf] = useState<CajeroPerf[]>([])
  const [syncError, setSyncError] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [retiros, setRetiros] = useState<RetiroPendiente[]>([])
  const [confirmingItem, setConfirmingItem] = useState<{ kind: "handoff" | "retiro"; id: string; data?: Handoff | RetiroPendiente } | null>(null)
  const [confirmAmount, setConfirmAmount] = useState("")
  const [confirmAmountUsd, setConfirmAmountUsd] = useState("")
  const [confirmAmountBrl, setConfirmAmountBrl] = useState("")
  const [submittingConfirm, setSubmittingConfirm] = useState(false)
  const [rejectingRetiro, setRejectingRetiro] = useState<RetiroPendiente | null>(null)
  const [rejectRetiroMotivo, setRejectRetiroMotivo] = useState("")
  const [submittingRejectRetiro, setSubmittingRejectRetiro] = useState(false)
  const [rejectingVault, setRejectingVault] = useState<VaultApproval | null>(null)
  const [rejectMotivo, setRejectMotivo] = useState("")
  const [submittingReject, setSubmittingReject] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  // Modal para solicitar Drop Cash directo desde la supervisora
  const [requestingDropSession, setRequestingDropSession] = useState<SessionSummary | null>(null)
  const [dropAmountPyg, setDropAmountPyg] = useState("")
  const [dropAmountUsd, setDropAmountUsd] = useState("")
  const [dropAmountBrl, setDropAmountBrl] = useState("")
  const [dropObs, setDropObs] = useState("")
  const [submittingDrop, setSubmittingDrop] = useState(false)

  // Referencias para alertar solo en nuevos pedidos entrantes
  const prevPendingCountRef = useRef(0)
  const prevDropAlertsRef = useRef(0)

  // Marca turno de supervisor
  useEffect(() => {
    if (!isAuthorized) return
    let cancelled = false
    api.auth.startPosShift().then(() => { if (!cancelled) setOnDuty(true) }).catch(() => {
      if (!cancelled) toast.error("No se pudo registrar el turno", "Reintente cerrando y volviendo a entrar.")
    })
    return () => { cancelled = true }
  }, [isAuthorized])

  // ── POLLING DE ALTA PRIORIDAD (CADA 4s) ──────────────────────────────────
  const fetchPending = useCallback(async () => {
    try {
      const [reqs, vApprovals] = await Promise.all([
        api.supervisorRequests.list({ estado: "pendiente" }),
        api.vault.depositApprovals.list("pendiente"),
      ])
      const newReqs = reqs || []
      const newVault = vApprovals || []
      const currentTotal = newReqs.length + newVault.length

      // Si entraron nuevos pedidos pendientes, sonar alerta
      if (currentTotal > prevPendingCountRef.current && prevPendingCountRef.current !== 0) {
        triggerAlertSound()
      }
      prevPendingCountRef.current = currentTotal

      setAuthRequests(newReqs)
      setVaultApprovals(newVault)
      setSyncError(null)
    } catch (e: any) {
      setSyncError(e?.message || "Sin conexión con el servidor")
    }
  }, [triggerAlertSound])

  useEffect(() => {
    if (!isAuthorized) return
    fetchPending()
    const interval = setInterval(fetchPending, 4000)
    return () => clearInterval(interval)
  }, [isAuthorized, fetchPending])

  // ── POLLING GENERAL DE CAJAS & RETIROS (FILTRADO ESTRICTO: HOY Y AYER) ───
  const fetchData = useCallback(async () => {
    try {
      // FILTRO ESTRICTO: Solo cajas de HOY o del DÍA ANTERIOR
      const limiteAyer = new Date()
      limiteAyer.setDate(limiteAyer.getDate() - 1)
      limiteAyer.setHours(0, 0, 0, 0)

      const [sess, ho, ret] = await Promise.all([
        api.caja.sessionsSummary({ estado: "abierta", fecha_desde: limiteAyer.toISOString() }),
        api.caja.handoffs.list({ estado: "pendiente" }),
        api.caja.cashDropRequests.list("pendiente"),
      ])

      // Filtrado estricto en frontend para blindar que nunca aparezcan cajas del mes pasado
      const validSessions = (sess || []).filter((s) => {
        const apertura = new Date(s.fecha_apertura).getTime()
        return apertura >= limiteAyer.getTime()
      })

      // Alertar si aumentó el número de cajas con alerta de Drop Cash
      const dropAlertsCount = validSessions.filter((s) => s.cash_drop_alert).length
      if (dropAlertsCount > prevDropAlertsRef.current && prevDropAlertsRef.current !== 0) {
        triggerAlertSound()
      }
      prevDropAlertsRef.current = dropAlertsCount

      setSessions(validSessions)
      setHandoffs(ho || [])
      setRetiros(ret || [])
      setLastSync(new Date())
      setSyncError(null)
    } catch (e: any) {
      setSyncError(e?.message || "No se pudo conectar con el servidor")
    } finally {
      setLoading(false)
    }
  }, [triggerAlertSound])

  useEffect(() => {
    if (!isAuthorized) return
    fetchData()
    const interval = setInterval(fetchData, 8000)
    return () => clearInterval(interval)
  }, [isAuthorized, fetchData])

  // ── DATOS SECUNDARIOS (BÓVEDA Y EQUIPO) ──────────────────────────────────
  const fetchVaultAndTeam = useCallback(async () => {
    try {
      const [vd, perf] = await Promise.all([api.vault.dashboard(), api.caja.cajeros.performance()])
      setVaultDashboard(vd as any)
      setCajeroPerf((perf as any) || [])
    } catch {}
  }, [])

  useEffect(() => {
    if (!isAuthorized) return
    fetchVaultAndTeam()
    const interval = setInterval(fetchVaultAndTeam, 20000)
    return () => clearInterval(interval)
  }, [isAuthorized, fetchVaultAndTeam])

  // ── ACTIVIDAD RECIENTE ──────────────────────────────────────────────────
  const fetchRecentResolved = useCallback(async () => {
    try {
      const all = await api.supervisorRequests.list({ limit: 30 })
      setRecentResolved((all || []).filter((r: AuthRequest) => r.estado !== "pendiente").slice(0, 6))
    } catch {}
  }, [])

  useEffect(() => {
    if (!isAuthorized) return
    fetchRecentResolved()
    const interval = setInterval(fetchRecentResolved, 20000)
    return () => clearInterval(interval)
  }, [isAuthorized, fetchRecentResolved])

  // ── ACCIONES DE AUTORIZACIÓN ─────────────────────────────────────────────
  const resolveAuthRequest = async (id: string, aprobado: boolean) => {
    if (!user) return
    setResolvingId(id)
    try {
      await api.supervisorRequests.resolve(id, { aprobado, resuelto_por: user.id, resuelto_por_nombre: user.nombre })
      toast.success(aprobado ? "Autorizado" : "Rechazado", aprobado ? "La caja ya puede continuar." : "Se notificó a la cajera.")
      if (aprobado) triggerSuccessSound()
      fetchPending()
    } catch (e: any) {
      toast.error("No se pudo resolver", e?.message || "Intente de nuevo.")
    } finally {
      setResolvingId(null)
    }
  }

  const approveVaultDeposit = async (v: VaultApproval) => {
    setResolvingId(v.id)
    try {
      await api.vault.depositApprovals.approve(v.id)
      toast.success("Depósito aprobado", "Se registró su firma en el depósito a bóveda.")
      triggerSuccessSound()
      fetchPending()
    } catch (e: any) {
      toast.error("No se pudo aprobar", e?.message || "Intente de nuevo.")
    } finally {
      setResolvingId(null)
    }
  }

  const openRejectVault = (v: VaultApproval) => {
    setRejectingVault(v)
    setRejectMotivo("")
  }

  const submitRejectVault = async () => {
    if (!rejectingVault) return
    setSubmittingReject(true)
    try {
      await api.vault.depositApprovals.reject(rejectingVault.id, rejectMotivo.trim() || "Rechazado por supervisor")
      toast.success("Depósito rechazado", "Se avisó que el depósito no fue aprobado.")
      setRejectingVault(null)
      fetchPending()
    } catch (e: any) {
      toast.error("No se pudo rechazar", e?.message || "Intente de nuevo.")
    } finally {
      setSubmittingReject(false)
    }
  }

  const handleLogout = async () => {
    try { await api.auth.endPosShift() } catch {}
    logout()
    setSelectedStaff(null)
    setLoginPassword("")
  }

  const openConfirmHandoff = (h: Handoff) => {
    setConfirmingItem({ kind: "handoff", id: h.id, data: h })
    setConfirmAmount(String(Math.round(h.monto_pyg)))
    setConfirmAmountUsd(h.monto_usd ? String(h.monto_usd) : "")
    setConfirmAmountBrl(h.monto_brl ? String(h.monto_brl) : "")
  }

  const openConfirmRetiro = (r: RetiroPendiente) => {
    setConfirmingItem({ kind: "retiro", id: r.id, data: r })
    setConfirmAmount(r.monto_pyg ? String(Math.round(r.monto_pyg)) : "")
    setConfirmAmountUsd(r.monto_usd ? String(r.monto_usd) : "")
    setConfirmAmountBrl(r.monto_brl ? String(r.monto_brl) : "")
  }

  const submitConfirm = async () => {
    if (!confirmingItem || !user) return
    setSubmittingConfirm(true)
    const pyg = parseInt(confirmAmount.replace(/\D/g, ""), 10) || 0
    const usd = parseFloat(confirmAmountUsd.replace(/,/g, ".")) || 0
    const brl = parseFloat(confirmAmountBrl.replace(/,/g, ".")) || 0
    try {
      if (confirmingItem.kind === "handoff") {
        await api.caja.handoffs.confirm(confirmingItem.id, {
          recibido_por: user.id,
          recibido_por_nombre: user.nombre,
          monto_confirmado_pyg: pyg,
          monto_confirmado_usd: usd,
          monto_confirmado_brl: brl,
        })
        toast.success("Entrega Confirmada", "El efectivo ya está registrado en bóveda.")
      } else {
        await api.caja.cashDropRequests.confirm(confirmingItem.id, {
          confirmado_por: user.id,
          confirmado_por_nombre: user.nombre,
          monto_confirmado_pyg: pyg,
          monto_confirmado_usd: usd,
          monto_confirmado_brl: brl,
        })
        toast.success("Retiro Confirmado", "El efectivo ya está registrado en bóveda.")
      }
      triggerSuccessSound()
      setConfirmingItem(null)
      fetchData()
      fetchVaultAndTeam()
    } catch (e: any) {
      toast.error("No se pudo confirmar", e?.message || "Intente de nuevo.")
    } finally {
      setSubmittingConfirm(false)
    }
  }

  const submitRejectRetiro = async () => {
    if (!rejectingRetiro) return
    setSubmittingRejectRetiro(true)
    try {
      await api.caja.cashDropRequests.reject(rejectingRetiro.id, rejectRetiroMotivo.trim() || "Rechazado por supervisor")
      toast.success("Retiro rechazado", "Se avisó que el retiro no fue confirmado.")
      setRejectingRetiro(null)
      fetchData()
    } catch (e: any) {
      toast.error("No se pudo rechazar", e?.message || "Intente de nuevo.")
    } finally {
      setSubmittingRejectRetiro(false)
    }
  }

  // Ejecutar sangría (Drop Cash) iniciada por supervisora
  const handleExecuteDropCash = async () => {
    if (!requestingDropSession) return
    const pyg = parseInt(dropAmountPyg.replace(/\D/g, ""), 10) || 0
    const usd = parseFloat(dropAmountUsd.replace(/,/g, ".")) || 0
    const brl = parseFloat(dropAmountBrl.replace(/,/g, ".")) || 0

    if (pyg <= 0 && usd <= 0 && brl <= 0) {
      toast.warning("Monto requerido", "Ingrese al menos un importe para retirar.")
      return
    }

    setSubmittingDrop(true)
    try {
      await api.caja.cashDrop(requestingDropSession.id, {
        monto: pyg,
        monto_usd: usd,
        monto_brl: brl,
        observaciones: dropObs.trim() || "Sangría solicitada por supervisora",
      })
      toast.success("Sangría Registrada", `Se procesó el Drop Cash de ${requestingDropSession.cajero_nombre || "Caja"}.`)
      triggerSuccessSound()
      setRequestingDropSession(null)
      setDropAmountPyg("")
      setDropAmountUsd("")
      setDropAmountBrl("")
      setDropObs("")
      fetchData()
      fetchVaultAndTeam()
    } catch (e: any) {
      toast.error("No se pudo procesar la sangría", e?.message || "Intente de nuevo.")
    } finally {
      setSubmittingDrop(false)
    }
  }

  // ── ESTADO: CARGANDO SESIÓN ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
      </div>
    )
  }

  // ── ESTADO: SIN SESIÓN (LOGIN TÁCTIL PREMIUM) ───────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-6 relative select-none">
        {/* Glow ambient background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-sm flex items-center justify-between z-10 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-widest uppercase text-amber-400" style={displayFont}>
              EXTRA SUPERMERCADO
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="w-full max-w-sm flex flex-col items-center my-auto z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/20 mb-4 ring-4 ring-amber-500/20">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h1 className="font-black text-2xl mb-1 text-center text-white" style={displayFont}>
            PWA Supervisores
          </h1>
          <p className="text-xs text-slate-400 mb-6 text-center">
            Radar de cajas, monitoreo multimoneda, drop cash y autorizaciones en piso.
          </p>

          {!selectedStaff ? (
            <div className="w-full space-y-3">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                Seleccione su Usuario:
              </div>
              {staffLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                </div>
              )}
              {!staffLoading && staffError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 text-xs text-rose-300 font-bold text-center">
                  {staffError}
                </div>
              )}
              {!staffLoading && staffList.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {staffList.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedStaff(s); setLoginPassword(""); setLoginError("") }}
                      className="flex flex-col items-center gap-2 p-3.5 rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-amber-500 hover:bg-amber-500/10 transition-all cursor-pointer group active:scale-95"
                    >
                      <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden group-hover:border-amber-400">
                        {s.foto_url ? (
                          <img src={s.foto_url} alt={s.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-6 h-6 text-amber-400" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-center leading-tight truncate w-full">
                        {s.nombre}
                      </span>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-amber-500/20 text-amber-300">
                        {s.rol}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full space-y-4 animate-fade-in">
              <button
                onClick={() => { setSelectedStaff(null); setLoginPassword(""); setLoginError("") }}
                className="flex items-center gap-1.5 text-xs text-amber-400 font-bold hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Cambiar de usuario
              </button>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <div className="w-11 h-11 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center overflow-hidden shrink-0">
                  {selectedStaff.foto_url ? (
                    <img src={selectedStaff.foto_url} alt={selectedStaff.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-6 h-6 text-amber-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-black text-sm truncate" style={displayFont}>{selectedStaff.nombre}</div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">{selectedStaff.rol}</span>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoFocus
                    placeholder="PIN o Contraseña"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-2xl px-4 py-3.5 text-center text-lg font-black tracking-widest outline-none text-white transition placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal"
                    style={monoFont}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {loginError && (
                  <div className="text-xs text-rose-400 font-bold text-center bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loggingIn || !loginPassword}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-all"
                >
                  {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Ingresar a Turno
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-slate-600 z-10">
          Supermercado Extra · Terminal Móvil de Supervisión
        </div>
      </div>
    )
  }

  // ── ESTADO: USUARIO SIN ROL DE SUPERVISOR ────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/30">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-lg font-black mb-1" style={displayFont}>Acceso Restringido</h1>
        <p className="text-xs text-slate-400 max-w-xs mb-6">
          Esta PWA es exclusiva para el rol de Supervisor y Administrador. Su cuenta ({user.nombre}) no cuenta con esos permisos.
        </p>
        <button
          onClick={handleLogout}
          className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
        >
          Cerrar Sesión
        </button>
      </div>
    )
  }

  const cashDropAlerts = sessions.filter((s) => s.cash_drop_alert || (s.efectivo_acumulado >= (s.cash_drop_threshold || 5000000)))
  const totalHandoffPyg = handoffs.reduce((sum, h) => sum + h.monto_pyg, 0)

  // Totales acumulados en vivo en todo el piso
  const totalPygPiso = sessions.reduce((acc, s) => acc + (s.efectivo_acumulado || 0), 0)
  const totalUsdPiso = sessions.reduce((acc, s) => acc + (s.efectivo_usd_acumulado || 0), 0)
  const totalBrlPiso = sessions.reduce((acc, s) => acc + (s.efectivo_brl_acumulado || 0), 0)

  const ORIGEN_LABEL: Record<string, string> = {
    cash_drop: "Sangría / Drop Cash",
    entrega_cajero: "Entrega de Turno",
  }

  const tipoLabel: Record<string, string> = {
    remove_item: "Anular Ítem",
    decrease_qty: "Reducir Cantidad",
    clear_cart: "Vaciar Carrito",
    process_return: "Nota de Crédito / Devolución",
    open_pos_config: "Configuración POS",
    assign_terminal: "Asignar Terminal",
    descuento_manual: "Descuento Especial",
  }

  const pendingItems: PendingItem[] = [
    ...authRequests.map((r) => ({ kind: "auth" as const, id: r.id, created_at: r.created_at, data: r })),
    ...vaultApprovals.map((v) => ({ kind: "vault" as const, id: v.id, created_at: v.created_at, data: v })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const totalPendientes = pendingItems.length + retiros.length
  const firstName = (user.nombre || "").split(" ")[0]

  const tabs: { key: Tab; label: string; icon: typeof Home; badge?: number }[] = [
    { key: "inicio", label: "Autorizaciones", icon: ShieldAlert, badge: totalPendientes },
    { key: "cajas", label: "Radar Cajas", icon: Wallet, badge: cashDropAlerts.length },
    { key: "boveda", label: "Bóveda", icon: Landmark },
    { key: "equipo", label: "Cajeras", icon: Users },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white pb-24 transition-colors">
      
      {/* ── HEADER SUPERVISOR PREMIUM ── */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 px-4 pt-[env(safe-area-inset-top)] shadow-xs">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 font-black shrink-0 shadow-md shadow-amber-500/25">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm truncate" style={displayFont}>
                  {firstName}
                </span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Supervisor
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Turno Activo · Piso</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleSound}
              title={soundEnabled ? "Silenciar alertas sonoras" : "Activar alertas sonoras"}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                soundEnabled
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                  : "bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleTheme}
              title="Cambiar tema"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-rose-500 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tira de alertas de conexión */}
        {syncError && (
          <div className="mb-2 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3 py-2 flex items-center gap-2 text-[11px] font-bold text-rose-600 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>Sin conexión con el servidor. Reintentando en segundo plano...</span>
          </div>
        )}

        {/* Tira de Métricas Clave en Vivo */}
        <div className="grid grid-cols-4 gap-2 pb-3">
          <div className={`rounded-xl p-2 text-center border transition ${
            totalPendientes > 0
              ? "bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/30 animate-pulse"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          }`}>
            <div className={`font-black text-base ${totalPendientes > 0 ? "text-rose-600 dark:text-rose-400" : ""}`} style={monoFont}>
              {totalPendientes}
            </div>
            <div className="text-[8.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Pedidos
            </div>
          </div>

          <div className="rounded-xl p-2 text-center border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="font-black text-base text-slate-900 dark:text-white" style={monoFont}>
              {sessions.length}
            </div>
            <div className="text-[8.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Cajas Hoy
            </div>
          </div>

          <div className={`rounded-xl p-2 text-center border transition ${
            cashDropAlerts.length > 0
              ? "bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/30"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          }`}>
            <div className={`font-black text-base ${cashDropAlerts.length > 0 ? "text-amber-600 dark:text-amber-400" : ""}`} style={monoFont}>
              {cashDropAlerts.length}
            </div>
            <div className="text-[8.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Drop Cash
            </div>
          </div>

          <div className="rounded-xl p-2 text-center border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="font-black text-base text-emerald-600 dark:text-emerald-400" style={monoFont}>
              {handoffs.length}
            </div>
            <div className="text-[8.5px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Entregas
            </div>
          </div>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL ── */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        
        {/* ══════════════════════ TAB 1: AUTORIZACIONES (INICIO) ══════════════════════ */}
        {tab === "inicio" && (
          <div className="space-y-4">
            
            {/* Banner de alerta si hay cajas en tope de Drop Cash */}
            {cashDropAlerts.length > 0 && (
              <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/40 p-4 shadow-lg shadow-rose-500/10 flex items-start gap-3 animate-fade-in">
                <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-xs text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                    ¡Sangría de Efectivo Urgente! ({cashDropAlerts.length} Cajas)
                  </div>
                  <div className="text-xs font-bold text-rose-900 dark:text-rose-100 mt-0.5">
                    Superaron el tope de seguridad en mostrador:
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {cashDropAlerts.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setRequestingDropSession(s)
                          setDropAmountPyg(String(Math.round((s.efectivo_acumulado || 0) * 0.7)))
                          setDropAmountUsd(s.efectivo_usd_acumulado ? String(s.efectivo_usd_acumulado) : "")
                          setDropAmountBrl(s.efectivo_brl_acumulado ? String(s.efectivo_brl_acumulado) : "")
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                      >
                        <span>{s.cajero_nombre || "Caja"}</span>
                        <span style={monoFont}>({formatPYG(s.efectivo_acumulado)})</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Retiros solicitados por cajeras */}
            {retiros.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5" style={displayFont}>
                    <Banknote className="w-3.5 h-3.5" /> Retiros Drop Cash Pendientes ({retiros.length})
                  </h2>
                </div>

                <div className="space-y-2.5">
                  {retiros.map((r) => (
                    <div key={r.id} className="rounded-2xl border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div>
                          <div className="font-black text-sm text-slate-900 dark:text-white">
                            {r.solicitado_por_nombre || "Cajera"} · {r.register_nombre || "Caja"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Solicitado {timeSince(r.created_at)}
                          </div>
                        </div>
                        <div className="text-right">
                          {r.monto_pyg > 0 && <div className="font-black text-base text-amber-700 dark:text-amber-300" style={monoFont}>{formatPYG(r.monto_pyg)}</div>}
                          {r.monto_usd > 0 && <div className="text-xs font-bold text-slate-600 dark:text-slate-400" style={monoFont}>{formatUSD(r.monto_usd)}</div>}
                          {r.monto_brl > 0 && <div className="text-xs font-bold text-slate-600 dark:text-slate-400" style={monoFont}>{formatBRL(r.monto_brl)}</div>}
                        </div>
                      </div>

                      {r.observaciones && (
                        <div className="text-xs bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl mb-3 text-slate-700 dark:text-slate-300 border border-amber-200 dark:border-amber-800">
                          {r.observaciones}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => setRejectingRetiro(r)}
                          className="flex-1 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-rose-600 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer hover:bg-rose-50"
                        >
                          <X className="w-3.5 h-3.5" /> Rechazar
                        </button>
                        <button
                          onClick={() => openConfirmRetiro(r)}
                          className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1 cursor-pointer shadow-md shadow-amber-500/20"
                        >
                          <Check className="w-3.5 h-3.5" /> Contar y Confirmar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cola de Autorizaciones de Piso */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={displayFont}>
                  Pedidos de Autorización ({pendingItems.length})
                </h2>
                {pendingItems.length > 0 && (
                  <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                    En Vivo
                  </span>
                )}
              </div>

              {pendingItems.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 p-8 text-center shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="font-black text-sm text-slate-900 dark:text-white">
                    Piso de Cajas Despejado
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Ninguna caja tiene clientes en espera de autorización.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingItems.map((item) =>
                    item.kind === "auth" ? (
                      <div
                        key={item.id}
                        className="rounded-3xl border-2 border-amber-500 bg-white dark:bg-slate-900 p-4 shadow-xl shadow-amber-500/10 animate-fade-in"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-md shadow-amber-500/20">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                              {tipoLabel[item.data.tipo] || item.data.tipo}
                            </div>
                            <div className="font-bold text-sm leading-snug text-slate-900 dark:text-white mt-0.5">
                              {item.data.descripcion}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{item.data.cajero_nombre || "Cajera"}</span>
                              <span>·</span>
                              <span>{item.data.caja_nombre || "Caja"}</span>
                              <span>·</span>
                              <span className="text-amber-600 dark:text-amber-400 font-bold">{timeSince(item.data.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => resolveAuthRequest(item.id, false)}
                            disabled={resolvingId === item.id}
                            className="py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer disabled:opacity-50 transition"
                          >
                            <X className="w-4 h-4" /> Rechazar
                          </button>
                          <button
                            onClick={() => resolveAuthRequest(item.id, true)}
                            disabled={resolvingId === item.id}
                            className="py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition active:scale-[0.98]"
                          >
                            {resolvingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Autorizar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={item.id}
                        className="rounded-3xl border-2 border-blue-500 bg-white dark:bg-slate-900 p-4 shadow-xl shadow-blue-500/10 animate-fade-in"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                            <Landmark className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                              Depósito a Bóveda (Doble Firma)
                            </div>
                            <div className="font-black text-base text-slate-900 dark:text-white" style={monoFont}>
                              {formatPYG(item.data.monto_total_pyg)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {item.data.entry_ids.length} entrega{item.data.entry_ids.length !== 1 ? "s" : ""} · {timeSince(item.data.created_at)}
                              {item.data.aprobado_gerente_id && " · ✓ Aprobado por Gerencia"}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => openRejectVault(item.data)}
                            disabled={resolvingId === item.id}
                            className="py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-4 h-4" /> Rechazar
                          </button>
                          <button
                            onClick={() => approveVaultDeposit(item.data)}
                            disabled={resolvingId === item.id}
                            className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                          >
                            {resolvingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Aprobar Depósito
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Actividad Reciente Resuelta */}
            {recentResolved.length > 0 && (
              <div>
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5" style={displayFont}>
                  Actividad Reciente
                </h2>
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden shadow-xs">
                  {recentResolved.map((r) => (
                    <div key={r.id} className="p-3 flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        r.estado === "aprobado"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      }`}>
                        {r.estado === "aprobado" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {tipoLabel[r.tipo] || r.tipo} · {r.cajero_nombre || "Cajera"}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {r.resuelto_por_nombre ? `Por ${r.resuelto_por_nombre} · ` : ""}{timeSince(r.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ TAB 2: RADAR DE CAJAS & DROP CASH ══════════════════════ */}
        {tab === "cajas" && (
          <div className="space-y-4">
            
            {/* Resumen Total de Recaudación en Piso */}
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 text-white shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-300" style={displayFont}>
                    Recaudación en Piso ({sessions.length} Cajas)
                  </span>
                </div>
                <button
                  onClick={fetchData}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="font-black text-2xl mb-3 text-amber-400" style={monoFont}>
                {formatPYG(totalPygPiso)}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">🇧🇷 Reales:</span>
                  <span className="font-black text-sm text-white" style={monoFont}>{formatBRL(totalBrlPiso)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">🇺🇸 Dólares:</span>
                  <span className="font-black text-sm text-white" style={monoFont}>{formatUSD(totalUsdPiso)}</span>
                </div>
              </div>
            </div>

            {/* Listado de Cajas del Día con Termómetro de Drop Cash */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={displayFont}>
                  Cajas Activas (Hoy / Turno Actual)
                </h2>
                <span className="text-[10px] text-slate-400 font-bold">
                  Tope estándar: ₲ 5.000.000
                </span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500 text-sm">
                  No hay cajas abiertas en el turno de hoy.
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((s) => {
                    const threshold = s.cash_drop_threshold || 5000000
                    const pct = Math.min(100, Math.round(((s.efectivo_acumulado || 0) / threshold) * 100))
                    const isCritical = s.cash_drop_alert || pct >= 100
                    const isWarning = !isCritical && (s.cash_drop_warning || pct >= 70)

                    return (
                      <div
                        key={s.id}
                        className={`rounded-3xl border-2 p-4 transition-all shadow-xs ${
                          isCritical
                            ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20"
                            : isWarning
                            ? "border-amber-400 bg-amber-50/30 dark:bg-amber-950/10"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                        }`}
                      >
                        {/* Encabezado Caja */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{s.cajero_nombre || "Cajera"}</span>
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                {s.register_id ? `Boca ${s.register_id.slice(-3)}` : "Caja"}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Abierta {timeSince(s.fecha_apertura)}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setRequestingDropSession(s)
                              setDropAmountPyg(String(Math.round((s.efectivo_acumulado || 0) * 0.7)))
                              setDropAmountUsd(s.efectivo_usd_acumulado ? String(s.efectivo_usd_acumulado) : "")
                              setDropAmountBrl(s.efectivo_brl_acumulado ? String(s.efectivo_brl_acumulado) : "")
                            }}
                            className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 cursor-pointer transition shadow-xs ${
                              isCritical
                                ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                                : "bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90"
                            }`}
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            <span>Drop Cash</span>
                          </button>
                        </div>

                        {/* Desglose Multimoneda */}
                        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-slate-100/60 dark:bg-slate-950/60 mb-3 border border-slate-200/50 dark:border-slate-800/50">
                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Efectivo ₲</div>
                            <div className="font-black text-xs text-slate-900 dark:text-white" style={monoFont}>
                              {formatPYG(s.efectivo_acumulado)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Reales R$</div>
                            <div className="font-bold text-xs text-slate-900 dark:text-white" style={monoFont}>
                              {formatBRL(s.efectivo_brl_acumulado)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">Dólares US$</div>
                            <div className="font-bold text-xs text-slate-900 dark:text-white" style={monoFont}>
                              {formatUSD(s.efectivo_usd_acumulado)}
                            </div>
                          </div>
                        </div>

                        {/* Termómetro de Sangría */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                            <span className={isCritical ? "text-rose-600 dark:text-rose-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-slate-500"}>
                              {isCritical ? "🚨 Límite alcanzado: Requiere sangría" : isWarning ? "⚠️ Acercándose al tope de seguridad" : "Nivel de efectivo seguro"}
                            </span>
                            <span style={monoFont} className="text-slate-700 dark:text-slate-300">
                              {pct}% ({formatPYG(threshold)})
                            </span>
                          </div>

                          <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isCritical ? "bg-rose-500 animate-pulse" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Entregas de Turno Pendientes */}
            {handoffs.length > 0 && (
              <div className="pt-2">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5" style={displayFont}>
                  Entregas de Cierre Pendientes ({handoffs.length})
                </h2>
                <div className="space-y-2.5">
                  {handoffs.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => openConfirmHandoff(h)}
                      className="w-full text-left rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-amber-500 transition active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {h.entregado_por_nombre || "Cajera"} · {h.register_nombre || "Caja"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Cierre de turno · {timeSince(h.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-slate-900 dark:text-white" style={monoFont}>
                          {formatPYG(h.monto_pyg)}
                        </div>
                        <span className="text-[10px] text-amber-500 font-bold">Verificar ➔</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ══════════════════════ TAB 3: BÓVEDA & CAJA FUERTE ══════════════════════ */}
        {tab === "boveda" && (
          <div className="space-y-4">
            {!vaultDashboard ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : (
              <>
                <div className="rounded-3xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white p-6 shadow-xl shadow-blue-500/20">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4" /> Saldo Consolidado en Bóveda
                  </div>
                  <div className="font-black text-3xl mt-1 mb-3" style={monoFont}>
                    {formatPYG(vaultDashboard.saldo_en_boveda_pyg)}
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-blue-400/30 text-xs text-blue-100">
                    <div>
                      <span className="opacity-80">Reales: </span>
                      <span className="font-bold" style={monoFont}>{formatBRL(vaultDashboard.saldo_en_boveda_brl)}</span>
                    </div>
                    <div>
                      <span className="opacity-80">Dólares: </span>
                      <span className="font-bold" style={monoFont}>{formatUSD(vaultDashboard.saldo_en_boveda_usd)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5" style={displayFont}>
                    Movimientos Recientes en Bóveda
                  </h2>
                  {vaultDashboard.movimientos_recientes.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-slate-500 text-sm">
                      Sin movimientos de bóveda registrados hoy.
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
                      {vaultDashboard.movimientos_recientes.map((m) => (
                        <div key={m.id} className="p-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                              <ArrowDownToLine className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {ORIGEN_LABEL[m.origen] || m.origen}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                {m.estado === "depositado" ? "Depositado en banco" : "En resguardo de bóveda"} · {timeSince(m.created_at)}
                              </div>
                            </div>
                          </div>
                          <div className="font-black text-xs text-slate-900 dark:text-white shrink-0" style={monoFont}>
                            {formatPYG(m.monto_pyg)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════ TAB 4: RENDIMIENTO DE CAJERAS ══════════════════════ */}
        {tab === "equipo" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1" style={displayFont}>
                Desempeño y Arqueos del Equipo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Control de diferencias acumuladas en cierres de caja.
              </p>
            </div>

            {cajeroPerf.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500 text-sm">
                No hay cierres auditados todavía en este periodo.
              </div>
            ) : (
              <div className="space-y-2.5">
                {cajeroPerf.map((c, idx) => (
                  <div
                    key={c.cajero_nombre}
                    className={`rounded-3xl border p-4 shadow-xs ${
                      c.pct_con_revision > 20
                        ? "border-rose-300 dark:border-rose-500/40 bg-rose-50/50 dark:bg-rose-950/20"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 shrink-0" style={monoFont}>
                          #{idx + 1}
                        </div>
                        <div className="font-black text-sm text-slate-900 dark:text-white truncate">
                          {c.cajero_nombre}
                        </div>
                      </div>
                      {c.pct_con_revision > 20 && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400">
                          Revisión Frecuente
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60">
                      <div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Cierres</div>
                        <div className="font-black text-sm text-slate-900 dark:text-white" style={monoFont}>{c.total_cierres}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Diferencia</div>
                        <div className={`font-black text-sm ${c.diferencia_acumulada > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`} style={monoFont}>
                          {formatPYG(c.diferencia_acumulada)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">% Descuadre</div>
                        <div className="font-black text-sm text-slate-900 dark:text-white" style={monoFont}>
                          {c.pct_con_revision}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── BARRA INFERIOR DE NAVEGACIÓN TÁCTIL ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/80 pb-[env(safe-area-inset-bottom)] shadow-lg">
        <div className="grid grid-cols-4 max-w-lg mx-auto">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-col items-center gap-1 py-2.5 relative cursor-pointer transition ${
                  active ? "text-amber-500 font-bold" : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                  {!!t.badge && t.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 text-[9px] font-black bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                      {t.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── MODAL DE SANGRÍA DIRECTA (DROP CASH POR SUPERVISORA) ── */}
      {requestingDropSession && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-black text-sm text-slate-900 dark:text-white" style={displayFont}>
                    Ejecutar Drop Cash (Sangría)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {requestingDropSession.cajero_nombre || "Caja"}
                  </div>
                </div>
              </div>
              <button onClick={() => setRequestingDropSession(null)} className="text-slate-400 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Retire el exceso de efectivo del mostrador para traspasarlo directamente a la bóveda de seguridad.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                  Monto a Retirar en Guaraníes (₲):
                </label>
                <input
                  type="text"
                  autoFocus
                  value={dropAmountPyg}
                  onChange={(e) => setDropAmountPyg(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  style={monoFont}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                    Reales (R$):
                  </label>
                  <input
                    type="text"
                    value={dropAmountBrl}
                    onChange={(e) => setDropAmountBrl(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    style={monoFont}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                    Dólares (US$):
                  </label>
                  <input
                    type="text"
                    value={dropAmountUsd}
                    onChange={(e) => setDropAmountUsd(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    style={monoFont}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">
                  Observaciones (Opcional):
                </label>
                <input
                  type="text"
                  value={dropObs}
                  onChange={(e) => setDropObs(e.target.value)}
                  placeholder="Ej: Retiro por límite de seguridad superado"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              onClick={handleExecuteDropCash}
              disabled={submittingDrop}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-50"
            >
              {submittingDrop ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Confirmar Retiro a Bóveda
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIRMACIÓN / RECUENTO ── */}
      {confirmingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="font-black text-sm" style={displayFont}>
                {confirmingItem.kind === "handoff" ? "Confirmar Recepción de Cierre" : "Confirmar Retiro Drop Cash"}
              </div>
              <button onClick={() => setConfirmingItem(null)} className="text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Cuente físicamente el efectivo antes de confirmar. Este recuento ingresará a la bóveda y se emitirá el comprobante oficial en la caja.
            </p>

            {confirmingItem.data && (
              <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-3.5 mb-3 border border-slate-200 dark:border-slate-700/60">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                  <span>Monto Declarado por Cajera</span>
                  <span className="text-amber-500 font-bold">
                    {"caja_id" in confirmingItem.data ? `Caja ${confirmingItem.data.caja_id}` : ""}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-black text-slate-900 dark:text-white" style={monoFont}>
                    ₲ {Number("monto_pyg" in confirmingItem.data ? confirmingItem.data.monto_pyg : 0).toLocaleString("es-PY")}
                  </span>
                  <div className="text-[11px] font-bold text-slate-500 flex gap-2">
                    {Number(confirmingItem.data.monto_usd || 0) > 0 && <span>US$ {confirmingItem.data.monto_usd}</span>}
                    {Number(confirmingItem.data.monto_brl || 0) > 0 && <span>R$ {confirmingItem.data.monto_brl}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Discrepancy indicator in real-time */}
            {(() => {
              const declaredPyg = Number(confirmingItem.data?.monto_pyg || 0)
              const countedPyg = Number(confirmAmount || 0)
              const diffPyg = countedPyg - declaredPyg
              if (diffPyg !== 0 && confirmAmount !== "") {
                return (
                  <div className={`text-xs font-bold p-2.5 rounded-xl mb-3 flex items-center justify-between border ${
                    diffPyg > 0 
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
                      : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  }`}>
                    <span>Diferencia con lo declarado:</span>
                    <span style={monoFont}>{diffPyg > 0 ? `+₲ ${diffPyg.toLocaleString("es-PY")}` : `-₲ ${Math.abs(diffPyg).toLocaleString("es-PY")}`}</span>
                  </div>
                )
              }
              return null
            })()}

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">Monto Físico Contado por Supervisor (₲):</label>
                <input
                  type="text"
                  autoFocus
                  value={confirmAmount}
                  onChange={(e) => setConfirmAmount(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  style={monoFont}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">R$ Contado:</label>
                  <input
                    type="text"
                    value={confirmAmountBrl}
                    onChange={(e) => setConfirmAmountBrl(e.target.value.replace(/[^0-9.,]/g, ""))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    style={monoFont}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 block mb-1">US$ Contado:</label>
                  <input
                    type="text"
                    value={confirmAmountUsd}
                    onChange={(e) => setConfirmAmountUsd(e.target.value.replace(/[^0-9.,]/g, ""))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                    style={monoFont}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={submitConfirm}
              disabled={submittingConfirm}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-50"
            >
              {submittingConfirm ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar y Registrar en Bóveda
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL RECHAZAR RETIRO ── */}
      {rejectingRetiro && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="font-black text-sm text-slate-900 dark:text-white" style={displayFont}>Rechazar Retiro</div>
              <button onClick={() => setRejectingRetiro(null)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {rejectingRetiro.solicitado_por_nombre || "Cajera"} · {formatPYG(rejectingRetiro.monto_pyg)}
            </p>
            <textarea
              autoFocus
              value={rejectRetiroMotivo}
              onChange={(e) => setRejectRetiroMotivo(e.target.value)}
              placeholder="Indique el motivo del rechazo..."
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs outline-none focus:border-amber-500 mb-3 text-slate-900 dark:text-white resize-none"
            />
            <button
              onClick={submitRejectRetiro}
              disabled={submittingRejectRetiro}
              className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submittingRejectRetiro ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Rechazar Solicitud
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL RECHAZAR DEPÓSITO BÓVEDA ── */}
      {rejectingVault && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="font-black text-sm text-slate-900 dark:text-white" style={displayFont}>Rechazar Depósito</div>
              <button onClick={() => setRejectingVault(null)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {formatPYG(rejectingVault.monto_total_pyg)}
            </p>
            <textarea
              autoFocus
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              placeholder="Indique el motivo del rechazo..."
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs outline-none focus:border-amber-500 mb-3 text-slate-900 dark:text-white resize-none"
            />
            <button
              onClick={submitRejectVault}
              disabled={submittingReject}
              className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submittingReject ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Rechazar Depósito
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
