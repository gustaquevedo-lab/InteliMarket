import { useState, useEffect } from "react"
import {
  Bot, Sparkles, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw,
  Landmark, DollarSign, ArrowUpRight, ArrowDownRight, CreditCard, TrendingUp,
  Calendar, Plus, ArrowRightLeft, FileSpreadsheet, Building2
} from "lucide-react"
import { api, type FinanceRecommendation, type FinanceAgentRun } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatPYG, formatDateTime } from "../../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

type ActiveTab = "cfo" | "ai" | "banks" | "cajas" | "reconciliation" | "pnl"

const TIPO_LABEL: Record<string, string> = {
  cobranza: "Cobranza",
  pago_proveedor: "Pago a proveedor",
  alerta_presupuesto: "Presupuesto",
  control_caja_chica: "Control de caja chica",
  otro: "Otro",
}

export default function FinanceAgentPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("cfo")
  const [loading, setLoading] = useState(true)
  
  // Executive Suite State
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

  // Deposit Modal State
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositForm, setDepositForm] = useState({
    bank_account_id: "",
    numero_boleta: "",
    monto: "",
    concepto: "Depósito de Recaudación del Día",
  })
  const [savingDeposit, setSavingDeposit] = useState(false)

  const toast = useToast()
  const { user } = useAuth()

  async function loadAllData() {
    setLoading(true)
    
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
        toast.success("Diagnóstico IA Completado", "Se generaron recomendaciones para tesorería y cuentas por cobrar")
      }
      const data = await api.financeAgent.recommendations(filterStatus === "todos" ? undefined : filterStatus)
      setRecs(data || [])
    } catch (e: any) {
      toast.error("Error", e.message || "Error al ejecutar el diagnóstico del Gerente IA")
    } finally { setRunning(false) }
  }

  const decideRecommendation = async (id: string, approve: boolean) => {
    if (!user) return
    setDeciding(id)
    try {
      await (approve ? api.financeAgent.approve(id, user.id) : api.financeAgent.reject(id, user.id))
      toast.success(approve ? "Recomendación Aprobada" : "Recomendación Rechazada")
      const data = await api.financeAgent.recommendations(filterStatus === "todos" ? undefined : filterStatus)
      setRecs(data || [])
    } catch {
      toast.error("Error", "No se pudo actualizar el estado de la recomendación")
    } finally { setDeciding(null) }
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

  const totalBankBalance = banksData.reduce((sum, b) => sum + (parseFloat(b.saldo_actual) || 0), 0)
  const totalIngresosEsperados30d = cashFlowData?.total_ingresos_30d
    ? parseFloat(cashFlowData.total_ingresos_30d)
    : cashFlowData?.proyecciones?.reduce((sum: number, p: any) => sum + (parseFloat(p.ingresos_estimados) || 0), 0) || 0

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-400" /> Gerente Financiero
            </h1>
            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-3 py-1 rounded-full font-semibold">
              CASA GONZALITO S.R.L.
            </span>
          </div>
          <p className="text-slate-300 text-sm">
            Control de Tesorería, Flujo de Caja Proyectado, Bancos y Diagnóstico Financiero con IA
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runAIDiagnosis}
            disabled={running}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            Ejecutar Diagnóstico IA
          </button>
          <button
            onClick={loadAllData}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition flex items-center gap-2 border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("cfo")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "cfo" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Resumen Executive & Flujo de Caja
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "ai" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Bot className="w-4 h-4 text-amber-500" /> Gerente Financiero IA ({recs.length})
        </button>
        <button
          onClick={() => setActiveTab("banks")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "banks" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Landmark className="w-4 h-4" /> Cuentas Corrientes Bancarias
        </button>
        <button
          onClick={() => setActiveTab("cajas")}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "cajas" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <CreditCard className="w-4 h-4" /> Cajas & Rendición de Rutas
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
          <FileSpreadsheet className="w-4 h-4" /> Estado de Resultados P&L
        </button>
      </div>

      {/* TAB 1: EXECUTIVE CFO & CASH FLOW */}
      {activeTab === "cfo" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 border-l-4 border-l-primary bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-800 dark:to-slate-800/80">
              <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Saldo Bancario Consolidado</span>
                <Landmark className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatPYG(totalBankBalance)}
              </p>
              <span className="text-[11px] text-gray-400 mt-1 block">7 cuentas corrientes bancarias</span>
            </div>

            <div className="card p-5 border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-800 dark:to-slate-800/80">
              <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Ingresos Esperados (30 Días)</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatPYG(totalIngresosEsperados30d)}
              </p>
              <span className="text-[11px] text-emerald-600/80 mt-1 block font-medium">Cobranzas AR agendadas</span>
            </div>

            <div className="card p-5 border-l-4 border-l-indigo-500 bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-800 dark:to-slate-800/80">
              <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>EBITDA Mensual</span>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {formatPYG(ebitdaData?.ebitda || 0)}
              </p>
              <span className="text-[11px] text-indigo-600/80 mt-1 block font-bold">
                Margen EBITDA: {ebitdaData?.margen_ebitda || 0}%
              </span>
            </div>

            <div className="card p-5 border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-800 dark:to-slate-800/80">
              <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Ventas Netas del Mes</span>
                <DollarSign className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {formatPYG(ebitdaData?.ingresos_netos || consolidatedDash?.ingresos_del_mes || 0)}
              </p>
              <span className="text-[11px] text-gray-400 mt-1 block">Facturación del período</span>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Proyección de Flujo de Caja (30 Días)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Calculado según vencimientos de cuentas por cobrar (Ventas) y cuentas por pagar (Compras)
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full">
                Saldo a 30 Días: {formatPYG(cashFlowData?.saldo_proyectado_30d || 0)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800 text-xs font-bold uppercase text-gray-500 border-b">
                    <th className="p-3">Fecha</th>
                    <th className="p-3 text-right">Saldo Inicial</th>
                    <th className="p-3 text-right text-emerald-600">Ingresos Estimados</th>
                    <th className="p-3 text-right text-rose-600">Egresos Previstos</th>
                    <th className="p-3 text-right font-black">Saldo Final Proyectado</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm font-mono">
                  {cashFlowData?.proyecciones?.slice(0, 15).map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                        {new Date(p.fecha + "T00:00:00").toLocaleDateString("es-PY", {
                          weekday: "short", day: "2-digit", month: "short"
                        })}
                      </td>
                      <td className="p-3 text-right text-gray-500">{formatPYG(p.saldo_inicial)}</td>
                      <td className="p-3 text-right text-emerald-600 font-bold">
                        {p.ingresos_estimados > 0 ? formatPYG(p.ingresos_estimados) : "-"}
                      </td>
                      <td className="p-3 text-right text-rose-600 font-bold">
                        {p.egresos_estimados > 0 ? formatPYG(p.egresos_estimados) : "-"}
                      </td>
                      <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                        {formatPYG(p.saldo_final_proyectado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GERENTE FINANCIERO IA */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-500" /> Diagnóstico Financiero & Recomendaciones IA
              </h3>
              <p className="text-xs text-gray-500">
                Sugerencias automáticas sobre optimización de flujo de caja, cobranzas y pagos a proveedores
              </p>
            </div>
            <div className="flex gap-2">
              {["pending", "approved", "rejected", "todos"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                    filterStatus === st
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {st === "pending" ? "Pendientes" : st === "approved" ? "Aprobadas" : st === "rejected" ? "Rechazadas" : "Todas"}
                </button>
              ))}
            </div>
          </div>

          {lastRun && (
            <div className="card p-4 bg-amber-500/10 border-amber-500/20 text-xs flex justify-between items-center">
              <span>
                Última corrida de diagnóstico: <strong>{formatDateTime(lastRun.executed_at)}</strong> •{" "}
                {lastRun.recommendations_generated} recomendaciones creadas
              </span>
              <span className="font-bold uppercase text-amber-600">{lastRun.status}</span>
            </div>
          )}

          {recs.length === 0 ? (
            <div className="card p-12 text-center space-y-4">
              <Bot className="w-12 h-12 text-gray-400 mx-auto" />
              <h4 className="font-bold text-gray-700 dark:text-gray-300">No hay recomendaciones en este filtro</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Hacé clic en <strong>Ejecutar Diagnóstico IA</strong> para analizar las cuentas por cobrar y proveedores de Casa Gonzalito.
              </p>
              <button onClick={runAIDiagnosis} disabled={running} className="btn-primary text-xs inline-flex items-center gap-2">
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />} Ejecutar Diagnóstico Ahora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recs.map((r) => (
                <div key={r.id} className="card p-5 space-y-3 border-l-4 border-l-amber-500 shadow-md">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 uppercase">
                      {TIPO_LABEL[r.tipo] || r.tipo}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600">
                      Impacto: {formatPYG(r.monto_impacto)}
                    </span>
                  </div>

                  <h4 className="font-bold text-base text-slate-900 dark:text-white">{r.titulo}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{r.descripcion}</p>

                  <div className="pt-3 border-t flex justify-between items-center text-xs">
                    <span className="text-gray-400">{formatDateTime(r.created_at)}</span>

                    {r.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => decideRecommendation(r.id, false)}
                          disabled={deciding === r.id}
                          className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-bold flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Rechazar
                        </button>
                        <button
                          onClick={() => decideRecommendation(r.id, true)}
                          disabled={deciding === r.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                        </button>
                      </div>
                    ) : (
                      <span className={`font-bold capitalize ${r.status === "approved" ? "text-emerald-600" : "text-rose-600"}`}>
                        {r.status === "approved" ? "✓ Aprobado" : "✗ Rechazado"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BANK ACCOUNTS */}
      {activeTab === "banks" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">Cuentas Corrientes Bancarias de Casa Gonzalito S.R.L.</h3>
              <p className="text-xs text-gray-500">Bancos del sistema legacy con saldos operativos consolidados</p>
            </div>
            <button onClick={() => setShowDepositModal(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Registrar Boleta de Depósito
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {banksData.map((b) => (
              <div key={b.id} className="card p-5 border-l-4 border-l-primary space-y-4 shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold uppercase text-gray-400 tracking-wider">
                      {b.tipo} • {b.moneda}
                    </span>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">{b.banco}</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    Activa
                  </span>
                </div>

                <div>
                  <div className="text-xs text-gray-400">Número de Cuenta</div>
                  <div className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{b.numero_cuenta}</div>
                </div>

                <div className="pt-2 border-t flex justify-between items-end">
                  <div>
                    <div className="text-xs text-gray-400">Saldo Actual Disponible</div>
                    <div className="font-mono text-xl font-black text-primary">{formatPYG(b.saldo_actual)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CAJAS & RENDICIÓN */}
      {activeTab === "cajas" && (
        <div className="card p-8 text-center space-y-4">
          <CreditCard className="w-12 h-12 text-primary mx-auto opacity-80" />
          <h3 className="text-lg font-bold">Arqueo de Cajas & Rendición de Rutas</h3>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            Accedé al panel operativo para la rendición diaria de planillas de cobradores y cajas de sucursal.
          </p>
          <div className="pt-2">
            <a href="/caja" className="btn-primary text-sm inline-flex items-center gap-2">
              Ir a Arqueo de Cajas
            </a>
          </div>
        </div>
      )}

      {/* TAB 5: RECONCILIATION */}
      {activeTab === "reconciliation" && (
        <div className="card p-6 space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" /> Conciliación Bancaria Automática
          </h3>
          <p className="text-xs text-gray-500">
            Importación de extractos digitales (Continental, Interfisa, Familiar, GNB, BNF) para matcheo automático contra cobros y depósitos del sistema.
          </p>
          <div className="p-8 border-2 border-dashed rounded-xl text-center space-y-3 bg-gray-50 dark:bg-slate-800/40">
            <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto" />
            <div>
              <p className="text-sm font-semibold">Arrastrá aquí el archivo de Extracto Bancario</p>
              <p className="text-xs text-gray-400 mt-1">Formatos compatibles: .CSV, .XLSX, .TXT</p>
            </div>
            <button className="btn-outline text-xs">Seleccionar Archivo de Extracto</button>
          </div>
        </div>
      )}

      {/* TAB 6: PNL */}
      {activeTab === "pnl" && (
        <div className="max-w-3xl space-y-6">
          <div className="card p-6 space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h3 className="font-bold text-xl text-slate-900 dark:text-white">Estado de Resultados (P&L EBITDA)</h3>
                <p className="text-xs text-gray-500">Período Fiscal Actual ({ebitdaData?.periodo || "Agosto 2026"})</p>
              </div>
              <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                Margen EBITDA: {ebitdaData?.margen_ebitda || 0}%
              </span>
            </div>

            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="font-bold">Ingresos Netos por Ventas</span>
                <span className="font-black text-emerald-600">{formatPYG(ebitdaData?.ingresos_netos || 0)}</span>
              </div>
              <div className="flex justify-between py-2 border-b text-gray-600 dark:text-gray-400">
                <span>(-) Costo de Ventas (COGS Real)</span>
                <span className="text-rose-600">({formatPYG(ebitdaData?.costo_ventas || 0)})</span>
              </div>
              <div className="flex justify-between py-2 border-b font-bold bg-gray-50 dark:bg-slate-800/60 px-2 rounded">
                <span>(=) Resultado Bruto / Margen Bruto</span>
                <span className="text-blue-900 dark:text-blue-300">{formatPYG(ebitdaData?.resultado_bruto || 0)}</span>
              </div>
              <div className="flex justify-between py-2 border-b text-gray-600 dark:text-gray-400">
                <span>(-) Gastos Operativos & Administrativos</span>
                <span className="text-rose-600">({formatPYG(ebitdaData?.gastos_operativos || 0)})</span>
              </div>
              <div className="flex justify-between py-3 font-black text-lg bg-indigo-50 dark:bg-indigo-950/40 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <span className="text-indigo-900 dark:text-indigo-300">(=) EBITDA CONSOLIDADO</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatPYG(ebitdaData?.ebitda || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEPOSIT MODAL */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" /> Registrar Boleta de Depósito Bancario
            </h3>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Cuenta Bancaria de Destino</label>
                <select
                  className="input-field w-full"
                  value={depositForm.bank_account_id}
                  onChange={(e) => setDepositForm({ ...depositForm, bank_account_id: e.target.value })}
                >
                  {banksData.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.banco} - {b.numero_cuenta} ({formatPYG(b.saldo_actual)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Número de Boleta de Depósito</label>
                <input
                  type="text"
                  placeholder="Ej: 9874210"
                  className="input-field w-full font-mono"
                  value={depositForm.numero_boleta}
                  onChange={(e) => setDepositForm({ ...depositForm, numero_boleta: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Monto Depositado (₲)</label>
                <input
                  type="number"
                  placeholder="Ej: 15000000"
                  className="input-field w-full font-mono text-base font-bold"
                  value={depositForm.monto}
                  onChange={(e) => setDepositForm({ ...depositForm, monto: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Concepto / Detalle</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={depositForm.concepto}
                  onChange={(e) => setDepositForm({ ...depositForm, concepto: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowDepositModal(false)} className="btn-outline flex-1">
                Cancelar
              </button>
              <button
                onClick={handleCreateDeposit}
                disabled={savingDeposit}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {savingDeposit ? "Procesando..." : "Confirmar Depósito"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
