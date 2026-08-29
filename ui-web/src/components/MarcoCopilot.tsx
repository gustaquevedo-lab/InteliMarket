import { useState, useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import {
  Sparkles, Mic, MicOff, Send, X, Volume2, Database, Clock,
  Bot, User, ChevronDown, ChevronUp, Loader2, MessageSquare, Play, Pause, Check
} from "lucide-react"
import { api } from "../api/index"

import { useAuth } from "../context/AuthContext"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function MarcoCopilot() {
  const { user } = useAuth()
  const userName = user?.nombre || user?.email?.split("@")[0] || "Gustavo"
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [model, setModel] = useState("qwen2.5:7b")
  const [voice, setVoice] = useState(() => localStorage.getItem("marco_voice") || "es-AR-TomasNeural")
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioLevels, setAudioLevels] = useState<number[]>([12, 16, 8, 20, 14, 26, 18, 22, 15, 28, 12, 18, 10, 24, 16, 12])
  const [history, setHistory] = useState<any[]>([])
  const [openSqlIdx, setOpenSqlIdx] = useState<number | null>(null)
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null)

  const location = useLocation()
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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [history, loading])

  useEffect(() => {
    return () => {
      cleanupRecording()
    }
  }, [])

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
        console.warn("Web Audio Visualizer setup fallback:", audioErr)
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
        await handleSendVoice(audioBlob, localAudioUrl)
      }

      mediaRecorder.start(100)
      setRecording(true)
    } catch (e) {
      alert("Por favor habilitá el permiso de micrófono en tu navegador.")
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

  const handleSendVoice = async (blob: Blob, localAudioUrl: string) => {
    setLoading(true)
    const userMsgId = Date.now() - 1
    try {
      const formData = new FormData()
      formData.append("audio", blob, "voice.webm")
      formData.append("user_name", userName)
      formData.append("voice_preference", voice)
      formData.append("model_preference", model)

      const res = await api.asistenteVirtual.brainVoice(formData)
      const botMsgId = Date.now()

      setHistory(prev => [
        ...prev,
        {
          id: userMsgId,
          user_query: res.transcript || "(Mensaje de voz)",
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
        response: `⚠️ Error de voz: ${err?.message || "No se pudo procesar el audio"}`,
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

  const getContextSuggestions = () => {
    const p = location.pathname
    if (p.includes("clientes") || p.includes("accounts-receivable") || p.includes("deudas")) {
      return ["¿Quiénes son los clientes con mayor deuda vencida?", "¿Cuáles son los últimos pagos registrados?", "¿Qué clientes superaron su límite de crédito?"]
    }
    if (p.includes("products") || p.includes("inventory") || p.includes("deposito")) {
      return ["¿Qué productos tienen bajo stock en el depósito central?", "¿Cuáles son los 5 productos con mayor valor total en stock?", "¿Qué artículos no tuvieron movimientos en los últimos 30 días?"]
    }
    if (p.includes("sales") || p.includes("distribuidora") || p.includes("pos")) {
      return ["¿Cuánto facturamos hoy y cuántas boletas se emitieron?", "¿Quién es el vendedor que más vendió este mes?", "¿Cuáles son los 3 productos más vendidos de la semana?"]
    }
    if (p.includes("logistics") || p.includes("intelientregas") || p.includes("rutas")) {
      return ["¿Qué camiones tienen resumen de carga activo hoy?", "¿Cuáles son las rutas con más entregas pendientes?", "¿Quiénes son los choferes en reparto ahora mismo?"]
    }
    return ["¿Cómo vienen las ventas y cobranzas de este mes?", "¿Qué alertas operativas o de stock tenemos para hoy?", "Mostrame los 5 clientes top de Casa Gonzalito"]
  }

  return (
    <>
      <audio ref={audioPlayerRef} className="hidden" />

      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-full shadow-xl hover:shadow-indigo-500/25 transition-all duration-300 transform hover:scale-105 border border-white/20"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">🧠</div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-indigo-700 animate-pulse"></span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold leading-tight">Marco IA</p>
              <p className="text-[10px] text-indigo-100/80 leading-none">Cerebro de la Empresa</p>
            </div>
          </button>
        </div>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[95vw] sm:w-[460px] h-[640px] max-h-[85vh] bg-white dark:bg-gray-850 rounded-3xl shadow-2xl border border-gray-200/80 dark:border-gray-700/80 flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-lg border border-white/20 shadow-inner">🧠</div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-indigo-700 rounded-full"></span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm leading-tight">Marco</h3>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium tracking-wide">Casa Gonzalito</span>
                </div>
                <p className="text-[11px] text-indigo-100/90 font-medium">Asesor Operativo Inteligente</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={voice}
                onChange={e => handleVoiceChange(e.target.value)}
                className="bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium rounded-xl px-2 py-1 outline-none border border-white/20 cursor-pointer transition"
                title="Voz de Marco"
              >
                <option value="es-AR-TomasNeural" className="text-gray-900">🇦🇷 Tomás (Neural)</option>
                <option value="es-PY-MarioNeural" className="text-gray-900">🇵🇾 Mario (Paraguay)</option>
                <option value="es-PY-TaniaNeural" className="text-gray-900">🇵🇾 Tania (Paraguay)</option>
              </select>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-xl transition text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-gray-900/50">
            {history.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center p-4">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1">¡Hola, {userName}! Soy Marco</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-6">Tu copiloto ejecutivo conectado en tiempo real a la base de datos de Casa Gonzalito.</p>
                <div className="w-full space-y-2 text-left">
                  <p className="text-[10px] font-black tracking-wider text-gray-400 uppercase px-1">Sugerencias para esta pantalla:</p>
                  {getContextSuggestions().map((s, idx) => (
                    <button key={idx} onClick={() => handleSend(s)} className="w-full text-left p-2.5 bg-white dark:bg-gray-800 hover:bg-indigo-50/60 dark:hover:bg-gray-700/60 rounded-xl border border-gray-200/70 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-200 transition shadow-sm flex items-center justify-between group">
                      <span>{s}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600 -rotate-90 transition" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              history.map((msg, idx) => (
                <div key={msg.id || idx} className={`flex gap-2.5 ${msg.isUser ? "justify-end" : "justify-start"}`}>
                  {!msg.isUser && (
                    <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm">🧠</div>
                  )}
                  <div className={`max-w-[85%] space-y-2`}>
                    <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.isUser ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-tr-none font-medium" : msg.isError ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 rounded-tl-none" : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200/80 dark:border-gray-700/80 rounded-tl-none"}`}>
                      {msg.isUser && msg.userAudioUrl && (
                        <div className="flex items-center gap-2 mb-2 p-2 bg-white/15 rounded-xl border border-white/20 backdrop-blur-sm">
                          <button onClick={() => playAudioUrl(msg.userAudioUrl, msg.id)} className="w-7 h-7 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow hover:scale-105 transition" title="Reproducir audio grabado">
                            {playingAudioId === msg.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                          </button>
                          <div className="flex items-center gap-0.5 flex-1"><span className="text-[10px] text-white/90 font-bold">🎙️ Tu mensaje de voz</span></div>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.response || msg.user_query}</div>
                      {!msg.isUser && msg.audio_base64 && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between gap-3">
                          <button onClick={() => playBase64Audio(msg.audio_base64, msg.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${playingAudioId === msg.id ? "bg-emerald-600 text-white animate-pulse" : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100"}`}>
                            {playingAudioId === msg.id ? <><Pause className="w-3.5 h-3.5" /><span>Reproduciendo...</span></> : <><Volume2 className="w-3.5 h-3.5" /><span>Escuchar voz</span></>}
                          </button>
                          {msg.execution_time_seconds && <span className="text-[10px] text-gray-400 font-mono">⚡ {msg.execution_time_seconds}s</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  {msg.isUser && (
                    <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="flex gap-2 items-center">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs animate-pulse">🧠</div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 text-xs flex items-center gap-2.5 text-gray-600 dark:text-gray-300 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Marco está analizando los datos en tiempo real...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 bg-white dark:bg-gray-850 border-t border-gray-200/80 dark:border-gray-700/80">
            {recording ? (
              <div className="flex items-center justify-between gap-3 p-2.5 bg-gradient-to-r from-red-50 via-rose-50 to-pink-50 dark:from-red-950/30 dark:via-rose-950/20 dark:to-slate-850 border-2 border-red-500/40 rounded-2xl animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                  </span>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 block leading-none">Grabando</span>
                    <span className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200">{formatTimer(recordingSeconds)}</span>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center gap-1 h-9 px-2 overflow-hidden">
                  {audioLevels.map((h, i) => (
                    <div key={i} className="w-1.5 rounded-full bg-gradient-to-t from-red-600 via-rose-500 to-amber-400 transition-all duration-75" style={{ height: `${h}px` }} />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={cancelRecording} className="p-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition shadow-sm" title="Cancelar grabación"><X className="w-4 h-4" /></button>
                  <button onClick={stopRecording} className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-600/30 active:scale-95" title="Finalizar y Enviar a Marco"><Check className="w-4 h-4" /><span className="hidden sm:inline">Enviar</span></button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={startRecording} disabled={loading} className="p-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 rounded-2xl flex items-center justify-center transition shadow-sm border border-indigo-200/50 dark:border-indigo-800/50 hover:scale-105 active:scale-95" title="Hablar por micrófono con Marco"><Mic className="w-4 h-4" /></button>
                <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Escribí o hablá con Marco..." disabled={loading} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                <button onClick={() => handleSend()} disabled={!query.trim() || loading} className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-2xl transition shadow-md shadow-indigo-600/20 active:scale-95" title="Enviar consulta"><Send className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
