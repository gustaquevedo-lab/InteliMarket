import { useState, useEffect, useMemo } from "react"
import { api, type SupplierInvoice, type Budget, type PaymentRun, type CashFlowProjection, type FinancialDashboard, type BankAccount } from "../../api"
import { formatPYG, formatDate } from "../../utils/format"
import { useToast } from "../../context/ToastContext"
import {
  Search, Plus, Loader2, DollarSign, Building2, Landmark, PiggyBank, TrendingUp,
  BarChart3, CheckCircle, XCircle, AlertTriangle, Receipt, FileText, Calendar, Clock,
  ArrowUpRight, ArrowDownRight, Eye, Trash2, CreditCard, Ban, FileSpreadsheet,
  FileDown, RefreshCw, Sparkles, Filter, ChevronRight, CheckCircle2, AlertCircle,
  Layers, ShieldCheck, Check, Phone, ArrowRight, HelpCircle, Download
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, BarChart, Bar, Legend, Cell, PieChart as RechartsPie, Pie
} from "recharts"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

type Tab = "dashboard" | "ap" | "pagos" | "cashflow" | "presupuestos"

const RUBROS_SUPERMERCADO = [
  { id: "carnes", label: "Carnicería & Aves", color: "#ef4444" },
  { id: "lacteos", label: "Lácteos & Fiambrería", color: "#3b82f6" },
  { id: "panificados", label: "Panadería & Confitería", color: "#f59e0b" },
  { id: "frutas", label: "Frutas & Verduras", color: "#10b981" },
  { id: "bebidas", label: "Bebidas & Licores", color: "#8b5cf6" },
  { id: "almacen", label: "Almacén Seco & Despensa", color: "#ec4899" },
  { id: "limpieza", label: "Limpieza & Perfumería", color: "#06b6d4" },
  { id: "otros", label: "Servicios & Otros", color: "#64748b" },
]

export default function FinancialPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboard, setDashboard] = useState<any>(null)
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [paymentRuns, setPaymentRuns] = useState<PaymentRun[]>([])
  const [cashFlow, setCashFlow] = useState<CashFlowProjection[]>([])
  const [cashFlowSaldoBancario, setCashFlowSaldoBancario] = useState<number | null>(null)
  const [alertConfig, setAlertConfig] = useState<{ activo: boolean; dias_horizonte: number; telefono: string | null } | null>(null)
  const [savingAlertConfig, setSavingAlertConfig] = useState(false)
  const [aging, setAging] = useState<any[]>([])
  const [creditNotes, setCreditNotes] = useState<any[]>([])
  const [supplierReturns, setSupplierReturns] = useState<any[]>([])
  const [paymentQueue, setPaymentQueue] = useState<any>(null)
  const [apApprovals, setApApprovals] = useState<any[]>([])
  const [banks, setBanks] = useState<BankAccount[]>([])

  // Filtros y Búsqueda AP
  const [search, setSearch] = useState("")
  const [filterEstado, setFilterEstado] = useState("todos")
  const [filterRubro, setFilterRubro] = useState("todos")

  // Modales AP y Pagos
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [showPayModal, setShowPayModal] = useState<SupplierInvoice | null>(null)
  const [payForm, setPayForm] = useState({
    monto: "",
    payment_method: "transferencia",
    bank_account_id: "",
    fecha_pago: new Date().toISOString().split("T")[0],
    referencia: "",
    retencion_iva: "0",
    retencion_renta: "0",
  })
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // Payment Run Builder (Lotes de Pago Masivo)
  const [showPaymentRunWizard, setShowPaymentRunWizard] = useState(false)
  const [runStep, setRunStep] = useState<1 | 2 | 3>(1)
  const [runForm, setRunForm] = useState({
    nombre: `Lote de Pago ${new Date().toLocaleDateString("es-PY")}`,
    fecha_programada: new Date().toISOString().split("T")[0],
    metodo_pago: "transferencia",
    bank_account_id: "",
  })
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set())
  const [submittingRun, setSubmittingRun] = useState(false)
  const [activeRunDetail, setActiveRunDetail] = useState<any | null>(null)

  // Presupuestos
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState({
    nombre: "",
    periodo: new Date().toISOString().slice(0, 7),
    categoria: "Almacén",
    monto_presupuestado: "",
    area: "salon",
    tipo: "egreso",
  })
  const [budgetFilterPeriodo, setBudgetFilterPeriodo] = useState(new Date().toISOString().slice(0, 7))

  // Exportar PnL
  const [exportingPnl, setExportingPnl] = useState(false)

  const toast = useToast()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [
        dashData,
        invData,
        agingData,
        runsData,
        cfData,
        budData,
        cnData,
        retData,
        pqData,
        apprData,
        banksData,
      ] = await Promise.allSettled([
        api.financial.apDashboard(),
        api.financial.invoices.list({ limit: 1000 }),
        api.financial.aging().catch(() => ({ por_supplier: [] })),
        api.financial.paymentRuns.list(),
        api.financial.cashFlow.list(),
        api.financial.budgets.list(),
        api.financial.creditNotes().catch(() => []),
        api.financial.supplierReturns().catch(() => []),
        api.financial.paymentQueue().catch(() => null),
        api.financial.apApprovals.list("pendiente").catch(() => []),
        api.financial.banks.list().catch(() => []),
      ])

      if (dashData.status === "fulfilled") setDashboard(dashData.value)
      if (invData.status === "fulfilled") setInvoices(invData.value)
      if (agingData.status === "fulfilled") setAging((agingData.value as any)?.por_supplier || [])
      if (runsData.status === "fulfilled") setPaymentRuns(runsData.value)
      if (cfData.status === "fulfilled") setCashFlow(cfData.value)
      if (budData.status === "fulfilled") setBudgets(budData.value)
      if (cnData.status === "fulfilled") setCreditNotes(cnData.value)
      if (retData.status === "fulfilled") setSupplierReturns(retData.value)
      if (pqData.status === "fulfilled") setPaymentQueue(pqData.value)
      if (apprData.status === "fulfilled") setApApprovals(apprData.value)
      if (banksData.status === "fulfilled") setBanks(banksData.value)
    } catch {
      toast.error("Error", "No se pudieron sincronizar los datos financieros")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleExportPnl = async () => {
    setExportingPnl(true)
    try {
      await api.gerencial.exportPnlPdf()
      toast.success("Descargado", "Estado de Resultados generado en PDF")
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo exportar el Estado de Resultados")
    } finally {
      setExportingPnl(false)
    }
  }

  // Filtrado de Facturas AP
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch =
        !search ||
        inv.numero_factura?.toLowerCase().includes(search.toLowerCase()) ||
        inv.supplier_nombre?.toLowerCase().includes(search.toLowerCase()) ||
        inv.timbrado?.includes(search)

      const isVencida = inv.estado === "pendiente" && inv.fecha_vencimiento && new Date(inv.fecha_vencimiento) < new Date()
      let matchEstado = true
      if (filterEstado === "pendiente") matchEstado = inv.estado === "pendiente"
      if (filterEstado === "pagada") matchEstado = inv.estado === "pagada"
      if (filterEstado === "vencida") matchEstado = !!isVencida

      return matchSearch && matchEstado
    })
  }, [invoices, search, filterEstado])

  // Métricas Clave de Proveedores (Calculadas desde el Backend Completo)
  const totalDeudaAP = useMemo(() => {
    if (dashboard?.total_pendiente != null) return Number(dashboard.total_pendiente)
    return invoices
      .filter(i => i.estado === "pendiente")
      .reduce((sum, i) => sum + Number(i.saldo_pendiente ?? i.total ?? 0), 0)
  }, [dashboard, invoices])

  const facturasVencidas = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    return invoices.filter(i => i.estado === "pendiente" && i.fecha_vencimiento && i.fecha_vencimiento < today)
  }, [invoices])

  const montoVencidoAP = useMemo(() => {
    if (dashboard?.total_vencido != null) return Number(dashboard.total_vencido)
    return facturasVencidas.reduce((sum, i) => sum + Number(i.saldo_pendiente ?? i.total ?? 0), 0)
  }, [dashboard, facturasVencidas])

  const cantFacturasPendientes = useMemo(() => {
    return dashboard?.facturas_pendientes ?? invoices.filter(i => i.estado === "pendiente").length
  }, [dashboard, invoices])

  const cantFacturasVencidas = useMemo(() => {
    return dashboard?.facturas_vencidas ?? facturasVencidas.length
  }, [dashboard, facturasVencidas])

  const totalNotasCredito = useMemo(() => {
    return creditNotes.reduce((sum, c) => sum + Number(c.monto || 0), 0)
  }, [creditNotes])

  // Datos para Gráfico de Vencimientos Semanales
  const weeklyDueData = useMemo(() => {
    const weeks: Record<string, number> = { "Vencidas": 0, "Semana 1": 0, "Semana 2": 0, "Semana 3": 0, "Semana 4+": 0 }
    const now = new Date()
    const todayStr = now.toISOString().split("T")[0]

    invoices.filter(i => i.estado === "pendiente").forEach(i => {
      const saldo = Number(i.saldo_pendiente ?? i.total ?? 0)
      if (!i.fecha_vencimiento || i.fecha_vencimiento < todayStr) {
        weeks["Vencidas"] += saldo
      } else {
        const diffDays = Math.ceil((new Date(i.fecha_vencimiento).getTime() - now.getTime()) / (1000 * 3600 * 24))
        if (diffDays <= 7) weeks["Semana 1"] += saldo
        else if (diffDays <= 14) weeks["Semana 2"] += saldo
        else if (diffDays <= 21) weeks["Semana 3"] += saldo
        else weeks["Semana 4+"] += saldo
      }
    })

    return Object.entries(weeks).map(([name, monto]) => ({ name, monto }))
  }, [invoices])

  // Manejo de Pagos Directos
  const handleOpenPayModal = (inv: SupplierInvoice) => {
    setShowPayModal(inv)
    setPayForm({
      monto: String(inv.saldo_pendiente ?? inv.total ?? ""),
      payment_method: "transferencia",
      bank_account_id: banks[0]?.id || "",
      fecha_pago: new Date().toISOString().split("T")[0],
      referencia: "",
      retencion_iva: "0",
      retencion_renta: "0",
    })
  }

  const handleConfirmDirectPayment = async () => {
    if (!showPayModal) return
    setSubmittingPayment(true)
    try {
      await api.financial.invoices.pay(showPayModal.id, {
        monto: Number(payForm.monto),
        payment_method: payForm.payment_method,
        fecha_pago: payForm.fecha_pago,
        referencia: payForm.referencia || undefined,
      })
      toast.success("Pago registrado", `Pago de ${formatPYG(Number(payForm.monto))} aplicado a factura ${showPayModal.numero_factura}`)
      setShowPayModal(null)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al registrar pago", e.message)
    } finally {
      setSubmittingPayment(false)
    }
  }

  // Payment Run Wizard
  const handleToggleInvoiceSelection = (id: string) => {
    const next = new Set(selectedInvoiceIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedInvoiceIds(next)
  }

  const handleSelectAllInvoices = () => {
    if (selectedInvoiceIds.size === invoices.filter(i => i.estado === "pendiente").length) {
      setSelectedInvoiceIds(new Set())
    } else {
      setSelectedInvoiceIds(new Set(invoices.filter(i => i.estado === "pendiente").map(i => i.id)))
    }
  }

  const selectedInvoicesList = useMemo(() => {
    return invoices.filter(i => selectedInvoiceIds.has(i.id))
  }, [invoices, selectedInvoiceIds])

  const totalSelectedRun = useMemo(() => {
    return selectedInvoicesList.reduce((sum, i) => sum + Number(i.saldo_pendiente ?? i.total ?? 0), 0)
  }, [selectedInvoicesList])

  const handleCreatePaymentRun = async () => {
    if (selectedInvoiceIds.size === 0) {
      toast.error("Selección requerida", "Marcá al menos una factura para el lote de pago")
      return
    }
    setSubmittingRun(true)
    try {
      const res = await api.financial.paymentRuns.create({
        nombre: runForm.nombre,
        fecha_programada: runForm.fecha_programada,
        metodo_pago: runForm.metodo_pago,
        bank_account_id: runForm.bank_account_id || undefined,
        invoice_ids: Array.from(selectedInvoiceIds),
      })
      toast.success("Lote de pago creado", `Lote "${runForm.nombre}" generado con ${selectedInvoiceIds.size} facturas por ${formatPYG(totalSelectedRun)}`)
      setShowPaymentRunWizard(false)
      setSelectedInvoiceIds(new Set())
      setRunStep(1)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al crear lote", e.message)
    } finally {
      setSubmittingRun(false)
    }
  }

  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up">
      {/* ── BANNER HERO EJECUTIVO CUENTAS POR PAGAR (AP) ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/50">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-amber-400 shadow-inner">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  Pasivos Comerciales & Lotes SIPAP
                </span>
                <h1 className="text-2xl sm:text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate tracking-tight text-white">
                  Cuentas por Pagar & Tesorería
                </h1>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-medium">
              Gestión de pasivos con proveedores, curvas de vencimiento, lotes de pago bancario masivo (SIPAP/Bancos) y flujo de caja a 90 días.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Pasivo Total a Proveedores
              </span>
              <div className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-amber-400 leading-tight">
                {formatPYG(totalDeudaAP)}
              </div>
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                {cantFacturasPendientes} facturas por pagar
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setRefreshing(true); fetchAll(); }}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition shadow-xs"
                title="Actualizar datos en vivo"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={handleExportPnl}
                disabled={exportingPnl}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition flex items-center gap-2 shadow-xs"
              >
                {exportingPnl ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-red-400" />}
                <span>PyG PDF</span>
              </button>
              <button
                onClick={() => { setShowPaymentRunWizard(true); setRunStep(1); }}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black transition flex items-center gap-2 shadow-md shadow-primary/30"
              >
                <Layers className="w-4 h-4" />
                <span>Nuevo Lote SIPAP</span>
              </button>
            </div>
          </div>
        </div>
      </div>

{/* KPI Cards Ejecutivos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-5 border-amber-200/60 dark:border-amber-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Deuda Comercial Total (AP)</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 font-mono">{formatPYG(totalDeudaAP)}</p>
          <span className="text-xs text-gray-400 mt-1 block">
            {cantFacturasPendientes} facturas pendientes ({dashboard?.proveedores_con_deuda || aging.length || 70} proveedores)
          </span>
        </div>

        <div className="card p-5 border-red-200/60 dark:border-red-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Deuda Vencida (En Mora)</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-extrabold text-red-600 font-mono">{formatPYG(montoVencidoAP)}</p>
          <span className="text-xs text-gray-400 mt-1 block">
            {cantFacturasVencidas} facturas vencidas
          </span>
        </div>

        <div className="card p-5 border-emerald-200/60 dark:border-emerald-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Notas de Crédito a Favor</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 font-mono">{formatPYG(totalNotasCredito)}</p>
          <span className="text-xs text-gray-400 mt-1 block">
            {creditNotes.length} notas de crédito disponibles
          </span>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Lotes de Pago Ejecutados</span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white font-mono">{paymentRuns.length}</p>
          <span className="text-xs text-gray-400 mt-1 block">Órdenes bancarias masivas</span>
        </div>
      </div>

      {/* Tabs de Navegación */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Torre de Control AP", icon: BarChart3 },
            { key: "ap", label: "Cuentas por Pagar (Facturas)", icon: Receipt, count: cantFacturasPendientes },
            { key: "pagos", label: "Lotes de Pago (Payment Runs)", icon: Layers, count: paymentRuns.length },
            { key: "cashflow", label: "Flujo de Caja (90 Días)", icon: TrendingUp },
            { key: "presupuestos", label: "Presupuestos por Sector", icon: PiggyBank, count: budgets.length },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  tab === t.key ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* TAB 1: TORRE DE CONTROL AP */}
          {tab === "dashboard" && (
            <div className="space-y-6">
              {/* Gráficos de Vencimientos y Rubros */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Vencimientos Semanales */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-500" />
                        Curva de Vencimientos Semanales
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">Distribución cronológica de compromisos de pago</p>
                    </div>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyDueData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} fontSize={11} />
                        <Tooltip formatter={(v: any) => [formatPYG(Number(v)), "Monto"]} />
                        <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                          {weeklyDueData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === "Vencidas" ? "#ef4444" : entry.name === "Semana 1" ? "#f59e0b" : "#3b82f6"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Proveedores Acreedores */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        Top Proveedores con Mayor Saldo Pendiente
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">Concentración de deuda comercial</p>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {aging.slice(0, 8).map((sup: any) => (
                      <div key={sup.supplier_id} className="p-3 rounded-xl border bg-gray-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">{sup.razon_social || sup.supplier_name || "Proveedor"}</div>
                          <div className="text-gray-400 text-[11px] mt-0.5">
                            {sup.vencido > 0 ? (
                              <span className="text-red-500 font-semibold">Vencido: {formatPYG(sup.vencido)}</span>
                            ) : (
                              <span className="text-emerald-500 font-semibold">Al día</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                            {formatPYG(sup.total_pendiente || sup.saldo_total || sup.total || 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Alertas Inteligentes del Finance Agent */}
              <div className="card p-6 bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-slate-800/90 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-4">
                <Sparkles className="w-6 h-6 text-indigo-600 dark:text-amber-400 shrink-0 mt-1" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">Recomendación de Tesorería Supermercado</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Existen <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPYG(totalNotasCredito)}</span> en notas de crédito de proveedores de lácteos y carnes disponibles para compensar. Te sugerimos generar un <strong>Lote de Pago (Payment Run)</strong> para consolidar las facturas de la semana y aplicar las retenciones impositivas de IVA correspondientes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUENTAS POR PAGAR (AP) */}
          {tab === "ap" && (
            <div className="space-y-5">
              {/* Barra de Filtros y Búsqueda */}
              <div className="card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-48">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Estado</label>
                    <select className="input-field w-full text-xs" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                      <option value="todos">Todas las Facturas</option>
                      <option value="pendiente">Solo Pendientes</option>
                      <option value="vencida">Solo Vencidas</option>
                      <option value="pagada">Solo Pagadas</option>
                    </select>
                  </div>

                  <div className="flex-1 min-w-[240px]">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Buscar</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Proveedor, RUC, N° factura, timbrado..."
                        className="input-field pl-9 w-full text-xs"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Facturas Proveedores */}
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                        <th className="p-3.5">Proveedor</th>
                        <th className="p-3.5">N° Factura</th>
                        <th className="p-3.5">Timbrado</th>
                        <th className="p-3.5">Emisión</th>
                        <th className="p-3.5">Vencimiento</th>
                        <th className="p-3.5">Monto Total</th>
                        <th className="p-3.5">Saldo Pendiente</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                      {filteredInvoices.map(inv => {
                        const isVencida = inv.estado === "pendiente" && inv.fecha_vencimiento && new Date(inv.fecha_vencimiento) < new Date()
                        return (
                          <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3.5 font-bold text-gray-900 dark:text-white max-w-xs truncate" title={inv.supplier_nombre}>
                              {inv.supplier_nombre || "Proveedor General"}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-xs text-gray-900 dark:text-white">
                              {inv.numero_factura || "—"}
                            </td>
                            <td className="p-3.5 font-mono text-xs text-gray-500">
                              {inv.timbrado || "—"}
                            </td>
                            <td className="p-3.5 text-xs text-gray-500 font-mono">
                              {inv.fecha_emision ? new Date(inv.fecha_emision).toLocaleDateString("es-PY") : "—"}
                            </td>
                            <td className="p-3.5 text-xs font-mono">
                              <span className={isVencida ? "text-red-600 font-bold" : "text-gray-600 dark:text-gray-300"}>
                                {inv.fecha_vencimiento ? new Date(inv.fecha_vencimiento).toLocaleDateString("es-PY") : "—"}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                              {formatPYG(inv.total)}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                              {formatPYG(inv.saldo_pendiente ?? inv.total)}
                            </td>
                            <td className="p-3.5">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                inv.estado === "pagada"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200"
                                  : isVencida
                                  ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200"
                              }`}>
                                {inv.estado === "pagada" ? "Pagada" : isVencida ? "Vencida" : "Pendiente"}
                              </span>
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              {inv.estado === "pendiente" && (
                                <button
                                  onClick={() => handleOpenPayModal(inv)}
                                  className="btn-primary py-1 px-2.5 text-xs"
                                >
                                  Pagar
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOTES DE PAGO (PAYMENT RUNS) */}
          {tab === "pagos" && (
            <div className="space-y-6">
              <div className="card p-6 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-slate-800/90 dark:to-slate-900 border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-wider block">Emisión Masiva de Pagos Bancarios</span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Lotes de Pago a Proveedores (SIPAP)</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                    Agrupá múltiples facturas para transferencias masivas vía SIPAP o cheques, con cálculo automático de retenciones y doble firma de seguridad.
                  </p>
                </div>
                <button
                  onClick={() => { setShowPaymentRunWizard(true); setRunStep(1); }}
                  className="btn-primary text-xs flex items-center gap-2 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Crear Nuevo Lote
                </button>
              </div>

              {/* Lista de Lotes Ejecutados */}
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 font-bold text-sm text-gray-900 dark:text-white">
                  Historial de Lotes de Pago ({paymentRuns.length})
                </div>

                {paymentRuns.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    No hay lotes de pago registrados. Hacé clic en "Crear Nuevo Lote" para comenzar.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                          <th className="p-3.5">Nombre del Lote</th>
                          <th className="p-3.5">Fecha Programada</th>
                          <th className="p-3.5">Método de Pago</th>
                          <th className="p-3.5">Monto Total</th>
                          <th className="p-3.5">Estado</th>
                          <th className="p-3.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                        {paymentRuns.map(run => (
                          <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                            <td className="p-3.5 font-bold text-gray-900 dark:text-white">{run.nombre}</td>
                            <td className="p-3.5 text-xs font-mono">{run.fecha_programada}</td>
                            <td className="p-3.5 text-xs capitalize">{run.metodo_pago}</td>
                            <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">{formatPYG(run.total_monto)}</td>
                            <td className="p-3.5">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                run.estado === "ejecutado" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                              }`}>
                                {run.estado}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <button onClick={() => setActiveRunDetail(run)} className="btn-outline py-1 px-2.5 text-xs">
                                Ver Detalle
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: FLUJO DE CAJA (90 DÍAS) */}
          {tab === "cashflow" && (
            <div className="space-y-6">
              <div className="card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Proyección de Flujo de Caja (Próximos 90 Días)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Estimación diaria de ingresos por ventas y egresos por pagos a proveedores y costos operativos
                    </p>
                  </div>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlow}>
                      <defs>
                        <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="fecha" fontSize={10} tickFormatter={f => f.slice(5)} />
                      <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} fontSize={10} />
                      <Tooltip formatter={(v: any) => [formatPYG(Number(v)), "Saldo Proyectado"]} />
                      <ReferenceLine y={50_000_000} stroke="#ef4444" strokeDasharray="3 3" label="Umbral de Seguridad (50M)" />
                      <Area type="monotone" dataKey="saldo_proyectado" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSaldo)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PRESUPUESTOS POR SECTOR */}
          {tab === "presupuestos" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Presupuestos Operativos de Supermercado</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Control de gastos por sector y rubro de mercaderías</p>
                </div>
                <button onClick={() => setShowBudgetForm(true)} className="btn-primary text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Asignar Presupuesto
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {RUBROS_SUPERMERCADO.map(rubro => (
                  <div key={rubro.id} className="card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">{rubro.label}</span>
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: rubro.color }} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Ejecutado vs Límite</span>
                        <span className="font-bold text-gray-900 dark:text-white">65%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: "65%" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: Pago Directo de Factura */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registrar Pago a Proveedor</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {showPayModal.supplier_nombre} — Factura N° {showPayModal.numero_factura}
              </p>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div>
                <label className="label-field">Monto a Transferir (₲) *</label>
                <input
                  className="input-field font-mono text-sm font-bold"
                  type="number"
                  value={payForm.monto}
                  onChange={e => setPayForm({ ...payForm, monto: e.target.value })}
                />
              </div>
              <div>
                <label className="label-field">Medio de Pago</label>
                <select
                  className="input-field"
                  value={payForm.payment_method}
                  onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                >
                  <option value="transferencia">Transferencia Bancaria (SIPAP)</option>
                  <option value="cheque">Cheque Propio</option>
                  <option value="efectivo">Efectivo de Caja Central</option>
                </select>
              </div>
              <div>
                <label className="label-field">N° Referencia / Comprobante</label>
                <input
                  className="input-field"
                  placeholder="Ej: Transf. SIPAP 981244"
                  value={payForm.referencia}
                  onChange={e => setPayForm({ ...payForm, referencia: e.target.value })}
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPayModal(null)} className="btn-ghost text-xs">Cancelar</button>
              <button
                onClick={handleConfirmDirectPayment}
                disabled={submittingPayment || !payForm.monto}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {submittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Wizard Payment Run Builder */}
      {showPaymentRunWizard && (
        <div className="modal-overlay" onClick={() => setShowPaymentRunWizard(false)}>
          <div className="modal-content max-w-4xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Asistente de Lotes de Pago Bancario (SIPAP)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Paso {runStep} de 2 — Selección y confirmación de órdenes de pago</p>
              </div>
              <button onClick={() => setShowPaymentRunWizard(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {runStep === 1 ? (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">Nombre del Lote *</label>
                      <input
                        className="input-field"
                        value={runForm.nombre}
                        onChange={e => setRunForm({ ...runForm, nombre: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label-field">Fecha de Ejecución *</label>
                      <input
                        className="input-field"
                        type="date"
                        value={runForm.fecha_programada}
                        onChange={e => setRunForm({ ...runForm, fecha_programada: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        Seleccionar Facturas de Proveedores ({selectedInvoiceIds.size} seleccionadas)
                      </span>
                      <button onClick={handleSelectAllInvoices} className="btn-ghost text-xs text-primary">
                        {selectedInvoiceIds.size === invoices.filter(i => i.estado === "pendiente").length ? "Deseleccionar Todas" : "Seleccionar Todas"}
                      </button>
                    </div>

                    <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-slate-800 text-[11px] font-bold text-gray-500 uppercase">
                            <th className="p-3 w-10"></th>
                            <th className="p-3">Proveedor</th>
                            <th className="p-3">Factura</th>
                            <th className="p-3">Vencimiento</th>
                            <th className="p-3 text-right">Saldo Pendiente</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                          {invoices.filter(i => i.estado === "pendiente").map(inv => {
                            const isSelected = selectedInvoiceIds.has(inv.id)
                            return (
                              <tr
                                key={inv.id}
                                onClick={() => handleToggleInvoiceSelection(inv.id)}
                                className={`cursor-pointer ${isSelected ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-50"}`}
                              >
                                <td className="p-3">
                                  <input type="checkbox" checked={isSelected} readOnly className="rounded text-primary" />
                                </td>
                                <td className="p-3 font-bold">{inv.supplier_nombre}</td>
                                <td className="p-3 font-mono">{inv.numero_factura}</td>
                                <td className="p-3 font-mono">{inv.fecha_vencimiento || "—"}</td>
                                <td className="p-3 font-mono font-bold text-right">{formatPYG(inv.saldo_pendiente ?? inv.total)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <span className="font-bold text-gray-700 dark:text-gray-300">Total del Lote</span>
                    <span className="text-xl font-extrabold text-primary font-mono">{formatPYG(totalSelectedRun)}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPaymentRunWizard(false)} className="btn-ghost text-xs">Cancelar</button>
              <button
                onClick={handleCreatePaymentRun}
                disabled={submittingRun || selectedInvoiceIds.size === 0}
                className="btn-primary text-xs disabled:opacity-50 flex items-center gap-2"
              >
                {submittingRun ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generar Lote de Pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
