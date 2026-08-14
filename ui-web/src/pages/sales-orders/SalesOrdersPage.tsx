import { useState, useEffect, useCallback } from "react"
import { Search, ClipboardList, Plus, Eye, X, Loader2, CheckCircle, XCircle, Send, Truck, Package, FileText, Check, AlertTriangle, Ban, ChevronRight } from "lucide-react"
import { api, type SalesOrder, type Customer, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { StatusBadge } from "../../components/DataTable"
import { Modal } from "../../components/Modal"
import { formatPYG } from "../../utils/format"

const statusFlow = [
  "borrador",
  "pendiente_aprobacion",
  "aprobado",
  "en_preparacion",
  "listo",
  "facturado",
  "completado",
]

const statusMap: Record<string, string> = {
  borrador: "badge-accent",
  pendiente_aprobacion: "badge-warning",
  aprobado: "badge-info",
  en_preparacion: "badge-warning",
  listo: "badge-info",
  facturado: "badge-success",
  completado: "badge-success",
  cancelado: "badge-danger",
  rechazado: "badge-danger",
}

const priorityConfig: Record<string, { class: string; label: string }> = {
  normal: { class: "badge-info", label: "Normal" },
  alta: { class: "badge-warning", label: "Alta" },
  urgente: { class: "badge-danger", label: "Urgente" },
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterEstado, setFilterEstado] = useState<string>("todos")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewingOrder, setViewingOrder] = useState<SalesOrder | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.salesOrders.list({
        estado: filterEstado !== "todos" ? filterEstado : undefined,
      })
      setOrders(data)
    } catch {
      setOrders([])
      toast.error("Error", "No se pudieron cargar los pedidos")
    } finally {
      setLoading(false)
    }
  }, [filterEstado])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const filtered = orders.filter((o) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (o.numero || "").toLowerCase().includes(q) ||
      (o.customer?.razon_social || "").toLowerCase().includes(q) ||
      (o.observaciones || "").toLowerCase().includes(q)
    )
  })

  const kpi = {
    total: orders.length,
    pendientes: orders.filter((o) => o.estado === "borrador" || o.estado === "pendiente_aprobacion").length,
    en_curso: orders.filter((o) => o.estado === "aprobado" || o.estado === "en_preparacion" || o.estado === "listo").length,
    completados: orders.filter((o) => o.estado === "completado").length,
    cancelados: orders.filter((o) => o.estado === "cancelado" || o.estado === "rechazado").length,
    total_monto: orders.reduce((a, b) => a + Number(b.total || 0), 0),
  }

  const canTransition = (order: SalesOrder, target: string) => {
    if (target === "cancelado" || target === "rechazado") return order.estado !== "cancelado" && order.estado !== "rechazado" && order.estado !== "completado"
    const idx = statusFlow.indexOf(order.estado!)
    const tIdx = statusFlow.indexOf(target)
    return idx !== -1 && tIdx === idx + 1
  }

  const nextStatus = (order: SalesOrder): { estado: string; label: string; icon: React.ReactNode; variant?: string } | null => {
    if (order.estado === "cancelado" || order.estado === "rechazado" || order.estado === "completado") return null
    if (order.estado === "borrador") return { estado: "pendiente_aprobacion", label: "Enviar a aprobación", icon: <Send className="w-4 h-4" /> }
    if (order.estado === "pendiente_aprobacion") return null
    if (order.estado === "aprobado") return { estado: "en_preparacion", label: "Iniciar preparación", icon: <Truck className="w-4 h-4" /> }
    if (order.estado === "en_preparacion") return { estado: "listo", label: "Marcar listo", icon: <Package className="w-4 h-4" /> }
    if (order.estado === "listo") return { estado: "facturado", label: "Facturar", icon: <FileText className="w-4 h-4" /> }
    if (order.estado === "facturado") return { estado: "completado", label: "Completar", icon: <Check className="w-4 h-4" /> }
    return null
  }

  const handleStatusChange = async (order: SalesOrder, target: string, motivo?: string) => {
    const label = target === "cancelado" ? "cancelar" : target === "rechazado" ? "rechazar" : `pasar a ${target.replace(/_/g, " ")}`
    const confirmed = await confirm({
      title: target === "cancelado" || target === "rechazado" ? `¿${label} pedido?` : "Confirmar transición",
      message: target === "cancelado" || target === "rechazado"
        ? `¿Estás seguro de que deseas ${label} el pedido ${order.numero}?`
        : `¿Estás seguro de que deseas ${label} el pedido ${order.numero}?`,
      confirmText: label.charAt(0).toUpperCase() + label.slice(1),
      variant: target === "cancelado" || target === "rechazado" ? "danger" : "warning",
    })
    if (!confirmed) return

    setSubmitting(true)
    try {
      await api.salesOrders.changeStatus(order.id, target, motivo)
      toast.success("Estado actualizado", `Pedido ${order.numero} → ${target.replace(/_/g, " ")}`)
      fetchOrders()
    } catch {
      toast.error("Error", `No se pudo ${label} el pedido`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (order: SalesOrder) => {
    const confirmed = await confirm({
      title: "Aprobar pedido",
      message: `¿Aprobar el pedido ${order.numero}?`,
      confirmText: "Aprobar",
      variant: "info",
    })
    if (!confirmed) return

    setSubmitting(true)
    try {
      await api.salesOrders.approve(order.id, user?.id || user?.email || "desconocido")
      toast.success("Aprobado", `Pedido ${order.numero} aprobado`)
      fetchOrders()
    } catch {
      toast.error("Error", "No se pudo aprobar el pedido")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" /> Pedidos de Venta
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{orders.length} pedidos registrados</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo Pedido
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="card p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total</div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{kpi.total}</p>
        </div>
        <div className="card p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Pendientes</div>
          <p className="text-xl font-bold text-amber-500">{kpi.pendientes}</p>
        </div>
        <div className="card p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">En curso</div>
          <p className="text-xl font-bold text-blue-500">{kpi.en_curso}</p>
        </div>
        <div className="card p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-1">Completados</div>
          <p className="text-xl font-bold text-green-500">{kpi.completados}</p>
        </div>
        <div className="card p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Cancelados</div>
          <p className="text-xl font-bold text-red-500">{kpi.cancelados}</p>
        </div>
        <div className="card p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Monto Total</div>
          <p className="text-xl font-bold text-primary">{formatPYG(kpi.total_monto)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-10"
            placeholder="Buscar por número, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field w-44"
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          {statusFlow.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
          <option value="cancelado">Cancelado</option>
          <option value="rechazado">Rechazado</option>
        </select>
        <button onClick={fetchOrders} className="btn-primary flex items-center gap-2">
          <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ClipboardList className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-bold">No se encontraron pedidos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Número</th>
                  <th className="table-cell">Cliente</th>
                  <th className="table-cell">Fecha</th>
                  <th className="table-cell">Estado</th>
                  <th className="table-cell">Prioridad</th>
                  <th className="table-cell text-right">Total</th>
                  <th className="table-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const next = nextStatus(order)
                  const isPendingApproval = order.estado === "pendiente_aprobacion"
                  const prio = priorityConfig[order.prioridad || "normal"] || priorityConfig.normal
                  return (
                    <tr key={order.id} className="table-row">
                      <td className="table-td font-mono text-xs font-bold text-primary">{order.numero}</td>
                      <td className="table-td">
                        <p className="text-sm font-medium">{order.customer?.razon_social || "Consumidor Final"}</p>
                      </td>
                      <td className="table-td text-sm text-gray-500">
                        {new Date(order.fecha!).toLocaleDateString("es-PY")}
                      </td>
                      <td className="table-td">
                        <StatusBadge status={order.estado!} map={statusMap} />
                      </td>
                      <td className="table-td">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${prio.class}`}>
                          {prio.label}
                        </span>
                      </td>
                      <td className="table-td text-right font-mono font-bold">{formatPYG(order.total || 0)}</td>
                      <td className="table-td">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            className="btn-ghost"
                            title="Ver detalle"
                            onClick={() => setViewingOrder(order)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isPendingApproval && (
                            <>
                              <button
                                className="btn-ghost text-green-500 hover:text-green-600"
                                title="Aprobar"
                                onClick={() => handleApprove(order)}
                                disabled={submitting}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                className="btn-ghost text-red-500 hover:text-red-600"
                                title="Rechazar"
                                onClick={() => handleStatusChange(order, "rechazado", "Rechazado por el aprobador")}
                                disabled={submitting}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {next && (
                            <button
                              className="btn-ghost text-primary hover:text-primary/80"
                              title={next.label}
                              onClick={() => handleStatusChange(order, next.estado)}
                              disabled={submitting}
                            >
                              {next.icon}
                            </button>
                          )}
                          {order.estado !== "cancelado" && order.estado !== "rechazado" && order.estado !== "completado" && (
                            <button
                              className="btn-ghost text-red-400 hover:text-red-600"
                              title="Cancelar"
                              onClick={() => handleStatusChange(order, "cancelado", "Cancelado manualmente")}
                              disabled={submitting}
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateOrderModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false)
          fetchOrders()
        }}
      />

      {/* Detail Modal */}
      <DetailModal
        order={viewingOrder}
        onClose={() => setViewingOrder(null)}
        onStatusChange={handleStatusChange}
        onApprove={handleApprove}
        submitting={submitting}
      />
    </div>
  )
}

/* ── Create Order Modal ── */
function CreateOrderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerSearch, setCustomerSearch] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [prioridad, setPrioridad] = useState("normal")
  const [condicion, setCondicion] = useState("contado")
  const [fechaEntrega, setFechaEntrega] = useState("")
  const [direccion, setDireccion] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [items, setItems] = useState<{ product_id: string; nombre: string; cantidad: number; precio_unitario: number; iva_tasa: number }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    api.customers.list({ activo: true }).then(setCustomers).catch(() => {})
    api.products.list({ activo: true }).then(setProducts).catch(() => {})
    setSelectedCustomer(null)
    setCustomerSearch("")
    setProductSearch("")
    setPrioridad("normal")
    setCondicion("contado")
    setFechaEntrega("")
    setDireccion("")
    setObservaciones("")
    setItems([])
  }, [open])

  const filteredCustomers = customers.filter(
    (c) =>
      (c.razon_social || "").toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.ruc || "").includes(customerSearch) ||
      (c.ci || "").includes(customerSearch)
  )

  const filteredProducts = products.filter(
    (p) =>
      p.nombre.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.codigo_barra || "").includes(productSearch)
  )

  const addItem = (product: Product) => {
    if (items.some((i) => i.product_id === product.id)) {
      toast.info("Ya agregado", `${product.nombre} ya está en la lista`)
      return
    }
    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        nombre: product.nombre,
        cantidad: 1,
        precio_unitario: product.precio || 0,
        iva_tasa: product.iva_tasa!,
      },
    ])
  }

  const updateItem = (index: number, field: string, value: number | string) => {
    setItems((prev) => {
      const copy = [...prev]
      ;(copy[index] as any)[field] = value
      return copy
    })
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const subtotal = items.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0)
  const iva10 = items.filter((i) => i.iva_tasa === 10).reduce((a, i) => a + i.cantidad * i.precio_unitario * 0.1, 0)
  const iva5 = items.filter((i) => i.iva_tasa === 5).reduce((a, i) => a + i.cantidad * i.precio_unitario * 0.05, 0)
  const total = subtotal + iva10 + iva5

  const handleCreate = async () => {
    if (items.length === 0) {
      toast.error("Sin items", "Agregá al menos un producto al pedido")
      return
    }
    setSubmitting(true)
    try {
      await api.salesOrders.create({
        customer_id: selectedCustomer?.id,
        prioridad,
        condicion,
        fecha_entrega_solicitada: fechaEntrega || undefined,
        direccion_entrega: direccion || undefined,
        observaciones: observaciones || undefined,
        items: items.map((i) => ({
          product_id: i.product_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          iva_tasa: i.iva_tasa,
        })),
      })
      toast.success("Pedido creado", "El pedido de venta fue creado exitosamente")
      onCreated()
    } catch {
      toast.error("Error", "No se pudo crear el pedido")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Pedido de Venta" size="xl">
      <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
        {/* Customer */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
          <input
            className="input-field mb-2"
            placeholder="Buscar cliente..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
          />
          {customerSearch && filteredCustomers.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors ${
                    selectedCustomer?.id === c.id ? "bg-primary/20 font-bold" : ""
                  }`}
                  onClick={() => {
                    setSelectedCustomer(c)
                    setCustomerSearch("")
                  }}
                >
                  {c.razon_social} {c.ruc && <span className="text-gray-400">({c.ruc})</span>}
                </button>
              ))}
            </div>
          )}
          {selectedCustomer && (
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-sm font-bold">
                {selectedCustomer.razon_social}
                <button onClick={() => setSelectedCustomer(null)} className="ml-1 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Prioridad</label>
            <select className="input-field" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Condición</label>
            <select className="input-field" value={condicion} onChange={(e) => setCondicion(e.target.value)}>
              <option value="contado">Contado</option>
              <option value="credito">Crédito</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Fecha de entrega solicitada</label>
            <input type="date" className="input-field" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Dirección de entrega</label>
            <input className="input-field" placeholder="Dirección..." value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>
        </div>

        {/* Items */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Productos</label>
          <input
            className="input-field mb-2"
            placeholder="Buscar producto por nombre, SKU o código de barras..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          {productSearch && filteredProducts.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 mb-2">
              {filteredProducts.slice(0, 10).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors flex items-center justify-between"
                  onClick={() => addItem(p)}
                >
                  <span>
                    {p.nombre}{" "}
                    <span className="text-gray-400 text-xs">({p.sku})</span>
                  </span>
                  <span className="text-xs font-mono text-primary">{formatPYG(p.precio || 0)}</span>
                </button>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-3 py-2 font-bold text-xs uppercase tracking-wider text-gray-500">Producto</th>
                    <th className="text-right px-3 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 w-20">Cant.</th>
                    <th className="text-right px-3 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 w-28">P. Unit.</th>
                    <th className="text-right px-3 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 w-24">Subtotal</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 font-medium">{item.nombre}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0.01}
                          step={1}
                          className="input-field text-right w-20 text-xs"
                          value={item.cantidad}
                          onChange={(e) => updateItem(idx, "cantidad", Math.max(0.01, Number(e.target.value)))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={100}
                          className="input-field text-right w-28 text-xs"
                          value={item.precio_unitario}
                          onChange={(e) => updateItem(idx, "precio_unitario", Number(e.target.value))}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {formatPYG(item.cantidad * item.precio_unitario)}
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeItem(idx)} className="btn-ghost text-red-400 hover:text-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-mono">{formatPYG(subtotal)}</span>
            </div>
            {iva10 > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">IVA 10%</span>
                <span className="font-mono">{formatPYG(iva10)}</span>
              </div>
            )}
            {iva5 > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">IVA 5%</span>
                <span className="font-mono">{formatPYG(iva5)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200 dark:border-gray-600">
              <span>Total</span>
              <span className="font-mono text-primary">{formatPYG(total)}</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Observaciones</label>
          <textarea
            className="input-field resize-none"
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas internas..."
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
        <button onClick={onClose} className="btn-outline flex-1" disabled={submitting}>
          Cancelar
        </button>
        <button
          onClick={handleCreate}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
          disabled={submitting || items.length === 0}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {submitting ? "Creando..." : "Crear Pedido"}
        </button>
      </div>
    </Modal>
  )
}

/* ── Detail Modal ── */
function DetailModal({
  order,
  onClose,
  onStatusChange,
  onApprove,
  submitting,
}: {
  order: SalesOrder | null
  onClose: () => void
  onStatusChange: (order: SalesOrder, target: string, motivo?: string) => void
  onApprove: (order: SalesOrder) => void
  submitting: boolean
}) {
  const [items, setItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    if (!order) return
    setLoadingItems(true)
    api.salesOrders
      .get(order.id)
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false))
  }, [order])

  if (!order) return null

  const next = (() => {
    if (order.estado === "cancelado" || order.estado === "rechazado" || order.estado === "completado") return null
    if (order.estado === "borrador") return { estado: "pendiente_aprobacion", label: "Enviar a aprobación", icon: <Send className="w-4 h-4" /> }
    if (order.estado === "pendiente_aprobacion") return null
    if (order.estado === "aprobado") return { estado: "en_preparacion", label: "Iniciar preparación", icon: <Truck className="w-4 h-4" /> }
    if (order.estado === "en_preparacion") return { estado: "listo", label: "Marcar listo", icon: <Package className="w-4 h-4" /> }
    if (order.estado === "listo") return { estado: "facturado", label: "Facturar", icon: <FileText className="w-4 h-4" /> }
    if (order.estado === "facturado") return { estado: "completado", label: "Completar", icon: <Check className="w-4 h-4" /> }
    return null
  })()

  const prio = priorityConfig[order.prioridad || "normal"] || priorityConfig.normal
  const isPendingApproval = order.estado === "pendiente_aprobacion"
  const canCancel = order.estado !== "cancelado" && order.estado !== "rechazado" && order.estado !== "completado"

  const subtotal = order.subtotal ?? items.reduce((a: number, i: any) => a + Number(i.cantidad) * Number(i.precio_unitario), 0)
  const iva10 = order.iva_10 ?? 0
  const iva5 = order.iva_5 ?? 0
  const descuento = order.descuento_total ?? 0
  const total = order.total ?? (subtotal + iva10 + iva5 - descuento)

  return (
    <Modal open={!!order} onClose={onClose} title={`Pedido ${order.numero}`} size="lg">
      <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
        {/* Header info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 text-xs">Estado</span>
            <div className="mt-1"><StatusBadge status={order.estado!} map={statusMap} /></div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Prioridad</span>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${prio.class}`}>
                {prio.label}
              </span>
            </div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Fecha</span>
            <p className="font-bold">{new Date(order.fecha!).toLocaleString("es-PY")}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Condición</span>
            <p className="font-bold capitalize">{order.condicion}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Cliente</span>
            <p className="font-bold">{order.customer?.razon_social || "Consumidor Final"}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Moneda</span>
            <p className="font-mono font-bold">{order.moneda}</p>
          </div>
          {order.fecha_entrega_solicitada && (
            <div>
              <span className="text-gray-500 text-xs">Fecha de entrega solicitada</span>
              <p className="font-bold">{new Date(order.fecha_entrega_solicitada).toLocaleDateString("es-PY")}</p>
            </div>
          )}
          {order.fecha_entrega_estimada && (
            <div>
              <span className="text-gray-500 text-xs">Fecha de entrega estimada</span>
              <p className="font-bold">{new Date(order.fecha_entrega_estimada).toLocaleDateString("es-PY")}</p>
            </div>
          )}
          {order.direccion_entrega && (
            <div className="col-span-2">
              <span className="text-gray-500 text-xs">Dirección de entrega</span>
              <p className="font-bold">{order.direccion_entrega}</p>
            </div>
          )}
          {order.observaciones && (
            <div className="col-span-2">
              <span className="text-gray-500 text-xs">Observaciones</span>
              <p className="text-sm">{order.observaciones}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div>
          <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
            Items
            {loadingItems && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
            {!loadingItems && <span className="text-gray-400 font-normal">({items.length})</span>}
          </h4>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-3 py-2 font-bold text-xs uppercase tracking-wider text-gray-500">Producto</th>
                  <th className="text-right px-3 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 w-16">Cant.</th>
                  <th className="text-right px-3 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 w-24">P. Unit.</th>
                  <th className="text-right px-3 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 w-16">IVA</th>
                  <th className="text-right px-3 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loadingItems ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-400 text-xs">Sin items</td>
                  </tr>
                ) : (
                  items.map((i: any, idx: number) => (
                    <tr key={i.id || idx} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 font-medium">{i.descripcion || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{i.cantidad}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatPYG(i.precio_unitario)}</td>
                      <td className="px-3 py-2 text-right font-mono">{i.iva_tasa}%</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{formatPYG(i.total || i.cantidad * i.precio_unitario)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-mono">{formatPYG(order.subtotal ?? subtotal)}</span>
          </div>
          {(order.descuento_total ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Descuento</span>
              <span className="font-mono text-red-500">-{formatPYG(order.descuento_total || 0)}</span>
            </div>
          )}
          {(order.iva_10 ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">IVA 10%</span>
              <span className="font-mono">{formatPYG(order.iva_10 || 0)}</span>
            </div>
          )}
          {(order.iva_5 ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">IVA 5%</span>
              <span className="font-mono">{formatPYG(order.iva_5 || 0)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200 dark:border-gray-600">
            <span>Total</span>
            <span className="font-mono text-primary">{formatPYG(total)}</span>
          </div>
        </div>

        {/* State flow visualization */}
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {statusFlow.map((s, idx) => {
            const currentIdx = statusFlow.indexOf(order.estado!)
            const isPast = currentIdx >= idx
            const isCurrent = order.estado === s
            return (
              <span key={s} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isCurrent
                      ? "bg-primary/20 text-primary ring-1 ring-primary"
                      : isPast && order.estado !== "cancelado" && order.estado !== "rechazado"
                      ? "text-gray-400"
                      : "text-gray-500"
                  } ${order.estado === "cancelado" || order.estado === "rechazado" ? "line-through opacity-50" : ""}`}
                >
                  {s.replace(/_/g, " ")}
                </span>
              </span>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {isPendingApproval && (
            <>
              <button
                className="btn-primary flex items-center gap-2 text-sm"
                onClick={() => onApprove(order)}
                disabled={submitting}
              >
                <CheckCircle className="w-4 h-4" /> Aprobar
              </button>
              <button
                className="btn-outline flex items-center gap-2 text-sm text-red-500 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => onStatusChange(order, "rechazado", "Rechazado por el aprobador")}
                disabled={submitting}
              >
                <XCircle className="w-4 h-4" /> Rechazar
              </button>
            </>
          )}
          {next && (
            <button
              className="btn-primary flex items-center gap-2 text-sm"
              onClick={() => onStatusChange(order, next.estado)}
              disabled={submitting}
            >
              {next.icon} {next.label}
            </button>
          )}
          {canCancel && (
            <button
              className="btn-outline flex items-center gap-2 text-sm text-red-500 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => onStatusChange(order, "cancelado", "Cancelado manualmente")}
              disabled={submitting}
            >
              <Ban className="w-4 h-4" /> Cancelar pedido
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
