import { useState, useEffect } from "react"
import { Search, RotateCcw, Eye, Loader2, CheckCircle, XCircle, Filter, X, ShoppingCart, DollarSign, Clock, ThumbsUp, ThumbsDown, Undo2 } from "lucide-react"
import { api, type ReturnType, type ReturnItemType, type Sale, type Warehouse } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { Modal } from "../../components/Modal"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG, formatDate } from "../../utils/format"

const MOTIVOS_LABELS: Record<string, string> = {
  producto_defectuoso: "Producto defectuoso",
  producto_equivocado: "Producto equivocado",
  vencimiento: "Vencimiento",
  dano_transporte: "Daño en transporte",
  cliente_insatisfecho: "Cliente insatisfecho",
  error_venta: "Error de venta",
  devolucion_voluntaria: "Devolución voluntaria",
  garantia: "Garantía",
  otro: "Otro",
}

const CONDICION_LABELS: Record<string, string> = {
  buen_estado: "Buen estado",
  defectuoso: "Defectuoso",
  danado: "Dañado",
  vencido: "Vencido",
  incompleto: "Incompleto",
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnType[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [loading, setLoading] = useState(true)
  const [viewingReturn, setViewingReturn] = useState<ReturnType | null>(null)
  const [returnItems, setReturnItems] = useState<ReturnItemType[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState("")
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<Record<string, { cantidad: number; condicion: string; motivo_detalle: string }>>({})
  const [motivo, setMotivo] = useState("")
  const [motivoDetalle, setMotivoDetalle] = useState("")
  const [motivos, setMotivos] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<ReturnType | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const toast = useToast()
  const confirm = useConfirm()

  const statusMap: Record<string, string> = {
    pendiente: "badge-warning",
    aprobado: "badge-success",
    rechazado: "badge-danger",
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [returnsData, salesData, warehousesData, motivosData] = await Promise.allSettled([
        api.returns.list({ estado: filterStatus !== "todos" ? filterStatus : undefined }),
        api.sales.list({ estado: "confirmado" }),
        api.warehouses.list(),
        api.returns.motivos(),
      ])
      if (returnsData.status === "fulfilled") setReturns(returnsData.value)
      if (salesData.status === "fulfilled") setSales(salesData.value)
      if (warehousesData.status === "fulfilled") setWarehouses(warehousesData.value)
      if (motivosData.status === "fulfilled") setMotivos(motivosData.value)
    } catch {
      setReturns([])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [filterStatus])

  const filtered = returns.filter(r => {
    if (search && !(r.numero || "").toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pendientes = returns.filter(r => r.estado === "pendiente").length
  const aprobadas = returns.filter(r => r.estado === "aprobado").length
  const rechazadas = returns.filter(r => r.estado === "rechazado").length
  const montoTotal = returns.reduce((a, b) => a + (b.total || 0), 0)

  const handleLoadSaleItems = async (saleId: string) => {
    if (!saleId) { setSaleItems([]); setSelectedItems({}); return }
    try {
      const items = await api.sales.getItems(saleId)
      setSaleItems(items)
      const sel: Record<string, { cantidad: number; condicion: string; motivo_detalle: string }> = {}
      items.forEach((i: any) => {
        sel[i.id] = { cantidad: i.cantidad, condicion: "buen_estado", motivo_detalle: "" }
      })
      setSelectedItems(sel)
    } catch {
      setSaleItems([])
      toast.error("Error", "No se pudieron cargar los items de la venta")
    }
  }

  const handleCreateReturn = async () => {
    if (!motivo) { toast.error("Error", "Seleccione un motivo de devolución"); return }
    if (!selectedSaleId) { toast.error("Error", "Seleccione una venta"); return }
    const items = Object.entries(selectedItems)
      .filter(([_, v]) => v.cantidad > 0)
      .map(([key, v]) => {
        const item = saleItems.find((i: any) => i.id === key)
        return {
          product_id: item.product_id,
          cantidad: v.cantidad,
          precio_unitario: item.precio_unitario,
          iva_tasa: item.iva_tasa,
          condicion: v.condicion,
          motivo_detalle: v.motivo_detalle || undefined,
        }
      })
    if (items.length === 0) { toast.error("Error", "Seleccione al menos un item"); return }
    setCreating(true)
    try {
      const sale = sales.find(s => s.id === selectedSaleId)
      await api.returns.create({
        sale_id: selectedSaleId,
        customer_id: sale?.customer_id || undefined,
        motivo,
        observaciones: motivoDetalle || undefined,
        items,
      })
      toast.success("Creada", "Devolución registrada correctamente")
      setShowCreate(false)
      resetCreateForm()
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear la devolución")
    } finally { setCreating(false) }
  }

  const resetCreateForm = () => {
    setSelectedSaleId("")
    setSaleItems([])
    setSelectedItems({})
    setMotivo("")
    setMotivoDetalle("")
  }

  const handleApprove = async (r: ReturnType) => {
    const ok = await confirm({
      title: "Aprobar devolución",
      message: `¿Confirma la aprobación de la devolución ${r.numero}? Se restaurará el stock de los items devueltos.`,
      confirmText: "Aprobar",
      variant: "info",
    })
    if (!ok) return
    setProcessing(r.id)
    try {
      await api.returns.approve(r.id, "sistema")
      toast.success("Aprobada", `Devolución ${r.numero} aprobada — stock restaurado`)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo aprobar la devolución")
    } finally { setProcessing(null) }
  }

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) {
      toast.error("Error", "Ingrese el motivo del rechazo")
      return
    }
    setProcessing(rejectModal.id)
    try {
      await api.returns.reject(rejectModal.id, rejectReason.trim())
      toast.success("Rechazada", `Devolución ${rejectModal.numero} rechazada`)
      setRejectModal(null)
      setRejectReason("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo rechazar la devolución")
    } finally { setProcessing(null) }
  }

  const handleViewReturn = async (r: ReturnType) => {
    setViewingReturn(r)
    try {
      const full = await api.returns.get(r.id)
      setReturnItems(full.items || [])
    } catch {
      setReturnItems([])
    }
  }

  const motivoLabel = (m: string) => MOTIVOS_LABELS[m] || m.replace(/_/g, " ")
  const condicionLabel = (c: string) => CONDICION_LABELS[c] || c.replace(/_/g, " ")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><RotateCcw className="w-6 h-6 text-primary" />Devoluciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{returns.length} devoluciones registradas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Undo2 className="w-4 h-4" />Nueva devolución</button>
          <button onClick={fetchData} className="btn-outline"><Filter className="w-4 h-4" /></button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><RotateCcw className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{returns.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pendientes</span></div>
          <p className="text-2xl font-bold text-amber-500">{pendientes}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Aprobadas</span></div>
          <p className="text-2xl font-bold text-green-500">{aprobadas}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><XCircle className="w-5 h-5 text-red-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rechazadas</span></div>
          <p className="text-2xl font-bold text-red-500">{rechazadas}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monto total</span></div>
          <p className="text-2xl font-bold text-blue-500">{formatPYG(montoTotal)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input className="input-field pl-10" placeholder="Buscar por número..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="input-field w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="todos">Todos</option><option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-header"><th className="table-cell">Número</th><th className="table-cell">Fecha</th><th className="table-cell">Cliente</th><th className="table-cell">Venta origen</th><th className="table-cell">Motivo</th><th className="table-cell text-right">Total</th><th className="table-cell">Estado</th><th className="table-cell">Acciones</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            : filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">No se encontraron devoluciones</td></tr>
            : filtered.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="table-td font-mono text-xs font-bold text-primary">{r.numero}</td>
                <td className="table-td text-sm text-gray-500">{formatDate(r.fecha)}</td>
                <td className="table-td text-sm font-medium">{(r as any).customer?.razon_social || (r as any).customer_name || "—"}</td>
                <td className="table-td font-mono text-xs">{(r as any).sale?.numero || r.sale_id?.slice(0, 8) || "—"}</td>
                <td className="table-td text-sm">{motivoLabel(r.motivo!)}</td>
                <td className="table-td text-right font-mono font-bold">{formatPYG(r.total)}</td>
                <td className="table-td"><StatusBadge status={r.estado!} map={statusMap} /></td>
                <td className="table-td">
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost" title="Ver detalle" onClick={() => handleViewReturn(r)}><Eye className="w-4 h-4" /></button>
                    {r.estado === "pendiente" && (
                      <>
                        <button className="btn-ghost text-green-500" title="Aprobar" onClick={() => handleApprove(r)} disabled={processing === r.id}>
                          {processing === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                        </button>
                        <button className="btn-ghost text-red-500" title="Rechazar" onClick={() => { setRejectModal(r); setRejectReason("") }}>
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Return Modal */}
      <Modal open={showCreate} onClose={() => { if (!creating) { setShowCreate(false); resetCreateForm() } }} title="Nueva devolución" size="xl">
        <div className="space-y-4">
          {/* Sale Selector */}
          <div>
            <label className="block text-sm font-bold mb-1">Venta de origen</label>
            <select className="input-field w-full" value={selectedSaleId} onChange={(e) => { setSelectedSaleId(e.target.value); handleLoadSaleItems(e.target.value) }}>
              <option value="">Seleccionar venta...</option>
              {sales.map(s => (
                <option key={s.id} value={s.id}>{s.numero} — {s.customer?.razon_social || "CF"} — {formatDate(s.fecha)} — {formatPYG(s.total)}</option>
              ))}
            </select>
          </div>

          {/* Items */}
          {saleItems.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2">Items a devolver</h4>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 dark:border-gray-700"><th className="text-left py-1">Producto</th><th className="text-center py-1">Cant. venta</th><th className="text-center py-1">A devolver</th><th className="text-left py-1">Condición</th><th className="text-left py-1">Detalle</th></tr></thead>
                <tbody>
                  {saleItems.map((i: any) => (
                    <tr key={i.id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-1 font-medium">{i.descripcion || i.product?.nombre || "—"}</td>
                      <td className="py-1 text-center">{i.cantidad}</td>
                      <td className="py-1 text-center">
                        <input
                          type="number" min={0} max={i.cantidad}
                          className="input-field w-20 text-center"
                          value={selectedItems[i.id]?.cantidad ?? 0}
                          onChange={(e) => {
                            const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), i.cantidad)
                            setSelectedItems(prev => ({ ...prev, [i.id]: { ...prev[i.id], cantidad: val } }))
                          }}
                        />
                      </td>
                      <td className="py-1">
                        <select className="input-field text-xs" value={selectedItems[i.id]?.condicion || "buen_estado"}
                          onChange={(e) => setSelectedItems(prev => ({ ...prev, [i.id]: { ...prev[i.id], condicion: e.target.value } }))}>
                          {Object.entries(CONDICION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td className="py-1">
                        <input className="input-field text-xs" placeholder="Detalle..." value={selectedItems[i.id]?.motivo_detalle || ""}
                          onChange={(e) => setSelectedItems(prev => ({ ...prev, [i.id]: { ...prev[i.id], motivo_detalle: e.target.value } }))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-1">Seleccione cantidad a devolver por cada item</p>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-sm font-bold mb-1">Motivo</label>
            <select className="input-field w-full" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="">Seleccionar motivo...</option>
              {motivos.map(m => <option key={m} value={m}>{motivoLabel(m)}</option>)}
            </select>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-bold mb-1">Observaciones</label>
            <textarea className="input-field w-full" rows={2} value={motivoDetalle} onChange={(e) => setMotivoDetalle(e.target.value)} placeholder="Detalle adicional..." />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button className="btn-outline" onClick={() => { setShowCreate(false); resetCreateForm() }} disabled={creating}>Cancelar</button>
            <button className="btn-primary flex items-center gap-2" onClick={handleCreateReturn} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
              Registrar devolución
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      {viewingReturn && (
        <div className="modal-overlay" onClick={() => setViewingReturn(null)}>
          <div className="modal-content max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Devolución {viewingReturn.numero}</h3>
              <button onClick={() => setViewingReturn(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Estado</span><p><StatusBadge status={viewingReturn.estado!} map={statusMap} /></p></div>
                <div><span className="text-gray-500">Fecha</span><p className="font-bold">{formatDate(viewingReturn.fecha)}</p></div>
                <div><span className="text-gray-500">Cliente</span><p className="font-bold">{(viewingReturn as any).customer?.razon_social || "—"}</p></div>
                <div><span className="text-gray-500">Venta origen</span><p className="font-mono text-xs">{(viewingReturn as any).sale?.numero || viewingReturn.sale_id?.slice(0, 8) || "—"}</p></div>
                <div className="col-span-2"><span className="text-gray-500">Motivo</span><p className="font-medium">{motivoLabel(viewingReturn.motivo!)}{viewingReturn.motivo_detalle ? ` — ${viewingReturn.motivo_detalle}` : ""}</p></div>
              </div>

              {viewingReturn.estado === "aprobado" && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-green-700 dark:text-green-400 mb-1"><CheckCircle className="w-4 h-4" />Stock restaurado</div>
                  <p className="text-xs text-green-600 dark:text-green-400">Los items devueltos han sido reintegrados al inventario automáticamente.</p>
                  {viewingReturn.aprobado_por && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Aprobado por: {viewingReturn.aprobado_por}</p>}
                </div>
              )}

              {viewingReturn.estado === "rechazado" && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400 mb-1"><XCircle className="w-4 h-4" />Rechazada</div>
                  {(viewingReturn as any).motivo_rechazo && <p className="text-xs text-red-600 dark:text-red-400">Motivo: {(viewingReturn as any).motivo_rechazo}</p>}
                </div>
              )}

              <div className="border-t pt-3">
                <h4 className="text-sm font-bold mb-2">Items devueltos ({returnItems.length})</h4>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 dark:border-gray-700"><th className="text-left py-1">Producto</th><th className="text-right py-1">Cant</th><th className="text-right py-1">P.U.</th><th className="text-right py-1">Total</th><th className="text-left py-1">Condición</th></tr></thead>
                  <tbody>{returnItems.map((i: ReturnItemType) => (
                    <tr key={i.id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-1">{i.descripcion || "—"}</td>
                      <td className="text-right py-1">{i.cantidad}</td>
                      <td className="text-right py-1 font-mono">{formatPYG(i.precio_unitario)}</td>
                      <td className="text-right py-1 font-bold">{formatPYG(i.total)}</td>
                      <td className="py-1"><span className="text-xs font-medium bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{condicionLabel(i.condicion!)}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              <div className="border-t pt-3 grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between font-bold text-lg"><span>Total devuelto</span><span>{formatPYG(viewingReturn.total)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => { if (processing !== rejectModal.id) { setRejectModal(null); setRejectReason("") } }}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-red-100 dark:bg-red-900/30">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Rechazar devolución</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Devolución {rejectModal.numero}</p>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">Motivo del rechazo</label>
                <textarea className="input-field w-full" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Indique el motivo del rechazo..." />
              </div>
              <div className="flex gap-3">
                <button className="btn-outline flex-1" onClick={() => { setRejectModal(null); setRejectReason("") }} disabled={processing === rejectModal.id}>Cancelar</button>
                <button className="flex-1 text-white font-bold py-2 px-4 rounded-xl transition-colors bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2" onClick={handleReject} disabled={processing === rejectModal.id}>
                  {processing === rejectModal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
