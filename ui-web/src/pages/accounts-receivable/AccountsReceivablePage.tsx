import { useState, useEffect } from "react"
import { Search, ReceiptText, Clock, AlertTriangle, DollarSign, FileText, Loader2, Calendar, Eye, X, Package, Wallet, Sparkles, PhoneCall, CreditCard, Plus, TrendingUp } from "lucide-react"
import { api, type AccountsReceivable, type Sale, type SaleItem, type CreditAccount } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG, formatDate, formatPercentage } from "../../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

type TabType = "documentos" | "aging" | "scoring"

interface CustomerScore {
  id: string
  customer_id: string
  customer_nombre: string | null
  score: number
  pago_puntual: number
  dias_mora_promedio: number
  antiguedad_dias: number
  total_compras: number
  total_pagos: number
  veces_mora: number
  ultima_actualizacion: string | null
}

interface AgingData {
  total_pendiente: number
  cantidad_documentos: number
  buckets: { rango: string; monto: number; cantidad: number; porcentaje: number }[]
  por_clientes: {
    customer_id: string
    customer_name: string
    saldo_total: number
    current: number
    days_1_30: number
    days_31_60: number
    days_61_90: number
    days_91_plus: number
    total_documentos: number
  }[]
}

interface SummaryData {
  total: number
  total_pendiente: number
  pagados: number
  pendientes: number
  vencidos: number
  monto_vencido: number
  dso: number | null
}

interface PendingDoc { id: string; numero_documento: string; fecha_emision: string; fecha_vencimiento: string | null; moneda: string; monto_original: number; saldo_pendiente: number; dias_mora: number }
interface CollectionAction { id: string; customer_id: string; receivable_id?: string | null; tipo: string; fecha: string; resultado?: string | null; notas?: string | null; contacto?: string | null; proximo_contacto?: string | null; compromiso_pago?: string | null; monto_comprometido?: number | null }

export default function AccountsReceivablePage() {
  const [tab, setTab] = useState<TabType>("documentos")
  const [docs, setDocs] = useState<AccountsReceivable[]>([])
  const [aging, setAging] = useState<AgingData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<AccountsReceivable | null>(null)
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null)
  const [invoiceItems, setInvoiceItems] = useState<SaleItem[]>([])
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [docPayments, setDocPayments] = useState<{ id: string; fecha: string; forma_pago: string | null; referencia: string | null; monto: number }[]>([])
  const [customerDocs, setCustomerDocs] = useState<AccountsReceivable[]>([])

  // Reportes exportables (Aging / Cobranzas)
  const [reportFechaDesde, setReportFechaDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]
  })
  const [reportFechaHasta, setReportFechaHasta] = useState(() => new Date().toISOString().split("T")[0])

  // Registrar pago
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null) // customer_id
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [payFormaPago, setPayFormaPago] = useState("efectivo")
  const [payReferencia, setPayReferencia] = useState("")
  const [payFecha, setPayFecha] = useState(() => new Date().toISOString().split("T")[0])
  const [payObservaciones, setPayObservaciones] = useState("")
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // Cobranzas + linea de credito
  const [collectionActions, setCollectionActions] = useState<CollectionAction[]>([])
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null)
  const [showCollectionForm, setShowCollectionForm] = useState(false)
  const [collectionForm, setCollectionForm] = useState({ tipo: "llamada", resultado: "", notas: "", contacto: "", proximo_contacto: "", compromiso_pago: "", monto_comprometido: "" })

  const toast = useToast()

  const openInvoice = async (doc: AccountsReceivable) => {
    setSelectedDoc(doc)
    setInvoiceSale(null)
    setInvoiceItems([])
    setDocPayments([])
    api.accountsReceivable.documentPayments(doc.id).then(setDocPayments).catch(() => setDocPayments([]))
    if (!doc.sale_id) return
    setInvoiceLoading(true)
    try {
      const [sale, items] = await Promise.all([
        api.sales.get(doc.sale_id),
        api.sales.items(doc.sale_id),
      ])
      setInvoiceSale(sale)
      setInvoiceItems(items)
    } catch {
      toast.error("Error", "No se pudo cargar el detalle de la factura")
    } finally {
      setInvoiceLoading(false)
    }
  }

  const openCustomer = async (customerId: string) => {
    setExpandedCustomer(customerId)
    setCollectionActions([])
    setCreditAccount(null)
    setCustomerDocs([])
    api.integratedFinance.listCollectionActions(COMPANY_ID, customerId).then(setCollectionActions).catch(() => setCollectionActions([]))
    api.creditAccounts.getByCustomer(customerId).then(setCreditAccount).catch(() => setCreditAccount(null))
    // Documentos reales de ESE cliente — antes esta tabla filtraba sobre la
    // pagina de 50 documentos cargada en la pestana Documentos, que casi
    // nunca contenia los documentos del cliente que se estaba mirando.
    api.accountsReceivable.list({ customer_id: customerId, limit: 500 }).then(setCustomerDocs).catch(() => setCustomerDocs([]))
  }

  const openPaymentModal = async (customerId: string) => {
    setShowPaymentModal(customerId)
    setAllocations({})
    setPayReferencia("")
    setPayObservaciones("")
    setPendingLoading(true)
    try {
      const docs = await api.accountsReceivable.pendingForCustomer(customerId)
      setPendingDocs(docs)
    } catch {
      toast.error("Error", "No se pudieron cargar los documentos pendientes")
      setPendingDocs([])
    } finally {
      setPendingLoading(false)
    }
  }

  const montoTotalPago = Object.values(allocations).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)

  const handleAutoDistribuir = () => {
    const monto = prompt("¿Cuánto pagó el cliente en total? (₲)")
    if (!monto) return
    let restante = parseFloat(monto) || 0
    const nuevas: Record<string, string> = {}
    for (const d of pendingDocs) {
      if (restante <= 0) break
      const aplicar = Math.min(restante, d.saldo_pendiente)
      if (aplicar > 0) { nuevas[d.id] = String(aplicar); restante -= aplicar }
    }
    setAllocations(nuevas)
  }

  const handleSubmitPayment = async () => {
    if (!showPaymentModal) return
    const allocs = Object.entries(allocations).filter(([, v]) => parseFloat(v) > 0).map(([id, v]) => ({ accounts_receivable_id: id, monto: parseFloat(v) }))
    if (allocs.length === 0) { toast.error("Error", "Asigná un monto a al menos un documento"); return }
    setSubmittingPayment(true)
    try {
      await api.accountsReceivable.registerPayment({
        customer_id: showPaymentModal, monto_total: montoTotalPago, forma_pago: payFormaPago,
        referencia: payReferencia || undefined, fecha: payFecha, observaciones: payObservaciones || undefined,
        allocations: allocs,
      })
      toast.success("Pago registrado", `${formatPYG(montoTotalPago)} aplicado a ${allocs.length} documento(s)`)
      setShowPaymentModal(null)
      fetchData()
      if (expandedCustomer) openCustomer(expandedCustomer)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo registrar el pago")
    } finally {
      setSubmittingPayment(false)
    }
  }

  const handleCreateCollectionAction = async () => {
    if (!expandedCustomer) return
    try {
      await api.integratedFinance.createCollectionAction({
        company_id: COMPANY_ID, customer_id: expandedCustomer,
        receivable_id: selectedDoc?.id,
        tipo: collectionForm.tipo, resultado: collectionForm.resultado || undefined,
        notas: collectionForm.notas || undefined, contacto: collectionForm.contacto || undefined,
        proximo_contacto: collectionForm.proximo_contacto || undefined,
        compromiso_pago: collectionForm.compromiso_pago || undefined,
        monto_comprometido: collectionForm.monto_comprometido ? Number(collectionForm.monto_comprometido) : undefined,
      })
      toast.success("Gestión registrada")
      setShowCollectionForm(false)
      setCollectionForm({ tipo: "llamada", resultado: "", notas: "", contacto: "", proximo_contacto: "", compromiso_pago: "", monto_comprometido: "" })
      openCustomer(expandedCustomer)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo registrar la gestión")
    }
  }

  const reportParams = { fecha_desde: reportFechaDesde, fecha_hasta: reportFechaHasta }
  const handleDownloadAgingExcel = () => api.accountsReceivable.downloadAgingExcel(reportParams).catch((e: any) => toast.error("Error", e.message))
  const handleDownloadAgingPdf = () => api.accountsReceivable.downloadAgingPdf(reportParams).catch((e: any) => toast.error("Error", e.message))
  const handleDownloadCobranzasExcel = () => api.accountsReceivable.downloadCobranzasExcel(reportParams).catch((e: any) => toast.error("Error", e.message))
  const handleDownloadCobranzasPdf = () => api.accountsReceivable.downloadCobranzasPdf(reportParams).catch((e: any) => toast.error("Error", e.message))

  const PAGE_SIZE = 50
  const [page, setPage] = useState(0)
  const [docsTotal, setDocsTotal] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      const estadoParam = filterStatus !== "todos" ? filterStatus : undefined
      const [docsData, countData, agingData, summaryData] = await Promise.all([
        api.accountsReceivable.list({ estado: estadoParam, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
        api.accountsReceivable.count({ estado: estadoParam }),
        api.accountsReceivable.aging(),
        api.accountsReceivable.summary(),
      ])
      setDocs(docsData)
      setDocsTotal(countData.total)
      setAging(agingData)
      setSummary(summaryData)
    } catch {
      setDocs([])
      setDocsTotal(0)
      setAging(null)
      setSummary(null)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [filterStatus, page])
  useEffect(() => { setPage(0) }, [filterStatus])

  const filtered = docs.filter(d =>
    !search || d.numero_documento?.toLowerCase().includes(search.toLowerCase()) ||
    d.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  const statusMap: Record<string, string> = {
    pendiente: "badge-warning",
    pagado: "badge-success",
    vencido: "badge-danger",
  }

  const totalSaldo = docs.reduce((a, b) => a + Number(b.saldo_pendiente || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ReceiptText className="w-6 h-6 text-primary" />Cuentas por Cobrar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{docsTotal.toLocaleString("es-PY")} documentos registrados</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Pendiente</span></div>
          <p className="text-2xl font-bold text-amber-500">{formatPYG(summary?.total_pendiente || 0)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 text-purple-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">DSO (días de cobro)</span></div>
          <p className="text-2xl font-bold text-purple-500">{summary?.dso != null ? summary.dso.toFixed(1) : "—"}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><AlertTriangle className="w-5 h-5 text-red-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Documentos Vencidos</span></div>
          <p className="text-2xl font-bold text-red-500">{summary?.vencidos || 0}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 text-red-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monto Vencido</span></div>
          <p className="text-2xl font-bold text-red-500">{formatPYG(summary?.monto_vencido || 0)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><FileText className="w-5 h-5 text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Documentos Totales</span></div>
          <p className="text-2xl font-bold text-blue-500">{summary?.total || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(["documentos", "aging", "scoring"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-px ${tab === t ? "text-primary border-primary" : "text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            {t === "documentos" ? "Documentos" : t === "aging" ? "Aging" : "Scoring"}
          </button>
        ))}
      </div>

      {/* Documentos Tab */}
      {tab === "documentos" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar por documento o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input-field w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="vencido">Vencido</option>
            </select>
            <button onClick={fetchData} className="btn-primary">Actualizar</button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Nro Documento</th>
                  <th className="table-cell">Cliente</th>
                  <th className="table-cell">Fecha Emisión</th>
                  <th className="table-cell">Vencimiento</th>
                  <th className="table-cell text-right">Monto Original</th>
                  <th className="table-cell text-right">Saldo</th>
                  <th className="table-cell text-right">Días Mora</th>
                  <th className="table-cell">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No se encontraron documentos</td></tr>
                ) : filtered.map(d => {
                  const overdue = (d.dias_mora || 0) > 0
                  return (
                    <tr key={d.id} className={`table-row cursor-pointer ${overdue ? "bg-red-50 dark:bg-red-900/10" : ""}`} onClick={() => openInvoice(d)}>
                      <td className="table-td font-mono text-xs font-bold text-primary">{d.numero_documento || "—"}</td>
                      <td className="table-td"><span className={`text-sm font-medium ${overdue ? "text-red-700 dark:text-red-300" : ""}`}>{d.customer_name}</span></td>
                      <td className="table-td text-sm text-gray-500">{formatDate(d.fecha_emision)}</td>
                      <td className={`table-td text-sm ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : "—"}</td>
                      <td className="table-td text-right font-mono font-bold">{formatPYG(d.monto_original)}</td>
                      <td className={`table-td text-right font-mono font-bold ${(d.saldo_pendiente || 0) > 0 ? "text-amber-500" : "text-green-500"}`}>{formatPYG(d.saldo_pendiente)}</td>
                      <td className={`table-td text-right font-mono ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{(d.dias_mora || 0) > 0 ? `${d.dias_mora}d` : "—"}</td>
                      <td className="table-td"><StatusBadge status={d.estado || "-"} map={statusMap} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {docsTotal > 0 ? `Mostrando ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, docsTotal)} de ${docsTotal.toLocaleString("es-PY")}` : "Sin documentos"}
              {search && " — la búsqueda solo filtra dentro de esta página"}
            </p>
            <div className="flex gap-2">
              <button className="btn-outline text-xs disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</button>
              <button className="btn-outline text-xs disabled:opacity-40" disabled={(page + 1) * PAGE_SIZE >= docsTotal} onClick={() => setPage(p => p + 1)}>Siguiente</button>
            </div>
          </div>
        </>
      )}

      {/* Aging Tab */}
      {tab === "aging" && (
        <div className="space-y-6">
          {loading ? (
            <div className="py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
          ) : aging ? (
            <>
              {/* Reportes exportables */}
              <div className="card p-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium">Desde</label>
                  <input className="input-field w-fit" type="date" value={reportFechaDesde} onChange={e => setReportFechaDesde(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Hasta</label>
                  <input className="input-field w-fit" type="date" value={reportFechaHasta} onChange={e => setReportFechaHasta(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <span className="text-xs font-bold text-gray-400 uppercase mr-1">Aging:</span>
                  <button onClick={handleDownloadAgingExcel} className="btn-outline text-xs flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Excel</button>
                  <button onClick={handleDownloadAgingPdf} className="btn-outline text-xs flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> PDF</button>
                  <span className="text-xs font-bold text-gray-400 uppercase mx-1">Cobranzas:</span>
                  <button onClick={handleDownloadCobranzasExcel} className="btn-outline text-xs flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Excel</button>
                  <button onClick={handleDownloadCobranzasPdf} className="btn-outline text-xs flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> PDF</button>
                </div>
              </div>

              {/* Aging Buckets */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {aging.buckets.map(b => {
                  const barColor =
                    b.rango === "Al día" ? "bg-green-500" :
                    b.rango === "1-30" ? "bg-yellow-500" :
                    b.rango === "31-60" ? "bg-orange-500" :
                    b.rango === "61-90" ? "bg-red-500" : "bg-red-700"
                  return (
                    <div key={b.rango} className="card p-5 flex flex-col">
                      <span className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">{b.rango}</span>
                      <p className={`text-lg font-bold ${b.rango === "Al día" ? "text-green-500" : "text-red-500"}`}>{formatPYG(b.monto)}</p>
                      <p className="text-xs text-gray-400 mb-3">{b.cantidad} docs · {formatPercentage(b.porcentaje)}</p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-auto">
                        <div className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(b.porcentaje, 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Customer Breakdown */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Desglose por Cliente</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="table-cell">Cliente</th>
                      <th className="table-cell text-right">Documentos</th>
                      <th className="table-cell text-right">Al día</th>
                      <th className="table-cell text-right">1-30</th>
                      <th className="table-cell text-right">31-60</th>
                      <th className="table-cell text-right">61-90</th>
                      <th className="table-cell text-right">+90</th>
                      <th className="table-cell text-right">Saldo Total</th>
                      <th className="table-cell"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.por_clientes.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400">Sin clientes con saldo pendiente</td></tr>
                    ) : aging.por_clientes.map(c => {
                      const overdueTotal = c.days_1_30 + c.days_31_60 + c.days_61_90 + c.days_91_plus
                      const totalBuckets = c.saldo_total || 1
                      return (
                        <tr key={c.customer_id} className="table-row">
                          <td className="table-td"><span className="text-sm font-medium">{c.customer_name}</span></td>
                          <td className="table-td text-right font-mono">{c.total_documentos}</td>
                          <td className="table-td text-right font-mono text-green-600">{formatPYG(c.current)}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_1_30 > 0 ? "#eab308" : undefined }}>{c.days_1_30 > 0 ? formatPYG(c.days_1_30) : "—"}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_31_60 > 0 ? "#f97316" : undefined }}>{c.days_31_60 > 0 ? formatPYG(c.days_31_60) : "—"}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_61_90 > 0 ? "#ef4444" : undefined }}>{c.days_61_90 > 0 ? formatPYG(c.days_61_90) : "—"}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_91_plus > 0 ? "#b91c1c" : undefined }}>{c.days_91_plus > 0 ? formatPYG(c.days_91_plus) : "—"}</td>
                          <td className="table-td text-right font-mono font-bold">{formatPYG(c.saldo_total)}</td>
                          <td className="table-td">
                            <button
                              className="btn-ghost"
                              title="Ver detalle"
                              onClick={() => expandedCustomer === c.customer_id ? setExpandedCustomer(null) : openCustomer(c.customer_id)}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">No hay datos de aging disponibles</div>
          )}
        </div>
      )}

      {tab === "scoring" && <ScoringTab />}

      {/* Customer Detail Modal */}
      {expandedCustomer && aging && (
        <div className="modal-overlay" onClick={() => setExpandedCustomer(null)}>
          <div className="modal-content max-w-3xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {aging.por_clientes.find(c => c.customer_id === expandedCustomer)?.customer_name || "Cliente"}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => openPaymentModal(expandedCustomer)} className="btn-primary flex items-center gap-2 text-xs"><Wallet className="w-3.5 h-3.5" /> Registrar pago</button>
                <button onClick={() => api.accountsReceivable.downloadStatementPdf(expandedCustomer).catch((e: any) => toast.error("Error", e.message))} className="btn-outline flex items-center gap-2 text-xs"><FileText className="w-3.5 h-3.5" /> Estado de Cuenta (PDF)</button>
                <button onClick={() => setExpandedCustomer(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {creditAccount && (
                <div className="card p-4 flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300"><CreditCard className="w-4 h-4 text-blue-500" /> Línea de crédito</div>
                  <div className="flex gap-4 text-xs">
                    <span>Límite: <strong>{formatPYG(creditAccount.limite_credito || 0)}</strong></span>
                    <span>Utilizado: <strong className="text-amber-500">{formatPYG(creditAccount.saldo_utilizado || 0)}</strong></span>
                    <span>Disponible: <strong className="text-green-500">{formatPYG(creditAccount.saldo_disponible || 0)}</strong></span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {aging.buckets.map(b => {
                  const matching = aging.por_clientes.find(c => c.customer_id === expandedCustomer)
                  const bucketMap: Record<string, number> = {
                    "Al día": matching?.current || 0,
                    "1-30": matching?.days_1_30 || 0,
                    "31-60": matching?.days_31_60 || 0,
                    "61-90": matching?.days_61_90 || 0,
                    "+90": matching?.days_91_plus || 0,
                  }
                  const val = bucketMap[b.rango] || 0
                  return (
                    <div key={b.rango} className="card p-4">
                      <span className="text-xs font-black uppercase tracking-widest text-gray-400">{b.rango}</span>
                      <p className="text-lg font-bold mt-1">{formatPYG(val)}</p>
                    </div>
                  )
                })}
                <div className="card p-4 border-amber-500/30">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Saldo Total</span>
                  <p className="text-lg font-bold mt-1 text-amber-500">{formatPYG(aging.por_clientes.find(c => c.customer_id === expandedCustomer)?.saldo_total || 0)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4">
                {aging.buckets.map(b => {
                  const matching = aging.por_clientes.find(c => c.customer_id === expandedCustomer)
                  const bucketMap: Record<string, number> = {
                    "Al día": matching?.current || 0,
                    "1-30": matching?.days_1_30 || 0,
                    "31-60": matching?.days_31_60 || 0,
                    "61-90": matching?.days_61_90 || 0,
                    "+90": matching?.days_91_plus || 0,
                  }
                  const val = bucketMap[b.rango] || 0
                  const pct = matching?.saldo_total ? (val / matching.saldo_total) * 100 : 0
                  const barColor =
                    b.rango === "Al día" ? "bg-green-500" :
                    b.rango === "1-30" ? "bg-yellow-500" :
                    b.rango === "31-60" ? "bg-orange-500" :
                    b.rango === "61-90" ? "bg-red-500" : "bg-red-700"
                  return (
                    <div key={b.rango}>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div className={`h-3 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 text-center">{formatPercentage(pct)}</p>
                    </div>
                  )
                })}
              </div>

              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">Documentos de este cliente</h4>
                <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-header">
                        <th className="table-cell">Nro Documento</th>
                        <th className="table-cell">Vencimiento</th>
                        <th className="table-cell text-right">Saldo</th>
                        <th className="table-cell">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerDocs.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-6 text-gray-400">Sin documentos</td></tr>
                      ) : customerDocs.map(d => (
                        <tr
                          key={d.id}
                          className="table-row cursor-pointer"
                          onClick={() => { setExpandedCustomer(null); openInvoice(d) }}
                        >
                          <td className="table-td font-mono text-xs font-bold text-primary">{d.numero_documento || "—"}</td>
                          <td className="table-td text-sm text-gray-500">{d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : "—"}</td>
                          <td className="table-td text-right font-mono font-bold">{formatPYG(d.saldo_pendiente)}</td>
                          <td className="table-td"><StatusBadge status={d.estado || "-"} map={statusMap} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2"><PhoneCall className="w-4 h-4" /> Cobranzas</h4>
                  <button onClick={() => setShowCollectionForm(!showCollectionForm)} className="btn-ghost text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nueva gestión</button>
                </div>
                {showCollectionForm && (
                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 mb-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <select className="input-field" value={collectionForm.tipo} onChange={e => setCollectionForm({ ...collectionForm, tipo: e.target.value })}>
                        <option value="llamada">Llamada</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                        <option value="visita">Visita</option>
                      </select>
                      <input className="input-field" placeholder="Contacto (persona)" value={collectionForm.contacto} onChange={e => setCollectionForm({ ...collectionForm, contacto: e.target.value })} />
                    </div>
                    <textarea className="input-field" placeholder="Notas de la gestión..." rows={2} value={collectionForm.notas} onChange={e => setCollectionForm({ ...collectionForm, notas: e.target.value })} />
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="text-xs text-gray-400">Próximo contacto</label><input className="input-field" type="date" value={collectionForm.proximo_contacto} onChange={e => setCollectionForm({ ...collectionForm, proximo_contacto: e.target.value })} /></div>
                      <div><label className="text-xs text-gray-400">Compromiso de pago</label><input className="input-field" type="date" value={collectionForm.compromiso_pago} onChange={e => setCollectionForm({ ...collectionForm, compromiso_pago: e.target.value })} /></div>
                      <div><label className="text-xs text-gray-400">Monto comprometido</label><input className="input-field" type="number" value={collectionForm.monto_comprometido} onChange={e => setCollectionForm({ ...collectionForm, monto_comprometido: e.target.value })} /></div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost text-xs" onClick={() => setShowCollectionForm(false)}>Cancelar</button>
                      <button className="btn-primary text-xs" onClick={handleCreateCollectionAction}>Guardar gestión</button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {collectionActions.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Sin gestiones de cobranza registradas.</p>
                  ) : collectionActions.map(a => (
                    <div key={a.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="font-bold capitalize">{a.tipo}{a.contacto ? ` — ${a.contacto}` : ""}</span>
                        <span className="text-xs text-gray-400">{formatDate(a.fecha)}</span>
                      </div>
                      {a.notas && <p className="text-gray-500 text-xs mt-1">{a.notas}</p>}
                      {a.compromiso_pago && <p className="text-xs text-amber-500 mt-1">Compromiso de pago: {formatDate(a.compromiso_pago)}{a.monto_comprometido ? ` — ${formatPYG(a.monto_comprometido)}` : ""}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registrar Pago Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(null)}>
          <div className="modal-content max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" /> Registrar pago</h3>
              <button onClick={() => setShowPaymentModal(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {pendingLoading ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
              ) : pendingDocs.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">Este cliente no tiene documentos pendientes.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">Asigná cuánto del pago va a cada documento — un solo pago puede cubrir varias facturas.</p>
                    <button onClick={handleAutoDistribuir} className="btn-outline text-xs flex items-center gap-1.5 flex-shrink-0"><Sparkles className="w-3.5 h-3.5" /> Auto-repartir</button>
                  </div>
                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-header">
                          <th className="table-cell">Documento</th>
                          <th className="table-cell text-right">Saldo</th>
                          <th className="table-cell text-right">Mora</th>
                          <th className="table-cell text-right w-36">Monto a aplicar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingDocs.map(d => (
                          <tr key={d.id} className="table-row">
                            <td className="table-td font-mono text-xs font-bold text-primary">{d.numero_documento}</td>
                            <td className="table-td text-right font-mono">{formatPYG(d.saldo_pendiente)}</td>
                            <td className={`table-td text-right font-mono text-xs ${d.dias_mora > 0 ? "text-red-500 font-bold" : "text-gray-400"}`}>{d.dias_mora > 0 ? `${d.dias_mora}d` : "—"}</td>
                            <td className="table-td">
                              <input
                                className="input-field text-right py-1"
                                type="number"
                                placeholder="0"
                                max={d.saldo_pendiente}
                                value={allocations[d.id] || ""}
                                onChange={e => setAllocations({ ...allocations, [d.id]: e.target.value })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 dark:border-gray-700 font-bold">
                          <td colSpan={3} className="table-td text-right">Total a registrar</td>
                          <td className="table-td text-right font-mono text-primary">{formatPYG(montoTotalPago)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Forma de pago</label>
                      <select className="input-field" value={payFormaPago} onChange={e => setPayFormaPago(e.target.value)}>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="cheque">Cheque</option>
                        <option value="tarjeta">Tarjeta</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Fecha</label>
                      <input className="input-field" type="date" value={payFecha} onChange={e => setPayFecha(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Referencia (Nro. cheque, transferencia...)</label>
                    <input className="input-field" value={payReferencia} onChange={e => setPayReferencia(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Observaciones</label>
                    <textarea className="input-field" rows={2} value={payObservaciones} onChange={e => setPayObservaciones(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button className="btn-ghost" onClick={() => setShowPaymentModal(null)}>Cancelar</button>
                    <button className="btn-primary disabled:opacity-50" disabled={submittingPayment || montoTotalPago <= 0} onClick={handleSubmitPayment}>
                      {submittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : `Registrar ${formatPYG(montoTotalPago)}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal-content max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {selectedDoc.numero_documento || "Documento"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedDoc.customer_name}</p>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card p-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Emisión</span>
                  <p className="text-sm font-bold mt-1">{formatDate(selectedDoc.fecha_emision)}</p>
                </div>
                <div className="card p-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vencimiento</span>
                  <p className="text-sm font-bold mt-1">{selectedDoc.fecha_vencimiento ? formatDate(selectedDoc.fecha_vencimiento) : "—"}</p>
                </div>
                <div className="card p-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monto Original</span>
                  <p className="text-sm font-bold mt-1">{formatPYG(selectedDoc.monto_original)}</p>
                </div>
                <div className="card p-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Saldo</span>
                  <p className="text-sm font-bold mt-1 text-amber-500">{formatPYG(selectedDoc.saldo_pendiente)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Historial de pagos
                </h4>
                {docPayments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4 border border-gray-100 dark:border-gray-700 rounded-xl">Sin pagos registrados en este documento todavía.</p>
                ) : (
                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-header">
                          <th className="table-cell">Fecha</th>
                          <th className="table-cell">Forma de pago</th>
                          <th className="table-cell">Referencia</th>
                          <th className="table-cell text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docPayments.map(p => (
                          <tr key={p.id} className="table-row">
                            <td className="table-td text-sm">{formatDate(p.fecha)}</td>
                            <td className="table-td text-sm capitalize">{p.forma_pago || "—"}</td>
                            <td className="table-td text-sm text-gray-500">{p.referencia || "—"}</td>
                            <td className="table-td text-right font-mono font-bold text-green-600">{formatPYG(p.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Contenido de la factura
                </h4>
                {invoiceLoading ? (
                  <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
                ) : !selectedDoc.sale_id ? (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    Este documento no tiene una venta vinculada — no se puede mostrar el detalle de productos.
                  </div>
                ) : invoiceItems.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">Sin items registrados</div>
                ) : (
                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-header">
                          <th className="table-cell">Producto</th>
                          <th className="table-cell text-right">Cant.</th>
                          <th className="table-cell text-right">P. Unit.</th>
                          <th className="table-cell text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceItems.map((it, i) => (
                          <tr key={it.id || i} className="table-row">
                            <td className="table-td text-sm">{it.descripcion || it.producto?.nombre || it.product?.nombre || "—"}</td>
                            <td className="table-td text-right font-mono">{it.cantidad}</td>
                            <td className="table-td text-right font-mono">{formatPYG(it.precio_unitario)}</td>
                            <td className="table-td text-right font-mono font-bold">{formatPYG(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {invoiceSale && (
                        <tfoot>
                          <tr className="border-t border-gray-200 dark:border-gray-700 font-bold">
                            <td colSpan={3} className="table-td text-right">Total factura</td>
                            <td className="table-td text-right font-mono">{formatPYG(invoiceSale.total)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════ SCORING ═══════════════════════
//
// Calcula el score de riesgo de crédito 100% sobre datos reales de
// accounts_receivable (mora, pago puntual, antigüedad) — vivía escondido
// como pestaña muerta dentro de Contabilidad Integrada (nunca se montaba
// en el nav) y conceptualmente no correspondía ahí: es evidencia de
// comportamiento de cobro, pertenece a Cuentas por Cobrar.

function ScoringTab() {
  const [scores, setScores] = useState<CustomerScore[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculatingAll, setRecalculatingAll] = useState(false)
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const toast = useToast()

  const load = () => {
    setLoading(true)
    api.integratedFinance.listCustomerScores(COMPANY_ID).then(setScores).catch(() => setScores([])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const recalc = async (customerId: string) => {
    setRecalculatingId(customerId)
    try {
      await api.integratedFinance.recalculateScore(COMPANY_ID, customerId)
      load()
    } catch {
      toast.error("Error", "No se pudo recalcular el score")
    } finally {
      setRecalculatingId(null)
    }
  }

  const recalcAll = async () => {
    setRecalculatingAll(true)
    try {
      const result = await api.integratedFinance.recalculateAllScores(COMPANY_ID)
      toast.success("Scoring actualizado", `${result.clientes_recalculados} clientes recalculados`)
      load()
    } catch {
      toast.error("Error", "No se pudo recalcular el scoring masivo")
    } finally {
      setRecalculatingAll(false)
    }
  }

  const filtered = scores.filter(s => !search || (s.customer_nombre || "").toLowerCase().includes(search.toLowerCase()))
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : 0
  const riesgoAlto = scores.filter(s => s.score < 50).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Score Promedio</span></div>
          <p className="text-2xl font-bold text-blue-500">{scores.length > 0 ? avgScore : "—"}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><ReceiptText className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Clientes Evaluados</span></div>
          <p className="text-2xl font-bold text-green-500">{scores.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><AlertTriangle className="w-5 h-5 text-red-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Riesgo Alto (&lt; 50)</span></div>
          <p className="text-2xl font-bold text-red-500">{riesgoAlto}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={recalcAll} disabled={recalculatingAll} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
          {recalculatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          Recalcular todos
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Cliente</th>
              <th className="table-cell text-center">Score</th>
              <th className="table-cell text-right">Pago Puntual</th>
              <th className="table-cell text-right">Días Mora Prom.</th>
              <th className="table-cell text-right">Veces Mora</th>
              <th className="table-cell text-right">Total Compras</th>
              <th className="table-cell"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                {scores.length === 0 ? "Sin datos de scoring — usá \"Recalcular todos\" para generar los scores iniciales" : "Sin resultados"}
              </td></tr>
            ) : (
              filtered.map((s) => {
                const scoreColor = s.score >= 80 ? "bg-green-100 text-green-700" : s.score >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                return (
                  <tr key={s.id} className="table-row">
                    <td className="table-td font-bold text-gray-900 dark:text-white">{s.customer_nombre || s.customer_id.slice(0, 8) + "..."}</td>
                    <td className="table-td text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${scoreColor}`}>{s.score}</span></td>
                    <td className="table-td text-right">{s.pago_puntual}%</td>
                    <td className="table-td text-right">{s.dias_mora_promedio}</td>
                    <td className="table-td text-right">{s.veces_mora}</td>
                    <td className="table-td text-right font-mono">{formatPYG(s.total_compras)}</td>
                    <td className="table-td text-right">
                      <button onClick={() => recalc(s.customer_id)} disabled={recalculatingId === s.customer_id} className="btn-ghost text-xs disabled:opacity-50">
                        {recalculatingId === s.customer_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Recalcular"}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
