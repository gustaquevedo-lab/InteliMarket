import { useState, useEffect, useRef } from "react"
import {
  TrendingUp, BarChart3, Bot, Sparkles, Send, Play, CheckCircle2, XCircle,
  AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw, Layers, Users,
  ShoppingBag, Target, DollarSign, Check, X, Loader2, ShieldCheck, ChevronRight
} from "lucide-react"
import { api } from "../../api/index"
import { useAuth } from "../../context/AuthContext"

interface Recommendation {
  id: string
  categoria: string
  titulo: string
  diagnostico: string
  accion_propuesta: string
  impacto_estimado_gs: number
  urgencia: string
  estado: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
}

interface ChatMsg {
  id: string
  isUser: boolean
  text: string
  time: string
  diagnostico_key?: string
}

export default function CommercialAgentPage() {
  const { user } = useAuth()
  const rawName = user?.nombre || user?.email?.split("@")[0] || "Gustavo"
  const userName = rawName.toLowerCase().includes("admin") ? "Gustavo" : rawName

  const [tab, setTab] = useState<"chat" | "recommendations" | "suppliers">("chat")
  const [loading, setLoading] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([
    {
      id: "welcome",
      isUser: false,
      text: `### 👔 Saludos, ${userName}. Soy el Gerente Comercial IA de Casa Gonzalito.

Estoy conectado a las bases de datos operativas de ventas, preventa, metas de proveedores y márgenes de la distribuidora.

Podés pedirme diagnósticos detallados, matrices de rentabilidad por proveedor o planes para cerrar el mes con PARESA.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [query, setQuery] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadRecommendations()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory, loading])

  const loadRecommendations = async () => {
    setLoading(true)
    try {
      const data = await api.commercialAgent.recommendations()
      setRecommendations(data || [])
    } catch (e) {
      console.error("Error loading commercial recommendations", e)
    } finally {
      setLoading(false)
    }
  }

  const handleRunDiagnosis = async () => {
    setDiagnosing(true)
    try {
      const res = await api.commercialAgent.run()
      if (res && res.recommendations) {
        setRecommendations(res.recommendations)
      }
    } catch (e) {
      console.error("Error running commercial diagnosis", e)
    } finally {
      setDiagnosing(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const updated = await api.commercialAgent.approve(id, userName, "Aprobado para ejecución en ruta")
      setRecommendations(prev => prev.map(r => r.id === id ? { ...r, estado: "aprobada", approved_by: userName } : r))
    } catch (e) {
      console.error("Error approving recommendation", e)
    }
  }

  const handleReject = async (id: string) => {
    try {
      await api.commercialAgent.reject(id, userName, "Descartado por dirección comercial")
      setRecommendations(prev => prev.map(r => r.id === id ? { ...r, estado: "rechazada" } : r))
    } catch (e) {
      console.error("Error rejecting recommendation", e)
    }
  }

  const handleSendChat = async (presetQuery?: string) => {
    const textToSend = presetQuery || query
    if (!textToSend.trim() || loading) return

    setQuery("")
    const userMsg: ChatMsg = {
      id: Date.now().toString(),
      isUser: true,
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setChatHistory(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await api.commercialAgent.chat(textToSend, userName)
      const botMsg: ChatMsg = {
        id: (Date.now() + 1).toString(),
        isUser: false,
        text: res.response,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        diagnostico_key: res.diagnostico_key
      }
      setChatHistory(prev => [...prev, botMsg])
    } catch (e) {
      setChatHistory(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        isUser: false,
        text: "⚠️ Ocurrió un error al procesar el dictamen comercial. Por favor intenta de nuevo.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: number) => {
    return `Gs. ${Math.round(val).toLocaleString('es-PY')}`
  }

  const renderMarkdownText = (content: string) => {
    const lines = content.split('\n')
    return (
      <div className="space-y-2 text-sm leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim()
          if (trimmed.startsWith('###')) {
            return (
              <h4 key={idx} className="font-bold text-gray-900 dark:text-white text-base mt-2 mb-1">
                {trimmed.replace(/^###\s*/, '')}
              </h4>
            )
          }
          if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></span>
                <p className="text-gray-800 dark:text-gray-200">
                  {trimmed.replace(/^[•\-]\s*/, '')}
                </p>
              </div>
            )
          }
          if (trimmed.startsWith('|')) {
            return <div key={idx} className="font-mono text-xs overflow-x-auto py-1 text-gray-700 dark:text-gray-300">{trimmed}</div>
          }
          if (trimmed === '---') {
            return <hr key={idx} className="border-gray-200 dark:border-gray-700 my-2" />
          }
          return <p key={idx} className="text-gray-800 dark:text-gray-200">{trimmed}</p>
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-slate-900/60 p-6 rounded-3xl border border-emerald-500/20 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-white/20">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Gerente Comercial IA</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Casa Gonzalito S.R.L.
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
              Especialista analítico en rentabilidad mayorista, metas PARESA (Coca-Cola), rutas de preventa y gestión de márgenes.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunDiagnosis}
          disabled={diagnosing}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {diagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{diagnosing ? "Auditando Datos..." : "Ejecutar Diagnóstico"}</span>
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
            <span>Meta PARESA (Coca-Cola)</span>
            <Target className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">98.450 / 113.503 UC</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full" style={{ width: "86.7%" }}></div>
            </div>
            <span className="text-xs font-bold text-rose-500">86.7%</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
            <span>Rebate Proyectado (4.5%)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">Gs. 149,2 Millones</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Faltan 15.053 UC para tramo pleno</p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
            <span>Facturación del Mes</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">Gs. 4.120 Millones</p>
          <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" /> Pacing en +4.2% sobre meta
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
            <span>Margen Bruto Promedio</span>
            <Layers className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">18.4%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Líder: Trovato (22.5%) | Bajo: Trébol (7.2%)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          onClick={() => setTab("chat")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            tab === "chat"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Consola de Estrategia Comercial (Chat)</span>
        </button>

        <button
          onClick={() => setTab("recommendations")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            tab === "recommendations"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Medidas & Recomendaciones</span>
          <span className="px-1.5 py-0.2 text-[10px] bg-white/20 rounded-full font-mono">
            {recommendations.length}
          </span>
        </button>

        <button
          onClick={() => setTab("suppliers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            tab === "suppliers"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Matriz de Rentabilidad por Proveedor</span>
        </button>
      </div>

      {/* Tab 1: Chat Analítico */}
      {tab === "chat" && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm flex flex-col h-[560px] overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40 dark:bg-gray-900/40">
            {chatHistory.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.isUser ? "justify-end" : "justify-start"}`}>
                {!m.isUser && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow flex-shrink-0">
                    👔
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  m.isUser
                    ? "bg-emerald-600 text-white rounded-tr-none font-medium"
                    : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200/80 dark:border-gray-700/80 rounded-tl-none"
                }`}>
                  {m.isUser ? <p className="text-sm">{m.text}</p> : renderMarkdownText(m.text)}
                  <span className={`block text-[10px] mt-2 ${m.isUser ? "text-emerald-100" : "text-gray-400"}`}>
                    {m.time}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs animate-pulse">👔</div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 text-xs flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>El Gerente Comercial está auditando los números en el servidor...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 bg-gray-50/80 dark:bg-gray-850 border-t border-gray-200/60 dark:border-gray-700/60 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Consultas directas:</span>
            {[
              "¿Cómo cerramos las metas de PARESA este mes?",
              "Auditoría de rentabilidad por proveedor",
              "Plan para mejorar margen en Lácteos Trébol",
              "¿Qué clientes están en riesgo de caída de compras?"
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendChat(p)}
                className="px-3 py-1 bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap transition"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200/80 dark:border-gray-700/80 flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              placeholder="Consultá al Gerente Comercial sobre ventas, rentabilidad, combos o preventistas..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={!query.trim() || loading}
              className="p-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-2xl transition shadow-md shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Recomendaciones */}
      {tab === "recommendations" && (
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700">
              <Sparkles className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 dark:text-white text-base">No hay recomendaciones pendientes</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                Hacé clic en "Ejecutar Diagnóstico" para que el motor IA analice las ventas del mes y proponga medidas comerciales.
              </p>
              <button
                onClick={handleRunDiagnosis}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow hover:bg-emerald-700 transition"
              >
                Ejecutar Diagnóstico Ahora
              </button>
            </div>
          ) : (
            recommendations.map((r) => (
              <div
                key={r.id}
                className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      r.urgencia === "alta"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200"
                    }`}>
                      Urgencia {r.urgencia}
                    </span>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">{r.titulo}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Impacto: +{formatCurrency(r.impacto_estimado_gs)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
                      r.estado === "aprobada"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : r.estado === "rechazada"
                        ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                    }`}>
                      {r.estado.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-700/60 text-xs space-y-1.5">
                  <p className="text-gray-600 dark:text-gray-300">
                    <strong className="text-gray-900 dark:text-white">Diagnóstico:</strong> {r.diagnostico}
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                    <strong>Acción Propuesta:</strong> {r.accion_propuesta}
                  </p>
                </div>

                {r.estado === "pendiente" && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => handleReject(r.id)}
                      className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Descartar</span>
                    </button>
                    <button
                      onClick={() => handleApprove(r.id)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Aprobar Medida</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Matriz de Rentabilidad */}
      {tab === "suppliers" && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Matriz de Rentabilidad & Rebates por Proveedor</h3>
              <p className="text-xs text-gray-500">Auditoría cruzada de facturación bruta, costos de compra y bonificaciones.</p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-xl border border-emerald-500/20">
              Margen Promedio: 18.4%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Proveedor / Línea</th>
                  <th className="py-3 px-3">Facturación Mes</th>
                  <th className="py-3 px-3">Margen Bruto Real</th>
                  <th className="py-3 px-3">Rebate / Bonificación</th>
                  <th className="py-3 px-3">Rentabilidad Neta</th>
                  <th className="py-3 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-750">
                <tr className="hover:bg-slate-50/50 dark:hover:bg-gray-750/50">
                  <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">PARESA (Coca-Cola, Fanta, Sprite)</td>
                  <td className="py-3 px-3">Gs. 3.380 M</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">14.8%</td>
                  <td className="py-3 px-3 text-rose-500 font-bold">+4.5%</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">19.3%</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Líder Core</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-gray-750/50">
                  <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">Río Aquidabán (Harinas, Fideos)</td>
                  <td className="py-3 px-3">Gs. 820 M</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">18.2%</td>
                  <td className="py-3 px-3 text-blue-500 font-bold">+2.0%</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">20.2%</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Muy Rentable</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-gray-750/50">
                  <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">Trovato C.I.S.A. (Golosinas, Galletitas)</td>
                  <td className="py-3 px-3">Gs. 490 M</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">22.5%</td>
                  <td className="py-3 px-3 text-violet-500 font-bold">+3.0%</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">25.5%</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">Alto Margen</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-gray-750/50">
                  <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">La Mercantil Guaraní</td>
                  <td className="py-3 px-3">Gs. 380 M</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">16.4%</td>
                  <td className="py-3 px-3 text-amber-500 font-bold">+1.5%</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">17.9%</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Sólido</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-gray-750/50 bg-rose-50/20 dark:bg-rose-950/10">
                  <td className="py-3 px-3 font-bold text-rose-600 dark:text-rose-400">Lácteos Trébol (Leches, Quesos)</td>
                  <td className="py-3 px-3">Gs. 640 M</td>
                  <td className="py-3 px-3 text-rose-500 font-bold">7.2%</td>
                  <td className="py-3 px-3 text-gray-400">0.0%</td>
                  <td className="py-3 px-3 font-bold text-rose-500">7.2%</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Margen Bajo</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
