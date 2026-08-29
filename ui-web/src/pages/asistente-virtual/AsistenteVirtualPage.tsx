import { useState, useEffect, useRef } from "react"
import {
  BarChart3, MessageCircle, Ticket, BrainCircuit, Send, Plus, Search, Loader2,
  Zap, CheckCircle, XCircle, Clock, RefreshCcw, Bot, User, ThumbsUp, ThumbsDown,
  Star, Phone, Mail, ArrowLeft, Settings, Activity, Mic, MicOff, Volume2, Database,
  Sparkles, Terminal, Play, Cpu, HardDrive, ShieldCheck
} from "lucide-react"
import { api } from "../../api/index"
import { useAuth } from "../../context/AuthContext"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function AsistenteVirtualPage() {
  const [tab, setTab] = useState("brain")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marco — El Cerebro de Casa Gonzalito</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Minisforum Local
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Compañero y mano derecha inteligente para todos los sectores: Ventas, Depósito, Cobranzas, Reparto y Compras.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "brain",          label: "🧠 Hablar con Marco (Voz & SQL)", icon: Sparkles },
            { key: "dashboard",      label: "Dashboard Operativo",             icon: BarChart3 },
            { key: "chat",           label: "Chat Clientes",       icon: MessageCircle },
            { key: "conversaciones", label: "Historial Conversaciones", icon: Activity },
            { key: "tickets",        label: "Tickets Soporte",     icon: Ticket },
            { key: "configuracion",  label: "Configuración",       icon: Settings },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "brain"          && <BrainTab />}
      {tab === "dashboard"      && <DashboardTab />}
      {tab === "chat"           && <ChatTab />}
      {tab === "conversaciones" && <ConversacionesTab />}
      {tab === "tickets"        && <TicketsTab />}
      {tab === "configuracion"  && <ConfigTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

// ===== 🧠 CEREBRO IA & VOZ TAB =====

function BrainTab() {
  const { user } = useAuth()
  const userName = user?.nombre || user?.email?.split("@")[0] || "Gustavo"
  const [query, setQuery] = useState("")
  const [model, setModel] = useState("qwen2.5:7b")
  const [voice, setVoice] = useState(() => localStorage.getItem("marco_voice") || "es-AR-TomasNeural")
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioLevels, setAudioLevels] = useState<number[]>([12, 16, 8, 20, 14, 26, 18, 22, 15, 28, 12, 18, 10, 24, 16, 12])
  const [status, setStatus] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [openSqlIdx, setOpenSqlIdx] = useState<number | null>(null)
  const [openDataIdx, setOpenDataIdx] = useState<number | null>(null)
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const isCancelledRef = useRef<boolean>(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    loadStatus()
    return () => {
      cleanupRecording()
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [history, loading])

  const cleanupRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try { audioContextRef.current.close() } catch (e) {}
      audioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
  }

  const loadStatus = () => {
    api.asistenteVirtual.brainStatus(COMPANY_ID)
      .then(setStatus)
      .catch((err) => console.error("Error loading brain status", err))
  }

  const handleVoiceChange = (v: string) => {
    setVoice(v)
    localStorage.setItem("marco_voice", v)
  }

  const playAudioUrl = (url: string, id: number) => {
    if (!url) return
    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = url
        audioPlayerRef.current.play()
        setPlayingAudioId(id)
        audioPlayerRef.current.onended = () => setPlayingAudioId(null)
        audioPlayerRef.current.onpause = () => setPlayingAudioId(null)
      } else {
        const audio = new Audio(url)
        setPlayingAudioId(id)
        audio.onended = () => setPlayingAudioId(null)
        audio.play()
      }
    } catch (e) {
      console.error("Error playing audio", e)
      setPlayingAudioId(null)
    }
  }

  const playBase64Audio = (base64Audio: string, id?: number) => {
    if (!base64Audio) return
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`
    playAudioUrl(audioUrl, id || Date.now())
  }

  const handleSendQuery = async (textToSend?: string) => {
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
        voice_preference: voice,
        model_preference: model,
        generate_voice: true
      })

      const botMsgId = Date.now()
      setHistory(prev => [...prev, {
        id: botMsgId,
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
        playBase64Audio(res.audio_base64, botMsgId)
      }
    } catch (err: any) {
      setHistory(prev => [...prev, {
        id: Date.now(),
        response: `⚠️ Ocurrió un error al consultar el Cerebro de IA: ${err?.message || "Error de conexión con el servidor"}`,
        isUser: false,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    } finally {
      setLoading(false)
    }
  }

  // Voice recording handlers with Web Audio API Live Equalizer
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      audioChunksRef.current = []
      isCancelledRef.current = false
      setRecordingSeconds(0)

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1)
      }, 1000)

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        const ctx = new AudioCtx()
        audioContextRef.current = ctx
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 64
        analyser.smoothingTimeConstant = 0.5
        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const updateBars = () => {
          if (!analyser) return
          analyser.getByteFrequencyData(dataArray)
          const bars: number[] = []
          const barCount = 16
          const step = Math.max(1, Math.floor(bufferLength / barCount))
          for (let i = 0; i < barCount; i++) {
            const val = dataArray[i * step] || 0
            const h = Math.max(6, Math.min(38, Math.round((val / 255) * 38)))
            bars.push(h)
          }
          setAudioLevels(bars)
          animFrameRef.current = requestAnimationFrame(updateBars)
        }
        updateBars()
      } catch (audioErr) {
        console.warn("Web Audio Visualizer fallback:", audioErr)
      }

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        cleanupRecording()
        if (isCancelledRef.current) {
          setRecording(false)
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const localAudioUrl = URL.createObjectURL(audioBlob)
        setRecording(false)
        await handleSendVoiceAudio(audioBlob, localAudioUrl)
      }

      mediaRecorder.start(100)
      setRecording(true)
    } catch (err) {
      alert("No se pudo acceder al micrófono. Por favor permití el acceso en tu navegador.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      isCancelledRef.current = false
      mediaRecorderRef.current.stop()
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && recording) {
      isCancelledRef.current = true
      mediaRecorderRef.current.stop()
      setRecording(false)
      cleanupRecording()
    }
  }

  const handleSendVoiceAudio = async (audioBlob: Blob, localAudioUrl: string) => {
    setLoading(true)
    const userMsgId = Date.now() - 1

    try {
      const formData = new FormData()
      formData.append("audio", audioBlob, "voice_input.webm")
      formData.append("user_name", userName)
      formData.append("voice_preference", voice)
      formData.append("model_preference", model)

      const res = await api.asistenteVirtual.brainVoice(formData)
      const botMsgId = Date.now()

      setHistory(prev => [
        ...prev,
        {
          id: userMsgId,
          user_query: res.transcript || "(Audio de voz)",
          userAudioUrl: localAudioUrl,
          isUser: true,
          isVoice: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: botMsgId,
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
        playBase64Audio(res.audio_base64, botMsgId)
      }
    } catch (err: any) {
      setHistory(prev => [...prev, {
        id: Date.now(),
        response: `⚠️ Error al procesar audio de voz: ${err?.message || "Error"}`,
        isUser: false,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    } finally {
      setLoading(false)
    }
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const SUGGESTIONS = [
    "¿Cuáles son los 5 clientes con mayor crédito o deuda?",
    "¿Qué productos tenemos registrados en el catálogo?",
    "¿Cuáles son las últimas 5 ventas registradas?",
    "¿Quiénes son los vendedores con más operaciones?",
  ]

  return (
    <div className="space-y-6">
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Hardware & Engine Live Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-md border border-indigo-900/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">Nodo Local Minisforum (AMD Ryzen 7 + AVX-512)</h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/40">
                  {status?.ollama_connected ? "● Ollama Online" : "Desconectado"}
                </span>
              </div>
              <p className="text-xs text-indigo-200/70 mt-0.5">
                Modelos disponibles: {status?.models_available?.join(", ") || "qwen2.5:14b, qwen2.5:7b"} • Motor Voz: Faster-Whisper + Neural TTS
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Voice / Accent Selector */}
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <Volume2 className="w-4 h-4 text-indigo-300" />
              <span className="text-indigo-200 font-medium hidden sm:inline">Voz:</span>
              <select
                value={voice}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="es-AR-TomasNeural" className="bg-gray-900 text-white">🇦🇷 Tomás (Rioplatense / Natural)</option>
                <option value="es-UY-MateoNeural" className="bg-gray-900 text-white">🇺🇾 Mateo (Rioplatense / Ejecutivo)</option>
                <option value="es-PY-MarioNeural" className="bg-gray-900 text-white">🇵🇾 Mario (Paraguayo)</option>
                <option value="es-MX-JorgeNeural" className="bg-gray-900 text-white">🇲🇽 Jorge (Neutro Latino)</option>
                <option value="es-CL-LorenzoNeural" className="bg-gray-900 text-white">🇨🇱 Lorenzo (Andino Claro)</option>
              </select>
            </div>

            {/* Model Switcher */}
            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setModel("qwen2.5:14b")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  model === "qwen2.5:14b"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                🧠 Qwen 2.5 (14B)
              </button>
              <button
                onClick={() => setModel("qwen2.5:7b")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  model === "qwen2.5:7b"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                ⚡ Qwen 2.5 (7B)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Conversation & Voice Arena */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[650px]">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-gray-900/30">
          {history.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hablá o escribile al Cerebro de Casa Gonzalito</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Conectado directamente a la base de datos PostgreSQL con 14 años de historial. Podés preguntar sobre clientes, ventas, deudas, stock o pedir análisis ejecutivos.
              </p>

              <div className="grid grid-cols-1 gap-2 mt-6 w-full text-left">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Consultas sugeridas:</p>
                {SUGGESTIONS.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendQuery(sug)}
                    className="text-xs bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition text-left flex items-center justify-between group"
                  >
                    <span>{sug}</span>
                    <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition">→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            history.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.isUser ? "justify-end" : "justify-start"}`}>
                {!msg.isUser && (
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center shadow-sm">
                    <Bot className="w-5 h-5" />
                  </div>
                )}

                <div className={`max-w-2xl rounded-2xl p-4 shadow-sm ${
                  msg.isUser
                    ? "bg-indigo-600 text-white ml-12"
                    : msg.isError
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                    : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-100 mr-12"
                }`}>
                  {msg.isUser ? (
                    <div>
                      {msg.userAudioUrl && (
                        <div className="flex items-center gap-2 mb-2 p-2 bg-white/20 rounded-xl border border-white/20 backdrop-blur-sm">
                          <button
                            onClick={() => playAudioUrl(msg.userAudioUrl, msg.id)}
                            className="w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow hover:scale-105 transition"
                            title="Reproducir audio grabado"
                          >
                            {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>
                          <div className="flex items-center gap-1 flex-1">
                            <Mic className="w-3.5 h-3.5 text-white/90" />
                            <span className="text-xs text-white font-bold">Tu mensaje de voz</span>
                          </div>
                        </div>
                      )}
                      <p className="text-sm">{msg.user_query}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.response}</p>

                      {/* Audio Controls & Metadata Badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        {msg.audio_base64 && (
                          <button
                            onClick={() => playBase64Audio(msg.audio_base64, msg.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                              playingAudioId === msg.id
                                ? "bg-emerald-600 text-white animate-pulse"
                                : "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
                            }`}
                          >
                            {playingAudioId === msg.id ? (
                              <>
                                <Pause className="w-3.5 h-3.5" />
                                <span>Reproduciendo...</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Escuchar Voz</span>
                              </>
                            )}
                          </button>
                        )}

                        {msg.sql_executed && (
                          <button
                            onClick={() => setOpenSqlIdx(openSqlIdx === idx ? null : idx)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-slate-200 transition"
                          >
                            <Database className="w-3.5 h-3.5 text-amber-500" /> SQL Postgres
                          </button>
                        )}

                        {msg.data_preview && msg.data_preview.length > 0 && (
                          <button
                            onClick={() => setOpenDataIdx(openDataIdx === idx ? null : idx)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-slate-200 transition"
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-blue-500" /> {msg.data_count} filas obtenidas
                          </button>
                        )}

                        {msg.execution_time_seconds && (
                          <span className="text-[11px] text-gray-400 ml-auto flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {msg.execution_time_seconds}s ({msg.model_used})
                          </span>
                        )}
                      </div>

                      {/* Collapsible SQL Query */}
                      {openSqlIdx === idx && msg.sql_executed && (
                        <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800 animate-fade-in">
                          <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1 font-sans">
                            <span>CONSULTA EJECUTADA EN POSTGRESQL</span>
                            <span className="text-emerald-500">Read-Only Safe</span>
                          </div>
                          <code>{msg.sql_executed}</code>
                        </div>
                      )}

                      {/* Collapsible Data Preview */}
                      {openDataIdx === idx && msg.data_preview && (
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-2 overflow-x-auto text-xs animate-fade-in">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                            <thead>
                              <tr>
                                {Object.keys(msg.data_preview[0] || {}).map((col) => (
                                  <th key={col} className="px-2 py-1 text-left font-semibold text-gray-500 uppercase text-[10px]">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {msg.data_preview.map((row: any, rIdx: number) => (
                                <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  {Object.values(row).map((val: any, cIdx: number) => (
                                    <td key={cIdx} className="px-2 py-1 text-gray-700 dark:text-gray-300">
                                      {String(val ?? "—")}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {msg.isUser && (
                  <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3 items-center">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center animate-pulse">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <Spinner />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {recording ? "Escuchando voz..." : "El Cerebro está consultando PostgreSQL y procesando la respuesta con voz..."}
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input & Voice Controls Bar */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          {recording ? (
            /* LIVE VOICE RECORDING PANEL */
            <div className="flex items-center justify-between gap-4 p-3 bg-gradient-to-r from-red-50 via-rose-50 to-pink-50 dark:from-red-950/30 dark:via-rose-950/20 dark:to-slate-850 border-2 border-red-500/40 rounded-2xl animate-in fade-in duration-200">
              {/* Status & Timer */}
              <div className="flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
                </span>
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 block leading-none">
                    Grabando Audio
                  </span>
                  <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">
                    {formatTimer(recordingSeconds)}
                  </span>
                </div>
              </div>

              {/* Real-time Web Audio Waveform Equalizer */}
              <div className="flex-1 flex items-center justify-center gap-1.5 h-10 px-4 overflow-hidden">
                {audioLevels.map((h, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-full bg-gradient-to-t from-red-600 via-rose-500 to-amber-400 transition-all duration-75"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>

              {/* Cancel and Send Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelRecording}
                  className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-medium text-xs transition shadow-sm flex items-center gap-1.5"
                  title="Cancelar grabación"
                >
                  <X className="w-4 h-4" />
                  <span>Cancelar</span>
                </button>

                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-600/30 active:scale-95"
                  title="Finalizar y Enviar a Marco"
                >
                  <Check className="w-4 h-4" />
                  <span>Enviar Audio</span>
                </button>
              </div>
            </div>
          ) : (
            /* STANDARD INPUT CONTROLS */
            <div className="flex items-center gap-2">
              <button
                onClick={startRecording}
                disabled={loading}
                className="p-3.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center transition shadow-sm border border-indigo-200/50 dark:border-indigo-800/50 hover:scale-105 active:scale-95"
                title="Hablar por micrófono con Marco"
              >
                <Mic className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendQuery()
                  }
                }}
                placeholder="Escribí tu consulta o hablá por el micrófono..."
                disabled={loading}
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-700/60 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />

              <button
                onClick={() => handleSendQuery()}
                disabled={!query.trim() || loading}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition flex items-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95"
              >
                <Send className="w-4 h-4" /> Enviar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
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
            </div>
            <button onClick={clearChat} className="text-xs text-gray-500 hover:text-gray-700">Nueva conversación</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Bot className="w-12 h-12 mb-2" />
                <p className="text-sm">Iniciá una conversación con el asistente virtual</p>
              </div>
            )}
            {messages.map((m: any) => (
              <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm ${m.sender === "user" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"}`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <div className="flex items-center justify-between mt-1 text-[10px] opacity-70">
                    <span>{m.intent_detected && <IntentBadge intent={m.intent_detected} />}</span>
                    <span>{m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""}</span>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-3.5 py-2.5"><Spinner /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu mensaje..."
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button onClick={send} disabled={loading || !message.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Contexto del Cliente</h3>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500">Nombre</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                className="w-full text-xs rounded border border-gray-200 dark:border-gray-600 bg-transparent p-1.5 mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">ID Cliente</label>
              <input type="text" value={customerId} onChange={e => setCustomerId(e.target.value)}
                className="w-full text-xs rounded border border-gray-200 dark:border-gray-600 bg-transparent p-1.5 mt-0.5 font-mono" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== CONVERSACIONES =====

function ConversacionesTab() {
  const [conv, setConv] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    api.asistenteVirtual.listConversations(COMPANY_ID).then(setConv).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const selectConv = async (c: any) => {
    setSelected(c)
    try {
      const msgs = await api.asistenteVirtual.getMessages(COMPANY_ID, c.id)
      setMessages(msgs)
    } catch {}
  }

  const closeConv = async (id: string) => {
    try {
      await api.asistenteVirtual.endConversation(COMPANY_ID, id, false)
      setConv(prev => prev.map(c => c.id === id ? { ...c, status: "closed" } : c))
      if (selected?.id === id) setSelected((prev: any) => ({ ...prev, status: "closed" }))
    } catch {}
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Conversaciones</h3>
        {conv.length === 0 ? <p className="text-xs text-gray-400">Sin conversaciones</p> : (
          <div className="space-y-2">
            {conv.map((c: any) => (
              <div key={c.id} onClick={() => selectConv(c)}
                className={`p-3 rounded-lg border cursor-pointer transition text-xs ${selected?.id === c.id ? "border-blue-500 bg-blue-50/50" : "border-gray-100 hover:bg-gray-50"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{c.customer_name || "Anónimo"}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                </div>
                <div className="flex items-center justify-between text-gray-400 text-[10px]">
                  <span>{c.channel}</span>
                  <span>{c.total_messages} msgs</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        {selected ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <div>
                <h4 className="text-sm font-semibold">{selected.customer_name || "Anónimo"}</h4>
                <p className="text-xs text-gray-400">{selected.id}</p>
              </div>
              {selected.status === "active" && (
                <button onClick={() => closeConv(selected.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs">Cerrar</button>
              )}
            </div>
            <div className="space-y-2 max-h-[450px] overflow-y-auto">
              {messages.map((m: any) => (
                <div key={m.id} className={`p-2.5 rounded text-xs ${m.sender === "user" ? "bg-blue-50 text-blue-900 ml-4" : "bg-gray-50 text-gray-900 mr-4"}`}>
                  <p className="font-semibold text-[10px] text-gray-500 mb-0.5">{m.sender}</p>
                  <p>{m.content}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400 text-xs">Seleccioná una conversación</div>
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
    catch {}
  }

  const priorityColor = (p: string) => ({
    urgent: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-gray-100 text-gray-600",
  }[p] || "bg-gray-100 text-gray-600")

  return (
    <div className="space-y-4">
      {loading ? <Spinner /> : tickets.length === 0
        ? <p className="text-xs text-gray-400">Sin tickets de reclamo registrados.</p>
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
