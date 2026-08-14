import { useState, useEffect } from "react"
import { Search, ReceiptText, Clock, AlertTriangle, DollarSign, FileText, Loader2, Eye, X, FileCheck } from "lucide-react"
import { api, type AccountsReceivable, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG, formatDate, formatPercentage } from "../../utils/format"

type TabType = "documentos" | "aging"

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
}

export default function AccountsReceivablePage() {
  const [tab, setTab] = useState<TabType>("documentos")
  const [docs, setDocs] = useState<AccountsReceivable[]>([])
  const [aging, setAging] = useState<AgingData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("pendiente")
  
  // Modals state
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [customerInvoices, setCustomerInvoices] = useState<AccountsReceivable[]>([])
  const [loadingCustInvoices, setLoadingCustInvoices] = useState(false)
  
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)

  const [showReciboModal, setShowReciboModal] = useState(false)
  const [selectedReciboCustomer, setSelectedReciboCustomer] = useState<string>("")
  const [reciboInvoices, setReciboInvoices] = useState<AccountsReceivable[]>([])
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [montoCobrado, setMontoCobrado] = useState<string>("")
  const [medioPago, setMedioPago] = useState<string>("efectivo")
  const [referenciaPago, setReferenciaPago] = useState<string>("")
  const [submittingRecibo, setSubmittingRecibo] = useState(false)
  
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [docsData, agingData, summaryData, custsData] = await Promise.all([
        api.accountsReceivable.list({ estado: filterStatus }),
        api.accountsReceivable.aging(),
        api.accountsReceivable.summary(),
        api.customers.list({ activo: true }),
      ])
      setDocs(docsData)
      setAging(agingData)
      setSummary(summaryData)
      setCustomers(custsData)
    } catch {
      setDocs([])
      setAging(null)
      setSummary(null)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [filterStatus])

  // Handle opening customer invoices in Aging
  const handleOpenCustomerDetail = async (customerId: string) => {
    if (expandedCustomer === customerId) {
      setExpandedCustomer(null)
      return
    }
    setExpandedCustomer(customerId)
    setLoadingCustInvoices(true)
    try {
      const invoices = await api.accountsReceivable.list({ estado: "pendiente" })
      const filteredInvs = invoices.filter(i => i.customer_id === customerId)
      setCustomerInvoices(filteredInvs)
    } catch {
      setCustomerInvoices([])
    } finally {
      setLoadingCustInvoices(false)
    }
  }

  // Handle inspecting invoice detail
  const handleInspectInvoice = async (invoiceId: string) => {
    try {
      const detail = await api.accountsReceivable.documentDetail(invoiceId)
      setSelectedInvoice(detail)
    } catch {
      toast.error("Error", "No se pudo cargar el detalle de la factura")
    }
  }

  // Handle Customer Selection in Recibo Modal
  const handleSelectReciboCustomer = async (customerId: string) => {
    setSelectedReciboCustomer(customerId)
    setSelectedInvoiceIds([])
    if (!customerId) {
      setReciboInvoices([])
      return
    }
    try {
      const invoices = await api.accountsReceivable.list({ estado: "pendiente" })
      const filteredInvs = invoices.filter(i => i.customer_id === customerId)
      setReciboInvoices(filteredInvs)
      const totalPending = filteredInvs.reduce((sum, inv) => sum + (inv.saldo_pendiente || 0), 0)
      setMontoCobrado(totalPending.toString())
      setSelectedInvoiceIds(filteredInvs.map(i => i.id))
    } catch {
      setReciboInvoices([])
    }
  }

  // Submit Collection Receipt
  const handleEmitirRecibo = async () => {
    if (!selectedReciboCustomer || selectedInvoiceIds.length === 0 || !montoCobrado) {
      toast.error("Atención", "Seleccioná un cliente, al menos una factura y el monto a cobrar")
      return
    }
    setSubmittingRecibo(true)
    try {
      const res = await api.accountsReceivable.createReceipt({
        receivable_ids: selectedInvoiceIds,
        monto_pagado: parseFloat(montoCobrado),
        medio_pago: medioPago,
        referencia: referenciaPago,
      })
      toast.success("Recibo Emitido Exitosamente", `Recibo N° ${res.receipt_number} registrado`)
      setShowReciboModal(false)
      setSelectedReciboCustomer("")
      setReciboInvoices([])
      setSelectedInvoiceIds([])
      setMontoCobrado("")
      setReferenciaPago("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo emitir el recibo de cobranza")
    } finally {
      setSubmittingRecibo(false)
    }
  }

  const filtered = docs.filter(d =>
    !search || d.numero_documento?.toLowerCase().includes(search.toLowerCase()) ||
    d.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  const statusMap: Record<string, string> = {
    pendiente: "badge-warning",
    pagado: "badge-success",
    vencido: "badge-danger",
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ReceiptText className="w-6 h-6 text-primary" />Cuentas por Cobrar (AR)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{docs.length} documentos registrados en gestión activa</p>
        </div>
        <button onClick={() => setShowReciboModal(true)} className="btn-primary flex items-center gap-2 shadow-lg hover:shadow-xl transition-all">
          <FileCheck className="w-5 h-5" />
          <span>+ Emitir Recibo de Cobranza Oficial N°</span>
        </button>
      </div>

      {/* KPI Cards - Unified Financial Style */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card p-4 border-l-4 border-l-amber-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Total Pendiente</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-500">{formatPYG(summary?.total_pendiente || 0)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">{summary?.pendientes || 0} documentos pendientes</span>
        </div>

        <div className="card p-4 border-l-4 border-l-red-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Documentos Vencidos</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-xl font-bold font-mono text-red-600 dark:text-red-400">{summary?.vencidos || 0}</p>
          <span className="text-[10px] text-red-500/80 mt-1 block font-semibold">Con mora acumulada</span>
        </div>

        <div className="card p-4 border-l-4 border-l-red-600 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Monto Vencido</span>
            <Clock className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-xl font-bold font-mono text-red-600 dark:text-red-400">{formatPYG(summary?.monto_vencido || 0)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Exige acción de cobro</span>
        </div>

        <div className="card p-4 border-l-4 border-l-blue-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Documentos Totales</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{summary?.total || 0}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Histórico general</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(["documentos", "aging"] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-px ${tab === t ? "text-primary border-primary" : "text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            {t === "documentos" ? "Documentos Pendientes" : "Aging de Deuda (Por Cliente)"}
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
            <select className="input-field w-44 font-medium" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="pendiente">Solo Pendientes</option>
              <option value="todos">Todos (Inc. Pagados)</option>
              <option value="pagado">Solo Pagados</option>
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
                  <th className="table-cell text-right">Saldo Pendiente</th>
                  <th className="table-cell text-right">Días Mora</th>
                  <th className="table-cell">Estado</th>
                  <th className="table-cell text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">No se encontraron documentos</td></tr>
                ) : filtered.map(d => {
                  const overdue = (d.dias_mora || 0) > 0
                  return (
                    <tr key={d.id} className={`table-row ${overdue ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                      <td className="table-td font-mono text-xs font-bold text-primary">{d.numero_documento || "—"}</td>
                      <td className="table-td"><span className={`text-sm font-medium ${overdue ? "text-red-700 dark:text-red-300 font-bold" : ""}`}>{d.customer_name}</span></td>
                      <td className="table-td text-sm text-gray-500">{formatDate(d.fecha_emision)}</td>
                      <td className={`table-td text-sm ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : "—"}</td>
                      <td className="table-td text-right font-mono font-bold">{formatPYG(d.monto_original)}</td>
                      <td className={`table-td text-right font-mono font-bold ${(d.saldo_pendiente || 0) > 0 ? "text-amber-500" : "text-green-500"}`}>{formatPYG(d.saldo_pendiente)}</td>
                      <td className={`table-td text-right font-mono ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{(d.dias_mora || 0) > 0 ? `${d.dias_mora}d` : "Al día"}</td>
                      <td className="table-td"><StatusBadge status={d.estado || "-"} map={statusMap} /></td>
                      <td className="table-td text-center">
                        <button onClick={() => handleInspectInvoice(d.id)} className="btn-ghost p-1.5" title="Ver contenido completo de factura">
                          <Eye className="w-4 h-4 text-primary" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
              {/* Aging Buckets */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {aging.buckets.map(b => {
                  const barColor =
                    b.rango.toLowerCase().includes("al dia") || b.rango.toLowerCase().includes("al día") ? "bg-green-500" :
                    b.rango.includes("1-30") ? "bg-yellow-500" :
                    b.rango.includes("31-60") ? "bg-orange-500" :
                    b.rango.includes("61-90") ? "bg-red-500" : "bg-red-700"
                  return (
                    <div key={b.rango} className="card p-5 flex flex-col">
                      <span className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">{b.rango}</span>
                      <p className={`text-lg font-bold ${b.rango.toLowerCase().includes("al dia") || b.rango.toLowerCase().includes("al día") ? "text-green-500" : "text-red-500"}`}>{formatPYG(b.monto)}</p>
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
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Desglose Antigüedad de Deuda por Cliente</h3>
                  <span className="text-xs text-gray-400 font-medium">Hacé clic en el ojo para ver el detalle de facturas vencidas del cliente</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="table-header">
                      <th className="table-cell">Cliente</th>
                      <th className="table-cell text-right">Documentos</th>
                      <th className="table-cell text-right">Al día</th>
                      <th className="table-cell text-right">1-30 días</th>
                      <th className="table-cell text-right">31-60 días</th>
                      <th className="table-cell text-right">61-90 días</th>
                      <th className="table-cell text-right">+90 días</th>
                      <th className="table-cell text-right">Saldo Total</th>
                      <th className="table-cell text-center">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.por_clientes.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400">Sin clientes con saldo pendiente</td></tr>
                    ) : aging.por_clientes.map(c => {
                      return (
                        <tr key={c.customer_id} className="table-row hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="table-td font-medium text-gray-900 dark:text-white">{c.customer_name}</td>
                          <td className="table-td text-right font-mono font-bold">{c.total_documentos}</td>
                          <td className="table-td text-right font-mono text-green-600 font-bold">{formatPYG(c.current)}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_1_30 > 0 ? "#eab308" : undefined }}>{c.days_1_30 > 0 ? formatPYG(c.days_1_30) : "—"}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_31_60 > 0 ? "#f97316" : undefined }}>{c.days_31_60 > 0 ? formatPYG(c.days_31_60) : "—"}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_61_90 > 0 ? "#ef4444" : undefined }}>{c.days_61_90 > 0 ? formatPYG(c.days_61_90) : "—"}</td>
                          <td className="table-td text-right font-mono font-bold" style={{ color: c.days_91_plus > 0 ? "#b91c1c" : undefined }}>{c.days_91_plus > 0 ? formatPYG(c.days_91_plus) : "—"}</td>
                          <td className="table-td text-right font-mono font-bold text-amber-500">{formatPYG(c.saldo_total)}</td>
                          <td className="table-td text-center">
                            <button
                              className="btn-ghost p-1.5"
                              title="Ver facturas vencidas de este cliente"
                              onClick={() => handleOpenCustomerDetail(c.customer_id)}
                            >
                              <Eye className="w-4 h-4 text-primary" />
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

      {/* Customer Invoices Drilldown Modal */}
      {expandedCustomer && (
        <div className="modal-overlay" onClick={() => setExpandedCustomer(null)}>
          <div className="modal-content max-w-4xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Detalle Completo de Cartera del Cliente</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {aging?.por_clientes.find(c => c.customer_id === expandedCustomer)?.customer_name || "Cliente"}
                </h3>
              </div>
              <button onClick={() => setExpandedCustomer(null)} className="btn-ghost"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {loadingCustInvoices ? (
                <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
              ) : customerInvoices.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No se encontraron facturas pendientes para este cliente.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="table-header">
                        <th className="table-cell">N° Documento</th>
                        <th className="table-cell">Emisión</th>
                        <th className="table-cell">Vencimiento</th>
                        <th className="table-cell text-right">Monto Original</th>
                        <th className="table-cell text-right">Saldo Pendiente</th>
                        <th className="table-cell text-right">Días Mora</th>
                        <th className="table-cell text-center">Ver Factura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerInvoices.map(inv => {
                        const overdue = (inv.dias_mora || 0) > 0
                        return (
                          <tr key={inv.id} className={`table-row ${overdue ? "bg-red-50/60 dark:bg-red-900/20" : ""}`}>
                            <td className="table-td font-mono font-bold text-primary">{inv.numero_documento || "—"}</td>
                            <td className="table-td">{formatDate(inv.fecha_emision)}</td>
                            <td className={`table-td font-medium ${overdue ? "text-red-600 font-bold" : ""}`}>{formatDate(inv.fecha_vencimiento)}</td>
                            <td className="table-td text-right font-mono">{formatPYG(inv.monto_original)}</td>
                            <td className="table-td text-right font-mono font-bold text-amber-500">{formatPYG(inv.saldo_pendiente)}</td>
                            <td className={`table-td text-right font-mono ${overdue ? "text-red-600 font-bold" : ""}`}>
                              {overdue ? `${inv.dias_mora}d` : "Al día"}
                            </td>
                            <td className="table-td text-center">
                              <button onClick={() => handleInspectInvoice(inv.id)} className="btn-ghost p-1">
                                <Eye className="w-4 h-4 text-primary" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Full Content & Line Items Detail Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-content max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-900 text-white rounded-t-xl">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Comprobante Oficial DNIT / SIFEN</span>
                <h3 className="text-xl font-bold font-mono text-white mt-1">Factura N° {selectedInvoice.numero_documento || "—"}</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-6 text-xs">
              {/* Header Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-gray-400 uppercase font-black tracking-widest">Razon Social Cliente</span>
                  <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">{selectedInvoice.customer_name}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-black tracking-widest">RUC / CI</span>
                  <p className="font-mono font-bold text-sm text-gray-900 dark:text-white mt-0.5">{selectedInvoice.customer_ruc || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-black tracking-widest">Dirección</span>
                  <p className="font-medium text-gray-700 dark:text-gray-300 mt-0.5">{selectedInvoice.customer_direccion || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-black tracking-widest">Fecha Emisión</span>
                  <p className="font-medium text-gray-900 dark:text-white mt-0.5">{formatDate(selectedInvoice.fecha_emision)}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-black tracking-widest">Vencimiento</span>
                  <p className="font-medium text-red-500 mt-0.5">{formatDate(selectedInvoice.fecha_vencimiento)}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-black tracking-widest">Condición</span>
                  <p className="font-bold text-amber-500 mt-0.5">CRÉDITO</p>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h4 className="font-bold uppercase tracking-wider text-gray-500 mb-2">Detalle de Ítems / Productos</h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold">
                        <th className="p-3 text-left">Descripción Producto</th>
                        <th className="p-3 text-center">Cant.</th>
                        <th className="p-3 text-right">Precio Unit.</th>
                        <th className="p-3 text-center">IVA</th>
                        <th className="p-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {selectedInvoice.items?.map((item: any, idx: number) => (
                        <tr key={idx} className="table-row">
                          <td className="p-3 font-medium text-gray-900 dark:text-white">{item.descripcion}</td>
                          <td className="p-3 text-center font-mono">{item.cantidad}</td>
                          <td className="p-3 text-right font-mono">{formatPYG(item.precio_unitario)}</td>
                          <td className="p-3 text-center font-mono text-gray-500">{item.iva_tasa}%</td>
                          <td className="p-3 text-right font-mono font-bold">{formatPYG(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Footer */}
              <div className="flex flex-col sm:flex-row justify-between items-end gap-4 p-4 bg-gray-900 text-white rounded-lg">
                <div>
                  <p className="text-gray-400 text-xs">Liquidación IVA 10%: <span className="font-mono text-white font-bold">{formatPYG((selectedInvoice.monto_original || 0) / 11)}</span></p>
                  <p className="text-gray-400 text-xs mt-0.5">Saldo Pendiente a Cobrar: <span className="font-mono text-amber-400 font-bold">{formatPYG(selectedInvoice.saldo_pendiente)}</span></p>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase font-black text-gray-400 tracking-widest">Monto Total Factura</span>
                  <p className="text-2xl font-bold font-mono text-emerald-400">{formatPYG(selectedInvoice.monto_original)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recibo de Cobranza Modal */}
      {showReciboModal && (
        <div className="modal-overlay" onClick={() => setShowReciboModal(false)}>
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-primary/10">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-primary" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Emitir Recibo de Cobranza Oficial N°</h3>
              </div>
              <button onClick={() => setShowReciboModal(false)} className="btn-ghost"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">1. Seleccionar Cliente</label>
                <select
                  className="input-field font-medium text-sm"
                  value={selectedReciboCustomer}
                  onChange={(e) => handleSelectReciboCustomer(e.target.value)}
                >
                  <option value="">-- Seleccionar cliente con deuda --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.razon_social} ({c.ruc || "Sin RUC"})</option>
                  ))}
                </select>
              </div>

              {selectedReciboCustomer && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">2. Facturas Pendientes a Cobrar</label>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                      {reciboInvoices.length === 0 ? (
                        <p className="p-4 text-center text-gray-400">Este cliente no posee facturas pendientes.</p>
                      ) : reciboInvoices.map(inv => (
                        <label key={inv.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedInvoiceIds.includes(inv.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedInvoiceIds([...selectedInvoiceIds, inv.id])
                                else setSelectedInvoiceIds(selectedInvoiceIds.filter(id => id !== inv.id))
                              }}
                              className="rounded text-primary focus:ring-primary w-4 h-4"
                            />
                            <div>
                              <p className="font-mono font-bold text-gray-900 dark:text-white">{inv.numero_documento || "Factura"}</p>
                              <p className="text-gray-400 text-[10px]">Vence: {formatDate(inv.fecha_vencimiento)}</p>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-amber-500">{formatPYG(inv.saldo_pendiente)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">3. Monto Recibido (₲)</label>
                      <input
                        type="number"
                        className="input-field font-mono font-bold text-lg text-emerald-600"
                        value={montoCobrado}
                        onChange={(e) => setMontoCobrado(e.target.value)}
                        placeholder="Monto total a cobrar"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">4. Medio de Cobro</label>
                      <select className="input-field font-medium" value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                        <option value="efectivo">Efectivo en Caja</option>
                        <option value="cheque_diferido">Cheque Diferido / Al día</option>
                        <option value="transferencia">Transferencia Bancaria SPI</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">N° de Boleta / Cheque / Ref</label>
                    <input
                      className="input-field font-mono"
                      value={referenciaPago}
                      onChange={(e) => setReferenciaPago(e.target.value)}
                      placeholder="Ej. Cheque N° 881231 o Ref Transf SPI 9012"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => setShowReciboModal(false)} className="btn-secondary">Cancelar</button>
                    <button onClick={handleEmitirRecibo} disabled={submittingRecibo} className="btn-primary flex items-center gap-2">
                      {submittingRecibo ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                      <span>Emitir Recibo de Cobranza</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}