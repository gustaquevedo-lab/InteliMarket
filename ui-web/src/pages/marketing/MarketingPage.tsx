import { useState, useEffect, useRef } from "react"
import {
  Megaphone, Sparkles, Send, Loader2, Bot, Target, Users,
  ShoppingBag, ArrowUpRight, CheckCircle2, MessageSquare, Copy,
  Check, Share2, Layers, ShieldCheck, Flame, RefreshCw, Zap,
  TrendingUp, Award, ExternalLink, HelpCircle
} from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useScrollToTop } from "../../hooks/useScrollToTop"

interface MarketingComboItem {
  product_id: string
  product_name: string
  cantidad: number
  precio_unitario_gs: number
  precio_promocional_gs: number
  tipo_rol: string
}

interface MarketingCampaignSuggestion {
  id: string
  titulo: string
  objetivo: string
  proveedor_relacionado?: string
  rebate_en_juego_gs?: number
  impacto_ventas_estimado_gs: number
  margen_estimado_pct: number
  descripcion: string
  items_combo: MarketingComboItem[]
  segmento_objetivo: string
  canales: string[]
  copy_whatsapp: string
  copy_app: string
  estado: string
  created_at?: string
}

interface CustomerSegmentSummary {
  id: string
  nombre: string
  descripcion: string
  total_clientes: number
  score_crediticio_promedio: string
  condicion_venta: string
  potencial_compra_gs: float
}

interface MarketingDashboardData {
  mes_activo: string
  ventas_por_campanas_gs: number
  fardos_traccionados_rebate: number
  tasa_conversion_pct: number
  clientes_activados: number
  campanas_activas: number
  proveedores_en_empuje: string[]
  campanas_sugeridas: MarketingCampaignSuggestion[]
  segmentos: CustomerSegmentSummary[]
}

interface ChatMsg {
  id: string
  isUser: boolean
  text: string
  time: string
  model_used?: string
  campana?: MarketingCampaignSuggestion
}

export default function MarketingPage() {
  const { user } = useAuth()
  const rawName = user?.nombre || user?.email?.split("@")[0] || "Gustavo"
  const userName = rawName.toLowerCase().includes("admin") || rawName.toLowerCase().includes("casa") ? "Gustavo" : rawName

  const [activeTab, setActiveTab] = useState<"ai" | "campaigns" | "segments">("ai")
  useScrollToTop()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MarketingDashboardData | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activatedId, setActivatedId] = useState<string | null>(null)
  const [useGemini, setUseGemini] = useState(false)

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([
    {
      id: "welcome",
      isUser: false,
      text: `### 🚀 Tracción & Demanda Comercial — Casa Gonzalito S.R.L.
Saludos, ${userName}. Soy el Gerente de Marketing IA de Casa Gonzalito.

Opero de forma transversal conectado al **Gerente Comercial** (para cubrir brechas de metas y rebates) y al **Gerente Financiero** (para blindar ofertas a crédito y cuidar la caja). Además, cuento con **Google Gemini** para traer ideas innovadoras de afuera y el pulso del mercado de consumo masivo internacional.

• **Campañas de Rebate:** Diseñadas para empujar los volúmenes exactos de PARESA, Chortitzer y Trociuk.
• **Combos Ancla:** Vinculan productos estrella con artículos de baja rotación en depósito central.
• **Filtro Financiero:** Segmentación por solvencia crediticia (crédito a 15-30d vs solo contado/Pix).
• **Gemini Pulso Exterior:** Análisis de tendencias FMCG, benchmark de precios y psicología promocional para despensas.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model_used: "local"
    }
  ])
  const [query, setQuery] = useState("")
  const [sendingChat, setSendingChat] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatHistory, sendingChat])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.marketingAgent.dashboard()
      if (res) setData(res)
    } catch (e) {
      console.error("Error loading marketing agent data", e)
    } finally {
      setLoading(false)
    }
  }

  const handleSendChat = async (e?: React.FormEvent, presetQuery?: string, forceGemini?: boolean) => {
    if (e) e.preventDefault()
    const textToSend = presetQuery || query
    if (!textToSend.trim() || sendingChat) return

    const activeGemini = forceGemini !== undefined ? forceGemini : useGemini
    setQuery("")
    const userMsg: ChatMsg = {
      id: Date.now().toString(),
      isUser: true,
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setChatHistory(prev => [...prev, userMsg])
    setSendingChat(true)

    try {
      const res = await api.marketingAgent.chat(textToSend, userName, activeGemini)
      const botMsg: ChatMsg = {
        id: (Date.now() + 1).toString(),
        isUser: false,
        text: res.response,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model_used: res.model_used,
        campana: res.campana_generada
      }
      setChatHistory(prev => [...prev, botMsg])
    } catch (err: any) {
      setChatHistory(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          isUser: false,
          text: "Ocurrió un inconveniente al consultar con el Gerente de Marketing. Por favor intenta nuevamente.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setSendingChat(false)
    }
  }

  const handleCopyCopy = (id: string, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleActivateCampaign = async (id: string) => {
    try {
      await api.marketingAgent.activateCampaign(id)
      setActivatedId(id)
      setTimeout(() => setActivatedId(null), 3000)
      if (data) {
        setData({
          ...data,
          campanas_sugeridas: data.campanas_sugeridas.map(c => c.id === id ? { ...c, estado: "activa" } : c)
        })
      }
    } catch (e) {
      console.error("Error activating campaign", e)
    }
  }

  const formatPYG = (val: number) => {
    return `Gs. ${Math.round(val || 0).toLocaleString('es-PY')}`
  }

  const cleanText = (str: string) => {
    return str.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "").trim()
  }

  const renderInlineFormatting = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const text = part.slice(2, -2).replace(/\*/g, "")
        return <strong key={i} className="font-bold text-gray-900 dark:text-white">{text}</strong>
      }
      const clean = part.replace(/\*/g, "")
      return <span key={i}>{clean}</span>
    })
  }

  const renderMarkdownText = (content: string) => {
    const lines = content.split('\n').filter(l => l.trim().length > 0)
    return (
      <div className="space-y-2 text-xs leading-relaxed text-gray-800 dark:text-gray-200">
        {lines.map((line, idx) => {
          const trimmed = line.trim()
          
          if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
            const hText = cleanText(trimmed.replace(/^#+\s*/, ''))
            return (
              <h4 key={idx} className="font-bold text-gray-900 dark:text-white text-xs mt-2.5 mb-1.5 flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-700 pb-1">
                <span>{hText}</span>
              </h4>
            )
          }

          if (trimmed.startsWith('•') || trimmed.startsWith('-') || (trimmed.startsWith('*') && !trimmed.startsWith('**'))) {
            const bulletContent = trimmed.replace(/^[•\-*]\s*/, '')
            return (
              <div key={idx} className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-750/70 rounded-xl border border-gray-200/70 dark:border-gray-700 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-violet-500 mt-1 flex-shrink-0"></span>
                <div className="flex-1 text-gray-800 dark:text-gray-200 leading-snug">
                  {renderInlineFormatting(bulletContent)}
                </div>
              </div>
            )
          }

          const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/)
          if (numMatch) {
            const num = numMatch[1]
            const rest = numMatch[2]
            return (
              <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-750/70 rounded-xl border border-gray-200/70 dark:border-gray-700 shadow-2xs">
                <span className="w-4 h-4 rounded-md bg-violet-500/20 text-violet-600 dark:text-violet-300 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {num}
                </span>
                <div className="flex-1 text-gray-800 dark:text-gray-200 leading-snug">
                  {renderInlineFormatting(rest)}
                </div>
              </div>
            )
          }

          if (trimmed === '---' || trimmed === '--') {
            return <hr key={idx} className="border-gray-200 dark:border-gray-700 my-2" />
          }

          return (
            <p key={idx} className="text-gray-800 dark:text-gray-200">
              {renderInlineFormatting(trimmed)}
            </p>
          )
        })}
      </div>
    )
  }

  return (
    <div className="relative space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Glassmorphism — Ambient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 left-1/4 w-[500px] h-[500px] rounded-full bg-violet-400/10 dark:bg-violet-500/15 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/6 w-[400px] h-[400px] rounded-full bg-indigo-400/8 dark:bg-indigo-500/10 blur-3xl" />
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-violet-950/95 backdrop-blur-xl p-6 rounded-3xl border border-white/[0.12] shadow-2xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-500 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 font-black">
            <Megaphone className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">Gerente de Marketing IA</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-violet-500/20 text-violet-300 border border-violet-500/40">
                TRACCIÓN & DEMANDA B2B
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Sincronización de Campañas de Rebate, Combos Ancla y Filtro de Riesgo Crediticio con Finanzas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSendChat(undefined, "Generar plan de campañas para cerrar metas de rebate este mes")}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generar Campañas IA</span>
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/10 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Ventas por Campañas IA */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-violet-500">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Ventas por Campañas IA</span>
            <TrendingUp className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-xl font-black text-violet-600 dark:text-violet-400 font-mono">
            {formatPYG(data?.ventas_por_campanas_gs || 485320000)}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Tracción generada en WhatsApp y App B2B
          </p>
        </div>

        {/* Card 2: Fardos/Cajas para Rebates */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Volumen para Rebates</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {(data?.fardos_traccionados_rebate || 3420).toLocaleString('es-PY')} Fardos
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
            PARESA (Coca-Cola) & Chortitzer (Trébol)
          </p>
        </div>

        {/* Card 3: Tasa de Conversión */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Tasa de Conversión</span>
            <Zap className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {data?.tasa_conversion_pct || 24.8}%
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Respuestas positivas con pedido en 1-clic
          </p>
        </div>

        {/* Card 4: Clientes Activados */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Clientes Activados</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-gray-900 dark:text-white font-mono">
            {data?.clientes_activados || 328} Comercios
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-bold">
            {data?.campanas_activas || 2} Campañas activas en ruta
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "ai"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
              : "bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm text-slate-600 dark:text-slate-300 border border-white/50 dark:border-white/[0.08] hover:bg-white/90"
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Consola IA & Chat de Marketing</span>
        </button>
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "campaigns"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
              : "bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm text-slate-600 dark:text-slate-300 border border-white/50 dark:border-white/[0.08] hover:bg-white/90"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Campañas Quirúrgicas & Combos ({data?.campanas_sugeridas?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab("segments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "segments"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
              : "bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm text-slate-600 dark:text-slate-300 border border-white/50 dark:border-white/[0.08] hover:bg-white/90"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Segmentos Predictivos & Scoring Crediticio ({data?.segmentos?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: CONSOLA IA & CHAT */}
      {activeTab === "ai" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chat Container (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-[640px] bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/[0.08] shadow-xl rounded-3xl overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 bg-gradient-to-r from-violet-500/10 via-white to-indigo-500/5 dark:from-gray-800 dark:via-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-violet-600 text-white flex items-center justify-center text-base font-black shadow-sm">
                  🚀
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    Gerente de Marketing IA
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Tracción de Metas, Combos Ancla & Filtro de Crédito</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUseGemini(!useGemini)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  useGemini
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-sm shadow-blue-500/30"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-650"
                }`}
                title="Activar Google Gemini Flash para traer ideas de mercado exterior, tendencias FMCG y benchmark B2B"
              >
                <Sparkles className={`w-3.5 h-3.5 ${useGemini ? "text-amber-300" : "text-gray-400"}`} />
                <span>{useGemini ? "Gemini Pulso de Mercado" : "Modo Gemini"}</span>
              </button>
            </div>

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/60 dark:bg-gray-900/60">
              {chatHistory.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.isUser ? "justify-end" : "justify-start"}`}>
                  {!m.isUser && (
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 dark:bg-violet-950/40 border border-violet-500/30 flex items-center justify-center text-violet-600 dark:text-violet-400 text-xs font-bold shrink-0">
                      IA
                    </div>
                  )}
                  <div
                    className={`max-w-[88%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                      m.isUser
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-none font-medium shadow-violet-500/10"
                        : "bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none"
                    }`}
                  >
                    {m.isUser ? <p className="text-xs whitespace-pre-wrap">{m.text}</p> : renderMarkdownText(m.text)}
                    <div className={`mt-2 flex items-center justify-between text-[10px] ${m.isUser ? "text-violet-100" : "text-gray-400"}`}>
                      {!m.isUser && m.model_used && (
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-bold ${
                          m.model_used.includes("gemini")
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}>
                          {m.model_used.includes("gemini") ? "✨ Gemini 3.1 Flash" : "Local Qwen2.5"}
                        </span>
                      )}
                      <span className="ml-auto">{m.time}</span>
                    </div>
                  </div>
                </div>
              ))}
              {sendingChat && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-600 text-xs font-bold shrink-0">
                    IA
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                    Analizando metas comerciales, crédito y rotación de stock...
                  </div>
                </div>
              )}
              {/* End of Chat */}
            </div>

            {/* Quick Prompt Chips */}
            <div className="p-2.5 bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-700 flex gap-2 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Qué tendencias y buenas prácticas de promociones masivas B2B se usan afuera para distribuidoras mayoristas?", true)}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-indigo-950/40 dark:to-violet-950/40 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-200 dark:border-blue-800 whitespace-nowrap transition shadow-2xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                💡 Pulso del Mercado & Tendencias (Gemini)
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Cómo empujamos la meta de PARESA antes del cierre?")}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                🥤 Salvar Meta PARESA
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Qué campaña tenemos para Cooperativa Chortitzer?")}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                🥛 Lácteos Trébol B2B
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Qué ideas creativas de fidelización B2B podemos aplicar para despensas?")}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                🎯 Fidelización Despensas
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Qué clientes nos dejaron de comprar en los últimos 15 días?")}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                👥 Clientes Inactivos (Churn)
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "Armame un combo ancla para liquidar stock lento en depósito")}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                📦 Combos Stock Lento
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChat} className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Consultá al Gerente de Marketing sobre campañas, combos, WhatsApp o metas..."
                className="flex-1 bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
              <button
                type="submit"
                disabled={sendingChat || !query.trim()}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-2xl text-xs transition flex items-center gap-1.5 shadow-sm shadow-violet-500/20 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Enviar</span>
              </button>
            </form>
          </div>

          {/* Columna Derecha: Triángulo de Oro & Campaña Destacada (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Card Triángulo de Oro */}
            <div className="p-5 bg-gradient-to-br from-white to-violet-50/50 dark:from-gray-800 dark:to-gray-750 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Sincronización Multi-Agente Activa</span>
              </div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                El Triángulo de Oro en Casa Gonzalito
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                El Gerente de Marketing opera en sincronía perfecta con las otras gerencias antes de lanzar cualquier mensaje a la calle:
              </p>

              <div className="space-y-2 pt-1 text-xs">
                <div className="p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex items-start gap-2.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                  <div>
                    <strong className="text-gray-900 dark:text-white font-bold">Comercial:</strong>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px]">Provee las metas en riesgo (PARESA Gs. 81M rebate en juego).</p>
                  </div>
                </div>

                <div className="p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex items-start gap-2.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
                  <div>
                    <strong className="text-gray-900 dark:text-white font-bold">Finanzas:</strong>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px]">Bloquea ofertas a crédito a morosos; autoriza 15-30d a clientes A/B.</p>
                  </div>
                </div>

                <div className="p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex items-start gap-2.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></span>
                  <div>
                    <strong className="text-gray-900 dark:text-white font-bold">Marco:</strong>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px]">Orquesta el despacho a preventistas y difusión en WhatsApp.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaña Estrella Activa */}
            {data?.campanas_sugeridas?.[0] && (
              <div className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3 border-l-4 border-l-violet-500">
                <div className="flex justify-between items-start">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300 uppercase">
                    Campaña Destacada
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Rebate: {formatPYG(data.campanas_sugeridas[0].rebate_en_juego_gs || 0)}
                  </span>
                </div>

                <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                  {data.campanas_sugeridas[0].titulo}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {data.campanas_sugeridas[0].descripcion}
                </p>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-gray-400">Canales: WhatsApp + App B2B</span>
                  <button
                    onClick={() => setActiveTab("campaigns")}
                    className="text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1"
                  >
                    Ver detalles del combo →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CAMPAÑAS QUIRÚRGICAS & COMBOS */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(data?.campanas_sugeridas || []).map((camp) => (
              <div key={camp.id} className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4 border-l-4 border-l-violet-500 hover:border-violet-500/60 transition">
                {/* Header Campaña */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300 uppercase">
                      {camp.objetivo.replace("_", " ")}
                    </span>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white mt-1.5">
                      {camp.titulo}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {camp.proveedor_relacionado}
                    </p>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                    camp.estado === "activa"
                      ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-600 border-amber-500/30"
                  }`}>
                    {camp.estado}
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {camp.descripcion}
                </p>

                {/* Métricas clave */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-750 rounded-2xl text-center text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Ventas Est.</span>
                    <strong className="text-gray-900 dark:text-white font-mono text-[11px]">
                      {formatPYG(camp.impacto_ventas_estimado_gs)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Margen Neto</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {camp.margen_estimado_pct}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Rebate Protegido</span>
                    <strong className="text-violet-600 dark:text-violet-400 font-mono text-[11px]">
                      {formatPYG(camp.rebate_en_juego_gs || 0)}
                    </strong>
                  </div>
                </div>

                {/* Items del Combo si aplica */}
                {camp.items_combo.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Composición del Combo:
                    </span>
                    {camp.items_combo.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            item.tipo_rol === "rebate_meta" ? "bg-emerald-500" : item.tipo_rol === "rotacion_lenta" ? "bg-amber-500" : "bg-blue-500"
                          }`}></span>
                          <span className="text-gray-800 dark:text-gray-200 font-medium">
                            {item.cantidad}x {item.product_name}
                          </span>
                        </div>
                        <span className="font-mono text-gray-600 dark:text-gray-400 text-[11px]">
                          {formatPYG(item.precio_promocional_gs)} c/u
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Copy de WhatsApp con botón de copiar */}
                <div className="p-3 bg-slate-900 text-slate-100 rounded-2xl text-xs space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-emerald-400" /> Copy WhatsApp (IntelliZapp)
                    </span>
                    <button
                      onClick={() => handleCopyCopy(camp.id, camp.copy_whatsapp)}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      {copiedId === camp.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === camp.id ? "¡Copiado!" : "Copiar Texto"}
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-slate-300">
                    {camp.copy_whatsapp}
                  </p>
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-[11px] text-gray-400">
                    Segmento: <strong className="text-gray-700 dark:text-gray-300">{camp.segmento_objetivo}</strong>
                  </span>

                  <button
                    onClick={() => handleActivateCampaign(camp.id)}
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 cursor-pointer"
                  >
                    {activatedId === camp.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{activatedId === camp.id ? "¡Programada!" : "Lanzar en WhatsApp / App"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SEGMENTOS PREDICTIVOS */}
      {activeTab === "segments" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.segmentos || []).map((seg) => (
              <div key={seg.id} className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3 border-l-4 border-l-indigo-500">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">{seg.nombre}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{seg.descripcion}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                    {seg.total_clientes} Clientes
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs">
                  <div className="p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-bold">Condición de Venta</span>
                    <strong className="text-gray-800 dark:text-gray-200 text-[11px] block mt-0.5">
                      {seg.condicion_venta}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-bold">Score Crediticio</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 text-[11px] block mt-0.5">
                      {seg.score_crediticio_promedio}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <span className="text-gray-500">
                    Potencial: <strong className="text-gray-900 dark:text-white font-mono">{formatPYG(seg.potencial_compra_gs)}</strong>
                  </span>
                  <button
                    onClick={() => {
                      setActiveTab("ai")
                      handleSendChat(undefined, `Armame una campaña de WhatsApp exclusiva para el segmento: ${seg.nombre}`)
                    }}
                    className="text-violet-600 dark:text-violet-400 font-bold hover:underline text-xs flex items-center gap-1 cursor-pointer"
                  >
                    Crear Campaña con IA →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
