import { useState, useEffect } from "react"
import { api, type SupplierInvoice, type Budget, type PaymentRun, type CashFlowProjection, type FinancialDashboard } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"
import { Search, Plus, Loader2, DollarSign, Building2, Landmark, PiggyBank, TrendingUp, BarChart3, CheckCircle, XCircle, AlertTriangle, Receipt, FileText, Calendar, Clock, ArrowUpRight, ArrowDownRight, Eye, Trash2, CreditCard, Ban } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts"

type Tab = "dashboard" | "ap" | "cheques" | "cashflow" | "presupuestos" | "pagos"

export default function FinancialPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null)
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [paymentRuns, setPaymentRuns] = useState<PaymentRun[]>([])
  const [cashFlow, setCashFlow] = useState<CashFlowProjection[]>([])
  const [cashFlowSaldoBancario, setCashFlowSaldoBancario] = useState<number | null>(null)
  const [alertConfig, setAlertConfig] = useState<{ activo: boolean; dias_horizonte: number; telefono: string | null } | null>(null)
  const [savingAlertConfig, setSavingAlertConfig] = useState(false)
  const [ratios, setRatios] = useState<any>(null)
  const [aging, setAging] = useState<any[]>([])
  const [creditNotes, setCreditNotes] = useState<{ id: string; supplier_nombre: string; numero: string; numero_factura_origen: string; fecha: string; motivo: string; monto: number; moneda: string }[]>([])
  const [supplierReturns, setSupplierReturns] = useState<{ id: string; supplier_nombre: string; numero_factura_origen: string; numero_nota_credito: string; fecha: string; monto: number; moneda: string; observaciones: string }[]>([])
  const [search, setSearch] = useState("")
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [showPaymentRunForm, setShowPaymentRunForm] = useState(false)
  const [showPayModal, setShowPayModal] = useState<string | null>(null)
  const [payForm, setPayForm] = useState({ monto: "", payment_method: "transferencia", fecha_pago: new Date().toISOString().split("T")[0], referencia: "" })
  const [invoiceForm, setInvoiceForm] = useState<any>({ supplier_id: "", numero_factura: "", timbrado: "", fecha_emision: "", fecha_vencimiento: "", iva_10: "", iva_5: "", total: "", concepto: "" })
  const [paymentQueue, setPaymentQueue] = useState<any>(null)
  const [apApprovals, setApApprovals] = useState<any[]>([])
  const [showFullQueue, setShowFullQueue] = useState(false)
  const [supplierQuery, setSupplierQuery] = useState("")
  const [supplierResults, setSupplierResults] = useState<any[]>([])
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false)
  const [selectedSupplierName, setSelectedSupplierName] = useState("")
  const [budgetForm, setBudgetForm] = useState({ nombre: "", periodo: "", categoria: "", monto_presupuestado: "", area: "general", tipo: "egreso" })
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null)
  const [budgetFilterPeriodo, setBudgetFilterPeriodo] = useState("")
  const [budgetFilterArea, setBudgetFilterArea] = useState("")
  const [showVsActual, setShowVsActual] = useState(false)
  const [vsActualData, setVsActualData] = useState<any[]>([])
  const [vsActualPeriodo, setVsActualPeriodo] = useState(new Date().toISOString().slice(0, 7))
  const [runForm, setRunForm] = useState({ nombre: "", fecha_programada: "", metodo_pago: "transferencia", bank_account_id: "" })
  const [runStep, setRunStep] = useState<1 | 2>(1)
  const [payableInvoices, setPayableInvoices] = useState<any[]>([])
  const [payableLoading, setPayableLoading] = useState(false)
  const [payableFilterSupplier, setPayableFilterSupplier] = useState("")
  const [payableFilterHasta, setPayableFilterHasta] = useState("")
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set())
  const [runDetail, setRunDetail] = useState<any>(null)
  const [filterEstado, setFilterEstado] = useState("")
  const [exportingPnl, setExportingPnl] = useState(false)
  const [cheques, setCheques] = useState<any[]>([])
  const [chequesDashboard, setChequesDashboard] = useState<any>(null)
  const [chequeFilterEstado, setChequeFilterEstado] = useState("")
  const [chequeFilterFechaDesde, setChequeFilterFechaDesde] = useState("")
  const [chequeFilterFechaHasta, setChequeFilterFechaHasta] = useState("")
  const [showChequeForm, setShowChequeForm] = useState(false)
  const [chequeForm, setChequeForm] = useState({ numero: "", bank_account_id: "", banco_emisor: "", beneficiario: "", monto: "", fecha_emision: new Date().toISOString().split("T")[0], fecha_entrega: "", fecha_pago: "", diferido: false, concepto: "" })
  const [chequeHistorial, setChequeHistorial] = useState<{ chequeId: string; items: any[] } | null>(null)
  const [banks, setBanks] = useState<{ id: string; banco: string; numero_cuenta: string }[]>([])
  const toast = useToast()

  const handleExportPnl = async () => {
    setExportingPnl(true)
    try {
      await api.gerencial.exportPnlPdf()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo exportar el Estado de Resultados")
    } finally {
      setExportingPnl(false)
    }
  }

  const fetchCheques = async () => {
    try {
      const [c, d] = await Promise.all([
        api.cheques.list({ estado: chequeFilterEstado || undefined, fecha_desde: chequeFilterFechaDesde || undefined, fecha_hasta: chequeFilterFechaHasta || undefined }),
        api.cheques.dashboard(),
      ])
      setCheques(c)
      setChequesDashboard(d)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudieron cargar los cheques")
    }
  }

  const handleCreateCheque = async () => {
    if (!chequeForm.numero || !chequeForm.beneficiario || !chequeForm.monto) {
      toast.error("Faltan datos", "Número, beneficiario y monto son obligatorios")
      return
    }
    try {
      await api.cheques.create({
        ...chequeForm,
        bank_account_id: chequeForm.bank_account_id || undefined,
        monto: Number(chequeForm.monto),
        fecha_entrega: chequeForm.fecha_entrega || undefined,
        fecha_pago: chequeForm.fecha_pago || undefined,
      })
      toast.success("Cheque registrado", `N° ${chequeForm.numero} — ${formatGs(Number(chequeForm.monto))}`)
      setShowChequeForm(false)
      setChequeForm({ numero: "", bank_account_id: "", banco_emisor: "", beneficiario: "", monto: "", fecha_emision: new Date().toISOString().split("T")[0], fecha_entrega: "", fecha_pago: "", diferido: false, concepto: "" })
      fetchCheques()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo registrar el cheque")
    }
  }

  const handleChequeEstado = async (id: string, estado: string, notas?: string) => {
    try {
      await api.cheques.updateEstado(id, { estado, notas })
      toast.success("Estado actualizado", estado)
      fetchCheques()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo cambiar el estado")
    }
  }

  const openChequeHistorial = async (id: string) => {
    try {
      const items = await api.cheques.historial(id)
      setChequeHistorial({ chequeId: id, items })
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo cargar el historial")
    }
  }

  const fetchAll = async () => {
    setLoading(true)
    try {
      const p: Promise<any>[] = []
      if (tab === "dashboard") p.push(api.financial.dashboard().then(setDashboard))
      if (tab === "ap") {
        p.push(api.financial.invoices.list({ estado: (filterEstado && filterEstado !== "vencida") ? filterEstado : undefined }).then(setInvoices))
        p.push(api.financial.aging().then((d: any) => setAging(d?.por_supplier || [])))
        p.push(api.financial.apDashboard().then(d => setDashboard({ ap_dashboard: d } as any)))
        p.push(api.financial.creditNotes().then(setCreditNotes))
        p.push(api.financial.supplierReturns().then(setSupplierReturns))
        p.push(api.financial.paymentQueue().then(setPaymentQueue))
        p.push(api.financial.apApprovals.list("pendiente").then(setApApprovals))
      }
      if (tab === "pagos") p.push(api.financial.apApprovals.list("pendiente").then(setApApprovals))
      if (tab === "cheques") {
        p.push(api.cheques.list({ estado: chequeFilterEstado || undefined, fecha_desde: chequeFilterFechaDesde || undefined, fecha_hasta: chequeFilterFechaHasta || undefined }).then(setCheques))
        p.push(api.cheques.dashboard().then(setChequesDashboard))
        p.push(api.financial.banks.list().then(b => setBanks(b.map(x => ({ id: x.id, banco: x.banco || "", numero_cuenta: x.numero_cuenta || "" })))))
      }
      if (tab === "dashboard") {
        p.push(api.financial.banksDashboard().then((d: any) => {
          // d.saldo_total viene como string decimal ("71150882.00") -- convertir
          // a number antes de guardarlo, si no formatGs lo malinterpreta como
          // si ya viniera agrupado a la paraguaya y le borra el punto.
          setDashboard(prev => ({ ...prev, cash_flow: { ...prev?.cash_flow, saldo_bancario: Number(d.saldo_total) } } as any))
        }))
      }
      if (tab === "cashflow") {
        p.push(
          api.financial.cashFlow.list().then(async list => {
            if (list.length === 0) {
              await api.financial.cashFlow.generate()
              list = await api.financial.cashFlow.list()
            }
            setCashFlow(list)
          })
        )
        p.push(api.financial.banksDashboard().then((d: any) => setCashFlowSaldoBancario(Number(d.saldo_total))))
        p.push(api.financial.cashFlow.alertConfig.get().then(setAlertConfig))
      }
      if (tab === "presupuestos") p.push(api.financial.budgets.list({ periodo: budgetFilterPeriodo || undefined, area: budgetFilterArea || undefined }).then(setBudgets))
      if (tab === "pagos") p.push(api.financial.paymentRuns.list().then(setPaymentRuns))
      if (tab === "dashboard" || tab === "ap") p.push(api.financial.ratios().then(setRatios))
      await Promise.all(p)
    } catch (e: any) {
      if (e.status !== 401 && e.response?.status !== 401) {
        toast.error("Error", e.message)
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [tab, filterEstado, chequeFilterEstado, chequeFilterFechaDesde, chequeFilterFechaHasta, budgetFilterPeriodo, budgetFilterArea])

  useEffect(() => {
    if (!supplierQuery.trim() || supplierQuery === selectedSupplierName) { setSupplierResults([]); return }
    const t = setTimeout(() => {
      api.purchases.suppliers(supplierQuery).then(setSupplierResults).catch(() => setSupplierResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [supplierQuery, selectedSupplierName])

  const facturaDuplicada = invoiceForm.supplier_id && invoiceForm.numero_factura
    ? invoices.find(i => i.supplier_id === invoiceForm.supplier_id && i.numero_factura === invoiceForm.numero_factura)
    : null

  const handleCreateInvoice = async () => {
    try {
      const iva10 = Number(invoiceForm.iva_10) || 0
      const iva5 = Number(invoiceForm.iva_5) || 0
      const total = Number(invoiceForm.total) || 0
      await api.financial.invoices.create({
        ...invoiceForm,
        subtotal: total - iva10 - iva5,
        iva_10: iva10,
        iva_5: iva5,
        total,
      })
      toast.success("Factura registrada"); setShowInvoiceForm(false)
      setInvoiceForm({ supplier_id: "", numero_factura: "", timbrado: "", fecha_emision: "", fecha_vencimiento: "", iva_10: "", iva_5: "", total: "", concepto: "" })
      setSupplierQuery(""); setSelectedSupplierName("")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateBudget = async () => {
    try {
      if (editingBudgetId) {
        await api.financial.budgets.update(editingBudgetId, {
          nombre: budgetForm.nombre, monto_presupuestado: Number(budgetForm.monto_presupuestado),
          categoria: budgetForm.categoria || undefined, area: budgetForm.area,
        })
        toast.success("Presupuesto actualizado")
      } else {
        await api.financial.budgets.create({ ...budgetForm, monto_presupuestado: Number(budgetForm.monto_presupuestado) })
        toast.success("Presupuesto creado")
      }
      setShowBudgetForm(false); setEditingBudgetId(null); fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const openEditBudget = (b: any) => {
    setEditingBudgetId(b.id)
    setBudgetForm({ nombre: b.nombre, periodo: b.periodo, categoria: b.categoria || "", monto_presupuestado: String(b.monto_presupuestado), area: b.area, tipo: b.tipo })
    setShowBudgetForm(true)
  }

  const handleDeleteBudget = async (id: string) => {
    if (!confirm("¿Borrar este presupuesto? No se puede deshacer.")) return
    try { await api.financial.budgets.delete(id); toast.success("Presupuesto borrado"); fetchAll() }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const loadVsActual = async () => {
    try { setVsActualData(await api.financial.budgets.vsActual({ periodo: vsActualPeriodo })) }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const loadPayableInvoices = async () => {
    setPayableLoading(true)
    try {
      const r = await api.financial.payableInvoices({ supplier_id: payableFilterSupplier || undefined, hasta: payableFilterHasta || undefined })
      setPayableInvoices(r)
    } catch (e: any) { toast.error("Error", e.message) }
    finally { setPayableLoading(false) }
  }

  const toggleInvoiceSelected = (id: string) => {
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectedTotal = payableInvoices.filter(i => selectedInvoiceIds.has(i.id)).reduce((s, i) => s + Number(i.saldo_pendiente), 0)

  const openPaymentRunForm = () => {
    setRunStep(1); setPayableInvoices([]); setSelectedInvoiceIds(new Set())
    setPayableFilterSupplier(""); setPayableFilterHasta("")
    setRunForm({ nombre: "", fecha_programada: "", metodo_pago: "transferencia", bank_account_id: "" })
    setShowPaymentRunForm(true)
    loadPayableInvoices()
  }

  const handleCreatePaymentRun = async () => {
    try {
      // bank_account_id vacio ("") no es un UUID valido -- omitirlo en vez
      // de mandar string vacio, si no el backend lo rechaza con 422 (bug
      // preexistente en el formulario, nunca se noto porque 0 lotes de
      // pago se crearon nunca hasta ahora).
      await api.financial.paymentRuns.create({ ...runForm, bank_account_id: runForm.bank_account_id || undefined, invoice_ids: Array.from(selectedInvoiceIds) })
      toast.success("Lote creado"); setShowPaymentRunForm(false); fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const openRunDetail = async (id: string) => {
    try { setRunDetail(await api.financial.paymentRuns.get(id)) }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const handlePayInvoice = async (id: string) => {
    try {
      const r = await api.financial.invoices.pay(id, { ...payForm, monto: Number(payForm.monto) })
      if (r.pending_approval) {
        toast.success("Pago retenido para aprobación", `Supera el umbral de aprobación (${formatGs(r.monto)}) — requiere Supervisor y Gerente`)
      } else {
        toast.success("Pago registrado")
      }
      setShowPayModal(null); fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleExecuteRun = async (id: string) => {
    try {
      const r = await api.financial.paymentRuns.execute(id)
      if (r.pending_approval) {
        toast.success("Lote retenido para aprobación", `Supera el umbral de aprobación (${formatGs(r.monto)}) — requiere Supervisor y Gerente`)
      } else {
        toast.success("Lote ejecutado")
      }
      fetchAll()
      if (runDetail?.id === id) setRunDetail(null)
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDecideApApproval = async (id: string, approve: boolean) => {
    try {
      if (approve) {
        const r = await api.financial.apApprovals.approve(id)
        toast.success(r.completo ? "Pago aprobado y ejecutado" : "Aprobación registrada", r.completo ? undefined : "Falta la segunda firma (Supervisor o Gerente)")
      } else {
        await api.financial.apApprovals.reject(id)
        toast.success("Solicitud rechazada")
      }
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleGenerateCashFlow = async () => {
    try { await api.financial.cashFlow.generate(); toast.success("Proyección actualizada"); fetchAll() }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const handleSaveAlertConfig = async () => {
    if (!alertConfig) return
    setSavingAlertConfig(true)
    try {
      const saved = await api.financial.cashFlow.alertConfig.update(alertConfig)
      setAlertConfig(saved)
      toast.success("Configuración guardada", saved.activo ? "La alerta por WhatsApp está activa" : "La alerta por WhatsApp está apagada")
    } catch (e: any) {
      toast.error("Error", e.message)
    } finally {
      setSavingAlertConfig(false)
    }
  }

  // El backend serializa los Decimal como string decimal comun
  // ("192495588.49") -- formatPYG asume que un string ya viene agrupado a
  // la paraguaya (punto = separador de miles) y le borra el punto,
  // inflando el valor ~100x. Convertir a number antes evita el bug.
  const formatGs = (n?: number | string | null) => n != null ? formatPYG(Number(n)) : "-"

  const tabs: { k: Tab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "ap", l: "Ctas. Pagar", i: Receipt },
    { k: "cheques", l: "Cheques", i: FileText },
    { k: "cashflow", l: "Flujo Caja", i: TrendingUp },
    { k: "presupuestos", l: "Presupuestos", i: PiggyBank },
    { k: "pagos", l: "Lotes Pago", i: CreditCard },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cuentas por Pagar</h1><p className="text-sm text-gray-500">Facturas de proveedores, cheques, flujo de caja, presupuestos</p></div>
        <div className="flex gap-2">
          {tab === "dashboard" && <button onClick={handleExportPnl} disabled={exportingPnl} className="btn-outline flex items-center gap-2 disabled:opacity-50">{exportingPnl ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}Estado de Resultados (PDF)</button>}
          {tab === "ap" && (
            <>
              <button onClick={() => api.financial.downloadApAgingPdf().catch((e: any) => toast.error("Error", e.message))} className="btn-outline flex items-center gap-2 text-sm"><FileText className="w-4 h-4" />Aging AP (PDF)</button>
              <button onClick={() => api.financial.downloadTopSuppliersPdf().catch((e: any) => toast.error("Error", e.message))} className="btn-outline flex items-center gap-2 text-sm"><FileText className="w-4 h-4" />Top Proveedores (PDF)</button>
              <button onClick={() => setShowInvoiceForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Factura</button>
            </>
          )}
          {tab === "cheques" && <button onClick={() => setShowChequeForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Registrar Cheque</button>}
          {tab === "presupuestos" && <button onClick={() => { setEditingBudgetId(null); setBudgetForm({ nombre: "", periodo: "", categoria: "", monto_presupuestado: "", area: "general", tipo: "egreso" }); setShowBudgetForm(true) }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Presupuesto</button>}
          {tab === "pagos" && <button onClick={openPaymentRunForm} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Lote pago</button>}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit overflow-x-auto">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === t.k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>
            <t.i className="w-4 h-4" />{t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {tab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Ctas. Pagar", value: dashboard?.ap_dashboard?.total_pendiente, icon: Receipt, color: "text-red-600", isCount: false },
                  { label: "Vencido", value: dashboard?.ap_dashboard?.total_vencido, icon: AlertTriangle, color: "text-red-700", isCount: false },
                  { label: "Saldo bancario", value: dashboard?.cash_flow?.saldo_bancario, icon: Landmark, color: "text-green-600", isCount: false },
                  { label: "Proy. 7 días", value: dashboard?.cash_flow?.saldo_proyectado_7d, icon: TrendingUp, color: "text-blue-600", isCount: false },
                  { label: "Proy. 30 días", value: dashboard?.cash_flow?.saldo_proyectado_30d, icon: BarChart3, color: "text-purple-600", isCount: false },
                  { label: "Facturas venc.", value: dashboard?.ap_dashboard?.facturas_vencidas, icon: XCircle, color: "text-red-600", isCount: true },
                ].map((c, i) => (
                  <div key={i} className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-500 font-medium">{c.label}</span>
                      <c.icon className={`w-5 h-5 ${c.color}`} />
                    </div>
                    <div className={`text-2xl font-bold ${c.color}`}>
                      {c.isCount ? (c.value ?? 0) : formatGs(c.value)}
                    </div>
                  </div>
                ))}
              </div>
              {dashboard?.ap_dashboard && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="card p-5">
                    <h3 className="font-semibold mb-3">Aging Cuentas a Pagar</h3>
                    <div className="space-y-3">
                      {[
                        { label: "1-30 días", value: dashboard.ap_dashboard.aging_30, color: "bg-green-500" },
                        { label: "31-60 días", value: dashboard.ap_dashboard.aging_60, color: "bg-amber-500" },
                        { label: "61-90 días", value: dashboard.ap_dashboard.aging_90, color: "bg-orange-500" },
                        { label: "90+ días", value: dashboard.ap_dashboard.aging_90_plus, color: "bg-red-600" },
                      ].map((b, i) => {
                        const total = dashboard.ap_dashboard!.aging_30 + dashboard.ap_dashboard!.aging_60 + dashboard.ap_dashboard!.aging_90 + dashboard.ap_dashboard!.aging_90_plus
                        const pct = total > 0 ? (b.value / total) * 100 : 0
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-sm mb-1"><span>{b.label}</span><span className="font-semibold">{formatGs(b.value)}</span></div>
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2"><div className={`${b.color} h-2 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="card p-5">
                    <h3 className="font-semibold mb-3">Ratios Financieros</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm"><span>Liquidez</span><span className="font-semibold">{ratios?.liquidity_ratio?.toFixed(2) ?? "-"}</span></div>
                      <div className="flex justify-between text-sm"><span>Rotación cartera</span><span className="font-semibold">{ratios?.rotacion_cartera_dias?.toFixed(0) ?? "-"} días</span></div>
                      <div className="flex justify-between text-sm"><span>Rotación proveedores</span><span className="font-semibold">{ratios?.rotacion_proveedores_dias?.toFixed(0) ?? "-"} días</span></div>
                      <div className="flex justify-between text-sm"><span>Ciclo efectivo</span><span className="font-semibold">{ratios?.ciclo_efectivo_dias?.toFixed(0) ?? "-"} días</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "ap" && (
            <div className="space-y-6">
              {apApprovals.length > 0 && (
                <div className="space-y-2">
                  {apApprovals.map(a => (
                    <div key={a.id} className="card p-4 border-blue-300 dark:border-blue-800 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-sm">{a.entidad_tipo === "invoice" ? "Pago de factura" : "Lote de pago"} pendiente de aprobación — {formatGs(a.monto)}</div>
                          <div className="text-[11px] text-gray-400 mt-1">
                            Aprobaciones: {a.aprobado_supervisor_id ? "✓ Supervisor" : "· Supervisor"} · {a.aprobado_gerente_id ? "✓ Gerente" : "· Gerente"} (requiere ambas)
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleDecideApApproval(a.id, true)} className="btn-outline text-xs">Aprobar</button>
                        <button onClick={() => handleDecideApApproval(a.id, false)} className="btn-ghost text-xs">Rechazar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {dashboard?.ap_dashboard && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card p-4 text-center"><div className="text-sm text-gray-500">Pendiente</div><div className="text-xl font-bold text-amber-600">{formatGs(dashboard.ap_dashboard.total_pendiente)}</div></div>
                  <div className="card p-4 text-center"><div className="text-sm text-gray-500">Vencido</div><div className="text-xl font-bold text-red-600">{formatGs(dashboard.ap_dashboard.total_vencido)}</div></div>
                  <div className="card p-4 text-center"><div className="text-sm text-gray-500">Facturas</div><div className="text-xl font-bold">{dashboard.ap_dashboard.facturas_pendientes} pend. / {dashboard.ap_dashboard.facturas_vencidas} venc.</div></div>
                  <div className="card p-4 text-center"><div className="text-sm text-gray-500">Proveedores</div><div className="text-xl font-bold">{dashboard.ap_dashboard.proveedores_con_deuda}</div></div>
                </div>
              )}

              {paymentQueue && paymentQueue.cola?.length > 0 && (
                <div className="card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm">Cola de pago priorizada</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Caja disponible hoy: <span className="font-semibold">{formatGs(paymentQueue.caja_disponible)}</span> — alcanza para {paymentQueue.cantidad_cubierta_por_caja} de {paymentQueue.cola.length} facturas de la cola
                      </p>
                    </div>
                    {paymentQueue.cola.length > 8 && (
                      <button onClick={() => setShowFullQueue(!showFullQueue)} className="text-xs text-primary font-semibold shrink-0">
                        {showFullQueue ? "Ver menos" : `Ver las ${paymentQueue.cola.length}`}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {(showFullQueue ? paymentQueue.cola : paymentQueue.cola.slice(0, 8)).map((c: any) => (
                      <div key={c.id} className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${!c.cubierta_por_caja ? "opacity-50" : ""}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dias_vencido > 0 ? "bg-red-500" : "bg-gray-300"}`} />
                          <span className="font-medium truncate">{c.supplier_nombre}</span>
                          <span className="text-gray-400 shrink-0">{c.numero_factura}</span>
                          {c.dias_vencido > 0 && <span className="text-red-600 font-semibold shrink-0">{c.dias_vencido}d venc.</span>}
                        </div>
                        <span className="font-semibold shrink-0 ml-2">{formatGs(c.saldo_pendiente)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 items-center">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input-field pl-10" placeholder="Buscar factura..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="input-field w-40" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                  <option value="">Todas</option><option value="pendiente">Pendientes</option><option value="aprobada">Aprobadas</option><option value="pagada">Pagadas</option><option value="vencida">Vencidas</option><option value="parcial">Parciales</option><option value="cancelada">Canceladas</option>
                </select>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="p-3">Proveedor</th><th className="p-3">Factura</th><th className="p-3">Total</th><th className="p-3">Saldo</th><th className="p-3">Vencimiento</th><th className="p-3">Estado</th><th className="p-3"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {invoices.filter(i => {
                      if (search && !i.numero_factura?.includes(search) && !i.supplier_nombre?.includes(search)) return false
                      if (filterEstado === "vencida") {
                        return i.estado !== "pagada" && i.estado !== "cancelada" && i.fecha_vencimiento && new Date(i.fecha_vencimiento) < new Date()
                      }
                      return true
                    }).map(inv => {
                      const vencida = inv.estado !== "pagada" && inv.estado !== "cancelada" && inv.fecha_vencimiento && new Date(inv.fecha_vencimiento) < new Date()
                      return (
                        <tr key={inv.id} className="table-row">
                          <td className="p-3 font-medium">{inv.supplier_nombre || inv.supplier_id?.slice(0, 8)}</td>
                          <td className="p-3 text-sm font-mono">{inv.numero_factura || "-"}</td>
                          <td className="p-3 font-semibold">{formatGs(inv.total)}</td>
                          <td className="p-3 font-semibold">{formatGs(inv.saldo_pendiente)}</td>
                          <td className={`p-3 text-sm ${vencida ? "text-red-600 font-semibold" : ""}`}>{inv.fecha_vencimiento ? new Date(inv.fecha_vencimiento).toLocaleDateString("es-PY") : "-"}</td>
                          <td className="p-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${inv.estado === "pagada" ? "bg-green-50 dark:bg-green-900/20 text-green-600" : inv.estado === "cancelada" ? "bg-gray-100 dark:bg-gray-800 text-gray-500" : inv.estado === "parcial" ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600" : inv.estado === "aprobada" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600" : vencida ? "bg-red-50 dark:bg-red-900/20 text-red-600" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600"}`}>
                              {vencida ? "vencida" : inv.estado}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {(inv.estado === "aprobada" || inv.estado === "pendiente") && <button onClick={() => { setShowPayModal(inv.id); setPayForm({ ...payForm, monto: String(inv.saldo_pendiente || inv.total) }) }} className="p-1 hover:bg-gray-100 rounded" title="Pagar"><DollarSign className="w-4 h-4 text-green-500" /></button>}
                              {inv.supplier_id && <button onClick={() => api.financial.invoices.downloadStatementPdf(inv.supplier_id!).catch((e: any) => toast.error("Error", e.message))} className="p-1 hover:bg-gray-100 rounded" title="Estado de Cuenta (PDF)"><FileText className="w-4 h-4 text-gray-500" /></button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {invoices.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-500">Sin facturas</td></tr>}
                  </tbody>
                </table>
              </div>
              {aging.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold mb-3">Aging por proveedor</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-500"><th className="p-2">Proveedor</th><th className="p-2">Vencido</th><th className="p-2">Por vencer</th><th className="p-2">Total pendiente</th></tr></thead>
                      <tbody>{aging.map((a: any, i: number) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="p-2 font-medium">{a.razon_social || a.supplier_id}</td>
                          <td className="p-2 text-red-500 font-semibold">{formatGs(a.vencido)}</td>
                          <td className="p-2">{formatGs(a.por_vencer)}</td>
                          <td className="p-2 font-semibold">{formatGs(a.total_pendiente)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {creditNotes.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold mb-3">Notas de crédito de proveedor</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-500"><th className="p-2">Proveedor</th><th className="p-2">Número</th><th className="p-2">Fecha</th><th className="p-2">Motivo</th><th className="p-2 text-right">Monto</th></tr></thead>
                      <tbody>{creditNotes.map((n) => (
                        <tr key={n.id} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="p-2 font-medium">{n.supplier_nombre}</td>
                          <td className="p-2 font-mono text-xs">{n.numero}</td>
                          <td className="p-2 text-xs text-gray-500">{n.fecha}</td>
                          <td className="p-2 text-xs">{n.motivo || "—"}</td>
                          <td className="p-2 text-right font-semibold text-green-600">{formatGs(n.monto)} {n.moneda !== "PYG" ? n.moneda : ""}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {supplierReturns.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold mb-3">Devoluciones a proveedor</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-500"><th className="p-2">Proveedor</th><th className="p-2">N/C origen</th><th className="p-2">Fecha</th><th className="p-2">Observación</th><th className="p-2 text-right">Monto</th></tr></thead>
                      <tbody>{supplierReturns.map((r) => (
                        <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="p-2 font-medium">{r.supplier_nombre}</td>
                          <td className="p-2 font-mono text-xs">{r.numero_nota_credito || r.numero_factura_origen || "—"}</td>
                          <td className="p-2 text-xs text-gray-500">{r.fecha}</td>
                          <td className="p-2 text-xs">{r.observaciones || "—"}</td>
                          <td className="p-2 text-right font-semibold text-green-600">{formatGs(r.monto)} {r.moneda !== "PYG" ? r.moneda : ""}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "cheques" && (
            <div className="space-y-6">
              {chequesDashboard && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="card p-4"><div className="text-xs text-gray-500">Cartera Total</div><div className="text-lg font-bold">{formatGs(chequesDashboard.total_cartera)}</div><div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_cartera} cheques</div></div>
                  <div className={`card p-4 ${chequesDashboard.cantidad_vencidos > 0 ? "border-red-300 dark:border-red-800" : ""}`}><div className="text-xs text-gray-500">Vencidos sin cobrar</div><div className="text-lg font-bold text-red-600">{formatGs(chequesDashboard.vencidos_sin_cobrar)}</div><div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_vencidos} cheques</div></div>
                  <div className={`card p-4 ${chequesDashboard.cantidad_vence_hoy > 0 ? "border-amber-300 dark:border-amber-800" : ""}`}><div className="text-xs text-gray-500">Vencen hoy</div><div className="text-lg font-bold text-amber-600">{formatGs(chequesDashboard.vence_hoy)}</div><div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_vence_hoy} cheques</div></div>
                  <div className="card p-4"><div className="text-xs text-gray-500">Vencen en 7 días</div><div className="text-lg font-bold text-amber-500">{formatGs(chequesDashboard.por_vencer_7d)}</div><div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_por_vencer_7d} cheques</div></div>
                  <div className="card p-4"><div className="text-xs text-gray-500">Vencen en 30 días</div><div className="text-lg font-bold">{formatGs(chequesDashboard.por_vencer_30d)}</div><div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_por_vencer_30d} cheques</div></div>
                  <div className="card p-4"><div className="text-xs text-gray-500">Rechazados</div><div className="text-lg font-bold text-red-700">{formatGs(chequesDashboard.rechazados_monto)}</div><div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_rechazados} cheques</div></div>
                </div>
              )}

              <div className="flex gap-3 items-center flex-wrap">
                <select className="input-field w-48" value={chequeFilterEstado} onChange={e => setChequeFilterEstado(e.target.value)}>
                  <option value="">Todos los estados</option>
                  <option value="por_cobrar">Por cobrar (pendiente + entregado)</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="entregado">Entregado</option>
                  <option value="cobrado">Cobrado</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="anulado">Anulado</option>
                </select>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 font-medium">Desde</label>
                  <input className="input-field w-fit" type="date" value={chequeFilterFechaDesde} onChange={e => setChequeFilterFechaDesde(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 font-medium">Hasta</label>
                  <input className="input-field w-fit" type="date" value={chequeFilterFechaHasta} onChange={e => setChequeFilterFechaHasta(e.target.value)} />
                </div>
                {(chequeFilterFechaDesde || chequeFilterFechaHasta) && (
                  <button onClick={() => { setChequeFilterFechaDesde(""); setChequeFilterFechaHasta("") }} className="btn-ghost text-xs">Limpiar fechas</button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => api.cheques.downloadExcel({ estado: chequeFilterEstado || undefined, fecha_desde: chequeFilterFechaDesde || undefined, fecha_hasta: chequeFilterFechaHasta || undefined }).catch((e: any) => toast.error("Error", e.message))} className="btn-outline text-xs flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Excel</button>
                  <button onClick={() => api.cheques.downloadPdf({ estado: chequeFilterEstado || undefined, fecha_desde: chequeFilterFechaDesde || undefined, fecha_hasta: chequeFilterFechaHasta || undefined }).catch((e: any) => toast.error("Error", e.message))} className="btn-outline text-xs flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> PDF</button>
                </div>
              </div>

              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="p-3">N° Cheque</th><th className="p-3">Banco</th><th className="p-3">Beneficiario</th><th className="p-3">Monto</th><th className="p-3">Emisión</th><th className="p-3">Entrega</th><th className="p-3">Vencimiento</th><th className="p-3">Estado</th><th className="p-3"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {cheques.map((c: any) => {
                      const vencido = (c.estado === "pendiente" || c.estado === "entregado") && c.dias_para_vencer !== null && c.dias_para_vencer < 0
                      return (
                        <tr key={c.id} className="table-row">
                          <td className="p-3 font-mono text-xs">
                            {c.numero}
                            {c.numero_confiable === false && (
                              <span title="Migrado desde el sistema histórico -- el número no es el número real del cheque físico" className="ml-1.5 text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">histórico</span>
                            )}
                          </td>
                          <td className="p-3 text-sm">{c.banco_emisor || "—"}</td>
                          <td className="p-3 font-medium">{c.supplier_nombre || c.beneficiario}</td>
                          <td className="p-3 font-semibold">{formatGs(c.monto)}</td>
                          <td className="p-3 text-xs text-gray-500">{c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString("es-PY") : "-"}</td>
                          <td className="p-3 text-xs text-gray-500">{c.fecha_entrega ? new Date(c.fecha_entrega).toLocaleDateString("es-PY") : "—"}</td>
                          <td className={`p-3 text-xs ${vencido ? "text-red-600 font-semibold" : ""}`}>
                            {c.fecha_pago ? new Date(c.fecha_pago).toLocaleDateString("es-PY") : "-"}
                            {vencido && <span className="ml-1">({Math.abs(c.dias_para_vencer)}d vencido)</span>}
                          </td>
                          <td className="p-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                              c.estado === "cobrado" ? "bg-green-50 dark:bg-green-900/20 text-green-600" :
                              c.estado === "rechazado" ? "bg-red-50 dark:bg-red-900/20 text-red-600" :
                              c.estado === "anulado" ? "bg-gray-100 dark:bg-gray-800 text-gray-500" :
                              c.estado === "entregado" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600" :
                              vencido ? "bg-red-50 dark:bg-red-900/20 text-red-600" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600"
                            }`}>
                              {c.estado}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {(c.estado === "pendiente" || c.estado === "entregado") && (
                                <>
                                  <button onClick={() => handleChequeEstado(c.id, "cobrado")} className="p-1 hover:bg-gray-100 rounded" title="Marcar cobrado"><CheckCircle className="w-4 h-4 text-green-500" /></button>
                                  <button onClick={() => handleChequeEstado(c.id, "rechazado", "Rechazado por el banco")} className="p-1 hover:bg-gray-100 rounded" title="Marcar rechazado"><XCircle className="w-4 h-4 text-red-500" /></button>
                                  <button onClick={() => handleChequeEstado(c.id, "anulado")} className="p-1 hover:bg-gray-100 rounded" title="Anular"><Ban className="w-4 h-4 text-gray-400" /></button>
                                </>
                              )}
                              <button onClick={() => openChequeHistorial(c.id)} className="p-1 hover:bg-gray-100 rounded" title="Historial"><Clock className="w-4 h-4 text-gray-400" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {cheques.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-gray-500">Sin cheques registrados</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "cashflow" && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button onClick={handleGenerateCashFlow} className="btn-outline flex items-center gap-2 text-sm"><BarChart3 className="w-4 h-4" />Actualizar proyección</button>
              </div>

              {alertConfig && (
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Alerta de saldo negativo por WhatsApp</h3>
                      <p className="text-xs text-gray-400">Si la proyección da negativa en el horizonte configurado, se avisa una vez por día al teléfono indicado.</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={alertConfig.activo} onChange={(e) => setAlertConfig({ ...alertConfig, activo: e.target.checked })} />
                      <span className="text-sm font-medium">{alertConfig.activo ? "Activa" : "Apagada"}</span>
                    </label>
                  </div>
                  {alertConfig.activo && (
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-xs text-gray-400 font-medium">Horizonte (días)</label>
                        <input type="number" className="input-field w-24" value={alertConfig.dias_horizonte} onChange={(e) => setAlertConfig({ ...alertConfig, dias_horizonte: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 font-medium">Teléfono (opcional, si no usa el de la empresa)</label>
                        <input type="text" className="input-field w-56" placeholder="+595..." value={alertConfig.telefono || ""} onChange={(e) => setAlertConfig({ ...alertConfig, telefono: e.target.value || null })} />
                      </div>
                    </div>
                  )}
                  <button onClick={handleSaveAlertConfig} disabled={savingAlertConfig} className="btn-secondary text-sm disabled:opacity-50">
                    {savingAlertConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Guardar
                  </button>
                </div>
              )}

              {cashFlow.length > 1 && (() => {
                const saldos = cashFlow.map(cf => Number(cf.saldo_final_proyectado))
                if (cashFlowSaldoBancario != null) saldos.push(cashFlowSaldoBancario)
                const dataMin = Math.min(...saldos)
                const dataMax = Math.max(...saldos)
                const pad = Math.max((dataMax - dataMin) * 0.1, 1)
                const yDomain: [number, number] = [Math.floor(dataMin - pad), Math.ceil(dataMax + pad)]
                return (
                  <div className="card p-6 bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h3 className="font-semibold text-gray-500 text-xs uppercase tracking-wide">Proyección de Flujo de Caja (90 días)</h3>
                        {cashFlowSaldoBancario != null && <div className="text-3xl font-bold mt-1 tabular-nums">{formatGs(cashFlowSaldoBancario)}<span className="text-sm font-normal text-gray-500 ml-2">saldo bancario actual</span></div>}
                      </div>
                    </div>
                    <div className="h-64 w-full min-w-0 mt-4 overflow-hidden">
                      <ResponsiveContainer width="100%" height="100%" debounce={50}>
                        <AreaChart data={cashFlow} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="cashFlowFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
                          <XAxis
                            dataKey="fecha" tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-400"
                            tickFormatter={(v: string) => new Date(v).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit" })}
                            interval="preserveStartEnd" minTickGap={40} axisLine={false} tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-400" width={52}
                            tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`} axisLine={false} tickLine={false}
                            domain={yDomain}
                          />
                          <Tooltip
                            formatter={(v: number) => [formatGs(v), "Saldo proyectado"]}
                            labelFormatter={(v: string) => new Date(v).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                            contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
                          />
                          {cashFlowSaldoBancario != null && <ReferenceLine y={cashFlowSaldoBancario} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5} />}
                          <Area type="monotone" dataKey="saldo_final_proyectado" stroke="#4f46e5" strokeWidth={2.5} fill="url(#cashFlowFill)" dot={false} activeDot={{ r: 4 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              })()}

              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="p-3">Fecha</th><th className="p-3">Saldo inicial</th><th className="p-3">Ingresos est.</th><th className="p-3">Egresos est.</th><th className="p-3">Saldo proyectado</th><th className="p-3">Real</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {cashFlow.map(cf => (
                      <tr key={cf.id} className="table-row">
                        <td className="p-3 text-sm">{cf.fecha ? new Date(cf.fecha).toLocaleDateString("es-PY") : "-"}</td>
                        <td className="p-3">{formatGs(cf.saldo_inicial)}</td>
                        <td className="p-3 text-green-600">{formatGs(cf.ingresos_estimados)}</td>
                        <td className="p-3 text-red-600">{formatGs(cf.egresos_estimados)}</td>
                        <td className="p-3 font-semibold">{formatGs(cf.saldo_final_proyectado)}</td>
                        <td className="p-3">{cf.saldo_final_real != null ? formatGs(cf.saldo_final_real) : "-"}</td>
                      </tr>
                    ))}
                    {cashFlow.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Sin proyecciones. Generá una.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "presupuestos" && (
            <div className="space-y-4">
              <div className="flex gap-3 items-center">
                <input className="input-field w-36" placeholder="Periodo (YYYY-MM)" value={budgetFilterPeriodo} onChange={e => setBudgetFilterPeriodo(e.target.value)} />
                <select className="input-field w-40" value={budgetFilterArea} onChange={e => setBudgetFilterArea(e.target.value)}>
                  <option value="">Todas las áreas</option>
                  <option value="general">General</option><option value="ventas">Ventas</option><option value="marketing">Marketing</option><option value="operaciones">Operaciones</option><option value="rrhh">RRHH</option>
                </select>
                <button onClick={() => { setShowVsActual(!showVsActual); if (!showVsActual) loadVsActual() }} className="btn-outline text-sm ml-auto">
                  {showVsActual ? "Ver lista" : "Presupuesto vs. Real"}
                </button>
              </div>

              {showVsActual ? (
                <div className="space-y-4">
                  <div className="flex gap-3 items-center">
                    <label className="label-field mb-0">Periodo</label>
                    <input className="input-field w-36" value={vsActualPeriodo} onChange={e => setVsActualPeriodo(e.target.value)} />
                    <button onClick={loadVsActual} className="btn-outline text-sm">Actualizar</button>
                  </div>
                  <div className="card p-0 overflow-hidden">
                    <table className="w-full">
                      <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="p-3">Nombre</th><th className="p-3">Área</th><th className="p-3">Presupuestado</th><th className="p-3">Real</th><th className="p-3">Disponible</th><th className="p-3">% Ejecutado</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {vsActualData.map((v: any) => (
                          <tr key={v.budget_id} className="table-row">
                            <td className="p-3 font-medium">{v.nombre}</td>
                            <td className="p-3 capitalize text-sm">{v.area}</td>
                            <td className="p-3">{formatGs(v.monto_presupuestado)}</td>
                            <td className={`p-3 font-semibold ${Number(v.monto_ejecutado) > Number(v.monto_presupuestado) ? "text-red-600" : ""}`}>{formatGs(v.monto_ejecutado)}</td>
                            <td className="p-3">{formatGs(v.monto_disponible)}</td>
                            <td className="p-3">{Number(v.porcentaje_ejecutado).toFixed(0)}%</td>
                          </tr>
                        ))}
                        {vsActualData.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Sin presupuestos para este período</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="card p-0 overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="p-3">Nombre</th><th className="p-3">Periodo</th><th className="p-3">Área</th><th className="p-3">Presupuestado</th><th className="p-3">Ejecutado</th><th className="p-3">Disponible</th><th className="p-3">% Uso</th><th className="p-3"></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {budgets.map(b => {
                        const pct = b.monto_presupuestado && b.monto_presupuestado > 0 ? ((b.monto_ejecutado ?? 0) / b.monto_presupuestado) * 100 : 0
                        return (
                          <tr key={b.id} className="table-row">
                            <td className="p-3 font-medium">{b.nombre}</td>
                            <td className="p-3 text-sm">{b.periodo}</td>
                            <td className="p-3 capitalize text-sm">{b.area}</td>
                            <td className="p-3">{formatGs(b.monto_presupuestado)}</td>
                            <td className="p-3">{formatGs(b.monto_ejecutado)}</td>
                            <td className="p-3 font-semibold">{formatGs(b.monto_disponible)}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-2"><div className={`h-2 rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                                <span className="text-xs">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                <button onClick={() => openEditBudget(b)} className="text-xs text-primary font-semibold hover:underline">Editar</button>
                                <button onClick={() => handleDeleteBudget(b.id)} className="text-xs text-red-500 hover:underline ml-2">Borrar</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {budgets.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-500">Sin presupuestos</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "pagos" && (
            <div>
              {apApprovals.length > 0 && (
                <div className="space-y-2 mb-6">
                  {apApprovals.map(a => (
                    <div key={a.id} className="card p-4 border-blue-300 dark:border-blue-800 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-sm">{a.entidad_tipo === "invoice" ? "Pago de factura" : "Lote de pago"} pendiente de aprobación — {formatGs(a.monto)}</div>
                          <div className="text-[11px] text-gray-400 mt-1">
                            Aprobaciones: {a.aprobado_supervisor_id ? "✓ Supervisor" : "· Supervisor"} · {a.aprobado_gerente_id ? "✓ Gerente" : "· Gerente"} (requiere ambas)
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleDecideApApproval(a.id, true)} className="btn-outline text-xs">Aprobar</button>
                        <button onClick={() => handleDecideApApproval(a.id, false)} className="btn-ghost text-xs">Rechazar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {paymentRuns.map(r => (
                  <div key={r.id} className="card p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openRunDetail(r.id)}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{r.nombre}</h3>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.estado === "ejecutado" ? "bg-green-50 text-green-600" : r.estado === "aprobado" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>{r.estado}</span>
                    </div>
                    <div className="text-sm text-gray-500">{r.fecha_programada ? new Date(r.fecha_programada).toLocaleDateString("es-PY") : "-"}</div>
                    <div className="text-lg font-bold mt-2">{formatGs(r.total_monto)}</div>
                    <div className="text-xs text-gray-400 capitalize">{r.metodo_pago}</div>
                    {r.estado === "borrador" && <button onClick={e => { e.stopPropagation(); handleExecuteRun(r.id) }} className="btn-primary text-sm w-full mt-3">Ejecutar</button>}
                  </div>
                ))}
                {paymentRuns.length === 0 && <div className="col-span-3 text-center py-12 text-gray-500">Sin lotes de pago</div>}
              </div>
            </div>
          )}
        </>
      )}

      {/* Invoice form modal */}
      {showInvoiceForm && (
        <div className="modal-overlay" onClick={() => setShowInvoiceForm(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Registrar factura de proveedor</h3></div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="relative">
                <label className="label-field">Proveedor</label>
                <input
                  className="input-field" placeholder="Buscar por nombre o RUC..."
                  value={supplierQuery}
                  onChange={e => { setSupplierQuery(e.target.value); setSupplierDropdownOpen(true); if (invoiceForm.supplier_id) setInvoiceForm({ ...invoiceForm, supplier_id: "" }) }}
                  onFocus={() => setSupplierDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setSupplierDropdownOpen(false), 150)}
                />
                {supplierDropdownOpen && supplierResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full card p-1 max-h-56 overflow-y-auto shadow-lg">
                    {supplierResults.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setInvoiceForm({ ...invoiceForm, supplier_id: s.id }); setSupplierQuery(s.razon_social); setSelectedSupplierName(s.razon_social); setSupplierDropdownOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-slate-700">
                        <div className="font-medium">{s.razon_social}</div>
                        {s.ruc && <div className="text-xs text-gray-500">RUC: {s.ruc}</div>}
                      </button>
                    ))}
                  </div>
                )}
                {!invoiceForm.supplier_id && supplierQuery && !supplierDropdownOpen && (
                  <p className="text-xs text-amber-600 mt-1">Elegí un proveedor de la lista</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">N° factura</label>
                  <input className="input-field" value={invoiceForm.numero_factura} onChange={e => setInvoiceForm({ ...invoiceForm, numero_factura: e.target.value })} />
                  {facturaDuplicada && <p className="text-xs text-red-600 mt-1">Ya existe una factura {invoiceForm.numero_factura} de este proveedor ({facturaDuplicada.estado})</p>}
                </div>
                <div><label className="label-field">Timbrado</label><input className="input-field" value={invoiceForm.timbrado} onChange={e => setInvoiceForm({ ...invoiceForm, timbrado: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Fecha emisión</label><input className="input-field" type="date" value={invoiceForm.fecha_emision} onChange={e => setInvoiceForm({ ...invoiceForm, fecha_emision: e.target.value })} /></div>
                <div><label className="label-field">Fecha vencimiento</label><input className="input-field" type="date" value={invoiceForm.fecha_vencimiento} onChange={e => setInvoiceForm({ ...invoiceForm, fecha_vencimiento: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="label-field">IVA 10%</label><input className="input-field" type="number" value={invoiceForm.iva_10} onChange={e => setInvoiceForm({ ...invoiceForm, iva_10: e.target.value })} /></div>
                <div><label className="label-field">IVA 5%</label><input className="input-field" type="number" value={invoiceForm.iva_5} onChange={e => setInvoiceForm({ ...invoiceForm, iva_5: e.target.value })} /></div>
                <div><label className="label-field">Total</label><input className="input-field" type="number" value={invoiceForm.total} onChange={e => setInvoiceForm({ ...invoiceForm, total: e.target.value })} /></div>
              </div>
              <p className="text-xs text-gray-400">
                Cargá el IVA 10%/5% impreso en la factura (aparece como línea separada en toda factura legal paraguaya) — sin esto, el módulo de Contabilidad Integrada no puede calcular el Crédito Fiscal.
                {(Number(invoiceForm.iva_10) || Number(invoiceForm.iva_5)) > 0 && Number(invoiceForm.total) > 0 && (
                  <> Subtotal gravado: {formatPYG((Number(invoiceForm.total) || 0) - (Number(invoiceForm.iva_10) || 0) - (Number(invoiceForm.iva_5) || 0))}</>
                )}
              </p>
              <div><label className="label-field">Concepto</label><textarea className="input-field" value={invoiceForm.concepto} onChange={e => setInvoiceForm({ ...invoiceForm, concepto: e.target.value })} rows={2} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowInvoiceForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateInvoice} disabled={!invoiceForm.supplier_id || !invoiceForm.total} className="btn-primary disabled:opacity-50">Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Cheque register modal */}
      {showChequeForm && (
        <div className="modal-overlay" onClick={() => setShowChequeForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Registrar Cheque</h3></div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div><label className="label-field">N° de Cheque *</label><input className="input-field" value={chequeForm.numero} onChange={e => setChequeForm({ ...chequeForm, numero: e.target.value })} /></div>
              <div><label className="label-field">Cuenta bancaria emisora</label>
                <select className="input-field" value={chequeForm.bank_account_id} onChange={e => {
                  const acct = banks.find(b => b.id === e.target.value)
                  setChequeForm({ ...chequeForm, bank_account_id: e.target.value, banco_emisor: acct?.banco || "" })
                }}>
                  <option value="">Sin cuenta vinculada (solo texto libre)</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.banco} — {b.numero_cuenta}</option>)}
                </select>
                {!chequeForm.bank_account_id && (
                  <input className="input-field mt-2" placeholder="Nombre del banco (si no está en la lista de cuentas)" value={chequeForm.banco_emisor} onChange={e => setChequeForm({ ...chequeForm, banco_emisor: e.target.value })} />
                )}
              </div>
              <div><label className="label-field">Beneficiario / Proveedor *</label><input className="input-field" value={chequeForm.beneficiario} onChange={e => setChequeForm({ ...chequeForm, beneficiario: e.target.value })} /></div>
              <div><label className="label-field">Monto *</label><input className="input-field" type="number" value={chequeForm.monto} onChange={e => setChequeForm({ ...chequeForm, monto: e.target.value })} /></div>
              <div><label className="label-field">Fecha de Emisión</label><input className="input-field" type="date" value={chequeForm.fecha_emision} onChange={e => setChequeForm({ ...chequeForm, fecha_emision: e.target.value })} /></div>
              <div><label className="label-field">Fecha de Entrega</label><input className="input-field" type="date" value={chequeForm.fecha_entrega} onChange={e => setChequeForm({ ...chequeForm, fecha_entrega: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chequeForm.diferido} onChange={e => setChequeForm({ ...chequeForm, diferido: e.target.checked })} /> Cheque diferido</label>
              <div><label className="label-field">Fecha de Pago / Vencimiento</label><input className="input-field" type="date" value={chequeForm.fecha_pago} onChange={e => setChequeForm({ ...chequeForm, fecha_pago: e.target.value })} /></div>
              <div><label className="label-field">Concepto</label><input className="input-field" value={chequeForm.concepto} onChange={e => setChequeForm({ ...chequeForm, concepto: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowChequeForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateCheque} className="btn-primary">Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Cheque historial modal */}
      {chequeHistorial && (
        <div className="modal-overlay" onClick={() => setChequeHistorial(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Historial del Cheque</h3></div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {chequeHistorial.items.length === 0 ? <p className="text-sm text-gray-500">Sin movimientos</p> : chequeHistorial.items.map((h: any) => (
                <div key={h.id} className="border-l-2 border-primary pl-3 py-1">
                  <div className="text-sm font-semibold">{h.estado_anterior ? `${h.estado_anterior} → ${h.estado_nuevo}` : h.estado_nuevo}</div>
                  <div className="text-xs text-gray-500">{new Date(h.created_at).toLocaleString("es-PY")} · {h.user_nombre || "Sistema"}</div>
                  {h.notas && <div className="text-xs text-gray-600 mt-1">{h.notas}</div>}
                </div>
              ))}
            </div>
            <div className="p-6 border-t flex justify-end">
              <button onClick={() => setChequeHistorial(null)} className="btn-ghost">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Pay invoice modal */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Registrar pago</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Monto</label><input className="input-field" type="number" value={payForm.monto} onChange={e => setPayForm({ ...payForm, monto: e.target.value })} /></div>
              <div><label className="label-field">Método</label><select className="input-field" value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                <option value="transferencia">Transferencia</option><option value="cheque">Cheque</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option>
              </select></div>
              <div><label className="label-field">Fecha</label><input className="input-field" type="date" value={payForm.fecha_pago} onChange={e => setPayForm({ ...payForm, fecha_pago: e.target.value })} /></div>
              <div><label className="label-field">Referencia</label><input className="input-field" value={payForm.referencia} onChange={e => setPayForm({ ...payForm, referencia: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPayModal(null)} className="btn-ghost">Cancelar</button>
              <button onClick={() => handlePayInvoice(showPayModal)} disabled={!payForm.monto} className="btn-primary disabled:opacity-50">Pagar</button>
            </div>
          </div>
        </div>
      )}

      {/* Budget form modal */}
      {showBudgetForm && (
        <div className="modal-overlay" onClick={() => setShowBudgetForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">{editingBudgetId ? "Editar presupuesto" : "Nuevo presupuesto"}</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Nombre</label><input className="input-field" value={budgetForm.nombre} onChange={e => setBudgetForm({ ...budgetForm, nombre: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Periodo</label><input className="input-field disabled:opacity-50" disabled={!!editingBudgetId} value={budgetForm.periodo} placeholder="YYYY-MM" onChange={e => setBudgetForm({ ...budgetForm, periodo: e.target.value })} /></div>
                <div><label className="label-field">Área</label><select className="input-field" value={budgetForm.area} onChange={e => setBudgetForm({ ...budgetForm, area: e.target.value })}>
                  <option value="general">General</option><option value="carniceria">Carnicería</option><option value="panaderia">Panadería</option><option value="verduleria">Verdulería</option><option value="lacteos">Lácteos</option><option value="limpieza">Limpieza</option><option value="administracion">Administración</option>
                </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Monto presupuestado</label><input className="input-field" type="number" value={budgetForm.monto_presupuestado} onChange={e => setBudgetForm({ ...budgetForm, monto_presupuestado: e.target.value })} /></div>
                <div><label className="label-field">Tipo</label><select className="input-field disabled:opacity-50" disabled={!!editingBudgetId} value={budgetForm.tipo} onChange={e => setBudgetForm({ ...budgetForm, tipo: e.target.value })}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></div>
              </div>
              <div><label className="label-field">Categoría</label><input className="input-field" value={budgetForm.categoria} onChange={e => setBudgetForm({ ...budgetForm, categoria: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => { setShowBudgetForm(false); setEditingBudgetId(null) }} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateBudget} disabled={!budgetForm.nombre || !budgetForm.periodo} className="btn-primary disabled:opacity-50">{editingBudgetId ? "Guardar cambios" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment run form modal */}
      {showPaymentRunForm && (
        <div className="modal-overlay" onClick={() => setShowPaymentRunForm(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">Nuevo lote de pago</h3>
              <p className="text-xs text-gray-500 mt-1">Paso {runStep} de 2 — {runStep === 1 ? "elegí qué facturas incluir" : "confirmá los datos del lote"}</p>
            </div>

            {runStep === 1 && (
              <>
                <div className="p-6 space-y-4">
                  <div className="flex gap-3">
                    <select className="input-field" value={payableFilterSupplier} onChange={e => setPayableFilterSupplier(e.target.value)}>
                      <option value="">Todos los proveedores</option>
                      {Array.from(new Map(payableInvoices.map(i => [i.supplier_id, i.supplier_nombre])).entries()).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                    <input className="input-field" type="date" value={payableFilterHasta} onChange={e => setPayableFilterHasta(e.target.value)} placeholder="Vencidas hasta" />
                    <button onClick={loadPayableInvoices} className="btn-outline shrink-0">Filtrar</button>
                  </div>
                  <div className="card p-0 overflow-hidden max-h-[45vh] overflow-y-auto">
                    {payableLoading ? (
                      <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : payableInvoices.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-10">Sin facturas pendientes que coincidan con el filtro.</p>
                    ) : (
                      <table className="w-full">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800">
                          <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                            <th className="p-2 w-8"></th><th className="p-2">Proveedor</th><th className="p-2">Factura</th><th className="p-2">Vencimiento</th><th className="p-2 text-right">Saldo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {payableInvoices.map(inv => (
                            <tr key={inv.id} className="table-row cursor-pointer" onClick={() => toggleInvoiceSelected(inv.id)}>
                              <td className="p-2"><input type="checkbox" checked={selectedInvoiceIds.has(inv.id)} onChange={() => toggleInvoiceSelected(inv.id)} onClick={e => e.stopPropagation()} /></td>
                              <td className="p-2 text-sm">{inv.supplier_nombre}</td>
                              <td className="p-2 text-sm font-mono">{inv.numero_factura}</td>
                              <td className={`p-2 text-sm ${inv.dias_vencido > 0 ? "text-red-600 font-semibold" : ""}`}>{new Date(inv.fecha_vencimiento).toLocaleDateString("es-PY")}{inv.dias_vencido > 0 && ` (${inv.dias_vencido}d)`}</td>
                              <td className="p-2 text-sm font-semibold text-right">{formatGs(inv.saldo_pendiente)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">{selectedInvoiceIds.size} facturas seleccionadas</span>
                    <span className="font-bold">{formatGs(selectedTotal)}</span>
                  </div>
                </div>
                <div className="p-6 border-t flex justify-end gap-3">
                  <button onClick={() => setShowPaymentRunForm(false)} className="btn-ghost">Cancelar</button>
                  <button onClick={() => setRunStep(2)} disabled={selectedInvoiceIds.size === 0} className="btn-primary disabled:opacity-50">Siguiente ({selectedInvoiceIds.size})</button>
                </div>
              </>
            )}

            {runStep === 2 && (
              <>
                <div className="p-6 space-y-4">
                  <div className="card p-4 bg-gray-50 dark:bg-slate-800">
                    <div className="text-sm text-gray-500">{selectedInvoiceIds.size} facturas — total del lote</div>
                    <div className="text-xl font-bold">{formatGs(selectedTotal)}</div>
                  </div>
                  <div><label className="label-field">Nombre del lote</label><input className="input-field" value={runForm.nombre} onChange={e => setRunForm({ ...runForm, nombre: e.target.value })} /></div>
                  <div><label className="label-field">Fecha programada</label><input className="input-field" type="date" value={runForm.fecha_programada} onChange={e => setRunForm({ ...runForm, fecha_programada: e.target.value })} /></div>
                  <div><label className="label-field">Método de pago</label><select className="input-field" value={runForm.metodo_pago} onChange={e => setRunForm({ ...runForm, metodo_pago: e.target.value })}>
                    <option value="transferencia">Transferencia</option><option value="cheque">Cheque</option><option value="efectivo">Efectivo</option>
                  </select></div>
                </div>
                <div className="p-6 border-t flex justify-between">
                  <button onClick={() => setRunStep(1)} className="btn-ghost">Atrás</button>
                  <div className="flex gap-3">
                    <button onClick={() => setShowPaymentRunForm(false)} className="btn-ghost">Cancelar</button>
                    <button onClick={handleCreatePaymentRun} disabled={!runForm.nombre || !runForm.fecha_programada} className="btn-primary disabled:opacity-50">Crear lote</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Payment run detail modal */}
      {runDetail && (
        <div className="modal-overlay" onClick={() => setRunDetail(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{runDetail.nombre}</h3>
                <p className="text-xs text-gray-500 mt-1">{runDetail.fecha_programada ? new Date(runDetail.fecha_programada).toLocaleDateString("es-PY") : "-"} · {runDetail.metodo_pago}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${runDetail.estado === "ejecutado" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>{runDetail.estado}</span>
            </div>
            <div className="p-6 space-y-3 max-h-[55vh] overflow-y-auto">
              <div className="flex justify-between text-sm font-semibold"><span>Total del lote</span><span>{formatGs(runDetail.total_monto)}</span></div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {(runDetail.items || []).map((it: any) => (
                  <div key={it.id} className="flex justify-between items-center py-2 text-sm">
                    <div>
                      <div className="font-medium">{it.supplier_nombre}</div>
                      <div className="text-xs text-gray-400 font-mono">{it.numero_factura}</div>
                    </div>
                    <span className="font-semibold">{formatGs(it.monto_programado)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setRunDetail(null)} className="btn-ghost">Cerrar</button>
              {runDetail.estado === "borrador" && <button onClick={() => handleExecuteRun(runDetail.id)} className="btn-primary">Ejecutar lote</button>}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
