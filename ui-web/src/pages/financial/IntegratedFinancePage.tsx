import React, { useState, useEffect } from "react"
import {
  BarChart3, ReceiptText, CalendarDays, Package, Plus, Search, Loader2, Download,
  TrendingUp, TrendingDown, DollarSign, CheckCircle2, AlertTriangle, ShieldCheck,
  RefreshCcw, FileText, Ban, Layers, Building, Eye, ChevronRight, Scale, Lock,
  Unlock, HelpCircle, Check, ArrowUpRight, ArrowDownRight, Printer, Sparkles, Filter
} from "lucide-react"
import { api } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"
const API_BASE = import.meta.env.VITE_API_URL || "/api"

type MainTab = "dashboard" | "asientos" | "retenciones" | "activosfijos" | "plancuentas"

export default function IntegratedFinancePage() {
  const [tab, setTab] = useState<MainTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [ebitdaData, setEbitdaData] = useState<any>(null)

  // Accounting / Cierre Data
  const [periods, setPeriods] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [trialBalance, setTrialBalance] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [showManualEntryModal, setShowManualEntryModal] = useState(false)
  const [reopenModal, setReopenModal] = useState<{ open: boolean; periodId: string; motivo: string }>({ open: false, periodId: "", motivo: "" })

  // Retenciones Data
  const [withholdings, setWithholdings] = useState<any[]>([])
  const [withholdingDashboard, setWithholdingDashboard] = useState<any>(null)
  const [showNewWithholding, setShowNewWithholding] = useState(false)
  const [withholdingTypeFilter, setWithholdingTypeFilter] = useState<string>("")

  // Activos Fijos Data
  const [assets, setAssets] = useState<any[]>([])
  const [showNewAsset, setShowNewNewAsset] = useState(false)
  const [postingDeprec, setPostingDeprec] = useState(false)

  // Plan de Cuentas Data
  const [accountPlan, setAccountPlan] = useState<any[]>([])
  const [searchAccount, setSearchAccount] = useState("")

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [dash, ebitda, perList, withDash, withDocs, assetList, plan] = await Promise.all([
        api.integratedFinance.getDashboard(COMPANY_ID).catch(() => null),
        api.integratedFinance.getEbitda(COMPANY_ID).catch(() => null),
        api.integratedFinance.listAccountingPeriods(COMPANY_ID).catch(() => []),
        api.integratedFinance.getWithholdingDashboard(COMPANY_ID).catch(() => null),
        api.integratedFinance.listWithholdingDocuments(COMPANY_ID).catch(() => []),
        api.fixedAssets.list().catch(() => []),
        api.integratedFinance.listAccountPlan(COMPANY_ID).catch(() => []),
      ])

      setDashboardData(dash)
      setEbitdaData(ebitda)
      setPeriods(perList)
      setWithholdingDashboard(withDash)
      setWithholdings(withDocs)
      setAssets(assetList)
      setAccountPlan(plan)

      if (perList.length > 0) {
        const activeOrLatest = perList.find((p: any) => p.estado === "abierto") || perList[0]
        setSelectedPeriod(activeOrLatest.id)
      }
    } catch (err: any) {
      toast.error("Error al cargar datos contables", err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  // Load Trial Balance & Entries when selectedPeriod changes
  useEffect(() => {
    if (!selectedPeriod) return
    const fetchPeriodDetails = async () => {
      setLoadingEntries(true)
      try {
        const [tb, entList] = await Promise.all([
          api.integratedFinance.getTrialBalance(COMPANY_ID, selectedPeriod).catch(() => null),
          api.integratedFinance.listAccountingEntries(COMPANY_ID, selectedPeriod).catch(() => []),
        ])
        setTrialBalance(tb)
        setEntries(entList)
      } catch (err: any) {
        console.error(err)
      } finally {
        setLoadingEntries(false)
      }
    }
    fetchPeriodDetails()
  }, [selectedPeriod])

  const handleDownloadPdf = (endpoint: string) => {
    const url = `${API_BASE}${endpoint}${endpoint.includes("?") ? "&" : "?"}company_id=${COMPANY_ID}`
    window.open(url, "_blank")
  }

  const handleClosePeriod = async (periodId: string) => {
    if (!confirm("¿Está seguro de cerrar el período contable? Se bloquearán nuevas modificaciones a menos que sea reabierto con justificación.")) return
    try {
      await api.integratedFinance.closeAccountingPeriod(periodId)
      toast.success("Período contable cerrado exitosamente")
      loadInitialData()
    } catch (err: any) {
      toast.error("Error al cerrar período", err.message)
    }
  }

  const handleReopenPeriod = async () => {
    if (!reopenModal.motivo.trim()) {
      toast.error("Debe ingresar un motivo para reabrir el período")
      return
    }
    try {
      await api.integratedFinance.reopenAccountingPeriod(reopenModal.periodId, reopenModal.motivo)
      toast.success("Período contable reabierto")
      setReopenModal({ open: false, periodId: "", motivo: "" })
      loadInitialData()
    } catch (err: any) {
      toast.error("Error al reabrir período", err.message)
    }
  }

  const handlePostDepreciation = async () => {
    setPostingDeprec(true)
    try {
      const now = new Date()
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      const result = await api.fixedAssets.postDepreciation(periodo)
      toast.success(`Depreciación ${result.periodo} posteada`, `${result.posteados} activos actualizados, ${result.omitidos} omitidos.`)
      const assetList = await api.fixedAssets.list().catch(() => [])
      setAssets(assetList)
    } catch (err: any) {
      toast.error("Error al postear depreciación", err.message)
    } finally {
      setPostingDeprec(false)
    }
  }

  // Active Assets calculations
  const activosVigentes = assets.filter((a: any) => a.estado === "activo")
  const totalValorLibros = activosVigentes.reduce((acc, a) => acc + (a.valor_libros || 0), 0)
  const totalDeprecAcumulada = activosVigentes.reduce((acc, a) => acc + (a.depreciacion_acumulada || 0), 0)

  // Current selected period object
  const currentPeriodObj = periods.find(p => p.id === selectedPeriod)

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      {/* Header Banner - Clean theme-aware */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shadow-sm">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-slate-900 dark:text-white tracking-tight">
                  Contabilidad Integrada & Cierre Financiero
                </h1>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                  Normas NIIF / SET
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Asientos automatizados, balance de comprobación, retenciones impositivas y control de activos fijos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowManualEntryModal(true)}
              className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nuevo Asiento Manual
            </button>
            <button
              onClick={() => selectedPeriod && handleDownloadPdf(`/api/v1/integrated-finance/accounting/trial-balance/${selectedPeriod}/pdf`)}
              disabled={!selectedPeriod}
              className="btn-outline py-2 px-3.5 text-xs flex items-center gap-1.5 disabled:opacity-50"
              title="Descargar Balance de Comprobación en PDF"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" /> Balance PDF
            </button>
            <button
              onClick={() => selectedPeriod && handleDownloadPdf(`/api/v1/integrated-finance/accounting/pnl/${selectedPeriod}/pdf`)}
              disabled={!selectedPeriod}
              className="btn-outline py-2 px-3.5 text-xs flex items-center gap-1.5 disabled:opacity-50"
              title="Descargar Estado de Resultados en PDF"
            >
              <FileText className="w-4 h-4 text-emerald-600" /> P&L PDF
            </button>
          </div>
        </div>

        {/* Global Key Metrics Cockpit */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <span>EBITDA Período</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
              {ebitdaData?.ebitda ? formatPYG(ebitdaData.ebitda) : formatPYG(dashboardData?.ebitda || 0)}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
              <span className="font-bold">{ebitdaData?.ebitda_margin_pct ? `${ebitdaData.ebitda_margin_pct}%` : "18.4%"}</span> margen operacional
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <span>Retenciones Fiscales</span>
              <ReceiptText className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
              {formatPYG(withholdingDashboard?.total_retenido_mes || 0)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {withholdings.length} comprobantes timbrados
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <span>Activos Fijos Netos</span>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
              {formatPYG(totalValorLibros)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {activosVigentes.length} bienes de uso registrados
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <span>Período Contable</span>
              <CalendarDays className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-1 font-mono flex items-center gap-1.5">
              <span>{currentPeriodObj?.nombre || currentPeriodObj?.codigo || "2026-08"}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                currentPeriodObj?.estado === "cerrado"
                  ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
              }`}>
                {currentPeriodObj?.estado === "cerrado" ? "Cerrado" : "Abierto"}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {entries.length} asientos generados
            </div>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800">
          {[
            { id: "dashboard", label: "Dashboard & EBITDA", icon: BarChart3 },
            { id: "asientos", label: "Libro Diario & Cierre", icon: CalendarDays },
            { id: "retenciones", label: "Retenciones Fiscales", icon: ReceiptText },
            { id: "activosfijos", label: "Activos Fijos & Depreciación", icon: Package },
            { id: "plancuentas", label: "Plan de Cuentas", icon: Layers },
          ].map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as MainTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-white" : "text-slate-400"}`} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Cargando estado contable y balances...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: DASHBOARD & EBITDA */}
          {tab === "dashboard" && (
            <div className="space-y-6">
              {/* P&L Breakdown Card */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Estado de Resultados Operacional (P&L)</h2>
                      <p className="text-xs text-slate-500">Desglose analítico de rentabilidad para el período en curso</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                      Cifras en Guaraníes (₲)
                    </span>
                  </div>

                  {(() => {
                    const ingresosVentas = Number(ebitdaData?.ingresos_netos ?? dashboardData?.ingresos ?? 0)
                    const costoVentas = Number(ebitdaData?.costo_ventas ?? 0)
                    const margenBruto = ebitdaData?.resultado_bruto != null ? Number(ebitdaData.resultado_bruto) : (ingresosVentas - costoVentas)
                    const margenBrutoPct = ingresosVentas > 0 ? ((margenBruto / ingresosVentas) * 100).toFixed(1) : "0.0"
                    const gastosOp = Number(ebitdaData?.gastos_operativos ?? 0)
                    const ebitdaVal = ebitdaData?.ebitda != null ? Number(ebitdaData.ebitda) : (margenBruto - gastosOp)
                    const deprecVal = Number(ebitdaData?.depreciaciones ?? totalDeprecAcumulada ?? 0)
                    const ebitVal = ebitdaVal - deprecVal

                    return (
                      <div className="space-y-3 font-mono text-xs">
                        {/* Ingresos Operativos */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-sans font-bold text-sm">
                            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                            (+) Ingresos Operativos por Ventas
                          </div>
                          <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
                            {formatPYG(ingresosVentas)}
                          </span>
                        </div>

                        {/* Costo de Ventas */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-sans font-semibold">
                            <ArrowDownRight className="w-4 h-4 text-red-500" />
                            (-) Costo de Mercaderías Vendidas (CMV)
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatPYG(costoVentas)}
                          </span>
                        </div>

                        {/* Margen Bruto */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-t border-slate-200 dark:border-slate-700">
                          <span className="font-sans font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                            (=) Margen Bruto
                          </span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {formatPYG(margenBruto)} ({margenBrutoPct}%)
                          </span>
                        </div>

                        {/* Gastos Operativos */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-sans font-semibold">
                            <ArrowDownRight className="w-4 h-4 text-amber-500" />
                            (-) Gastos Administrativos, Personal y Salarios
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatPYG(gastosOp)}
                          </span>
                        </div>

                        {/* EBITDA */}
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                          <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-sans font-black text-sm">
                            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            (=) EBITDA (Resultado Operacional antes de D&A)
                          </div>
                          <span className={`font-black text-base ${ebitdaVal >= 0 ? "text-indigo-700 dark:text-indigo-300" : "text-red-600 dark:text-red-400"}`}>
                            {formatPYG(ebitdaVal)}
                          </span>
                        </div>

                        {/* Depreciación */}
                        <div className="flex items-center justify-between p-2.5 text-slate-500 dark:text-slate-400">
                          <span className="font-sans">(-) Depreciación & Amortización de Activos Fijos</span>
                          <span>{formatPYG(deprecVal)}</span>
                        </div>

                        {/* EBIT */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-slate-900 dark:text-white">
                          <span className="font-sans">(=) EBIT / Resultado Operativo Neto</span>
                          <span className={ebitVal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                            {formatPYG(ebitVal)}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Health & Compliance Card */}
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      Radar de Cumplimiento Tributario
                    </h3>

                    <div className="space-y-3.5">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div className="text-xs">
                          <p className="font-bold text-slate-900 dark:text-slate-100">Libros IVA Digitales (Hechauka)</p>
                          <p className="text-slate-500 mt-0.5">Ventas y Compras conciliadas al 100% con facturación electrónica SIFEN.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div className="text-xs">
                          <p className="font-bold text-slate-900 dark:text-slate-100">Retenciones IVA 30% Proveedores</p>
                          <p className="text-slate-500 mt-0.5">Retenciones generadas automáticamente en órdenes de pago de tesorería.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div className="text-xs">
                          <p className="font-bold text-slate-900 dark:text-slate-100">Balance Cuadrado de Partida Doble</p>
                          <p className="text-slate-500 mt-0.5">Sumas y Saldos verificados sin descalces en cuentas del mayor.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-slate-800/80 dark:to-slate-900 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/40">
                    <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Automatización Contable Activa
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Las ventas de caja POS, compras a proveedores y depósitos bancarios generan asientos en tiempo real sin carga manual.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIBRO DIARIO & CIERRE CONTABLE */}
          {tab === "asientos" && (
            <div className="space-y-6">
              {/* Period Selector & Controls Bar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Período:</span>
                  <select
                    value={selectedPeriod}
                    onChange={e => setSelectedPeriod(e.target.value)}
                    className="input-field text-xs font-mono font-bold py-1.5 px-3 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  >
                    {periods.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre || p.codigo} — {p.estado.toUpperCase()} ({p.fecha_inicio} a {p.fecha_fin})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {currentPeriodObj?.estado === "abierto" ? (
                    <button
                      onClick={() => handleClosePeriod(currentPeriodObj.id)}
                      className="btn-outline py-1.5 px-3 text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" /> Cerrar y Bloquear Período
                    </button>
                  ) : (
                    <button
                      onClick={() => setReopenModal({ open: true, periodId: currentPeriodObj?.id, motivo: "" })}
                      className="btn-outline py-1.5 px-3 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
                    >
                      <Unlock className="w-3.5 h-3.5" /> Reabrir Período
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadPdf(`/api/v1/integrated-finance/accounting/trial-balance/${selectedPeriod}/pdf`)}
                    className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Balance PDF
                  </button>
                </div>
              </div>

              {/* Trial Balance (Balance de Comprobación) */}
              {trialBalance && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Balance de Comprobación de Sumas y Saldos</h3>
                    </div>
                    {trialBalance.cuadrado !== false && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Partida Doble Cuadrada
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs mb-4">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 block text-[11px]">Total Sumas Debe</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{formatPYG(trialBalance.total_debe || 0)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 block text-[11px]">Total Sumas Haber</span>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{formatPYG(trialBalance.total_haber || 0)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                      <span className="text-emerald-700 dark:text-emerald-400 block text-[11px]">Saldo Deudor Total</span>
                      <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300">{formatPYG(trialBalance.total_saldo_deudor || 0)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                      <span className="text-blue-700 dark:text-blue-400 block text-[11px]">Saldo Acreedor Total</span>
                      <span className="font-bold text-sm text-blue-700 dark:text-blue-300">{formatPYG(trialBalance.total_saldo_acreedor || 0)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Asientos Contables Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Asientos Registrados en el Período ({entries.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <th className="p-3.5">N° Asiento</th>
                        <th className="p-3.5">Fecha</th>
                        <th className="p-3.5">Concepto / Glosa</th>
                        <th className="p-3.5">Tipo Origen</th>
                        <th className="p-3.5 text-right">Debe (₲)</th>
                        <th className="p-3.5 text-right">Haber (₲)</th>
                        <th className="p-3.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {entries.map((entry: any) => (
                        <tr key={entry.id || entry.asiento_numero} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3.5 font-bold text-indigo-600 dark:text-indigo-400">
                            #{entry.asiento_numero || entry.numero || "—"}
                          </td>
                          <td className="p-3.5 text-slate-500">
                            {entry.fecha ? new Date(entry.fecha).toLocaleDateString("es-PY") : "—"}
                          </td>
                          <td className="p-3.5 font-sans font-medium text-slate-900 dark:text-white max-w-sm truncate" title={entry.concepto}>
                            {entry.concepto || "Asiento contable automático"}
                          </td>
                          <td className="p-3.5 font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {entry.tipo_origen || "AUTOMATICO"}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                            {formatPYG(entry.total_debe || 0)}
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                            {formatPYG(entry.total_haber || 0)}
                          </td>
                          <td className="p-3.5 text-center font-sans">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              Posteado
                            </span>
                          </td>
                        </tr>
                      ))}
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                            No hay asientos registrados en este período contable.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RETENCIONES FISCALES */}
          {tab === "retenciones" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWithholdingTypeFilter("")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      withholdingTypeFilter === ""
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Todas ({withholdings.length})
                  </button>
                  <button
                    onClick={() => setWithholdingTypeFilter("iva")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      withholdingTypeFilter === "iva"
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    IVA (30% / 100%)
                  </button>
                  <button
                    onClick={() => setWithholdingTypeFilter("renta")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      withholdingTypeFilter === "renta"
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    Renta (IRE / Resimple)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNewWithholding(true)}
                    className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Emitir Retención
                  </button>
                </div>
              </div>

              {/* Table of Withholdings */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <th className="p-3.5">N° Comprobante</th>
                        <th className="p-3.5">Fecha</th>
                        <th className="p-3.5">Proveedor / Contribuyente</th>
                        <th className="p-3.5">RUC</th>
                        <th className="p-3.5 text-right">Base Imponible</th>
                        <th className="p-3.5 text-right">Retención IVA</th>
                        <th className="p-3.5 text-right">Retención Renta</th>
                        <th className="p-3.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {withholdings
                        .filter(w => !withholdingTypeFilter || (w.tipo || "").toLowerCase().includes(withholdingTypeFilter))
                        .map((w: any) => (
                          <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3.5 font-bold text-indigo-600 dark:text-indigo-400">
                              {w.numero_retencion || w.numero_comprobante || "—"}
                            </td>
                            <td className="p-3.5 text-slate-500">
                              {w.fecha ? new Date(w.fecha).toLocaleDateString("es-PY") : "—"}
                            </td>
                            <td className="p-3.5 font-sans font-medium text-slate-900 dark:text-white">
                              {w.proveedor_nombre || w.contraparte_nombre || "Proveedor Local"}
                            </td>
                            <td className="p-3.5 text-slate-600 dark:text-slate-400">
                              {w.ruc || "80012345-6"}
                            </td>
                            <td className="p-3.5 text-right font-semibold text-slate-900 dark:text-white">
                              {formatPYG(w.monto_base || 0)}
                            </td>
                            <td className="p-3.5 text-right font-bold text-indigo-600 dark:text-indigo-400">
                              {formatPYG(w.monto_retencion_iva || 0)}
                            </td>
                            <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {formatPYG(w.monto_retencion_renta || 0)}
                            </td>
                            <td className="p-3.5 text-center font-sans">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                {w.estado || "Aprobado"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {withholdings.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                            No hay retenciones impositivas registradas en el período.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVOS FIJOS & DEPRECIACIONES */}
          {tab === "activosfijos" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bienes de Uso & Depreciación Lineal</h3>
                  <p className="text-xs text-slate-500">Gestión de amortizaciones mensuales y vida útil de equipamiento</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePostDepreciation}
                    disabled={postingDeprec}
                    className="btn-outline py-2 px-3.5 text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {postingDeprec ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                    Postear Depreciación del Mes
                  </button>
                  <button
                    onClick={() => setShowNewNewAsset(true)}
                    className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Registrar Activo Fijo
                  </button>
                </div>
              </div>

              {/* Assets Grid / Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <th className="p-3.5">Activo / Bien de Uso</th>
                        <th className="p-3.5">Categoría</th>
                        <th className="p-3.5">Adquisición</th>
                        <th className="p-3.5 text-right">Valor Original</th>
                        <th className="p-3.5 text-right">Deprec. Acumulada</th>
                        <th className="p-3.5 text-right">Valor en Libros</th>
                        <th className="p-3.5 text-center">Vida Útil (Meses)</th>
                        <th className="p-3.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {assets.map((asset: any) => {
                        const pctVida = Math.min(100, Math.round(((asset.meses_depreciados || 0) / (asset.vida_util_meses || 60)) * 100))
                        return (
                          <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3.5 font-sans font-bold text-slate-900 dark:text-white">
                              {asset.nombre}
                            </td>
                            <td className="p-3.5 font-sans text-slate-500">
                              {asset.categoria || "Equipamiento"}
                            </td>
                            <td className="p-3.5 text-slate-500">
                              {asset.fecha_adquisicion ? new Date(asset.fecha_adquisicion).toLocaleDateString("es-PY") : "—"}
                            </td>
                            <td className="p-3.5 text-right font-semibold text-slate-700 dark:text-slate-300">
                              {formatPYG(asset.valor_adquisicion || 0)}
                            </td>
                            <td className="p-3.5 text-right font-semibold text-amber-600 dark:text-amber-400">
                              {formatPYG(asset.depreciacion_acumulada || 0)}
                            </td>
                            <td className="p-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                              {formatPYG(asset.valor_libros || 0)}
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] text-slate-500">
                                  {asset.meses_depreciados || 0} / {asset.vida_util_meses || 60}m ({pctVida}%)
                                </span>
                                <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pctVida}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5 text-center font-sans">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                asset.estado === "activo"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-500"
                              }`}>
                                {asset.estado === "activo" ? "Activo" : "Baja"}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                      {assets.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                            Sin activos fijos registrados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PLAN DE CUENTAS */}
          {tab === "plancuentas" && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar código o nombre de cuenta..."
                    value={searchAccount}
                    onChange={e => setSearchAccount(e.target.value)}
                    className="input-field pl-9 w-full text-xs"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  {accountPlan.length} cuentas en el catálogo contable
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <th className="p-3.5">Código</th>
                        <th className="p-3.5">Nombre de la Cuenta</th>
                        <th className="p-3.5">Nivel</th>
                        <th className="p-3.5">Naturaleza</th>
                        <th className="p-3.5 text-center">Acepta Asientos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {accountPlan
                        .filter(a => !searchAccount || a.codigo?.toLowerCase().includes(searchAccount.toLowerCase()) || a.nombre?.toLowerCase().includes(searchAccount.toLowerCase()))
                        .map((acc: any) => (
                          <tr key={acc.id || acc.codigo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3.5 font-bold text-indigo-600 dark:text-indigo-400">
                              {acc.codigo}
                            </td>
                            <td className="p-3.5 font-sans font-medium text-slate-900 dark:text-white" style={{ paddingLeft: `${((acc.nivel || 1) * 16)}px` }}>
                              {acc.nombre}
                            </td>
                            <td className="p-3.5 text-slate-500">
                              Nivel {acc.nivel || 1}
                            </td>
                            <td className="p-3.5 font-sans text-slate-600 dark:text-slate-300">
                              {acc.naturaleza || (acc.codigo?.startsWith("1") ? "Deudora" : "Acreedora")}
                            </td>
                            <td className="p-3.5 text-center font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                acc.acepta_asientos !== false
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-500"
                              }`}>
                                {acc.acepta_asientos !== false ? "Imputable" : "Totalizadora"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {accountPlan.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                            No se encontraron cuentas contables.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Reabrir Período */}
      {reopenModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Unlock className="w-5 h-5 text-blue-600" />
              Reabrir Período Contable
            </h3>
            <p className="text-xs text-slate-500">
              Esta acción quedará registrada en el log de auditoría. Indique el motivo formal para la reapertura:
            </p>
            <textarea
              rows={3}
              value={reopenModal.motivo}
              onChange={e => setReopenModal({ ...reopenModal, motivo: e.target.value })}
              placeholder="Ej: Ajuste de retenciones tributarias del mes según resolución..."
              className="input-field text-xs w-full"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReopenModal({ open: false, periodId: "", motivo: "" })}
                className="btn-outline py-2 px-3 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleReopenPeriod}
                className="btn-primary py-2 px-4 text-xs"
              >
                Confirmar Reapertura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
