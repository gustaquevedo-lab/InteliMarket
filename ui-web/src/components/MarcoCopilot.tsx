import { useState, useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import {
  Sparkles, Mic, MicOff, Send, X, Volume2, Database, Clock,
  Bot, User, ChevronDown, ChevronUp, Loader2, MessageSquare, Play, HelpCircle
} from "lucide-react"
import { api } from "../api/index"

import { useAuth } from "../context/AuthContext"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function MarcoCopilot() {
  const { user } = useAuth()
  const userName = user?.nombre || user?.email?.split("@")[0] || "Gustavo"
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [model, setModel] = useState("qwen2.5:7b") // default fast model for instant copilot answers
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [openSqlIdx, setOpenSqlIdx] = useState<number | null>(null)
  
  const location = useLocation()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [history, loading])

  const playBase64Audio = (base64Audio: string) => {
    if (!base64Audio) return
    try {
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl
        audioPlayerRef.current.play()
      } else {
        const audio = new Audio(audioUrl)
        audio.play()
      }
    } catch (e) {
      console.error("Error playing audio", e)
    }
  }

  const handleSend = async (textToSend?: string) => {
    const textQuery = textToSend || query
    if (!textQuery.trim() || loading) return

    setQuery("")
    setLoading(true)

    const tempId = Date.now()
    setHistory(prev => [...prev, {
      id: tempId,
      user_query: textQuery,
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }])

    try {
      const res = await api.asistenteVirtual.brainChat(COMPANY_ID, {
        query: textQuery,
        user_name: userName,
        model_preference: model,
        generate_voice: true
      })

      setHistory(prev => [...prev, {
        id: Date.now(),
        user_query: textQuery,
        response: res.response,
        sql_executed: res.sql_executed,
        data_preview: res.data_preview,
        data_count: res.data_count,
        audio_base64: res.audio_base64,
        model_used: res.model_used,
        execution_time_seconds: res.execution_time_seconds,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])

      if (res.audio_base64) {
        playBase64Audio(res.audio_base64)
      }
    } catch (err: any) {
      setHistory(prev => [...prev, {
        id: Date.now(),
        response: `Ocurrió un inconveniente al consultar con Marco: ${err?.message || "Error de conexión con el nodo"}`,
        isUser: false,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    } finally {
      setLoading(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        stream.getTracks().forEach(t => t.stop())
        await handleSendVoice(audioBlob)
      }

      mediaRecorder.start()
      setRecording(true)
    } catch (e) {
      alert("Por favor habilitá el permiso de micrófono en tu navegador.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  const handleSendVoice = async (blob: Blob) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("audio", blob, "voice.webm")
      formData.append("user_name", userName)
      formData.append("model_preference", model)

      const res = await api.asistenteVirtual.brainVoice(formData)

      setHistory(prev => [
        ...prev,
        {
          id: Date.now() - 1,
          user_query: res.transcript || "(Mensaje de voz)",
          isUser: true,
          isVoice: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: Date.now(),
          user_query: res.transcript,
          response: res.response,
          sql_executed: res.sql_executed,
          data_preview: res.data_preview,
          data_count: res.data_count,
          audio_base64: res.audio_base64,
          model_used: res.model_used,
          execution_time_seconds: res.execution_time_seconds,
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])

      if (res.audio_base64) {
        playBase64Audio(res.audio_base64)
      }
    } catch (err: any) {
      setHistory(prev => [...prev, {
        id: Date.now(),
        response: `⚠️ Error de voz: ${err?.message || "No se pudo procesar el audio"}`,
        isUser: false,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    } finally {
      setLoading(false)
    }
  }

  // Context-aware suggestions depending on which page the user is viewing
  const getContextSuggestions = () => {
    const p = location.pathname
    if (p.includes("clientes") || p.includes("accounts-receivable") || p.includes("deudas")) {
      return [
        "¿Quiénes son los clientes con mayor deuda vencida?",
        "¿Cuáles son los últimos pagos registrados?",
        "¿Qué clientes superaron su límite de crédito?"
      ]
    }
    if (p.includes("products") || p.includes("inventory") || p.includes("deposito")) {
      return [
        "¿Qué productos tienen bajo stock en el depósito central?",
        "¿Cuáles son los 5 productos con mayor valor total en stock?",
        "¿Qué artículos no tuvieron movimientos en los últimos 30 días?"
      ]
    }
    if (p.includes("sales") || p.includes("distribuidora") || p.includes("pos")) {
      return [
        "¿Cuánto facturamos hoy y cuántas boletas se emitieron?",
        "¿Quién es el vendedor que más vendió este mes?",
        "¿Cuáles son los 3 productos más vendidos de la semana?"
      ]
    }
    if (p.includes("logistics") || p.includes("intelientregas") || p.includes("rutas")) {
      return [
        "¿Qué camiones tienen resumen de carga activo hoy?",
        "¿Cuáles son las rutas con más entregas pendientes?",
        "¿Quiénes son los choferes en reparto ahora mismo?"
      ]
    }
    return [
      "¿Cómo vienen las ventas y cobranzas de este mes?",
      "¿Qué alertas operativas o de stock tenemos para hoy?",
      "Mostrame los 5 clientes top de Casa Gonzalito"
    ]
  }

  return (
    <>
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Floating Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-full shadow-xl hover:shadow-indigo-500/25 transition-all duration-300 transform hover:scale-105 border border-white/20"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                🧠
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-indigo-700 animate-pulse"></span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold leading-tight">Marco IA</p>
              <p className="text-[10px] text-indigo-100/80 leading-none">Cerebro de la Empresa</p>
            </div>
          </button>
        </div>
      )}

      {/* Slide-out Copilot Modal / Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[95vw] sm:w-[460px] h-[640px] max-h-[90vh] bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-indigo-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-xl shadow-inner">
                🧠
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">Marco</h3>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-400/30 font-medium">
                    ● En línea (Minisforum)
                  </span>
                </div>
                <p className="text-[11px] text-indigo-200/80">Tu mano derecha en Casa Gonzalito</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Model toggle */}
              <button
                onClick={() => setModel(model === "qwen2.5:7b" ? "qwen2.5:14b" : "qwen2.5:7b")}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-indigo-200 font-medium transition"
                title="Cambiar modelo LLM"
              >
                {model === "qwen2.5:7b" ? "⚡ 7B Rápido" : "🧠 14B Profundo"}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70 dark:bg-gray-900/40">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl mb-3 shadow-sm">
                  🇵🇾
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">¡Qué tal kp! Soy Marco.</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Conozco todo lo que pasa en ventas, depósito, cobranzas y reparto. Preguntame lo que necesites o habláme por el micrófono.
                </p>

                <div className="mt-4 w-full text-left space-y-1.5">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sugerencias para esta pantalla:</p>
                  {getContextSuggestions().map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(sug)}
                      className="w-full text-xs text-left p-2.5 rounded-xl bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition flex items-center justify-between"
                    >
                      <span>{sug}</span>
                      <span className="text-indigo-500">→</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              history.map((msg, idx) => (
                <div key={idx} className={`flex gap-2.5 ${msg.isUser ? "justify-end" : "justify-start"}`}>
                  {!msg.isUser && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center text-xs font-bold">
                      M
                    </div>
                  )}

                  <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-sm ${
                    msg.isUser
                      ? "bg-indigo-600 text-white ml-6"
                      : msg.isError
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 mr-6"
                      : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-100 mr-6"
                  }`}>
                    {msg.isUser ? (
                      <div className="flex items-center gap-1.5">
                        {msg.isVoice && <Mic className="w-3 h-3 text-indigo-200" />}
                        <p>{msg.user_query}</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.response}</p>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
                          {msg.audio_base64 && (
                            <button
                              onClick={() => playBase64Audio(msg.audio_base64)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px] hover:bg-indigo-100"
                            >
                              <Volume2 className="w-3 h-3" /> Escuchar
                            </button>
                          )}
                          {msg.sql_executed && (
                            <button
                              onClick={() => setOpenSqlIdx(openSqlIdx === idx ? null : idx)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium text-[11px]"
                            >
                              <Database className="w-3 h-3 text-amber-500" /> SQL ({msg.data_count || 0})
                            </button>
                          )}
                          {msg.execution_time_seconds && (
                            <span className="text-[10px] text-gray-400 ml-auto">
                              {msg.execution_time_seconds}s
                            </span>
                          )}
                        </div>

                        {openSqlIdx === idx && msg.sql_executed && (
                          <div className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-[10px] overflow-x-auto border border-slate-800">
                            <code>{msg.sql_executed}</code>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.isUser && (
                    <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="flex gap-2 items-center">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs animate-pulse">
                  M
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-xs flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Marco está revisando la base de datos...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Footer Controls */}
          <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={loading && !recording}
                className={`p-3 rounded-2xl flex items-center justify-center transition shadow-sm ${
                  recording
                    ? "bg-red-600 text-white animate-bounce shadow-red-500/50"
                    : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
                }`}
                title={recording ? "Detener" : "Hablar con Marco"}
              >
                {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={recording ? "🎙️ Hablando a Marco..." : "Preguntale a Marco..."}
                disabled={loading || recording}
                className="flex-1 px-3.5 py-2.5 bg-slate-100 dark:bg-gray-900 border-none rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
              />

              <button
                onClick={() => handleSend()}
                disabled={!query.trim() || loading}
                className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl transition shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
