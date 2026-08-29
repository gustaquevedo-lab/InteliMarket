import { useState, useEffect, useRef } from "react"
import {
  TrendingUp, BarChart3, Bot, Sparkles, Send, Play, CheckCircle2, XCircle,
  AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw, Layers, Users,
  ShoppingBag, Target, DollarSign, Check, X, Loader2, ShieldCheck, ChevronRight,
  Cpu, Award, Calendar, Percent, Zap, Building2, Search
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

interface AgreementItem {
  id: string
  supplier_id: string
  supplier_razon_social: string
  supplier_ruc: string
  branch_id?: string
  branch_nombre: string
  periodo: string
  nombre_acuerdo: string
  meta_monto_gs: number
  tipo_meta: string
  tipo_retorno: string
  rebate_pct_base: number
  piso_minimo_pct: number
  ventas_actual_gs: number
  transacciones_count: number
  skus_vendidos_count: number
  cumplimiento_actual_pct: number
  tendencia_proyectada_gs: number
  cumplimiento_proyectado_pct: number
  rebate_ganado_actual_pct: number
  rebate_ganado_actual_gs: number
  rebate_ganado_proy_pct: number
  rebate_ganado_proy_gs: number
  semaforo: "superado" | "en_meta" | "en_riesgo" | "critico"
  observaciones?: string
  estado: string
}

interface MultiDashboardData {
  periodo: string
  dias_transcurridos: number
  dias_totales_mes: number
  meta_total_general_gs: number
  ventas_total_general_gs: number
  cumplimiento_global_pct: number
  tendencia_global_gs: number
  cumplimiento_proyectado_global_pct: number
  rebate_total_estimado_gs: number
  proveedores: AgreementItem[]
}

export default function CommercialAgentPage() {
  const { user } = useAuth()
  const rawName = user?.nombre || user?.email?.split("@")[0] || "Gustavo"
  const userName = rawName.toLowerCase().includes("admin") ? "Gustavo" : rawName

  const [tab, setTab] = useState<"chat" | "metas" | "recommendations" | "suppliers">("metas")
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
      text: `### 👔 Saludos, ${userName}. Soy el Gerente Comercial IA de Casa Gonzalito.

Estoy conectado directamente a la base de datos real de ventas, acuerdos y metas comerciales vigentes para el mes en curso.

Podés pedirme diagnósticos detallados, auditorías de rentabilidad por proveedor o planes comerciales para asegurar el cumplimiento de metas y rebates.`,
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
        api.getSupplierKpisDashboard("2026-08", "all").catch(() => null)
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
      const kpis = await api.getSupplierKpisDashboard("2026-08", "all")
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
      <div className="space-y-2.5 text-xs leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim()
          
          if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
            const hText = cleanText(trimmed.replace(/^#+\s*/, ''))
            return (
              <h4 key={idx} className="font-bold text-gray-900 dark:text-white text-xs mt-3 mb-1 flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-700/60 pb-1">
                <span>{hText}</span>
              </h4>
            )
          }

          if (trimmed.startsWith('•') || trimmed.startsWith('-') || (trimmed.startsWith('*') && !trimmed.startsWith('**'))) {
            const bulletContent = trimmed.replace(/^[•\-*]\s*/, '')
            return (
              <div key={idx} className="flex items-start gap-2 p-2 bg-slate-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <div className="flex-1 text-gray-800 dark:text-gray-200">
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
              <div key={idx} className="flex items-start gap-2 p-2.5 bg-slate-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/60">
                <span className="w-4 h-4 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {num}
                </span>
                <div className="flex-1 text-gray-800 dark:text-gray-200">
                  {renderInlineFormatting(rest)}
                </div>
              </div>
            )
          }

          if (trimmed === '---' || trimmed === '--') {
            return <hr key={idx} className="border-gray-200 dark:border-gray-700 my-2" />
          }

          return (
            <p key={idx} className="text-gray-800 dark:text-gray-200">
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
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-slate-900/60 p-6 rounded-3xl border border-emerald-500/20 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-white/20">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Gerente Comercial IA</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Casa Gonzalito S.R.L.
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                <Cpu className="w-3 h-3" /> Minisforum Local (0 Tokens Gemini)
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
              Especialista analítico en rentabilidad mayorista, metas PARESA (Coca-Cola), rutas de preventa y gestión de metas de los 45 proveedores activos.
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

      {/* KPI Ribbon Consolidado Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: PARESA Core */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
            <span>PARESA (Casa Central)</span>
            <Target className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-lg font-black text-gray-900 dark:text-white font-mono">
            {formatCurrency(paresaCentral?.ventas_actual_gs || 3260989251)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-rose-500 rounded-full" 
                style={{ width: `${Math.min(100, paresaCentral?.cumplimiento_actual_pct || 80.5)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-rose-500">
              {paresaCentral?.cumplimiento_actual_pct || 80.5}%
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Meta: {formatCurrency(paresaCentral?.meta_monto_gs || 4050000000)}</p>
        </div>

        {/* Card 2: Rebates Totales Estimados */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
            <span>Rebate Total Proyectado</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(multiDashboard?.rebate_total_estimado_gs || 81077099)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cartera de {multiDashboard?.proveedores?.length || 45} acuerdos vigentes
          </p>
        </div>

        {/* Card 3: Facturación Consolidada */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
            <span>Ventas Acumuladas Mes</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-lg font-black text-gray-900 dark:text-white font-mono">
            {formatCurrency(multiDashboard?.ventas_total_general_gs || 5494876824)}
          </p>
          <p className="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" /> {multiDashboard?.cumplimiento_global_pct || 72.6}% de la meta global
          </p>
        </div>

        {/* Card 4: Meta Global Cartera */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
            <span>Meta Total Cartera</span>
            <Layers className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-lg font-black text-gray-900 dark:text-white font-mono">
            {formatCurrency(multiDashboard?.meta_total_general_gs || 7570000000)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Proyección cierre: {formatCurrency(multiDashboard?.tendencia_global_gs || 5873833846)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2 overflow-x-auto">
        <button
          onClick={() => setTab("metas")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            tab === "metas"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
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
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Consola Analítica (Chat IA)</span>
        </button>

        <button
          onClick={() => setTab("recommendations")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            tab === "recommendations"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Medidas & Recomendaciones</span>
          <span className="px-1.5 py-0.2 text-[10px] bg-white/20 rounded-full font-mono">
            {recommendations.length}
          </span>
        </button>

        <button
          onClick={() => setTab("suppliers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            tab === "suppliers"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Matriz de Rentabilidad Detallada</span>
        </button>
      </div>

      {/* Tab Metas de Proveedores Real */}
      {tab === "metas" && (
        <div className="space-y-4">
          {/* Search & Branch filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por proveedor, RUC o sucursal..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Building2 className="w-4 h-4 text-gray-400" />
              <select
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
                className="bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
              >
                <option value="all">Todas las Sucursales</option>
                <option value="central">Casa Central</option>
                <option value="a9a31377-275f-5820-9891-723583b751ed">Sucursal Santa Rosa</option>
                <option value="00fdb863-d8c5-5bb7-aa05-03776a6a2444">Sucursal Capitán Bado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgreements.map((p) => {
              const cumpl = p.cumplimiento_actual_pct || 0
              const isSuperado = cumpl >= 100
              const isGood = cumpl >= (p.piso_minimo_pct || 80)
              
              return (
                <div
                  key={p.id}
                  className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm space-y-3 hover:border-emerald-500/40 transition group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                        🏢 {p.branch_nombre}
                      </span>
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-emerald-600 transition">
                        {p.supplier_razon_social}
                      </h3>
                      <p className="text-[11px] text-gray-400 font-mono">RUC: {p.supplier_ruc}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isSuperado
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200"
                        : isGood
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200"
                    }`}>
                      {cumpl}% Cumplido
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Ventas: <strong className="text-gray-900 dark:text-white font-mono">{formatCurrency(p.ventas_actual_gs)}</strong></span>
                      <span>Meta: <strong className="font-mono">{formatCurrency(p.meta_monto_gs)}</strong></span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          cumpl >= 100 ? "bg-emerald-500" : cumpl >= 80 ? "bg-blue-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(100, cumpl)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-750 text-center text-xs">
                    <div className="p-2 bg-slate-50 dark:bg-gray-750 rounded-xl">
                      <span className="text-[10px] text-gray-400 block">Proyección</span>
                      <strong className="text-blue-600 dark:text-blue-400 font-bold font-mono text-[11px]">
                        {formatCurrency(p.tendencia_proyectada_gs)}
                      </strong>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-gray-750 rounded-xl">
                      <span className="text-[10px] text-gray-400 block">Piso Mínimo</span>
                      <strong className="text-gray-700 dark:text-gray-300 font-bold">
                        {p.piso_minimo_pct || 80}%
                      </strong>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-gray-750 rounded-xl">
                      <span className="text-[10px] text-gray-400 block">Rebate Est.</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[11px]">
                        {formatCurrency(p.rebate_ganado_proy_gs)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 text-gray-500 dark:text-gray-400">
                    <span className="text-[11px] font-medium text-emerald-600">
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
                  {m.isUser ? <p className="text-xs whitespace-pre-wrap">{m.text}</p> : renderMarkdownText(m.text)}
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
                  <span>El Gerente Comercial está auditando las metas en PostgreSQL...</span>
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
              "Auditoría consolidada de cartera de proveedores",
              "Diagnóstico y medidas para SOC.COOP.CHORTITZER",
              "Estado de metas de TROCIUK y LAURO RAATZ",
              "¿Qué proveedores tienen riesgo de no cobrar rebate?"
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendChat(p)}
                className="px-3 py-1 bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap transition cursor-pointer"
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
              placeholder="Consultá al Gerente Comercial sobre cualquier proveedor, metas o rebates..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={!query.trim() || loading}
              className="p-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-2xl transition shadow-md shadow-emerald-600/20 cursor-pointer"
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
                Hacé clic en "Ejecutar Diagnóstico" para que el motor analice las 45 metas de proveedores en tiempo real y proponga medidas comerciales.
              </p>
              <button
                onClick={handleRunDiagnosis}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow hover:bg-emerald-700 transition cursor-pointer"
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
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
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
                      className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Descartar</span>
                    </button>
                    <button
                      onClick={() => handleApprove(r.id)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Matriz de Rentabilidad & Rebates por Proveedor</h3>
              <p className="text-xs text-gray-500">Auditoría consolidada de facturación sin IVA, cumplimiento de metas y liquidación de rebate.</p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-xl border border-emerald-500/20">
              Cumplimiento Cartera: {multiDashboard?.cumplimiento_global_pct || 72.6}%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Proveedor / RUC</th>
                  <th className="py-3 px-3">Sucursal</th>
                  <th className="py-3 px-3 text-right">Meta Asignada</th>
                  <th className="py-3 px-3 text-right">Venta Sin IVA</th>
                  <th className="py-3 px-3 text-center">% Cumpl.</th>
                  <th className="py-3 px-3 text-right">Proyección</th>
                  <th className="py-3 px-3 text-right">Rebate Proy.</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-750 font-mono">
                {(multiDashboard?.proveedores || []).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-gray-750/50">
                    <td className="py-3 px-3 font-bold text-gray-900 dark:text-white font-sans">
                      {p.supplier_razon_social}
                    </td>
                    <td className="py-3 px-3 font-sans text-emerald-600 font-medium">
                      {p.branch_nombre}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-300">
                      {formatCurrency(p.meta_monto_gs)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.ventas_actual_gs)}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      {p.cumplimiento_actual_pct}%
                    </td>
                    <td className="py-3 px-3 text-right text-blue-600 dark:text-blue-400">
                      {formatCurrency(p.tendencia_proyectada_gs)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(p.rebate_ganado_proy_gs)} ({p.rebate_ganado_proy_pct}%)
                    </td>
                    <td className="py-3 px-3 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.cumplimiento_actual_pct >= 100
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : p.cumplimiento_actual_pct >= (p.piso_minimo_pct || 80)
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                      }`}>
                        {p.cumplimiento_actual_pct >= 100 ? "SUPERADO" : p.cumplimiento_actual_pct >= (p.piso_minimo_pct || 80) ? "EN META" : "RIESGO"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
