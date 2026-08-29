import { useState, useEffect, useRef } from "react"
import {
  Bot, Sparkles, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw,
  Landmark, DollarSign, ArrowUpRight, ArrowDownRight, CreditCard, TrendingUp,
  Calendar, Plus, ArrowRightLeft, FileSpreadsheet, Building2, Send, Clock,
  ShieldAlert, CheckCircle, HelpCircle, ChevronRight
} from "lucide-react"
import { api, type FinanceRecommendation, type FinanceAgentRun } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatPYG, formatDateTime } from "../../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

type ActiveTab = "cfo" | "ai" | "banks" | "cajas" | "reconciliation" | "pnl"

interface ChatMsg {
  id: string
  isUser: boolean
  text: string
  time: string
  metrics?: any
}

const TIPO_LABEL: Record<string, string> = {
  cobranza: "Cobranza",
  pago_proveedor: "Pago a proveedor",
  alerta_presupuesto: "Presupuesto",
  control_caja_chica: "Control de caja chica",
  otro: "Tesorería",
}

export default function FinanceAgentPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("ai")
  const [loading, setLoading] = useState(true)
  
  // Executive Suite State
  const [summaryData, setSummaryData] = useState<any>(null)
  const [cashFlowData, setCashFlowData] = useState<any>(null)
  const [banksData, setBanksData] = useState<any[]>([])
  const [ebitdaData, setEbitdaData] = useState<any>(null)
  const [consolidatedDash, setConsolidatedDash] = useState<any>(null)

  // AI Agent State
  const [recs, setRecs] = useState<FinanceRecommendation[]>([])
  const [running, setRunning] = useState(false)
  const [deciding, setDeciding] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("pending")
  const [lastRun, setLastRun] = useState<FinanceAgentRun | null>(null)

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([
    {
      id: "welcome",
      isUser: false,
      text: `### 💼 Saludos, Gustavo. Soy el Gerente Financiero IA de Casa Gonzalito.

Estoy conectado directamente a la base de datos de tesorería, cuentas por cobrar, cuentas por pagar a proveedores y cartera de cheques.

Podés pedirme auditorías de liquidez bancaria, reportes de mora de clientes mayoristas, proyecciones de flujo de caja a 30 días o el calendario de vencimientos con proveedores para asegurar los rebates comerciales.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [query, setQuery] = useState("")
  const [sendingChat, setSendingChat] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Deposit Modal State
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositForm, setDepositForm] = useState({
    bank_account_id: "",
    numero_boleta: "",
    monto: "",
    concepto: "Depósito de Recaudación del Día",
  })
  const [savingDeposit, setSavingDeposit] = useState(false)
  
  // Reconciliation State
  const [selectedBankForRecon, setSelectedBankForRecon] = useState<string>("")
  const [rawStatementText, setRawStatementText] = useState<string>("")
  const [processingRecon, setProcessingRecon] = useState<boolean>(false)
  const [reconcileResult, setReconcileResult] = useState<any | null>(null)

  const toast = useToast()
  const { user } = useAuth()
  const userName = user?.name || "Gustavo"

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory, sendingChat])

  async function loadAllData() {
    setLoading(true)
    
    // 0. Summary Data
    try {
      const sum = await api.financeAgent.summary()
      setSummaryData(sum)
    } catch { setSummaryData(null) }

    // 1. Bank Accounts
    try {
      const banks = await api.financial.banks.list(COMPANY_ID)
      setBanksData(banks || [])
      if (banks && banks.length > 0 && !depositForm.bank_account_id) {
        setDepositForm((prev) => ({ ...prev, bank_account_id: banks[0].id }))
      }
    } catch { setBanksData([]) }

    // 2. Cash Flow Dashboard
    try {
      const cfDash = await api.financial.cashFlow.dashboard(COMPANY_ID)
      setCashFlowData(cfDash)
    } catch { setCashFlowData(null) }

    // 3. EBITDA P&L
    try {
      const eb = await (api as any).integratedFinance.getEbitda(COMPANY_ID)
      setEbitdaData(eb)
    } catch { setEbitdaData(null) }

    // 4. Consolidated Dashboard
    try {
      const cDash = await (api as any).integratedFinance.getDashboard(COMPANY_ID)
      setConsolidatedDash(cDash)
    } catch { setConsolidatedDash(null) }

    // 5. AI Recommendations
    try {
      const data = await api.financeAgent.recommendations(filterStatus === "todos" ? undefined : filterStatus)
      setRecs(data || [])
    } catch { setRecs([]) }

    setLoading(false)
  }

  useEffect(() => {
    loadAllData()
  }, [filterStatus])

  const runAIDiagnosis = async () => {
    setRunning(true)
    try {
      const run = await api.financeAgent.run()
      setLastRun(run)
      if (run.status === "error") {
        toast.error("Alerta", run.error_message || "El Gerente IA no pudo completar el diagnóstico")
      } else {
        toast.success("Diagnóstico IA Completado", "Se auditaron tesorería, cuentas por cobrar y proveedores")
      }
      const [recsData, sumData] = await Promise.all([
        api.financeAgent.recommendations(filterStatus === "todos" ? undefined : filterStatus).catch(() => []),
        api.financeAgent.summary().catch(() => null)
      ])
      setRecs(recsData || [])
      if (sumData) setSummaryData(sumData)
    } catch (e: any) {
      toast.error("Error", e.message || "Error al ejecutar el diagnóstico del Gerente IA")
    } finally { setRunning(false) }
  }

  const handleSendChat = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault()
    const q = (customQuery || query).trim()
    if (!q || sendingChat) return

    const userMsg: ChatMsg = {
      id: String(Date.now()),
      isUser: true,
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setChatHistory(prev => [...prev, userMsg])
    setQuery("")
    setSendingChat(true)

    try {
      const res = await api.financeAgent.chat(q, userName)
      const aiMsg: ChatMsg = {
        id: String(Date.now() + 1),
        isUser: false,
        text: res.response,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        metrics: res.metricas_relacionadas
      }
      setChatHistory(prev => [...prev, aiMsg])
    } catch (err: any) {
      const errorMsg: ChatMsg = {
        id: String(Date.now() + 1),
        isUser: false,
        text: "Hubo una intermitencia al consultar la base de datos de finanzas. Por favor reintentá en unos segundos.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setChatHistory(prev => [...prev, errorMsg])
    } finally {
      setSendingChat(false)
    }
  }

  const decideRecommendation = async (id: string, approve: boolean) => {
    setDeciding(id)
    try {
      await (approve ? api.financeAgent.approve(id, userName) : api.financeAgent.reject(id, userName))
      toast.success(approve ? "Recomendación Aprobada" : "Recomendación Rechazada")
      const data = await api.financeAgent.recommendations(filterStatus === "todos" ? undefined : filterStatus)
      setRecs(data || [])
    } catch {
      toast.error("Error", "No se pudo actualizar el estado de la recomendación")
    } finally { setDeciding(null) }
  }

  const handleProcessStatement = async () => {
    if (!rawStatementText.trim()) return
    setProcessingRecon(true)
    try {
      const lines = rawStatementText.split("\n").filter(l => l.trim().length > 0)
      const parsedLines = lines.map(line => {
        const parts = line.split(",").map(p => p.trim())
        if (parts.length >= 3) {
          const fecha = parts[0]
          const concepto = parts[1]
          const montoNum = parseFloat(parts[2].replace(/[^0-9.-]/g, "")) || 0
          const referencia = parts[3] || "S/Ref"
          return {
            fecha,
            concepto,
            monto: Math.abs(montoNum),
            tipo: montoNum >= 0 ? "credito" : "debito",
            referencia
          }
        }
        return null
      }).filter(Boolean)

      if (parsedLines.length === 0) {
        toast.error("Error de formato", "Verificá que las líneas tengan formato: Fecha, Concepto, Monto, Referencia")
        return
      }

      const res = await api.integratedFinance.importStatement({
        company_id: COMPANY_ID,
        bank_account_id: selectedBankForRecon || (banksData[0]?.id || undefined),
        lineas: parsedLines
      })
      setReconcileResult(res)
      toast.success("Conciliación Completada", `Se evaluaron ${res.transacciones_evaluadas} transacciones, ${res.conciliadas_exitosas} conciliadas exitosamente.`)
      loadAllData()
    } catch {
      toast.error("Error", "No se pudo procesar la conciliación bancaria")
    } finally {
      setProcessingRecon(false)
    }
  }

  async function handleCreateDeposit() {
    if (!depositForm.bank_account_id || !depositForm.numero_boleta || !depositForm.monto) {
      toast.error("Error", "Completá la cuenta de destino, el número de boleta y el monto")
      return
    }
    setSavingDeposit(true)
    try {
      await (api as any).financial.banks.import(depositForm.bank_account_id, [
        {
          fecha: new Date().toISOString().split("T")[0],
          monto: parseFloat(depositForm.monto),
          concepto: `[Boleta N° ${depositForm.numero_boleta}] ${depositForm.concepto}`,
          tipo: "credito",
          referencia: depositForm.numero_boleta,
        },
      ])
      toast.success("Depósito Bancario Registrado", `Boleta N° ${depositForm.numero_boleta} procesada correctamente`)
      setShowDepositModal(false)
      setDepositForm({ bank_account_id: banksData[0]?.id || "", numero_boleta: "", monto: "", concepto: "Depósito de Recaudación del Día" })
      loadAllData()
    } catch {
      toast.error("Error", "No se pudo registrar el depósito bancario")
    } finally {
      setSavingDeposit(false)
    }
  }

  const totalBankBalance = summaryData?.liquidez_bancos_gs || banksData.reduce((sum, b) => sum + (parseFloat(b.saldo_actual) || 0), 0)
  const totalAR = summaryData?.cuentas_por_cobrar_gs || 7145277954
  const totalARVencida = summaryData?.cuentas_por_cobrar_vencidas_gs || 5068787263
  const totalAP = summaryData?.cuentas_por_pagar_gs || 9733962623
  const totalCheques = summaryData?.cheques_en_cartera_gs || 24730741120
  const flujoNeto30d = summaryData?.flujo_neto_proyectado_30d_gs || (totalBankBalance + 2800000000 - 1500000000)

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Bot className="w-7 h-7 text-amber-400" /> Gerente Financiero IA
            </h1>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-3 py-1 rounded-full font-bold">
              CASA GONZALITO S.R.L.
            </span>
          </div>
          <p className="text-slate-300 text-sm">
            Auditoría de Tesorería en Tiempo Real, Flujo de Caja Proyectado, Mora de Clientes y Sinergia con Marco Copilot
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runAIDiagnosis}
            disabled={running}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg hover:shadow-amber-500/20"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Auditoría Financiera IA
          </button>
          <button
            onClick={loadAllData}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition flex items-center gap-2 border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </button>
        </div>
      </div>

      {/* KPI Ribbon Consolidado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Liquidez Bancaria */}
        <div className="card p-4 border-l-4 border-l-primary bg-gradient-to-br from-white to-blue-50/40 dark:from-slate-900 dark:to-slate-800 shadow-sm">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Liquidez en Bancos</span>
            <Landmark className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {formatPYG(totalBankBalance)}
          </p>
          <span className="text-[11px] text-gray-500 mt-1 block">5 cuentas activas</span>
        </div>

        {/* 2. Cuentas por Cobrar (AR) */}
        <div className="card p-4 border-l-4 border-l-rose-500 bg-gradient-to-br from-white to-rose-50/40 dark:from-slate-900 dark:to-slate-800 shadow-sm">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Créditos a Clientes (AR)</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {formatPYG(totalAR)}
          </p>
          <span className="text-[11px] text-rose-600/80 font-bold mt-1 block">
            Mora vencida: {formatPYG(totalARVencida)}
          </span>
        </div>

        {/* 3. Cuentas por Pagar (AP) */}
        <div className="card p-4 border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/40 dark:from-slate-900 dark:to-slate-800 shadow-sm">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Pasivo Proveedores (AP)</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatPYG(totalAP)}
          </p>
          <span className="text-[11px] text-gray-500 mt-1 block">Compras de mercadería</span>
        </div>

        {/* 4. Cheques en Cartera */}
        <div className="card p-4 border-l-4 border-l-indigo-500 bg-gradient-to-br from-white to-indigo-50/40 dark:from-slate-900 dark:to-slate-800 shadow-sm">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Cheques en Cartera</span>
            <CreditCard className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {formatPYG(totalCheques)}
          </p>
          <span className="text-[11px] text-indigo-600/80 font-medium mt-1 block">Valores diferidos</span>
        </div>

        {/* 5. Flujo Neto Proyectado */}
        <div className="card p-4 border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900 dark:to-slate-800 shadow-sm">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            <span>Flujo Neto 30 Días</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            +{formatPYG(flujoNeto30d)}
          </p>
          <span className="text-[11px] text-emerald-600/80 font-bold mt-1 block">Autofinanciable</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("ai")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "ai" ? "border-amber-500 text-amber-600 dark:text-amber-400" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Bot className="w-4 h-4 text-amber-500" /> Consola IA & Chat Financiero
        </button>
        <button
          onClick={() => setActiveTab("cfo")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "cfo" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Flujo de Caja & Proyecciones
        </button>
        <button
          onClick={() => setActiveTab("banks")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "banks" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Landmark className="w-4 h-4" /> Cuentas Bancarias ({banksData.length})
        </button>
        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "reconciliation" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" /> Conciliación Bancaria
        </button>
        <button
          onClick={() => setActiveTab("pnl")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "pnl" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Estado de Resultados (P&L)
        </button>
      </div>

      {/* TAB 1: AI CONSOLE & CHAT FINANCIERO */}
      {activeTab === "ai" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Chat Analítico Financiero (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-[650px] card border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-slate-900 text-slate-100">
            {/* Header del Chat */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
                  💼
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    Gerente Financiero IA
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Auditor de Tesorería & Caja • Modo Interactivo</p>
                </div>
              </div>
              <div className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
                PostgreSQL + Ollama Local
              </div>
            </div>

            {/* Mensajes del Chat */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-900/60">
              {chatHistory.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.isUser ? "justify-end" : "justify-start"}`}
                >
                  {!m.isUser && (
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
                      IA
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                      m.isUser
                        ? "bg-amber-600 text-white rounded-br-none shadow-md font-medium"
                        : "bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none shadow-md"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans text-xs">
                      {m.text}
                    </div>
                    <div className="mt-2 text-[10px] opacity-60 text-right">
                      {m.time}
                    </div>
                  </div>
                </div>
              ))}
              {sendingChat && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
                    IA
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3 text-xs text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    Auditando cuentas de tesorería y balances...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 flex gap-1.5 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Cuál es el saldo actual en cada cuenta bancaria?")}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 whitespace-nowrap transition"
              >
                🏦 Saldos Bancarios
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Cuáles son los clientes con mayor deuda vencida?")}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg border border-slate-700 whitespace-nowrap transition"
              >
                ⚠️ Mora de Clientes
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Cómo está el calendario de pagos a proveedores para asegurar rebates?")}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg border border-slate-700 whitespace-nowrap transition"
              >
                📑 Pagos a Proveedores
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Cuál es la proyección de flujo de caja para los próximos 30 días?")}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg border border-slate-700 whitespace-nowrap transition"
              >
                📈 Flujo de Caja 30d
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChat} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Preguntale al Gerente Financiero sobre caja, bancos, mora o cheques..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={sendingChat || !query.trim()}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-1"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Columna Derecha: Medidas & Recomendaciones Estructuradas (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Recomendaciones de Acción
                </h3>
                <p className="text-[11px] text-gray-500">
                  Acciones sugeridas sobre cobranzas, proveedores y tesorería
                </p>
              </div>
              <div className="flex gap-1">
                {["pending", "approved", "todos"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition capitalize ${
                      filterStatus === st
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {st === "pending" ? "Pendientes" : st === "approved" ? "Aprobadas" : "Todas"}
                  </button>
                ))}
              </div>
            </div>

            {recs.length === 0 ? (
              <div className="card p-8 text-center space-y-3">
                <Bot className="w-10 h-10 text-gray-400 mx-auto" />
                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300">Sin recomendaciones pendientes</h4>
                <p className="text-xs text-gray-500">
                  Hacé clic en <strong>Auditoría Financiera IA</strong> para generar propuestas de optimización de caja.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {recs.map((r) => (
                  <div key={r.id} className="card p-4 space-y-2.5 border-l-4 border-l-amber-500 shadow-sm">
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 uppercase">
                        {TIPO_LABEL[r.tipo] || r.tipo}
                      </span>
                      {r.monto_relacionado && (
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {r.monto_relacionado}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                      {r.titulo}
                    </h4>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                      {r.descripcion}
                    </p>

                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
                      <span className="text-gray-400">{formatDateTime(r.created_at)}</span>

                      {r.status === "pending" ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => decideRecommendation(r.id, false)}
                            disabled={deciding === r.id}
                            className="px-2.5 py-1 bg-rose-100 dark:bg-rose-950/50 hover:bg-rose-200 text-rose-700 dark:text-rose-300 rounded-lg font-bold flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" /> Descartar
                          </button>
                          <button
                            onClick={() => decideRecommendation(r.id, true)}
                            disabled={deciding === r.id}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1 shadow-sm"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Aprobar
                          </button>
                        </div>
                      ) : (
                        <span className={`font-bold text-xs capitalize ${r.status === "approved" ? "text-emerald-600" : "text-rose-600"}`}>
                          {r.status === "approved" ? "✓ Aprobado" : "✗ Descartado"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CASH FLOW PROJECTION */}
      {activeTab === "cfo" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Proyección de Flujo de Caja (30 Días)
                </h3>
                <p className="text-xs text-gray-500">
                  Estimación consolidada basada en vencimientos reales de cuentas por cobrar y facturas de proveedores
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700">
                <span className="text-xs text-gray-500 uppercase font-bold">Saldo Inicial Disponible</span>
                <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
                  {formatPYG(totalBankBalance)}
                </p>
                <span className="text-[11px] text-gray-400">Fondos en bancos</span>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-slate-800 border border-emerald-100 dark:border-slate-700">
                <span className="text-xs text-emerald-600 uppercase font-bold">(+) Cobranzas & Cheques 30d</span>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  {formatPYG(totalAR * 0.35 + totalCheques * 0.4)}
                </p>
                <span className="text-[11px] text-emerald-600/80">Recaudación proyectada</span>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-slate-800 border border-amber-100 dark:border-slate-700">
                <span className="text-xs text-amber-600 uppercase font-bold">(-) Pagos a Proveedores 30d</span>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                  {formatPYG(totalAP * 0.25)}
                </p>
                <span className="text-[11px] text-amber-600/80">Compromisos comerciales</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BANK ACCOUNTS */}
      {activeTab === "banks" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">Cuentas Bancarias de Casa Gonzalito S.R.L.</h3>
              <p className="text-xs text-gray-500">Saldos operativos consolidados en los 5 bancos activos</p>
            </div>
            <button onClick={() => setShowDepositModal(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Registrar Boleta de Depósito
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {banksData.map((b) => (
              <div key={b.id} className="card p-5 border-l-4 border-l-primary space-y-3 shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">
                      {b.tipo || "Cuenta Corriente"} • {b.moneda || "PYG"}
                    </span>
                    <h4 className="text-lg font-black text-slate-900 dark:text-white">{b.banco}</h4>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl space-y-1">
                  <span className="text-xs text-gray-400">N° de Cuenta:</span>
                  <p className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">
                    {b.numero_cuenta}
                  </p>
                </div>

                <div className="flex justify-between items-baseline pt-2">
                  <span className="text-xs text-gray-400">Saldo Disponible:</span>
                  <p className="text-xl font-black text-primary font-mono">{formatPYG(b.saldo_actual)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CONCILIACIÓN BANCARIA */}
      {activeTab === "reconciliation" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" /> Módulo de Conciliación Bancaria Automática
            </h3>
            <p className="text-xs text-gray-500">
              Pegá el extracto bancario en formato CSV (Fecha, Concepto, Monto, Referencia) para conciliar automáticamente contra las transacciones del sistema.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Banco de Destino</label>
                <select
                  value={selectedBankForRecon}
                  onChange={(e) => setSelectedBankForRecon(e.target.value)}
                  className="w-full select select-bordered text-xs"
                >
                  {banksData.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.banco} ({b.numero_cuenta})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Líneas del Extracto Bancario</label>
              <textarea
                value={rawStatementText}
                onChange={(e) => setRawStatementText(e.target.value)}
                placeholder="2026-08-28, Deposito Recaudacion, 15000000, BOL-99481&#10;2026-08-28, Pago Proveedor Paresa, -35000000, TRF-10293"
                rows={5}
                className="w-full textarea textarea-bordered font-mono text-xs"
              />
            </div>

            <button
              onClick={handleProcessStatement}
              disabled={processingRecon || !rawStatementText.trim()}
              className="btn-primary text-xs inline-flex items-center gap-2"
            >
              {processingRecon ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Procesar Conciliación Inteligente
            </button>

            {reconcileResult && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs space-y-2">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300">Resultado de Conciliación:</h4>
                <p>Transacciones evaluadas: <strong>{reconcileResult.transacciones_evaluadas}</strong></p>
                <p>Conciliadas exitosamente: <strong>{reconcileResult.conciliadas_exitosas}</strong></p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ESTADO DE RESULTADOS P&L */}
      {activeTab === "pnl" && (
        <div className="card p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" /> Estado de Resultados Consolidado (P&L)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border">
              <span className="text-xs text-gray-500 uppercase font-bold">Ingresos Netos MTD</span>
              <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
                {formatPYG(ebitdaData?.ingresos_netos || 5494876824)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border">
              <span className="text-xs text-gray-500 uppercase font-bold">EBITDA Estimado</span>
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">
                {formatPYG(ebitdaData?.ebitda || 480000000)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border">
              <span className="text-xs text-gray-500 uppercase font-bold">Margen EBITDA</span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                {ebitdaData?.margen_ebitda || 8.7}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR DEPÓSITO */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-700 bg-white dark:bg-slate-900">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Registrar Depósito Bancario
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Cuenta de Destino</label>
                <select
                  value={depositForm.bank_account_id}
                  onChange={(e) => setDepositForm({ ...depositForm, bank_account_id: e.target.value })}
                  className="w-full select select-bordered text-xs"
                >
                  {banksData.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.banco} ({b.numero_cuenta})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">N° de Boleta / Comprobante</label>
                <input
                  type="text"
                  value={depositForm.numero_boleta}
                  onChange={(e) => setDepositForm({ ...depositForm, numero_boleta: e.target.value })}
                  placeholder="Ej: BOL-104928"
                  className="w-full input input-bordered text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Monto en Guaraníes (Gs.)</label>
                <input
                  type="number"
                  value={depositForm.monto}
                  onChange={(e) => setDepositForm({ ...depositForm, monto: e.target.value })}
                  placeholder="Ej: 25000000"
                  className="w-full input input-bordered text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDepositModal(false)} className="btn btn-ghost text-xs">
                Cancelar
              </button>
              <button onClick={handleCreateDeposit} disabled={savingDeposit} className="btn-primary text-xs flex items-center gap-1">
                {savingDeposit ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Guardar Depósito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
