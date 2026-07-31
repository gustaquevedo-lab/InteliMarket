import { useState, useEffect } from "react"
import { api, type SupplierInvoice, type BankAccount, type Budget, type PaymentRun, type CashFlowProjection, type FinancialDashboard } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Search, Plus, Loader2, DollarSign, Building2, Landmark, PiggyBank, TrendingUp, BarChart3, CheckCircle, XCircle, AlertTriangle, Wallet, Receipt, FileText, Calendar, Clock, ArrowUpRight, ArrowDownRight, Eye, Trash2, CreditCard, Ban, Upload } from "lucide-react"

type Tab = "dashboard" | "ap" | "bancos" | "cashflow" | "presupuestos" | "pagos"

export default function FinancialPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null)
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [paymentRuns, setPaymentRuns] = useState<PaymentRun[]>([])
  const [cashFlow, setCashFlow] = useState<CashFlowProjection[]>([])
  const [ratios, setRatios] = useState<any>(null)
  const [aging, setAging] = useState<any[]>([])
  const [creditNotes, setCreditNotes] = useState<{ id: string; supplier_nombre: string; numero: string; numero_factura_origen: string; fecha: string; motivo: string; monto: number; moneda: string }[]>([])
  const [supplierReturns, setSupplierReturns] = useState<{ id: string; supplier_nombre: string; numero_factura_origen: string; numero_nota_credito: string; fecha: string; monto: number; moneda: string; observaciones: string }[]>([])
  const [search, setSearch] = useState("")
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [showBankForm, setShowBankForm] = useState(false)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [showPaymentRunForm, setShowPaymentRunForm] = useState(false)
  const [showPayModal, setShowPayModal] = useState<string | null>(null)
  const [payForm, setPayForm] = useState({ monto: "", payment_method: "transferencia", fecha_pago: new Date().toISOString().split("T")[0], referencia: "" })
  const [invoiceForm, setInvoiceForm] = useState<any>({ supplier_id: "", numero_factura: "", timbrado: "", fecha_emision: "", fecha_vencimiento: "", subtotal: "", iva_10: "", total: "", concepto: "" })
  const [bankForm, setBankForm] = useState({ banco: "", tipo: "corriente", numero_cuenta: "", moneda: "PYG", saldo_inicial: "", titular: "" })
  const [budgetForm, setBudgetForm] = useState({ nombre: "", periodo: "", categoria: "", monto_presupuestado: "", area: "general", tipo: "egreso" })
  const [runForm, setRunForm] = useState({ nombre: "", fecha_programada: "", metodo_pago: "transferencia", bank_account_id: "" })
  const [filterEstado, setFilterEstado] = useState("")
  const [selectedBank, setSelectedBank] = useState<string>("")
  const [bankTxns, setBankTxns] = useState<any[]>([])
  const [showImportBank, setShowImportBank] = useState(false)
  const [importData, setImportData] = useState("")
  const toast = useToast()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const p: Promise<any>[] = []
      if (tab === "dashboard") p.push(api.financial.dashboard().then(setDashboard))
      if (tab === "ap") {
        p.push(api.financial.invoices.list({ estado: filterEstado || undefined }).then(setInvoices))
        p.push(api.financial.aging().then((d: any) => setAging(d?.por_supplier || [])))
        p.push(api.financial.apDashboard().then(d => setDashboard({ ap_dashboard: d } as any)))
        p.push(api.financial.creditNotes().then(setCreditNotes))
        p.push(api.financial.supplierReturns().then(setSupplierReturns))
      }
      if (tab === "bancos") {
        p.push(api.financial.banks.list().then(setBanks))
        p.push(api.financial.banksDashboard().then((d: any) => setDashboard(prev => ({ ...prev, cash_flow: { ...prev?.cash_flow, saldo_bancario: d.saldo_total } } as any))))
      }
      if (tab === "cashflow") p.push(api.financial.cashFlow.list().then(setCashFlow))
      if (tab === "presupuestos") p.push(api.financial.budgets.list().then(setBudgets))
      if (tab === "pagos") p.push(api.financial.paymentRuns.list().then(setPaymentRuns))
      if (tab === "dashboard" || tab === "ap") p.push(api.financial.ratios().then(setRatios))
      await Promise.all(p)
    } catch (e: any) {
      if (e.status !== 401 && e.response?.status !== 401) {
        toast.error("Error", e.message)
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [tab, filterEstado])

  const handleCreateInvoice = async () => {
    try {
      await api.financial.invoices.create({
        ...invoiceForm,
        subtotal: Number(invoiceForm.subtotal),
        iva_10: Number(invoiceForm.iva_10),
        total: Number(invoiceForm.total),
      })
      toast.success("Factura registrada"); setShowInvoiceForm(false)
      setInvoiceForm({ supplier_id: "", numero_factura: "", timbrado: "", fecha_emision: "", fecha_vencimiento: "", subtotal: "", iva_10: "", total: "", concepto: "" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateBank = async () => {
    try {
      await api.financial.banks.create({ ...bankForm, saldo_inicial: Number(bankForm.saldo_inicial) })
      toast.success("Cuenta creada"); setShowBankForm(false); fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateBudget = async () => {
    try {
      await api.financial.budgets.create({ ...budgetForm, monto_presupuestado: Number(budgetForm.monto_presupuestado) })
      toast.success("Presupuesto creado"); setShowBudgetForm(false); fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreatePaymentRun = async () => {
    try {
      await api.financial.paymentRuns.create(runForm)
      toast.success("Lote creado"); setShowPaymentRunForm(false); fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handlePayInvoice = async (id: string) => {
    try {
      await api.financial.invoices.pay(id, { ...payForm, monto: Number(payForm.monto) })
      toast.success("Pago registrado"); setShowPayModal(null); fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleApprove = async (id: string) => {
    try { await api.financial.invoices.approve(id); toast.success("Aprobada"); fetchAll() }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const handleExecuteRun = async (id: string) => {
    try { const r = await api.financial.paymentRuns.execute(id); toast.success(r.detail); fetchAll() }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const handleGenerateCashFlow = async () => {
    try { const r = await api.financial.cashFlow.generate(); toast.success(r.detail); fetchAll() }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const handleImportBank = async () => {
    if (!selectedBank) return
    try {
      const lines = importData.trim().split("\n").slice(1) // skip header
      const txns = lines.map(l => { const p = l.split("\t"); return { fecha: p[0], tipo: p[1], monto: Number(p[2]), descripcion: p[3] || "", referencia: p[4] || "" } })
      await api.financial.banks.import(selectedBank, txns)
      toast.success(`${txns.length} transacciones importadas`); setShowImportBank(false); setImportData("")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const loadBankTxns = async (bankId: string) => {
    try { const t = await api.financial.banks.transactions(bankId); setBankTxns(t); setSelectedBank(bankId) }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const formatGs = (n?: number) => n != null ? `Gs ${n.toLocaleString("es-PY", { maximumFractionDigits: 0 })}` : "-"

  const tabs: { k: Tab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "ap", l: "Ctas. Pagar", i: Receipt },
    { k: "bancos", l: "Bancos", i: Landmark },
    { k: "cashflow", l: "Flujo Caja", i: TrendingUp },
    { k: "presupuestos", l: "Presupuestos", i: PiggyBank },
    { k: "pagos", l: "Lotes Pago", i: CreditCard },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión Financiera</h1><p className="text-sm text-gray-500">Cuentas a pagar, bancos, flujo de caja, presupuestos</p></div>
        <div className="flex gap-2">
          {tab === "ap" && <button onClick={() => setShowInvoiceForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Factura</button>}
          {tab === "bancos" && <button onClick={() => setShowBankForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Cuenta</button>}
          {tab === "presupuestos" && <button onClick={() => setShowBudgetForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Presupuesto</button>}
          {tab === "pagos" && <button onClick={() => setShowPaymentRunForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Lote pago</button>}
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
                  { label: "Ctas. Pagar", value: dashboard?.ap_dashboard?.total_pendiente, icon: Receipt, color: "text-red-600" },
                  { label: "Vencido", value: dashboard?.ap_dashboard?.total_vencido, icon: AlertTriangle, color: "text-red-700" },
                  { label: "Saldo bancario", value: dashboard?.cash_flow?.saldo_bancario, icon: Landmark, color: "text-green-600" },
                  { label: "Proy. 7 días", value: dashboard?.cash_flow?.saldo_proyectado_7d, icon: TrendingUp, color: "text-blue-600" },
                  { label: "Proy. 30 días", value: dashboard?.cash_flow?.saldo_proyectado_30d, icon: BarChart3, color: "text-purple-600" },
                  { label: "Facturas venc.", value: dashboard?.ap_dashboard?.facturas_vencidas, icon: XCircle, color: "text-red-600" },
                ].map((c, i) => (
                  <div key={i} className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-500 font-medium">{c.label}</span>
                      <c.icon className={`w-5 h-5 ${c.color}`} />
                    </div>
                    <div className={`text-2xl font-bold ${c.color}`}>
                      {c.label.includes("Facturas") || c.label.includes("Proy.") ? (c.value ?? 0) : formatGs(c.value)}
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
              {dashboard?.ap_dashboard && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card p-4 text-center"><div className="text-sm text-gray-500">Pendiente</div><div className="text-xl font-bold text-amber-600">{formatGs(dashboard.ap_dashboard.total_pendiente)}</div></div>
                  <div className="card p-4 text-center"><div className="text-sm text-gray-500">Vencido</div><div className="text-xl font-bold text-red-600">{formatGs(dashboard.ap_dashboard.total_vencido)}</div></div>
                  <div className="card p-4 text-center"><div className="text-sm text-gray-500">Facturas</div><div className="text-xl font-bold">{dashboard.ap_dashboard.facturas_pendientes} pend. / {dashboard.ap_dashboard.facturas_vencidas} venc.</div></div>
                  <div className="card p-4 text-center"><div className="text-sm text-gray-500">Proveedores</div><div className="text-xl font-bold">{dashboard.ap_dashboard.proveedores_con_deuda}</div></div>
                </div>
              )}
              <div className="flex gap-3 items-center">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input-field pl-10" placeholder="Buscar factura..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="input-field w-40" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                  <option value="">Todas</option><option value="pendiente">Pendientes</option><option value="aprobada">Aprobadas</option><option value="pagada">Pagadas</option><option value="vencida">Vencidas</option>
                </select>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="p-3">Proveedor</th><th className="p-3">Factura</th><th className="p-3">Total</th><th className="p-3">Saldo</th><th className="p-3">Vencimiento</th><th className="p-3">Estado</th><th className="p-3"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {invoices.filter(i => !search || i.numero_factura?.includes(search) || i.supplier_nombre?.includes(search)).map(inv => {
                      const vencida = inv.estado !== "pagada" && inv.fecha_vencimiento && new Date(inv.fecha_vencimiento) < new Date()
                      return (
                        <tr key={inv.id} className="table-row">
                          <td className="p-3 font-medium">{inv.supplier_nombre || inv.supplier_id?.slice(0, 8)}</td>
                          <td className="p-3 text-sm font-mono">{inv.numero_factura || "-"}</td>
                          <td className="p-3 font-semibold">{formatGs(inv.total)}</td>
                          <td className="p-3 font-semibold">{formatGs(inv.saldo_pendiente)}</td>
                          <td className={`p-3 text-sm ${vencida ? "text-red-600 font-semibold" : ""}`}>{inv.fecha_vencimiento ? new Date(inv.fecha_vencimiento).toLocaleDateString("es-PY") : "-"}</td>
                          <td className="p-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${inv.estado === "pagada" ? "bg-green-50 dark:bg-green-900/20 text-green-600" : inv.estado === "aprobada" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600" : vencida ? "bg-red-50 dark:bg-red-900/20 text-red-600" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600"}`}>
                              {vencida && inv.estado !== "pagada" ? "vencida" : inv.estado}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {inv.estado === "pendiente" && <button onClick={() => handleApprove(inv.id)} className="p-1 hover:bg-gray-100 rounded" title="Aprobar"><CheckCircle className="w-4 h-4 text-blue-500" /></button>}
                              {(inv.estado === "aprobada" || inv.estado === "pendiente") && <button onClick={() => { setShowPayModal(inv.id); setPayForm({ ...payForm, monto: String(inv.saldo_pendiente || inv.total) }) }} className="p-1 hover:bg-gray-100 rounded" title="Pagar"><DollarSign className="w-4 h-4 text-green-500" /></button>}
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

          {tab === "bancos" && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {banks.map(b => (
                  <div key={b.id} className={`card p-5 cursor-pointer hover:shadow-md transition-shadow ${selectedBank === b.id ? "ring-2 ring-primary" : ""}`} onClick={() => loadBankTxns(b.id)}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{b.banco}</h3>
                      <Landmark className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{b.numero_cuenta}</div>
                    <div className="text-lg font-bold mt-2">{formatGs(b.saldo_actual)}</div>
                    <div className="text-xs text-gray-400 capitalize">{b.tipo} · {b.moneda}</div>
                  </div>
                ))}
              </div>
              {selectedBank && bankTxns.length > 0 && (
                <div className="card p-0 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b"><h3 className="font-semibold">Movimientos</h3></div>
                  <table className="w-full">
                    <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Monto</th><th className="p-3">Descripción</th><th className="p-3">Referencia</th><th className="p-3">Conciliado</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {bankTxns.map(t => (
                        <tr key={t.id} className="table-row">
                          <td className="p-3 text-sm">{t.fecha ? new Date(t.fecha).toLocaleDateString("es-PY") : "-"}</td>
                          <td className="p-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${t.tipo === "credito" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>{t.tipo === "credito" ? "Ingreso" : "Egreso"}</span></td>
                          <td className="p-3 font-semibold">{formatGs(t.monto)}</td>
                          <td className="p-3 text-sm text-gray-500">{t.descripcion || "-"}</td>
                          <td className="p-3 text-xs text-gray-400">{t.referencia || "-"}</td>
                          <td className="p-3">{t.conciliado ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={() => setShowImportBank(true)} className="btn-ghost flex items-center gap-2 mt-4"><Upload className="w-4 h-4" />Importar extracto bancario</button>
            </div>
          )}

          {tab === "cashflow" && (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={handleGenerateCashFlow} className="btn-primary flex items-center gap-2"><BarChart3 className="w-4 h-4" />Generar proyección 90 días</button>
              </div>
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
            <div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="p-3">Nombre</th><th className="p-3">Periodo</th><th className="p-3">Área</th><th className="p-3">Presupuestado</th><th className="p-3">Ejecutado</th><th className="p-3">Disponible</th><th className="p-3">% Uso</th>
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
                        </tr>
                      )
                    })}
                    {budgets.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-500">Sin presupuestos</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "pagos" && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {paymentRuns.map(r => (
                  <div key={r.id} className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{r.nombre}</h3>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.estado === "ejecutado" ? "bg-green-50 text-green-600" : r.estado === "aprobado" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>{r.estado}</span>
                    </div>
                    <div className="text-sm text-gray-500">{r.fecha_programada ? new Date(r.fecha_programada).toLocaleDateString("es-PY") : "-"}</div>
                    <div className="text-lg font-bold mt-2">{formatGs(r.total_monto)}</div>
                    <div className="text-xs text-gray-400 capitalize">{r.metodo_pago} · {r.items?.length ?? 0} items</div>
                    {r.estado === "borrador" && <button onClick={() => handleExecuteRun(r.id)} className="btn-primary text-sm w-full mt-3">Ejecutar</button>}
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
              <div><label className="label-field">Proveedor ID</label><input className="input-field" value={invoiceForm.supplier_id} onChange={e => setInvoiceForm({ ...invoiceForm, supplier_id: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">N° factura</label><input className="input-field" value={invoiceForm.numero_factura} onChange={e => setInvoiceForm({ ...invoiceForm, numero_factura: e.target.value })} /></div>
                <div><label className="label-field">Timbrado</label><input className="input-field" value={invoiceForm.timbrado} onChange={e => setInvoiceForm({ ...invoiceForm, timbrado: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Fecha emisión</label><input className="input-field" type="date" value={invoiceForm.fecha_emision} onChange={e => setInvoiceForm({ ...invoiceForm, fecha_emision: e.target.value })} /></div>
                <div><label className="label-field">Fecha vencimiento</label><input className="input-field" type="date" value={invoiceForm.fecha_vencimiento} onChange={e => setInvoiceForm({ ...invoiceForm, fecha_vencimiento: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="label-field">Subtotal</label><input className="input-field" type="number" value={invoiceForm.subtotal} onChange={e => setInvoiceForm({ ...invoiceForm, subtotal: e.target.value })} /></div>
                <div><label className="label-field">IVA 10%</label><input className="input-field" type="number" value={invoiceForm.iva_10} onChange={e => setInvoiceForm({ ...invoiceForm, iva_10: e.target.value })} /></div>
                <div><label className="label-field">Total</label><input className="input-field" type="number" value={invoiceForm.total} onChange={e => setInvoiceForm({ ...invoiceForm, total: e.target.value })} /></div>
              </div>
              <div><label className="label-field">Concepto</label><textarea className="input-field" value={invoiceForm.concepto} onChange={e => setInvoiceForm({ ...invoiceForm, concepto: e.target.value })} rows={2} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowInvoiceForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateInvoice} disabled={!invoiceForm.supplier_id || !invoiceForm.total} className="btn-primary disabled:opacity-50">Registrar</button>
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

      {/* Bank form modal */}
      {showBankForm && (
        <div className="modal-overlay" onClick={() => setShowBankForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Nueva cuenta bancaria</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Banco</label><input className="input-field" value={bankForm.banco} onChange={e => setBankForm({ ...bankForm, banco: e.target.value })} /></div>
              <div><label className="label-field">N° cuenta</label><input className="input-field" value={bankForm.numero_cuenta} onChange={e => setBankForm({ ...bankForm, numero_cuenta: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Tipo</label><select className="input-field" value={bankForm.tipo} onChange={e => setBankForm({ ...bankForm, tipo: e.target.value })}><option value="corriente">Corriente</option><option value="ahorro">Ahorro</option></select></div>
                <div><label className="label-field">Moneda</label><select className="input-field" value={bankForm.moneda} onChange={e => setBankForm({ ...bankForm, moneda: e.target.value })}><option value="PYG">PYG</option><option value="USD">USD</option><option value="BRL">BRL</option></select></div>
              </div>
              <div><label className="label-field">Saldo inicial</label><input className="input-field" type="number" value={bankForm.saldo_inicial} onChange={e => setBankForm({ ...bankForm, saldo_inicial: e.target.value })} /></div>
              <div><label className="label-field">Titular</label><input className="input-field" value={bankForm.titular} onChange={e => setBankForm({ ...bankForm, titular: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowBankForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateBank} disabled={!bankForm.banco || !bankForm.numero_cuenta} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Budget form modal */}
      {showBudgetForm && (
        <div className="modal-overlay" onClick={() => setShowBudgetForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Nuevo presupuesto</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Nombre</label><input className="input-field" value={budgetForm.nombre} onChange={e => setBudgetForm({ ...budgetForm, nombre: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Periodo</label><input className="input-field" value={budgetForm.periodo} placeholder="YYYY-MM" onChange={e => setBudgetForm({ ...budgetForm, periodo: e.target.value })} /></div>
                <div><label className="label-field">Área</label><select className="input-field" value={budgetForm.area} onChange={e => setBudgetForm({ ...budgetForm, area: e.target.value })}>
                  <option value="general">General</option><option value="carniceria">Carnicería</option><option value="panaderia">Panadería</option><option value="verduleria">Verdulería</option><option value="lacteos">Lácteos</option><option value="limpieza">Limpieza</option><option value="administracion">Administración</option>
                </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Monto presupuestado</label><input className="input-field" type="number" value={budgetForm.monto_presupuestado} onChange={e => setBudgetForm({ ...budgetForm, monto_presupuestado: e.target.value })} /></div>
                <div><label className="label-field">Tipo</label><select className="input-field" value={budgetForm.tipo} onChange={e => setBudgetForm({ ...budgetForm, tipo: e.target.value })}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></div>
              </div>
              <div><label className="label-field">Categoría</label><input className="input-field" value={budgetForm.categoria} onChange={e => setBudgetForm({ ...budgetForm, categoria: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowBudgetForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateBudget} disabled={!budgetForm.nombre || !budgetForm.periodo} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment run form modal */}
      {showPaymentRunForm && (
        <div className="modal-overlay" onClick={() => setShowPaymentRunForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Nuevo lote de pago</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Nombre</label><input className="input-field" value={runForm.nombre} onChange={e => setRunForm({ ...runForm, nombre: e.target.value })} /></div>
              <div><label className="label-field">Fecha programada</label><input className="input-field" type="date" value={runForm.fecha_programada} onChange={e => setRunForm({ ...runForm, fecha_programada: e.target.value })} /></div>
              <div><label className="label-field">Método de pago</label><select className="input-field" value={runForm.metodo_pago} onChange={e => setRunForm({ ...runForm, metodo_pago: e.target.value })}>
                <option value="transferencia">Transferencia</option><option value="cheque">Cheque</option><option value="efectivo">Efectivo</option>
              </select></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPaymentRunForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreatePaymentRun} disabled={!runForm.nombre || !runForm.fecha_programada} className="btn-primary disabled:opacity-50">Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Import bank statement modal */}
      {showImportBank && (
        <div className="modal-overlay" onClick={() => setShowImportBank(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Importar extracto bancario</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Cuenta bancaria</label>
                <select className="input-field" value={selectedBank} onChange={e => setSelectedBank(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.banco} - {b.numero_cuenta}</option>)}
                </select>
              </div>
              <div><label className="label-field">Datos (TSV: fecha, tipo, monto, descripción, referencia)</label>
                <textarea className="input-field font-mono text-xs" rows={8} value={importData} onChange={e => setImportData(e.target.value)}
                  placeholder={"2026-05-01\tcredito\t5000000\tVenta contado\tFACT-001\n2026-05-02\tdebito\t1200000\tPago proveedor\tXFER-042"} />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowImportBank(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleImportBank} disabled={!selectedBank || !importData.trim()} className="btn-primary disabled:opacity-50">Importar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
