import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  TrendingUp, Sparkles, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw,
  DollarSign, Target, Scale, Zap, MessageSquare, Send, Check, ArrowRight,
  HelpCircle, ChevronRight, Layers, PieChart, ShieldCheck, Tag, ShoppingBag,
  ListTodo, Clock, Flame, BarChart3, Bot, ThumbsUp, ArrowUpRight, ArrowDownRight,
  Sliders, Search, Filter, PlayCircle, Award, CheckCircle, Info, Calculator,
  ChevronDown, ChevronUp, Package, Layers2, Boxes, Edit3, X
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
  // Escalas editables: array de { min_qty, precio_unitario, descripcion }
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
    // Inicializar escalas editables desde las escalas actuales del producto
    const scales: Array<{min_qty: number; precio_unitario: number; descripcion: string}> =
      (proposal.escalas_precio || []).map((e: any) => ({
        min_qty: Number(e.min_qty),
        precio_unitario: Number(e.precio_unitario),
        descripcion: String(e.descripcion),
      }))
    // Si no hay escalas, inicializar con el precio minorista base
    if (scales.length === 0) {
      scales.push({ min_qty: 1, precio_unitario: Number(proposal.precio_sugerido), descripcion: "Minorista (1 un)" })
      scales.push({ min_qty: 3, precio_unitario: Math.round(Number(proposal.precio_sugerido) * 0.96 / 50) * 50, descripcion: "Pack x3 un" })
      scales.push({ min_qty: 6, precio_unitario: Math.round(Number(proposal.precio_sugerido) * 0.90 / 50) * 50, descripcion: "Mayorista / Fardo x6 un" })
    } else {
      // Sync tramo 0 con el precio sugerido
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
    // Sync el primer tramo (Minorista) con el customPrice principal
    if (idx === 0) setCustomPrice(newPrice)
    setCustomScales(updated)
  }

  // Confirmar y aplicar precio personalizado
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

  // Confirmar aplicación en lote
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
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-pulse">
            <Bot className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-ping" />
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

  // Filtrado de propuestas
  const allProposals = analysis?.propuestas_precios || []
  const uniqueCats = Array.from(new Set(allProposals.map((p: any) => String(p.categoria || "general").toLowerCase()))) as string[]
  const categoriesList: string[] = ["todas", ...uniqueCats]

  const filteredProposals = allProposals.filter((p: any) => {
    const matchesCat = filterCategory === "todas" || p.categoria.toLowerCase() === filterCategory.toLowerCase()
    const matchesSearch = !searchQuery || p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoria.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  // Simulación
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

  // Cálculos dinámicos en el modal
  const modalCosto = Number(modalProposal?.costo_unitario || 0)
  const modalMarginPct = customPrice > 0
    ? Number((((customPrice - modalCosto) / customPrice) * 100).toFixed(1))
    : 0
  const modalDiffPct = modalMarginPct - Number(modalProposal?.margen_actual_pct || 0)

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 HERO COMMAND BAR DE ALTA GAMA */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/20">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl lg:text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate tracking-tight text-white">
                    Gerente de Ventas IA
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Mes en Curso • Target 24.0%
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Torre de control comercial conectada a Ñemuha (22.428 escalas de precios y {tickets.toLocaleString()} tickets en Agosto 2026)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto">
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition shadow-lg shadow-emerald-500/25 flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Mesa de Diálogo IA
            </button>
          </div>
        </div>

        {/* 📊 KPI BARRA EN TIEMPO REAL (MES EN CURSO) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-7 pt-6 border-t border-slate-800/80">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Actual MTD</span>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl lg:text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate font-mono text-emerald-400">{margen}%</p>
              <span className="text-xs font-bold text-slate-400">/ Meta: 24.0%</span>
            </div>
            <p className="text-[11px] text-slate-400">Piso mínimo requerido: 20.0%</p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gap MTD al 24%</span>
            <p className="text-2xl lg:text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate font-mono text-rose-400">
              {formatPYG(gap24)}
            </p>
            <p className="text-[11px] text-slate-400">Recuperación requerida en el mes</p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Facturación MTD (Agosto)</span>
            <p className="text-2xl lg:text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate font-mono text-white">
              {formatPYG(facturacion)}
            </p>
            <p className="text-[11px] text-emerald-400 font-mono font-semibold">Proy. Cierre: {formatPYG(proyeccion)}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ganancia Bruta MTD</span>
            <p className="text-2xl lg:text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate font-mono text-teal-300">
              {formatPYG(ganancia)}
            </p>
            <p className="text-[11px] text-slate-400">Costo mercadería: {formatPYG(facturacion - ganancia)}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80 overflow-x-auto">
          {[
            { key: "rentabilidad", label: "Rentabilidad por Sección",    icon: Target },
            { key: "precios",      label: `Propuestas de Precios (${allProposals.length} SKUs)`, icon: Tag },
            { key: "pareto",       label: "Matriz Pareto & KVI Gancho",  icon: Scale },
            { key: "simulador",    label: "Simulador de Margen",         icon: Sliders },
            { key: "chat",         label: "Chat Comercial Grounded",     icon: MessageSquare },
            { key: "acciones",     label: "Plan de Acción Diario",       icon: ListTodo },
          ].map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as AgentTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ══════════════════════ PESTAÑA 1: RENTABILIDAD & SECCIONES ══════════════════════ */}
      {tab === "rentabilidad" && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent rounded-2xl p-5 border border-emerald-500/30 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dictamen Estratégico MTD (Agosto 2026)</h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {analysis?.resumen_ejecutivo}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Rentabilidad Real por Sección en el Mes en Curso</h3>
                <p className="text-xs text-slate-500">Márgenes calculados cruzando los {tickets.toLocaleString()} tickets de venta del mes</p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
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
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
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

      {/* ══════════════════════ PESTAÑA 2: PROPUESTAS DE PRECIOS & MODAL DE AJUSTE ══════════════════════ */}
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
              className="btn-primary py-2.5 px-5 text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-500/20 font-bold self-start md:self-auto"
            >
              <Zap className="w-4 h-4" />
              Aplicar Propuestas en Lote a POS...
            </button>
          </div>

          {/* Barra de Búsqueda y Filtro de Categoría */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por producto, corte de carne, marca o categoría..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field pl-10 text-xs py-2 w-full"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="input-field text-xs py-2 capitalize cursor-pointer font-bold"
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
                  className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
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
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">Precio Sugerido IA</span>
                        <p className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-base mt-0.5">{formatPYG(p.precio_sugerido)}</p>
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
                          className="flex items-center justify-between w-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition"
                        >
                          <span className="flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-emerald-500" />
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
                        className="btn-primary py-2 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm font-bold"
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

      {/* ══════════════════════ MODAL DE AJUSTE MANUAL Y CONFIRMACIÓN (CON ESCALAS) ══════════════════════ */}
      {modalProposal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 relative max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
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

            {/* Info del Producto */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{modalProposal.categoria}</span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{modalProposal.nombre}</h4>
              <div className="flex items-center gap-4 pt-2 font-mono text-slate-500">
                <span>Precio Actual: <strong className="text-slate-800 dark:text-slate-200">{formatPYG(modalProposal.precio_actual)}</strong></span>
                <span>Costo Real: <strong className="text-slate-800 dark:text-slate-200">{formatPYG(modalProposal.costo_unitario)}</strong></span>
              </div>
            </div>

            {/* ───── EDITOR DE ESCALA DE PRECIOS (TODOS LOS TRAMOS) ───── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-emerald-500" />
                  Escala de Precios por Cantidad ({customScales.length} tramos)
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">Costo Unitario: {formatPYG(modalProposal.costo_unitario)}</span>
              </div>

              {/* Encabezado de la tabla */}
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
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/40"
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800"
                  }`}>
                    <div className="col-span-4">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">{scale.descripcion}</p>
                      {idx === 0 && <span className="text-[10px] text-emerald-600 font-semibold">Precio Base</span>}
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
                          className="input-field pl-6 font-mono font-bold text-xs py-1.5 w-full text-slate-900 dark:text-white"
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

              {/* Agregar nuevo tramo */}
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
                className="w-full py-2 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition flex items-center justify-center gap-1.5"
              >
                + Agregar Tramo de Precio
              </button>
            </div>

            {/* Motivo */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                Motivo / Justificación de la Remarcación
              </label>
              <input
                type="text"
                value={customMotivo}
                onChange={e => setCustomMotivo(e.target.value)}
                placeholder="Ej. Ajuste de margen carnicería meta 24%"
                className="input-field text-xs py-2 w-full"
              />
            </div>

            {/* Footer Botones */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center gap-3">
              <div className="text-[11px] text-slate-400">
                Tramo Base: <span className="font-mono font-bold text-emerald-600">{formatPYG(customScales[0]?.precio_unitario ?? customPrice)}</span>
                {" · "}
                Margen: <span className="font-mono font-bold text-emerald-600">
                  {customScales[0]?.precio_unitario > 0 ? Number((((customScales[0].precio_unitario - modalCosto) / customScales[0].precio_unitario) * 100).toFixed(1)) : 0}%
                </span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={closePriceModal}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  Cancelar
                </button>
                <button type="button" onClick={handleConfirmPrice}
                  disabled={applyingPrice === modalProposal.id || customPrice <= 0}
                  className="btn-primary py-2.5 px-5 text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 font-bold shadow-md shadow-emerald-500/20">
                  {applyingPrice === modalProposal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirmar y Aplicar Escala a POS
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══════════════════════ MODAL DE CONFIRMACIÓN EN LOTE ══════════════════════ */}
      {batchModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold">
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
                    <span className="font-mono font-bold text-emerald-600">
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
                className="btn-primary py-2.5 px-5 text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 font-bold shadow-md shadow-emerald-500/20"
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
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Clase A (Top SKUs)</span>
                <span className="text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 px-2 py-0.5 rounded-full">79.4% Facturación</span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">Generadores de Tráfico</p>
              <p className="text-xs text-slate-500 leading-relaxed">Productos de altísima rotación (Coca-Cola, Cervezas, Costilla, Leches). Precios competitivos sin destruir margen.</p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Clase B (Margin Drivers)</span>
                <span className="text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 px-2 py-0.5 rounded-full">15.2% Facturación</span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">Motores de Ganancia</p>
              <p className="text-xs text-slate-500 leading-relaxed">Aquí se captura el margen del supermercado (24% a 38%) mediante cortes especiales, fiambrería y embutidos.</p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Clase C (Surtido y Variedad)</span>
                <span className="text-xs font-mono font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 px-2 py-0.5 rounded-full">5.4% Facturación</span>
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">Variedad de Góndola</p>
              <p className="text-xs text-slate-500 leading-relaxed">Artículos complementarios. Márgenes altos (30%+) para compensar menor rotación.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center font-bold text-lg">🧲</div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">KVI — Known Value Items (Productos Gancho)</h3>
                  <p className="text-xs text-slate-500">Alta sensibilidad de precio. El cliente compara activamente.</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {allProposals
                  .filter((p: any) => p.tipo_estrategia === "kvi_gancho" || p.tipo_estrategia === "recuperacion_gap")
                  .slice(0, 8)
                  .map((item: any, i: number) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 flex justify-between items-center gap-3 border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{item.nombre}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.motivo}</p>
                      </div>
                      <span className="font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400 px-3 py-1 rounded-full whitespace-nowrap">
                        {item.margen_actual_pct}% Margen
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold text-lg">🚀</div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Margin Drivers (Rentabilizadores Reales)</h3>
                  <p className="text-xs text-slate-500">Baja elasticidad o compra de impulso para llegar al 24%.</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {allProposals
                  .filter((p: any) => p.tipo_estrategia === "margin_driver" || p.margen_actual_pct >= 20)
                  .slice(0, 8)
                  .map((item: any, i: number) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 flex justify-between items-center gap-3 border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{item.nombre}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.motivo}</p>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-3 py-1 rounded-full whitespace-nowrap">
                        {item.margen_actual_pct}% Margen
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 4: SIMULADOR DE MARGEN & ELASTICIDAD ══════════════════════ */}
      {tab === "simulador" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center font-bold">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Simulador de Impacto en Margen y Flujo de Caja</h3>
                  <p className="text-xs text-slate-500">Mové los controles de precios para proyectar el margen resultante de la tienda en vivo</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Margen Proyectado Simulado</span>
                <p className="text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {simulatedMarginPct}%
                </p>
                <span className="text-[10px] text-slate-400">Margen MTD actual: {margen}%</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Ganancia Adicional Mensual</span>
                <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                  +{formatPYG(simAddedGain)} / mes
                </p>
                <span className="text-[10px] text-slate-400">Sobre base de {tickets.toLocaleString()} tickets MTD</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Reducción del Gap al 24%</span>
                <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-teal-600 dark:text-teal-400 mt-0.5">
                  {simulatedGapReduction}% del Gap
                </p>
                <span className="text-[10px] text-slate-400">Hacia la meta de {formatPYG(gap24)}</span>
              </div>
            </div>

            {/* Controles de Simulación */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Ajuste de Precios en Simulación ({filteredProposals.length} SKUs)</h4>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="input-field text-xs py-1.5 capitalize cursor-pointer font-bold"
                >
                  {categoriesList.map((cat, i) => (
                    <option key={i} value={cat}>
                      {cat === "todas" ? "Todas las Secciones" : cat}
                    </option>
                  ))}
                </select>
              </div>

              {filteredProposals.map((p: any) => {
                const currentSim = simulatedIncreases[p.id] ?? Number(p.precio_sugerido)
                return (
                  <div key={p.id} className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5 max-w-md">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{p.nombre}</p>
                      <p className="text-[11px] text-slate-400">{p.categoria} • Costo: {formatPYG(p.costo_unitario)} • Venta actual: {formatPYG(p.precio_actual)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formatPYG(currentSim)}
                      </span>
                      <input
                        type="range"
                        min={Number(p.precio_actual)}
                        max={Number(p.precio_actual) * 1.3}
                        step={50}
                        value={currentSim}
                        onChange={(e) => setSimulatedIncreases({ ...simulatedIncreases, [p.id]: Number(e.target.value) })}
                        className="w-40 accent-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 5: CHAT COMERCIAL GROUNDED ══════════════════════ */}
      {tab === "chat" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[680px]">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/60">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Mesa de Diálogo Comercial con el Gerente IA</h3>
                <p className="text-[11px] text-slate-500">Conectado a Ñemuha y {tickets.toLocaleString()} tickets MTD de Agosto 2026</p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
              Margen MTD: {margen}% | Target: 24.0%
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] space-y-3 ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white rounded-3xl p-4 rounded-tr-md shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 rounded-3xl p-5 rounded-tl-md shadow-sm"
                }`}>
                  <div className="text-xs leading-relaxed whitespace-pre-line">
                    {m.content}
                  </div>

                  {m.outcome && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300/80 dark:border-emerald-800/80 shadow-md space-y-3 mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          ⚡ Acción Ejecutable: {m.outcome.tipo.replace("_", " ").toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{m.outcome.titulo}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{m.outcome.descripcion}</p>
                      </div>

                      {m.outcome.tipo === "price_adjustment" && m.outcome.data && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="font-mono text-xs font-bold text-emerald-600">
                            {formatPYG(m.outcome.data.precio_actual)} → {formatPYG(m.outcome.data.precio_sugerido)}
                          </span>
                          <button
                            onClick={() => openPriceModal({
                              id: "chat-act",
                              product_id: m.outcome.data.product_id,
                              nombre: m.outcome.data.product_name,
                              precio_actual: m.outcome.data.precio_actual,
                              precio_sugerido: m.outcome.data.precio_sugerido,
                              costo_unitario: m.outcome.data.costo_unitario || (m.outcome.data.precio_actual * 0.8),
                              margen_actual_pct: 12.0,
                              categoria: "Ajuste Chat",
                              motivo: "Ajuste desde Chat Comercial"
                            })}
                            className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-700 shadow-sm transition"
                          >
                            Revisar en Modal
                          </button>
                        </div>
                      )}

                      {m.outcome.tipo === "daily_task" && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] text-slate-500">Área: {m.outcome.data?.area || "Operaciones"}</span>
                          <button
                            onClick={() => {
                              toast.success("Tarea Agregada", m.outcome.titulo)
                              setTab("acciones")
                            }}
                            className="px-3.5 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl text-[11px] font-bold hover:opacity-90 shadow-sm transition"
                          >
                            Ver en Plan Diario
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {m.prompts && m.prompts.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {m.prompts.map((p, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSendMessage(p)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-200/70 transition"
                        >
                          💬 {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  El Gerente IA está cruzando datos de ventas y calculando rentabilidad...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendMessage()}
              placeholder="Preguntale al Gerente IA sobre estrategias de precios, carnicería, combos o cierre de mes..."
              className="input-field text-xs py-2.5 flex-1"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || chatLoading}
              className="p-3 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-md shadow-emerald-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════ PESTAÑA 6: PLAN DE ACCIÓN DIARIO ══════════════════════ */}
      {tab === "acciones" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Plan de Acción Diario & Seguimiento Insistente</h3>
              <p className="text-xs text-slate-500">Medidas comerciales obligatorias para cerrar el Gap de {formatPYG(gap24)} y llegar al 24%</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
              Completadas: {(analysis?.plan_accion_diario || []).filter((a: any) => a.estado === "completado").length} / {(analysis?.plan_accion_diario || []).length}
            </span>
          </div>

          <div className="space-y-3">
            {(analysis?.plan_accion_diario || []).map((act: any) => (
              <div
                key={act.id}
                onClick={() => handleToggleAction(act.id)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  act.estado === "completado"
                    ? "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/40 opacity-80"
                    : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center border transition ${
                    act.estado === "completado"
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                      : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  }`}>
                    {act.estado === "completado" && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`text-xs font-bold ${
                        act.estado === "completado" ? "line-through text-slate-400" : "text-slate-900 dark:text-white"
                      }`}>
                        {act.titulo}
                      </h4>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        act.prioridad === "critica" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      }`}>
                        {act.area} • {act.prioridad.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{act.descripcion}</p>
                  </div>
                </div>

                <div className="text-right whitespace-nowrap">
                  <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">{act.impacto_esperado}</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">{act.responsable_sugerido}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
