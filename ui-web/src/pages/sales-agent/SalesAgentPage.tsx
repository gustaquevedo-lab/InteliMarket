import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import * as XLSX from "xlsx"
import {
  TrendingUp, Sparkles, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw,
  DollarSign, Target, Scale, Zap, MessageSquare, Send, Check, ArrowRight,
  HelpCircle, ChevronRight, Layers, PieChart, ShieldCheck, Tag, ShoppingBag,
  ListTodo, Clock, Flame, BarChart3, Bot, ThumbsUp, ArrowUpRight, ArrowDownRight,
  Sliders, Search, Filter, PlayCircle, Award, CheckCircle, Info, Calculator,
  ChevronDown, ChevronUp, Package, Layers2, Boxes, Edit3, X, Activity, UserCheck,
  Star, Brain, Phone, Settings, Calendar,
  Mic, MicOff, Volume2, VolumeX, Paperclip, FileSpreadsheet, FileText, Image as ImageIcon, Copy, Trash2
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatPYG, formatDate, formatDateTime } from "../../utils/format"

type AgentTab = "rentabilidad" | "pareto" | "precios" | "simulador" | "chat" | "acciones"
type PeriodType = "mes_actual" | "mes_anterior" | "ultimos_30_dias" | "personalizado"

interface ChatAttachment {
  file?: File
  name: string
  type: "image" | "spreadsheet" | "document"
  size?: string
  preview?: string
  data?: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  outcome?: any
  prompts?: string[]
  attachment?: ChatAttachment
  timestamp?: string
}

function FormattedMessage({ content }: { content: string }) {
  if (!content) return null

  const lines = content.split("\n")
  const elements: JSX.Element[] = []
  let listItems: string[] = []

  const renderInline = (str: string) => {
    // Regex splits on **bold**, `code`, *italic*
    const parts = str.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-extrabold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] border border-indigo-200/50 dark:border-indigo-800/50">
            {part.slice(1, -1)}
          </code>
        )
      }
      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
        return (
          <em key={i} className="italic text-slate-700 dark:text-slate-300">
            {part.slice(1, -1)}
          </em>
        )
      }
      return part
    })
  }

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${key}`} className="space-y-1.5 my-1.5 pl-1">
          {listItems.map((li, liIdx) => (
            <li key={liIdx} className="flex items-start gap-2 text-slate-700 dark:text-slate-300 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span>{renderInline(li)}</span>
            </li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      listItems.push(trimmed.slice(2).trim())
    } else {
      flushList(idx)
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h4 key={idx} className="font-black text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mt-2 mb-1">
            {renderInline(trimmed.slice(4))}
          </h4>
        )
      } else if (trimmed.startsWith("## ")) {
        elements.push(
          <h3 key={idx} className="font-black text-sm text-slate-900 dark:text-white mt-2 mb-1">
            {renderInline(trimmed.slice(3))}
          </h3>
        )
      } else if (trimmed === "") {
        elements.push(<div key={idx} className="h-1.5" />)
      } else {
        elements.push(
          <p key={idx} className="leading-relaxed text-slate-700 dark:text-slate-300">
            {renderInline(trimmed)}
          </p>
        )
      }
    }
  })
  flushList(lines.length)

  return <div className="space-y-1 text-xs">{elements}</div>
}

export default function SalesAgentPage() {
  const [tab, setTab] = useState<AgentTab>("rentabilidad")
  const [periodo, setPeriodo] = useState<PeriodType>("mes_actual")
  const [fechaDesde, setFechaDesde] = useState<string>("")
  const [fechaHasta, setFechaHasta] = useState<string>("")

  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [applyingPrice, setApplyingPrice] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>("todas")
  const [filterStrategy, setFilterStrategy] = useState<string>("todos") // todos, fugas, candidatos, ganchos
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedScales, setExpandedScales] = useState<Record<string, boolean>>({})

  // Modal de Ajuste y Confirmación de Precio Individual
  const [modalProposal, setModalProposal] = useState<any | null>(null)
  const [customPrice, setCustomPrice] = useState<number>(0)
  const [customMotivo, setCustomMotivo] = useState<string>("")
  const [customScales, setCustomScales] = useState<Array<{min_qty: number; precio_unitario: number; descripcion: string}>>([])

  // Modal de Configuración de Metas
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [targetMinPct, setTargetMinPct] = useState<number>(20.0)
  const [targetIdealPct, setTargetIdealPct] = useState<number>(24.0)

  // Estado de Pareto
  const [paretoData, setParetoData] = useState<any>(null)
  const [paretoLoading, setParetoLoading] = useState(false)
  const [paretoMetric, setParetoMetric] = useState<string>("facturacion")
  const [paretoSearch, setParetoSearch] = useState("")
  const [paretoClassFilter, setParetoClassFilter] = useState<string>("todas") // todas, A, B, C

  // Estado del Simulador
  const [simulatorCategoryAdjustments, setSimulatorCategoryAdjustments] = useState<Record<string, number>>({})
  const [simResult, setSimResult] = useState<any>(null)
  const [simLoading, setSimLoading] = useState(false)

  // Estado de Reglas de Negocio / Memoria
  const [businessRules, setBusinessRules] = useState<any[]>([])
  const [newRuleText, setNewRuleText] = useState("")

  // Estado de Chat y Control Multimodal (Voz, Archivos, Memoria)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "👋 **Buenas tardes. Bienvenido a la Torre de Control Comercial del Gerente de Ventas IA.**\n\nEstoy conectado en tiempo real a la base de datos de **Extra Supermercado** con inferencia local de IA, soporte para análisis por **voz**, carga de **planillas Excel** y auditoría visual de **fotos**.\n\n¿En qué área comercial o remarcación deseas que nos enfoquemos hoy?",
      prompts: [
        "¿Cuáles son los productos con peor margen?",
        "Ver desglose de Pareto Clase A",
        "Modificar meta general a 22%",
        "Propuestas de precios en Carnicería"
      ],
      timestamp: "En línea"
    }
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null)
  const [fileProcessing, setFileProcessing] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Soporte de Voz (Speech to Text)
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false)
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.warning("Voz no disponible", "Tu navegador no soporta Web Speech API.")
      return
    }
    try {
      const recognition = new SpeechRecognition()
      recognition.lang = "es-PY"
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => setIsListening(true)
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInputMessage(prev => prev ? `${prev} ${transcript}` : transcript)
        setIsListening(false)
      }
      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)
      recognition.start()
    } catch {
      setIsListening(false)
    }
  }

  // Reproducir Texto con Voz (Text to Speech)
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }
    const cleanText = text.replace(/[*#_`]/g, "")
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = "es-ES"
    utterance.rate = 1.05
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  // Procesamiento de Archivos (Imágenes, Excel, CSV, PDF)
  const processIncomingFile = async (file: File) => {
    setFileProcessing(true)
    try {
      const sizeStr = `${(file.size / 1024).toFixed(1)} KB`
      const isImage = file.type.startsWith("image/")
      const isSheet = file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv")

      if (isImage) {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result as string
          setAttachment({
            file: file as any,
            name: file.name,
            type: "image",
            size: sizeStr,
            preview: base64,
            data: base64
          })
          toast.info("Imagen adjunta", "Lista para análisis visual con Gemini Multimodal.")
        }
        reader.readAsDataURL(file)
      } else if (isSheet) {
        const reader = new FileReader()
        reader.onload = (evt) => {
          try {
            const bstr = evt.target?.result
            const wb = XLSX.read(bstr, { type: "binary" })
            const wsname = wb.SheetNames[0]
            const ws = wb.Sheets[wsname]
            const jsonRows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 })
            const previewRows = jsonRows.slice(0, 30)
            const textSummary = `Hoja: ${wsname} (${jsonRows.length} filas)\nDatos detectados:\n${JSON.stringify(previewRows, null, 2)}`
            setAttachment({
              file: file as any,
              name: file.name,
              type: "spreadsheet",
              size: sizeStr,
              data: textSummary
            })
            toast.success("Planilla leída", `${jsonRows.length} filas extraídas de ${file.name}.`)
          } catch (err: any) {
            toast.error("Error al leer Excel", err.message)
          }
        }
        reader.readAsBinaryString(file)
      } else {
        const reader = new FileReader()
        reader.onload = () => {
          const text = (reader.result as string) || ""
          setAttachment({
            file: file as any,
            name: file.name,
            type: "document",
            size: sizeStr,
            data: text.slice(0, 15000)
          })
          toast.info("Documento adjunto", file.name)
        }
        reader.readAsText(file)
      }
    } catch (err: any) {
      toast.error("Error procesando archivo", err.message)
    } finally {
      setFileProcessing(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processIncomingFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleCopyMessage = (idx: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const handleClearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "🔄 Conversación reiniciada. ¿Qué área comercial o análisis deseás evaluar?",
        prompts: [
          "¿Cuáles son los productos con peor margen?",
          "Ver desglose de Pareto Clase A",
          "Auditar carnicería y cortes nobles"
        ],
        timestamp: "Ahora"
      }
    ])
    setAttachment(null)
  }

  const toast = useToast()
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"

  // Carga Principal de Análisis
  const loadData = async (selectedPeriod = periodo) => {
    setLoading(true)
    try {
      const params: any = { periodo_tipo: selectedPeriod }
      if (selectedPeriod === "personalizado" && fechaDesde && fechaHasta) {
        params.fecha_desde = fechaDesde
        params.fecha_hasta = fechaHasta
      }
      const data = await api.salesAgent.getAnalysis(companyId, params)
      setAnalysis(data)
      setTargetMinPct(data.margen_minimo_target_pct || 20.0)
      setTargetIdealPct(data.margen_ideal_target_pct || 24.0)
    } catch (e: any) {
      console.error("SalesAgent load error:", e)
      toast.error("Error al cargar análisis de ventas", e?.message || "Verifique la conexión con la API central")
    } finally {
      setLoading(false)
    }

    try {
      const rules = await api.salesAgent.getBusinessRules(companyId)
      setBusinessRules(rules || [])
    } catch (ruleErr) {
      console.warn("No se pudieron cargar reglas del negocio:", ruleErr)
    }
  }

  // Cargar Pareto
  const loadPareto = async () => {
    setParetoLoading(true)
    try {
      const res = await api.salesAgent.getPareto({
        company_id: companyId,
        periodo_tipo: periodo,
        metric_type: paretoMetric,
        search: paretoSearch,
        page_size: 100
      })
      setParetoData(res)
    } catch (e: any) {
      toast.error("Error al calcular Pareto")
    } finally {
      setParetoLoading(false)
    }
  }

  useEffect(() => {
    loadData(periodo)
  }, [periodo])

  useEffect(() => {
    if (tab === "pareto") {
      loadPareto()
    }
  }, [tab, paretoMetric, periodo])

  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, tab])

  // Ejecutar Simulación de Margen
  const runSimulation = async (adjustments: Record<string, number>) => {
    setSimLoading(true)
    try {
      const payloadCats = Object.entries(adjustments).map(([cat, pct]) => ({
        categoria: cat,
        variacion_pct: pct
      }))
      const res = await api.salesAgent.simulateMargin({
        company_id: companyId,
        periodo_tipo: periodo,
        ajustes_categoria: payloadCats
      })
      setSimResult(res)
    } catch (e: any) {
      toast.error("Error al simular margen")
    } finally {
      setSimLoading(false)
    }
  }

  const handleSliderChange = (categoria: string, val: number) => {
    const updated = { ...simulatorCategoryAdjustments, [categoria]: val }
    setSimulatorCategoryAdjustments(updated)
    runSimulation(updated)
  }

  // Chat con Copiloto IA
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage
    if (!text.trim() || chatLoading) return

    const userMsg = { role: "user" as const, content: text }
    setMessages(prev => [...prev, userMsg])
    setInputMessage("")
    setChatLoading(true)

    try {
      const res = await api.salesAgent.chat({
        company_id: companyId,
        message: text,
        context_tab: tab,
        conversation_history: messages.slice(-4)
      })

      const botMsg = {
        role: "assistant" as const,
        content: res.reply,
        outcome: res.action_outcome,
        prompts: res.suggested_prompts || []
      }
      setMessages(prev => [...prev, botMsg])

      // Si hubo una accion ejecutada (como cambio de meta o precio), refrescar datos
      if (res.action_outcome) {
        toast.success(`Acción IA ejecutada: ${res.action_outcome.titulo}`)
        loadData()
      }
    } catch (e: any) {
      toast.error("Error al comunicarse con el Copiloto Comercial")
    } finally {
      setChatLoading(false)
    }
  }

  // Toggle de Producto Gancho (KVI)
  const handleToggleKvi = async (proposal: any) => {
    const nuevoEstado = !proposal.es_gancho
    try {
      await api.salesAgent.toggleKvi({
        company_id: companyId,
        product_id: proposal.product_id,
        es_gancho: nuevoEstado,
        motivo: nuevoEstado ? "Marcado como Producto Gancho KVI" : "Desprotegido de KVI"
      })
      toast.success(nuevoEstado ? `Producto protegido como KVI: ${proposal.nombre}` : `KVI removido: ${proposal.nombre}`)
      // Actualizar localmente la propuesta
      setAnalysis((prev: any) => ({
        ...prev,
        propuestas_precios: prev.propuestas_precios.map((p: any) =>
          p.product_id === proposal.product_id ? { ...p, es_gancho: nuevoEstado, tipo_estrategia: nuevoEstado ? "kvi_gancho" : "recuperacion_gap" } : p
        )
      }))
    } catch (e: any) {
      toast.error("Error al actualizar estado KVI")
    }
  }

  // Modal de Ajuste de Precios
  const openPriceModal = (proposal: any) => {
    setModalProposal(proposal)
    setCustomPrice(Number(proposal.precio_sugerido))
    setCustomMotivo(proposal.motivo || "Ajuste de margen sugerido por Gerente IA")
    const scales = (proposal.escalas_precio || []).map((e: any) => ({
      min_qty: Number(e.min_qty),
      precio_unitario: Number(e.precio_unitario),
      descripcion: String(e.descripcion)
    }))
    if (scales.length === 0) {
      scales.push({ min_qty: 1, precio_unitario: Number(proposal.precio_sugerido), descripcion: "Minorista (1 un)" })
      scales.push({ min_qty: 3, precio_unitario: Math.round(Number(proposal.precio_sugerido) * 0.96 / 50) * 50, descripcion: "Pack x3 un" })
      scales.push({ min_qty: 6, precio_unitario: Math.round(Number(proposal.precio_sugerido) * 0.90 / 50) * 50, descripcion: "Mayorista / Fardo x6 un" })
    } else {
      scales[0].precio_unitario = Number(proposal.precio_sugerido)
    }
    setCustomScales(scales)
  }

  const closePriceModal = () => {
    setModalProposal(null)
    setCustomScales([])
  }

  const handleApplyPrice = async () => {
    if (!modalProposal) return
    setApplyingPrice(modalProposal.id)
    try {
      const res = await api.salesAgent.applyPrice({
        company_id: companyId,
        product_id: modalProposal.product_id,
        nuevo_precio: customPrice,
        motivo: customMotivo,
        escalas: customScales
      })
      toast.success(`Precio aplicado en POS a ${res.product_name || modalProposal.nombre}: ${formatPYG(customPrice)}`)
      closePriceModal()
      loadData()
    } catch (e: any) {
      toast.error("Error al aplicar precio en el sistema")
    } finally {
      setApplyingPrice(null)
    }
  }

  // Guardar Metas Comerciales
  const handleSaveSettings = async () => {
    try {
      await api.salesAgent.updateSettings({
        company_id: companyId,
        target_margen_minimo_pct: targetMinPct,
        target_margen_ideal_pct: targetIdealPct
      })
      toast.success("Metas de margen actualizadas exitosamente")
      setSettingsModalOpen(false)
      loadData()
    } catch (e: any) {
      toast.error("Error al actualizar metas")
    }
  }

  // Ejecutar Acción Operativa 1-Click
  const handleExecuteTask = async (task: any, tipo: string) => {
    try {
      await api.salesAgent.executeTaskAction({
        company_id: companyId,
        task_id: task.id,
        tipo_accion: tipo
      })
      toast.success(`Acción ejecutada: ${task.titulo}`)
      loadData()
    } catch (e: any) {
      toast.error("Error al ejecutar acción")
    }
  }

  // Descartar Tarea con Motivo (Aprendizaje)
  const handleDiscardTask = async (taskId: string) => {
    const motivo = prompt("Indica el motivo del descarte para que el Gerente IA aprenda esta regla:")
    if (!motivo) return
    try {
      await api.salesAgent.updateTaskStatus({
        company_id: companyId,
        task_id: taskId,
        estado: "descartado",
        motivo_descarte: motivo
      })
      toast.success("Tarea descartada y regla de negocio aprendida por la IA")
      loadData()
    } catch (e: any) {
      toast.error("Error al descartar tarea")
    }
  }

  // Crear Regla de Negocio Manual
  const handleCreateRule = async () => {
    if (!newRuleText.trim()) return
    try {
      await api.salesAgent.createBusinessRule({
        company_id: companyId,
        regla: newRuleText,
        categoria: "estrategia_comercial"
      })
      toast.success("Regla incorporada a la memoria del Gerente IA")
      setNewRuleText("")
      const rules = await api.salesAgent.getBusinessRules(companyId)
      setBusinessRules(rules || [])
    } catch (e: any) {
      toast.error("Error al registrar regla")
    }
  }

  const margen = analysis?.margen_actual_pct || 0
  const gap24 = Number(analysis?.gap_para_24_pct_gs || 0)

  // Filtrado de propuestas
  const filteredProposals = (analysis?.propuestas_precios || []).filter((p: any) => {
    const matchesCat = filterCategory === "todas" || p.categoria.toLowerCase() === filterCategory.toLowerCase()
    const matchesSearch = !searchQuery || p.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    let matchesStrat = true
    if (filterStrategy === "fugas") matchesStrat = Number(p.precio_actual) <= Number(p.costo_unitario)
    if (filterStrategy === "ganchos") matchesStrat = p.tipo_estrategia === "kvi_gancho" || p.es_gancho
    if (filterStrategy === "candidatos") matchesStrat = Number(p.margen_actual_pct) < 24.0
    return matchesCat && matchesSearch && matchesStrat
  })

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER (CANÓNICO INTELIMARKET / FACTURACIÓN) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    INTELIGENCIA ARTIFICIAL · TORRE DE CONTROL COMERCIAL
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Target Margen: {analysis?.margen_ideal_target_pct || targetIdealPct}% · Mínimo: {analysis?.margen_minimo_target_pct || targetMinPct}%
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Gerente de Ventas IA
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Auditoría de márgenes en tiempo real, elasticidad de precios, Pareto 80/20 y copiloto comercial
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ⚡ Copiloto: Qwen 2.5 Local + Heurística ReAct
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                📊 {analysis?.tickets_mes ? Number(analysis.tickets_mes).toLocaleString() : "..."} tickets auditados
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-700/80 text-xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={periodo}
                onChange={(e) => {
                  const p = e.target.value as PeriodType
                  setPeriodo(p)
                  loadData(p)
                }}
                className="bg-transparent border-none text-slate-200 font-bold focus:ring-0 cursor-pointer text-xs"
              >
                <option value="mes_actual" className="bg-slate-900 text-white">Mes en Curso (MTD)</option>
                <option value="mes_anterior" className="bg-slate-900 text-white">Mes Anterior</option>
                <option value="ultimos_30_dias" className="bg-slate-900 text-white">Últimos 30 Días</option>
              </select>
            </div>

            <button
              onClick={() => setSettingsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              Metas ({analysis?.margen_ideal_target_pct || targetIdealPct}%)
            </button>

            <button
              onClick={() => loadData(periodo)}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 border border-indigo-400/40 shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Auditar
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS (ESTRUCTURA DE FACTURACIÓN) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Facturación Período</span>
              <span className="text-[10px] font-bold text-emerald-400">Ventas</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(analysis?.facturacion_mes || 0)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Proyección: {formatPYG(analysis?.proyeccion_cierre_mes_gs || 0)}
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Actual</span>
              <span className={`text-[10px] font-bold ${margen >= 20 ? "text-emerald-400" : "text-amber-400"}`}>
                {margen >= 20 ? "Saludable" : "Bajo Target"}
              </span>
            </div>
            <p className={`text-2xl font-black font-mono tracking-tight ${margen >= 20 ? "text-emerald-400" : "text-amber-400"}`}>
              {margen.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Ganancia Bruta: {formatPYG(analysis?.ganancia_bruta_mes || 0)}
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gap a Meta (24%)</span>
              <span className="text-[10px] font-bold text-rose-400">Recuperable</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {formatPYG(gap24)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Fuga mensual por precios descalzados
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Volumen & Tickets</span>
              <span className="text-[10px] font-mono text-indigo-400">Operaciones</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-indigo-300">
              {(analysis?.tickets_mes || 0).toLocaleString()} <span className="text-sm font-semibold text-slate-400">tix</span>
            </p>
            <p className="text-[11px] text-emerald-400 font-mono">
              Ticket Promedio: {formatPYG((analysis?.tickets_mes || 0) > 0 ? Math.round((analysis?.facturacion_mes || 0) / (analysis?.tickets_mes || 1)) : 0)}
            </p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS (CANÓNICO FACTURACIÓN) */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "rentabilidad", label: "Torre de Control", icon: Activity },
          { key: "pareto", label: "Matriz Pareto 80/20", icon: PieChart },
          { key: "precios", label: "Propuestas de Precios & KVI", icon: Tag, count: analysis?.propuestas_precios?.length },
          { key: "simulador", label: "Simulador de Margen", icon: Sliders },
          { key: "chat", label: "Copiloto Comercial IA", icon: Bot },
          { key: "acciones", label: "Plan de Acción 1-Click", icon: ListTodo, count: analysis?.plan_accion_diario?.length }
        ].map((t) => {
          const Icon = t.icon
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as AgentTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isActive ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="p-12 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-slate-500">Auditando ventas en tiempo real contra PostgreSQL...</p>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 1: TORRE DE CONTROL (RENTABILIDAD) ══════════════════════ */}
      {!loading && tab === "rentabilidad" && analysis && (
        <div className="space-y-6">
          {/* Tarjetas KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Facturación del Período</span>
              <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">{formatPYG(analysis.facturacion_mes)}</p>
              <span className="text-[11px] text-slate-500">{analysis.tickets_mes?.toLocaleString()} tickets confirmados</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Ponderado Real</span>
              <div className="flex items-baseline gap-2">
                <p className={`text-2xl font-black font-mono ${margen >= 20 ? "text-emerald-600" : "text-rose-600"}`}>
                  {margen}%
                </p>
                <span className="text-xs text-slate-400 font-medium">Meta: {analysis.margen_ideal_target_pct}%</span>
              </div>
              <span className="text-[11px] text-slate-500">Ganancia: {formatPYG(analysis.ganancia_bruta_mes)}</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gap para Meta ({analysis.margen_ideal_target_pct}%)</span>
              <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">{formatPYG(gap24)}</p>
              <span className="text-[11px] text-slate-500">Ganancia adicional requerida</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Proyección de Cierre</span>
              <p className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">{formatPYG(analysis.proyeccion_cierre_mes_gs)}</p>
              <span className="text-[11px] text-slate-500">Run-rate mensual estimado</span>
            </div>
          </div>

          {/* Resumen Ejecutivo */}
          <div className="p-6 rounded-3xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/40 space-y-2">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              Dictamen Ejecutivo del Gerente IA
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {analysis.resumen_ejecutivo}
            </p>
          </div>

          {/* Desglose por Departamento — Tarjetas Ejecutivas de Rentabilidad */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Rendimiento por Departamento & Sección
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Auditoría de <b>Margen Bruto</b> (rentabilidad real), <b>Facturación</b> y su <b>Participación</b> sobre las ventas totales del supermercado
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 flex-wrap">
                <span className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-900/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Margen en Meta (≥ Target)
                </span>
                <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-md border border-blue-200 dark:border-blue-900/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Margen Saludable (≥ 15%)
                </span>
                <span className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-2 py-1 rounded-md border border-rose-200 dark:border-rose-900/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Bajo Meta / Gancho KVI
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analysis.rentabilidad_por_departamento?.map((d: any, idx: number) => {
                const totalTienda = Number(analysis.facturacion_mes || 0)
                const partPct = d.participacion_ventas_pct !== undefined
                  ? d.participacion_ventas_pct
                  : (totalTienda > 0 ? Number(((d.facturacion_gs / totalTienda) * 100).toFixed(1)) : 0)
                const margenActual = Number(d.margen_actual_pct || 0)
                const metaTarget = Number(d.target_sugerido_pct || 22.0)
                const gapPp = Number((margenActual - metaTarget).toFixed(1))
                const gananciaBruta = d.ganancia_bruta_gs !== undefined
                  ? d.ganancia_bruta_gs
                  : Math.round(Number(d.facturacion_gs) * (margenActual / 100))
                const costoCmv = d.cmv_gs !== undefined
                  ? d.cmv_gs
                  : Math.round(Number(d.facturacion_gs) - gananciaBruta)
                const saludMargen = margenActual >= metaTarget ? "optimo" : margenActual >= 15 ? "saludable" : "bajo"

                return (
                  <div
                    key={idx}
                    className="p-5 rounded-3xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/60 shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    {/* Header del Card: Nombre + Participación + Margen */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">
                          {d.departamento}
                        </h4>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-900/50">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ventas Tienda:</span>
                          <span className="text-[11px] font-black font-mono text-indigo-700 dark:text-indigo-300">{partPct}%</span>
                        </div>
                      </div>

                      {/* Badge de Margen Bruto y Meta */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Margen:</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-black ${
                            saludMargen === "optimo"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                              : saludMargen === "saludable"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                          }`}>
                            {margenActual}%
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Meta: <span className="font-bold text-slate-600 dark:text-slate-300">{metaTarget}%</span>
                          <span className={`ml-1 font-bold ${gapPp >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            ({gapPp > 0 ? `+${gapPp}` : gapPp} pp)
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Barra visual de Margen vs Meta */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span>Rendimiento del Margen</span>
                        <span className="font-mono font-bold">
                          {Math.min(100, Math.round((margenActual / Math.max(metaTarget, 1)) * 100))}% de la meta
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            saludMargen === "optimo" ? "bg-emerald-500" : saludMargen === "saludable" ? "bg-blue-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, (margenActual / Math.max(metaTarget, 1)) * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* Desglose Cuantitativo: Facturación, Ganancia Bruta, Costo CMV */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                      <div className="bg-white dark:bg-slate-900/70 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          Facturación Total
                        </span>
                        <p className="text-xs font-black font-mono text-slate-900 dark:text-white mt-0.5">
                          {formatPYG(d.facturacion_gs)}
                        </p>
                      </div>

                      <div className="bg-white dark:bg-slate-900/70 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          Ganancia Bruta
                        </span>
                        <p className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {formatPYG(gananciaBruta)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
                      <span>Costo (CMV): <b className="text-slate-600 dark:text-slate-300">{formatPYG(costoCmv)}</b></span>
                      {d.transacciones ? (
                        <span>{d.transacciones.toLocaleString()} tickets</span>
                      ) : null}
                    </div>

                    {/* Dictamen Estratégico IA */}
                    <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                      <span className="font-extrabold text-indigo-700 dark:text-indigo-400 mr-1 block sm:inline">
                        💡 Estrategia IA:
                      </span>
                      {d.estrategia}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 2: MATRIZ PARETO 80/20 REAL ══════════════════════ */}
      {!loading && tab === "pareto" && (
        <div className="space-y-6">
          {/* Tarjetas Resumen ABC */}
          {paretoData?.resumen && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 relative overflow-hidden">
                <div className="h-1.5 w-full bg-emerald-500 absolute top-0 left-0" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Clase A (Top SKUs)</span>
                  <span className="text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 px-2.5 py-0.5 rounded-full">
                    80% Facturación
                  </span>
                </div>
                <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                  {paretoData.resumen.clase_a_skus} SKUs ({paretoData.resumen.clase_a_pct}%)
                </p>
                <p className="text-xs text-slate-500">Generadores de tráfico y volumen masivo del supermercado.</p>
              </div>

              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 relative overflow-hidden">
                <div className="h-1.5 w-full bg-blue-500 absolute top-0 left-0" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Clase B (Margin Drivers)</span>
                  <span className="text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 px-2.5 py-0.5 rounded-full">
                    15% Facturación
                  </span>
                </div>
                <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                  {paretoData.resumen.clase_b_skus} SKUs ({paretoData.resumen.clase_b_pct}%)
                </p>
                <p className="text-xs text-slate-500">Motores de ganancia bruta con rotación intermedia.</p>
              </div>

              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 relative overflow-hidden">
                <div className="h-1.5 w-full bg-purple-500 absolute top-0 left-0" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Clase C (Surtido & Nicho)</span>
                  <span className="text-xs font-mono font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 px-2.5 py-0.5 rounded-full">
                    5% Facturación
                  </span>
                </div>
                <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                  {paretoData.resumen.clase_c_skus} SKUs ({paretoData.resumen.clase_c_pct}%)
                </p>
                <p className="text-xs text-slate-500">Variedad de góndola y artículos de baja rotación.</p>
              </div>
            </div>
          )}

          {/* Tabla Interactiva de Pareto */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Desglose de SKUs en Curva ABC ({paretoData?.total_items || 0} productos)
              </h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={paretoSearch}
                    onChange={(e) => setParetoSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <select
                  value={paretoMetric}
                  onChange={(e) => setParetoMetric(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <option value="facturacion">Ranking por Facturación</option>
                  <option value="ganancia">Ranking por Ganancia Bruta</option>
                </select>
              </div>
            </div>

            {paretoLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                      <th className="py-2.5 px-3">Clase</th>
                      <th className="py-2.5 px-3">Producto / Código</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3 text-right">Cant. Vendida</th>
                      <th className="py-2.5 px-3 text-right">Facturación</th>
                      <th className="py-2.5 px-3 text-right">Margen %</th>
                      <th className="py-2.5 px-3 text-right">Part. %</th>
                      <th className="py-2.5 px-3 text-right">Acum. %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {paretoData?.items?.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            it.clase === "A" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300" :
                            it.clase === "B" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300" :
                            "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300"
                          }`}>
                            Clase {it.clase}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-800 dark:text-slate-200">
                          {it.nombre}
                          {it.codigo_barra && <span className="block text-[10px] text-slate-400 font-mono">{it.codigo_barra}</span>}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-500">{it.categoria}</td>
                        <td className="py-2.5 px-3 text-right">{Number(it.unidades_vendidas).toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">{formatPYG(it.facturacion_total)}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${it.margen_bruto_pct < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {it.margen_bruto_pct}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{it.participacion_pct}%</td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{it.acumulado_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 3: PROPUESTAS DE PRECIOS & GESTIÓN KVI ══════════════════════ */}
      {!loading && tab === "precios" && (
        <div className="space-y-6">
          {/* Barra de Filtros */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center flex-wrap gap-2">
              {[
                { key: "todos", label: "Todas las Propuestas" },
                { key: "fugas", label: "🚨 Fugas Críticas (Precio ≤ Costo)" },
                { key: "ganchos", label: "⭐ Productos Gancho (KVI)" },
                { key: "candidatos", label: "📈 Candidatos a Suba" }
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setFilterStrategy(s.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    filterStrategy === s.key
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por SKU o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Grilla de Propuestas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProposals.map((p: any) => {
              const diffPct = p.margen_sugerido_pct - p.margen_actual_pct
              const isKvi = p.tipo_estrategia === "kvi_gancho" || p.es_gancho
              const isFuga = Number(p.precio_actual) <= Number(p.costo_unitario)

              return (
                <div
                  key={p.id}
                  className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border transition shadow-sm space-y-4 flex flex-col justify-between ${
                    isFuga
                      ? "border-rose-400 dark:border-rose-800 bg-rose-50/20"
                      : isKvi
                      ? "border-amber-300 dark:border-amber-800/50"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                        {p.categoria}
                      </span>
                      <button
                        onClick={() => handleToggleKvi(p)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                          isKvi
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        <Star className={`w-3 h-3 ${isKvi ? "fill-amber-500 text-amber-500" : ""}`} />
                        {isKvi ? "Gancho / KVI" : "Hacer Gancho"}
                      </button>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{p.nombre}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{p.motivo}</p>

                    {/* Comparativa de Precios */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Precio Actual</span>
                        <p className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{formatPYG(p.precio_actual)}</p>
                        <span className="text-[10px] text-slate-400 font-mono">Margen: {p.margen_actual_pct}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase">Precio Sugerido</span>
                        <p className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm mt-0.5">{formatPYG(p.precio_sugerido)}</p>
                        <span className="text-[10px] text-emerald-600 font-bold font-mono">
                          Margen: {p.margen_sugerido_pct}% (+{diffPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400">Costo: {formatPYG(p.costo_unitario)}</span>
                    <button
                      onClick={() => openPriceModal(p)}
                      className="px-3.5 py-1.5 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Revisar y Aplicar...
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 4: SIMULADOR DE MARGEN INTERACTIVO ══════════════════════ */}
      {!loading && tab === "simulador" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Simulador de Elasticidad & Margen Comercial</h3>
                <p className="text-xs text-slate-500">Mové los sliders por categoría para proyectar la ganancia bruta y la reducción del gap</p>
              </div>
              {simResult && (
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                  Reducción del Gap: {simResult.reduccion_gap_pct}%
                </span>
              )}
            </div>

            {/* Tarjetas de Proyección de Impacto */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Margen Simulado</span>
                <p className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                  {simResult?.margen_simulado_pct || margen}%
                </p>
                <span className="text-[11px] text-slate-500">Actual: {margen}%</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Ganancia Adicional Esperada</span>
                <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  +{formatPYG(simResult?.ganancia_adicional_gs || 0)}
                </p>
                <span className="text-[11px] text-slate-500">En el período</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Gap Restante</span>
                <p className="text-2xl font-black font-mono text-rose-500 mt-1">
                  {formatPYG(simResult?.gap_restante_gs || gap24)}
                </p>
                <span className="text-[11px] text-slate-500">Para meta del {analysis?.margen_ideal_target_pct}%</span>
              </div>
            </div>

            {/* Sliders por Categoría */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Ajuste de Precios por Departamento</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis?.rentabilidad_por_departamento?.map((d: any, idx: number) => {
                  const currentVal = simulatorCategoryAdjustments[d.departamento] || 0
                  return (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{d.departamento}</span>
                        <span className={`text-xs font-mono font-bold ${currentVal > 0 ? "text-indigo-600" : currentVal < 0 ? "text-rose-600" : "text-slate-400"}`}>
                          {currentVal > 0 ? `+${currentVal}%` : `${currentVal}%`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="25"
                        step="1"
                        value={currentVal}
                        onChange={(e) => handleSliderChange(d.departamento, Number(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Margen actual: {d.margen_actual_pct}%</span>
                        <span>Factura: {formatPYG(d.facturacion_gs)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 5: COPILOTO COMERCIAL IA MULTIMODAL (VOZ + ARCHIVOS + MEMORIA) ══════════════════════ */}
      {!loading && tab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Perfil, Memoria y Capacidades Multimodales */}
          <div className="lg:col-span-4 space-y-4">
            {/* Tarjeta de Estado del Copiloto */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                    <Bot className="w-7 h-7" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Gerente Comercial Autónomo</h3>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Qwen 2.5 7B + Gemini Multimodal
                  </p>
                </div>
              </div>

              {/* Capacidades Activas */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 space-y-1">
                  <span className="font-extrabold text-indigo-700 dark:text-indigo-300 block flex items-center gap-1">
                    <Mic className="w-3 h-3" /> Dictado por Voz
                  </span>
                  <p className="text-slate-500 dark:text-slate-400">Web Speech API nativo (es-PY)</p>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 space-y-1">
                  <span className="font-extrabold text-purple-700 dark:text-purple-300 block flex items-center gap-1">
                    <FileSpreadsheet className="w-3 h-3" /> Planillas & Fotos
                  </span>
                  <p className="text-slate-500 dark:text-slate-400">Excel (.xlsx), CSV e imágenes</p>
                </div>
              </div>

              {/* Memoria de Reglas del Negocio */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-indigo-500" />
                    Memoria Activa del Negocio ({businessRules.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">PostgreSQL</span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {businessRules.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No hay directivas registradas aún.</p>
                  ) : (
                    businessRules.map((r, rIdx) => (
                      <div key={rIdx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                        {r.regla}
                      </div>
                    ))
                  )}
                </div>

                {/* Agregar regla rápida */}
                <div className="pt-2 flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Instruir directiva al agente..."
                    value={newRuleText}
                    onChange={(e) => setNewRuleText(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  <button
                    onClick={handleCreateRule}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Chat Interactivo Command Deck */}
          <div
            className={`lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl border transition-all ${
              isDragging
                ? "border-indigo-500 ring-2 ring-indigo-500/30"
                : "border-slate-200 dark:border-slate-800"
            } shadow-sm flex flex-col h-[650px] overflow-hidden relative`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              const dropped = e.dataTransfer.files?.[0]
              if (dropped) processIncomingFile(dropped)
            }}
          >
            {/* Header de la Ventana de Chat */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  Torre de Control Comercial en Vivo
                </span>
                <span className="hidden sm:inline-block text-[10px] text-slate-400 px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800">
                  PostgreSQL + ReAct
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearChat}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition text-xs flex items-center gap-1 cursor-pointer"
                  title="Reiniciar conversación"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="text-[11px] hidden md:inline">Limpiar</span>
                </button>
              </div>
            </div>

            {/* Zona de Mensajes */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-2xl rounded-2xl p-4 text-xs space-y-2.5 ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10"
                      : "bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/80 dark:border-slate-800 shadow-xs"
                  }`}>
                    {/* Adjunto previo si es mensaje de usuario */}
                    {m.attachment && (
                      <div className="mb-2">
                        {m.attachment.type === "image" && m.attachment.preview && (
                          <div className="relative group max-w-xs overflow-hidden rounded-xl border border-white/20 mb-1.5">
                            <img src={m.attachment.preview} alt="Adjunto" className="w-full max-h-48 object-cover rounded-xl" />
                            <div className="absolute bottom-1 left-1 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-mono">
                              📷 {m.attachment.name}
                            </div>
                          </div>
                        )}
                        {m.attachment.type === "spreadsheet" && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 border border-white/30 text-white font-bold text-[11px]">
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Planilla: {m.attachment.name}</span>
                          </div>
                        )}
                        {m.attachment.type === "document" && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 border border-white/30 text-white font-bold text-[11px]">
                            <FileText className="w-4 h-4" />
                            <span>Documento: {m.attachment.name}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Contenido Formateado (Sin asteriscos crudos) */}
                    <div className="leading-relaxed">
                      {m.role === "assistant" ? (
                        <FormattedMessage content={m.content} />
                      ) : (
                        <p className="whitespace-pre-line leading-relaxed font-medium">{m.content}</p>
                      )}
                    </div>

                    {/* Barra de utilidades del mensaje del asistente (Voz + Copiar + Timestamp) */}
                    {m.role === "assistant" && (
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-mono">{m.timestamp || "Gerente IA"}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => speakText(m.content)}
                            className={`p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1 ${
                              isSpeaking ? "text-indigo-600 dark:text-indigo-400 animate-pulse font-bold" : "text-slate-400"
                            }`}
                            title="Escuchar respuesta en voz alta"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Escuchar</span>
                          </button>
                          <button
                            onClick={() => handleCopyMessage(idx, m.content)}
                            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1 text-slate-400"
                            title="Copiar texto"
                          >
                            {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span className="text-[10px]">{copiedIdx === idx ? "Copiado" : "Copiar"}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Outcome de acción ejecutada */}
                    {m.outcome && (
                      <div className="p-3 mt-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 flex items-start justify-between gap-2">
                        <div>
                          <span className="font-extrabold uppercase text-[10px] tracking-wider block text-indigo-700 dark:text-indigo-300">
                            ⚡ {m.outcome.titulo}
                          </span>
                          <p className="text-xs font-semibold mt-0.5 text-slate-700 dark:text-slate-300">{m.outcome.descripcion}</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      </div>
                    )}

                    {/* Prompts Sugeridos */}
                    {m.prompts && m.prompts.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {m.prompts.map((pTxt, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleSendMessage(pTxt)}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
                          >
                            💡 {pTxt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 w-fit border border-slate-100 dark:border-slate-800">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Qwen 2.5 & Gemini analizando base de datos y herramientas comerciales...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Barra de Entrada de Chat Multimodal */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70 space-y-2">
              {/* Chip de Archivo Adjunto Pendiente */}
              {attachment && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs animate-fade-in">
                  {attachment.type === "image" ? (
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                  ) : attachment.type === "spreadsheet" ? (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span className="font-bold truncate max-w-xs">{attachment.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">({attachment.size})</span>
                  <button
                    onClick={() => setAttachment(null)}
                    className="p-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-900 transition text-slate-500 hover:text-rose-600 cursor-pointer ml-1"
                    title="Quitar adjunto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Banner de Estado de Escucha por Micrófono */}
              {isListening && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                    <span className="font-bold">🎙️ Escuchando dictado en vivo... Hablá sobre tus productos, metas o remarcaciones.</span>
                  </div>
                  <button
                    onClick={toggleListening}
                    className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700 cursor-pointer"
                  >
                    Terminar
                  </button>
                </div>
              )}

              {/* Formulario de Input */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.xlsx,.xls,.csv,.pdf,.txt"
                  className="hidden"
                />

                {/* Botón de Adjuntar Archivo */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileProcessing || chatLoading}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-600 transition shadow-xs cursor-pointer disabled:opacity-50"
                  title="Adjuntar foto de góndola, remisión, etiqueta o planilla Excel (.xlsx, .csv)"
                >
                  {fileProcessing ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Paperclip className="w-4 h-4" />}
                </button>

                {/* Campo de Texto Principal */}
                <input
                  type="text"
                  placeholder={
                    isListening
                      ? "Escuchando tu voz..."
                      : attachment
                      ? `Escribí tu consulta sobre ${attachment.name}...`
                      : "Escribí tu consulta, adjuntá una planilla o hablá por micrófono..."
                  }
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="flex-1 px-4 py-3 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />

                {/* Botón de Voz / Micrófono */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-3 rounded-2xl transition shadow-xs cursor-pointer ${
                    isListening
                      ? "bg-rose-600 text-white animate-bounce shadow-md shadow-rose-500/30"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700"
                  }`}
                  title={isListening ? "Detener dictado" : "Dictar por voz (micrófono)"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Botón de Enviar */}
                <button
                  onClick={() => handleSendMessage()}
                  disabled={(!inputMessage.trim() && !attachment) || chatLoading}
                  className="p-3 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Enviar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 6: PLAN DE ACCIÓN 1-CLICK ══════════════════════ */}
      {!loading && tab === "acciones" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Acciones Estratégicas del Día & Operaciones 1-Click
            </h3>
            <div className="space-y-3">
              {analysis?.plan_accion_diario?.map((a: any) => {
                const completed = a.estado === "completado"
                return (
                  <div
                    key={a.id}
                    className={`p-5 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      completed
                        ? "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          a.prioridad === "critica" ? "bg-rose-100 text-rose-800" :
                          a.prioridad === "alta" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                        }`}>
                          {a.prioridad}
                        </span>
                        <span className="text-xs font-bold text-slate-500">{a.area}</span>
                        {a.responsable_sugerido && (
                          <span className="text-[11px] text-indigo-600 font-medium">· {a.responsable_sugerido}</span>
                        )}
                      </div>
                      <h4 className={`text-sm font-bold ${completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                        {a.titulo}
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{a.descripcion}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!completed && (
                        <>
                          <button
                            onClick={() => handleExecuteTask(a, "alerta_whatsapp")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            WhatsApp
                          </button>
                          <button
                            onClick={() => handleDiscardTask(a.id)}
                            className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 text-xs font-bold transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ MODAL DE METAS CONFIGURABLES ══════════════════════ */}
      {settingsModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Configurar Metas de Margen</h3>
              <button onClick={() => setSettingsModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Margen Mínimo Aceptable (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={targetMinPct}
                  onChange={(e) => setTargetMinPct(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Margen Óptimo / Meta Ideal (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={targetIdealPct}
                  onChange={(e) => setTargetIdealPct(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setSettingsModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500">Cancelar</button>
              <button onClick={handleSaveSettings} className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700">Guardar Metas</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════ MODAL DE AJUSTE Y APLICACIÓN DE PRECIO ══════════════════════ */}
      {modalProposal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Ajustar & Aplicar a POS</h3>
                <p className="text-xs text-slate-500">{modalProposal.nombre}</p>
              </div>
              <button onClick={closePriceModal} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Precio Actual</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{formatPYG(modalProposal.precio_actual)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Costo Real</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{formatPYG(modalProposal.costo_unitario)}</p>
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nuevo Precio de Venta (PYG)</label>
                <input
                  type="number"
                  step="50"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Motivo del Ajuste</label>
                <input
                  type="text"
                  value={customMotivo}
                  onChange={(e) => setCustomMotivo(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={closePriceModal} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500">Cancelar</button>
              <button
                onClick={handleApplyPrice}
                disabled={applyingPrice !== null}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
              >
                {applyingPrice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirmar y Aplicar a POS
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
