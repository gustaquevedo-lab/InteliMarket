import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Search, Plus, Eye, X, Loader2, CheckCircle,
  XCircle, Truck, FileText, Check, Ban,
  ShoppingCart, Clock, RefreshCw,
  TrendingUp, DollarSign, User, Award, RotateCcw, Receipt,
  FileSpreadsheet, ArrowUpRight, Sparkles, Filter, ChevronRight,
  ShieldCheck, AlertTriangle
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
  borrador:             { label: "Borrador",          class: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700" },
  pendiente_aprobacion: { label: "Pend. Aprobación",  class: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  aprobado:             { label: "Aprobado",          class: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  en_preparacion:       { label: "En Preparación",    class: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" },
  listo:                { label: "Listo para Despacho", class: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20" },
  facturado:            { label: "Facturado",         class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  completado:           { label: "Completado",        class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  cancelado:            { label: "Cancelado",         class: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" },
  rechazado:            { label: "Rechazado",         class: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" },
}

const QUOTE_STATUS_META: Record<string, { label: string; class: string }> = {
  vigente:    { label: "Vigente",    class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  aceptada:   { label: "Aceptada",   class: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  rechazada:  { label: "Rechazada",  class: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" },
  expirada:   { label: "Expirada",   class: "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700" },
  convertida: { label: "Convertida", class: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" },
}

const PRIORITY_BADGES: Record<string, { label: string; class: string }> = {
  normal:  { label: "Normal",  class: "text-blue-600 bg-blue-500/10 border border-blue-500/20" },
  alta:    { label: "Alta",    class: "text-amber-600 bg-amber-500/10 border border-amber-500/20" },
  urgente: { label: "Urgente", class: "text-rose-600 bg-rose-500/10 border border-rose-500/20" },
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

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/90 text-white p-7 border border-amber-500/20 shadow-2xl shadow-amber-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 border border-amber-400/30 text-white flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                    GESTIÓN COMERCIAL · PEDIDOS & PRESUPUESTOS
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {tab === "orders" ? `${orderKpi.pendientes} Pedidos Pendientes` : `${quoteKpi.vigentes} Cotizaciones Vigentes`}
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Pedidos & Cotizaciones Comerciales
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Emisión de órdenes de venta, reserva de stock, cotizaciones formales y conversión a factura oficial
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Ventas Mayoristas & Salón)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-400">
                📦 {orders.length} pedidos totales
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-orange-300">
                📋 {quotes.length} cotizaciones registradas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Recargar
            </button>

            {tab === "orders" ? (
              <button
                onClick={() => setShowCreateOrder(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-300 hover:to-orange-200 transition shadow-lg shadow-amber-500/25 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nuevo Pedido
              </button>
            ) : (
              <button
                onClick={() => setShowCreateQuote(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-300 hover:to-orange-200 transition shadow-lg shadow-amber-500/25 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nueva Cotización
              </button>
            )}
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {tab === "orders" ? "Monto Pedidos Activos" : "Monto Cotizado Activo"}
              </span>
              <span className="text-[10px] font-bold text-amber-400">Total</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {formatPYG(tab === "orders" ? orderKpi.monto : quoteKpi.monto)}
            </p>
            <p className="text-[11px] text-slate-400">
              {tab === "orders" ? `${orderKpi.total} pedidos registrados` : `${quoteKpi.total} presupuestos`}
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {tab === "orders" ? "Pendientes Aprobación" : "Cotizaciones Vigentes"}
              </span>
              <span className="text-[10px] font-bold text-orange-400">Atención</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-orange-400">
              {tab === "orders" ? orderKpi.pendientes : quoteKpi.vigentes}
            </p>
            <p className="text-[11px] text-slate-400">Requieren gestión comercial</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {tab === "orders" ? "En Preparación / Despacho" : "Aceptadas / Convertidas"}
              </span>
              <span className="text-[10px] font-bold text-blue-400">Flujo</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {tab === "orders" ? orderKpi.en_curso : quoteKpi.aceptadas}
            </p>
            <p className="text-[11px] text-slate-400">En ruta de facturación</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {tab === "orders" ? "Completados / Facturados" : "Tasa de Conversión"}
              </span>
              <span className="text-[10px] font-mono text-emerald-400">Cierre</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {tab === "orders" ? orderKpi.completados : `${quoteKpi.total > 0 ? Math.round((quoteKpi.aceptadas / quoteKpi.total) * 100) : 0}%`}
            </p>
            <p className="text-[11px] text-slate-400">Efectividad de cierre</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        <button
          onClick={() => setTab("orders")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            tab === "orders"
              ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Pedidos de Venta</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            tab === "orders" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
          }`}>
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setTab("quotes")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            tab === "quotes"
              ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Cotizaciones & Presupuestos</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
            tab === "quotes" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
          }`}>
            {quotes.length}
          </span>
        </button>
      </div>

      {/* ══════════════════════ TAB 1: PEDIDOS DE VENTA ══════════════════════ */}
      {tab === "orders" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 w-4 h-4 text-slate-400 top-3" />
              <input
                type="text"
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                placeholder="Buscar pedido por número, cliente o RUC..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={orderFilterEstado}
                onChange={e => setOrderFilterEstado(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="todos">Todos los Estados</option>
                <option value="pendiente_aprobacion">Pendiente Aprobación</option>
                <option value="aprobado">Aprobado</option>
                <option value="en_preparacion">En Preparación</option>
                <option value="listo">Listo</option>
                <option value="facturado">Facturado</option>
                <option value="cancelado">Cancelado</option>
              </select>

              <select
                value={orderFilterPrioridad}
                onChange={e => setOrderFilterPrioridad(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="todos">Todas las Prioridades</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>

              <button
                onClick={fetchOrders}
                className="p-2.5 text-slate-400 hover:text-amber-500 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${ordersLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Nº Pedido</th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">RUC</th>
                    <th className="p-4 text-center">Prioridad</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {ordersLoading ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                        <span>Cargando pedidos...</span>
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        No se encontraron pedidos de venta.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                          {o.numero || `PED-${o.id.slice(-6)}`}
                        </td>
                        <td className="p-4 text-slate-500 font-mono text-[11px]">
                          {formatDate(o.created_at)}
                        </td>
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                          {o.customer?.razon_social || "Consumidor"}
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-[11px]">
                          {o.customer?.ruc || "-"}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${PRIORITY_BADGES[o.prioridad || "normal"]?.class}`}>
                            {PRIORITY_BADGES[o.prioridad || "normal"]?.label}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${ORDER_STATUS_META[o.estado || "borrador"]?.class || ""}`}>
                            {ORDER_STATUS_META[o.estado || "borrador"]?.label || o.estado}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">
                          {formatPYG(o.total || 0)}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingOrder(o)}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {o.estado === "pendiente_aprobacion" && (
                              <button
                                onClick={() => handleApproveOrder(o)}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition"
                                title="Aprobar pedido"
                              >
                                <Check className="w-4 h-4" />
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

      {/* ══════════════════════ TAB 2: COTIZACIONES ══════════════════════ */}
      {tab === "quotes" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 w-4 h-4 text-slate-400 top-3" />
              <input
                type="text"
                value={quoteSearch}
                onChange={e => setQuoteSearch(e.target.value)}
                placeholder="Buscar cotización por número o cliente..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={quoteFilterEstado}
                onChange={e => setQuoteFilterEstado(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="todos">Todos los Estados</option>
                <option value="vigente">Vigente</option>
                <option value="aceptada">Aceptada</option>
                <option value="convertida">Convertida</option>
                <option value="rechazada">Rechazada</option>
                <option value="expirada">Expirada</option>
              </select>

              <button
                onClick={handleExpireQuotes}
                className="px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Depurar Vencidas
              </button>

              <button
                onClick={fetchQuotes}
                className="p-2.5 text-slate-400 hover:text-amber-500 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${quotesLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Nº Cotización</th>
                    <th className="p-4">Fecha Emisión</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Válida Hasta</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {quotesLoading ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                        <span>Cargando cotizaciones...</span>
                      </td>
                    </tr>
                  ) : filteredQuotes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        No se encontraron cotizaciones comerciales.
                      </td>
                    </tr>
                  ) : (
                    filteredQuotes.map(q => (
                      <tr key={q.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                          {q.numero || `COT-${q.id.slice(-6)}`}
                        </td>
                        <td className="p-4 text-slate-500 font-mono text-[11px]">
                          {formatDate(q.created_at)}
                        </td>
                        <td className="p-4 font-bold text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                          {q.customer?.razon_social || "Consumidor"}
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-[11px]">
                          {q.valido_hasta ? formatDate(q.valido_hasta) : "Sin vencimiento"}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${QUOTE_STATUS_META[q.estado || "vigente"]?.class || ""}`}>
                            {QUOTE_STATUS_META[q.estado || "vigente"]?.label || q.estado}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">
                          {formatPYG(q.total || 0)}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingQuote(q)}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {q.estado === "vigente" && (
                              <button
                                onClick={() => handleQuoteStatus(q.id, "aceptada")}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition"
                                title="Marcar como Aceptada"
                              >
                                <Check className="w-4 h-4" />
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

      {/* ── MODAL CREAR PEDIDO ── */}
      {showCreateOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Nuevo Pedido de Venta</h3>
                <p className="text-xs text-slate-400">Emisión de orden comercial y reserva de mercadería</p>
              </div>
              <button onClick={() => setShowCreateOrder(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Formulario de pedido */}
            <OrderForm customers={customers} products={products} onClose={() => setShowCreateOrder(false)} onCreated={fetchOrders} />
          </div>
        </div>
      )}

      {/* ── MODAL CREAR COTIZACIÓN ── */}
      {showCreateQuote && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Nueva Cotización Comercial</h3>
                <p className="text-xs text-slate-400">Propuesta de precios con validez temporal</p>
              </div>
              <button onClick={() => setShowCreateQuote(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <QuoteForm customers={customers} products={products} onClose={() => setShowCreateQuote(false)} onCreated={fetchQuotes} />
          </div>
        </div>
      )}

      {/* ── MODAL VER PEDIDO ── */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Detalle de Pedido {viewingOrder.numero}</h3>
                <p className="text-xs text-slate-400">Estado: {ORDER_STATUS_META[viewingOrder.estado || "borrador"]?.label || viewingOrder.estado}</p>
              </div>
              <button onClick={() => setViewingOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl space-y-1">
                <div className="flex justify-between"><span className="text-slate-400">Cliente:</span><strong className="text-slate-900 dark:text-white">{viewingOrder.customer?.razon_social || "Consumidor"}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">RUC:</span><span className="font-mono text-slate-700 dark:text-slate-300">{viewingOrder.customer?.ruc || "-"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Prioridad:</span><span className="font-bold uppercase text-amber-500">{viewingOrder.prioridad}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Condición:</span><span className="font-bold uppercase text-blue-500">{viewingOrder.condicion}</span></div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Productos Solicitados</span>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(viewingOrder.items || []).map((i, idx) => (
                    <div key={idx} className="py-2 flex justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{(i as any).product?.nombre || (i as any).producto?.nombre || (i as any).nombre || "Producto"}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{i.cantidad} un. x {formatPYG(i.precio_unitario || 0)}</p>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatPYG((i.cantidad || 0) * (i.precio_unitario || 0))}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-sm font-black">
                <span>Total Pedido:</span>
                <span className="font-mono text-amber-500">{formatPYG(viewingOrder.total || 0)}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button onClick={() => setViewingOrder(null)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderForm({ customers, products, onClose, onCreated }: any) {
  const toast = useToast()
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null)
  const [custSearch, setCustSearch] = useState("")
  const [prioridad, setPrioridad] = useState("normal")
  const [condicion, setCondicion] = useState("contado")
  const [fechaEntrega, setFechaEntrega] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [items, setItems] = useState<Array<{ product_id: string; nombre: string; cantidad: number; precio_unitario: number; iva_tasa: number }>>([])
  const [prodSearch, setProdSearch] = useState("")
  const [saving, setSaving] = useState(false)

  const filtCusts = customers.filter((c: any) => !custSearch || (c.razon_social || "").toLowerCase().includes(custSearch.toLowerCase()) || (c.ruc || "").includes(custSearch)).slice(0, 5)
  const filtProds = products.filter((p: any) => !prodSearch || (p.nombre || "").toLowerCase().includes(prodSearch.toLowerCase()) || (p.codigo_barra || (p as any).codigo || "").includes(prodSearch)).slice(0, 6)

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
      onClose()
      onCreated()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo crear el pedido")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 text-xs">
      <div>
        <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Cliente *</label>
        {selectedCust ? (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <div className="flex-1">
              <p className="font-bold text-slate-900 dark:text-white">{selectedCust.razon_social}</p>
              <p className="text-[11px] text-slate-400 font-mono">RUC: {selectedCust.ruc}</p>
            </div>
            <button onClick={() => setSelectedCust(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              value={custSearch}
              onChange={e => setCustSearch(e.target.value)}
              placeholder="Buscar cliente por Razón Social o RUC..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white"
            />
            {custSearch && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {filtCusts.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCust(c); setCustSearch("") }}
                    className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between"
                  >
                    <span className="font-bold text-xs">{c.razon_social}</span>
                    <span className="font-mono text-slate-400 text-[11px]">{c.ruc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Prioridad</label>
          <select value={prioridad} onChange={e => setPrioridad(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-bold">
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>
        <div>
          <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Condición</label>
          <select value={condicion} onChange={e => setCondicion(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-bold">
            <option value="contado">Contado</option>
            <option value="credito">Crédito</option>
          </select>
        </div>
        <div>
          <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Fecha Entrega</label>
          <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-mono" />
        </div>
      </div>

      <div>
        <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Productos *</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            value={prodSearch}
            onChange={e => setProdSearch(e.target.value)}
            placeholder="Buscar producto por nombre o código..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white"
          />
          {prodSearch && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filtProds.map((p: any) => (
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
                  className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between"
                >
                  <span className="font-bold text-xs">{p.nombre}</span>
                  <span className="font-mono font-bold text-emerald-600 text-xs">{formatPYG(p.precio || 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="flex-1">
                  <p className="font-bold text-xs">{item.nombre}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{formatPYG(item.precio_unitario)} c/u</p>
                </div>
                <input
                  type="number"
                  min={1}
                  value={item.cantidad}
                  onChange={e => setItems(prev => prev.map((i, k) => k === idx ? { ...i, cantidad: parseInt(e.target.value) || 1 } : i))}
                  className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 text-center font-mono font-bold text-xs"
                />
                <span className="font-mono font-bold text-xs min-w-[80px] text-right">{formatPYG(item.cantidad * item.precio_unitario)}</span>
                <button onClick={() => setItems(prev => prev.filter((_, k) => k !== idx))} className="text-rose-400 hover:text-rose-600 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 font-bold">
              <span>Total Estimado:</span>
              <span className="font-mono text-amber-500 font-black text-sm">{formatPYG(subtotal)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button onClick={onClose} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{saving ? "Emitiendo..." : "Emitir Pedido"}</span>
        </button>
      </div>
    </div>
  )
}

function QuoteForm({ customers, products, onClose, onCreated }: any) {
  const toast = useToast()
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null)
  const [custSearch, setCustSearch] = useState("")
  const [validoHasta, setValidoHasta] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [items, setItems] = useState<Array<{ product_id: string; nombre: string; cantidad: number; precio_unitario: number }>>([])
  const [prodSearch, setProdSearch] = useState("")
  const [saving, setSaving] = useState(false)

  const filtCusts = customers.filter((c: any) => !custSearch || (c.razon_social || "").toLowerCase().includes(custSearch.toLowerCase()) || (c.ruc || "").includes(custSearch)).slice(0, 5)
  const filtProds = products.filter((p: any) => !prodSearch || (p.nombre || "").toLowerCase().includes(prodSearch.toLowerCase()) || (p.codigo_barra || (p as any).codigo || "").includes(prodSearch)).slice(0, 6)

  const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0)

  const handleSubmit = async () => {
    if (!selectedCust) { toast.error("Error", "Seleccioná un cliente"); return }
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
      onClose()
      onCreated()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo crear la cotización")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 text-xs">
      <div>
        <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Cliente *</label>
        {selectedCust ? (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <div className="flex-1">
              <p className="font-bold text-slate-900 dark:text-white">{selectedCust.razon_social}</p>
              <p className="text-[11px] text-slate-400 font-mono">RUC: {selectedCust.ruc}</p>
            </div>
            <button onClick={() => setSelectedCust(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              value={custSearch}
              onChange={e => setCustSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white"
            />
            {custSearch && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {filtCusts.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCust(c); setCustSearch("") }}
                    className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between"
                  >
                    <span className="font-bold text-xs">{c.razon_social}</span>
                    <span className="font-mono text-slate-400 text-[11px]">{c.ruc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Válida Hasta</label>
        <input type="date" value={validoHasta} onChange={e => setValidoHasta(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-mono" />
      </div>

      <div>
        <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Productos Cotizados *</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            value={prodSearch}
            onChange={e => setProdSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white"
          />
          {prodSearch && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filtProds.map((p: any) => (
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
                  className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between"
                >
                  <span className="font-bold text-xs">{p.nombre}</span>
                  <span className="font-mono font-bold text-emerald-600 text-xs">{formatPYG(p.precio || 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="flex-1">
                  <p className="font-bold text-xs">{item.nombre}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{formatPYG(item.precio_unitario)} c/u</p>
                </div>
                <input
                  type="number"
                  min={1}
                  value={item.cantidad}
                  onChange={e => setItems(prev => prev.map((i, k) => k === idx ? { ...i, cantidad: parseInt(e.target.value) || 1 } : i))}
                  className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 text-center font-mono font-bold text-xs"
                />
                <span className="font-mono font-bold text-xs min-w-[80px] text-right">{formatPYG(item.cantidad * item.precio_unitario)}</span>
                <button onClick={() => setItems(prev => prev.filter((_, k) => k !== idx))} className="text-rose-400 hover:text-rose-600 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 font-bold">
              <span>Total Cotizado:</span>
              <span className="font-mono text-amber-500 font-black text-sm">{formatPYG(subtotal)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button onClick={onClose} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving} className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{saving ? "Creando..." : "Crear Cotización"}</span>
        </button>
      </div>
    </div>
  )
}
