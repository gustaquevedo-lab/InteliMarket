import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Search, Plus, Eye, X, Loader2, CheckCircle,
  XCircle, Truck, FileText, Check, Ban,
  ShoppingCart, Clock, RefreshCw,
  TrendingUp, DollarSign, User, Award, RotateCcw, Receipt
} from "lucide-react"
import { api, type SalesOrder, type Quote, type Customer, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG, formatDate } from "../../utils/format"

/* ═══════════════════════════════════════════════════════════════════════
   METADATOS DE ESTADOS (ESTILO FACTURACIÓN)
═══════════════════════════════════════════════════════════════════════ */
const ORDER_STATUS_META: Record<string, { label: string; class: string }> = {
  borrador:             { label: "Borrador",          class: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700" },
  pendiente_aprobacion: { label: "Pend. Aprobación",  class: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  aprobado:             { label: "Aprobado",          class: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  en_preparacion:       { label: "En Preparación",    class: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" },
  listo:                { label: "Listo para Despacho", class: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20" },
  facturado:            { label: "Facturado",         class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  completado:           { label: "Completado",        class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  cancelado:            { label: "Cancelado",         class: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" },
  rechazado:            { label: "Rechazado",         class: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" },
}

const QUOTE_STATUS_META: Record<string, { label: string; class: string }> = {
  vigente:    { label: "Vigente",    class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  aceptada:   { label: "Aceptada",   class: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  rechazada:  { label: "Rechazada",  class: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" },
  expirada:   { label: "Expirada",   class: "bg-gray-100 dark:bg-slate-800 text-gray-400 border border-gray-200 dark:border-gray-700" },
  convertida: { label: "Convertida", class: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" },
}

const PRIORITY_BADGES: Record<string, { label: string; class: string }> = {
  normal:  { label: "Normal",  class: "text-blue-600 bg-blue-500/10 border border-blue-500/20" },
  alta:    { label: "Alta",    class: "text-amber-600 bg-amber-500/10 border border-amber-500/20" },
  urgente: { label: "Urgente", class: "text-red-600 bg-red-500/10 border border-red-500/20" },
}

export default function PedidosCotizacionesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()

  const [tab, setTab] = useState<"orders" | "quotes">("orders")
  const [refreshing, setRefreshing] = useState(false)

  // ── PEDIDOS ──────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [orderSearch, setOrderSearch] = useState("")
  const [orderFilterEstado, setOrderFilterEstado] = useState("todos")
  const [orderFilterPrioridad, setOrderFilterPrioridad] = useState("todos")
  const [viewingOrder, setViewingOrder] = useState<SalesOrder | null>(null)
  const [showCreateOrder, setShowCreateOrder] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── COTIZACIONES ──────────────────────────────────────────────────────
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [quoteSearch, setQuoteSearch] = useState("")
  const [quoteFilterEstado, setQuoteFilterEstado] = useState("todos")
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null)
  const [showCreateQuote, setShowCreateQuote] = useState(false)

  // ── SHARED DATA ──────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])

  /* ── DATA FETCH ────────────────────────────────────────────────────── */
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const data = await api.salesOrders.list({ estado: orderFilterEstado !== "todos" ? orderFilterEstado : undefined })
      setOrders(data)
    } catch {
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [orderFilterEstado])

  const fetchQuotes = useCallback(async () => {
    setQuotesLoading(true)
    try {
      const data = await api.quotes.list({ estado: quoteFilterEstado !== "todos" ? quoteFilterEstado : undefined })
      setQuotes(data)
    } catch {
      setQuotes([])
    } finally {
      setQuotesLoading(false)
    }
  }, [quoteFilterEstado])

  const fetchShared = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        api.customers.list(),
        api.products.list({ limit: 100 }),
      ])
      setCustomers(c)
      setProducts(Array.isArray(p) ? p : (p as any)?.items || [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchOrders()
    fetchQuotes()
    fetchShared()
  }, [])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchOrders(), fetchQuotes(), fetchShared()])
    setRefreshing(false)
  }

  /* ── KPIS COMPUTADOS ─────────────────────────────────── */
  const orderKpi = useMemo(() => {
    const total = orders.length
    const pendientes = orders.filter(o => o.estado === "pendiente_aprobacion" || o.estado === "borrador").length
    const en_curso = orders.filter(o => o.estado === "aprobado" || o.estado === "en_preparacion" || o.estado === "listo").length
    const completados = orders.filter(o => o.estado === "completado" || o.estado === "facturado").length
    const cancelados = orders.filter(o => o.estado === "cancelado" || o.estado === "rechazado").length
    const monto = orders.filter(o => o.estado !== "cancelado" && o.estado !== "rechazado").reduce((acc, o) => acc + (o.total || 0), 0)
    return { total, pendientes, en_curso, completados, cancelados, monto }
  }, [orders])

  const quoteKpi = useMemo(() => {
    const total = quotes.length
    const vigentes = quotes.filter(q => q.estado === "vigente").length
    const aceptadas = quotes.filter(q => q.estado === "aceptada" || q.estado === "convertida").length
    const rechazadas = quotes.filter(q => q.estado === "rechazada" || q.estado === "expirada").length
    const monto = quotes.filter(q => q.estado === "vigente" || q.estado === "aceptada").reduce((acc, q) => acc + (q.total || 0), 0)
    return { total, vigentes, aceptadas, rechazadas, monto }
  }, [quotes])

  /* ── FILTROS ─────────────────────────────────────────────────────────── */
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = !orderSearch.trim() ||
        (o.numero || "").toLowerCase().includes(orderSearch.toLowerCase()) ||
        (o.customer?.razon_social || "").toLowerCase().includes(orderSearch.toLowerCase()) ||
        (o.customer?.ruc || "").toLowerCase().includes(orderSearch.toLowerCase())
      const matchEstado = orderFilterEstado === "todos" || o.estado === orderFilterEstado
      const matchPrioridad = orderFilterPrioridad === "todos" || o.prioridad === orderFilterPrioridad
      return matchSearch && matchEstado && matchPrioridad
    })
  }, [orders, orderSearch, orderFilterEstado, orderFilterPrioridad])

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const matchSearch = !quoteSearch.trim() ||
        (q.numero || "").toLowerCase().includes(quoteSearch.toLowerCase()) ||
        (q.customer?.razon_social || "").toLowerCase().includes(quoteSearch.toLowerCase()) ||
        (q.customer?.ruc || "").toLowerCase().includes(quoteSearch.toLowerCase())
      const matchEstado = quoteFilterEstado === "todos" || q.estado === quoteFilterEstado
      return matchSearch && matchEstado
    })
  }, [quotes, quoteSearch, quoteFilterEstado])

  /* ── ACCIONES ────────────────────────────────────────────── */
  const handleOrderStatusChange = async (order: SalesOrder, target: string) => {
    setSubmitting(true)
    try {
      await api.salesOrders.changeStatus(order.id, target)
      toast.success("Estado actualizado", `Pedido ${order.numero} → ${ORDER_STATUS_META[target]?.label || target}`)
      fetchOrders()
    } catch {
      toast.error("Error", "No se pudo actualizar el estado")
    } finally {
      setSubmitting(false)
    }
  }

  const handleApproveOrder = async (order: SalesOrder) => {
    const confirmed = await confirm({
      title: "Aprobar pedido de venta",
      message: `¿Confirmar la aprobación comercial del pedido ${order.numero}?`,
      confirmText: "Aprobar Pedido",
      variant: "info"
    })
    if (!confirmed) return
    setSubmitting(true)
    try {
      await api.salesOrders.approve(order.id, user?.id || user?.email || "admin")
      toast.success("Pedido Aprobado", `El pedido ${order.numero} fue aprobado para preparación`)
      fetchOrders()
    } catch {
      toast.error("Error", "No se pudo aprobar el pedido")
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuoteStatus = async (id: string, estado: string) => {
    try {
      const updated = await api.quotes.changeStatus(id, estado)
      setQuotes(prev => prev.map(q => q.id === id ? updated : q))
      toast.success("Estado actualizado", `Cotización marcada como ${QUOTE_STATUS_META[estado]?.label || estado}`)
    } catch {
      toast.error("Error", "No se pudo actualizar el estado")
    }
  }

  const handleExpireQuotes = async () => {
    try {
      const result = await api.quotes.expire()
      toast.success("Cotizaciones depuradas", `${(result as any).expiradas || 0} cotizaciones vencidas marcadas como expiradas`)
      fetchQuotes()
    } catch {
      toast.error("Error", "No se pudieron expirar cotizaciones")
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     MODAL CREAR PEDIDO
  ═══════════════════════════════════════════════════════════════════ */
  function CreateOrderModal() {
    const [selectedCust, setSelectedCust] = useState<Customer | null>(null)
    const [custSearch, setCustSearch] = useState("")
    const [prioridad, setPrioridad] = useState("normal")
    const [condicion, setCondicion] = useState("contado")
    const [fechaEntrega, setFechaEntrega] = useState("")
    const [observaciones, setObservaciones] = useState("")
    const [items, setItems] = useState<Array<{ product_id: string; nombre: string; cantidad: number; precio_unitario: number; iva_tasa: number }>>([])
    const [prodSearch, setProdSearch] = useState("")
    const [saving, setSaving] = useState(false)

    const filtCusts = customers.filter(c => !custSearch || (c.razon_social || "").toLowerCase().includes(custSearch.toLowerCase()) || (c.ruc || "").includes(custSearch)).slice(0, 5)
    const filtProds = products.filter(p => !prodSearch || (p.nombre || "").toLowerCase().includes(prodSearch.toLowerCase()) || (p.codigo_barra || (p as any).codigo || "").includes(prodSearch)).slice(0, 6)

    const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0)

    const handleSubmit = async () => {
      if (!selectedCust) { toast.error("Error", "Seleccioná un cliente comercial"); return }
      if (items.length === 0) { toast.error("Error", "Agregá al menos un producto"); return }
      setSaving(true)
      try {
        await api.salesOrders.create({
          customer_id: selectedCust.id,
          prioridad,
          condicion,
          fecha_entrega_estimada: fechaEntrega || undefined,
          observaciones,
          items: items.map(i => ({
            product_id: i.product_id,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            iva_tasa: i.iva_tasa,
          })),
        })
        toast.success("Pedido emitido", "El pedido de venta fue registrado con éxito")
        setShowCreateOrder(false)
        fetchOrders()
      } catch (err: any) {
        toast.error("Error", err?.message || "No se pudo crear el pedido")
      } finally {
        setSaving(false)
      }
    }

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="card max-w-2xl w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Nuevo Pedido de Venta</h3>
              <p className="text-xs text-gray-400">Emisión de orden comercial y reserva de mercadería</p>
            </div>
            <button onClick={() => setShowCreateOrder(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Cliente *</label>
              {selectedCust ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white">{selectedCust.razon_social}</p>
                    <p className="text-[11px] text-gray-400 font-mono">RUC: {selectedCust.ruc}</p>
                  </div>
                  <button onClick={() => setSelectedCust(null)} className="text-red-500 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    value={custSearch}
                    onChange={e => setCustSearch(e.target.value)}
                    placeholder="Buscar cliente por Razón Social o RUC..."
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary"
                  />
                  {custSearch && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                      {filtCusts.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCust(c); setCustSearch("") }}
                          className="w-full p-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex justify-between"
                        >
                          <span className="font-bold text-xs">{c.razon_social}</span>
                          <span className="font-mono text-gray-400 text-[11px]">{c.ruc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Prioridad</label>
                <select value={prioridad} onChange={e => setPrioridad(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs font-bold">
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Condición</label>
                <select value={condicion} onChange={e => setCondicion(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs font-bold">
                  <option value="contado">Contado</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>
              <div>
                <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Fecha Entrega</label>
                <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs font-mono" />
              </div>
            </div>

            <div>
              <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Productos *</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  placeholder="Buscar producto por nombre o código..."
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary"
                />
                {prodSearch && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                    {filtProds.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setItems(prev => {
                            const ex = prev.find(i => i.product_id === p.id)
                            if (ex) return prev.map(i => i.product_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
                            return [...prev, { product_id: p.id, nombre: p.nombre, cantidad: 1, precio_unitario: p.precio || 0, iva_tasa: (p as any).iva_tasa || 10 }]
                          })
                          setProdSearch("")
                        }}
                        className="w-full p-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex justify-between"
                      >
                        <span className="font-bold text-xs">{p.nombre}</span>
                        <span className="font-mono font-bold text-emerald-600 text-xs">{formatPYG(p.precio || 0)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700">
                      <div className="flex-1">
                        <p className="font-bold text-xs">{item.nombre}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{formatPYG(item.precio_unitario)} c/u</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={e => setItems(prev => prev.map((i, k) => k === idx ? { ...i, cantidad: parseInt(e.target.value) || 1 } : i))}
                        className="w-14 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-1 text-center font-mono font-bold text-xs"
                      />
                      <span className="font-mono font-bold text-xs min-w-[80px] text-right">{formatPYG(item.cantidad * item.precio_unitario)}</span>
                      <button onClick={() => setItems(prev => prev.filter((_, k) => k !== idx))} className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800 font-bold">
                    <span>Total:</span>
                    <span className="font-mono text-primary font-black text-sm">{formatPYG(subtotal)}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Instrucciones de entrega..."
                rows={2}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button onClick={() => setShowCreateOrder(false)} className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs px-4 py-2 rounded-xl">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={saving} className="btn bg-primary text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{saving ? "Emitiendo..." : "Emitir Pedido"}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════════════
     MODAL CREAR COTIZACIÓN
  ═══════════════════════════════════════════════════════════════════ */
  function CreateQuoteModal() {
    const [selectedCust, setSelectedCust] = useState<Customer | null>(null)
    const [custSearch, setCustSearch] = useState("")
    const [validoHasta, setValidoHasta] = useState("")
    const [observaciones, setObservaciones] = useState("")
    const [items, setItems] = useState<Array<{ product_id: string; nombre: string; cantidad: number; precio_unitario: number }>>([])
    const [prodSearch, setProdSearch] = useState("")
    const [saving, setSaving] = useState(false)

    const filtCusts = customers.filter(c => !custSearch || (c.razon_social || "").toLowerCase().includes(custSearch.toLowerCase()) || (c.ruc || "").includes(custSearch)).slice(0, 5)
    const filtProds = products.filter(p => !prodSearch || (p.nombre || "").toLowerCase().includes(prodSearch.toLowerCase()) || (p.codigo_barra || (p as any).codigo || "").includes(prodSearch)).slice(0, 6)

    const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0)

    const handleSubmit = async () => {
      if (!selectedCust) { toast.error("Error", "Seleccioná un cliente para la cotización"); return }
      if (items.length === 0) { toast.error("Error", "Agregá al menos un producto"); return }
      setSaving(true)
      try {
        await api.quotes.create({
          customer_id: selectedCust.id,
          valido_hasta: validoHasta || undefined,
          observaciones,
          items: items.map(i => ({
            product_id: i.product_id,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
          })),
        })
        toast.success("Cotización creada", "La propuesta comercial fue generada")
        setShowCreateQuote(false)
        fetchQuotes()
      } catch (err: any) {
        toast.error("Error", err?.message || "No se pudo crear la cotización")
      } finally {
        setSaving(false)
      }
    }

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="card max-w-2xl w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Nueva Cotización Comercial</h3>
              <p className="text-xs text-gray-400">Propuesta de precios con validez temporal</p>
            </div>
            <button onClick={() => setShowCreateQuote(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Cliente *</label>
              {selectedCust ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white">{selectedCust.razon_social}</p>
                    <p className="text-[11px] text-gray-400 font-mono">RUC: {selectedCust.ruc}</p>
                  </div>
                  <button onClick={() => setSelectedCust(null)} className="text-red-500 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    value={custSearch}
                    onChange={e => setCustSearch(e.target.value)}
                    placeholder="Buscar cliente por Razón Social o RUC..."
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary"
                  />
                  {custSearch && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                      {filtCusts.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCust(c); setCustSearch("") }}
                          className="w-full p-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex justify-between"
                        >
                          <span className="font-bold text-xs">{c.razon_social}</span>
                          <span className="font-mono text-gray-400 text-[11px]">{c.ruc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Válida Hasta</label>
              <input type="date" value={validoHasta} onChange={e => setValidoHasta(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs font-mono" />
            </div>

            <div>
              <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Productos Cotizados *</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary"
                />
                {prodSearch && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                    {filtProds.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setItems(prev => {
                            const ex = prev.find(i => i.product_id === p.id)
                            if (ex) return prev.map(i => i.product_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
                            return [...prev, { product_id: p.id, nombre: p.nombre, cantidad: 1, precio_unitario: p.precio || 0 }]
                          })
                          setProdSearch("")
                        }}
                        className="w-full p-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex justify-between"
                      >
                        <span className="font-bold text-xs">{p.nombre}</span>
                        <span className="font-mono font-bold text-emerald-600 text-xs">{formatPYG(p.precio || 0)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700">
                      <div className="flex-1">
                        <p className="font-bold text-xs">{item.nombre}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{formatPYG(item.precio_unitario)} c/u</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={e => setItems(prev => prev.map((i, k) => k === idx ? { ...i, cantidad: parseInt(e.target.value) || 1 } : i))}
                        className="w-14 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-1 text-center font-mono font-bold text-xs"
                      />
                      <span className="font-mono font-bold text-xs min-w-[80px] text-right">{formatPYG(item.cantidad * item.precio_unitario)}</span>
                      <button onClick={() => setItems(prev => prev.filter((_, k) => k !== idx))} className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800 font-bold">
                    <span>Total Cotizado:</span>
                    <span className="font-mono text-emerald-600 font-black text-sm">{formatPYG(subtotal)}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block font-black uppercase text-[10px] text-gray-400 mb-1">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Condiciones de pago y entrega..."
                rows={2}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-xs outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button onClick={() => setShowCreateQuote(false)} className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs px-4 py-2 rounded-xl">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={saving} className="btn bg-emerald-600 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:bg-emerald-500">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{saving ? "Guardando..." : "Crear Cotización"}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDER PRINCIPAL (ESTRUCTURA IDÉNTICA A SALESPAGE)
  ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER OPERATIVO ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-3">
              <FileText className="w-7 h-7 text-blue-600 dark:text-blue-400 shrink-0" />
              Pedidos & Cotizaciones
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Ventas Mayoristas & Distribución
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Gestión comercial de órdenes de venta, cotizaciones comerciales y seguimiento de despacho.
          </p>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualRefresh}
            className="p-2 text-gray-400 hover:text-primary rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {tab === "orders" ? (
            <button
              onClick={() => setShowCreateOrder(true)}
              className="btn bg-primary text-white font-extrabold text-xs flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Pedido</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleExpireQuotes}
                className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-50"
              >
                <Clock className="w-4 h-4 text-primary" />
                <span>Expirar Vencidas</span>
              </button>
              <button
                onClick={() => setShowCreateQuote(true)}
                className="btn bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm hover:bg-emerald-500"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Cotización</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── KPIS CONSOLIDADOS (ESTILO SALESPAGE) ──────────────────────────────── */}
      {tab === "orders" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-blue-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Monto en Cartera
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">
              {formatPYG(orderKpi.monto)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {orderKpi.total} órdenes registradas
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-amber-500/30 border-l-4 border-l-amber-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Pendientes Aprobación
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-amber-500 mt-2">
              {orderKpi.pendientes}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Requieren autorización comercial
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-purple-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                En Preparación / Despacho
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-purple-600 dark:text-purple-400 mt-2">
              {orderKpi.en_curso}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              En proceso de picking o entrega
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Completados & Facturados
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-2">
              {orderKpi.completados}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {orderKpi.cancelados} pedidos cancelados
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Volumen Cotizado
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">
              {formatPYG(quoteKpi.monto)}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {quoteKpi.total} cotizaciones emitidas
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Cotizaciones Vigentes
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-2">
              {quoteKpi.vigentes}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Precios válidos actualmente
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-blue-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Aceptadas / Convertidas
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-blue-600 dark:text-blue-400 mt-2">
              {quoteKpi.aceptadas}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Cerradas exitosamente
            </p>
          </div>

          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-red-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Expiradas / Rechazadas
              </span>
              <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
                <Ban className="w-4 h-4" />
              </div>
            </div>
            <div className="font-mono font-black text-2xl text-red-600 dark:text-red-400 mt-2">
              {quoteKpi.rechazadas}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              No concretadas
            </p>
          </div>
        </div>
      )}

      {/* ── NAVEGACIÓN POR PESTAÑAS (TABS OPERATIVAS) ───────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: "orders", label: "Pedidos de Venta", icon: ShoppingCart, count: orders.length },
          { id: "quotes", label: "Cotizaciones Comerciales", icon: FileText, count: quotes.length },
        ].map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${active ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── CONTENIDO: PEDIDOS ────────────────────────────────────────────── */}
      {tab === "orders" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 top-2.5" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Buscar por Nº pedido, RUC/CI o nombre del cliente..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={orderFilterEstado}
                onChange={(e) => setOrderFilterEstado(e.target.value)}
                className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
              >
                <option value="todos">Todos los Estados</option>
                <option value="borrador">Borrador</option>
                <option value="pendiente_aprobacion">Pendiente Aprobación</option>
                <option value="aprobado">Aprobado</option>
                <option value="en_preparacion">En Preparación</option>
                <option value="listo">Listo</option>
                <option value="facturado">Facturado</option>
                <option value="completado">Completado</option>
                <option value="cancelado">Cancelado</option>
              </select>

              <select
                value={orderFilterPrioridad}
                onChange={(e) => setOrderFilterPrioridad(e.target.value)}
                className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
              >
                <option value="todos">Todas las Prioridades</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">Nº Pedido</th>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">RUC / C.I.</th>
                    <th className="p-3.5 text-center">Prioridad</th>
                    <th className="p-3.5 text-center">Condición</th>
                    <th className="p-3.5 text-right">Monto Total</th>
                    <th className="p-3.5 text-center">Estado</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {ordersLoading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        <span>Cargando pedidos...</span>
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400">
                        No se encontraron pedidos coincidentes.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-primary">
                          {order.numero}
                        </td>
                        <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                          {order.fecha ? formatDate(order.fecha) : "—"}
                        </td>
                        <td className="p-3.5 font-bold text-gray-800 dark:text-gray-200 max-w-[180px] truncate">
                          {order.customer?.razon_social || "Cliente General"}
                        </td>
                        <td className="p-3.5 font-mono text-gray-500 text-[11px]">
                          {order.customer?.ruc || "—"}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${PRIORITY_BADGES[order.prioridad || "normal"]?.class || ""}`}>
                            {PRIORITY_BADGES[order.prioridad || "normal"]?.label || order.prioridad}
                          </span>
                        </td>
                        <td className="p-3.5 text-center capitalize text-gray-600 dark:text-gray-300">
                          {order.condicion || "contado"}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-gray-900 dark:text-white">
                          {formatPYG(order.total || 0)}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${ORDER_STATUS_META[order.estado || "borrador"]?.class || ""}`}>
                            {ORDER_STATUS_META[order.estado || "borrador"]?.label || order.estado}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingOrder(order)}
                              className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                              title="Ver Detalle"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {order.estado === "pendiente_aprobacion" && (
                              <button
                                onClick={() => handleApproveOrder(order)}
                                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1"
                                title="Aprobar Pedido"
                              >
                                <Check className="w-3 h-3" />
                                <span>Aprobar</span>
                              </button>
                            )}

                            {order.estado === "aprobado" && (
                              <button
                                onClick={() => handleOrderStatusChange(order, "en_preparacion")}
                                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center gap-1"
                                title="Pasar a Preparación"
                              >
                                <Truck className="w-3 h-3" />
                                <span>Preparar</span>
                              </button>
                            )}

                            {order.estado === "en_preparacion" && (
                              <button
                                onClick={() => handleOrderStatusChange(order, "listo")}
                                className="px-2 py-1 rounded-lg text-[11px] font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs flex items-center gap-1"
                                title="Marcar como Listo"
                              >
                                <CheckCircle className="w-3 h-3" />
                                <span>Listo</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENIDO: COTIZACIONES ────────────────────────────────────────── */}
      {tab === "quotes" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 top-2.5" />
              <input
                type="text"
                value={quoteSearch}
                onChange={(e) => setQuoteSearch(e.target.value)}
                placeholder="Buscar por Nº cotización, RUC/CI o cliente..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary text-gray-900 dark:text-white"
              />
            </div>

            <select
              value={quoteFilterEstado}
              onChange={(e) => setQuoteFilterEstado(e.target.value)}
              className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="todos">Todos los Estados</option>
              <option value="vigente">Vigente</option>
              <option value="aceptada">Aceptada</option>
              <option value="convertida">Convertida</option>
              <option value="rechazada">Rechazada</option>
              <option value="expirada">Expirada</option>
            </select>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">Nº Cotización</th>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">RUC / C.I.</th>
                    <th className="p-3.5">Validez</th>
                    <th className="p-3.5 text-right">Monto Total</th>
                    <th className="p-3.5 text-center">Estado</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                  {quotesLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                        <span>Cargando cotizaciones...</span>
                      </td>
                    </tr>
                  ) : filteredQuotes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">
                        No se encontraron cotizaciones coincidentes.
                      </td>
                    </tr>
                  ) : (
                    filteredQuotes.map(quote => (
                      <tr key={quote.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-emerald-600">
                          {quote.numero}
                        </td>
                        <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                          {quote.fecha ? formatDate(quote.fecha) : "—"}
                        </td>
                        <td className="p-3.5 font-bold text-gray-800 dark:text-gray-200 max-w-[180px] truncate">
                          {quote.customer?.razon_social || "Cliente Mayorista"}
                        </td>
                        <td className="p-3.5 font-mono text-gray-500 text-[11px]">
                          {quote.customer?.ruc || "—"}
                        </td>
                        <td className="p-3.5 font-mono text-[11px]">
                          {quote.valido_hasta ? (
                            <span className={new Date(quote.valido_hasta) < new Date() ? "text-red-500 font-bold" : "text-gray-600 dark:text-gray-300"}>
                              {formatDate(quote.valido_hasta)}
                            </span>
                          ) : (
                            <span className="text-gray-400">Sin límite</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-gray-900 dark:text-white">
                          {formatPYG(quote.total || 0)}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${QUOTE_STATUS_META[quote.estado || "vigente"]?.class || ""}`}>
                            {QUOTE_STATUS_META[quote.estado || "vigente"]?.label || quote.estado}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingQuote(quote)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                              title="Ver Detalle"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {quote.estado === "vigente" && (
                              <>
                                <button
                                  onClick={() => handleQuoteStatus(quote.id, "aceptada")}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                                  title="Aceptar"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleQuoteStatus(quote.id, "rechazada")}
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20"
                                  title="Rechazar"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALES ── */}
      {showCreateOrder && <CreateOrderModal />}
      {showCreateQuote && <CreateQuoteModal />}

      {/* Detalle Pedido */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-lg w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Pedido Nº {viewingOrder.numero}</h3>
                <p className="text-xs text-gray-400">{viewingOrder.customer?.razon_social || "Cliente"}</p>
              </div>
              <button onClick={() => setViewingOrder(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${ORDER_STATUS_META[viewingOrder.estado || "borrador"]?.class || ""}`}>
                  {ORDER_STATUS_META[viewingOrder.estado || "borrador"]?.label || viewingOrder.estado}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${PRIORITY_BADGES[viewingOrder.prioridad || "normal"]?.class || ""}`}>
                  Prioridad {PRIORITY_BADGES[viewingOrder.prioridad || "normal"]?.label || viewingOrder.prioridad}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Condición</span>
                  <p className="font-bold text-gray-900 dark:text-white capitalize">{viewingOrder.condicion || "Contado"}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Moneda</span>
                  <p className="font-bold text-gray-900 dark:text-white">{viewingOrder.moneda || "PYG (₲)"}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Fecha</span>
                  <p className="font-bold text-gray-900 dark:text-white">{viewingOrder.fecha ? formatDate(viewingOrder.fecha) : "—"}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Total</span>
                  <p className="font-mono font-black text-base text-primary">{formatPYG(viewingOrder.total || 0)}</p>
                </div>
              </div>

              {viewingOrder.observaciones && (
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700/50 text-gray-500 italic">
                  "{viewingOrder.observaciones}"
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setViewingOrder(null)} className="btn bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs px-4 py-2 rounded-xl font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle Cotización */}
      {viewingQuote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-lg w-full p-6 space-y-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-2xl animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Cotización Nº {viewingQuote.numero}</h3>
                <p className="text-xs text-gray-400">{viewingQuote.customer?.razon_social || "Cliente"}</p>
              </div>
              <button onClick={() => setViewingQuote(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${QUOTE_STATUS_META[viewingQuote.estado || "vigente"]?.class || ""}`}>
                {QUOTE_STATUS_META[viewingQuote.estado || "vigente"]?.label || viewingQuote.estado}
              </span>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Válida Hasta</span>
                  <p className="font-bold text-gray-900 dark:text-white">{viewingQuote.valido_hasta ? formatDate(viewingQuote.valido_hasta) : "Sin límite"}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Moneda</span>
                  <p className="font-bold text-gray-900 dark:text-white">{viewingQuote.moneda || "PYG (₲)"}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Fecha Emisión</span>
                  <p className="font-bold text-gray-900 dark:text-white">{viewingQuote.fecha ? formatDate(viewingQuote.fecha) : "—"}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Total Cotizado</span>
                  <p className="font-mono font-black text-base text-emerald-600">{formatPYG(viewingQuote.total || 0)}</p>
                </div>
              </div>

              {viewingQuote.observaciones && (
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700/50 text-gray-500 italic">
                  "{viewingQuote.observaciones}"
                </div>
              )}

              {viewingQuote.estado === "vigente" && (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => { handleQuoteStatus(viewingQuote.id, "aceptada"); setViewingQuote(null) }}
                    className="flex-1 btn bg-emerald-600 text-white text-xs py-2 rounded-xl font-bold flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Aceptar Cotización</span>
                  </button>
                  <button
                    onClick={() => { handleQuoteStatus(viewingQuote.id, "rechazada"); setViewingQuote(null) }}
                    className="flex-1 btn bg-red-50 dark:bg-red-950/30 text-red-600 text-xs py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-900"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Rechazar</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setViewingQuote(null)} className="btn bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs px-4 py-2 rounded-xl font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
