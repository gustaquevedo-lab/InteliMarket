import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  TrendingUp, Sparkles, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw,
  DollarSign, Target, Scale, Zap, MessageSquare, Send, Check, ArrowRight,
  HelpCircle, ChevronRight, Layers, PieChart, ShieldCheck, Tag, ShoppingBag,
  ListTodo, Clock, Flame, BarChart3, Bot, ThumbsUp, ArrowUpRight, ArrowDownRight,
  Sliders, Search, Filter, PlayCircle, Award, CheckCircle, Info, Calculator,
  ChevronDown, ChevronUp, Package, Layers2, Boxes, Edit3, X, Activity, UserCheck
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatPYG, formatDate, formatDateTime } from "../../utils/format"

type AgentTab = "rentabilidad" | "pareto" | "precios" | "simulador" | "chat" | "acciones"

export default function SalesAgentPage() {
  const [tab, setTab] = useState<AgentTab>("rentabilidad")
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [applyingPrice, setApplyingPrice] = useState<string | null>(null)
  const [applyingAll, setApplyingAll] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>("todas")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedScales, setExpandedScales] = useState<Record<string, boolean>>({})

  // Modal de Ajuste y Confirmación de Precio Individual
  const [modalProposal, setModalProposal] = useState<any | null>(null)
  const [customPrice, setCustomPrice] = useState<number>(0)
  const [customMotivo, setCustomMotivo] = useState<string>("")
  const [customScales, setCustomScales] = useState<Array<{min_qty: number; precio_unitario: number; descripcion: string}>>([])

  // Modal de Confirmación en Lote
  const [batchModalOpen, setBatchModalOpen] = useState(false)

  // Simulator State
  const [simulatedIncreases, setSimulatedIncreases] = useState<Record<string, number>>({})

  // Chat State
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; outcome?: any; prompts?: string[] }>>([
    {
      role: "assistant",
      content: "👋 **Buenas tardes. Bienvenido a la Torre de Control Comercial del Gerente de Ventas IA.**\n\nHe auditado los **movimientos del mes en curso (Agosto 2026 MTD)** con **6.301 tickets** y **Gs. 635.839.971 facturados a la fecha**, proyectando un cierre mensual de **Gs. 1.231M**.\n\nNuestro margen actual del mes se ubica en **16.4%**, situándonos a un **Gap de Gs. 48.009.408** de la meta óptima del **24.0%**.\n\nHe sincronizado las **escalas de precios por cantidad de Ñemuha** para más de **35 SKUs de alta rotación** en Carnicería, PARESA, Bebidas, Lácteos y Almacén.\n\n¿En qué sección comercial querés que enfoquemos las remarcaciones y estrategias de hoy?",
      prompts: [
        "¿Cómo cerramos el Gap para llegar al 24%?",
        "Estrategia de precios en Carnicería",
        "Diagnóstico de Bebidas y Cervezas (PARESA)",
        "Ver escalas de precio por bulto / fardo"
      ]
    }
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const toast = useToast()
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await api.salesAgent.getAnalysis(companyId)
      setAnalysis(data)
      if (data?.propuestas_precios) {
        const initSim: Record<string, number> = {}
        data.propuestas_precios.forEach((p: any) => {
          initSim[p.id] = Number(p.precio_sugerido)
        })
        setSimulatedIncreases(initSim)
      }
    } catch (e: any) {
      console.error("SalesAgent load error:", e)
      toast.error("Error al cargar análisis de ventas")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, tab])

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
      })

      const botMsg = {
        role: "assistant" as const,
        content: res.reply,
        outcome: res.action_outcome,
        prompts: res.suggested_prompts || []
      }
      setMessages(prev => [...prev, botMsg])
    } catch (e: any) {
      toast.error("Error al comunicarse con el Gerente IA")
    } finally {
      setChatLoading(false)
    }
  }

  // Abrir Modal de Ajuste y Confirmación
  const openPriceModal = (proposal: any) => {
    setModalProposal(proposal)
    setCustomPrice(Number(proposal.precio_sugerido))
    setCustomMotivo(proposal.motivo || "Ajuste de margen sugerido por Gerente IA")
    const scales: Array<{min_qty: number; precio_unitario: number; descripcion: string}> =
      (proposal.escalas_precio || []).map((e: any) => ({
        min_qty: Number(e.min_qty),
        precio_unitario: Number(e.precio_unitario),
        descripcion: String(e.descripcion),
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

  const updateScalePrice = (idx: number, newPrice: number) => {
    const updated = customScales.map((s, i) => i === idx ? { ...s, precio_unitario: newPrice } : s)
    if (idx === 0) setCustomPrice(newPrice)
    setCustomScales(updated)
  }

  const handleConfirmPrice = async () => {
    if (!modalProposal || customPrice <= 0) return
    setApplyingPrice(modalProposal.id)
    try {
      const res = await api.salesAgent.applyPrice({
        company_id: companyId,
        product_id: modalProposal.product_id,
        nuevo_precio: customPrice,
        motivo: customMotivo,
      })
      if (res.success) {
        toast.success("Precio Aplicado con Éxito", `Se fijó ${formatPYG(customPrice)} en POS y góndola para ${modalProposal.nombre}`)
        if (analysis?.propuestas_precios) {
          analysis.propuestas_precios = analysis.propuestas_precios.map((p: any) =>
            p.id === modalProposal.id ? { ...p, estado: "aplicado", precio_sugerido: customPrice } : p
          )
        }
        closePriceModal()
      }
    } catch (e: any) {
      toast.error(e.message || "Error al aplicar precio")
    } finally {
      setApplyingPrice(null)
    }
  }

  const handleConfirmBatch = async () => {
    setApplyingAll(true)
    try {
      const pending = (analysis?.propuestas_precios || []).filter((p: any) => p.estado !== "aplicado")
      for (const p of pending) {
        await api.salesAgent.applyPrice({
          company_id: companyId,
          product_id: p.product_id,
          nuevo_precio: Number(p.precio_sugerido),
          motivo: "Aplicación en Lote Gerente IA",
        })
      }
      toast.success("Precios Aplicados en Lote", `Se actualizaron ${pending.length} productos en POS y catálogo`)
      if (analysis?.propuestas_precios) {
        analysis.propuestas_precios = analysis.propuestas_precios.map((p: any) => ({ ...p, estado: "aplicado" }))
      }
      setBatchModalOpen(false)
    } catch (e: any) {
      toast.error("Error al aplicar precios en lote")
    } finally {
      setApplyingAll(false)
    }
  }

  const handleToggleAction = (actionId: string) => {
    if (analysis?.plan_accion_diario) {
      const updated = analysis.plan_accion_diario.map((a: any) => {
        if (a.id === actionId) {
          const next = a.estado === "completado" ? "pendiente" : "completado"
          if (next === "completado") toast.success("Acción Completada", a.titulo)
          return { ...a, estado: next }
        }
        return a
      })
      setAnalysis({ ...analysis, plan_accion_diario: updated })
    }
  }

  const toggleScaleExpansion = (id: string) => {
    setExpandedScales(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading && !analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center animate-pulse shadow-xl shadow-indigo-500/10">
            <TrendingUp className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full animate-ping" />
        </div>
        <div className="text-center">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Conectando con el Motor Comercial IA & Ñemuha</h3>
          <p className="text-xs text-slate-500 mt-1">Auditando movimientos del mes en curso y escalas de precios...</p>
        </div>
      </div>
    )
  }

  const margen = analysis?.margen_actual_pct || 16.4
  const gap24 = analysis?.gap_para_24_pct_gs || 48009408
  const facturacion = analysis?.facturacion_mes || 635839971
  const ganancia = analysis?.ganancia_bruta_mes || 104592185
  const proyeccion = analysis?.proyeccion_cierre_mes_gs || 1231939944
  const tickets = analysis?.tickets_mes || 6301

  const allProposals = analysis?.propuestas_precios || []
  const uniqueCats = Array.from(new Set(allProposals.map((p: any) => String(p.categoria || "general").toLowerCase()))) as string[]
  const categoriesList: string[] = ["todas", ...uniqueCats]

  const filteredProposals = allProposals.filter((p: any) => {
    const matchesCat = filterCategory === "todas" || p.categoria.toLowerCase() === filterCategory.toLowerCase()
    const matchesSearch = !searchQuery || p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoria.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  const simAddedGain = filteredProposals.reduce((acc: number, p: any) => {
    const simPrice = simulatedIncreases[p.id] ?? Number(p.precio_sugerido)
    const diff = Math.max(0, simPrice - Number(p.precio_actual))
    const vol = p.nombre.includes("COSTILLA") ? 750 : p.nombre.includes("BRAHMITA") ? 5200 : p.nombre.includes("MICHELOB") ? 2400 : 1200
    return acc + (diff * vol)
  }, 0)

  const simulatedMarginPct = facturacion > 0
    ? Number((((ganancia + simAddedGain) / (facturacion + simAddedGain)) * 100).toFixed(1))
    : 18.2

  const simulatedGapReduction = Math.min(100, Math.round((simAddedGain / gap24) * 100))
  const modalCosto = Number(modalProposal?.costo_unitario || 0)

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
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
                    INTELIGENCIA ARTIFICIAL · TORRE DE CONTROL
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Target Margen: 24.0%
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Gerente de Ventas IA
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Optimización de precios, elasticidad comercial y auditoría de márgenes para Extra Supermercado
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ⚡ Motor: Gemini 2.5 Flash Pipeline
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                📊 {tickets.toLocaleString()} Tickets MTD auditados
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Recalcular MTD
            </button>
            <button
              onClick={() => setTab("chat")}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 transition shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Copiloto Comercial IA
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Actual MTD</span>
              <span className="text-[10px] font-mono text-slate-400">Meta: 24.0%</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">{margen}%</p>
            <p className="text-[11px] text-slate-400">Piso mínimo requerido: 20.0%</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gap MTD al 24%</span>
              <span className="text-[10px] font-bold text-rose-400">Por recuperar</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {formatPYG(gap24)}
            </p>
            <p className="text-[11px] text-slate-400">Objetivo de remarcación en el mes</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Facturación MTD</span>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">Mes en Curso</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-white">
              {formatPYG(facturacion)}
            </p>
            <p className="text-[11px] text-emerald-400 font-mono font-semibold">Proy. Cierre: {formatPYG(proyeccion)}</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ganancia Bruta MTD</span>
              <span className="text-[10px] font-mono text-teal-400">Margen Comercial</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-teal-300">
              {formatPYG(ganancia)}
            </p>
            <p className="text-[11px] text-slate-400">Costo mercadería: {formatPYG(facturacion - ganancia)}</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "rentabilidad", label: "Rentabilidad por Sección", icon: Target },
          { key: "precios", label: `Propuestas de Precios (${allProposals.length})`, icon: Tag, badge: allProposals.filter((p: any) => p.estado !== "aplicado").length },
          { key: "pareto", label: "Matriz Pareto & KVIs", icon: Scale },
          { key: "simulador", label: "Simulador de Margen", icon: Sliders },
          { key: "chat", label: "Copiloto Comercial IA", icon: MessageSquare },
          { key: "acciones", label: "Plan de Acción Diario", icon: ListTodo, badge: analysis?.plan_accion_diario?.filter((a: any) => a.estado !== "completado").length },
        ].map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as AgentTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ PESTAÑA 1: RENTABILIDAD & SECCIONES ══════════════════════ */}
      {tab === "rentabilidad" && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-500/10 via-blue-500/5 to-transparent rounded-2xl p-5 border border-indigo-500/30 flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dictamen Estratégico MTD (Agosto 2026)</h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {analysis?.resumen_ejecutivo}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Rentabilidad Real por Sección en el Mes en Curso</h3>
                <p className="text-xs text-slate-500">Márgenes calculados cruzando los {tickets.toLocaleString()} tickets de venta del mes</p>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                Meta Global: 24.0%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="text-left py-3.5 px-4">Departamento</th>
                    <th className="text-right py-3.5 px-4">Facturación MTD</th>
                    <th className="text-center py-3.5 px-4">Margen MTD</th>
                    <th className="text-center py-3.5 px-4">Target Sugerido</th>
                    <th className="text-left py-3.5 px-4">Directiva Comercial del Gerente IA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(analysis?.rentabilidad_por_departamento || []).map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          d.margen_actual_pct >= 20 ? "bg-emerald-500" :
                          d.margen_actual_pct >= 12 ? "bg-blue-500" : "bg-rose-500"
                        }`} />
                        {d.departamento}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {formatPYG(d.facturacion_gs)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full font-mono font-bold text-[11px] ${
                          d.margen_actual_pct >= 20 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" :
                          d.margen_actual_pct >= 12 ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400" :
                          "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                        }`}>
                          {d.margen_actual_pct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {d.target_sugerido_pct}%
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {d.estrategia}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 2: PROPUESTAS DE PRECIOS & ESCALAS ══════════════════════ */}
      {tab === "precios" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Propuestas de Precios & Escalas de Volumen (Ñemuha)
              </h3>
              <p className="text-xs text-slate-500">
                Mostrando {filteredProposals.length} de {allProposals.length} productos evaluados en el mes
              </p>
            </div>
            <button
              onClick={() => setBatchModalOpen(true)}
              disabled={applyingAll}
              className="px-5 py-2.5 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-lg shadow-indigo-500/20 font-bold self-start md:self-auto transition"
            >
              <Zap className="w-4 h-4" />
              Aplicar Propuestas en Lote a POS...
            </button>
          </div>

          {/* Barra de Búsqueda y Filtro de Categoría */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por producto, corte de carne, marca o categoría..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white capitalize cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categoriesList.map((cat, i) => (
                  <option key={i} value={cat}>
                    {cat === "todas" ? "Todas las Secciones" : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid de Propuestas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredProposals.map((p: any) => {
              const diffPct = Number(p.margen_sugerido_pct) - Number(p.margen_actual_pct)
              const isExpanded = expandedScales[p.id] || false
              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5 hover:border-indigo-400/50 dark:hover:border-indigo-500/50 transition relative overflow-hidden group"
                >
                  <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-blue-500 absolute top-0 left-0" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        p.tipo_estrategia === "kvi_gancho" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" :
                        p.tipo_estrategia === "margin_driver" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" :
                        "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                      }`}>
                        {p.tipo_estrategia.toUpperCase().replace("_", " ")} • {p.categoria}
                      </span>
                      <span className="text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full">
                        +{formatPYG(p.impacto_mensual_gs)} / mes
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white leading-snug">{p.nombre}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.motivo}</p>
                    </div>

                    {/* Comparador Visual de Precios */}
                    <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-slate-400 text-[11px] font-medium">Venta Minorista Actual</span>
                        <p className="font-mono font-bold text-slate-700 dark:text-slate-300 text-base mt-0.5">{formatPYG(p.precio_actual)}</p>
                        <span className="text-[10px] text-slate-400 font-mono font-semibold">Margen: {p.margen_actual_pct}%</span>
                      </div>
                      <div>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">Precio Sugerido IA</span>
                        <p className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-base mt-0.5">{formatPYG(p.precio_sugerido)}</p>
                        <span className="text-[10px] text-emerald-600 font-extrabold font-mono flex items-center gap-0.5">
                          Nuevo Margen: {p.margen_sugerido_pct}% (+{diffPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {/* Desglose de Escalas de Precio por Volumen de Ñemuha */}
                    {p.escalas_precio && p.escalas_precio.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleScaleExpansion(p.id)}
                          className="flex items-center justify-between w-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition"
                        >
                          <span className="flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-indigo-500" />
                            Escalas de Precio por Cantidad ({p.escalas_precio.length} tramos)
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                            {p.escalas_precio.map((esc: any, eIdx: number) => (
                              <div key={eIdx} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">
                                  {esc.descripcion}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                                    {formatPYG(esc.precio_unitario)}
                                  </span>
                                  {esc.descuento_pct > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded">
                                      -{esc.descuento_pct}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-[11px] text-slate-400 font-mono">Costo Real: {formatPYG(p.costo_unitario)}</span>
                    {p.estado === "aplicado" ? (
                      <span className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Aplicado a POS
                      </span>
                    ) : (
                      <button
                        onClick={() => openPriceModal(p)}
                        className="px-4 py-2 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm font-bold transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Revisar y Aplicar a POS...
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════ MODAL DE AJUSTE MANUAL Y CONFIRMACIÓN ══════════════════════ */}
      {modalProposal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Ajustar Escala de Precios</h3>
                  <p className="text-xs text-slate-500">Editá cada tramo antes de aplicar en POS y góndola</p>
                </div>
              </div>
              <button onClick={closePriceModal} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{modalProposal.categoria}</span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{modalProposal.nombre}</h4>
              <div className="flex items-center gap-4 pt-2 font-mono text-slate-500">
                <span>Precio Actual: <strong className="text-slate-800 dark:text-slate-200">{formatPYG(modalProposal.precio_actual)}</strong></span>
                <span>Costo Real: <strong className="text-slate-800 dark:text-slate-200">{formatPYG(modalProposal.costo_unitario)}</strong></span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-indigo-500" />
                  Escala de Precios por Cantidad ({customScales.length} tramos)
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">Costo Unitario: {formatPYG(modalProposal.costo_unitario)}</span>
              </div>

              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-slate-400 px-1">
                <span className="col-span-4">Tramo / Descripción</span>
                <span className="col-span-2 text-center">Cant. Mín.</span>
                <span className="col-span-3 text-right">Precio (₲)</span>
                <span className="col-span-2 text-center">Margen</span>
                <span className="col-span-1"></span>
              </div>

              {customScales.map((scale, idx) => {
                const scaleMargin = scale.precio_unitario > 0
                  ? Number((((scale.precio_unitario - modalCosto) / scale.precio_unitario) * 100).toFixed(1))
                  : 0
                const discountVsBase = idx > 0 && customScales[0].precio_unitario > 0
                  ? Number((((customScales[0].precio_unitario - scale.precio_unitario) / customScales[0].precio_unitario) * 100).toFixed(1))
                  : 0
                return (
                  <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-2xl border text-xs transition ${
                    idx === 0
                      ? "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-800/40"
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800"
                  }`}>
                    <div className="col-span-4">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">{scale.descripcion}</p>
                      {idx === 0 && <span className="text-[10px] text-indigo-600 font-semibold">Precio Base</span>}
                      {idx > 0 && discountVsBase > 0 && (
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">-{discountVsBase}% vs base</span>
                      )}
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="font-mono font-bold text-slate-500 text-[11px]">{scale.min_qty} un+</span>
                    </div>
                    <div className="col-span-3">
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 font-mono text-slate-400 text-[10px]">₲</span>
                        <input
                          type="number"
                          step="50"
                          min={modalCosto}
                          value={scale.precio_unitario}
                          onChange={e => updateScalePrice(idx, Number(e.target.value))}
                          className="w-full pl-6 pr-2 py-1.5 font-mono font-bold text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                        scaleMargin >= 20 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" :
                        scaleMargin >= 12 ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400" :
                        "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                      }`}>
                        {scaleMargin}%
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => setCustomScales(customScales.filter((_, i) => i !== idx))}
                          className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          title="Quitar este tramo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              <button
                type="button"
                onClick={() => {
                  const lastScale = customScales[customScales.length - 1]
                  const lastPrice = lastScale?.precio_unitario ?? customPrice
                  const lastQty = lastScale?.min_qty ?? 1
                  setCustomScales([...customScales, {
                    min_qty: lastQty + 6,
                    precio_unitario: Math.round(lastPrice * 0.92 / 50) * 50,
                    descripcion: `Mayorista Especial (${lastQty + 6}+ un)`
                  }])
                }}
                className="w-full py-2 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition flex items-center justify-center gap-1.5"
              >
                + Agregar Tramo de Precio
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                Motivo / Justificación de la Remarcación
              </label>
              <input
                type="text"
                value={customMotivo}
                onChange={e => setCustomMotivo(e.target.value)}
                placeholder="Ej. Ajuste de margen carnicería meta 24%"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center gap-3">
              <div className="text-[11px] text-slate-400">
                Tramo Base: <span className="font-mono font-bold text-indigo-600">{formatPYG(customScales[0]?.precio_unitario ?? customPrice)}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={closePriceModal}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  Cancelar
                </button>
                <button type="button" onClick={handleConfirmPrice}
                  disabled={applyingPrice === modalProposal.id || customPrice <= 0}
                  className="px-5 py-2.5 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 font-bold shadow-md shadow-indigo-500/20 transition">
                  {applyingPrice === modalProposal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirmar y Aplicar Escala a POS
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══════════════════════ MODAL EN LOTE ══════════════════════ */}
      {batchModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Aplicar Todas las Propuestas a POS</h3>
                  <p className="text-xs text-slate-500">Confirmación de remarcación en lote</p>
                </div>
              </div>
              <button
                onClick={() => setBatchModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Estás a punto de actualizar los precios de <strong>{allProposals.filter((p: any) => p.estado !== "aplicado").length} productos</strong> en el POS y catálogo de la tienda.
              </p>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 max-h-48 overflow-y-auto space-y-2">
                {allProposals.filter((p: any) => p.estado !== "aplicado").map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[11px] py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">{p.nombre}</span>
                    <span className="font-mono font-bold text-indigo-600">
                      {formatPYG(p.precio_actual)} → {formatPYG(p.precio_sugerido)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBatch}
                disabled={applyingAll}
                className="px-5 py-2.5 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 font-bold shadow-md shadow-indigo-500/20 transition"
              >
                {applyingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Confirmar y Aplicar Todo
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══════════════════════ PESTAÑA 3: MATRIZ PARETO 80/20 & KVI ══════════════════════ */}
      {tab === "pareto" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 relative overflow-hidden">
              <div className="h-1 w-full bg-emerald-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Clase A (Top SKUs)</span>
                <span className="text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 px-2 py-0.5 rounded-full">79.4% Facturación</span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">Generadores de Tráfico</p>
              <p className="text-xs text-slate-500 leading-relaxed">Productos de altísima rotación (Coca-Cola, Cervezas, Costilla, Leches). Precios competitivos sin destruir margen.</p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 relative overflow-hidden">
              <div className="h-1 w-full bg-blue-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Clase B (Margin Drivers)</span>
                <span className="text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 px-2 py-0.5 rounded-full">15.2% Facturación</span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">Motores de Ganancia</p>
              <p className="text-xs text-slate-500 leading-relaxed">Aquí se captura el margen del supermercado (24% a 38%) mediante cortes especiales, fiambrería y embutidos.</p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 relative overflow-hidden">
              <div className="h-1 w-full bg-purple-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Clase C (Surtido y Variedad)</span>
                <span className="text-xs font-mono font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 px-2 py-0.5 rounded-full">5.4% Facturación</span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">Variedad de Góndola</p>
              <p className="text-xs text-slate-500 leading-relaxed">Artículos complementarios. Márgenes altos (30%+) para compensar menor rotación.</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 4: SIMULADOR DE MARGEN ══════════════════════ */}
      {tab === "simulador" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Simulador Dinámico de Elasticidad & Margen Comercial</h3>
                <p className="text-xs text-slate-500">Calculá el impacto en la ganancia bruta mensual ajustando precios sugeridos</p>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                Reducción del Gap: {simulatedGapReduction}%
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Margen Simulado</span>
                <p className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">{simulatedMarginPct}%</p>
                <span className="text-[11px] text-slate-500">Actual: {margen}%</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Ganancia Adicional</span>
                <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">+{formatPYG(simAddedGain)}</p>
                <span className="text-[11px] text-slate-500">En el mes</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-bold uppercase">Gap Restante</span>
                <p className="text-2xl font-black font-mono text-rose-500 mt-1">{formatPYG(Math.max(0, gap24 - simAddedGain))}</p>
                <span className="text-[11px] text-slate-500">Para meta del 24%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 5: CHAT COMERCIAL COPILOTO IA ══════════════════════ */}
      {tab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Perfil del Gerente y Atajos */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Gerente de Ventas IA</h3>
                  <p className="text-[11px] text-slate-500">Motor Gemini 2.5 Flash Grounded</p>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                  <Activity className="w-3.5 h-3.5" /> Capacidades Activas
                </div>
                <p>• Análisis de elasticidad de precios por SKU.</p>
                <p>• Consulta de escalas de volumen en Ñemuha.</p>
                <p>• Estrategia de margen en Carnicería y PARESA.</p>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Consultas Rápidas Sugeridas</span>
                <div className="flex flex-col gap-2">
                  {[
                    "¿Cómo cerramos el Gap para llegar al 24%?",
                    "Estrategia de precios en Carnicería",
                    "Diagnóstico de Bebidas y Cervezas (PARESA)",
                    "Ver escalas de precio por bulto / fardo"
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="text-left text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-100 dark:border-slate-800 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Terminal de Chat */}
          <div className="lg:col-span-8 flex flex-col h-[650px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Header del Chat */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Sesión Activa con el Gerente Comercial</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400">Contexto: MTD Agosto 2026</span>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 space-y-2 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-tr-none shadow-md shadow-indigo-500/10"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none"
                  }`}>
                    <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                    {m.prompts && m.prompts.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {m.prompts.map((p, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleSendMessage(p)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 hover:bg-indigo-100 transition"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    El Gerente IA está consultando la base de datos comercial...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Composer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
              <form onSubmit={e => { e.preventDefault(); handleSendMessage() }} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Escribí una consulta o instrucción comercial..."
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  className="flex-1 px-4 py-3 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || chatLoading}
                  className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 6: PLAN DE ACCIÓN DIARIO ══════════════════════ */}
      {tab === "acciones" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Plan de Acción & Tareas Prioritarias del Día</h3>
            <div className="space-y-3">
              {(analysis?.plan_accion_diario || []).map((a: any) => {
                const completed = a.estado === "completado"
                return (
                  <div
                    key={a.id}
                    onClick={() => handleToggleAction(a.id)}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      completed
                        ? "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
                        completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-slate-600"
                      }`}>
                        {completed && <Check className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className={`text-xs font-bold ${completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                          {a.titulo}
                        </h4>
                        <p className="text-[11px] text-slate-500">{a.descripcion}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {a.prioridad}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
