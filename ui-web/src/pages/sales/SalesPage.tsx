import { useState, useEffect } from "react"
import { Search, ShoppingCart, TrendingUp, Eye, Loader2, FileDown, Download, Filter, X, DollarSign, CreditCard, Link2, Plus, RotateCcw, MessageCircle, Send } from "lucide-react"
import { api, type Sale, type PaymentMethod } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { StatusBadge } from "../../components/DataTable"
import { Modal } from "../../components/Modal"
import { formatPYG, formatDate } from "../../utils/format"

type TabType = "todas" | "pendientes" | "pagadas" | "canceladas"

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [tab, setTab] = useState<TabType>("todas")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(true)
  const [viewingSale, setViewingSale] = useState<Sale | null>(null)
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [waMessage, setWaMessage] = useState("")
  const [waSending, setWaSending] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [paymentModal, setPaymentModal] = useState<Sale | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("")
  const [payRef, setPayRef] = useState("")
  const [paying, setPaying] = useState(false)
  const [linkModal, setLinkModal] = useState<{ sale: Sale; type: "quote" | "order" } | null>(null)
  const [linkId, setLinkId] = useState("")
  const toast = useToast()
  const confirm = useConfirm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await api.sales.list({
        desde: dateFrom || undefined,
        hasta: dateTo || undefined,
      })
      setSales(data)
    } catch { setSales([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = sales.filter(s => {
    if (tab === "pendientes") { if (s.estado !== "confirmado" && s.estado !== "parcial" && s.estado !== "pendiente") return false }
    if (tab === "pagadas") { if (s.estado !== "pagado" && s.estado !== "completado") return false }
    if (tab === "canceladas") { if (s.estado !== "cancelado" && s.estado !== "devuelto") return false }
    if (search && !(s.numero ?? "").toLowerCase().includes(search.toLowerCase()) && !(s.customer?.razon_social || "").toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const active = sales.filter(s => s.estado !== "cancelado" && s.estado !== "devuelto")
  const totalVentas = active.reduce((a, b) => a + (b.total ?? 0), 0)
  const totalCobrado = active.reduce((a, b) => a + (b.total_pagado || 0), 0)
  const totalSaldo = active.reduce((a, b) => a + (b.saldo || 0), 0)
  const totalIva = active.reduce((a, b) => a + (b.iva_10 || 0) + (b.iva_5 || 0), 0)

  const handleViewSale = async (sale: Sale) => {
    setViewingSale(sale)
    try { setSaleItems(await api.sales.getItems(sale.id)) }
    catch { setSaleItems([]) }
  }

  const handleCancelSale = async (sale: Sale) => {
    const ok = await confirm({ title: "¿Anular venta?", message: `Se revertirá el stock de la venta ${sale.numero}` })
    if (!ok) return
    try {
      await api.sales.cancel(sale.id)
      toast.success("Anulada", `Venta ${sale.numero} anulada`)
      fetchData()
    } catch { toast.error("Error", "No se pudo anular la venta") }
  }

  const openPaymentModal = async (sale: Sale) => {
    setPaymentModal(sale)
    setPayAmount(String(sale.saldo || sale.total))
    setPayMethod("")
    setPayRef("")
      try { setPaymentMethods(await api.paymentMethods.list()) }
    catch { setPaymentMethods([]) }
  }

  const handleAddPayment = async () => {
    if (!paymentModal || !payMethod || !payAmount) return
    setPaying(true)
    try {
      await api.sales.addPayment(paymentModal.id, {
        payment_method_id: payMethod,
        monto: Number(payAmount),
        referencia: payRef || undefined,
      })
      toast.success("Pago registrado", `Gs ${formatPYG(Number(payAmount))} aplicado a ${paymentModal.numero}`)
      setPaymentModal(null)
      fetchData()
    } catch { toast.error("Error", "No se pudo registrar el pago") }
    finally { setPaying(false) }
  }

  const openLinkModal = (sale: Sale, type: "quote" | "order") => {
    setLinkModal({ sale, type })
    setLinkId("")
  }

  const handleLink = async () => {
    if (!linkModal || !linkId) return
    try {
      if (linkModal.type === "quote") {
        await api.sales.linkQuote(linkModal.sale.id, linkId)
        toast.success("Vinculada", "Cotización vinculada a la venta")
      } else {
        await api.sales.linkOrder(linkModal.sale.id, linkId)
        toast.success("Vinculado", "Pedido vinculado a la venta")
      }
      setLinkModal(null)
      fetchData()
    } catch { toast.error("Error", "No se pudo vincular") }
  }

  const handleExportCSV = () => {
    const headers = "Número,Fecha,Cliente,RUC,Condición,Estado,Subtotal,IVA 10%,IVA 5%,Total,Pagado,Saldo\n"
    const rows = filtered.map(s =>
      `${s.numero},${s.fecha},${s.customer?.razon_social || "CF"},${s.customer?.ruc || ""},${s.condicion},${s.estado},${s.subtotal},${s.iva_10 || 0},${s.iva_5 || 0},${s.total},${s.total_pagado || 0},${s.saldo || 0}`
    ).join("\n")
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `ventas_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success("Exportado", "CSV descargado")
  }

  const statusMap: Record<string, string> = {
    confirmado: "badge-success", facturado: "badge-success", completado: "badge-success",
    pagado: "badge-success", parcial: "badge-warning",
    pendiente: "badge-warning", cancelado: "badge-danger", devuelto: "badge-accent",
  }

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "todas", label: "Todas", count: sales.length },
    { key: "pendientes", label: "Por Cobrar", count: sales.filter(s => s.estado === "confirmado" || s.estado === "parcial" || s.estado === "pendiente").length },
    { key: "pagadas", label: "Pagadas", count: sales.filter(s => s.estado === "pagado" || s.estado === "completado").length },
    { key: "canceladas", label: "Canceladas", count: sales.filter(s => s.estado === "cancelado" || s.estado === "devuelto").length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ShoppingCart className="w-6 h-6 text-primary" />Ventas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{sales.length} ventas · {totalVentas > 0 ? `${formatPYG(totalVentas)} en total` : "sin datos"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="btn-outline flex items-center gap-2"><Download className="w-4 h-4" />CSV</button>
          <button onClick={fetchData} className="btn-outline"><Filter className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</span></div>
          <p className="text-xl font-bold text-green-500">{formatPYG(totalVentas)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1"><ShoppingCart className="w-4 h-4 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Transacciones</span></div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{active.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Por Cobrar</span></div>
          <p className="text-xl font-bold text-amber-500">{formatPYG(totalSaldo)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cobrado</span></div>
          <p className="text-xl font-bold text-blue-500">{formatPYG(totalCobrado)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1"><CreditCard className="w-4 h-4 text-purple-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">IVA Total</span></div>
          <p className="text-xl font-bold text-purple-500">{formatPYG(totalIva)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === t.key ? "bg-primary text-white shadow" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
            {t.label} <span className="ml-1 text-xs opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por número o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input type="date" className="input-field w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="input-field w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button onClick={fetchData} className="btn-primary">Buscar</button>
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(""); setDateFrom(""); setDateTo("") }} className="btn-ghost text-red-500"><X className="w-4 h-4" /></button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Número</th>
              <th className="table-cell">Cliente</th>
              <th className="table-cell text-right">Total</th>
              <th className="table-cell text-right">Pagado</th>
              <th className="table-cell text-right">Saldo</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Fecha</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No se encontraron ventas</td></tr>
            ) : filtered.map((s) => (
              <tr key={s.id} className="table-row">
                <td className="table-td font-mono text-xs font-bold text-primary">{s.numero}</td>
                <td className="table-td">
                  <p className="text-sm font-medium">{s.customer?.razon_social || "Consumidor Final"}</p>
                  {s.customer?.ruc && <p className="text-xs text-gray-400">{s.customer.ruc}</p>}
                </td>
                <td className="table-td text-right font-mono font-bold">{formatPYG(s.total)}</td>
                <td className="table-td text-right font-mono text-green-500">{formatPYG(s.total_pagado || 0)}</td>
                <td className="table-td text-right font-mono text-amber-500">{(s.saldo || 0) > 0 ? formatPYG(s.saldo) : "—"}</td>
                <td className="table-td"><StatusBadge status={s.estado ?? ""} map={statusMap} /></td>
                <td className="table-td text-sm text-gray-500">{formatDate(s.fecha)}</td>
                <td className="table-td">
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost" title="Ver detalle" onClick={() => handleViewSale(s)}><Eye className="w-4 h-4" /></button>
                    <button className="btn-ghost" title="Descargar PDF" onClick={() => window.open(`${import.meta.env.VITE_API_URL || ""}${api.sales.downloadReceipt(s.id)}`, "_blank")}><FileDown className="w-4 h-4" /></button>
                    {s.estado !== "cancelado" && s.estado !== "devuelto" && (s.saldo || 0) > 0 && (
                      <button className="btn-ghost text-green-500" title="Registrar pago" onClick={() => openPaymentModal(s)}><Plus className="w-4 h-4" /></button>
                    )}
                    {s.estado !== "cancelado" && s.estado !== "devuelto" && (
                      <button className="btn-ghost text-red-400" title="Anular venta" onClick={() => handleCancelSale(s)}><X className="w-4 h-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {viewingSale && (
        <div className="modal-overlay" onClick={() => setViewingSale(null)}>
          <div className="modal-content max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Venta {viewingSale.numero}</h3>
              <button onClick={() => setViewingSale(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Estado</span><p><StatusBadge status={viewingSale.estado ?? ""} map={statusMap} /></p></div>
                <div><span className="text-gray-500">Fecha</span><p className="font-bold">{formatDate(viewingSale.fecha)}</p></div>
                <div><span className="text-gray-500">Cliente</span><p className="font-bold">{viewingSale.customer?.razon_social || "Consumidor Final"}</p></div>
                <div><span className="text-gray-500">RUC</span><p className="font-mono">{viewingSale.customer?.ruc || "—"}</p></div>
                <div><span className="text-gray-500">Condición</span><p className="font-bold capitalize">{viewingSale.condicion}</p></div>
                <div><span className="text-gray-500">Comprobante</span><p className="font-bold capitalize">{viewingSale.tipo_comprobante}</p></div>
              </div>
              <div className="border-t pt-3">
                <h4 className="text-sm font-bold mb-2">Items ({saleItems.length})</h4>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-700"><th className="text-left py-1">Producto</th><th className="text-right py-1">Cant</th><th className="text-right py-1">P.U.</th><th className="text-right py-1">IVA</th><th className="text-right py-1">Total</th></tr></thead>
                  <tbody>{saleItems.map((i: any) => (
                    <tr key={i.id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-1">{i.descripcion || i.product?.nombre || "—"}</td>
                      <td className="text-right py-1">{i.cantidad}</td>
                      <td className="text-right py-1 font-mono">{formatPYG(i.precio_unitario)}</td>
                      <td className="text-right py-1 font-mono">{i.iva_tasa}%</td>
                      <td className="text-right py-1 font-bold">{formatPYG(i.total)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="border-t pt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatPYG(viewingSale.subtotal)}</span></div>
                <div className="flex justify-between"><span>Descuento</span><span className="font-mono">{formatPYG(viewingSale.descuento_total || 0)}</span></div>
                <div className="flex justify-between"><span>IVA 10%</span><span className="font-mono">{formatPYG(viewingSale.iva_10 || 0)}</span></div>
                <div className="flex justify-between"><span>IVA 5%</span><span className="font-mono">{formatPYG(viewingSale.iva_5 || 0)}</span></div>
                <div className="flex justify-between col-span-2 pt-2 border-t font-bold text-lg"><span>Total</span><span>{formatPYG(viewingSale.total)}</span></div>
                <div className="flex justify-between"><span>Pagado</span><span className="text-green-500 font-mono">{formatPYG(viewingSale.total_pagado || 0)}</span></div>
                <div className="flex justify-between"><span>Saldo</span><span className="text-amber-500 font-mono">{formatPYG(viewingSale.saldo || 0)}</span></div>
              </div>
              {viewingSale.sifen_estado && (
                <div className="border-t pt-3 text-sm">
                  <span className="text-gray-500">SIFEN: </span>
                  <StatusBadge status={viewingSale.sifen_estado} map={{ enviado: "badge-warning", aprobado: "badge-success", rechazado: "badge-danger" }} />
                  {viewingSale.cdc && <p className="font-mono text-xs text-gray-400 mt-1 break-all">CDC: {viewingSale.cdc}</p>}
                </div>
              )}
              <div className="border-t pt-3 flex flex-wrap gap-2">
                <button className="btn-ghost flex items-center gap-1" onClick={() => { setViewingSale(null); openPaymentModal(viewingSale) }}>
                  <Plus className="w-4 h-4" />Agregar pago
                </button>
                <button className="btn-ghost flex items-center gap-1" onClick={() => { setViewingSale(null); openLinkModal(viewingSale, "quote") }}>
                  <Link2 className="w-4 h-4" />Vincular cotización
                </button>
                <button className="btn-ghost flex items-center gap-1" onClick={() => { setViewingSale(null); openLinkModal(viewingSale, "order") }}>
                  <RotateCcw className="w-4 h-4" />Vincular pedido
                </button>
                <button className="btn-ghost text-green-600 flex items-center gap-1" onClick={() => setWaOpen(!waOpen)}>
                  <MessageCircle className="w-4 h-4" />WhatsApp
                </button>
              </div>
              {waOpen && (
                <div className="flex gap-2 mt-3">
                  <input type="text" value={waMessage} onChange={e => setWaMessage(e.target.value)} placeholder="Mensaje WhatsApp..."
                    className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
                  <button onClick={async () => {
                    if (!waMessage.trim()) return
                    setWaSending(true)
                    try {
                      const phone = viewingSale.customer?.telefono || ""
                      if (!phone) { alert("Cliente sin teléfono"); return }
                      await api.whatsapp.testMessage({ to: phone, message: `🧾 *Factura ${viewingSale.numero}*\nTotal: ${new Intl.NumberFormat("es-PY").format(viewingSale.total || 0)} PYG\n\n${waMessage}` })
                      setWaMessage("")
                      setWaOpen(false)
                    } catch { alert("Error al enviar WhatsApp") }
                    finally { setWaSending(false) }
                  }} disabled={!waMessage.trim() || waSending} className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    {waSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white">Registrar pago</h3>
              <button onClick={() => setPaymentModal(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm">Venta: <span className="font-bold">{paymentModal.numero}</span></p>
              <p className="text-sm">Saldo pendiente: <span className="font-bold text-amber-500">{formatPYG(paymentModal.saldo || paymentModal.total)}</span></p>
              <div>
                <label className="label-field">Monto</label>
                <input className="input-field" type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="label-field">Método de pago</label>
                <select className="input-field" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Referencia (opcional)</label>
                <input className="input-field" placeholder="Nro. transferencia, cheque..." value={payRef} onChange={(e) => setPayRef(e.target.value)} />
              </div>
              <button onClick={handleAddPayment} disabled={!payMethod || !payAmount || paying} className="btn-primary w-full">
                {paying ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Registrar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {linkModal && (
        <div className="modal-overlay" onClick={() => setLinkModal(null)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white">
                Vincular {linkModal.type === "quote" ? "cotización" : "pedido"}
              </h3>
              <button onClick={() => setLinkModal(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm">Venta: <span className="font-bold">{linkModal.sale.numero}</span></p>
              <div>
                <label className="label-field">ID de {linkModal.type === "quote" ? "cotización" : "pedido"}</label>
                <input className="input-field" placeholder="Ingrese el ID..." value={linkId} onChange={(e) => setLinkId(e.target.value)} />
              </div>
              <button onClick={handleLink} disabled={!linkId} className="btn-primary w-full">Vincular</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
