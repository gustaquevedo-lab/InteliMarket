import { useState, useEffect } from "react"
import { ShoppingCart, Package, MapPin, ClipboardList, CreditCard, Smartphone, Store, Truck, Clock, TrendingUp, CheckCircle, XCircle, Eye, Search, Loader2, ChevronRight, AlertCircle, User, Phone, Mail, Map as MapIcon, DollarSign, Calendar, Filter, Download, Zap, BarChart3, List, Scan, Gift } from "lucide-react"
import { useToast } from "../../hooks/useToast"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"

type Tab = "dashboard" | "orders" | "catalog" | "picking" | "config"

const DUMMY_BRANCHES = [
  { id: "b001", name: "Suc. Central" },
  { id: "b002", name: "Suc. Shopping" },
  { id: "b003", name: "Suc. Centro" },
]

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
  { id: "o1", order_number: "ECOMM-250604-0001", customer_name: "María González", customer_phone: "0981 123 456", order_type: "pickup", status: "confirmed", total: 128500, items_count: 4, branch_id: "b001", branch_name: "Suc. Central", pickup_slot: "18:00-20:00", created_at: "2026-06-04T10:30:00" },
  { id: "o2", order_number: "ECOMM-250604-0002", customer_name: "Carlos Benítez", customer_phone: "0982 789 012", order_type: "delivery", status: "preparing", total: 87500, items_count: 3, branch_id: "b001", branch_name: "Suc. Central", delivery_address: "Avda. España 1234", created_at: "2026-06-04T11:00:00" },
  { id: "o3", order_number: "ECOMM-250604-0003", customer_name: "Ana Martínez", customer_phone: "0983 456 789", order_type: "pickup", status: "ready", total: 234000, items_count: 7, branch_id: "b002", branch_name: "Suc. Shopping", pickup_slot: "16:00-18:00", created_at: "2026-06-04T09:15:00" },
  { id: "o4", order_number: "ECOMM-250604-0004", customer_name: "Pedro Ramírez", customer_phone: "0984 567 890", order_type: "delivery", status: "in_transit", total: 56200, items_count: 2, branch_id: "b001", branch_name: "Suc. Central", delivery_address: "Calle Palma 567", created_at: "2026-06-04T08:00:00" },
  { id: "o5", order_number: "ECOMM-250604-0005", customer_name: "Laura Villalba", customer_phone: "0985 678 901", order_type: "pickup", status: "delivered", total: 195000, items_count: 5, branch_id: "b003", branch_name: "Suc. Centro", pickup_slot: "10:00-12:00", created_at: "2026-06-04T07:00:00" },
  { id: "o6", order_number: "ECOMM-250604-0006", customer_name: "Roberto Acosta", customer_phone: "0986 789 012", order_type: "delivery", status: "pending", total: 73500, items_count: 3, branch_id: "b002", branch_name: "Suc. Shopping", delivery_address: "Avda. San Martín 890", created_at: "2026-06-04T12:00:00" },
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  confirmed: { label: "Confirmado", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle },
  preparing: { label: "Preparando", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", icon: Package },
  ready: { label: "Listo", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: Gift },
  picked_up: { label: "Retirado", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400", icon: CheckCircle },
  in_transit: { label: "En Camino", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: Truck },
  delivered: { label: "Entregado", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
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
  { id: "z1", name: "Centro", base_price: 5000, price_per_km: 1500, free_from_amount: 150000, estimated_minutes: 20 },
  { id: "z2", name: "Zona Norte", base_price: 8000, price_per_km: 2000, free_from_amount: 200000, estimated_minutes: 35 },
  { id: "z3", name: "Zona Sur", base_price: 10000, price_per_km: 2500, free_from_amount: 250000, estimated_minutes: 40 },
  { id: "z4", name: "San Lorenzo", base_price: 12000, price_per_km: 2000, free_from_amount: 300000, estimated_minutes: 45 },
]

const DUMMY_SLOTS = [
  { id: "s1", branch_name: "Suc. Central", slot_date: "2026-06-04", start_time: "08:00", end_time: "10:00", max_orders: 10, current_orders: 7, available: 3 },
  { id: "s2", branch_name: "Suc. Central", slot_date: "2026-06-04", start_time: "10:00", end_time: "12:00", max_orders: 10, current_orders: 9, available: 1 },
  { id: "s3", branch_name: "Suc. Central", slot_date: "2026-06-04", start_time: "14:00", end_time: "16:00", max_orders: 10, current_orders: 4, available: 6 },
  { id: "s4", branch_name: "Suc. Central", slot_date: "2026-06-04", start_time: "16:00", end_time: "18:00", max_orders: 10, current_orders: 2, available: 8 },
  { id: "s5", branch_name: "Suc. Shopping", slot_date: "2026-06-04", start_time: "09:00", end_time: "12:00", max_orders: 8, current_orders: 5, available: 3 },
  { id: "s6", branch_name: "Suc. Shopping", slot_date: "2026-06-04", start_time: "15:00", end_time: "18:00", max_orders: 8, current_orders: 1, available: 7 },
]

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = cfg.icon
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}><Icon className="w-3 h-3" />{cfg.label}</span>
}

export default function EcommerceSmPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [orderFilter, setOrderFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [showOrderDetail, setShowOrderDetail] = useState(false)
  const toast = useToast()

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

  const tabs: { k: Tab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "orders", l: "Órdenes", i: ShoppingCart },
    { k: "catalog", l: "Catálogo", i: List },
    { k: "picking", l: "Picking", i: Scan },
    { k: "config", l: "Config.", i: Package },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-56 h-56 bg-emerald-300 opacity-20 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold tracking-wider uppercase mb-4 backdrop-blur-sm border border-white/10">
            <ShoppingCart className="w-4 h-4" />
            Fase 7 — Omnicanal
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
                E-commerce
              </h1>
              <p className="text-emerald-50 text-lg mt-3 font-medium max-w-xl opacity-90">
                Tienda online con Click & Collect, Delivery, picking en tienda y pagos integrados
              </p>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl text-center min-w-[100px]">
                <p className="text-white text-xs font-semibold uppercase tracking-wider opacity-80">Hoy</p>
                <p className="text-white text-2xl font-bold">{dashboard?.total_orders_today ?? 0}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl text-center min-w-[100px]">
                <p className="text-white text-xs font-semibold uppercase tracking-wider opacity-80">Semana</p>
                <p className="text-white text-2xl font-bold">{dashboard?.total_orders_week ?? 0}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl text-center min-w-[100px]">
                <p className="text-white text-xs font-semibold uppercase tracking-wider opacity-80">Gs Prom.</p>
                <p className="text-white text-lg font-bold">{formatPYG(dashboard?.avg_order_value ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto scrollbar-hide shadow-inner">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap relative overflow-hidden ${
              tab === t.k
                ? "bg-white dark:bg-slate-700 text-primary dark:text-blue-400 shadow-md ring-1 ring-black/5 dark:ring-white/10 scale-100"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-slate-700/50 hover:scale-[1.02]"
            }`}>
            {tab === t.k && <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50" />}
            <t.i className={`w-3.5 h-3.5 relative z-10 ${tab === t.k ? "scale-110" : ""}`} />
            <span className="relative z-10">{t.l}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {tab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {[
                  { icon: Clock, label: "Pendientes", value: dashboard?.pending_orders ?? 0, color: "text-yellow-500" },
                  { icon: Package, label: "Preparando", value: dashboard?.preparing_orders ?? 0, color: "text-indigo-500" },
                  { icon: Gift, label: "Listos", value: dashboard?.ready_orders ?? 0, color: "text-emerald-500" },
                  { icon: Truck, label: "En Camino", value: dashboard?.in_transit_orders ?? 0, color: "text-orange-500" },
                  { icon: CheckCircle, label: "Hoy Entreg.", value: dashboard?.delivered_today ?? 0, color: "text-green-500" },
                  { icon: ClipboardList, label: "Picking Pend.", value: dashboard?.picking_pending ?? 0, color: "text-rose-500" },
                  { icon: Zap, label: "Picking Prog.", value: dashboard?.picking_in_progress ?? 0, color: "text-violet-500" },
                  { icon: DollarSign, label: "Gs Hoy", value: formatPYG(dashboard?.total_revenue_today ?? 0), color: "text-primary" },
                ].map((s, i) => (
                  <div key={i} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 shadow-sm text-center">
                    <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
                    <p className="text-lg font-bold">{typeof s.value === "number" ? s.value : s.value}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Órdenes Recientes</h3>
                  <div className="space-y-2">
                    {dashboard?.recent_orders?.slice(0, 5).map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                        onClick={() => { setSelectedOrder(o); setShowOrderDetail(true) }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${o.order_type === "pickup" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
                            {o.order_type === "pickup" ? <Store className="w-4 h-4 text-blue-600" /> : <Truck className="w-4 h-4 text-orange-600" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{o.customer_name}</p>
                            <p className="text-xs text-gray-400 truncate">{o.order_number} · {o.branch_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge status={o.status} />
                          <span className="text-sm font-bold">{formatPYG(o.total)}</span>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-primary" />Pickup vs Delivery</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-gray-500 mb-1"><span>🛍️ Pickup</span><span className="font-bold">{(dashboard?.pickup_vs_delivery?.pickup ?? 0)}</span></div>
                        <div className="h-2.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((dashboard?.pickup_vs_delivery?.pickup ?? 0) / ((dashboard?.pickup_vs_delivery?.pickup ?? 0) + (dashboard?.pickup_vs_delivery?.delivery ?? 0) || 1)) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-2"><span>🚚 Delivery</span><span className="font-bold">{(dashboard?.pickup_vs_delivery?.delivery ?? 0)}</span></div>
                        <div className="h-2.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${((dashboard?.pickup_vs_delivery?.delivery ?? 0) / ((dashboard?.pickup_vs_delivery?.pickup ?? 0) + (dashboard?.pickup_vs_delivery?.delivery ?? 0) || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Top Productos</h3>
                    <div className="space-y-2">
                      {dashboard?.top_products?.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-gray-500">{i + 1}</span>
                          <span className="flex-1 truncate">{p.product_name}</span>
                          <span className="font-bold text-xs">{p.total_quantity} un</span>
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
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar orden..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {["all", "pending", "confirmed", "preparing", "ready", "in_transit", "delivered", "cancelled"].map(s => (
                    <button key={s} onClick={() => setOrderFilter(s)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        orderFilter === s
                          ? "bg-primary text-white shadow-md"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                      }`}>
                      {s === "all" ? "Todas" : (STATUS_CONFIG[s]?.label ?? s)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-800/50">
                        <th className="text-left py-3.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Orden</th>
                        <th className="text-left py-3.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Cliente</th>
                        <th className="text-left py-3.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Tipo</th>
                        <th className="text-left py-3.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Estado</th>
                        <th className="text-left py-3.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Sucursal</th>
                        <th className="text-right py-3.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Total</th>
                        <th className="text-center py-3.5 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o, i) => (
                        <tr key={o.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="font-medium text-xs text-gray-500">{o.order_number}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                {o.customer_name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{o.customer_name}</p>
                                <p className="text-xs text-gray-400">{o.customer_phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${o.order_type === "pickup" ? "text-blue-600" : "text-orange-600"}`}>
                              {o.order_type === "pickup" ? <Store className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                              {o.order_type === "pickup" ? "Pickup" : "Delivery"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4"><StatusBadge status={o.status} /></td>
                          <td className="py-3.5 px-4 text-sm">{o.branch_name}</td>
                          <td className="py-3.5 px-4 text-right font-bold">{formatPYG(o.total)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <button onClick={() => { setSelectedOrder(o); setShowOrderDetail(true) }}
                              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-primary hover:text-white text-xs font-bold transition-all">
                              <Eye className="w-3.5 h-3.5 inline mr-1" />Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {showOrderDetail && selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowOrderDetail(false)}>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="text-lg font-bold">{selectedOrder.order_number}</h3>
                        <p className="text-xs text-gray-400">{new Date(selectedOrder.created_at).toLocaleString("es-PY")}</p>
                      </div>
                      <StatusBadge status={selectedOrder.status} />
                    </div>

                    <div className="flex items-center gap-3 mb-5 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                        {selectedOrder.customer_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{selectedOrder.customer_name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />{selectedOrder.customer_phone}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <p className="text-xs text-gray-500">Tipo</p>
                        <p className="font-bold text-sm flex items-center gap-1">{selectedOrder.order_type === "pickup" ? <Store className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                          {selectedOrder.order_type === "pickup" ? "Recoger en tienda" : "Delivery"}</p>
                      </div>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="font-bold text-sm">{formatPYG(selectedOrder.total)}</p>
                      </div>
                    </div>

                    {selectedOrder.pickup_slot && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm">Retiro: <strong>{selectedOrder.pickup_slot}</strong> · {selectedOrder.branch_name}</span>
                      </div>
                    )}

                    {selectedOrder.delivery_address && (
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl mb-4 flex items-center gap-2">
                        <MapIcon className="w-4 h-4 text-orange-600" />
                        <span className="text-sm">Entrega: <strong>{selectedOrder.delivery_address}</strong></span>
                      </div>
                    )}

                    <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl flex justify-between text-sm mb-5">
                      <span className="text-gray-500">{selectedOrder.items_count} productos</span>
                      <span className="font-bold">{selectedOrder.branch_name}</span>
                    </div>

                    <div className="flex gap-2">
                      {selectedOrder.status === "confirmed" && (
                        <button onClick={() => toast.success("Orden enviada a preparación")} className="flex-1 btn-primary text-sm">Iniciar Preparación</button>
                      )}
                      {selectedOrder.status === "preparing" && (
                        <button onClick={() => toast.success("Orden marcada como lista")} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium py-2">Marcar Listo</button>
                      )}
                      <button onClick={() => setShowOrderDetail(false)} className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200">Cerrar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "catalog" && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setCatalogCategory("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${catalogCategory === "all" ? "bg-primary text-white shadow-md" : "bg-gray-100 dark:bg-slate-800 text-gray-600 hover:bg-gray-200"}`}>
                  Todos ({catalogProducts.length})
                </button>
                {categories.map(c => (
                  <button key={c} onClick={() => setCatalogCategory(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${catalogCategory === c ? "bg-primary text-white shadow-md" : "bg-gray-100 dark:bg-slate-800 text-gray-600 hover:bg-gray-200"}`}>
                    {c} ({catalogProducts.filter(p => p.category === c).length})
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCatalog.map((p, i) => (
                  <div key={i} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
                    <div className="text-5xl mb-3 text-center">{p.image}</div>
                    <h3 className="font-bold text-sm mb-1 truncate">{p.name}</h3>
                    <p className="text-xs text-gray-400 mb-1">{p.category} · {p.aisle}</p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="font-extrabold text-lg text-primary">{formatPYG(p.price)}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.stock > 20 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                        {p.stock} un
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "picking" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pickingLists.map((pl, i) => (
                  <div key={pl.id}
                    className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-all"
                    onClick={() => { setSelectedPicking(pl); setShowPickingDetail(true) }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-sm">{pl.order_number}</p>
                        <p className="text-xs text-gray-400">{pl.customer_name}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        pl.status === "in_progress" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" :
                        pl.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}>
                        {pl.status === "in_progress" ? "🔄 En Progreso" : pl.status === "completed" ? "✅ Completado" : "⏳ Pendiente"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm mb-3">
                      <span className="text-gray-500"><Store className="w-3.5 h-3.5 inline mr-1" />{pl.branch_name}</span>
                      {pl.assigned_to && <span className="text-gray-500"><User className="w-3.5 h-3.5 inline mr-1" />{pl.assigned_to}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-primary transition-all" style={{ width: `${pl.total_items > 0 ? (pl.picked_items / pl.total_items) * 100 : 0}%` }}></div>
                      </div>
                      <span className="text-xs font-bold shrink-0">{pl.picked_items}/{pl.total_items}</span>
                    </div>
                  </div>
                ))}
              </div>

              {showPickingDetail && selectedPicking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowPickingDetail(false)}>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="text-lg font-bold">Picking: {selectedPicking.order_number}</h3>
                        <p className="text-sm text-gray-500">{selectedPicking.customer_name} · {selectedPicking.branch_name}</p>
                      </div>
                      <span className="text-sm font-bold">{selectedPicking.picked_items}/{selectedPicking.total_items}</span>
                    </div>

                    <div className="w-full h-3 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden mb-6">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-primary transition-all" style={{ width: `${selectedPicking.total_items > 0 ? (selectedPicking.picked_items / selectedPicking.total_items) * 100 : 0}%` }}></div>
                    </div>

                    <div className="space-y-2">
                      {(selectedPicking.items || []).map((item: any, idx: number) => (
                        <div key={idx} className={`p-3 rounded-xl border transition-all ${item.scanned ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/30" : item.status === "partial" ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/30" : "bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-gray-700"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${item.scanned ? "bg-green-200 text-green-700" : item.status === "partial" ? "bg-yellow-200 text-yellow-700" : "bg-gray-200 text-gray-500"}`}>
                                {item.scanned ? "✓" : item.status === "partial" ? "◐" : "○"}
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{item.product_name}</p>
                                <p className="text-xs text-gray-400">{item.aisle_location}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm">{item.picked_quantity}/{item.quantity}</p>
                              <button onClick={(e) => { e.stopPropagation(); toast.success(`${item.product_name} escaneado!`) }}
                                className="text-xs text-primary hover:underline font-semibold">Escanear</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-6">
                      {selectedPicking.status === "pending" && (
                        <button onClick={() => { toast.success("Picking asignado") }} className="flex-1 btn-primary text-sm">Asignar a Empleado</button>
                      )}
                      {selectedPicking.status === "in_progress" && (
                        <button onClick={() => { toast.success("Picking completado!") }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium py-2">Completar Picking</button>
                      )}
                      <button onClick={() => setShowPickingDetail(false)} className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 text-sm font-medium">Cerrar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "config" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Zonas de Delivery</h3>
                  <div className="space-y-3">
                    {deliveryZones.map((z, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200/50 dark:border-gray-700/30">
                        <div>
                          <p className="font-semibold text-sm">{z.name}</p>
                          <p className="text-xs text-gray-400">{z.estimated_minutes} min estimados</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">Gs {formatPYG(z.base_price)} + {formatPYG(z.price_per_km)}/km</p>
                          <p className="text-xs text-gray-400">Gratis desde {formatPYG(z.free_from_amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />Slots de Pickup — Hoy</h3>
                  <div className="space-y-2">
                    {pickupSlots.slice(0, 4).map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-200/50 dark:border-gray-700/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-sm font-bold text-blue-600">
                            {s.start_time}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{s.branch_name}</p>
                            <p className="text-xs text-gray-400">{s.start_time} - {s.end_time}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${s.available <= 2 ? "text-red-500" : s.available <= 5 ? "text-yellow-500" : "text-green-500"}`}>
                            {s.available} libres
                          </p>
                          <p className="text-xs text-gray-400">de {s.max_orders}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-base mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" />Métodos de Pago</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: "Pagopar", icon: "💳", active: true },
                    { name: "Kuapay", icon: "📱", active: true },
                    { name: "Bancard", icon: "🏦", active: true },
                    { name: "SPI/QR", icon: "📲", active: true },
                    { name: "Delivery POS", icon: "🖨️", active: true, desc: "POS inalámbrico contra entrega" },
                    { name: "Efectivo", icon: "💰", active: true, desc: "Solo pickup" },
                  ].map((m, i) => (
                    <div key={i} className={`p-3 rounded-xl border text-center ${m.active ? "bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-gray-700" : "bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-gray-700 opacity-50"}`}>
                      <span className="text-2xl block mb-1">{m.icon}</span>
                      <p className="font-bold text-sm">{m.name}</p>
                      {m.desc && <p className="text-[10px] text-gray-400 mt-0.5">{m.desc}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
