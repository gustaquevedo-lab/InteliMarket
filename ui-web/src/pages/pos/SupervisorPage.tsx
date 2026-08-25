import { useState, useEffect, useCallback } from "react"
import {
  ShieldCheck, LogOut, RefreshCcw, Wallet, AlertTriangle, Clock, Loader2,
  CheckCircle2, ChevronRight, X, Banknote, ShieldAlert, Check, Eye, EyeOff,
  Sun, Moon, Home, Users, Landmark, TrendingDown, Inbox, ArrowDownToLine,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { useTheme } from "../../context/ThemeContext"
import { api } from "../../api"

const SUPERVISOR_ROLES = ["supervisor", "admin"]

interface SessionSummary {
  id: string
  register_id: string
  cajero_nombre: string | null
  fecha_apertura: string
  monto_apertura: number
  monto_cobrado: number
  estado: string
  cash_drop_alert: boolean
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

const formatPYG = (n: number) => `₲ ${Math.round(n).toLocaleString("es-PY")}`

function timeSince(iso: string) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return `hace ${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `hace ${mins} min`
  const hs = Math.floor(mins / 60)
  return `hace ${hs}h ${mins % 60}min`
}

const displayFont = { fontFamily: "'Archivo Expanded', sans-serif" }
const monoFont = { fontFamily: "'IBM Plex Mono', monospace" }

type Tab = "inicio" | "cajas" | "boveda" | "equipo"

// Ítem unificado para la cola de "Pendientes" en Inicio -- une pedidos de
// autorización de caja y aprobaciones de depósito a bóveda, que hoy viven en
// dos sistemas separados pero para la supervisora son la misma cosa: algo
// que la está esperando para poder seguir.
type PendingItem =
  | { kind: "auth"; id: string; created_at: string; data: AuthRequest }
  | { kind: "vault"; id: string; created_at: string; data: VaultApproval }

export default function SupervisorPage() {
  const { user, loading: authLoading, login, logout } = useAuth()
  const toast = useToast()
  const { dark, toggle: toggleTheme } = useTheme()

  // ── LOGIN PROPIO, SIN NAVEGAR A NINGÚN LADO ──────────────────────────────
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [loggingIn, setLoggingIn] = useState(false)

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setLoggingIn(true)
    try {
      await login(loginEmail, loginPassword)
    } catch (err: any) {
      setLoginError(err?.message || "Credenciales incorrectas")
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmAmount, setConfirmAmount] = useState("")
  const [submittingConfirm, setSubmittingConfirm] = useState(false)
  const [rejectingVault, setRejectingVault] = useState<VaultApproval | null>(null)
  const [rejectMotivo, setRejectMotivo] = useState("")
  const [submittingReject, setSubmittingReject] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  // ── Marca presencia real de supervisor apenas entra a esta pantalla ──
  useEffect(() => {
    if (!isAuthorized) return
    let cancelled = false
    api.auth.startPosShift().then(() => { if (!cancelled) setOnDuty(true) }).catch(() => {
      if (!cancelled) toast.error("No se pudo registrar el turno", "Reintente cerrando y volviendo a entrar.")
    })
    return () => { cancelled = true }
  }, [isAuthorized])

  // ── Colas de pendientes -- lo más urgente de la pantalla, se sondea cada
  // 5s porque un cajero puede estar esperando en el mostrador con un cliente
  // delante. Junta autorizaciones de caja y depósitos de bóveda: para la
  // supervisora ambas son "algo que me está esperando". ──
  const fetchPending = useCallback(async () => {
    try {
      const [reqs, vApprovals] = await Promise.all([
        api.supervisorRequests.list({ estado: "pendiente" }),
        api.vault.depositApprovals.list("pendiente"),
      ])
      setAuthRequests(reqs || [])
      setVaultApprovals(vApprovals || [])
      setSyncError(null)
    } catch (e: any) {
      // Si el celular no puede sincronizar tiene que ser obvio, no una
      // lista vacía mintiendo tranquilidad.
      setSyncError(e?.message || "No se pudo conectar con el servidor")
    }
  }, [])

  useEffect(() => {
    if (!isAuthorized) return
    fetchPending()
    const interval = setInterval(fetchPending, 5000)
    return () => clearInterval(interval)
  }, [isAuthorized, fetchPending])

  const resolveAuthRequest = async (id: string, aprobado: boolean) => {
    if (!user) return
    setResolvingId(id)
    try {
      await api.supervisorRequests.resolve(id, { aprobado, resuelto_por: user.id, resuelto_por_nombre: user.nombre })
      toast.success(aprobado ? "Autorizado" : "Rechazado", aprobado ? "La caja ya puede continuar." : "Se avisó al cajero.")
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
      toast.success("Depósito aprobado", "Se sumó su aprobación al depósito.")
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

  const fetchData = useCallback(async () => {
    try {
      const [sess, ho] = await Promise.all([
        api.caja.sessionsSummary({ estado: "abierta" }),
        api.caja.handoffs.list({ estado: "pendiente" }),
      ])
      setSessions(sess || [])
      setHandoffs(ho || [])
      setLastSync(new Date())
      setSyncError(null)
    } catch (e: any) {
      setSyncError(e?.message || "No se pudo conectar con el servidor")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthorized) return
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [isAuthorized, fetchData])

  // ── Datos secundarios del hub -- bóveda y equipo -- se refrescan más
  // lento (30s) porque no son urgentes, son de panorama. Un fallo acá no
  // debe tapar el aviso de sincronización de las colas de pendientes. ──
  const fetchVaultAndTeam = useCallback(async () => {
    try {
      const [vd, perf] = await Promise.all([api.vault.dashboard(), api.caja.cajeros.performance()])
      setVaultDashboard(vd as any)
      setCajeroPerf((perf as any) || [])
    } catch { /* datos de panorama, no bloquean el resto del hub */ }
  }, [])

  useEffect(() => {
    if (!isAuthorized) return
    fetchVaultAndTeam()
    const interval = setInterval(fetchVaultAndTeam, 30000)
    return () => clearInterval(interval)
  }, [isAuthorized, fetchVaultAndTeam])

  // ── Actividad reciente -- últimos pedidos ya resueltos, para dar
  // contexto de auditoría sin tener que salir de la PWA. ──
  const fetchRecentResolved = useCallback(async () => {
    try {
      const all = await api.supervisorRequests.list({ limit: 30 })
      setRecentResolved((all || []).filter((r: AuthRequest) => r.estado !== "pendiente").slice(0, 6))
    } catch { /* no crítico */ }
  }, [])

  useEffect(() => {
    if (!isAuthorized) return
    fetchRecentResolved()
    const interval = setInterval(fetchRecentResolved, 30000)
    return () => clearInterval(interval)
  }, [isAuthorized, fetchRecentResolved])

  const handleLogout = async () => {
    try { await api.auth.endPosShift() } catch {}
    logout()
    setLoginEmail("")
    setLoginPassword("")
  }

  const openConfirm = (h: Handoff) => {
    setConfirmingId(h.id)
    setConfirmAmount(String(Math.round(h.monto_pyg)))
  }

  const submitConfirm = async () => {
    if (!confirmingId || !user) return
    setSubmittingConfirm(true)
    try {
      await api.caja.handoffs.confirm(confirmingId, {
        recibido_por: user.id,
        recibido_por_nombre: user.nombre,
        monto_confirmado_pyg: parseInt(confirmAmount.replace(/\D/g, ""), 10) || 0,
      })
      toast.success("Entrega Confirmada", "El efectivo ya está registrado en bóveda.")
      setConfirmingId(null)
      fetchData()
      fetchVaultAndTeam()
    } catch (e: any) {
      toast.error("No se pudo confirmar", e?.message || "Intente de nuevo.")
    } finally {
      setSubmittingConfirm(false)
    }
  }

  // ── ESTADO: CARGANDO SESIÓN ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
      </div>
    )
  }

  // ── ESTADO: SIN SESIÓN -- LOGIN PROPIO, NUNCA NAVEGA A OTRO LADO ─────────
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col items-center justify-center p-6 relative">
        <button
          onClick={toggleTheme}
          className="absolute top-5 right-5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <div className="w-16 h-16 rounded-2xl bg-brand-orange flex items-center justify-center text-[#1C1710] shadow-lg shadow-orange-500/30 mb-5">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="font-black text-xl mb-1" style={displayFont}>Panel de Supervisora</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-7 text-center max-w-xs">Cajas, bóveda, equipo y pedidos de autorización — todo desde acá.</p>

        <form onSubmit={handleLoginSubmit} className="w-full max-w-sm space-y-3">
          {loginError && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 rounded-xl px-3 py-2.5 text-xs text-rose-600 dark:text-rose-300 font-bold">{loginError}</div>
          )}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">Email</label>
            <input
              type="email"
              autoFocus
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="supervisor@empresa.com"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-orange text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-brand-orange text-slate-900 dark:text-white"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full py-3.5 rounded-xl bg-brand-orange hover:brightness-95 text-[#1C1710] font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-2 shadow-lg shadow-orange-500/30 transition-all"
          >
            {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Entrar
          </button>
        </form>
      </div>
    )
  }

  // ── ESTADO: LOGUEADA PERO SIN NIVEL DE SUPERVISOR ────────────────────────
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <div>
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-rose-500 dark:text-rose-400" />
          </div>
          <h1 className="text-slate-900 dark:text-white font-black text-lg mb-1">Acceso restringido</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
            Esta pantalla es solo para supervisores y administradores. Su cuenta ({user.nombre}) no tiene ese nivel.
          </p>
          <button onClick={handleLogout} className="mt-5 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer">
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  const cashDropAlerts = sessions.filter((s) => s.cash_drop_alert)
  const totalHandoffPyg = handoffs.reduce((sum, h) => sum + h.monto_pyg, 0)

  const tipoLabel: Record<string, string> = {
    remove_item: "Anular ítem",
    decrease_qty: "Reducir cantidad",
    clear_cart: "Vaciar carrito",
    process_return: "Devolución",
    open_pos_config: "Config. de POS",
    assign_terminal: "Asignar caja",
  }

  const pendingItems: PendingItem[] = [
    ...authRequests.map((r) => ({ kind: "auth" as const, id: r.id, created_at: r.created_at, data: r })),
    ...vaultApprovals.map((v) => ({ kind: "vault" as const, id: v.id, created_at: v.created_at, data: v })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const totalPendientes = pendingItems.length
  const firstName = (user.nombre || "").split(" ")[0]
  const hour = new Date().getHours()
  const saludo = hour < 12 ? "Buen día" : hour < 19 ? "Buenas tardes" : "Buenas noches"

  const tabs: { key: Tab; label: string; icon: typeof Home; badge?: number }[] = [
    { key: "inicio", label: "Inicio", icon: Home, badge: totalPendientes },
    { key: "cajas", label: "Cajas", icon: Wallet },
    { key: "boveda", label: "Bóveda", icon: Landmark },
    { key: "equipo", label: "Equipo", icon: Users },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white pb-24" style={{ fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] shrink-0 shadow-sm shadow-orange-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-[15px] truncate" style={displayFont}>{saludo}, {firstName}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className={`w-1.5 h-1.5 rounded-full ${onDuty ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                {onDuty ? "En turno · supervisor" : "Registrando turno…"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={toggleTheme} title="Cambiar tema" className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer">
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} title="Cerrar sesión" className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {syncError && (
          <div className="mx-0 mb-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-300 shrink-0" />
            <div className="text-[11px] font-bold text-rose-600 dark:text-rose-300">Sin conexión con el servidor — esta pantalla no se está actualizando. Cierre y vuelva a abrir la app.</div>
          </div>
        )}

        {/* Tira de resumen */}
        <div className="grid grid-cols-4 gap-2 pb-3">
          {[
            { label: "Pendientes", value: totalPendientes, alert: totalPendientes > 0 },
            { label: "Entregas", value: handoffs.length, alert: false },
            { label: "Cajas", value: sessions.length, alert: false },
            { label: "Retiros", value: cashDropAlerts.length, alert: cashDropAlerts.length > 0 },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl px-2 py-2 text-center border ${s.alert ? "bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/30" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"}`}>
              <div className={`font-black text-lg ${s.alert ? "text-rose-600 dark:text-rose-300" : ""}`} style={monoFont}>{s.value}</div>
              <div className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {/* ══════════════════════ TAB: INICIO ══════════════════════ */}
        {tab === "inicio" && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={displayFont}>
                  Pedidos de Autorización
                </h2>
                {totalPendientes > 0 && (
                  <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">{totalPendientes} en vivo</span>
                )}
              </div>

              {totalPendientes === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
                  <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                  <div className="text-slate-500 dark:text-slate-400 text-sm">Ninguna caja está esperando autorización ahora.</div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingItems.map((item) =>
                    item.kind === "auth" ? (
                      <div key={item.id} className="rounded-2xl border-2 border-brand-orange bg-white dark:bg-slate-900 p-3.5 shadow-lg shadow-orange-500/10">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center text-[#1C1710] shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black uppercase tracking-wide text-brand-orangeInk dark:text-brand-orange">{tipoLabel[item.data.tipo] || item.data.tipo}</div>
                            <div className="font-bold text-sm leading-snug">{item.data.descripcion}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.data.cajero_nombre || "Cajero"} · {item.data.caja_nombre || "Caja"} · {timeSince(item.data.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => resolveAuthRequest(item.id, false)}
                            disabled={resolvingId === item.id}
                            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> Rechazar
                          </button>
                          <button
                            onClick={() => resolveAuthRequest(item.id, true)}
                            disabled={resolvingId === item.id}
                            className="flex-1 py-2.5 rounded-xl bg-brand-orange text-[#1C1710] font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {resolvingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Autorizar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={item.id} className="rounded-2xl border-2 border-primary bg-white dark:bg-slate-900 p-3.5 shadow-lg shadow-primary/10">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shrink-0">
                            <Landmark className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black uppercase tracking-wide text-primary dark:text-primary-300">Depósito a bóveda</div>
                            <div className="font-bold text-sm leading-snug" style={monoFont}>{formatPYG(item.data.monto_total_pyg)}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.data.entry_ids.length} entrada{item.data.entry_ids.length !== 1 ? "s" : ""} · {timeSince(item.data.created_at)}
                              {item.data.aprobado_gerente_id && " · Ya tiene aprobación de gerencia"}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openRejectVault(item.data)}
                            disabled={resolvingId === item.id}
                            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> Rechazar
                          </button>
                          <button
                            onClick={() => approveVaultDeposit(item.data)}
                            disabled={resolvingId === item.id}
                            className="flex-1 py-2.5 rounded-xl bg-primary text-white font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {resolvingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Aprobar
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {cashDropAlerts.length > 0 && (
              <div className="rounded-2xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 p-3.5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-black text-sm text-rose-600 dark:text-rose-300">
                    {cashDropAlerts.length} caja{cashDropAlerts.length > 1 ? "s" : ""} necesita{cashDropAlerts.length > 1 ? "n" : ""} retiro de efectivo
                  </div>
                  <div className="text-xs text-rose-600/80 dark:text-rose-300/80 mt-0.5">
                    {cashDropAlerts.map((s) => s.cajero_nombre).filter(Boolean).join(", ")}
                  </div>
                </div>
              </div>
            )}

            {recentResolved.length > 0 && (
              <div>
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5" style={displayFont}>
                  Actividad Reciente
                </h2>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                  {recentResolved.map((r) => (
                    <div key={r.id} className="px-3.5 py-2.5 flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${r.estado === "aprobado" ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400"}`}>
                        {r.estado === "aprobado" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{tipoLabel[r.tipo] || r.tipo} · {r.cajero_nombre || "Cajero"}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{r.resuelto_por_nombre ? `Por ${r.resuelto_por_nombre} · ` : ""}{timeSince(r.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════ TAB: CAJAS ══════════════════════ */}
        {tab === "cajas" && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={displayFont}>
                  Entregas Pendientes
                </h2>
                {handoffs.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400" style={monoFont}>{formatPYG(totalHandoffPyg)} en total</span>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : handoffs.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-center text-slate-500 dark:text-slate-400 text-sm">
                  Sin entregas pendientes de confirmar.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {handoffs.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => openConfirm(h)}
                      className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Wallet className="w-5 h-5 text-brand-orange" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{h.entregado_por_nombre || "Cajero"}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{h.register_nombre || "Caja"} · {timeSince(h.created_at)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-sm" style={monoFont}>{formatPYG(h.monto_pyg)}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={displayFont}>
                  Cajas Activas
                </h2>
                <button onClick={fetchData} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer">
                  <RefreshCcw className="w-3 h-3" />
                  {lastSync ? lastSync.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }) : ""}
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : sessions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-center text-slate-500 dark:text-slate-400 text-sm">
                  No hay cajas abiertas en este momento.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sessions.map((s) => (
                    <div key={s.id} className={`rounded-2xl border p-3.5 ${s.cash_drop_alert ? "border-rose-300 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-500/5" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-sm">{s.cajero_nombre || "Cajero"}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <Clock className="w-3 h-3" /> {timeSince(s.fecha_apertura)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vendido en el turno</div>
                          <div className="font-black text-lg" style={monoFont}>{formatPYG(s.monto_cobrado)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Efectivo acumulado</div>
                          <div className={`font-bold text-sm ${s.cash_drop_alert ? "text-rose-600 dark:text-rose-400" : ""}`} style={monoFont}>
                            {formatPYG(s.efectivo_acumulado)}
                          </div>
                        </div>
                      </div>
                      {s.cash_drop_alert && (
                        <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-500/20 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Supera el umbral de retiro
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════ TAB: BÓVEDA ══════════════════════ */}
        {tab === "boveda" && (
          <>
            {!vaultDashboard ? (
              <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              <>
                <div className="rounded-2xl bg-primary text-white p-4 shadow-lg shadow-primary/20">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-primary-100 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5" /> Saldo en Bóveda
                  </div>
                  <div className="font-black text-3xl mt-1" style={monoFont}>{formatPYG(vaultDashboard.saldo_en_boveda_pyg)}</div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-primary-100">
                    <span>{vaultDashboard.entradas_en_boveda} entrada{vaultDashboard.entradas_en_boveda !== 1 ? "s" : ""}</span>
                    {vaultDashboard.saldo_en_boveda_usd > 0 && <span style={monoFont}>US$ {vaultDashboard.saldo_en_boveda_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>}
                    {vaultDashboard.saldo_en_boveda_brl > 0 && <span style={monoFont}>R$ {vaultDashboard.saldo_en_boveda_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                  </div>
                </div>

                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5" style={displayFont}>
                    Movimientos Recientes
                  </h2>
                  {vaultDashboard.movimientos_recientes.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-center text-slate-500 dark:text-slate-400 text-sm">
                      Sin movimientos registrados todavía.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                      {vaultDashboard.movimientos_recientes.map((m) => (
                        <div key={m.id} className="px-3.5 py-2.5 flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.estado === "depositado" ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold capitalize truncate">{m.origen} · {m.estado === "depositado" ? "Depositado" : "En bóveda"}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{timeSince(m.created_at)}</div>
                          </div>
                          <div className="text-xs font-black shrink-0" style={monoFont}>{formatPYG(m.monto_pyg)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════ TAB: EQUIPO ══════════════════════ */}
        {tab === "equipo" && (
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5" style={displayFont}>
              Desempeño de Cajeros
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Ranking por descuadre acumulado en cierres de caja — el más alto arriba.</p>
            {cajeroPerf.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-center text-slate-500 dark:text-slate-400 text-sm">
                Todavía no hay cierres de caja registrados.
              </div>
            ) : (
              <div className="space-y-2.5">
                {cajeroPerf.map((c, idx) => (
                  <div key={c.cajero_nombre} className={`rounded-2xl border p-3.5 ${c.pct_con_revision > 20 ? "border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/5" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 dark:text-slate-400 shrink-0" style={monoFont}>#{idx + 1}</div>
                        <div className="font-bold text-sm truncate">{c.cajero_nombre}</div>
                      </div>
                      {c.pct_con_revision > 20 && <TrendingDown className="w-4 h-4 text-rose-500 shrink-0" />}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cierres</div>
                        <div className="font-black text-sm" style={monoFont}>{c.total_cierres}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Diferencia</div>
                        <div className={`font-black text-sm ${c.diferencia_acumulada > 0 ? "text-rose-600 dark:text-rose-400" : ""}`} style={monoFont}>{formatPYG(c.diferencia_acumulada)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Con revisión</div>
                        <div className="font-black text-sm" style={monoFont}>{c.pct_con_revision}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── NAV INFERIOR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-col items-center gap-0.5 py-2.5 relative cursor-pointer ${active ? "text-brand-orange" : "text-slate-400 dark:text-slate-500"}`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                  {!!t.badge && (
                    <span className="absolute -top-1.5 -right-2 text-[9px] font-black bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center">{t.badge}</span>
                  )}
                </div>
                <span className="text-[10px] font-bold">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── MODAL DE CONFIRMACIÓN DE ENTREGA ── */}
      {confirmingId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-sm bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            <div className="flex items-center justify-between mb-4">
              <div className="font-black text-base" style={displayFont}>Confirmar Recepción</div>
              <button onClick={() => setConfirmingId(null)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Cuente el efectivo usted misma antes de confirmar — este monto es su propio recuento, no el que declaró el cajero.
            </p>
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">Monto contado (₲)</label>
            <div className="relative mb-4">
              <Banknote className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={confirmAmount}
                onFocus={(e) => e.target.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) => setConfirmAmount(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-3 text-lg font-black outline-none focus:border-brand-orange text-slate-900 dark:text-white"
                style={monoFont}
              />
            </div>
            <button
              onClick={submitConfirm}
              disabled={submittingConfirm}
              className="w-full py-3.5 rounded-xl bg-brand-orange hover:brightness-95 text-[#1C1710] font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer shadow-lg shadow-orange-500/30"
            >
              {submittingConfirm ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar y Registrar en Bóveda
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL DE RECHAZO DE DEPÓSITO A BÓVEDA ── */}
      {rejectingVault && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-sm bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            <div className="flex items-center justify-between mb-4">
              <div className="font-black text-base" style={displayFont}>Rechazar Depósito</div>
              <button onClick={() => setRejectingVault(null)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {formatPYG(rejectingVault.monto_total_pyg)} · {rejectingVault.entry_ids.length} entrada{rejectingVault.entry_ids.length !== 1 ? "s" : ""}
            </p>
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">Motivo (opcional)</label>
            <textarea
              autoFocus
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              placeholder="Ej: falta verificar un movimiento"
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-orange text-slate-900 dark:text-white mb-4 resize-none"
            />
            <button
              onClick={submitRejectVault}
              disabled={submittingReject}
              className="w-full py-3.5 rounded-xl bg-rose-600 hover:brightness-95 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
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
