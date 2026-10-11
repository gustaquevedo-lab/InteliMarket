import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  TrendingUp, Sparkles, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw,
  DollarSign, Target, Scale, Zap, MessageSquare, Send, Check, ArrowRight,
  HelpCircle, ChevronRight, Layers, PieChart, ShieldCheck, Tag, ShoppingBag,
  ListTodo, Clock, Flame, BarChart3, Bot, ThumbsUp, ArrowUpRight, ArrowDownRight,
  Sliders, Search, Filter, PlayCircle, Award, CheckCircle, Info, Calculator,
  ChevronDown, ChevronUp, Package, Layers2, Boxes, Edit3, X, Activity, UserCheck,
  Star, Brain, Phone, Settings, Calendar
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatPYG, formatDate, formatDateTime } from "../../utils/format"

type AgentTab = "rentabilidad" | "pareto" | "precios" | "simulador" | "chat" | "acciones"
type PeriodType = "mes_actual" | "mes_anterior" | "ultimos_30_dias" | "personalizado"

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

  // Estado de Chat
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; outcome?: any; prompts?: string[] }>>([
    {
      role: "assistant",
      content: "👋 **Buenas tardes. Bienvenido a la Torre de Control Comercial del Gerente de Ventas IA.**\n\nEstoy conectado en tiempo real a la base de datos de **Extra Supermercado** con inferencia local de IA y capacidad de ejecutar acciones.\n\n¿En qué área comercial o remarcación deseas que nos enfoquemos hoy?",
      prompts: [
        "¿Cuáles son los productos con peor margen?",
        "Ver desglose de Pareto Clase A",
        "Modificar meta general a 22%",
        "Propuestas de precios en Carnicería"
      ]
    }
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

          {/* Desglose por Departamento */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Rendimiento por Departamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analysis.rentabilidad_por_departamento?.map((d: any, idx: number) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{d.departamento}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      d.margen_actual_pct >= d.target_sugerido_pct ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300" :
                      d.margen_actual_pct >= 15 ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300" :
                      "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                    }`}>
                      {d.margen_actual_pct}%
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-500">Facturación: {formatPYG(d.facturacion_gs)}</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{d.estrategia}</p>
                </div>
              ))}
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

      {/* ══════════════════════ PESTAÑA 5: COPILOTO COMERCIAL IA (REACT + MEMORIA) ══════════════════════ */}
      {!loading && tab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Perfil y Memoria del Negocio */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Gerente Comercial Autónomo</h3>
                  <p className="text-[11px] text-slate-500">Inferencia local Qwen 2.5 7B en Ollama</p>
                </div>
              </div>

              {/* Memoria de Reglas del Negocio */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Brain className="w-3.5 h-3.5 text-indigo-500" />
                  Memoria Activa del Negocio ({businessRules.length})
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={handleCreateRule}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Chat Interactivo */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[600px] overflow-hidden">
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div className={`max-w-xl p-4 rounded-2xl text-xs space-y-2 ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800"
                  }`}>
                    <div className="whitespace-pre-line leading-relaxed font-sans">{m.content}</div>

                    {/* Outcome de acción */}
                    {m.outcome && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                        <span className="font-bold text-indigo-600 uppercase text-[10px]">{m.outcome.titulo}</span>
                        <p className="text-slate-600 dark:text-slate-300">{m.outcome.descripcion}</p>
                      </div>
                    )}

                    {/* Prompts Sugeridos */}
                    {m.prompts && m.prompts.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {m.prompts.map((pTxt, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleSendMessage(pTxt)}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 transition"
                          >
                            {pTxt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  Qwen 2.5 consultando herramientas y base de datos...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Chat */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder="Escribí una consulta comercial, remarcación o directiva..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 px-4 py-2 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={chatLoading}
                className="p-2.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
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
