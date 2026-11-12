import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  ShieldAlert, AlertTriangle, Send, Bot, User, Loader2,
  RefreshCcw, ChevronRight, Package, Filter, Tag, X,
  Search, CheckCircle2, ShieldCheck, DollarSign, ArrowRight,
  SlidersHorizontal,
} from "lucide-react"
import { api } from "../../api"
import { formatDateTime, formatPYG } from "../../utils/format"

type Tab = "dashboard" | "eventos" | "chat"

interface RiskEventItem {
  id: string
  accion: string
  entidad?: string
  nivel_riesgo: "BAJO" | "MEDIO" | "ALTO"
  categoria_riesgo: string
  descripcion: string
  tipo_evento_label?: string
  cajero?: string
  caja?: string
  autorizado_por?: string
  usuario?: string
  usuario_nombre?: string
  monto_gs?: number
  detalles?: {
    tipo_descuento?: string
    valor_descuento?: number
    monto_descuento_pyg?: number
    total_con_descuento_pyg?: number
    motivo?: string
    caja?: string
    cajero_nombre?: string
    autorizado_por_nombre?: string
    producto?: string
    [key: string]: any
  }
  created_at: string
}

interface RiskByCajero {
  cajero: string
  total_eventos: number
  eventos_alto: number
  eventos_medio: number
  eventos_bajo: number
  score_riesgo: number
}

interface AccionDisponible {
  accion: string
  label: string
  total: number
}

interface RiskDashboard {
  periodo_dias: number
  total_eventos: number
  total_alto: number
  total_medio: number
  total_bajo: number
  total_descuentos: number
  monto_total_descuentos_pyg: number
  por_categoria: Record<string, number>
  por_accion: Record<string, number>
  acciones_disponibles: AccionDisponible[]
  usuarios_disponibles: string[]
  top_cajeros_riesgo: RiskByCajero[]
  eventos_recientes_alto: RiskEventItem[]
  eventos_recientes_descuento: RiskEventItem[]
  resumen_ejecutivo: string
}

interface ChatMsg {
  role: "user" | "assistant"
  text: string
}

const NIVEL_COLOR: Record<string, string> = {
  ALTO: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  MEDIO: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  BAJO: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
}

export default function RiskAgentPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [dias, setDias] = useState<number>(30)
  const [dashboard, setDashboard] = useState<RiskDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  // Filtros de eventos
  const [events, setEvents] = useState<RiskEventItem[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [filterNivel, setFilterNivel] = useState<string>("")
  const [filterUsuario, setFilterUsuario] = useState<string>("")
  const [filterAccion, setFilterAccion] = useState<string>("")
  const [soloDescuentos, setSoloDescuentos] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [selectedEventModal, setSelectedEventModal] = useState<RiskEventItem | null>(null)

  // Chat
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", text: "Preguntame sobre los eventos de auditoría y riesgo: podés consultar quién concentra más descuentos, detalles de autorizaciones, o por un cajero o caja específica." },
  ])
  const [chatInput, setChatInput] = useState("")
  const [sendingChat, setSendingChat] = useState(false)
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    "Ver descuentos en caja",
    "¿Quién autorizó más descuentos?",
    "¿Quién tiene más riesgo?",
    "Eventos de riesgo alto"
  ])
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.riskAgent.dashboard(dias)
      setDashboard(d)
    } catch {
      // sin datos / error de red
    } finally {
      setLoading(false)
    }
  }, [dias])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    try {
      const ev = await api.riskAgent.events({
        dias,
        nivel: filterNivel || undefined,
        usuario: filterUsuario || undefined,
        accion: soloDescuentos ? "descuento_directo_autorizado" : (filterAccion || undefined),
        solo_descuentos: soloDescuentos || undefined,
        limit: 300,
      })
      setEvents(ev)
    } catch {
      setEvents([])
    } finally {
      setLoadingEvents(false)
    }
  }, [dias, filterNivel, filterUsuario, filterAccion, soloDescuentos])

  useEffect(() => {
    if (tab === "eventos") {
      loadEvents()
    }
  }, [tab, loadEvents])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleIrADescuentos = () => {
    setSoloDescuentos(true)
    setFilterAccion("descuento_directo_autorizado")
    setFilterNivel("")
    setTab("eventos")
  }

  const handleLimpiarFiltros = () => {
    setFilterNivel("")
    setFilterUsuario("")
    setFilterAccion("")
    setSoloDescuentos(false)
    setSearchQuery("")
  }

  // Filtrado local adicional para el buscador rápido de texto
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events
    const q = searchQuery.toLowerCase().trim()
    return events.filter(e =>
      e.descripcion.toLowerCase().includes(q) ||
      (e.tipo_evento_label && e.tipo_evento_label.toLowerCase().includes(q)) ||
      (e.cajero && e.cajero.toLowerCase().includes(q)) ||
      (e.autorizado_por && e.autorizado_por.toLowerCase().includes(q)) ||
      (e.caja && e.caja.toLowerCase().includes(q)) ||
      (e.detalles?.motivo && e.detalles.motivo.toLowerCase().includes(q)) ||
      (e.detalles?.producto && e.detalles.producto.toLowerCase().includes(q))
    )
  }, [events, searchQuery])

  const sendMessage = async (text: string) => {
    if (!text.trim() || sendingChat) return
    setMessages((prev) => [...prev, { role: "user", text }])
    setChatInput("")
    setSendingChat(true)
    try {
      const res = await api.riskAgent.chat({ message: text })
      setMessages((prev) => [...prev, { role: "assistant", text: res.reply }])
      setSuggestedPrompts(res.suggested_prompts || [])
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "No pude consultar los datos ahora. Intentá de nuevo." }])
    } finally {
      setSendingChat(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/90 text-white p-7 border border-rose-500/20 shadow-2xl shadow-rose-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-red-600 to-amber-600 border border-rose-400/30 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-rose-400 uppercase bg-rose-500/10 px-2.5 py-0.5 rounded-md border border-rose-500/20">
                  Gerente de Riesgo IA &amp; Auditoría
                </span>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Auditoría &amp; Prevención de Riesgos
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Control en tiempo real de descuentos directos, autorizaciones de supervisor, pesables en balanza y cobros de caja.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <select
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className="px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800/80 text-slate-200 outline-none font-bold"
            >
              <option value={1}>Hoy</option>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
              <option value={365}>Último año</option>
            </select>
            <button
              onClick={() => { loadDashboard(); if (tab === "eventos") loadEvents(); }}
              disabled={loading || loadingEvents}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading || loadingEvents ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        {([
          ["dashboard", "Panel de Riesgo"],
          ["eventos", "Eventos & Auditoría"],
          ["chat", "Consultar al Agente"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              tab === key
                ? "border-rose-500 text-rose-600 dark:text-rose-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {label}
            {key === "eventos" && soloDescuentos && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-rose-600 text-white font-black animate-pulse">
                Descuentos
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: DASHBOARD */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {loading && !dashboard ? (
            <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : !dashboard || dashboard.total_eventos === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
              <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-30 text-rose-500" />
              <p className="text-sm text-slate-500">Sin eventos de auditoría registrados en este período.</p>
            </div>
          ) : (
            <>
              {/* Tarjetas KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="h-1 w-full bg-gradient-to-r from-slate-500 to-slate-400 absolute top-0 left-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Eventos Auditados</span>
                  <p className="text-2xl font-black font-mono text-slate-700 dark:text-slate-200 mt-1">{dashboard.total_eventos}</p>
                  <span className="text-[11px] text-slate-400">últimos {dashboard.periodo_dias} días</span>
                </div>

                {/* KPI Card Descuentos en Caja */}
                <div
                  onClick={handleIrADescuentos}
                  className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/40 dark:to-amber-950/20 border-2 border-rose-300 dark:border-rose-800 shadow-sm cursor-pointer hover:shadow-md transition group"
                >
                  <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-amber-500 to-red-500 absolute top-0 left-0" />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-rose-500" /> Descuentos en Caja
                    </span>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
                      Ver detalle <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <p className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                    {dashboard.total_descuentos}
                  </p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {formatPYG(dashboard.monto_total_descuentos_pyg)} total
                  </p>
                </div>

                <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-red-500 absolute top-0 left-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Riesgo Alto</span>
                  <p className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">{dashboard.total_alto}</p>
                  <span className="text-[11px] text-slate-400">exigen revisión</span>
                </div>

                <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Riesgo Medio</span>
                  <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">{dashboard.total_medio}</p>
                  <span className="text-[11px] text-slate-400">autorizaciones</span>
                </div>

                <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Riesgo Bajo</span>
                  <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">{dashboard.total_bajo}</p>
                  <span className="text-[11px] text-slate-400">operaciones regulares</span>
                </div>
              </div>

              {/* Resumen Ejecutivo */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {dashboard.resumen_ejecutivo}
                </p>
              </div>

              {/* Sección Destacada: Últimos Descuentos Directos */}
              {dashboard.eventos_recientes_descuento && dashboard.eventos_recientes_descuento.length > 0 && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-rose-200 dark:border-rose-900/50 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-rose-600" />
                      Últimos Descuentos Directos Autorizados en Caja
                      <span className="text-[11px] font-normal text-slate-400">({dashboard.total_descuentos} en total)</span>
                    </h3>
                    <button
                      onClick={handleIrADescuentos}
                      className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                    >
                      Ver todos los descuentos <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dashboard.eventos_recientes_descuento.slice(0, 6).map((e) => (
                      <div
                        key={e.id}
                        onClick={() => setSelectedEventModal(e)}
                        className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 hover:border-rose-300 dark:hover:border-rose-700 transition cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-200/60 dark:bg-rose-900/60 px-2 py-0.5 rounded">
                            {e.detalles?.tipo_descuento === "percentage" ? `${e.detalles.valor_descuento}%` : "Fijo"}
                          </span>
                          <span className="text-xs font-black font-mono text-rose-600 dark:text-rose-400">
                            -{formatPYG(e.monto_gs || e.detalles?.monto_descuento_pyg)}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                          {e.detalles?.motivo || e.descripcion}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{e.cajero || "Caja"} {e.caja ? `(${e.caja})` : ""}</span>
                          <span>{formatDateTime(e.created_at)}</span>
                        </div>
                        {e.autorizado_por && (
                          <p className="text-[10px] text-slate-400 border-t border-rose-100/70 dark:border-rose-900/30 pt-1">
                            Autorizado por: <b className="text-slate-600 dark:text-slate-300">{e.autorizado_por}</b>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grilla: Top Cajeros y Categorías */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-rose-500" /> Top cajeros por score de riesgo
                  </h3>
                  <div className="space-y-2">
                    {dashboard.top_cajeros_riesgo.length === 0 && <p className="text-xs text-slate-400">Sin eventos con cajero identificado.</p>}
                    {dashboard.top_cajeros_riesgo.map((c) => (
                      <div
                        key={c.cajero}
                        onClick={() => { setFilterUsuario(c.cajero); setTab("eventos"); }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900/60 cursor-pointer transition"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{c.cajero}</p>
                          <p className="text-[11px] text-slate-400">{c.total_eventos} eventos · {c.eventos_alto} alto / {c.eventos_medio} medio</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-mono font-black text-rose-600 dark:text-rose-400">{c.score_riesgo}</span>
                          <span className="block text-[10px] text-slate-400">Filtrar →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-rose-500" /> Eventos por categoría
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(dashboard.por_categoria).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800"
                      >
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{cat}</span>
                        <span className="text-xs font-mono font-bold text-slate-500">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Eventos de riesgo alto recientes */}
              {dashboard.eventos_recientes_alto.length > 0 && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" /> Eventos de riesgo alto más recientes
                  </h3>
                  <div className="space-y-2">
                    {dashboard.eventos_recientes_alto.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => setSelectedEventModal(e)}
                        className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 hover:border-rose-300 transition cursor-pointer"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-200/50 dark:bg-rose-900/40 px-1.5 py-0.5 rounded">
                              {e.tipo_evento_label || e.accion}
                            </span>
                            {e.monto_gs ? (
                              <span className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
                                {formatPYG(e.monto_gs)}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-200 mt-1">{e.descripcion}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {e.cajero || e.usuario || "sin cajero"} {e.caja ? `· ${e.caja}` : ""} · {formatDateTime(e.created_at)}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${NIVEL_COLOR[e.nivel_riesgo]}`}>
                          {e.nivel_riesgo}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: EVENTOS & AUDITORIA */}
      {tab === "eventos" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
            {/* Quick Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => { setSoloDescuentos(false); setFilterAccion(""); setFilterNivel(""); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  !soloDescuentos && !filterAccion && !filterNivel
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                Todos los eventos
              </button>

              <button
                onClick={handleIrADescuentos}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition flex items-center gap-1.5 ${
                  soloDescuentos
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                Descuentos en Caja ({dashboard?.total_descuentos ?? 0})
              </button>

              <button
                onClick={() => { setSoloDescuentos(false); setFilterAccion("supervisor_remove_item"); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  filterAccion === "supervisor_remove_item"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                Anulaciones de Ítem
              </button>

              <button
                onClick={() => { setSoloDescuentos(false); setFilterAccion("supervisor_clear_cart"); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  filterAccion === "supervisor_clear_cart"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                Vaciados de Carrito
              </button>

              <button
                onClick={() => { setSoloDescuentos(false); setFilterAccion("peso_discrepancia_detectada"); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  filterAccion === "peso_discrepancia_detectada"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                Discrepancia de Peso
              </button>

              <button
                onClick={() => { setFilterNivel(filterNivel === "ALTO" ? "" : "ALTO"); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  filterNivel === "ALTO"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                Riesgo Alto
              </button>
            </div>

            {/* Controles Principales de Filtro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              {/* Buscador de texto libre */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar en descripción, motivo, caja..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white outline-none focus:border-rose-500"
                />
              </div>

              {/* Filtro por Tipo de Evento */}
              <div>
                <select
                  value={soloDescuentos ? "descuento_directo_autorizado" : filterAccion}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === "descuento_directo_autorizado") {
                      setSoloDescuentos(true)
                      setFilterAccion("descuento_directo_autorizado")
                    } else {
                      setSoloDescuentos(false)
                      setFilterAccion(val)
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white outline-none font-bold"
                >
                  <option value="">Todos los tipos de evento</option>
                  <option value="descuento_directo_autorizado">🏷️ Descuento Directo en Caja</option>
                  {dashboard?.acciones_disponibles
                    ?.filter(a => a.accion !== "descuento_directo_autorizado")
                    .map((a) => (
                      <option key={a.accion} value={a.accion}>
                        {a.label} ({a.total})
                      </option>
                    ))}
                </select>
              </div>

              {/* Filtro por Usuario / Cajero */}
              <div>
                <select
                  value={filterUsuario}
                  onChange={(e) => setFilterUsuario(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white outline-none font-bold"
                >
                  <option value="">Todos los usuarios / cajeros</option>
                  {dashboard?.usuarios_disponibles?.map((u) => (
                    <option key={u} value={u}>
                      👤 {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Nivel de Riesgo */}
              <div>
                <select
                  value={filterNivel}
                  onChange={(e) => setFilterNivel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white outline-none font-bold"
                >
                  <option value="">Todos los niveles</option>
                  <option value="ALTO">🔴 Solo riesgo alto</option>
                  <option value="MEDIO">🟡 Solo riesgo medio</option>
                  <option value="BAJO">🟢 Solo riesgo bajo</option>
                </select>
              </div>

              {/* Botón Limpiar Filtros & Conteo */}
              <div className="flex items-center justify-between gap-2">
                {(filterNivel || filterUsuario || filterAccion || soloDescuentos || searchQuery) && (
                  <button
                    onClick={handleLimpiarFiltros}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900 hover:bg-rose-100 transition"
                  >
                    <X className="w-3.5 h-3.5" /> Limpiar filtros
                  </button>
                )}
                <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 ml-auto">
                  {filteredEvents.length} eventos
                </span>
              </div>
            </div>
          </div>

          {/* Tabla de Eventos */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
            {loadingEvents ? (
              <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50/50 dark:bg-slate-750/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Fecha y Hora</th>
                      <th className="p-3">Tipo de Evento</th>
                      <th className="p-3">Nivel</th>
                      <th className="p-3">Descripción &amp; Motivo</th>
                      <th className="p-3 text-right">Monto</th>
                      <th className="p-3">Usuario / Cajero</th>
                      <th className="p-3">Autorizado Por</th>
                      <th className="p-3">Caja</th>
                      <th className="p-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                    {filteredEvents.map((e) => {
                      const isDescuento = e.accion === "descuento_directo_autorizado"
                      return (
                        <tr
                          key={e.id}
                          className={`hover:bg-gray-50 dark:hover:bg-slate-750/50 transition cursor-pointer ${
                            isDescuento ? "bg-rose-50/20 dark:bg-rose-950/10" : ""
                          }`}
                          onClick={() => setSelectedEventModal(e)}
                        >
                          <td className="p-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                            {formatDateTime(e.created_at)}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {isDescuento ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                <Tag className="w-3 h-3" /> Descuento Directo
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                {e.tipo_evento_label || e.accion}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border whitespace-nowrap ${NIVEL_COLOR[e.nivel_riesgo]}`}>
                              {e.nivel_riesgo}
                            </span>
                          </td>
                          <td className="p-3 text-gray-700 dark:text-gray-300 max-w-sm">
                            <div className="space-y-0.5">
                              <p className="font-medium">{e.descripcion}</p>
                              {e.detalles?.motivo && (
                                <p className="text-[10px] text-slate-400">
                                  Motivo: <span className="font-semibold text-slate-600 dark:text-slate-300">{e.detalles.motivo}</span>
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {e.monto_gs || e.detalles?.monto_descuento_pyg ? (
                              <span className={`font-mono font-bold ${isDescuento ? "text-rose-600 dark:text-rose-400 text-xs" : "text-slate-700 dark:text-slate-300"}`}>
                                {isDescuento ? "-" : ""}{formatPYG(e.monto_gs || e.detalles?.monto_descuento_pyg)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                            {e.cajero || e.usuario || "—"}
                          </td>
                          <td className="p-3 text-gray-500 whitespace-nowrap">
                            {e.autorizado_por ? (
                              <span className="font-semibold text-slate-600 dark:text-slate-300">{e.autorizado_por}</span>
                            ) : "—"}
                          </td>
                          <td className="p-3 text-gray-500 font-mono whitespace-nowrap">
                            {e.caja || "—"}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <button
                              onClick={(ev) => { ev.stopPropagation(); setSelectedEventModal(e); }}
                              className="px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                            >
                              Detalle
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredEvents.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-10 text-center text-slate-400">
                          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30 text-rose-500" />
                          Sin eventos de auditoría para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CHAT CON AGENTE DE RIESGO */}
      {tab === "chat" && (
        <div className="rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col h-[560px]">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-rose-600 text-white rounded-br-sm"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-bl-sm"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {sendingChat && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl rounded-bl-sm px-4 py-2.5"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          {suggestedPrompts.length > 0 && (
            <div className="px-5 pb-2 flex flex-wrap gap-2">
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center gap-1"
                >
                  {p} <ChevronRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(chatInput) }}
            className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Preguntá sobre los descuentos o el riesgo del período..."
              className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              disabled={sendingChat || !chatInput.trim()}
              className="p-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* MODAL DE DETALLE DE EVENTO (Rule 14 Canónico) */}
      {selectedEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="max-h-[90vh] flex flex-col w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Cabecera (shrink-0) */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${NIVEL_COLOR[selectedEventModal.nivel_riesgo]}`}>
                  {selectedEventModal.nivel_riesgo}
                </span>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {selectedEventModal.tipo_evento_label || selectedEventModal.accion}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEventModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo central scrolleable (flex-1 overflow-y-auto) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Banner de Descuento si aplica */}
              {selectedEventModal.accion === "descuento_directo_autorizado" && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                    Monto de Descuento Autorizado
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
                      -{formatPYG(selectedEventModal.monto_gs || selectedEventModal.detalles?.monto_descuento_pyg)}
                    </span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      ({selectedEventModal.detalles?.tipo_descuento === "percentage" ? `${selectedEventModal.detalles.valor_descuento}%` : "Monto Fijo"})
                    </span>
                  </div>
                  {selectedEventModal.detalles?.total_con_descuento_pyg && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Total venta facturado con descuento: <b className="font-mono">{formatPYG(selectedEventModal.detalles.total_con_descuento_pyg)}</b>
                    </p>
                  )}
                </div>
              )}

              {/* Descripción */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Descripción del Evento</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 font-medium bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  {selectedEventModal.descripcion}
                </p>
              </div>

              {/* Atributos y Actores */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Cajero / Operador</span>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                    {selectedEventModal.cajero || selectedEventModal.usuario || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Autorizado Por</span>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                    {selectedEventModal.autorizado_por || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Caja / Terminal</span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {selectedEventModal.caja || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Categoría de Riesgo</span>
                  <span className="text-xs capitalize font-bold text-slate-700 dark:text-slate-300">
                    {selectedEventModal.categoria_riesgo}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Fecha y Hora (America/Asuncion)</span>
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                    {formatDateTime(selectedEventModal.created_at)}
                  </span>
                </div>
              </div>

              {/* Motivo o detalles adicionales si existen */}
              {selectedEventModal.detalles?.motivo && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Motivo Declarado</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 rounded-xl font-medium">
                    {selectedEventModal.detalles.motivo}
                  </p>
                </div>
              )}
            </div>

            {/* Pie de acciones (shrink-0) */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedEventModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
