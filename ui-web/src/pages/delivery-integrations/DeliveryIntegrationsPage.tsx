import { useState, useEffect } from "react"
import { ShoppingCart, Smartphone, Store, Truck, Clock, TrendingUp, CheckCircle, XCircle, Eye, Search, Loader2, AlertCircle, User, Phone, DollarSign, Calendar, Filter, Download, Zap, BarChart3, List, Settings, Globe, RefreshCw, Activity } from "lucide-react"
import { useToast } from "../../hooks/useToast"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"

type Tab = "dashboard" | "orders" | "config" | "sync" | "logs"

const PLATFORMS = [
  { id: "ifood", name: "iFood", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: Smartphone },
  { id: "rappi", name: "Rappi", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Smartphone },
  { id: "pedidosya", name: "PedidosYa", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Smartphone },
]

const DUMMY_DASHBOARD = {
  total_orders_today: 15,
  total_orders_week: 98,
  total_sales_today: 1245000,
  total_sales_week: 8750000,
  total_commission_week: 612500,
  net_sales_week: 8137500,
  avg_order_value: 89285,
  avg_prep_time: 18,
  active_integrations: 2,
  orders_by_platform: [
    { platform: "ifood", count: 45 },
    { platform: "pedidosya", count: 38 },
    { platform: "rappi", count: 15 },
  ],
  sales_by_platform: [
    { platform: "ifood", total: 4200000 },
    { platform: "pedidosya", total: 3100000 },
    { platform: "rappi", total: 1450000 },
  ],
  recent_orders: [
    { id: "do1", platform: "ifood", platform_order_id: "IF-12345", status: "preparing", customer_name: "Lucía Méndez", total: 87500, received_at: "2026-06-04T18:30:00" },
    { id: "do2", platform: "pedidosya", platform_order_id: "PY-67890", status: "received", customer_name: "Diego Rivas", total: 124000, received_at: "2026-06-04T18:15:00" },
    { id: "do3", platform: "rappi", platform_order_id: "RP-11223", status: "ready", customer_name: "Sofía Duarte", total: 63500, received_at: "2026-06-04T17:45:00" },
    { id: "do4", platform: "ifood", platform_order_id: "IF-12344", status: "delivered", customer_name: "Martín Benítez", total: 156000, received_at: "2026-06-04T17:00:00" },
  ],
  status_distribution: [
    { status: "received", count: 5 },
    { status: "preparing", count: 3 },
    { status: "ready", count: 2 },
    { status: "in_transit", count: 4 },
    { status: "delivered", count: 1 },
  ],
  daily_trend: [
    { date: "2026-05-29", orders: 12, net_sales: 1050000 },
    { date: "2026-05-30", orders: 15, net_sales: 1280000 },
    { date: "2026-05-31", orders: 10, net_sales: 890000 },
    { date: "2026-06-01", orders: 14, net_sales: 1200000 },
    { date: "2026-06-02", orders: 16, net_sales: 1420000 },
    { date: "2026-06-03", orders: 18, net_sales: 1560000 },
    { date: "2026-06-04", orders: 13, net_sales: 1100000 },
  ],
}

const DUMMY_ORDERS = [
  { id: "do1", platform: "ifood", platform_order_id: "IF-12345", status: "preparing", customer_name: "Lucía Méndez", customer_phone: "0981 111 222", customer_address: "Avda. Mariscal López 1234", total: 87500, delivery_fee: 8500, commission: 4375, net_amount: 83125, received_at: "2026-06-04T18:30:00" },
  { id: "do2", platform: "pedidosya", platform_order_id: "PY-67890", status: "received", customer_name: "Diego Rivas", customer_phone: "0982 333 444", customer_address: "Calle 14 de Mayo 567", total: 124000, delivery_fee: 10000, commission: 6200, net_amount: 117800, received_at: "2026-06-04T18:15:00" },
  { id: "do3", platform: "rappi", platform_order_id: "RP-11223", status: "ready", customer_name: "Sofía Duarte", customer_phone: "0983 555 666", customer_address: "Avda. España 890", total: 63500, delivery_fee: 6500, commission: 3175, net_amount: 60325, received_at: "2026-06-04T17:45:00" },
  { id: "do4", platform: "ifood", platform_order_id: "IF-12344", status: "delivered", customer_name: "Martín Benítez", customer_phone: "0984 777 888", customer_address: "Calle Palma 234", total: 156000, delivery_fee: 12000, commission: 7800, net_amount: 148200, received_at: "2026-06-04T17:00:00" },
  { id: "do5", platform: "pedidosya", platform_order_id: "PY-67891", status: "in_transit", customer_name: "Andrea Vera", customer_phone: "0985 999 000", customer_address: "Avda. San Martín 123", total: 92000, delivery_fee: 7500, commission: 4600, net_amount: 87400, received_at: "2026-06-04T16:30:00" },
  { id: "do6", platform: "ifood", platform_order_id: "IF-12343", status: "cancelled", customer_name: "Pedro Ortiz", customer_phone: "0986 111 333", customer_address: "Calle Estrella 456", total: 55000, delivery_fee: 5000, commission: 2750, net_amount: 52250, received_at: "2026-06-04T15:00:00" },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  received: { label: "Recibida", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Clock },
  accepted: { label: "Aceptada", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", icon: CheckCircle },
  preparing: { label: "Preparando", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Package },
  ready: { label: "Listo", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle },
  picked_up: { label: "Recogido", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400", icon: Truck },
  in_transit: { label: "En Camino", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: Truck },
  delivered: { label: "Entregado", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
}

export default function DeliveryIntegrationsPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<any>(DUMMY_DASHBOARD)
  const [orders, setOrders] = useState<any[]>(DUMMY_ORDERS)
  const [configs, setConfigs] = useState<any[]>([])
  const [syncs, setSyncs] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState("")
  const [platformFilter, setPlatformFilter] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [dashRes, ordersRes] = await Promise.all([
        api.deliveryIntegrations.getDashboard().catch(() => DUMMY_DASHBOARD),
        api.deliveryIntegrations.orders.list().catch(() => DUMMY_ORDERS),
      ])
      setDashboard(dashRes)
      setOrders(ordersRes)
    } catch (e) {
      setDashboard(DUMMY_DASHBOARD)
      setOrders(DUMMY_ORDERS)
    }
    setLoading(false)
  }

  async function loadConfigs() {
    try {
      const res = await api.deliveryIntegrations.config.list()
      setConfigs(res)
    } catch { setConfigs([]) }
  }

  async function loadSyncs() {
    try {
      const res = await api.deliveryIntegrations.sync.list()
      setSyncs(res)
    } catch { setSyncs([]) }
  }

  async function loadLogs() {
    try {
      const res = await api.deliveryIntegrations.logs.list()
      setLogs(res)
    } catch { setLogs([]) }
  }

  useEffect(() => {
    if (tab === "config") loadConfigs()
    if (tab === "sync") loadSyncs()
    if (tab === "logs") loadLogs()
  }, [tab])

  const filteredOrders = orders.filter(o => {
    if (statusFilter && o.status !== statusFilter) return false
    if (platformFilter && o.platform !== platformFilter) return false
    return true
  })

  const tabs = [
    { id: "dashboard" as Tab, label: "Dashboard", icon: BarChart3 },
    { id: "orders" as Tab, label: "Órdenes", icon: List },
    { id: "config" as Tab, label: "Configuración", icon: Settings },
    { id: "sync" as Tab, label: "Sync Catálogo", icon: RefreshCw },
    { id: "logs" as Tab, label: "Actividad", icon: Activity },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-cyan-500" />
            Integración Apps de Delivery
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            iFood · Rappi · PedidosYa — Centraliza órdenes, sincronizá catálogo y monitoreá comisiones
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-white dark:bg-slate-700 shadow-sm text-cyan-600 dark:text-cyan-400" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Órdenes Hoy</p>
                  <p className="text-xl font-bold">{dashboard.total_orders_today}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ventas Hoy</p>
                  <p className="text-xl font-bold">{formatPYG(dashboard.total_sales_today)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Neto Semana</p>
                  <p className="text-xl font-bold">{formatPYG(dashboard.net_sales_week)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Prep. Promedio</p>
                  <p className="text-xl font-bold">{dashboard.avg_prep_time} min</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Truck className="w-4 h-4" /> Órdenes por Plataforma</h3>
              <div className="space-y-3">
                {dashboard.orders_by_platform?.map((p: any) => (
                  <div key={p.platform} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${PLATFORMS.find(pl => pl.id === p.platform)?.color.split(" ")[0] || "bg-gray-400"}`} />
                      <span className="text-sm font-medium capitalize">{p.platform}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">{p.count} órdenes</span>
                      <div className="w-24 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${(p.count / Math.max(...dashboard.orders_by_platform.map((x: any) => x.count))) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Ventas por Plataforma</h3>
              <div className="space-y-3">
                {dashboard.sales_by_platform?.map((p: any) => (
                  <div key={p.platform} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{p.platform}</span>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatPYG(p.total)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Comisiones ({dashboard.total_commission_week > 0 ? ((dashboard.total_commission_week / (dashboard.total_sales_week || 1)) * 100).toFixed(1) : 0}%)</span>
                  <span className="font-semibold text-red-500">{formatPYG(dashboard.total_commission_week)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> Órdenes Recientes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 text-xs uppercase">
                    <th className="pb-3 pr-4">Plataforma</th>
                    <th className="pb-3 pr-4">ID</th>
                    <th className="pb-3 pr-4">Cliente</th>
                    <th className="pb-3 pr-4">Total</th>
                    <th className="pb-3 pr-4">Estado</th>
                    <th className="pb-3">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {dashboard.recent_orders?.map((o: any) => {
                    const sc = STATUS_CONFIG[o.status] || STATUS_CONFIG.received
                    const platformInfo = PLATFORMS.find(p => p.id === o.platform)
                    return (
                      <tr key={o.id} className="text-sm">
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${platformInfo?.color || ""}`}>
                            {o.platform}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">{o.platform_order_id}</td>
                        <td className="py-3 pr-4">{o.customer_name}</td>
                        <td className="py-3 pr-4 font-medium">{formatPYG(o.total)}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                            <sc.icon className="w-3 h-3" /> {sc.label}
                          </span>
                        </td>
                        <td className="py-3 text-gray-500">{o.received_at ? new Date(o.received_at).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter className="w-4 h-4" /> Filtros:
            </div>
            <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
            >
              <option value="">Todas las plataformas</option>
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 text-xs uppercase bg-gray-50 dark:bg-slate-800/50">
                  <th className="p-4">Plataforma</th>
                  <th className="p-4">ID Orden</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Comisión</th>
                  <th className="p-4">Neto</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Recibida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredOrders.map(o => {
                  const sc = STATUS_CONFIG[o.status] || STATUS_CONFIG.received
                  const platformInfo = PLATFORMS.find(p => p.id === o.platform)
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${platformInfo?.color || ""}`}>
                          {o.platform}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs">{o.platform_order_id}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{o.customer_name}</span>
                          <span className="text-xs text-gray-500">{o.customer_phone}</span>
                        </div>
                      </td>
                      <td className="p-4 font-medium">{formatPYG(o.total)}</td>
                      <td className="p-4 text-red-500">{formatPYG(o.commission)}</td>
                      <td className="p-4 text-emerald-600 font-medium">{formatPYG(o.net_amount)}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                          <sc.icon className="w-3 h-3" /> {sc.label}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-500">{o.received_at ? new Date(o.received_at).toLocaleString("es-PY") : "-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "config" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {PLATFORMS.map(platform => (
            <div key={platform.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-lg ${platform.color}`}>
                  <platform.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{platform.name}</h3>
                  <p className="text-xs text-gray-500">Configuración de integración</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Habilitado</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={platform.id !== "rappi"} />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
                  </label>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Store ID</label>
                  <input type="text" defaultValue={platform.id === "ifood" ? "IF-STOR-001" : platform.id === "pedidosya" ? "PY-STOR-001" : ""}
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                    placeholder="ID de tienda en la plataforma"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">API Key</label>
                  <input type="password" defaultValue={platform.id === "ifood" ? "sk_live_ifood_xxxx" : platform.id === "pedidosya" ? "py_live_xxxx" : ""}
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-mono"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Sync automático</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
                  </label>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Comisión (%)</label>
                  <input type="number" defaultValue={platform.id === "ifood" ? 12 : platform.id === "pedidosya" ? 15 : 18}
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tiempo preparación (min)</label>
                  <input type="number" defaultValue={25}
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                  />
                </div>

                <div className="pt-2">
                  <p className="text-xs text-gray-400 mb-2">Webhook URL:</p>
                  <code className="text-xs block bg-gray-100 dark:bg-slate-700 rounded p-2 font-mono break-all">
                    https://api.intelimarket.com/api/v1/delivery-integrations/webhook/{platform.id}
                  </code>
                </div>

                <button className="w-full text-sm bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg py-2 font-medium transition-colors">
                  Guardar Configuración
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "sync" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map(platform => (
              <button key={platform.id}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:border-cyan-400 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Sincronizar {platform.name}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <h3 className="font-semibold mb-4">Historial de Sincronización</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 text-xs uppercase">
                    <th className="pb-3 pr-4">Plataforma</th>
                    <th className="pb-3 pr-4">Tipo</th>
                    <th className="pb-3 pr-4">Estado</th>
                    <th className="pb-3 pr-4">Productos</th>
                    <th className="pb-3 pr-4">Inicio</th>
                    <th className="pb-3">Fin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  <tr className="text-sm">
                    <td className="py-3 pr-4"><span className="text-red-500 font-medium">iFood</span></td>
                    <td className="py-3 pr-4">Full</td>
                    <td className="py-3 pr-4"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completado</span></td>
                    <td className="py-3 pr-4">1,245</td>
                    <td className="py-3 pr-4 text-gray-500">18:00</td>
                    <td className="py-3 text-gray-500">18:02</td>
                  </tr>
                  <tr className="text-sm">
                    <td className="py-3 pr-4"><span className="text-blue-500 font-medium">PedidosYa</span></td>
                    <td className="py-3 pr-4">Full</td>
                    <td className="py-3 pr-4"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completado</span></td>
                    <td className="py-3 pr-4">1,102</td>
                    <td className="py-3 pr-4 text-gray-500">18:00</td>
                    <td className="py-3 text-gray-500">18:01</td>
                  </tr>
                  <tr className="text-sm">
                    <td className="py-3 pr-4"><span className="text-purple-500 font-medium">Rappi</span></td>
                    <td className="py-3 pr-4">Parcial</td>
                    <td className="py-3 pr-4"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Error</span></td>
                    <td className="py-3 pr-4">0</td>
                    <td className="py-3 pr-4 text-gray-500">17:55</td>
                    <td className="py-3 text-gray-500">17:55</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold mb-4">Registro de Actividad</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {[
              { time: "18:30:15", platform: "ifood", event: "order.new", status: "success", msg: "Nueva orden IF-12345 recibida" },
              { time: "18:30:10", platform: "ifood", event: "webhook", status: "success", msg: "Webhook recibido correctamente" },
              { time: "18:15:22", platform: "pedidosya", event: "order.new", status: "success", msg: "Nueva orden PY-67890 recibida" },
              { time: "18:15:20", platform: "pedidosya", event: "webhook", status: "success", msg: "Webhook recibido correctamente" },
              { time: "17:55:00", platform: "rappi", event: "menu.sync", status: "error", msg: "Error de autenticación con API de Rappi — API key inválida" },
              { time: "17:45:30", platform: "rappi", event: "order.new", status: "success", msg: "Nueva orden RP-11223 recibida" },
              { time: "17:00:00", platform: "ifood", event: "order.status", status: "success", msg: "Orden IF-12344 marcada como entregada" },
              { time: "16:30:00", platform: "pedidosya", event: "order.status", status: "success", msg: "Orden PY-67891 marcada como en camino" },
              { time: "15:00:00", platform: "ifood", event: "order.cancelled", status: "success", msg: "Orden IF-12343 cancelada por cliente" },
              { time: "14:00:00", platform: "pedidosya", event: "menu.sync", status: "success", msg: "Sync completo: 1102 productos sincronizados" },
            ].map((log, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                log.status === "error" ? "bg-red-50 dark:bg-red-900/10" : "bg-gray-50 dark:bg-slate-700/30"
              }`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 ${log.status === "error" ? "bg-red-500" : "bg-emerald-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">{log.time}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      log.platform === "ifood" ? "bg-red-100 text-red-700" :
                      log.platform === "pedidosya" ? "bg-blue-100 text-blue-700" :
                      "bg-purple-100 text-purple-700"
                    }`}>{log.platform}</span>
                    <span className="text-xs font-mono text-gray-400">{log.event}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mt-1">{log.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
