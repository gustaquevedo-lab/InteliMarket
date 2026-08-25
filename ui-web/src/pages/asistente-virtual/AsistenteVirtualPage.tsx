import { useState, useEffect, useRef } from "react"
import {
  BarChart3, MessageCircle, Ticket, BrainCircuit, Send, Plus, Search, Loader2,
  Zap, CheckCircle, XCircle, Clock, RefreshCcw, Bot, User, ThumbsUp, ThumbsDown,
  Star, Phone, Mail, ArrowLeft, Settings, Activity,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function AsistenteVirtualPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Asistente Virtual IA</h1>
          <p className="text-sm text-gray-500 mt-1">Chatbot IA + WhatsApp — pedidos, consultas, reclamos, derivación a humano</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",      label: "Dashboard",    icon: BarChart3 },
            { key: "chat",           label: "Chat",         icon: MessageCircle },
            { key: "conversaciones", label: "Conversaciones", icon: Activity },
            { key: "tickets",        label: "Tickets",       icon: Ticket },
            { key: "configuracion",  label: "Config",        icon: Settings },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard"      && <DashboardTab />}
      {tab === "chat"           && <ChatTab />}
      {tab === "conversaciones" && <ConversacionesTab />}
      {tab === "tickets"        && <TicketsTab />}
      {tab === "configuracion"  && <ConfigTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600", yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600", indigo: "bg-indigo-50 text-indigo-600",
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

function IntentBadge({ intent }: { intent?: string }) {
  const colors: Record<string, string> = {
    saludo: "bg-green-100 text-green-700", catalogo: "bg-blue-100 text-blue-700",
    pedido_status: "bg-purple-100 text-purple-700", credito: "bg-yellow-100 text-yellow-700",
    comprar: "bg-indigo-100 text-indigo-700", reclamo: "bg-red-100 text-red-700",
    humano: "bg-orange-100 text-orange-700", despedida: "bg-gray-100 text-gray-700",
    unknown: "bg-gray-100 text-gray-500",
  }
  const labels: Record<string, string> = {
    saludo: "Saludo", catalogo: "Catálogo", pedido_status: "Pedido",
    credito: "Crédito", comprar: "Compra", reclamo: "Reclamo",
    humano: "Humano", despedida: "Despedida", unknown: "?",
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[intent || "unknown"] || colors.unknown}`}>
    {labels[intent || "unknown"] || intent}
  </span>
}

// ===== DASHBOARD =====

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.asistenteVirtual.getDashboard(COMPANY_ID).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={MessageCircle} label="Conversaciones" value={data?.total_conversations || 0} sub={`${data?.active_conversations || 0} activas`} color="blue" />
        <KpiCard icon={Bot} label="Resueltas por IA" value={data?.resolved_by_ai || 0} color="green" />
        <KpiCard icon={User} label="Derivadas a Humano" value={data?.escalated_to_human || 0} color="orange" />
        <KpiCard icon={Ticket} label="Tickets" value={data?.total_tickets || 0} sub={`${data?.open_tickets || 0} abiertos`} color="red" />
      </div>

      {data?.ai_resolution_rate != null && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tasa de Resolución IA</h3>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className={`h-3 rounded-full ${data.ai_resolution_rate >= 70 ? "bg-green-500" : data.ai_resolution_rate >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${data.ai_resolution_rate}%` }}></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">{data.ai_resolution_rate}% resuelto por IA</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.conversations_by_intent?.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Conversaciones por Intención</h3>
            {data.conversations_by_intent.map((i: any) => (
              <div key={i.intent} className="flex items-center justify-between py-1.5 text-sm">
                <IntentBadge intent={i.intent} />
                <span className="font-medium">{i.count}</span>
              </div>
            ))}
          </div>
        )}
        {data?.tickets_by_category?.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tickets por Categoría</h3>
            {data.tickets_by_category.map((c: any) => (
              <div key={c.category} className="flex items-center justify-between py-1.5 text-sm">
                <span className="capitalize">{c.category}</span>
                <span className="font-medium">{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== CHAT =====

function ChatTab() {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<any[]>([])
  const [convId, setConvId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [customerId, setCustomerId] = useState("00000000-0000-0000-0000-000000000010")
  const [customerName, setCustomerName] = useState("Cliente Demo")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  const send = async () => {
    if (!message.trim()) return
    const msg = message
    setMessage("")
    setLoading(true)
    try {
      const res = await api.asistenteVirtual.sendMessage(COMPANY_ID, {
        conversation_id: convId,
        customer_id: customerId,
        customer_name: customerName,
        message: msg,
        channel: "web",
      })
      setConvId(res.conversation_id)
      setMessages(prev => [...prev, res.user_message, res.assistant_message])
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearChat = () => {
    setMessages([])
    setConvId(null)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col h-[600px]">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Asistente Virtual IA</span>
              {convId && <span className="text-xs text-gray-400">ID: {convId.slice(0, 8)}</span>}
            </div>
            <button onClick={clearChat} className="text-xs text-gray-400 hover:text-red-500">Nuevo chat</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 py-12">
                <Bot className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Iniciá una conversación con el asistente virtual</p>
                <p className="text-xs mt-1">Consultá precios, pedidos, saldo, o hacé un reclamo</p>
              </div>
            )}
            {messages.map((m: any) => (
              <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-blue-600" /></div>}
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"}`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] ${m.role === "user" ? "text-blue-200" : "text-gray-400"}`}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""}
                    </span>
                    {m.intent && m.role === "assistant" && <IntentBadge intent={m.intent} />}
                    {m.needs_human && <span className="text-xs text-orange-500">→ Humano</span>}
                  </div>
                </div>
                {m.role === "user" && <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-gray-600" /></div>}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex gap-2 items-center">
              <input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="Customer ID"
                className="w-40 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-xs bg-white dark:bg-gray-700 hidden lg:block" />
              <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Escribí tu mensaje..."
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" />
              <button onClick={send} disabled={loading || !message.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? <Spinner /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:block space-y-2">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sugerencias</h3>
          {[
            "Hola",
            "Mostrame el catálogo",
            "¿Cuánto tengo de crédito?",
            "Consultar pedidos",
            "Quiero hacer un pedido",
            "Abrir un reclamo",
            "Hablar con un operador",
          ].map((s) => (
            <button key={s} onClick={() => { setMessage(s) }}
              className="block w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition">
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===== CONVERSACIONES =====

function ConversacionesTab() {
  const [conv, setConv] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])

  const load = () => {
    setLoading(true)
    api.asistenteVirtual.listConversations(COMPANY_ID).then(setConv).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const viewMessages = async (id: string) => {
    setSelected(id)
    try {
      const msgs = await api.asistenteVirtual.getMessages(COMPANY_ID, id)
      setMessages(msgs)
    } catch { setMessages([]) }
  }

  const endConv = async (id: string) => {
    try {
      await api.asistenteVirtual.endConversation(COMPANY_ID, id, false)
      load()
      if (selected === id) { setSelected(null); setMessages([]) }
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        {loading ? <Spinner /> : conv.length === 0
          ? <p className="text-center text-gray-500 py-8">Sin conversaciones</p>
          : <div className="space-y-2">
              {conv.map((c: any) => (
                <div key={c.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer hover:shadow-md transition ${selected === c.id ? "border-blue-500" : "border-gray-100 dark:border-gray-700"}`}
                  onClick={() => viewMessages(c.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.customer_name || "Anónimo"}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${c.status === "active" ? "bg-green-100 text-green-700" : c.status === "waiting_human" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}>
                          {c.status}
                        </span>
                        <IntentBadge intent={c.current_intent} />
                        <span>{c.message_count} msgs</span>
                      </div>
                    </div>
                    {c.status !== "resolved" && c.status !== "ended" && (
                      <button onClick={(e) => { e.stopPropagation(); endConv(c.id) }}
                        className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200">Cerrar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      <div>
        {selected && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 max-h-[600px] overflow-y-auto">
            <h3 className="text-sm font-semibold mb-3">Mensajes</h3>
            {messages.map((m: any) => (
              <div key={m.id} className={`flex gap-2 mb-3 ${m.role === "user" ? "justify-end" : ""}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-50 dark:bg-gray-700"}`}>
                  <p className="text-xs">{m.content}</p>
                  <span className="text-[10px] text-gray-400 mt-1 block">{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== TICKETS =====

function TicketsTab() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.asistenteVirtual.listTickets(COMPANY_ID).then(setTickets).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: string) => {
    try { await api.asistenteVirtual.updateTicket(COMPANY_ID, id, status); load() }
    catch (e: any) { alert(e.message) }
  }

  const priorityColor = (p: string) =>
    p === "high" ? "text-red-600 bg-red-50" : p === "medium" ? "text-yellow-600 bg-yellow-50" : "text-green-600 bg-green-50"

  return (
    <div>
      {loading ? <Spinner /> : tickets.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin tickets generados</p>
        : <div className="space-y-2">
            {tickets.map((t: any) => (
              <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">{t.category}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor(t.priority)}`}>{t.priority}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === "open" ? "bg-red-100 text-red-700" : t.status === "in_progress" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>{t.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t.description?.slice(0, 200)}</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {t.status === "open" && (
                      <button onClick={() => updateStatus(t.id, "in_progress")}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">Tomar</button>
                    )}
                    {t.status === "in_progress" && (
                      <button onClick={() => updateStatus(t.id, "resolved")}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">Resolver</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ===== CONFIG =====

function ConfigTab() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.asistenteVirtual.getTemplates(COMPANY_ID).then(setTemplates).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const seed = async () => {
    try {
      await api.asistenteVirtual.seedTemplates(COMPANY_ID)
      load()
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Plantillas de Intención</h3>
        <p className="text-xs text-gray-500 mb-3">Las plantillas definen cómo el asistente clasifica y responde a los mensajes.</p>
        <button onClick={seed} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 mb-4">
          Cargar plantillas por defecto
        </button>

        {loading ? <Spinner /> : templates.length === 0
          ? <p className="text-xs text-gray-400">Sin plantillas configuradas. Cargá las plantillas por defecto.</p>
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((t: any) => (
                <div key={t.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{t.intent_name}</span>
                    {t.requires_live_agent && <span className="text-xs text-orange-500">Requiere humano</span>}
                  </div>
                  <p className="text-xs text-gray-500">Handler: {t.action_handler || "ninguno"}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.keywords?.slice(0, 5).map((kw: string) => (
                      <span key={kw} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">{kw}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}
