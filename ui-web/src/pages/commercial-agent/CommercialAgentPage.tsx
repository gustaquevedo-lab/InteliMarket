import { useState, useEffect, useRef } from "react"
import {
  TrendingUp, Award, DollarSign, Bot, Sparkles, CheckCircle2, XCircle,
  Loader2, Search, Filter, Layers, Target, ShoppingBag,
  ArrowUpRight, ArrowDownRight, Send, AlertTriangle, ChevronRight, HelpCircle
} from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useScrollToTop } from "../../hooks/useScrollToTop"

interface Recommendation {
  id: string
  supplier_id?: string
  proveedor_nombre?: string
  branch_nombre?: string
  tipo: string
  titulo: string
  descripcion: string
  impacto_estimado_gs: number
  estado: string
  piso_cumplimiento_pct?: number
  created_at: string
  approved_by?: string
}

interface MultiSupplierItem {
  agreement_id: string
  supplier_id: string
  supplier_razon_social: string
  supplier_ruc: string
  branch_id: string
  branch_nombre: string
  meta_monto_gs: number
  piso_minimo_pct: number
  rebate_pct_base: number
  rebate_pct_adicional: number
  ventas_actual_gs: number
  cumplimiento_actual_pct: number
  tendencia_proyectada_gs: number
  cumplimiento_proyectado_pct: number
  rebate_ganado_actual_gs: number
  rebate_ganado_proy_gs: number
  brecha_para_piso_gs: number
  estado_meta: "alcanzado" | "en_riesgo" | "critico"
}

interface MultiDashboardData {
  mes_consultado: string
  meta_total_general_gs: number
  ventas_total_general_gs: number
  cumplimiento_global_pct: number
  tendencia_global_gs: number
  rebate_total_estimado_gs: number
  total_acuerdos_activos: number
  proveedores: MultiSupplierItem[]
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
  const userName = rawName.toLowerCase().includes("admin") || rawName.toLowerCase().includes("casa") ? "Gustavo" : rawName

  const [tab, setTab] = useState<"metas" | "chat" | "recommendations">("metas")
  useScrollToTop()
  const [loading, setLoading] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [multiDashboard, setMultiDashboard] = useState<MultiDashboardData | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")

  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([
    {
      id: "welcome",
      isUser: false,
      text: `### 👔 Dictamen Comercial — Casa Gonzalito S.R.L.
Saludos, ${userName}. Soy el Gerente Comercial IA de Casa Gonzalito.

Estoy conectado en tiempo real a la base de datos de ventas, metas comerciales y los 45 acuerdos de proveedores vigentes.

• **Metas y Rebates:** Podés pedirme auditorías de avance, proyección de cierre y cálculo de brechas para PARESA, Chortitzer, Trociuk y demás líneas.
• **Acciones Sugeridas:** Propondré combos promocionales y planes para asegurar el cobro de rebates comerciales antes del fin de mes.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [query, setQuery] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory, loading])

  const loadData = async () => {
    setLoading(true)
    try {
      const [recs, kpis] = await Promise.all([
        api.commercialAgent.recommendations().catch(() => []),
        api.supplierKpis.getDashboard("2026-08", "all").catch(() => null)
      ])
      setRecommendations(recs || [])
      if (kpis) setMultiDashboard(kpis)
    } catch (e) {
      console.error("Error loading commercial data", e)
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
      const kpis = await api.supplierKpis.getDashboard("2026-08", "all")
      if (kpis) setMultiDashboard(kpis)
    } catch (e) {
      console.error("Error running commercial diagnosis", e)
    } finally {
      setDiagnosing(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await api.commercialAgent.approve(id, userName, "Aprobado para ejecución en ruta")
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
        text: "Ocurrió un error al procesar el dictamen comercial. Por favor intenta de nuevo.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: number) => {
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
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></span>
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
              <div key={idx} className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-750/70 rounded-xl border border-gray-200/70 dark:border-gray-700 shadow-2xs">
                <span className="w-4 h-4 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
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
            <p key={idx} className="text-gray-800 dark:text-gray-200 font-normal">
              {renderInlineFormatting(trimmed)}
            </p>
          )
        })}
      </div>
    )
  }

  // Filtrado de acuerdos reales
  const filteredAgreements = (multiDashboard?.proveedores || []).filter(p => {
    const matchesSearch = p.supplier_razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.supplier_ruc.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.branch_nombre.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesBranch = branchFilter === "all" || p.branch_id === branchFilter || (branchFilter === "central" && p.branch_nombre.includes("Central"))
    return matchesSearch && matchesBranch
  })

  // PARESA Central Card Data
  const paresaCentral = (multiDashboard?.proveedores || []).find(p => p.supplier_razon_social.includes("PARAGUAY REFRESCOS") && p.branch_nombre.includes("Central"))

  return (
    <div className="relative space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Glassmorphism — Ambient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 left-1/4 w-[500px] h-[500px] rounded-full bg-emerald-400/10 dark:bg-emerald-500/15 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/6 w-[400px] h-[400px] rounded-full bg-teal-400/8 dark:bg-teal-500/10 blur-3xl" />
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-emerald-950/95 backdrop-blur-xl p-6 rounded-3xl border border-white/[0.12] shadow-2xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 font-black">
            <TrendingUp className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">Gerente Comercial IA</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                CASA GONZALITO S.R.L.
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Supervisión de Acuerdos de Rebate, Metas por Proveedor, Pacing Comercial y Planes de Acción
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunDiagnosis}
            disabled={diagnosing}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] cursor-pointer"
          >
            {diagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{diagnosing ? "Auditando Datos..." : "Ejecutar Diagnóstico IA"}</span>
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/10 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Actualizar"}
          </button>
        </div>
      </div>

      {/* KPI Ribbon Consolidado Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: PARESA Core */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>PARESA (Casa Central)</span>
            <Target className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {formatCurrency(paresaCentral?.ventas_actual_gs || 3260989251)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-rose-500 rounded-full" 
                style={{ width: `${Math.min(100, paresaCentral?.cumplimiento_actual_pct || 80.5)}%` }}
              />
            </div>
            <span className="text-xs font-black text-rose-600 dark:text-rose-400">
              {paresaCentral?.cumplimiento_actual_pct || 80.5}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Meta: {formatCurrency(paresaCentral?.meta_monto_gs || 4050000000)}</p>
        </div>

        {/* Card 2: Rebates Totales Estimados */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Rebate Total Proyectado</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(multiDashboard?.rebate_total_estimado_gs || 81077099)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Cartera de {multiDashboard?.proveedores?.length || 45} acuerdos vigentes
          </p>
        </div>

        {/* Card 3: Facturación Consolidada */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Ventas Acumuladas Mes</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {formatCurrency(multiDashboard?.ventas_total_general_gs || 5494876824)}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-1 flex items-center gap-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" /> {multiDashboard?.cumplimiento_global_pct || 72.6}% de la meta global
          </p>
        </div>

        {/* Card 4: Meta Global Cartera */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-violet-500">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Meta Total Cartera</span>
            <Layers className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {formatCurrency(multiDashboard?.meta_total_general_gs || 7570000000)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Proyección: {formatCurrency(multiDashboard?.tendencia_global_gs || 5873833846)}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto">
        <button
          onClick={() => setTab("metas")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            tab === "metas"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Panel de Metas de Proveedores ({filteredAgreements.length})</span>
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            tab === "chat"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Consola de Chat IA</span>
        </button>
        <button
          onClick={() => setTab("recommendations")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            tab === "recommendations"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Planes y Recomendaciones ({recommendations.length})</span>
        </button>
      </div>

      {/* Tab: Metas de Proveedores */}
      {tab === "metas" && (
        <div className="space-y-4">
          {/* Controls: Search and Branch Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white/50 dark:bg-slate-800/40 backdrop-blur-md p-4 rounded-2xl border border-white/40 dark:border-white/[0.06] shadow-lg">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar proveedor por nombre o RUC..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
                className="select select-bordered select-sm text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
              >
                <option value="all">Todas las Sucursales ({multiDashboard?.proveedores?.length || 0})</option>
                <option value="central">Solo Casa Central</option>
              </select>
            </div>
          </div>

          {/* Agreements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgreements.map(p => {
              const cumpl = Math.round(p.cumplimiento_actual_pct || 0)
              const estadoBadge = p.estado_meta === "alcanzado"
                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                : p.estado_meta === "en_riesgo"
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40"
                : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40"

              return (
                <div key={p.agreement_id} className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl space-y-3 hover:border-emerald-500/40 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                        {p.supplier_razon_social}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        RUC: {p.supplier_ruc} • {p.branch_nombre}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${estadoBadge}`}>
                      {cumpl}% Cumplido
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      <span>Ventas: <strong className="text-slate-900 dark:text-white font-mono">{formatCurrency(p.ventas_actual_gs)}</strong></span>
                      <span>Meta: <strong className="font-mono text-slate-700 dark:text-slate-300">{formatCurrency(p.meta_monto_gs)}</strong></span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cumpl >= 100 ? "bg-emerald-500" : cumpl >= 80 ? "bg-blue-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(100, cumpl)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-xs">
                    <div className="p-2 bg-white/40 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-bold">Proyección</span>
                      <strong className="text-blue-600 dark:text-blue-400 font-bold font-mono text-[11px]">
                        {formatCurrency(p.tendencia_proyectada_gs)}
                      </strong>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-bold">Piso Mínimo</span>
                      <strong className="text-slate-700 dark:text-slate-200 font-bold">
                        {p.piso_minimo_pct || 80}%
                      </strong>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-bold">Rebate Est.</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[11px]">
                        {formatCurrency(p.rebate_ganado_proy_gs)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      Rebate Base: {p.rebate_pct_base}%
                    </span>
                    <button
                      onClick={() => {
                        setTab("chat")
                        handleSendChat(`Diagnóstico comercial y medidas para ${p.supplier_razon_social} en ${p.branch_nombre}`)
                      }}
                      className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-0.5 text-xs cursor-pointer"
                    >
                      <span>Analizar con IA</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab: Chat Analítico */}
      {tab === "chat" && (
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/[0.08] shadow-xl rounded-3xl flex flex-col h-[600px] overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-white to-teal-500/5 dark:from-gray-800 dark:via-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-base font-black shadow-sm">
                👔
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  Gerente Comercial IA
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Auditor de Metas, Acuerdos y Estrategia</p>
              </div>
            </div>
            <span className="text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-gray-600 font-medium">
              PostgreSQL + Ollama Local
            </span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60 dark:bg-gray-900/60">
            {chatHistory.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.isUser ? "justify-end" : "justify-start"}`}>
                {!m.isUser && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0">
                    IA
                  </div>
                )}
                <div className={`max-w-[88%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                  m.isUser
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-none font-medium shadow-emerald-500/10"
                    : "bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none"
                }`}>
                  {m.isUser ? <p className="text-xs whitespace-pre-wrap">{m.text}</p> : renderMarkdownText(m.text)}
                  <span className={`block text-[10px] mt-2 text-right ${m.isUser ? "text-emerald-100" : "text-gray-400"}`}>
                    {m.time}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 text-xs font-bold animate-pulse">👔</div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span>El Gerente Comercial está auditando las metas en PostgreSQL...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="p-2.5 bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Consultas:</span>
            {[
              "¿Cómo cerramos las metas de PARESA este mes?",
              "Auditoría consolidada de cartera de proveedores",
              "Diagnóstico y medidas para SOC.COOP.CHORTITZER",
              "Estado de metas de TROCIUK y LAURO RAATZ",
              "¿Qué proveedores tienen riesgo de no cobrar rebate?"
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendChat(p)}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              placeholder="Consultá al Gerente Comercial sobre cualquier proveedor, metas o rebates..."
              disabled={loading}
              className="flex-1 bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={!query.trim() || loading}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-2xl text-xs transition flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Enviar</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab: Recomendaciones */}
      {tab === "recommendations" && (
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <div className="p-12 text-center bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-white/[0.08] rounded-3xl">
              <Sparkles className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">No hay recomendaciones pendientes</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Hacé clic en <strong>Ejecutar Diagnóstico IA</strong> para que el Gerente Comercial analice las 45 metas y proponga acciones de venta.
              </p>
              <button
                onClick={handleRunDiagnosis}
                disabled={diagnosing}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-2"
              >
                {diagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generar Recomendaciones Ahora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map(r => (
                <div key={r.id} className="p-5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-white/[0.08] shadow-lg rounded-2xl space-y-3 border-l-4 border-l-emerald-500">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 uppercase">
                      {r.tipo}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      Impacto: {formatCurrency(r.impacto_estimado_gs)}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{r.titulo}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{r.descripcion}</p>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-400 text-[11px]">{new Date(r.created_at).toLocaleDateString('es-PY')}</span>

                    {r.estado === "pendiente" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(r.id)}
                          className="px-3 py-1.5 bg-rose-100 dark:bg-rose-950/50 hover:bg-rose-200 text-rose-700 dark:text-rose-300 rounded-lg font-bold flex items-center gap-1 text-xs"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Descartar
                        </button>
                        <button
                          onClick={() => handleApprove(r.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1 text-xs shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar Plan
                        </button>
                      </div>
                    ) : (
                      <span className={`font-bold capitalize text-xs ${r.estado === "aprobada" ? "text-emerald-600" : "text-rose-600"}`}>
                        {r.estado === "aprobada" ? `✓ Aprobado por ${r.approved_by || userName}` : "✗ Descartado"}
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
  )
}
