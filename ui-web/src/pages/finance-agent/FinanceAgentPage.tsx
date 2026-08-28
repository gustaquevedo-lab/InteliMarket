import { useState, useEffect, useRef } from "react"
import {
  Bot, Landmark, Banknote, TrendingUp, AlertTriangle, ShieldCheck,
  ArrowUpRight, ArrowDownRight, RefreshCw, Send, CheckCircle2,
  Calendar, Layers, Clock, Zap, MessageSquare, DollarSign,
  PieChart, BarChart3, ChevronRight, ThumbsUp, Activity,
  Scale, ShieldAlert, Sparkles, Filter, Check, X, FileText,
  UserCheck, AlertCircle, ShoppingBag, Eye, Wallet, Loader2
} from "lucide-react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatPYG, formatDate } from "../../utils/format"

type CFOActiveTab = "torre" | "inter_agente" | "flujo_caja" | "chat"

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

      if (towerRes) {
        setMessages([
          {
            role: "assistant",
            content: `👋 **Buenas tardes. Bienvenido a la Torre de Control Financiera del Gerente Financiero IA (CFO Virtual).**\n\nHe auditado en tiempo real la **Posición Consolidada de Liquidez** con un total de **${formatPYG(towerRes.liquidez_total_gs)} disponibles**:\n\n- 🏛️ **Bancos (${towerRes.desglose_bancos?.length || 0} cuentas):** ${formatPYG(towerRes.bancos_total_gs)}\n- 🔐 **Efectivo en Custodia / Bóveda:** ${formatPYG(towerRes.boveda_central_gs)} (Rendiciones de caja en proceso)\n- 🛒 **Cajas POS en Salón:** ${formatPYG(towerRes.cajas_pos_gs)} (Aperturas y cobros en efectivo de hoy)\n\nNuestras **Cuentas por Cobrar a Clientes** totalizan **${formatPYG(towerRes.ar_total_gs)}**, mientras que los compromisos con proveedores en **Cuentas por Pagar** ascienden a **${formatPYG(towerRes.ap_total_mes_gs)}** (${towerRes.ap_facturas_pendientes_count} facturas).\n\n¿En qué aspecto financiero o de tesorería deseas que profundicemos hoy?`,
            suggestions: [
              "¿Cómo están distribuidos nuestros saldos bancarios?",
              "Ver detalle de efectivo en custodia y cajas",
              "Ver clientes deudores en cuentas por cobrar",
              "¿Qué directivas emitiste al Gerente de Ventas?"
            ]
          }
        ])
      }
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
      const res = await api.financeAgent.chat({
        company_id: companyId,
        message: textToSend,
      })

      const botReply = {
        role: "assistant" as const,
        content: res.response || (res as any).reply || "No se pudo obtener una respuesta del Gerente Financiero IA.",
        suggestions: res.suggestions || (res as any).suggested_prompts || []
      }
      setMessages([...newMessages, botReply])
    } catch (err: any) {
      toast.error("Error al enviar mensaje al CFO")
      console.error(err)
    } finally {
      setChatLoading(false)
    }
  }

  if (loading && !towerData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-pulse shadow-xl shadow-emerald-500/10">
            <Landmark className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-ping" />
        </div>
        <div className="text-center">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Conectando con la Torre de Tesorería & CFO IA</h3>
          <p className="text-xs text-slate-500 mt-1">Conciliando bancos, bóveda, cuentas por pagar y flujo proyectado...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Landmark className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    INTELIGENCIA ARTIFICIAL · TORRE DE CONTROL
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Cobertura: {towerData?.dias_cobertura_operativa || 138} Días
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Gerente Financiero IA (CFO Virtual)
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Monitoreo de liquidez en tiempo real, conciliación bancaria y blindaje de flujo de caja para Extra Supermercado
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
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-teal-300">
                🏛️ {towerData?.desglose_bancos?.length || 0} Cuentas Bancarias Conciliadas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={loadAllFinancialData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Recalcular Liquidez
            </button>
            <button
              onClick={() => setTab("chat")}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition shadow-lg shadow-emerald-500/25 flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Copiloto Financiero IA
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Liquidez Total</span>
              <span className="text-[10px] font-bold text-emerald-400">Disponible</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {towerData ? formatPYG(towerData.liquidez_total_gs) : "₲ 441.800.000"}
            </p>
            <p className="text-[11px] text-slate-400">Bancos + Bóveda + Cajas Salón</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cuentas por Pagar (AP)</span>
              <span className="text-[10px] font-bold text-rose-400">{towerData?.ap_facturas_pendientes_count || 0} facturas</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {towerData ? formatPYG(towerData.ap_total_mes_gs) : "₲ 268.000.000"}
            </p>
            <p className="text-[11px] text-slate-400">Próximos 7d: {towerData ? formatPYG(towerData.ap_proximos_7d_gs) : "₲ 94.5M"}</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cuentas por Cobrar (AR)</span>
              <span className="text-[10px] font-bold text-blue-400 font-mono">Clientes</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {towerData ? formatPYG(towerData.ar_total_gs) : "₲ 142.000.000"}
            </p>
            <p className="text-[11px] text-blue-400 font-mono">Vigente: {towerData ? formatPYG(towerData.ar_vigente_gs) : "₲ 142M"}</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ratio de Solvencia</span>
              <span className="text-[10px] font-mono text-teal-400">7 Días</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-teal-300">
              {towerData ? `${towerData.ratio_solvencia_7d}x` : "4.67x"}
            </p>
            <p className="text-[11px] text-slate-400">Solvencia líquida sobre pasivos inmediatos</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "torre", label: "Torre de Tesorería & Liquidez", icon: Landmark },
          { key: "inter_agente", label: "Enlace Inter-Agente (CFO ↔ Ventas)", icon: Zap, badge: syncData?.directivas_a_ventas?.length },
          { key: "flujo_caja", label: "Simulador Flujo de Caja (30d)", icon: BarChart3 },
          { key: "chat", label: "Copiloto Financiero IA", icon: MessageSquare },
        ].map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as CFOActiveTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: TORRE DE TESORERÍA ══════════════════════ */}
      {tab === "torre" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Cuentas Bancarias */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden group">
              <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cuentas Bancarias</h3>
                    <p className="text-xs text-slate-500">Saldos disponibles conciliados</p>
                  </div>
                </div>
                <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums font-mono">
                  {towerData ? formatPYG(towerData.bancos_total_gs) : "₲ 348.500.000"}
                </span>
              </div>

              <div className="space-y-2.5 pt-2">
                {towerData?.desglose_bancos ? towerData.desglose_bancos.map((b: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{b.banco}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{b.numero_cuenta}</p>
                    </div>
                    <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums font-mono">
                      {formatPYG(b.saldo_gs)}
                    </span>
                  </div>
                )) : (
                  <div className="text-xs text-slate-400">Cargando cuentas...</div>
                )}
              </div>
            </div>

            {/* Bóveda Central & Cajas POS */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden group">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Efectivo en Custodia</h3>
                    <p className="text-xs text-slate-500">Bóveda central y cajas abiertas</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                  {towerData ? formatPYG(towerData.boveda_central_gs + towerData.cajas_pos_gs) : "₲ 93.300.000"}
                </span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 dark:text-emerald-300">Bóveda Central de Tesorería</span>
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 tabular-nums font-mono">
                      {towerData ? formatPYG(towerData.boveda_central_gs) : "₲ 68.500.000"}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">Fondo de reserva y resguardo para cambio operativo.</p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-950 dark:text-blue-300">Cajas POS en Salón Comercial</span>
                    <span className="text-xs font-black text-blue-700 dark:text-blue-400 tabular-nums font-mono">
                      {towerData ? formatPYG(towerData.cajas_pos_gs) : "₲ 24.800.000"}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80 mt-1">Recaudación acumulada en turnos activos de hoy.</p>
                </div>
              </div>
            </div>

            {/* Matriz de Calce de Plazos */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden group">
              <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Calce de Pasivos & Activos</h3>
                    <p className="text-xs text-slate-500">Compromisos vs Cobranzas</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">A Pagar Próximos 7d (AP)</span>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono">
                    {towerData ? formatPYG(towerData.ap_proximos_7d_gs) : "₲ 94.500.000"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">A Cobrar Clientes Vigentes (AR)</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                    {towerData ? formatPYG(towerData.ar_vigente_gs) : "₲ 142.000.000"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Gastos Operativos Mes MTD</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums font-mono">
                    {towerData ? formatPYG(towerData.gastos_operativos_mes_gs) : "₲ 42.150.000"}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: ENLACE INTER-AGENTE ══════════════════════ */}
      {tab === "inter_agente" && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-md">
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
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm">
                Piso Mínimo Margen: 18.5%
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Directivas Comerciales Emitidas por Tesorería</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {syncData?.directivas_a_ventas ? syncData.directivas_a_ventas.map((dir: any, idx: number) => (
                <div key={idx} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between hover:border-indigo-300 transition">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {dir.codigo}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        dir.prioridad === "alta" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      }`}>
                        {dir.prioridad.toUpperCase()}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{dir.titulo}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{dir.mensaje}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {dir.accion}
                    </span>
                  </div>
                </div>
              )) : null}
            </div>
          </div>

          {/* Oportunidades Flash */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-500" />
                  Operación "Cash-Flow Flash" — Monetización de Sobre-Stock
                </h3>
                <p className="text-xs text-slate-500">
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
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-2.5">Producto</th>
                    <th className="pb-2.5 text-right">Stock Inmovilizado</th>
                    <th className="pb-2.5 text-right">Días Sin Rotación</th>
                    <th className="pb-2.5 text-right">Monto Parado (₲)</th>
                    <th className="pb-2.5 text-right">Desc. Sugerido</th>
                    <th className="pb-2.5 text-right">Recaudación Estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {syncData?.oportunidades_flash_stock?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 font-bold text-slate-900 dark:text-white">{item.producto}</td>
                      <td className="py-3 text-right font-mono">{item.stock_actual} un</td>
                      <td className="py-3 text-right text-amber-500 font-semibold">{item.dias_sin_rotacion} días</td>
                      <td className="py-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatPYG(item.monto_inmovilizado_gs)}</td>
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
        </div>
      )}

      {/* ══════════════════════ TAB 3: SIMULADOR FLUJO DE CAJA (30D) ══════════════════════ */}
      {tab === "flujo_caja" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                  Curva Proyectada de Flujo de Caja (Próximos 30 Días)
                </h3>
                <p className="text-xs text-slate-500">
                  Ingresos estimados por ventas diarias vs Egresos programados de proveedores y salarios.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-slate-700 dark:text-slate-300">Saldo Disponible Proyectado</span>
                </div>
              </div>
            </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-xs text-slate-500">Ingresos Totales Esperados (30d)</span>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {cashFlowData ? formatPYG(cashFlowData.total_ingresos_30d_gs) : "₲ 0"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Ventas según DOW + Cobranzas AR</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-xs text-slate-500">Egresos Comprometidos (30d)</span>
                <p className="text-base font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">
                  {cashFlowData ? formatPYG(cashFlowData.total_egresos_30d_gs) : "₲ 0"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Facturas AP + Reposición CMV + Nómina</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-xs text-slate-500">Saldo Final Proyectado a 30d</span>
                <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">
                  {cashFlowData ? formatPYG(cashFlowData.saldo_proyectado_30d_gs) : "₲ 0"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Posición neta estimada a cierre</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 4: COPILOTO FINANCIERO IA ══════════════════════ */}
      {tab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Gerente Financiero IA</h3>
                  <p className="text-[11px] text-slate-500">CFO Virtual · Motor Gemini 2.5</p>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <Activity className="w-3.5 h-3.5" /> Capacidades Activas
                </div>
                <p>• Análisis de solvencia y pasivos a 7/30 días.</p>
                <p>• Conciliación de bóveda y saldos bancarios.</p>
                <p>• Emisión de directivas a Ventas y Compras.</p>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Consultas Rápidas Sugeridas</span>
                <div className="flex flex-col gap-2">
                  {[
                    "¿Cuánto vence con proveedores en los próximos 7 días?",
                    "Ver reporte de morosidad y clientes bloqueados",
                    "¿Qué directivas enviamos al Gerente de Ventas?",
                    "Simular flujo de caja de los próximos 30 días"
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="text-left text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-100 dark:border-slate-800 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col h-[650px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Sesión Activa con el CFO Virtual</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400">Contexto: Tesorería en Tiempo Real</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 space-y-2 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none shadow-md shadow-emerald-500/10"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none"
                  }`}>
                    <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {m.suggestions.map((p, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleSendMessage(p)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 hover:bg-emerald-100 transition"
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
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    El Gerente Financiero IA está consultando la tesorería y cuentas contables...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
              <form onSubmit={e => { e.preventDefault(); handleSendMessage() }} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Preguntale al CFO sobre liquidez, morosidad o flujo de caja..."
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  className="flex-1 px-4 py-3 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || chatLoading}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
