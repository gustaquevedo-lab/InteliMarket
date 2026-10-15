import { useState, useEffect } from "react"
import {
  api,
  type WhatsAppAITrainingExample,
  type AITrainingSimulateResponse,
  type AIQAResult,
  type WatchdogStatus,
} from "../../../api"
import { useToast } from "../../../context/ToastContext"
import { Modal } from "../../../components/Modal"
import {
  Sparkles, Bot, ShieldCheck, Zap, RefreshCw, Play, Send, Plus,
  Trash2, Edit, CheckCircle2, XCircle, Clock, AlertTriangle, FileText,
  Download, Eye, Terminal, Layers, ShieldAlert, Cpu, Check,
  CornerDownRight, Info
} from "lucide-react"

interface ChatMessage {
  id: string
  sender: "user" | "bot"
  text: string
  timestamp: string
  latency_ms?: number
  tools_called?: string[]
  tools_trace?: Array<{ tool: string; input: any; output_preview: string; latency_ms?: number }>
  pdf_base64?: string
  pdf_filename?: string
  order_code?: string
  guardrails_passed?: boolean
}

const PERSONAS = [
  { id: "paraguay", label: "🇵🇾 Paraguay (PYG)", desc: "Cliente habitual en guaraníes, consultas locales de góndola y precios" },
  { id: "brasil", label: "🇧🇷 Brasil (Frontera)", desc: "Comprador de Ponta Porã / Mato Grosso do Sul, consultas en portugués y PIX" },
  { id: "extraclub", label: "🌟 ExtraClub VIP", desc: "Cliente fidelizado, consulta de puntos y promociones de socio" },
  { id: "reclamante", label: "⚠️ Reclamante", desc: "Cliente con quejas de producto o seguimiento de pedidos" },
]

const QUICK_PROMPTS = [
  "¿Tienen arroz en stock y cuánto cuesta la bolsa?",
  "Quiero encargar 5 bolsas de arroz y 2 paquetes de fideos para retirar hoy",
  "¿Hasta qué hora atienden hoy?",
  "¿Cuál es el RUC y los datos de banco para transferir?",
  "Olá, onde fica o supermercado e aceitam PIX?",
]

const CATEGORIES = [
  { id: "general", label: "General & Saludos" },
  { id: "catalogo", label: "Catálogo & Stock" },
  { id: "pedidos", label: "Pedidos & Presupuestos" },
  { id: "fiscal", label: "Datos Fiscales & Banco" },
  { id: "frontera", label: "Frontera & Idiomas" },
  { id: "quejas", label: "Reclamos & Soporte" },
]

export function AITrainingLab() {
  const toast = useToast()
  const showToast = (msg: string, type: "success" | "error" | "info" | "warning" = "info") => {
    if (type === "success") toast.success(msg)
    else if (type === "error") toast.error(msg)
    else if (type === "warning") toast.warning(msg)
    else toast.info(msg)
  }

  // Estados de telemetría y supervisor
  const [gatewayStatus, setGatewayStatus] = useState<{ connected: boolean; state: string } | null>(null)
  const [watchdogStatus, setWatchdogStatus] = useState<WatchdogStatus | null>(null)
  const [ollamaStatus, setOllamaStatus] = useState<{ online: boolean; host: string; active_model?: string } | null>(null)
  const [loadingStatuses, setLoadingStatuses] = useState(false)
  const [hardeningGateway, setHardeningGateway] = useState(false)

  // Estados del Simulador
  const [selectedPersona, setSelectedPersona] = useState("paraguay")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "👋 ¡Hola! Soy ExtraBot IA en modo laboratorio. Seleccioná una persona o escribime una consulta para probar mi razonamiento y herramientas en tiempo real.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ])
  const [inputText, setInputText] = useState("")
  const [simulating, setSimulating] = useState(false)
  const [lastTelemetry, setLastTelemetry] = useState<AITrainingSimulateResponse | null>(null)

  // Visor de PDF
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null)
  const [activePdfName, setActivePdfName] = useState<string>("")

  // Batería QA
  const [qaModalOpen, setQaModalOpen] = useState(false)
  const [qaRunning, setQaRunning] = useState(false)
  const [qaResult, setQaResult] = useState<AIQAResult | null>(null)

  // Gestor de Ejemplos de Entrenamiento (Few-Shots)
  const [examples, setExamples] = useState<WhatsAppAITrainingExample[]>([])
  const [loadingExamples, setLoadingExamples] = useState(false)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("todas")
  const [exampleModalOpen, setExampleModalOpen] = useState(false)
  const [editingExample, setEditingExample] = useState<Partial<WhatsAppAITrainingExample> | null>(null)
  const [savingExample, setSavingExample] = useState(false)

  // Cargar datos al montar
  useEffect(() => {
    loadStatuses()
    loadExamples()
  }, [])

  const loadStatuses = async () => {
    setLoadingStatuses(true)
    try {
      const [gw, wd, ol] = await Promise.allSettled([
        api.whatsapp.getStatus(),
        api.whatsapp.getWatchdogStatus(),
        api.whatsapp.getAiAgentStatus(),
      ])
      if (gw.status === "fulfilled") setGatewayStatus(gw.value)
      if (wd.status === "fulfilled") setWatchdogStatus(wd.value)
      if (ol.status === "fulfilled") setOllamaStatus(ol.value)
    } catch (e) {
      console.error("Error cargando estados:", e)
    } finally {
      setLoadingStatuses(false)
    }
  }

  const loadExamples = async () => {
    setLoadingExamples(true)
    try {
      const list = await api.whatsapp.listTrainingExamples()
      setExamples(list)
    } catch (e: any) {
      showToast(e?.message || "Error al cargar directivas de entrenamiento", "error")
    } finally {
      setLoadingExamples(false)
    }
  }

  const handleHardenGateway = async () => {
    setHardeningGateway(true)
    try {
      await api.whatsapp.hardenGatewaySettings()
      showToast("Configuraciones de robustez aplicadas con éxito en Evolution API", "success")
      await loadStatuses()
    } catch (e: any) {
      showToast(e?.message || "Error al aplicar configuraciones de robustez", "error")
    } finally {
      setHardeningGateway(false)
    }
  }

  const handleTriggerWatchdog = async () => {
    try {
      const res = await api.whatsapp.triggerWatchdog()
      setWatchdogStatus(res)
      showToast("Comprobación de Watchdog ejecutada con éxito", "success")
    } catch (e: any) {
      showToast(e?.message || "Error al disparar Watchdog", "error")
    }
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim()
    if (!text || simulating) return

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText("")
    setSimulating(true)

    try {
      const res = await api.whatsapp.simulateAI({
        message: text,
        persona: selectedPersona,
      })

      setLastTelemetry(res)

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: res.text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        latency_ms: res.latency_ms,
        tools_called: res.tools_called,
        tools_trace: res.tools_trace,
        pdf_base64: res.pdf_base64,
        pdf_filename: res.pdf_filename,
        order_code: res.order_code,
        guardrails_passed: res.guardrails_passed,
      }

      setMessages((prev) => [...prev, botMsg])
    } catch (e: any) {
      showToast(e?.message || "Error al obtener respuesta de la IA", "error")
    } finally {
      setSimulating(false)
    }
  }

  const handleOpenPdf = (base64: string, filename: string) => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    setActivePdfUrl(url)
    setActivePdfName(filename)
    setPdfModalOpen(true)
  }

  const handleRunQATests = async () => {
    setQaModalOpen(true)
    setQaRunning(true)
    setQaResult(null)
    try {
      const res = await api.whatsapp.runQATests()
      setQaResult(res)
      if (res.all_passed) {
        showToast("¡Batería de pruebas aprobada al 100%!", "success")
      } else {
        showToast(`Batería completada: ${res.passed}/${res.total} escenarios superados`, "info")
      }
    } catch (e: any) {
      showToast(e?.message || "Error al ejecutar la batería QA", "error")
    } finally {
      setQaRunning(false)
    }
  }

  // Guardar / editar ejemplo de entrenamiento
  const handleSaveExample = async () => {
    if (!editingExample?.mensaje_usuario?.trim() || !editingExample?.respuesta_ideal?.trim()) {
      showToast("El mensaje del usuario y la respuesta ideal son obligatorios", "error")
      return
    }

    setSavingExample(true)
    try {
      if (editingExample.id) {
        await api.whatsapp.updateTrainingExample(editingExample.id, editingExample)
        showToast("Ejemplo de entrenamiento actualizado", "success")
      } else {
        await api.whatsapp.createTrainingExample({
          ...editingExample,
          categoria: editingExample.categoria || "general",
          activo: editingExample.activo ?? true,
          origen: editingExample.origen || "manual",
        })
        showToast("Nuevo ejemplo de entrenamiento registrado", "success")
      }
      setExampleModalOpen(false)
      setEditingExample(null)
      await loadExamples()
    } catch (e: any) {
      showToast(e?.message || "Error al guardar ejemplo", "error")
    } finally {
      setSavingExample(false)
    }
  }

  const handleDeleteExample = async (id: string) => {
    if (!confirm("¿Deseas eliminar este ejemplo de entrenamiento?")) return
    try {
      await api.whatsapp.deleteTrainingExample(id)
      showToast("Ejemplo eliminado con éxito", "success")
      await loadExamples()
    } catch (e: any) {
      showToast(e?.message || "Error al eliminar ejemplo", "error")
    }
  }

  const handleToggleExampleActive = async (example: WhatsAppAITrainingExample) => {
    try {
      await api.whatsapp.updateTrainingExample(example.id, { activo: !example.activo })
      setExamples((prev) =>
        prev.map((ex) => (ex.id === example.id ? { ...ex, activo: !ex.activo } : ex))
      )
      showToast(`Ejemplo ${!example.activo ? "activado" : "desactivado"}`, "info")
    } catch (e: any) {
      showToast(e?.message || "Error al actualizar estado", "error")
    }
  }

  // Adiestrar desde mensaje del simulador
  const handleTrainFromSimulator = (botMsg: ChatMessage) => {
    // Buscar mensaje de usuario anterior
    const botIdx = messages.findIndex((m) => m.id === botMsg.id)
    const prevUserMsg = botIdx > 0 ? messages[botIdx - 1]?.text : ""

    setEditingExample({
      mensaje_usuario: prevUserMsg,
      respuesta_ideal: botMsg.text,
      categoria: "general",
      directiva_asociada: "Responder con precisión de catálogo y tono cordial paraguayo",
      activo: true,
      origen: "simulador",
    })
    setExampleModalOpen(true)
  }

  const filteredExamples = examples.filter((ex) =>
    selectedCategoryFilter === "todas" ? true : ex.categoria === selectedCategoryFilter
  )

  return (
    <div className="space-y-6">
      {/* 1. BARRA SUPERIOR: TELEMETRÍA DE RED & ACCIONES RÁPIDAS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Gateway Evolution API */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-medium border border-slate-200 dark:border-slate-700">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                gatewayStatus?.connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="text-slate-700 dark:text-slate-300">
              Gateway: <strong className="font-semibold">{gatewayStatus?.connected ? "Conectado" : "Desconectado"}</strong>
            </span>
          </div>

          {/* Watchdog Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-medium border border-slate-200 dark:border-slate-700">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span className="text-slate-700 dark:text-slate-300">
              Watchdog: <strong className="font-semibold">{watchdogStatus?.watchdog_running ? "Activo (60s)" : "Inactivo"}</strong>
            </span>
            {watchdogStatus?.failure_count ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
                {watchdogStatus.failure_count} fallos
              </span>
            ) : null}
          </div>

          {/* Ollama Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-medium border border-slate-200 dark:border-slate-700">
            <Cpu className="w-4 h-4 text-emerald-500" />
            <span className="text-slate-700 dark:text-slate-300">
              IA Local: <strong className="font-semibold">{ollamaStatus?.online ? "Qwen 2.5 (Online)" : "Ollama Offline"}</strong>
            </span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleHardenGateway}
            disabled={hardeningGateway}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors shadow-sm"
            title="Aplica políticas anti-desconexión (alwaysOnline, grupos ignorados, rechazo de llamadas)"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {hardeningGateway ? "Blindando..." : "Blindar Conexión"}
          </button>

          <button
            type="button"
            onClick={handleTriggerWatchdog}
            className="p-1.5 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Forzar chequeo de Watchdog ahora"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleRunQATests}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Batería QA (5 Escenarios)
          </button>
        </div>
      </div>

      {/* 2. ÁREA PRINCIPAL: SIMULADOR DE CHAT Y PANEL DE TELEMETRÍA (X-RAY) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LADO IZQUIERDO: CHAT SANDBOX */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col h-[650px]">
          {/* Selector de Personas */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
              Persona del Cliente Simulado
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PERSONAS.map((p) => {
                const isSelected = selectedPersona === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPersona(p.id)}
                    className={`px-2.5 py-2 rounded-xl text-left transition-all border text-xs ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 text-indigo-900 dark:text-indigo-200 font-bold shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="truncate font-semibold">{p.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Caja de Mensajes */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {messages.map((m) => {
              const isBot = m.sender === "bot"
              return (
                <div key={m.id} className={`flex ${isBot ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-sm relative ${
                      isBot
                        ? "bg-indigo-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-indigo-100 dark:border-slate-700 rounded-tl-none"
                        : "bg-indigo-600 text-white rounded-tr-none"
                    }`}
                  >
                    {/* Header del mensaje */}
                    <div className="flex items-center justify-between text-[10px] font-semibold opacity-75 mb-1 pb-1 border-b border-black/5 dark:border-white/10">
                      <span className="flex items-center gap-1">
                        {isBot ? <Bot className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> : null}
                        {isBot ? "ExtraBot IA" : "Vos (Cliente Simulado)"}
                      </span>
                      <span>{m.timestamp}</span>
                    </div>

                    <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>

                    {/* Presupuesto PDF si se generó */}
                    {m.pdf_base64 && (
                      <div className="mt-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {m.pdf_filename || "Presupuesto.pdf"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(m.pdf_base64!, m.pdf_filename || "Presupuesto.pdf")}
                          className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> Ver PDF
                        </button>
                      </div>
                    )}

                    {/* Metadatos y botón de corrección */}
                    {isBot && m.latency_ms !== undefined && (
                      <div className="mt-2 pt-1.5 border-t border-black/5 dark:border-white/10 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-0.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            <Zap className="w-3 h-3" /> {m.latency_ms}ms
                          </span>
                          {m.tools_called?.map((t) => (
                            <span key={t} className="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[9px]">
                              🔧 {t}
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTrainFromSimulator(m)}
                          className="px-2 py-0.5 rounded-md bg-indigo-600/10 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:text-indigo-300 dark:hover:text-white font-bold flex items-center gap-1 transition-colors"
                          title="Crear regla de entrenamiento basada en este diálogo"
                        >
                          <Sparkles className="w-2.5 h-2.5" /> Adiestrar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {simulating && (
              <div className="flex justify-start">
                <div className="bg-indigo-50 dark:bg-slate-800 rounded-2xl p-3 rounded-tl-none border border-indigo-100 dark:border-slate-700 flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                  <Bot className="w-4 h-4 animate-spin" /> Pensando y consultando herramientas SQL...
                </div>
              </div>
            )}
          </div>

          {/* Chips de Preguntas Frecuentes Rápidas */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_PROMPTS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(q)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-medium transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input de Envío */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="pt-2 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribí tu consulta o prompt para el bot..."
              disabled={simulating}
              className="flex-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button
              type="submit"
              disabled={simulating || !inputText.trim()}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Send className="w-3.5 h-3.5" /> Enviar
            </button>
          </form>
        </div>

        {/* LADO DERECHO: INSPECTOR X-RAY DE RAZONAMIENTO */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col h-[650px] overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                X-Ray Telemetría IA
              </h3>
            </div>
            {lastTelemetry && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                {lastTelemetry.latency_ms} ms
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pt-3 pr-1 scrollbar-thin text-xs">
            {!lastTelemetry ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Layers className="w-10 h-10 mx-auto opacity-30" />
                <p>Enviá un mensaje en el simulador para inspeccionar el flujo interno de pensamiento, invocación de herramientas SQL y directivas activadas.</p>
              </div>
            ) : (
              <>
                {/* 1. Guardrails */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-[11px]">
                    <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Guardrails del Supermercado
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px]">
                      Aprobados
                    </span>
                  </div>
                  <ul className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 list-disc pl-4">
                    <li>RUC verificado: 80150377-9 (GRUPO SANTA TERESA E.A.S.)</li>
                    <li>Precios y stock contrastados contra la base de datos real</li>
                    <li>Restricción de inventar promociones no existentes activa</li>
                  </ul>
                </div>

                {/* 2. Herramientas Invocadas */}
                <div className="space-y-2">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400 block">
                    Herramientas Ejecutadas ({lastTelemetry.tools_called.length})
                  </span>
                  {lastTelemetry.tools_trace.length === 0 ? (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 text-[11px] italic">
                      No requirió llamadas a herramientas (Respuesta de conversación directa).
                    </div>
                  ) : (
                    lastTelemetry.tools_trace.map((tr, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-slate-900 text-slate-200 font-mono text-[11px] border border-slate-700 space-y-2 shadow-inner"
                      >
                        <div className="flex items-center justify-between text-indigo-400 font-bold border-b border-slate-800 pb-1">
                          <span>🔧 {tr.tool}</span>
                          {tr.latency_ms && <span className="text-[9px] text-slate-400">{tr.latency_ms}ms</span>}
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">Parámetros Recibidos:</span>
                          <pre className="text-[10px] text-amber-300 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(tr.input, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[9px] block">Resultado SQL Preview:</span>
                          <div className="text-[10px] text-emerald-300 overflow-x-auto max-h-24 scrollbar-thin">
                            {tr.output_preview}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 3. Acción Asociada */}
                {lastTelemetry.order_code && (
                  <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 space-y-1">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200 block">
                      🛒 Pedido / Cotización Generada
                    </span>
                    <p className="text-indigo-800 dark:text-indigo-300 text-[11px]">
                      Se creó el pedido de presupuesto <strong className="font-bold">#{lastTelemetry.order_code}</strong> listo para retiro en góndola o caja central.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. BASE DE CONOCIMIENTO & REGLAS DE ADIESTRAMIENTO (FEW-SHOTS) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Directivas y Ejemplos de Adiestramiento (Few-Shot Prompting)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Instrucciones y respuestas modelo inyectadas directamente al modelo Qwen 2.5 local en cada consulta.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingExample({
                categoria: "general",
                mensaje_usuario: "",
                respuesta_ideal: "",
                directiva_asociada: "",
                activo: true,
                origen: "manual",
              })
              setExampleModalOpen(true)
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Nueva Directiva
          </button>
        </div>

        {/* Filtros de Categoría */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter("todas")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategoryFilter === "todas"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Todas ({examples.length})
          </button>
          {CATEGORIES.map((c) => {
            const count = examples.filter((ex) => ex.categoria === c.id).length
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategoryFilter(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategoryFilter === c.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                {c.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Tabla / Lista de Ejemplos */}
        {loadingExamples ? (
          <div className="py-12 text-center text-slate-400 text-xs">Cargando ejemplos de entrenamiento...</div>
        ) : filteredExamples.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-2">
            <Info className="w-8 h-8 mx-auto opacity-40" />
            <p>No hay ejemplos registrados en esta categoría. Podés agregar directivas con el botón superior o adiestrar directamente desde el simulador.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredExamples.map((ex) => (
              <div
                key={ex.id}
                className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                  ex.activo
                    ? "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold uppercase text-[10px]">
                    {ex.categoria}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleExampleActive(ex)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                        ex.activo
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                      }`}
                    >
                      {ex.activo ? "Activo" : "Inactivo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExample(ex)
                        setExampleModalOpen(true)
                      }}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteExample(ex.id)}
                      className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Mensaje de Cliente Modelo:
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    "{ex.mensaje_usuario}"
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                    Respuesta Ideal Esperada:
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    {ex.respuesta_ideal}
                  </p>
                </div>

                {ex.directiva_asociada && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <CornerDownRight className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="italic truncate">Regla: {ex.directiva_asociada}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: BATERÍA QA (5 ESCENARIOS) */}
      <Modal
        open={qaModalOpen}
        onClose={() => setQaModalOpen(false)}
        title="Batería de Pruebas Automatizadas de Calidad (Ollama Qwen 2.5)"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Evalúa automáticamente 5 escenarios críticos de negocio (horario, stock, pedido PDF, promociones y datos bancarios) para validar que el bot no sufra regresiones tras ser instruido.
          </p>

          {qaRunning && (
            <div className="py-8 text-center space-y-2">
              <Bot className="w-10 h-10 mx-auto text-indigo-600 animate-bounce" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 animate-pulse">
                Ejecutando pruebas sobre Ollama y base de datos...
              </p>
            </div>
          )}

          {qaResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-bold uppercase">Resultado Global</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {qaResult.passed} / {qaResult.total} Escenarios Superados ({qaResult.score_percentage}%)
                  </div>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs ${
                    qaResult.all_passed
                      ? "bg-emerald-500 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {qaResult.all_passed ? "CALIDAD VERIFICADA" : "REVISIÓN RECOMENDADA"}
                </div>
              </div>

              <div className="space-y-2.5">
                {qaResult.scenarios.map((sc) => (
                  <div
                    key={sc.id}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {sc.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-500" />
                        )}
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {sc.title}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{sc.latency_ms}ms</span>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-400 pl-6 space-y-1">
                      <p>
                        <strong>Prompt:</strong> "{sc.prompt}"
                      </p>
                      <p className="bg-slate-50 dark:bg-slate-800 p-2 rounded-xl text-slate-700 dark:text-slate-300">
                        "{sc.response_preview}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: VISOR DE PDF */}
      <Modal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title={`Presupuesto Generado: ${activePdfName}`}
        size="lg"
      >
        <div className="space-y-4">
          {activePdfUrl && (
            <iframe
              src={activePdfUrl}
              className="w-full h-[500px] rounded-2xl border border-slate-200 dark:border-slate-700"
              title="Presupuesto PDF"
            />
          )}
          <div className="flex justify-end gap-2">
            <a
              href={activePdfUrl || "#"}
              download={activePdfName}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Descargar PDF
            </a>
          </div>
        </div>
      </Modal>

      {/* MODAL: AGREGAR / EDITAR EJEMPLO */}
      <Modal
        open={exampleModalOpen}
        onClose={() => setExampleModalOpen(false)}
        title={editingExample?.id ? "Editar Directiva de Adiestramiento" : "Nueva Directiva de Adiestramiento"}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Categoría
            </label>
            <select
              value={editingExample?.categoria || "general"}
              onChange={(e) => setEditingExample({ ...editingExample, categoria: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Mensaje Modelo del Usuario
            </label>
            <input
              type="text"
              value={editingExample?.mensaje_usuario || ""}
              onChange={(e) => setEditingExample({ ...editingExample, mensaje_usuario: e.target.value })}
              placeholder="Ej: ¿Tienen azúcar en bolsa grande?"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Respuesta Ideal Esperada de la IA
            </label>
            <textarea
              rows={4}
              value={editingExample?.respuesta_ideal || ""}
              onChange={(e) => setEditingExample({ ...editingExample, respuesta_ideal: e.target.value })}
              placeholder="Escribí exactamente cómo debe responder el bot, incluyendo tono, formato y datos precisos..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Directiva o Regla de Comportamiento (Opcional)
            </label>
            <input
              type="text"
              value={editingExample?.directiva_asociada || ""}
              onChange={(e) => setEditingExample({ ...editingExample, directiva_asociada: e.target.value })}
              placeholder="Ej: Si no hay stock exacto de esa marca, ofrecer las marcas alternativas disponibles"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activeCheckbox"
              checked={editingExample?.activo ?? true}
              onChange={(e) => setEditingExample({ ...editingExample, activo: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="activeCheckbox" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Directiva Activa (Se inyecta al modelo inmediatamente)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setExampleModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveExample}
              disabled={savingExample}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm"
            >
              {savingExample ? "Guardando..." : "Guardar Directiva"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
