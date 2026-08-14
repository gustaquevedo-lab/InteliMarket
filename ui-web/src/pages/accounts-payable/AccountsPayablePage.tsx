import { useState, useEffect } from "react"
import { Search, HandCoins, Clock, AlertTriangle, DollarSign, FileText, Loader2, Eye, X, FileCheck, CheckCircle2, Building2 } from "lucide-react"
import { api, type Supplier } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG, formatDate, formatPercentage } from "../../utils/format"

type TabType = "documentos" | "aging"

interface AccountsPayableDoc {
  id: string
  company_id: string
  supplier_id: string
  supplier_name: string
  supplier_ruc: string | null
  numero_factura: string
  timbrado: string | null
  cdc: string | null
  fecha_emision: string
  fecha_vencimiento: string
  moneda: string
  monto_original: number
  saldo_pendiente: number
  condicion: string | null
  estado: string
  concepto: string | null
  dias_mora: number
}

interface APAgingData {
  total_pendiente: number
  cantidad_documentos: number
  buckets: { rango: string; monto: number; cantidad: number; porcentaje: number }[]
  por_proveedores: {
    supplier_id: string
    supplier_name: string
    saldo_total: number
    current: number
    days_1_30: number
    days_31_60: number
    days_61_90: number
    days_91_plus: number
    total_documentos: number
  }[]
}

interface APSummaryData {
  total: number
  monto_total_historico: number
  total_pendiente: number
  pagados: number
  pendientes: number
  vencidos: number
  monto_vencido: number
}

export default function AccountsPayablePage() {
  const [tab, setTab] = useState<TabType>("documentos")
  const [docs, setDocs] = useState<AccountsPayableDoc[]>([])
  const [aging, setAging] = useState<APAgingData | null>(null)
  const [summary, setSummary] = useState<APSummaryData | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("pendiente")
  
  // Modals state
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)
  const [supplierInvoices, setSupplierInvoices] = useState<AccountsPayableDoc[]>([])
  const [loadingSuppInvoices, setLoadingSuppInvoices] = useState(false)
  
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentSupplier, setSelectedPaymentSupplier] = useState<string>("")
  const [paymentInvoices, setPaymentInvoices] = useState<AccountsPayableDoc[]>([])
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [montoPagado, setMontoPagado] = useState<string>("")
  const [medioPago, setMedioPago] = useState<string>("transferencia")
  const [referenciaPago, setReferenciaPago] = useState<string>("")
  const [submittingPayment, setSubmittingPayment] = useState(false)
  
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [docsData, agingData, summaryData, suppsData] = await Promise.all([
        api.accountsPayable.list({ estado: filterStatus }),
        api.accountsPayable.aging(),
        api.accountsPayable.summary(),
        api.suppliers.list({ activo: true }),
      ])
      setDocs(docsData)
      setAging(agingData)
      setSummary(summaryData)
      setSuppliers(suppsData)
    } catch {
      setDocs([])
      setAging(null)
      setSummary(null)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [filterStatus])

  // Handle opening supplier invoices in Aging
  const handleOpenSupplierDetail = async (supplierId: string) => {
    if (expandedSupplier === supplierId) {
      setExpandedSupplier(null)
      return
    }
    setExpandedSupplier(supplierId)
    setLoadingSuppInvoices(true)
    try {
      const invoices = await api.accountsPayable.list({ estado: "pendiente", supplier_id: supplierId })
      setSupplierInvoices(invoices)
    } catch {
      setSupplierInvoices([])
    } finally {
      setLoadingSuppInvoices(false)
    }
  }

  // Handle inspecting invoice detail
  const handleInspectInvoice = async (invoiceId: string) => {
    try {
      const detail = await api.accountsPayable.documentDetail(invoiceId)
      setSelectedInvoice(detail)
    } catch {
      toast.error("Error", "No se pudo cargar el detalle de la factura de proveedor")
    }
  }

  // Handle Supplier Selection in Payment Order Modal
  const handleSelectPaymentSupplier = async (supplierId: string) => {
    setSelectedPaymentSupplier(supplierId)
    setSelectedInvoiceIds([])
    if (!supplierId) {
      setPaymentInvoices([])
      return
    }
    try {
      const invoices = await api.accountsPayable.list({ estado: "pendiente", supplier_id: supplierId })
      setPaymentInvoices(invoices)
      const totalPending = invoices.reduce((sum, inv) => sum + (inv.saldo_pendiente || 0), 0)
      setMontoPagado(totalPending.toString())
      setSelectedInvoiceIds(invoices.map(i => i.id))
    } catch {
      setPaymentInvoices([])
    }
  }

  // Submit Payment Order
  const handleEmitirOrdenPago = async () => {
    if (!selectedPaymentSupplier || selectedInvoiceIds.length === 0 || !montoPagado) {
      toast.error("Atención", "Seleccioná un proveedor, al menos una factura y el monto a pagar")
      return
    }
    setSubmittingPayment(true)
    try {
      const res = await api.accountsPayable.createPaymentOrder({
        invoice_ids: selectedInvoiceIds,
        monto_pagado: parseFloat(montoPagado),
        medio_pago: medioPago,
        referencia: referenciaPago,
      })
      toast.success("Orden de Pago Emitida Exitosamente", `Orden N° ${res.payment_order_number} registrada`)
      setShowPaymentModal(false)
      setSelectedPaymentSupplier("")
      setPaymentInvoices([])
      setSelectedInvoiceIds([])
      setMontoPagado("")
      setReferenciaPago("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo emitir la orden de pago")
    } finally {
      setSubmittingPayment(false)
    }
  }

  const filtered = docs.filter(d =>
    !search || d.numero_factura?.toLowerCase().includes(search.toLowerCase()) ||
    d.supplier_name?.toLowerCase().includes(search.toLowerCase())
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-primary" />Cuentas por Pagar (AP)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestión de obligaciones con proveedores y órdenes de pago
          </p>
        </div>
        <button onClick={() => setShowPaymentModal(true)} className="btn-primary flex items-center gap-2 shadow-lg hover:shadow-xl transition-all">
          <FileCheck className="w-5 h-5" />
          <span>+ Emitir Orden de Pago a Proveedor</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-5 border-l-4 border-amber-500">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Pendiente Proveedores</span>
          </div>
          <p className="text-[20px] font-bold text-amber-500 font-mono">{formatPYG(summary?.total_pendiente || 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{summary?.pendientes || 0} facturas pendientes</p>
        </div>

        <div className="card p-5 border-l-4 border-red-500">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Facturas Vencidas</span>
          </div>
          <p className="text-[20px] font-bold text-red-500 font-mono">{summary?.vencidos || 0}</p>
          <p className="text-xs text-red-400 mt-1">Exigen pago inmediato</p>
        </div>

        <div className="card p-5 border-l-4 border-red-600">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-red-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monto Vencido Exigible</span>
          </div>
          <p className="text-[20px] font-bold text-red-600 font-mono">{formatPYG(summary?.monto_vencido || 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Deuda vencida acumulada</p>
        </div>

        <div className="card p-5 border-l-4 border-blue-500">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Facturas Históricas</span>
          </div>
          <p className="text-[20px] font-bold text-blue-500 font-mono">{summary?.total || 0}</p>
          <p className="text-xs text-gray-400 mt-1">Total compras registradas</p>
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
            {t === "documentos" ? "Facturas de Proveedores Pendientes" : "Aging AP de Deuda (Por Proveedor)"}
          </button>
        ))}
      </div>

      {/* Documentos Tab */}
      {tab === "documentos" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar por número de factura o proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <th className="table-cell">Nro Factura</th>
                  <th className="table-cell">Proveedor</th>
                  <th className="table-cell">Emisión</th>
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
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">No se encontraron facturas de proveedores</td></tr>
                ) : filtered.map(d => {
                  const overdue = (d.dias_mora || 0) > 0
                  return (
                    <tr key={d.id} className={`table-row ${overdue ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                      <td className="table-td font-mono text-xs font-bold text-primary">{d.numero_factura || "—"}</td>
                      <td className="table-td">
                        <span className={`text-sm font-medium ${overdue ? "text-red-700 dark:text-red-300 font-bold" : ""}`}>{d.supplier_name}</span>
                        <div className="text-[11px] text-gray-400 font-mono">RUC: {d.supplier_ruc || "Sin RUC"}</div>
                      </td>
                      <td className="table-td text-sm text-gray-500">{formatDate(d.fecha_emision)}</td>
                      <td className={`table-td text-sm ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : "—"}</td>
                      <td className="table-td text-right font-mono font-bold">{formatPYG(d.monto_original)}</td>
                      <td className={`table-td text-right font-mono font-bold ${(d.saldo_pendiente || 0) > 0 ? "text-amber-500" : "text-green-500"}`}>{formatPYG(d.saldo_pendiente)}</td>
                      <td className={`table-td text-right font-mono ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{(d.dias_mora || 0) > 0 ? `${d.dias_mora}d` : "Al día"}</td>
                      <td className="table-td"><StatusBadge status={d.estado || "-"} map={statusMap} /></td>
                      <td className="table-td text-center">
                        <button onClick={() => handleInspectInvoice(d.id)} className="btn-ghost p-1.5" title="Ver contenido de factura proveedor">
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

              {/* Supplier Breakdown */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Desglose Antigüedad de Deuda por Proveedor</h3>
                  <span className="text-xs text-gray-400 font-medium">Hacé clic en el ojo para ver las facturas del proveedor</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="table-header">
                      <th className="table-cell">Proveedor</th>
                      <th className="table-cell text-right">Documentos</th>
                      <th className="table-cell text-right">Al día</th>
                      <th className="table-cell text-right">1-30 días</th>
                      <th className="table-cell text-right">31-60 días</th>
                      <th className="table-cell text-right">61-90 días</th>
                      <th className="table-cell text-right">+90 días</th>
                      <th className="table-cell text-right">Saldo Total AP</th>
                      <th className="table-cell text-center">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.por_proveedores.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400">Sin proveedores con saldo pendiente</td></tr>
                    ) : aging.por_proveedores.map(c => {
                      return (
                        <tr key={c.supplier_id} className="table-row hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="table-td font-medium text-gray-900 dark:text-white">{c.supplier_name}</td>
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
                              title="Ver facturas de este proveedor"
                              onClick={() => handleOpenSupplierDetail(c.supplier_id)}
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
            <div className="text-center py-12 text-gray-400">No hay datos de aging AP disponibles</div>
          )}
        </div>
      )}

      {/* Supplier Invoices Drilldown Modal */}
      {expandedSupplier && (
        <div className="modal-overlay" onClick={() => setExpandedSupplier(null)}>
          <div className="modal-content max-w-4xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Detalle de Facturas Pendientes del Proveedor</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {aging?.por_proveedores.find(c => c.supplier_id === expandedSupplier)?.supplier_name || "Proveedor"}
                </h3>
              </div>
              <button onClick={() => setExpandedSupplier(null)} className="btn-ghost"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {loadingSuppInvoices ? (
                <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
              ) : supplierInvoices.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No se encontraron facturas pendientes para este proveedor.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="table-header">
                        <th className="table-cell">N° Factura</th>
                        <th className="table-cell">Emisión</th>
                        <th className="table-cell">Vencimiento</th>
                        <th className="table-cell text-right">Monto Original</th>
                        <th className="table-cell text-right">Saldo Pendiente</th>
                        <th className="table-cell text-right">Días Mora</th>
                        <th className="table-cell text-center">Ver Factura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierInvoices.map(inv => {
                        const overdue = (inv.dias_mora || 0) > 0
                        return (
                          <tr key={inv.id} className={`table-row ${overdue ? "bg-red-50/60 dark:bg-red-900/20" : ""}`}>
                            <td className="table-td font-mono font-bold text-primary">{inv.numero_factura || "—"}</td>
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

      {/* Supplier Invoice Full Detail Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-content max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-900 text-white rounded-t-xl">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Factura de Compra de Proveedor</span>
                <h3 className="text-xl font-bold font-mono text-white mt-1">Factura N° {selectedInvoice.numero_factura || "—"}</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-6 text-xs">
              {/* Header Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-gray-400 uppercase font-black tracking-widest">Proveedor</span>
                  <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">{selectedInvoice.supplier_name}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-black tracking-widest">RUC</span>
                  <p className="font-mono font-bold text-sm text-gray-900 dark:text-white mt-0.5">{selectedInvoice.supplier_ruc || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-black tracking-widest">Timbrado / CDC</span>
                  <p className="font-mono text-gray-700 dark:text-gray-300 mt-0.5">{selectedInvoice.timbrado || selectedInvoice.cdc || "—"}</p>
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
                  <p className="font-bold text-amber-500 mt-0.5">{selectedInvoice.condicion || "CRÉDITO"}</p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold uppercase tracking-wider text-gray-500 mb-2">Detalle de Conceptos / Mercaderías</h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold">
                        <th className="p-3 text-left">Descripción Concepto</th>
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
                  <p className="text-gray-400 text-xs mt-0.5">Saldo Pendiente a Pagar: <span className="font-mono text-amber-400 font-bold">{formatPYG(selectedInvoice.saldo_pendiente)}</span></p>
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

      {/* Orden de Pago Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-primary/10">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-primary" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Emitir Orden de Pago a Proveedor N°</h3>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="btn-ghost"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">1. Seleccionar Proveedor</label>
                <select
                  className="input-field font-medium text-sm"
                  value={selectedPaymentSupplier}
                  onChange={(e) => handleSelectPaymentSupplier(e.target.value)}
                >
                  <option value="">-- Seleccionar proveedor con facturas pendientes --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.razon_social} ({s.ruc || "Sin RUC"})</option>
                  ))}
                </select>
              </div>

              {selectedPaymentSupplier && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">2. Facturas Pendientes a Cancelar</label>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                      {paymentInvoices.length === 0 ? (
                        <p className="p-4 text-center text-gray-400">Este proveedor no posee facturas pendientes.</p>
                      ) : paymentInvoices.map(inv => (
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
                              <p className="font-mono font-bold text-gray-900 dark:text-white">{inv.numero_factura || "Factura"}</p>
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
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">3. Monto a Pagar (₲)</label>
                      <input
                        type="number"
                        className="input-field font-mono font-bold text-lg text-emerald-600"
                        value={montoPagado}
                        onChange={(e) => setMontoPagado(e.target.value)}
                        placeholder="Monto total a transferir"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">4. Medio de Pago</label>
                      <select className="input-field font-medium" value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                        <option value="transferencia">Transferencia Bancaria SPI</option>
                        <option value="cheque_diferido">Cheque Propio Diferido / Al día</option>
                        <option value="efectivo">Efectivo de Caja</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">N° de Transferencia SPI / Cheque / Ref</label>
                    <input
                      className="input-field font-mono"
                      value={referenciaPago}
                      onChange={(e) => setReferenciaPago(e.target.value)}
                      placeholder="Ej. SPI N° 991823 o Cheque Propio N° 00412"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => setShowPaymentModal(false)} className="btn-secondary">Cancelar</button>
                    <button onClick={handleEmitirOrdenPago} disabled={submittingPayment} className="btn-primary flex items-center gap-2">
                      {submittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                      <span>Emitir Orden de Pago</span>
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
