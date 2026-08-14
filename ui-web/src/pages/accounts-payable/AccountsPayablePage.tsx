import { useState, useEffect } from "react"
import { Search, HandCoins, Clock, AlertTriangle, DollarSign, FileText, Loader2, Eye, X, FileCheck, CheckCircle2, Building2, RefreshCw } from "lucide-react"
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
      const [docsData, agingData, summaryData] = await Promise.all([
        api.accountsPayable.list({ estado: filterStatus }).catch(() => []),
        api.accountsPayable.aging().catch(() => null),
        api.accountsPayable.summary().catch(() => null),
      ])
      setDocs(Array.isArray(docsData) ? docsData : [])
      setAging(agingData)
      setSummary(summaryData)
    } catch {
      // safe fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filterStatus])

  // Lazy load suppliers when payment modal opens
  useEffect(() => {
    if (showPaymentModal && suppliers.length === 0) {
      api.suppliers.list({ activo: true })
        .then(res => setSuppliers(Array.isArray(res) ? res : []))
        .catch(() => setSuppliers([]))
    }
  }, [showPaymentModal])

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
      setSupplierInvoices(Array.isArray(invoices) ? invoices : [])
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
      const safeInvoices = Array.isArray(invoices) ? invoices : []
      setPaymentInvoices(safeInvoices)
      const totalPending = safeInvoices.reduce((sum, inv) => sum + (inv.saldo_pendiente || 0), 0)
      setMontoPagado(totalPending.toString())
      setSelectedInvoiceIds(safeInvoices.map(i => i.id))
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
    !search ||
    d.numero_factura?.toLowerCase().includes(search.toLowerCase()) ||
    (d.supplier_name && d.supplier_name.toLowerCase().includes(search.toLowerCase())) ||
    (d.supplier_ruc && d.supplier_ruc.toLowerCase().includes(search.toLowerCase()))
  )

  const statusMap: Record<string, string> = {
    pendiente: "badge-warning",
    pagado: "badge-success",
    pagada: "badge-success",
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
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>
          <button onClick={() => setShowPaymentModal(true)} className="btn-primary flex items-center gap-2 shadow-lg hover:shadow-xl transition-all text-xs">
            <FileCheck className="w-4 h-4" />
            <span>+ Emitir Orden de Pago</span>
          </button>
        </div>
      </div>

      {/* KPI Cards - Unified Financial Style */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card p-4 border-l-4 border-l-amber-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Total Pendiente Proveedores</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-500">{formatPYG(summary?.total_pendiente || 0)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">{summary?.pendientes || 0} facturas pendientes</span>
        </div>

        <div className="card p-4 border-l-4 border-l-red-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Facturas Vencidas</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-xl font-bold font-mono text-red-600 dark:text-red-400">{summary?.vencidos || 0}</p>
          <span className="text-[10px] text-red-500/80 mt-1 block font-semibold">Exigen pago inmediato</span>
        </div>

        <div className="card p-4 border-l-4 border-l-red-600 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Monto Vencido Exigible</span>
            <Clock className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-xl font-bold font-mono text-red-600 dark:text-red-400">{formatPYG(summary?.monto_vencido || 0)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Deuda vencida acumulada</span>
        </div>

        <div className="card p-4 border-l-4 border-l-blue-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Facturas Históricas</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{summary?.total || 0}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Total compras registradas</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(["documentos", "aging"] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px ${tab === t ? "text-primary border-primary" : "text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            {t === "documentos" ? "Facturas de Proveedores con Deuda" : "Aging AP de Deuda (Por Proveedor)"}
          </button>
        ))}
      </div>

      {/* Documentos Tab */}
      {tab === "documentos" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10 text-xs" placeholder="Buscar por número de factura o proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input-field w-44 font-medium text-xs" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="pendiente">Solo Pendientes con Deuda</option>
              <option value="todos">Todas las Facturas</option>
              <option value="pagado">Solo Pagadas</option>
            </select>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-xs">
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
                  <tr><td colSpan={9} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /><span className="text-xs text-gray-400 mt-2 block">Cargando obligaciones con proveedores...</span></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">No se encontraron facturas de proveedores</td></tr>
                ) : filtered.map(d => {
                  const overdue = (d.dias_mora || 0) > 0
                  return (
                    <tr key={d.id} className={`table-row ${overdue ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                      <td className="table-td font-mono text-xs font-bold text-primary">{d.numero_factura || "—"}</td>
                      <td className="table-td">
                        <span className={`text-xs font-medium ${overdue ? "text-red-700 dark:text-red-300 font-bold" : ""}`}>{d.supplier_name || "Proveedor sin nombre"}</span>
                        <div className="text-[11px] text-gray-400 font-mono">RUC: {d.supplier_ruc || "Sin RUC"}</div>
                      </td>
                      <td className="table-td text-gray-500 font-mono">{formatDate(d.fecha_emision)}</td>
                      <td className={`table-td font-mono ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : "—"}</td>
                      <td className="table-td text-right font-mono font-bold">{formatPYG(d.monto_original)}</td>
                      <td className={`table-td text-right font-mono font-bold ${(d.saldo_pendiente || 0) > 0 ? "text-amber-500" : "text-green-500"}`}>{formatPYG(d.saldo_pendiente)}</td>
                      <td className={`table-td text-right font-mono ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{(d.dias_mora || 0) > 0 ? `${d.dias_mora}d` : "Al día"}</td>
                      <td className="table-td"><StatusBadge status={d.estado || "-"} map={statusMap} /></td>
                      <td className="table-td text-center">
                        <button onClick={() => handleInspectInvoice(d.id)} className="btn-ghost p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Ver contenido de factura proveedor">
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
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
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
                    <div key={b.rango} className="card p-4 flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{b.rango}</span>
                      <p className={`text-base font-bold font-mono ${b.rango.toLowerCase().includes("al dia") || b.rango.toLowerCase().includes("al día") ? "text-green-500" : "text-red-500"}`}>{formatPYG(b.monto)}</p>
                      <p className="text-[11px] text-gray-400 mb-2">{b.cantidad} docs · {formatPercentage(b.porcentaje || 0)}</p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-auto">
                        <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(b.porcentaje || 0, 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Supplier Breakdown */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Desglose Antigüedad de Deuda por Proveedor</h3>
                  <span className="text-[11px] text-gray-400 font-medium">Hacé clic en el ojo para ver las facturas del proveedor</span>
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
                      <th className="table-cell text-right font-black">Saldo Total AP</th>
                      <th className="table-cell text-center">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!aging.por_proveedores || aging.por_proveedores.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400">Sin proveedores con saldo pendiente</td></tr>
                    ) : aging.por_proveedores.map(c => {
                      return (
                        <tr key={c.supplier_id} className="table-row hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="table-td font-medium text-gray-900 dark:text-white">{c.supplier_name || "Proveedor"}</td>
                          <td className="table-td text-right font-mono font-bold">{c.total_documentos}</td>
                          <td className="table-td text-right font-mono text-green-600 font-bold">{formatPYG(c.current)}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_1_30 > 0 ? "#eab308" : undefined }}>{c.days_1_30 > 0 ? formatPYG(c.days_1_30) : "—"}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_31_60 > 0 ? "#f97316" : undefined }}>{c.days_31_60 > 0 ? formatPYG(c.days_31_60) : "—"}</td>
                          <td className="table-td text-right font-mono" style={{ color: c.days_61_90 > 0 ? "#ef4444" : undefined }}>{c.days_61_90 > 0 ? formatPYG(c.days_61_90) : "—"}</td>
                          <td className="table-td text-right font-mono font-bold" style={{ color: c.days_91_plus > 0 ? "#b91c1c" : undefined }}>{c.days_91_plus > 0 ? formatPYG(c.days_91_plus) : "—"}</td>
                          <td className="table-td text-right font-mono font-bold text-amber-500 bg-amber-50/30 dark:bg-amber-950/20">{formatPYG(c.saldo_total)}</td>
                          <td className="table-td text-center">
                            <button
                              className="btn-ghost p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
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
                            <td className="table-td font-mono text-gray-500">{formatDate(inv.fecha_emision)}</td>
                            <td className={`table-td font-mono ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{inv.fecha_vencimiento ? formatDate(inv.fecha_vencimiento) : "—"}</td>
                            <td className="table-td text-right font-mono">{formatPYG(inv.monto_original)}</td>
                            <td className="table-td text-right font-mono font-bold text-amber-500">{formatPYG(inv.saldo_pendiente)}</td>
                            <td className={`table-td text-right font-mono ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}>{overdue ? `${inv.dias_mora}d` : "Al día"}</td>
                            <td className="table-td text-center">
                              <button onClick={() => handleInspectInvoice(inv.id)} className="btn-ghost p-1">
                                <Eye className="w-3.5 h-3.5 text-primary" />
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

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-content max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Comprobante de Proveedor</span>
                <h3 className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
                  Factura N° {selectedInvoice.numero_factura}
                </h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="btn-ghost"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Proveedor</span>
                  <p className="font-bold text-gray-900 dark:text-white">{selectedInvoice.supplier_name}</p>
                  <p className="font-mono text-gray-500">RUC: {selectedInvoice.supplier_ruc || "Sin RUC"}</p>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Emisión / Vencimiento</span>
                  <p className="font-mono text-gray-900 dark:text-white">{formatDate(selectedInvoice.fecha_emision)} ➔ {formatDate(selectedInvoice.fecha_vencimiento)}</p>
                  <p className="font-bold text-amber-500 mt-1">Saldo: {formatPYG(selectedInvoice.saldo_pendiente)}</p>
                </div>
              </div>

              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mt-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="table-header">
                        <th className="table-cell">Ítem</th>
                        <th className="table-cell text-right">Cant.</th>
                        <th className="table-cell text-right">Precio Unit.</th>
                        <th className="table-cell text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items.map((it: any, idx: number) => (
                        <tr key={idx} className="table-row">
                          <td className="table-td">{it.descripcion || "Mercadería"}</td>
                          <td className="table-td text-right font-mono">{it.cantidad}</td>
                          <td className="table-td text-right font-mono">{formatPYG(it.precio_unitario)}</td>
                          <td className="table-td text-right font-mono font-bold">{formatPYG(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Order Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-900 text-white rounded-t-xl">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Tesorería & Pagos</span>
                <h3 className="text-xl font-bold text-white mt-1">Emitir Orden de Pago a Proveedor</h3>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Seleccionar Proveedor</label>
                <select
                  value={selectedPaymentSupplier}
                  onChange={(e) => handleSelectPaymentSupplier(e.target.value)}
                  className="input-field w-full text-xs font-medium"
                >
                  <option value="">-- Elegí un proveedor --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.razon_social} {s.ruc ? `(${s.ruc})` : ""}</option>
                  ))}
                </select>
              </div>

              {paymentInvoices.length > 0 && (
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-2">Facturas Pendientes a Aplicar</label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="table-header">
                          <th className="table-cell">Sel.</th>
                          <th className="table-cell">N° Factura</th>
                          <th className="table-cell">Vencimiento</th>
                          <th className="table-cell text-right">Saldo Pendiente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentInvoices.map(inv => (
                          <tr key={inv.id} className="table-row">
                            <td className="table-td">
                              <input
                                type="checkbox"
                                checked={selectedInvoiceIds.includes(inv.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedInvoiceIds([...selectedInvoiceIds, inv.id])
                                  else setSelectedInvoiceIds(selectedInvoiceIds.filter(id => id !== inv.id))
                                }}
                              />
                            </td>
                            <td className="table-td font-mono font-bold">{inv.numero_factura}</td>
                            <td className="table-td font-mono">{formatDate(inv.fecha_vencimiento)}</td>
                            <td className="table-td text-right font-mono font-bold text-amber-500">{formatPYG(inv.saldo_pendiente)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Monto a Pagar (₲)</label>
                  <input
                    type="number"
                    value={montoPagado}
                    onChange={(e) => setMontoPagado(e.target.value)}
                    className="input-field w-full font-mono text-sm font-bold"
                    placeholder="Monto total del pago"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Medio de Pago</label>
                  <select
                    value={medioPago}
                    onChange={(e) => setMedioPago(e.target.value)}
                    className="input-field w-full font-medium"
                  >
                    <option value="transferencia">Transferencia Bancaria (SIPAP / SPI)</option>
                    <option value="cheque">Cheque Propio</option>
                    <option value="efectivo">Efectivo (Caja Chica)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Referencia / N° Comprobante Bancario</label>
                <input
                  type="text"
                  value={referenciaPago}
                  onChange={(e) => setReferenciaPago(e.target.value)}
                  className="input-field w-full"
                  placeholder="Ej: Transf. 981240 / Cheque N° 004812"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowPaymentModal(false)} className="btn-ghost">Cancelar</button>
                <button
                  onClick={handleEmitirOrdenPago}
                  disabled={submittingPayment}
                  className="btn-primary flex items-center gap-2"
                >
                  {submittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Confirmar y Emitir Orden de Pago</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
