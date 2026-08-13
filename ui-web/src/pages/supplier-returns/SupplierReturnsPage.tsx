import { useState, useEffect, useCallback } from "react"
import { RotateCcw, Plus, Search, Loader2, X, Trash2, CheckCircle2, XCircle, PackageX } from "lucide-react"
import { api, type Supplier, type SupplierReturn, type SupplierReturnWithItems, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

const MOTIVO_LABELS: Record<string, string> = {
  producto_vencido: "Producto vencido",
  producto_danado: "Producto dañado",
  error_pedido: "Error de pedido",
  calidad_deficiente: "Calidad deficiente",
  exceso_stock: "Exceso de stock",
  producto_incorrecto: "Producto incorrecto",
  otro: "Otro",
}

const ESTADO_MAP: Record<string, string> = {
  pendiente: "badge-warning",
  aprobado: "badge-success",
  rechazado: "badge-danger",
}

export default function SupplierReturnsPage() {
  const { user } = useAuth()
  const [returns, setReturns] = useState<SupplierReturn[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [estadoFiltro, setEstadoFiltro] = useState("")
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<SupplierReturnWithItems | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [returnsData, suppliersData] = await Promise.allSettled([
        api.purchaseReturns.list({ estado: estadoFiltro || undefined }),
        api.purchases.suppliers(),
      ])
      if (returnsData.status === "fulfilled") setReturns(returnsData.value)
      if (suppliersData.status === "fulfilled") setSuppliers(suppliersData.value)
    } catch {
      toast.info("Sin datos", "Conectá el backend para ver devoluciones a proveedores")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [estadoFiltro]) // eslint-disable-line react-hooks/exhaustive-deps

  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.razon_social || "—"

  const openDetail = async (r: SupplierReturn) => {
    try {
      setSelected(await api.purchaseReturns.get(r.id))
      setShowDetail(true)
    } catch {
      toast.error("Error", "No se pudo cargar el detalle")
    }
  }

  const handleApprove = async (r: SupplierReturn) => {
    if (!user?.id) return
    try {
      await api.purchaseReturns.approve(r.id, user.id, r.warehouse_id)
      toast.success("Aprobada", `Nota de crédito del proveedor generada por ${formatPYG(r.total)}`)
      setShowDetail(false)
      fetchData()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo aprobar")
    }
  }

  const handleReject = async (r: SupplierReturn) => {
    try {
      await api.purchaseReturns.reject(r.id, "Rechazada desde el panel")
      toast.success("Rechazada")
      setShowDetail(false)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo rechazar")
    }
  }

  const totalPendiente = returns.filter(r => r.estado === "pendiente").reduce((s, r) => s + (r.total || 0), 0)
  const totalAprobado = returns.filter(r => r.estado === "aprobado").reduce((s, r) => s + (r.total || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Devoluciones a Proveedores</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Mercadería vencida, dañada o mal pedida que se devuelve al proveedor</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="w-4 h-4" />Nueva devolución</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><PackageX className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total devoluciones</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{returns.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pendientes de aprobar</span></div>
          <p className="text-2xl font-bold text-amber-500">{formatPYG(totalPendiente)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notas de crédito generadas</span></div>
          <p className="text-2xl font-bold text-green-500">{formatPYG(totalAprobado)}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <select className="input-field max-w-xs" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobado">Aprobadas</option>
          <option value="rechazado">Rechazadas</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Número</th>
              <th className="table-cell">Proveedor</th>
              <th className="table-cell">Motivo</th>
              <th className="table-cell">Total</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : returns.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay devoluciones a proveedores registradas</td></tr>
            ) : (
              returns.map(r => (
                <tr key={r.id} className="table-row cursor-pointer" onClick={() => openDetail(r)}>
                  <td className="table-td font-mono text-xs">{r.numero}</td>
                  <td className="table-td">{supplierName(r.supplier_id)}</td>
                  <td className="table-td text-sm">{MOTIVO_LABELS[r.motivo] || r.motivo}</td>
                  <td className="table-td font-mono">{formatPYG(r.total)}</td>
                  <td className="table-td"><StatusBadge status={r.estado} map={ESTADO_MAP} /></td>
                  <td className="table-td text-xs text-gray-400">{new Date(r.fecha).toLocaleDateString("es-PY")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <NewReturnModal
          suppliers={suppliers}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); fetchData() }}
          toast={toast}
        />
      )}

      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><RotateCcw className="w-5 h-5 text-primary" />{selected.numero}</h3>
                <p className="text-sm text-gray-500">{supplierName(selected.supplier_id)} — {MOTIVO_LABELS[selected.motivo] || selected.motivo}</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <StatusBadge status={selected.estado} map={ESTADO_MAP} />
              {selected.motivo_detalle && <p className="text-sm text-gray-500">{selected.motivo_detalle}</p>}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="py-2">Producto</th>
                    <th className="py-2">Cant.</th>
                    <th className="py-2">Precio</th>
                    <th className="py-2">Condición</th>
                    <th className="py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map(it => (
                    <tr key={it.id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-2">{it.descripcion || it.product_id}</td>
                      <td className="py-2 font-mono">{it.cantidad}</td>
                      <td className="py-2 font-mono">{formatPYG(it.precio_unitario)}</td>
                      <td className="py-2 capitalize">{it.condicion}</td>
                      <td className="py-2 font-mono">{formatPYG(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end text-lg font-bold">Total: {formatPYG(selected.total)}</div>
              {selected.supplier_invoice_id && (
                <p className="text-xs text-green-600">✓ Nota de crédito del proveedor generada — impacta Cuentas por Pagar</p>
              )}
              {selected.estado === "pendiente" && (
                <div className="flex gap-3 pt-2">
                  <button className="btn-outline flex-1 text-red-500" onClick={() => handleReject(selected)}><XCircle className="w-4 h-4" />Rechazar</button>
                  <button className="btn-primary flex-1" onClick={() => handleApprove(selected)}><CheckCircle2 className="w-4 h-4" />Aprobar y generar NC</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NewReturnModal({ suppliers, onClose, onCreated, toast }: {
  suppliers: Supplier[]; onClose: () => void; onCreated: () => void; toast: ReturnType<typeof useToast>
}) {
  const [supplierId, setSupplierId] = useState("")
  const [motivo, setMotivo] = useState("producto_vencido")
  const [motivoDetalle, setMotivoDetalle] = useState("")
  const [warehouseId, setWarehouseId] = useState("")
  const [warehouses, setWarehouses] = useState<{ id: string; nombre: string }[]>([])
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Product[]>([])
  const [items, setItems] = useState<{ product: Product; cantidad: string; precio_unitario: string; condicion: string }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { api.warehouses.list().then(setWarehouses).catch(() => setWarehouses([])) }, [])

  const doSearch = useCallback(async () => {
    if (search.trim().length < 2) { setResults([]); return }
    try { setResults(await api.products.list({ search, activo: true })) } catch { setResults([]) }
  }, [search])
  useEffect(() => { const t = setTimeout(doSearch, 300); return () => clearTimeout(t) }, [doSearch])

  const addProduct = (p: Product) => {
    if (items.some(i => i.product.id === p.id)) return
    setItems(prev => [...prev, { product: p, cantidad: "", precio_unitario: String(p.precio_venta || p.precio || 0), condicion: "vencido" }])
    setSearch(""); setResults([])
  }

  const total = items.reduce((s, i) => s + (Number(i.cantidad || 0) * Number(i.precio_unitario || 0) * 1.1), 0)

  const submit = async () => {
    if (!supplierId || items.length === 0) {
      toast.info("Faltan datos", "Elegí un proveedor y agregá al menos un producto")
      return
    }
    setSaving(true)
    try {
      await api.purchaseReturns.create({
        supplier_id: supplierId,
        motivo,
        motivo_detalle: motivoDetalle || undefined,
        warehouse_id: warehouseId || undefined,
        items: items.map(i => ({
          product_id: i.product.id,
          descripcion: i.product.nombre,
          cantidad: Number(i.cantidad || 0),
          precio_unitario: Number(i.precio_unitario || 0),
          condicion: i.condicion,
        })),
      })
      toast.success("Devolución creada", "Queda pendiente de aprobación")
      onCreated()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo crear la devolución")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva devolución a proveedor</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label label-required">Proveedor</label>
              <select className="input-field" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.razon_social}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Almacén (de donde sale)</label>
              <select className="input-field" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="input-label label-required">Motivo</label>
            <select className="input-field" value={motivo} onChange={e => setMotivo(e.target.value)}>
              {Object.entries(MOTIVO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Detalle</label>
            <input className="input-field" value={motivoDetalle} onChange={e => setMotivoDetalle(e.target.value)} placeholder="Opcional" />
          </div>

          <div className="relative">
            <label className="input-label">Productos</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                {results.map(p => (
                  <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center justify-between" onClick={() => addProduct(p)}>
                    <span>{p.nombre}</span><Plus className="w-3.5 h-3.5 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="py-2">Producto</th>
                  <th className="py-2">Cant.</th>
                  <th className="py-2">Precio unit.</th>
                  <th className="py-2">Condición</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.product.id} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="py-2">{it.product.nombre}</td>
                    <td className="py-2">
                      <input type="number" min={0} className="input-field w-20" value={it.cantidad}
                        onChange={e => setItems(prev => prev.map((p, i) => i === idx ? { ...p, cantidad: e.target.value } : p))} />
                    </td>
                    <td className="py-2">
                      <input type="number" min={0} className="input-field w-28" value={it.precio_unitario}
                        onChange={e => setItems(prev => prev.map((p, i) => i === idx ? { ...p, precio_unitario: e.target.value } : p))} />
                    </td>
                    <td className="py-2">
                      <select className="input-field" value={it.condicion} onChange={e => setItems(prev => prev.map((p, i) => i === idx ? { ...p, condicion: e.target.value } : p))}>
                        <option value="vencido">Vencido</option>
                        <option value="danado">Dañado</option>
                        <option value="buen_estado">Buen estado</option>
                        <option value="incompleto">Incompleto</option>
                      </select>
                    </td>
                    <td className="py-2"><button className="btn-ghost text-red-400" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {items.length > 0 && <div className="text-right font-bold">Total estimado: {formatPYG(total)}</div>}

          <div className="flex gap-3 pt-2">
            <button className="btn-outline flex-1" onClick={onClose}>Cancelar</button>
            <button className="btn-primary flex-1" onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear devolución"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
