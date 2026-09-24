import { useState, useEffect, useRef } from "react"
import {
  Bot, Landmark, Banknote, TrendingUp, AlertTriangle, ShieldCheck,
  ArrowUpRight, ArrowDownRight, RefreshCw, Send, CheckCircle2,
  Calendar, Layers, Clock, Zap, MessageSquare, DollarSign,
  PieChart, BarChart3, ChevronRight, ThumbsUp, Activity,
  Scale, ShieldAlert, Sparkles, Filter, Check, X, FileText,
  UserCheck, AlertCircle, ShoppingBag, Eye
} from "lucide-react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { api } from "../api"
import { useToast } from "../context/ToastContext"
import { useAuth } from "../context/AuthContext"
import { formatPYG, formatDate } from "../utils/format"

type CFOActiveTab = "torre" | "inter_agente" | "flujo_caja" | "chat" | "acciones"

export default function FinanceAgentPage() {
  const [tab, setTab] = useState<CFOActiveTab>("torre")
  const [loading, setLoading] = useState(true)
  const [towerData, setTowerData] = useState<any>(null)
  const [syncData, setSyncData] = useState<any>(null)
  const [cashFlowData, setCashFlowData] = useState<any>(null)

  // Chat State
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; suggestions?: string[] }>>([
    {
      role: "assistant",
      content: "👋 **Buenas tardes. Bienvenido a la Torre de Control Financiera del Gerente Financiero IA (CFO Virtual).**\n\nHe auditado en tiempo real la **Posición Neta de Liquidez de Extra Supermercado** con **Gs. 441.800.000 disponibles** (Bancos, Bóveda Central y Cajas de Salón).\n\nNuestra cobertura operativa actual es de **138 días**, con un índice de solvencia de **4.67x** sobre los vencimientos a proveedores de los próximos 7 días (Gs. 94.5M).\n\nHe emitido **3 directivas estratégicas al Gerente de Ventas IA**, incluyendo una **Venta Flash de Sobre-Stock** para monetizar **Gs. 37.8M** en productos de baja rotación.\n\n¿En qué aspecto financiero o de tesorería deseas que profundicemos hoy?",
      suggestions: [
        "¿Cuánto vence con proveedores en los próximos 7 días?",
        "Ver reporte de morosidad y clientes bloqueados",
        "¿Qué directivas enviamos al Gerente de Ventas?",
        "Simular flujo de caja de los próximos 30 días"
      ]
    }
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const toast = useToast()
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"

  const loadAllFinancialData = async () => {
    setLoading(true)
    try {
      const [towerRes, syncRes, cashRes] = await Promise.all([
        api.financeAgent.getControlTower(companyId),
        api.financeAgent.getInterAgentSync(companyId),
        api.financeAgent.getCashFlowForecast(companyId)
      ])
      setTowerData(towerRes)
      setSyncData(syncRes)
      setCashFlowData(cashRes)
    } catch (err: any) {
      toast.error("Error cargando datos del Gerente Financiero IA")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllFinancialData()
  }, [])

  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, tab])

  const handleSendMessage = async (msgText?: string) => {
    const textToSend = msgText || inputMessage
    if (!textToSend.trim() || chatLoading) return

    const newMessages = [...messages, { role: "user" as const, content: textToSend }]
    setMessages(newMessages)
    if (!msgText) setInputMessage("")
    setChatLoading(true)

    try {
      const history = newMessages.map(m => ({ role: m.role, content: m.content }))
      const res = await api.financeAgent.chat({
        company_id: companyId,
        message: textToSend,
        conversation_history: history
      })

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: res.response,
          suggestions: res.suggestions
        }
      ])
    } catch (err) {
      toast.error("Error al comunicarse con el Gerente Financiero IA")
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto min-h-screen">
      
      {/* ════════════ HEADER ESTRATÉGICO DEL CFO IA ════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 text-white border border-blue-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-400 backdrop-blur-md shadow-inner">
                <Bot className="w-7 h-7 animate-pulse text-blue-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate tracking-tight text-white flex items-center gap-2">
                    Gerente Financiero IA
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold tracking-wide flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      CFO ACTIVO
                    </span>
                  </h1>
                </div>
                <p className="text-xs text-blue-200/80 font-medium">
                  Torre de Control de Tesorería · Enlace Bidireccional con Gerente de Ventas IA · Flujo de Caja Proyectado
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3">
              <Activity className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Enlace Inter-Agente</p>
                <p className="text-xs font-bold text-emerald-300">100% Sincronizado</p>
              </div>
            </div>

            <button
              onClick={loadAllFinancialData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Auditar Tesorería
            </button>
          </div>
        </div>

        {/* ── Quick KPI Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-[11px] text-blue-200/70 font-semibold flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5 text-emerald-400" /> Posición Neta Liquidez
            </span>
            <p className="text-base sm:text-lg font-black text-white mt-0.5 tabular-nums">
              {towerData ? formatPYG(towerData.liquidez_total_gs) : "₲ 441.800.000"}
            </p>
            <span className="text-[10px] text-emerald-400 font-bold">Bancos + Bóveda + Cajas</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-[11px] text-blue-200/70 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" /> Cash Runway (Cobertura)
            </span>
            <p className="text-base sm:text-lg font-black text-white mt-0.5 tabular-nums">
              {towerData ? `${towerData.cash_runway_dias} Días` : "138.1 Días"}
            </p>
            <span className="text-[10px] text-blue-300 font-bold">Operación sin ingresos</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-[11px] text-blue-200/70 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Vencimientos Prov. 7d
            </span>
            <p className="text-base sm:text-lg font-black text-white mt-0.5 tabular-nums">
              {towerData ? formatPYG(towerData.ap_proximos_7d_gs) : "₲ 94.500.000"}
            </p>
            <span className="text-[10px] text-amber-400 font-bold">Cobierto 4.67x</span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="text-[11px] text-blue-200/70 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Morosidad Clientes
            </span>
            <p className="text-base sm:text-lg font-black text-white mt-0.5 tabular-nums">
              {towerData ? formatPYG(towerData.ar_moroso_gs) : "₲ 38.400.000"}
            </p>
            <span className="text-[10px] text-rose-400 font-bold">2 clientes en mora</span>
          </div>
        </div>
      </div>

      {/* ════════════ PESTAÑAS DE NAVEGACIÓN ESTRATÉGICA ════════════ */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setTab("torre")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            tab === "torre"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <Landmark className="w-4 h-4" />
          Torre de Tesorería
        </button>

        <button
          onClick={() => setTab("inter_agente")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            tab === "inter_agente"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          Enlace Inter-Agente (CFO ↔ Ventas)
          <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black">3</span>
        </button>

        <button
          onClick={() => setTab("flujo_caja")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            tab === "flujo_caja"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Simulador Flujo de Caja (30d)
        </button>

        <button
          onClick={() => setTab("chat")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
            tab === "chat"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat Consultivo con el CFO
        </button>
      </div>

      {/* ════════════ TAB 1: TORRE DE TESORERÍA ════════════ */}
      {tab === "torre" && (
        <div className="space-y-6">
          {/* Desglose de Liquidez */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Cuentas Bancarias */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Cuentas Bancarias</h3>
                    <p className="text-xs text-gray-500">Saldos disponibles conciliados</p>
                  </div>
                </div>
                <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums">
                  {towerData ? formatPYG(towerData.bancos_total_gs) : "₲ 348.500.000"}
                </span>
              </div>

              <div className="space-y-2.5 pt-2">
                {towerData?.desglose_bancos ? towerData.desglose_bancos.map((b: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{b.banco}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{b.numero_cuenta}</p>
                    </div>
                    <span className="text-xs font-black text-gray-900 dark:text-white tabular-nums">
                      {formatPYG(b.saldo_gs)}
                    </span>
                  </div>
                )) : (
                  <div className="text-xs text-gray-400">Cargando cuentas...</div>
                )}
              </div>
            </div>

            {/* Bóveda Central & Cajas POS */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Efectivo Físico en Custodia</h3>
                    <p className="text-xs text-gray-500">Bóveda central y cajas abiertas</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {towerData ? formatPYG(towerData.boveda_central_gs + towerData.cajas_pos_gs) : "₲ 93.300.000"}
                </span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">Bóveda Central de Tesorería</span>
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {towerData ? formatPYG(towerData.boveda_central_gs) : "₲ 68.500.000"}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">Fondo de reserva y resguardo para cambio operativo.</p>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-300">Cajas POS en Salón Comercial</span>
                    <span className="text-xs font-black text-blue-700 dark:text-blue-400 tabular-nums">
                      {towerData ? formatPYG(towerData.cajas_pos_gs) : "₲ 24.800.000"}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80 mt-1">Recaudación acumulada en turnos activos de hoy.</p>
                </div>
              </div>
            </div>

            {/* Matriz de Calce de Plazos */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Calce de Pasivos & Activos</h3>
                    <p className="text-xs text-gray-500">Compromisos vs Cobranzas</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">A Pagar Próximos 7d (AP)</span>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {towerData ? formatPYG(towerData.ap_proximos_7d_gs) : "₲ 94.500.000"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">A Cobrar Clientes Vigentes (AR)</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {towerData ? formatPYG(towerData.ar_vigente_gs) : "₲ 142.000.000"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Gastos Operativos Mes MTD</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">
                    {towerData ? formatPYG(towerData.gastos_operativos_mes_gs) : "₲ 42.150.000"}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ════════════ TAB 2: ENLACE INTER-AGENTE (CFO ↔ VENTAS) ════════════ */}
      {tab === "inter_agente" && (
        <div className="space-y-6">
          
          {/* Header del Enlace */}
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                  Canal de Inteligencia Coordinada (CFO IA ↔ Gerente de Ventas IA)
                </h3>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-400">
                  El Gerente Financiero emite directivas de liquidez para que Ventas calibre promociones, escalas de precios y límites de crédito.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                Piso Mínimo Margen: 18.5%
              </span>
            </div>
          </div>

          {/* Directivas Activas del CFO a Ventas */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Directivas Comerciales Emitidas por Tesorería</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {syncData?.directivas_a_ventas ? syncData.directivas_a_ventas.map((dir: any, idx: number) => (
                <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                        {dir.codigo}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        dir.prioridad === "alta" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      }`}>
                        {dir.prioridad.toUpperCase()}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-snug">{dir.titulo}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{dir.mensaje}</p>
                  </div>
                  <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {dir.accion}
                    </span>
                  </div>
                </div>
              )) : null}
            </div>
          </div>

          {/* Oportunidades de Venta Flash para Generar Liquidez */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-500" />
                  Operación "Cash-Flow Flash" — Monetización de Sobre-Stock
                </h3>
                <p className="text-xs text-gray-500">
                  Productos con baja rotación identificados para remate promocional inmediato y recaudación rápida.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-xl">
                Potencial: ₲ 37.849.000 de liquidez en 48hs
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-400 font-semibold">
                    <th className="pb-2.5">Producto</th>
                    <th className="pb-2.5 text-right">Stock Inmovilizado</th>
                    <th className="pb-2.5 text-right">Días Sin Rotación</th>
                    <th className="pb-2.5 text-right">Monto Parado (₲)</th>
                    <th className="pb-2.5 text-right">Desc. Sugerido</th>
                    <th className="pb-2.5 text-right">Recaudación Estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {syncData?.oportunidades_flash_stock?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 font-bold text-gray-900 dark:text-white">{item.producto}</td>
                      <td className="py-3 text-right font-mono">{item.stock_actual} un</td>
                      <td className="py-3 text-right text-amber-500 font-semibold">{item.dias_sin_rotacion} días</td>
                      <td className="py-3 text-right font-mono font-bold text-gray-900 dark:text-white">{formatPYG(item.monto_inmovilizado_gs)}</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold">
                          -{item.descuento_sugerido_pct}%
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatPYG(item.recaudacion_estimada_gs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alertas de Riesgo Crediticio */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-rose-200 dark:border-rose-950/40 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Bloqueo Preventivo de Crédito a Clientes Morosos</h3>
                <p className="text-xs text-gray-500">Notificación automática enviada al módulo de Pedidos del Gerente de Ventas</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {syncData?.alertas_riesgo_crediticio?.map((c: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{c.cliente}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                      Mora: {c.dias_mora_max} días
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>Límite: {formatPYG(c.limite_credito)}</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">Deuda: {formatPYG(c.deuda_actual)}</span>
                  </div>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 pt-1 font-medium">
                    👉 {c.accion_sugerida}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ════════════ TAB 3: SIMULADOR DE FLUJO DE CAJA (30D) ════════════ */}
      {tab === "flujo_caja" && (
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                  Curva Proyectada de Flujo de Caja (Próximos 30 Días)
                </h3>
                <p className="text-xs text-gray-500">
                  Ingresos estimados por ventas diarias vs Egresos programados de proveedores y salarios.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-gray-700 dark:text-gray-300">Saldo Disponible Proyectado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-gray-700 dark:text-gray-300">Ingresos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-gray-700 dark:text-gray-300">Egresos</span>
                </div>
              </div>
            </div>

            {/* Gráfico Recharts de Flujo de Caja */}
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData?.proyeccion_diaria || []}>
                  <defs>
                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="fecha" stroke="#9ca3af" fontSize={11} />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={11}
                    tickFormatter={(v) => `₲${(v / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "0.75rem",
                      color: "#fff",
                      fontSize: "12px"
                    }}
                    formatter={(value: any) => [formatPYG(value), ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="saldo_final_estimado"
                    name="Saldo en Caja/Bancos"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSaldo)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Resumen del Flujo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-slate-800">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60">
                <span className="text-xs text-gray-500">Ingresos Totales Esperados (30d)</span>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {cashFlowData ? formatPYG(cashFlowData.total_ingresos_30d_gs) : "₲ 1.080.000.000"}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60">
                <span className="text-xs text-gray-500">Egresos Comprometidos (30d)</span>
                <p className="text-base font-black text-rose-600 dark:text-rose-400 mt-1">
                  {cashFlowData ? formatPYG(cashFlowData.total_egresos_30d_gs) : "₲ 536.000.000"}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60">
                <span className="text-xs text-gray-500">Saldo Final Proyectado a 30d</span>
                <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-1">
                  {cashFlowData ? formatPYG(cashFlowData.saldo_proyectado_30d_gs) : "₲ 985.800.000"}
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ════════════ TAB 4: CHAT CONSULTIVO CON EL CFO IA ════════════ */}
      {tab === "chat" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col h-[650px] overflow-hidden">
          
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Asistente Estratégico CFO Virtual</h3>
                <p className="text-xs text-gray-500">Consultas financieras en tiempo real con datos de Extra Supermercado</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              En línea
            </span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-1 shadow">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-gray-200/60 dark:border-slate-700"
                  }`}
                >
                  <div className="whitespace-pre-line space-y-1">{m.content}</div>

                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200/40 dark:border-slate-700 space-y-1.5">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Preguntas recomendadas:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSendMessage(sug)}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-slate-600 transition-colors text-left"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                El Gerente Financiero IA está analizando los registros contables y de tesorería...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Preguntale al CFO sobre liquidez, proveedores, morosidad o flujo de caja..."
              className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || chatLoading}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center gap-1.5 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
