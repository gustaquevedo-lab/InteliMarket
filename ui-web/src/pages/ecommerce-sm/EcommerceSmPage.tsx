import React, { useState, useEffect } from "react"
import {
  ShoppingCart, Package, MapPin, ClipboardList, CreditCard, Smartphone, Store,
  Truck, Clock, TrendingUp, CheckCircle, XCircle, Eye, Search, Loader2,
  ChevronRight, AlertCircle, User, Phone, Mail, Map as MapIcon, DollarSign,
  Calendar, Filter, Download, Zap, BarChart3, List, Scan, Gift, Sparkles,
  RefreshCw, CheckCircle2, ShieldCheck, ArrowUpRight
} from "lucide-react"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"

type Tab = "dashboard" | "orders" | "catalog" | "picking" | "config"

const DUMMY_PRODUCTS = [
  { id: "p1", name: "Arroz Tipo 1 5kg", price: 28500, stock: 45, aisle: "Pasillo 3", category: "Almacén", image: "🍚" },
  { id: "p2", name: "Fideo Tallarín 500g", price: 5500, stock: 120, aisle: "Pasillo 3", category: "Almacén", image: "🍝" },
  { id: "p3", name: "Aceite de Girasol 1L", price: 12800, stock: 30, aisle: "Pasillo 4", category: "Almacén", image: "🫒" },
  { id: "p4", name: "Leche Entera 1L", price: 7500, stock: 60, aisle: "Pasillo 1", category: "Lácteos", image: "🥛" },
  { id: "p5", name: "Yogurt Natural 1kg", price: 14500, stock: 25, aisle: "Pasillo 1", category: "Lácteos", image: "🫗" },
  { id: "p6", name: "Pan Hamburguesa 8un", price: 9500, stock: 18, aisle: "Pasillo 2", category: "Panadería", image: "🍔" },
  { id: "p7", name: "Galleta Chocolate 200g", price: 4200, stock: 88, aisle: "Pasillo 2", category: "Snacks", image: "🍪" },
  { id: "p8", name: "Carne Vacuna kg", price: 38000, stock: 15, aisle: "Carnicería", category: "Carnes", image: "🥩" },
  { id: "p9", name: "Pollo Entero kg", price: 16500, stock: 22, aisle: "Carnicería", category: "Carnes", image: "🍗" },
  { id: "p10", name: "Tomate kg", price: 8500, stock: 10, aisle: "Verdulería", category: "Verduras", image: "🍅" },
  { id: "p11", name: "Cebolla kg", price: 6200, stock: 35, aisle: "Verdulería", category: "Verduras", image: "🧅" },
  { id: "p12", name: "Gaseosa Cola 2L", price: 11200, stock: 50, aisle: "Pasillo 5", category: "Bebidas", image: "🥤" },
]

const DUMMY_ORDERS = [
  { id: "o1", order_number: "ECOMM-250604-0001", customer_name: "María González", customer_phone: "0981 123 456", order_type: "pickup", status: "confirmed", total: 128500, items_count: 4, branch_name: "Suc. Central", pickup_slot: "18:00-20:00", created_at: "2026-06-04T10:30:00" },
  { id: "o2", order_number: "ECOMM-250604-0002", customer_name: "Carlos Benítez", customer_phone: "0982 789 012", order_type: "delivery", status: "preparing", total: 87500, items_count: 3, branch_name: "Suc. Central", delivery_address: "Avda. España 1234", created_at: "2026-06-04T11:00:00" },
  { id: "o3", order_number: "ECOMM-250604-0003", customer_name: "Ana Martínez", customer_phone: "0983 456 789", order_type: "pickup", status: "ready", total: 234000, items_count: 7, branch_name: "Suc. Shopping", pickup_slot: "16:00-18:00", created_at: "2026-06-04T09:15:00" },
  { id: "o4", order_number: "ECOMM-250604-0004", customer_name: "Pedro Ramírez", customer_phone: "0984 567 890", order_type: "delivery", status: "in_transit", total: 56200, items_count: 2, branch_name: "Suc. Central", delivery_address: "Calle Palma 567", created_at: "2026-06-04T08:00:00" },
  { id: "o5", order_number: "ECOMM-250604-0005", customer_name: "Laura Villalba", customer_phone: "0985 678 901", order_type: "pickup", status: "delivered", total: 195000, items_count: 5, branch_name: "Suc. Centro", pickup_slot: "10:00-12:00", created_at: "2026-06-04T07:00:00" },
  { id: "o6", order_number: "ECOMM-250604-0006", customer_name: "Roberto Acosta", customer_phone: "0986 789 012", order_type: "delivery", status: "pending", total: 73500, items_count: 3, branch_name: "Suc. Shopping", delivery_address: "Avda. San Martín 890", created_at: "2026-06-04T12:00:00" },
]

const DUMMY_DASHBOARD = {
  total_orders_today: 6,
  total_orders_week: 42,
  pending_orders: 1,
  preparing_orders: 1,
  ready_orders: 1,
  in_transit_orders: 1,
  delivered_today: 1,
  avg_order_value: 129000,
  total_revenue_today: 774700,
  total_revenue_week: 5418000,
  pickup_vs_delivery: { pickup: 3, delivery: 3 },
  top_products: [
    { product_name: "Arroz Tipo 1 5kg", total_quantity: 12 },
    { product_name: "Leche Entera 1L", total_quantity: 10 },
    { product_name: "Pollo Entero kg", total_quantity: 8 },
    { product_name: "Gaseosa Cola 2L", total_quantity: 7 },
  ],
  recent_orders: DUMMY_ORDERS,
  picking_pending: 2,
  picking_in_progress: 1,
}

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: any }> = {
  pending:    { label: "Pendiente",  class: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20", icon: Clock },
  confirmed:  { label: "Confirmado", class: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20", icon: CheckCircle },
  preparing:  { label: "Preparando", class: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20", icon: Package },
  ready:      { label: "Listo Retiro", class: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20", icon: Gift },
  in_transit: { label: "En Camino",  class: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20", icon: Truck },
  delivered:  { label: "Entregado",  class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20", icon: CheckCircle },
  cancelled:  { label: "Cancelado",  class: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20", icon: XCircle },
}

const DUMMY_PICKING = [
  { id: "pl1", order_number: "ECOMM-250604-0002", customer_name: "Carlos Benítez", status: "in_progress", total_items: 8, picked_items: 3, assigned_to: "Juan Pérez", branch_name: "Suc. Central", items: [
    { product_name: "Arroz Tipo 1 5kg", quantity: 2, picked_quantity: 2, aisle_location: "Pasillo 3 - Estante A", scanned: true, status: "picked" },
    { product_name: "Leche Entera 1L", quantity: 3, picked_quantity: 1, aisle_location: "Pasillo 1 - Estante B", scanned: false, status: "partial" },
    { product_name: "Pollo Entero kg", quantity: 1, picked_quantity: 0, aisle_location: "Carnicería - Cámara 2", scanned: false, status: "pending" },
    { product_name: "Galleta Chocolate 200g", quantity: 2, picked_quantity: 0, aisle_location: "Pasillo 2 - Estante C", scanned: false, status: "pending" },
  ]},
  { id: "pl2", order_number: "ECOMM-250604-0001", customer_name: "María González", status: "pending", total_items: 4, picked_items: 0, branch_name: "Suc. Central" },
]

const DUMMY_DELIVERY_ZONES = [
  { id: "z1", name: "Centro Santa Teresa", base_price: 5000, price_per_km: 1500, free_from_amount: 150000, estimated_minutes: 20 },
  { id: "z2", name: "Zona Norte / Ycuá Satí", base_price: 8000, price_per_km: 2000, free_from_amount: 200000, estimated_minutes: 35 },
  { id: "z3", name: "Zona Sur / Villa Morra", base_price: 10000, price_per_km: 2500, free_from_amount: 250000, estimated_minutes: 40 },
  { id: "z4", name: "San Lorenzo / Luque", base_price: 12000, price_per_km: 2000, free_from_amount: 300000, estimated_minutes: 45 },
]

const DUMMY_SLOTS = [
  { id: "s1", branch_name: "Suc. Central", slot_date: "2026-06-04", start_time: "08:00", end_time: "10:00", max_orders: 10, current_orders: 7, available: 3 },
  { id: "s2", branch_name: "Suc. Central", slot_date: "2026-06-04", start_time: "10:00", end_time: "12:00", max_orders: 10, current_orders: 9, available: 1 },
  { id: "s3", branch_name: "Suc. Central", slot_date: "2026-06-04", start_time: "14:00", end_time: "16:00", max_orders: 10, current_orders: 4, available: 6 },
  { id: "s4", branch_name: "Suc. Central", slot_date: "2026-06-04", start_time: "16:00", end_time: "18:00", max_orders: 10, current_orders: 2, available: 8 },
]

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${cfg.class}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

export default function EcommerceSmPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(false)
  const [orderFilter, setOrderFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [showOrderDetail, setShowOrderDetail] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [dashboard, setDashboard] = useState<any>(DUMMY_DASHBOARD)
  const [orders, setOrders] = useState<any[]>(DUMMY_ORDERS)
  const [pickingLists, setPickingLists] = useState<any[]>(DUMMY_PICKING)
  const [selectedPicking, setSelectedPicking] = useState<any>(null)
  const [showPickingDetail, setShowPickingDetail] = useState(false)
  const [catalogProducts] = useState<any[]>(DUMMY_PRODUCTS)
  const [catalogCategory, setCatalogCategory] = useState<string>("all")
  const [deliveryZones] = useState<any[]>(DUMMY_DELIVERY_ZONES)
  const [pickupSlots] = useState<any[]>(DUMMY_SLOTS)

  const fetchAll = async () => {
    setLoading(true)
    const cid = "00000000-0000-0000-0000-000000000010"
    try {
      const proms: Promise<any>[] = []
      if (tab === "dashboard") proms.push(api.ecommerceSm.getDashboard(cid).then(setDashboard).catch(() => {}))
      if (tab === "orders") proms.push(api.ecommerceSm.orders.list(cid).then(setOrders).catch(() => {}))
      if (tab === "picking") proms.push(api.ecommerceSm.picking.list(cid).then(setPickingLists).catch(() => {}))
      await Promise.all(proms.map(p => p.catch(() => {})))
    } catch (e) { console.warn(e) } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [tab])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }

  const filteredOrders = orders.filter(o => {
    if (orderFilter !== "all" && o.status !== orderFilter) return false
    if (search && !o.customer_name.toLowerCase().includes(search.toLowerCase()) && !o.order_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredCatalog = catalogProducts.filter(p => {
    if (catalogCategory !== "all" && p.category !== catalogCategory) return false
    return true
  })

  const categories = [...new Set(catalogProducts.map(p => p.category))]

  const tabs = [
    { k: "dashboard" as Tab, l: "Dashboard Ejecutivo", i: BarChart3 },
    { k: "orders" as Tab, l: "Órdenes Online", i: ShoppingCart },
    { k: "catalog" as Tab, l: "Góndola Digital", i: List },
    { k: "picking" as Tab, l: "Picking & Packing", i: Scan },
    { k: "config" as Tab, l: "Zonas & Slots", i: Package },
  ]

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950/90 text-white p-7 border border-teal-500/20 shadow-2xl shadow-teal-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 border border-teal-400/30 text-white flex items-center justify-center shadow-lg shadow-teal-500/25">
                  <ShoppingCart className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-teal-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-teal-400 uppercase bg-teal-500/10 px-2.5 py-0.5 rounded-md border border-teal-500/20">
                    CANAL DIGITAL · CLICK & COLLECT & DELIVERY
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    {dashboard?.total_orders_today ?? 0} Órdenes Hoy ({formatPYG(dashboard?.total_revenue_today ?? 0)})
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  E-Commerce & Tienda Digital Supermercado
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Recepción de compras web/app, armado por pasillo (Picking & Packing) y control de flota de reparto
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-teal-300">
                🛍️ {dashboard?.pickup_vs_delivery?.pickup ?? 0} Pickup Retiro
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-cyan-300">
                🚚 {dashboard?.pickup_vs_delivery?.delivery ?? 0} Delivery Express
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
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ventas Web Hoy</span>
              <span className="text-[10px] font-bold text-teal-400">Canal</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-teal-400">
              {formatPYG(dashboard?.total_revenue_today ?? 0)}
            </p>
            <p className="text-[11px] text-slate-400">{dashboard?.total_orders_today ?? 0} tickets emitidos</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pendientes de Armado</span>
              <span className="text-[10px] font-bold text-amber-400">Picking</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {dashboard?.picking_pending ?? 0} <span className="text-sm font-semibold text-slate-400">pedidos</span>
            </p>
            <p className="text-[11px] text-slate-400">Requieren colecta en pasillo</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En Ruta / Delivery</span>
              <span className="text-[10px] font-bold text-cyan-400">Tránsito</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-cyan-300">
              {dashboard?.in_transit_orders ?? 0} <span className="text-sm font-semibold text-slate-400">motos</span>
            </p>
            <p className="text-[11px] text-slate-400">Entregas en curso</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ticket Promedio Online</span>
              <span className="text-[10px] font-mono text-emerald-400">AOV</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(dashboard?.avg_order_value ?? 0)}
            </p>
            <p className="text-[11px] text-slate-400">Monto medio por carrito</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {tabs.map(t => {
          const Icon = t.i
          const active = tab === t.k
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.l}</span>
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ SUBTABS ══════════════════════ */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-500" />
                Órdenes Digitales Recientes
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {dashboard?.recent_orders?.slice(0, 5).map((o: any) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl px-2 transition cursor-pointer"
                    onClick={() => { setSelectedOrder(o); setShowOrderDetail(true) }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${o.order_type === "pickup" ? "bg-blue-500/10 text-blue-600" : "bg-orange-500/10 text-orange-600"}`}>
                        {o.order_type === "pickup" ? <Store className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-slate-900 dark:text-white">{o.customer_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{o.order_number} · {o.branch_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={o.status} />
                      <span className="font-mono font-black text-xs text-slate-900 dark:text-white">{formatPYG(o.total)}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-teal-500" />
                  Pickup vs. Delivery Express
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500"><span className="font-bold">🛍️ Retiro en Tienda</span><strong className="font-mono">{dashboard?.pickup_vs_delivery?.pickup ?? 0}</strong></div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((dashboard?.pickup_vs_delivery?.pickup ?? 0) / ((dashboard?.pickup_vs_delivery?.pickup ?? 0) + (dashboard?.pickup_vs_delivery?.delivery ?? 0) || 1)) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-slate-500 pt-1"><span className="font-bold">🚚 Delivery con Moto</span><strong className="font-mono">{dashboard?.pickup_vs_delivery?.delivery ?? 0}</strong></div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${((dashboard?.pickup_vs_delivery?.delivery ?? 0) / ((dashboard?.pickup_vs_delivery?.pickup ?? 0) + (dashboard?.pickup_vs_delivery?.delivery ?? 0) || 1)) * 100}%` }} />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-500" />
                  Top Productos Vendidos Online
                </h3>
                <div className="space-y-2 text-xs">
                  {dashboard?.top_products?.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">{i + 1}</span>
                      <span className="flex-1 truncate font-medium text-slate-800 dark:text-slate-200">{p.product_name}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{p.total_quantity} un</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por cliente o número de orden web..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {["all", "pending", "confirmed", "preparing", "ready", "in_transit", "delivered"].map(s => (
                <button
                  key={s}
                  onClick={() => setOrderFilter(s)}
                  className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all ${
                    orderFilter === s
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {s === "all" ? "Todas" : (STATUS_CONFIG[s]?.label ?? s)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Orden Web</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Modalidad</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4">Sucursal</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">{o.order_number}</td>
                      <td className="p-4">
                        <p className="font-bold text-slate-900 dark:text-white">{o.customer_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{o.customer_phone}</p>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 font-bold ${o.order_type === "pickup" ? "text-blue-500" : "text-orange-500"}`}>
                          {o.order_type === "pickup" ? <Store className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                          {o.order_type === "pickup" ? "Pickup" : "Delivery"}
                        </span>
                      </td>
                      <td className="p-4 text-center"><StatusBadge status={o.status} /></td>
                      <td className="p-4 text-slate-500">{o.branch_name}</td>
                      <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">{formatPYG(o.total)}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => { setSelectedOrder(o); setShowOrderDetail(true) }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-950/40 font-bold transition"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" />Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER DETALLE DE ORDEN ── */}
      {showOrderDetail && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowOrderDetail(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{selectedOrder.order_number}</h3>
                <p className="text-[11px] text-slate-400 font-mono">{new Date(selectedOrder.created_at).toLocaleString("es-PY")}</p>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Cliente:</span><strong className="text-slate-900 dark:text-white">{selectedOrder.customer_name}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Teléfono:</span><span className="font-mono text-slate-700 dark:text-slate-300">{selectedOrder.customer_phone}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Modalidad:</span><span className="font-bold uppercase text-teal-600">{selectedOrder.order_type}</span></div>
              {selectedOrder.delivery_address && (
                <div className="flex justify-between"><span className="text-slate-400">Dirección:</span><span className="text-slate-700 dark:text-slate-300">{selectedOrder.delivery_address}</span></div>
              )}
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-sm font-black">
              <span>Total Pedido:</span>
              <span className="font-mono text-teal-600 dark:text-teal-400">{formatPYG(selectedOrder.total)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowOrderDetail(false)} className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "catalog" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCatalogCategory("all")}
              className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all ${
                catalogCategory === "all" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todos ({catalogProducts.length})
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCatalogCategory(c)}
                className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all ${
                  catalogCategory === c ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c} ({catalogProducts.filter(p => p.category === c).length})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCatalog.map((p, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2">
                <div className="text-4xl text-center py-2">{p.image}</div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{p.name}</h4>
                <p className="text-[11px] text-slate-400">{p.category} · {p.aisle}</p>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-mono font-black text-sm text-teal-600 dark:text-teal-400">{formatPYG(p.price)}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">{p.stock} un</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "picking" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pickingLists.map((pl) => (
              <div
                key={pl.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 cursor-pointer hover:border-teal-500 transition"
                onClick={() => { setSelectedPicking(pl); setShowPickingDetail(true) }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{pl.order_number}</h4>
                    <p className="text-xs text-slate-400">{pl.customer_name}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                    {pl.status === "in_progress" ? "🔄 En Colecta" : "⏳ Pendiente"}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pl.total_items > 0 ? (pl.picked_items / pl.total_items) * 100 : 0}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500 font-mono">
                  <span>Progreso: {pl.picked_items} / {pl.total_items} ítems</span>
                  <span>{pl.branch_name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "config" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-500" />
              Zonas de Reparto & Tarifas Delivery
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {deliveryZones.map((z, i) => (
                <div key={i} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{z.name}</p>
                    <p className="text-[10px] text-slate-400">{z.estimated_minutes} min tiempo estimado</p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-teal-600">{formatPYG(z.base_price)} base</p>
                    <p className="text-[10px] text-slate-400">Gratis &gt; {formatPYG(z.free_from_amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-500" />
              Franjas de Retiro (Pickup Slots)
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pickupSlots.map((s, i) => (
                <div key={i} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{s.start_time} - {s.end_time}</p>
                    <p className="text-[10px] text-slate-400">{s.branch_name}</p>
                  </div>
                  <span className="font-mono font-bold text-emerald-600">{s.available} cupos libres</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
