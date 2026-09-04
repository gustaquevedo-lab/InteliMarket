import { useState, useEffect, useRef, useCallback } from "react"
import {
  ShieldAlert, AlertTriangle, Send, Bot, User, Loader2,
  RefreshCcw, ChevronRight, Package, Filter,
} from "lucide-react"
import { api } from "../../api"
import { formatDateTime } from "../../utils/format"

type Tab = "dashboard" | "eventos" | "chat"

interface RiskEventItem {
  id: string
  accion: string
  entidad?: string
  nivel_riesgo: "BAJO" | "MEDIO" | "ALTO"
  categoria_riesgo: string
  descripcion: string
  cajero?: string
  caja?: string
  autorizado_por?: string
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

interface RiskDashboard {
  periodo_dias: number
  total_eventos: number
  total_alto: number
  total_medio: number
  total_bajo: number
  por_categoria: Record<string, number>
  por_accion: Record<string, number>
  top_cajeros_riesgo: RiskByCajero[]
  eventos_recientes_alto: RiskEventItem[]
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
  const [dias, setDias] = useState(30)
  const [dashboard, setDashboard] = useState<RiskDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<RiskEventItem[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [filterNivel, setFilterNivel] = useState<string>("")

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", text: "Preguntame sobre los eventos de riesgo reales del período: quién concentra más riesgo, qué categorías predominan, o por un cajero específico." },
  ])
  const [chatInput, setChatInput] = useState("")
  const [sendingChat, setSendingChat] = useState(false)
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(["¿Quién tiene más riesgo?", "Ver eventos de riesgo alto", "¿Qué categorías predominan?"])
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.riskAgent.dashboard(dias)
      setDashboard(d)
    } catch {
      // sin datos / error de red -- se deja el dashboard anterior visible
    } finally {
      setLoading(false)
    }
  }, [dias])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    try {
      const ev = await api.riskAgent.events({ dias, nivel: filterNivel || undefined, limit: 200 })
      setEvents(ev)
    } catch {
      setEvents([])
    } finally {
      setLoadingEvents(false)
    }
  }, [dias, filterNivel])

  useEffect(() => { if (tab === "eventos") loadEvents() }, [tab, loadEvents])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
                  Gerente de Riesgo IA
                </span>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Auditoría &amp; Prevención de Riesgos
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Eventos reales registrados por el sistema (verificación de peso, descuentos, reaperturas, saldo bancario) — clasificados por nivel y categoría de riesgo.
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
            </select>
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        {([
          ["dashboard", "Panel de Riesgo"],
          ["eventos", "Eventos"],
          ["chat", "Consultar al Agente"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              tab === key
                ? "border-rose-500 text-rose-600 dark:text-rose-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="h-1 w-full bg-gradient-to-r from-slate-500 to-slate-400 absolute top-0 left-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Eventos auditados</span>
                  <p className="text-2xl font-black font-mono text-slate-700 dark:text-slate-200 mt-1">{dashboard.total_eventos}</p>
                  <span className="text-xs text-slate-400">últimos {dashboard.periodo_dias} días</span>
                </div>
                <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-red-500 absolute top-0 left-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Riesgo alto</span>
                  <p className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">{dashboard.total_alto}</p>
                </div>
                <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Riesgo medio</span>
                  <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">{dashboard.total_medio}</p>
                </div>
                <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Riesgo bajo</span>
                  <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">{dashboard.total_bajo}</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{dashboard.resumen_ejecutivo}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><User className="w-4 h-4 text-rose-500" /> Top cajeros por score de riesgo</h3>
                  <div className="space-y-2">
                    {dashboard.top_cajeros_riesgo.length === 0 && <p className="text-xs text-slate-400">Sin eventos con cajero identificado.</p>}
                    {dashboard.top_cajeros_riesgo.map((c) => (
                      <div key={c.cajero} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{c.cajero}</p>
                          <p className="text-[11px] text-slate-400">{c.total_eventos} eventos · {c.eventos_alto} alto / {c.eventos_medio} medio</p>
                        </div>
                        <span className="text-sm font-mono font-black text-rose-600 dark:text-rose-400">{c.score_riesgo}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-rose-500" /> Eventos por categoría</h3>
                  <div className="space-y-2">
                    {Object.entries(dashboard.por_categoria).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
                      <div key={cat} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{cat}</span>
                        <span className="text-xs font-mono font-bold text-slate-500">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {dashboard.eventos_recientes_alto.length > 0 && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-500" /> Eventos de riesgo alto más recientes</h3>
                  <div className="space-y-2">
                    {dashboard.eventos_recientes_alto.map((e) => (
                      <div key={e.id} className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40">
                        <div className="flex-1">
                          <p className="text-xs text-slate-700 dark:text-slate-200">{e.descripcion}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{e.cajero || "sin cajero"} {e.caja ? `· ${e.caja}` : ""} · {formatDateTime(e.created_at)}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${NIVEL_COLOR[e.nivel_riesgo]}`}>{e.nivel_riesgo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "eventos" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterNivel}
              onChange={(e) => setFilterNivel(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white outline-none font-bold"
            >
              <option value="">Todos los niveles</option>
              <option value="ALTO">Solo riesgo alto</option>
              <option value="MEDIO">Solo riesgo medio</option>
              <option value="BAJO">Solo riesgo bajo</option>
            </select>
            <span className="text-xs text-slate-400 ml-auto">{events.length} eventos</span>
          </div>
          {loadingEvents ? (
            <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50/50 dark:bg-slate-750/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Nivel</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3">Cajero</th>
                    <th className="p-3">Caja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                  {events.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-slate-750/50">
                      <td className="p-3 font-mono text-[11px] text-gray-500">{formatDateTime(e.created_at)}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${NIVEL_COLOR[e.nivel_riesgo]}`}>{e.nivel_riesgo}</span></td>
                      <td className="p-3 capitalize text-gray-600 dark:text-gray-300">{e.categoria_riesgo}</td>
                      <td className="p-3 text-gray-700 dark:text-gray-300 max-w-md">{e.descripcion}</td>
                      <td className="p-3 text-gray-500">{e.cajero || "—"}</td>
                      <td className="p-3 text-gray-500 font-mono">{e.caja || "—"}</td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-slate-400">Sin eventos para este filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
              placeholder="Preguntá sobre el riesgo real del período..."
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
    </div>
  )
}
