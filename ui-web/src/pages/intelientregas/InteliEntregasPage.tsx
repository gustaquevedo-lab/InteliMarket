import { useState, useEffect, useCallback, useRef } from "react"
import { intelientregasApi, type TrackDelivery, type TrackDriver, type TrackRoute, type TrackVehicle, type TrackStats } from "../../api/intelientregas"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import {
  Truck, MapPin, User, Route, Package, AlertCircle, CheckCircle, Clock, Navigation,
  Search, X, Loader2, RefreshCw, Phone, Star, ChevronRight, Eye, TrendingUp, Users,
  Map, Target, BarChart3, Fuel, Wrench, DollarSign, ClipboardList, Battery,
  Settings, Play, Square, Maximize2, Layers, ChevronDown, ChevronUp, Plus,
  Trash2, Edit3, Filter, ArrowUpDown, Gauge as GaugeIcon, Zap, Activity, CheckSquare,
  FileDown, FileText,
} from "lucide-react"

// ── helpers ──────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  delivered: "Entregado", in_transit: "En tránsito", picked_up: "Retirado",
  assigned: "Asignado", pending: "Pendiente", failed: "Fallido", cancelled: "Cancelado",
}
const STATUS_COLOR: Record<string, string> = {
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  in_transit: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  picked_up: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  assigned: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500",
}
const STATUS_ICON: Record<string, any> = {
  delivered: CheckCircle, in_transit: Truck, picked_up: Package,
  assigned: User, pending: Clock, failed: AlertCircle, cancelled: X,
}

// Sparkline mini bar chart
const SparkBar = ({ data, color = "var(--primary)" }: { data: number[]; color?: string }) => (
  <div className="flex items-end gap-[2px] h-8">
    {data.map((v, i) => (
      <div key={i} className="w-3 rounded-t-sm transition-all hover:opacity-80"
        style={{ height: `${Math.max(v / Math.max(...data, 1) * 100, 8)}%`, backgroundColor: color }} />
    ))}
  </div>
)

// Simple gauge
const Gauge = ({ value, max = 100, label, color = "var(--primary)" }: { value: number; max?: number; label: string; color?: string }) => (
  <div className="flex flex-col items-center">
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${(value / max) * 100}, 100`} className="transition-all duration-1000" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{Math.round(value)}%</span>
    </div>
    <span className="text-[10px] text-gray-500 mt-1">{label}</span>
  </div>
)

// ── Types ────────────────────────────────────────────────────────

type Tab = "dashboard" | "map" | "fleet" | "analytics"
type FleetTab = "vehicles" | "maintenance" | "fuel" | "expenses" | "checklist" | "alerts"

// ── Page ─────────────────────────────────────────────────────────

export default function InteliEntregasPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const { success, error } = useToast()

  // Data
  const [deliveries, setDeliveries] = useState<TrackDelivery[]>([])
  const [drivers, setDrivers] = useState<TrackDriver[]>([])
  const [routes, setRoutes] = useState<TrackRoute[]>([])
  const [vehicles, setVehicles] = useState<TrackVehicle[]>([])
  const [stats, setStats] = useState<TrackStats | null>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [fleetDash, setFleetDash] = useState<any>(null)
  const [liveMapData, setLiveMapData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<any[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(false)

  // Profitability analytics
  const [analyticsDays, setAnalyticsDays] = useState(30)
  const [profitability, setProfitability] = useState<any>(null)
  const [marginRoutes, setMarginRoutes] = useState<any[]>([])
  const [marginDrivers, setMarginDrivers] = useState<any[]>([])
  const [marginVehicles, setMarginVehicles] = useState<any[]>([])
  const [marginZones, setMarginZones] = useState<any[]>([])
  const [businessLines, setBusinessLines] = useState<any[]>([])
  const [deliveryKpi, setDeliveryKpi] = useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  // Sub-tabs
  const [fleetTab, setFleetTab] = useState<FleetTab>("vehicles")
  const [dSubTab, setDSubTab] = useState<"all" | "pending" | "in_transit" | "delivered">("all")

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignDelivery, setAssignDelivery] = useState<TrackDelivery | null>(null)
  const [showDetail, setShowDetail] = useState<TrackDelivery | null>(null)
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
  const [showFuelForm, setShowFuelForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState<string | null>(null)
  const [autoCandidates, setAutoCandidates] = useState<any[] | null>(null)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [assigningAll, setAssigningAll] = useState(false)

  const [maintenanceForm, setMaintenanceForm] = useState({ vehicle_id: "", tipo: "general_service", descripcion: "", costo: 0, proveedor: "", scheduled_date: "" })
  const [fuelForm, setFuelForm] = useState({ vehicle_id: "", litros: 0, costo_por_litro: 0, proveedor: "" })
  const [expenseForm, setExpenseForm] = useState({ vehicle_id: "", categoria: "toll", descripcion: "", monto: 0 })

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [mapReady, setMapReady] = useState(false)
  const mapPollRef = useRef<any>(null)

  // ── Data fetching ──────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [del, drv, rt, veh, st] = await Promise.all([
        intelientregasApi.deliveries.list({ limit: 100 }),
        intelientregasApi.drivers.list({ activo: true }),
        intelientregasApi.routes.list(),
        intelientregasApi.vehicles.list({ activo: true }),
        intelientregasApi.stats.get(),
      ])
      setDeliveries(del)
      setDrivers(drv)
      setRoutes(rt)
      setVehicles(veh)
      setStats(st)

      if (tab === "dashboard" || tab === "analytics") {
        intelientregasApi.analytics.get().then(setAnalytics).catch(() => {})
      }
      if (tab === "fleet") {
        intelientregasApi.fleet.dashboard().then(setFleetDash).catch(() => {})
        intelientregasApi.alerts.list().then(setAlerts).catch(() => {})
      }
    } catch (e: any) {
      error("Error", e.message || "No se pudieron cargar los datos")
    }
    setLoading(false)
  }, [tab])

  useEffect(() => { fetchAll() }, [tab])

  // Load profitability data when analytics tab is active
  useEffect(() => {
    if (tab !== "analytics") return
    setLoadingAnalytics(true)
    Promise.all([
      intelientregasApi.analytics.profitability(analyticsDays),
      intelientregasApi.analytics.marginsRoutes(analyticsDays, 10),
      intelientregasApi.analytics.marginsDrivers(analyticsDays, 10),
      intelientregasApi.analytics.marginsVehicles(analyticsDays, 10),
      intelientregasApi.analytics.marginsZones(analyticsDays),
      intelientregasApi.analytics.businessLines(analyticsDays),
      intelientregasApi.analytics.kpi(analyticsDays),
    ])
      .then(([p, mr, md, mv, mz, bl, k]) => {
        setProfitability(p)
        setMarginRoutes(mr)
        setMarginDrivers(md)
        setMarginVehicles(mv)
        setMarginZones(mz)
        setBusinessLines(bl)
        setDeliveryKpi(k)
      })
      .catch(() => {})
      .finally(() => setLoadingAnalytics(false))
  }, [tab, analyticsDays])

  // Live map polling
  useEffect(() => {
    if (tab !== "map") {
      if (mapPollRef.current) clearInterval(mapPollRef.current)
      return
    }
    const poll = () => {
      intelientregasApi.liveMap.get().then(setLiveMapData).catch(() => {})
    }
    poll()
    mapPollRef.current = setInterval(poll, 10000)
    return () => { if (mapPollRef.current) clearInterval(mapPollRef.current) }
  }, [tab])

  // Init map
  useEffect(() => {
    if (tab !== "map" || !mapContainerRef.current || mapRef.current) return
    import("maplibre-gl").then((maplibregl) => {
      const map = new maplibregl.Map({
        container: mapContainerRef.current!,
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        center: [-57.5759, -25.2637],
        zoom: 12,
      })
      map.addControl(new maplibregl.NavigationControl(), "top-right")
      map.on("load", () => setMapReady(true))
      mapRef.current = map
    }).catch(() => {})
    return () => {
      if (mapPollRef.current) clearInterval(mapPollRef.current)
    }
  }, [tab])

  // Update map markers
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    import("maplibre-gl").then((maplibregl) => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      liveMapData.forEach((item) => {
        if (!item.position) return
        const el = document.createElement("div")
        el.className = "flex items-center justify-center"
        const statusColor = item.current_delivery
          ? (item.current_delivery.estado === "in_transit" ? "#3b82f6" : "#f59e0b")
          : "#6b7280"
        el.innerHTML = `<div style="width:16px;height:16px;border-radius:50%;background:${statusColor};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`
        el.style.cursor = "pointer"
        el.title = `${item.driver_nombre} — ${item.current_delivery?.customer || "Sin entrega activa"}`

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([item.position.lng, item.position.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2"><strong>${item.driver_nombre}</strong><br/>
             <span class="text-xs">📞 ${item.driver_telefono || "—"}</span><br/>
             <span class="text-xs">⭐ ${"★".repeat(Math.round(item.driver_rating))}${"☆".repeat(5 - Math.round(item.driver_rating))}</span><br/>
             ${item.current_delivery ? `<span class="text-xs">📍 ${item.current_delivery.customer} — ${STATUS_LABEL[item.current_delivery.estado] || item.current_delivery.estado}</span>` : ""}
             </div>`
          ))
          .addTo(map)
        markersRef.current.push(marker)
      })
    }).catch(() => {})
  }, [liveMapData, mapReady])

  // ── Actions ────────────────────────────────────────────────────

  const handleAssign = async (deliveryId: string, driverId: string) => {
    try {
      await intelientregasApi.deliveries.assign(deliveryId, { driver_id: driverId })
      success("Asignado", "Entrega asignada correctamente")
      setShowAssignModal(false)
      fetchAll()
    } catch (e: any) { error("Error", e.message) }
  }

  const handleAutoAssignCandidates = async (deliveryId: string) => {
    setLoadingCandidates(true)
    setAutoCandidates(null)
    try {
      const res = await intelientregasApi.deliveries.autoAssignCandidates(deliveryId)
      setAutoCandidates(res.candidates)
    } catch (e: any) { error("Error", e.message) }
    setLoadingCandidates(false)
  }

  const handleAutoAssignBatch = async () => {
    setAssigningAll(true)
    try {
      const res = await intelientregasApi.deliveries.autoAssignBatch()
      success("Asignación masiva", `${res.assigned} entregas asignadas, ${res.errors} con error`)
      fetchAll()
    } catch (e: any) { error("Error", e.message) }
    setAssigningAll(false)
  }

  const handleStatusChange = async (id: string, estado: string) => {
    try {
      await intelientregasApi.deliveries.updateStatus(id, { estado })
      success("Estado actualizado", STATUS_LABEL[estado] || estado)
      fetchAll()
    } catch (e: any) { error("Error", e.message) }
  }

  const handleOptimize = async (routeId: string) => {
    setOptimizing(routeId)
    try {
      const res = await intelientregasApi.routes.optimize(routeId)
      success("Ruta optimizada", `${res.stops_optimized} paradas reordenadas — ${res.distance_km}km, ${res.duration_min}min`)
      fetchAll()
    } catch (e: any) { error("Error", e.message) }
    setOptimizing(null)
  }

  const handleCreateMaintenance = async () => {
    try {
      await intelientregasApi.fleet.maintenance.create(maintenanceForm)
      success("Mantenimiento creado", "Se registró correctamente")
      setShowMaintenanceForm(false)
      setMaintenanceForm({ vehicle_id: "", tipo: "general_service", descripcion: "", costo: 0, proveedor: "", scheduled_date: "" })
    } catch (e: any) { error("Error", e.message) }
  }

  const handleAddFuel = async () => {
    try {
      await intelientregasApi.fleet.fuel.create(fuelForm)
      success("Carga registrada", `${fuelForm.litros}L a Gs. ${(fuelForm.costo_por_litro).toFixed(0)}/L`)
      setShowFuelForm(false)
      setFuelForm({ vehicle_id: "", litros: 0, costo_por_litro: 0, proveedor: "" })
    } catch (e: any) { error("Error", e.message) }
  }

  const handleAddExpense = async () => {
    try {
      await intelientregasApi.fleet.expenses.create(expenseForm)
      success("Gasto registrado")
      setShowExpenseForm(false)
      setExpenseForm({ vehicle_id: "", categoria: "toll", descripcion: "", monto: 0 })
    } catch (e: any) { error("Error", e.message) }
  }

  // ── Derived ────────────────────────────────────────────────────

  const filteredDeliveries = deliveries.filter(d => {
    if (dSubTab === "all") return true
    return d.estado === dSubTab
  })

  // ── Tabs ───────────────────────────────────────────────────────

  const MAIN_TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: "map", label: "Mapa en Vivo", icon: Map },
    { key: "fleet", label: "Flota", icon: Truck },
    { key: "analytics", label: "Analytics", icon: TrendingUp },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" />
            InteliEntregas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de entregas, flota y repartos en tiempo real</p>
        </div>
        <button onClick={fetchAll} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="Recargar">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit overflow-x-auto">
        {MAIN_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              tab === key ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"
            }`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ════════════════════════ DASHBOARD ════════════════════════ */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{analytics?.today_deliveries ?? stats?.pending ?? "—"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Entregas Hoy</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><Package className="w-5 h-5" /></div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded font-medium">{analytics?.today_delivered ?? 0} entregadas</span>
                <span className="text-amber-600">{analytics?.today_pending ?? 0} pendientes</span>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{analytics?.on_time_rate ?? 0}%</p>
                  <p className="text-xs text-gray-500 mt-0.5">Tasa a Tiempo</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600"><CheckCircle className="w-5 h-5" /></div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-green-600">{analytics?.avg_delivery_time_min ?? 0}min promedio</span>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{drivers.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Repartidores</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600"><Users className="w-5 h-5" /></div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-purple-600">{drivers.filter(d => d.status === "on_delivery").length} en ruta</span>
                <span className="text-gray-500">· ⭐ {stats?.avg_driver_rating ?? 0}</span>
              </div>
            </div>
            <div className="card p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{routes.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Rutas</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600"><Route className="w-5 h-5" /></div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-green-600">{routes.filter(r => r.estado === "completed").length} completadas</span>
                <span className="text-blue-600">· {routes.filter(r => r.estado === "in_progress").length} activas</span>
              </div>
            </div>
          </div>

          {/* Status breakdown + Sparkline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" /> Estado de Entregas</h3>
              <div className="grid grid-cols-5 gap-3">
                {["pending", "assigned", "picked_up", "in_transit", "delivered", "failed"].map(est => {
                  const count = stats?.by_estado?.[est] || 0
                  const total = Object.values(stats?.by_estado || {}).reduce((a: number, b: any) => a + (typeof b === "number" ? b : 0), 0)
                  const pct = total > 0 ? Math.round(count / total * 100) : 0
                  const Icon = STATUS_ICON[est] || Package
                  return (
                    <div key={est} className="flex flex-col items-center p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                      <Icon className={`w-5 h-5 mb-1 ${est === "failed" ? "text-red-500" : "text-blue-500"}`} />
                      <span className="text-lg font-bold">{count}</span>
                      <span className="text-[10px] text-gray-500">{STATUS_LABEL[est] || est}</span>
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                        <div className={`h-full rounded-full ${est === "failed" ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><GaugeIcon className="w-4 h-4 text-blue-500" /> Rendimiento</h3>
              <div className="flex justify-around">
                <Gauge value={analytics?.on_time_rate ?? 0} label="A Tiempo" color="#22c55e" />
                <Gauge value={stats && stats.delivered + stats.failed > 0 ? Math.round(stats.delivered / (stats.delivered + stats.failed) * 100) : 0} label="Entrega" color="#3b82f6" />
                <Gauge value={drivers.filter(d => d.status === "on_delivery").length > 0 ? Math.round(drivers.filter(d => d.status === "on_delivery").length / drivers.length * 100) : 0} label="Activos" color="#8b5cf6" />
              </div>
            </div>
          </div>

          {/* Recent deliveries + Active routes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /> Últimas Entregas</h3>
              <div className="space-y-2">
                {deliveries.slice(0, 6).map(d => {
                  const Icon = STATUS_ICON[d.estado] || Package
                  return (
                    <button key={d.id} onClick={() => setShowDetail(d)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors text-left">
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${d.estado === "delivered" ? "text-green-500" : d.estado === "failed" ? "text-red-500" : "text-blue-500"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{d.customer_nombre}</p>
                          <p className="text-xs text-gray-500 truncate">{d.direccion}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[d.estado] || ""}`}>
                        {STATUS_LABEL[d.estado] || d.estado}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Route className="w-4 h-4 text-blue-500" /> Rutas Activas</h3>
              <div className="space-y-2">
                {routes.filter(r => r.estado === "in_progress" || r.estado === "pending").slice(0, 5).map(r => (
                  <div key={r.id} className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{r.nombre}</p>
                        <p className="text-xs text-gray-500">{r.fecha ? new Date(r.fecha).toLocaleDateString("es-PY") : "—"} · {r.total_stops} paradas</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.estado === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {r.estado === "in_progress" ? "En curso" : "Pendiente"}
                        </span>
                        <button onClick={() => handleOptimize(r.id)} disabled={optimizing === r.id}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500" title="Optimizar ruta">
                          {optimizing === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    {r.total_stops > 0 && (
                      <div className="mt-2 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.round(r.completed_stops / r.total_stops * 100)}%` }} />
                      </div>
                    )}
                  </div>
                ))}
                {routes.filter(r => r.estado === "in_progress" || r.estado === "pending").length === 0 && (
                  <p className="text-center py-6 text-gray-400 text-sm">No hay rutas activas</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════ MAP ════════════════════════ */}
      {tab === "map" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 card p-0 overflow-hidden rounded-2xl" style={{ height: "70vh" }}>
            <div ref={mapContainerRef} className="w-full h-full" />
            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">Cargando mapa...</span>
              </div>
            )}
          </div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Repartidores ({liveMapData.length})</h3>
              <div className="space-y-2">
                {liveMapData.map(d => (
                  <div key={d.driver_id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                    <div className={`w-2.5 h-2.5 rounded-full ${d.position ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.driver_nombre}</p>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        {d.current_delivery ? (
                          <>{STATUS_LABEL[d.current_delivery.estado] || d.current_delivery.estado} — {d.current_delivery.customer}</>
                        ) : "Sin entrega activa"}
                      </p>
                    </div>
                    <span className="text-xs">⭐{d.driver_rating}</span>
                  </div>
                ))}
                {liveMapData.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Sin repartidores activos</p>
                )}
              </div>
            </div>
            <div className="card p-4">
              <h3 className="font-semibold text-xs mb-2">Leyenda</h3>
              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> En tránsito</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Retirado</div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-gray-400" /> Sin entrega</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════ FLEET ════════════════════════ */}
      {tab === "fleet" && (
        <div className="space-y-6">
          {/* Fleet KPIs */}
          {fleetDash && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card p-3"><p className="text-xl font-bold">{fleetDash.total_vehicles}</p><p className="text-xs text-gray-500">Vehículos</p></div>
              <div className="card p-3"><p className="text-xl font-bold text-green-600">{fleetDash.active_vehicles}</p><p className="text-xs text-gray-500">Activos</p></div>
              <div className="card p-3"><p className="text-xl font-bold text-amber-600">{fleetDash.maintenance_pending}</p><p className="text-xs text-gray-500">Mant. Pendientes</p></div>
              <div className="card p-3"><p className="text-xl font-bold text-red-600">{fleetDash.maintenance_overdue}</p><p className="text-xs text-gray-500">Vencidos</p></div>
            </div>
          )}

          {/* Fleet sub-tabs */}
          <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit text-xs">
            {(["vehicles", "maintenance", "fuel", "expenses", "checklist", "alerts"] as FleetTab[]).map(ft => (
              <button key={ft} onClick={() => setFleetTab(ft)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  fleetTab === ft ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500"
                }`}>
                {ft === "vehicles" ? "Vehículos" : ft === "maintenance" ? "Mantenimiento" : ft === "fuel" ? "Combustible" : ft === "expenses" ? "Gastos" : ft === "checklist" ? "Checklist" : `Alertas ${alerts.filter(a => a.severidad === "critical").length > 0 ? `(${alerts.filter(a => a.severidad === "critical").length})` : ""}`}
              </button>
            ))}
          </div>
            <button onClick={handleAutoAssignBatch} disabled={assigningAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
              {assigningAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Asignación automática
            </button>
          </div>

          {/* Vehicles tab */}
          {fleetTab === "vehicles" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map(v => (
                <div key={v.id} className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{v.marca || "—"} {v.modelo || ""}</p>
                      <p className="text-xs text-gray-500">{v.patente || "Sin patente"} · {v.tipo}</p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${v.activo ? "bg-green-500" : "bg-gray-400"}`} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                    {v.anio && <span>📅 {v.anio}</span>}
                    {v.capacidad_kg && <span>⚖️ {v.capacidad_kg}kg</span>}
                    {v.tiene_caja_termica && <span className="text-blue-500">❄️ Frío</span>}
                    {v.color && <span>🎨 {v.color}</span>}
                  </div>
                </div>
              ))}
              {vehicles.length === 0 && <p className="text-gray-400 text-sm col-span-full text-center py-8">No hay vehículos registrados</p>}
            </div>
          )}

          {/* Maintenance tab */}
          {fleetTab === "maintenance" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">Registros de mantenimiento preventivo y correctivo</p>
                <button onClick={() => setShowMaintenanceForm(true)} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg">
                  <Plus className="w-3 h-3" />Nuevo
                </button>
              </div>
              <FleetMaintenanceList vehicles={vehicles} onRefresh={fetchAll} />
            </div>
          )}

          {/* Fuel tab */}
          {fleetTab === "fuel" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Cargas de combustible</p>
                  {fleetDash && <p className="text-xs text-amber-600">{fleetDash.fuel_month_liters}L este mes · Gs. {fleetDash.fuel_month_cost.toLocaleString()}</p>}
                </div>
                <button onClick={() => setShowFuelForm(true)} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg">
                  <Plus className="w-3 h-3" />Cargar
                </button>
              </div>
              <FleetFuelList vehicles={vehicles} />
            </div>
          )}

          {/* Expenses tab */}
          {fleetTab === "expenses" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">Otros gastos (peajes, estacionamiento, lavado, etc.)</p>
                <button onClick={() => setShowExpenseForm(true)} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg">
                  <Plus className="w-3 h-3" />Nuevo
                </button>
              </div>
              <FleetExpenseList vehicles={vehicles} />
            </div>
          )}

          {/* Checklist tab */}
          {fleetTab === "checklist" && (
            <div>
              <p className="text-sm text-gray-500 mb-4">Plantillas de checklist para inspecciones diarias</p>
              <FleetChecklistView />
            </div>
          )}

          {/* Alerts tab */}
          {fleetTab === "alerts" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Alertas de vencimientos y mantenimientos programados</p>
                <button onClick={() => { setLoadingAlerts(true); intelientregasApi.alerts.list().then(setAlerts).catch(() => {}).finally(() => setLoadingAlerts(false)) }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                  {loadingAlerts ? <Loader2 className="w-3 h-3 animate-spin" /> : "Actualizar"}
                </button>
              </div>

              {alerts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p className="text-sm font-medium">Sin alertas pendientes</p>
                  <p className="text-xs mt-1">Todas las licencias, seguros, ITV y mantenimientos están al día</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert, i) => {
                    const sevColors: Record<string, string> = {
                      critical: "border-l-red-500 bg-red-50 dark:bg-red-900/10",
                      warning: "border-l-amber-500 bg-amber-50 dark:bg-amber-900/10",
                      info: "border-l-blue-500 bg-blue-50 dark:bg-blue-900/10",
                    }
                    const sevIcons: Record<string, string> = {
                      critical: "🔴", warning: "🟡", info: "🔵",
                    }
                    const daysLeft = alert.descripcion?.match(/(\d+)\s*días/)
                    return (
                      <div key={i} className={`border-l-4 rounded-r-xl p-4 ${sevColors[alert.severidad] || "border-l-gray-500 bg-gray-50"}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-lg">{sevIcons[alert.severidad] || "⚪"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{alert.titulo}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{alert.descripcion}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                alert.severidad === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                alert.severidad === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              }`}>{alert.severidad === "critical" ? "Crítico" : alert.severidad === "warning" ? "Próximo" : "Info"}</span>
                              <span className="text-[10px] text-gray-400">{alert.entidad === "driver" ? "Repartidor" : alert.entidad === "vehicle" ? "Vehículo" : "Mantenimiento"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ ANALYTICS / PROFITABILITY ════════════════════════ */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {/* Period selector + Export buttons */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Período:</span>
              {[7, 15, 30, 60, 90].map(d => (
                <button key={d} onClick={() => setAnalyticsDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    analyticsDays === d ? "bg-primary text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                  }`}>
                  {d} d
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={async () => {
                try {
                  const blob = await intelientregasApi.analytics.exportExcel(analyticsDays)
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a"); a.href = url; a.download = `analytics_entregas.xlsx`; a.click()
                  URL.revokeObjectURL(url)
                  success("Exportado", "Excel generado correctamente")
                } catch (e: any) { error("Error", "No se pudo exportar") }
              }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                <FileDown className="w-3 h-3" /> Excel
              </button>
              <button onClick={async () => {
                try {
                  const blob = await intelientregasApi.analytics.exportPdf(analyticsDays)
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a"); a.href = url; a.download = `analytics_entregas.pdf`; a.click()
                  URL.revokeObjectURL(url)
                  success("Exportado", "PDF generado correctamente")
                } catch (e: any) { error("Error", "No se pudo exportar") }
              }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                <FileText className="w-3 h-3" /> PDF
              </button>
              <button onClick={() => { setLoadingAnalytics(true); Promise.all([
                intelientregasApi.analytics.profitability(analyticsDays),
                intelientregasApi.analytics.marginsRoutes(analyticsDays, 10),
                intelientregasApi.analytics.marginsDrivers(analyticsDays, 10),
                intelientregasApi.analytics.marginsVehicles(analyticsDays, 10),
                intelientregasApi.analytics.marginsZones(analyticsDays),
                intelientregasApi.analytics.businessLines(analyticsDays),
                intelientregasApi.analytics.kpi(analyticsDays),
              ]).then(([p, mr, md, mv, mz, bl, k]) => {
                setProfitability(p); setMarginRoutes(mr); setMarginDrivers(md)
                setMarginVehicles(mv); setMarginZones(mz); setBusinessLines(bl); setDeliveryKpi(k)
              }).catch(() => {}).finally(() => setLoadingAnalytics(false)); }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="Recargar analytics">
                <RefreshCw className={`w-4 h-4 ${loadingAnalytics ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {loadingAnalytics && !profitability ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : (
            <>
              {/* P&L Summary Cards */}
              {profitability && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  <div className="card p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{profitability.total_deliveries}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Entregas</p>
                  </div>
                  <div className="card p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                    <p className="text-xl font-bold text-green-600">{formatPYG(profitability.total_revenue)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Ingresos</p>
                  </div>
                  <div className="card p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                    <p className="text-xl font-bold text-amber-600">{formatPYG(profitability.total_cost)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Costo Total</p>
                  </div>
                  <div className={`card p-4 bg-gradient-to-br ${profitability.gross_margin >= 0 ? "from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20" : "from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20"}`}>
                    <p className={`text-xl font-bold ${profitability.gross_margin >= 0 ? "text-green-600" : "text-red-600"}`}>{formatPYG(profitability.gross_margin)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Margen Bruto</p>
                  </div>
                  <div className={`card p-4 ${profitability.margin_pct >= 0 ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20" : "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20"}`}>
                    <p className={`text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate ${profitability.margin_pct >= 0 ? "text-green-600" : "text-red-600"}`}>{profitability.margin_pct}%</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Margen %</p>
                  </div>
                </div>
              )}

              {/* Cost breakdown + KPIs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {profitability && (
                  <div className="card p-5">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-blue-500" /> Desglose de Costos</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Combustible</span><span className="font-medium text-amber-600">{formatPYG(profitability.fuel_cost)}</span></div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(profitability.fuel_cost / Math.max(profitability.total_cost, 1) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Mantenimiento</span><span className="font-medium text-orange-600">{formatPYG(profitability.maintenance_cost)}</span></div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(profitability.maintenance_cost / Math.max(profitability.total_cost, 1) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Otros gastos</span><span className="font-medium text-red-600">{formatPYG(profitability.expense_cost)}</span></div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(profitability.expense_cost / Math.max(profitability.total_cost, 1) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between text-sm"><span className="font-semibold">Costo x Entrega</span><span className="font-bold">{formatPYG(profitability.avg_cost_per_delivery)}</span></div>
                        <div className="flex justify-between text-sm mt-1"><span className="font-semibold">Ingreso x Entrega</span><span className="font-bold text-green-600">{formatPYG(profitability.avg_revenue_per_delivery)}</span></div>
                      </div>
                    </div>
                  </div>
                )}
                {deliveryKpi && (
                  <div className="card p-5">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><GaugeIcon className="w-4 h-4 text-blue-500" /> KPIs de Entregas</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col items-center p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                        <Gauge value={deliveryKpi.delivery_rate} label="Tasa Entrega" color="#22c55e" />
                      </div>
                      <div className="flex flex-col items-center p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                        <Gauge value={deliveryKpi.failed_rate} label="Tasa Falla" color="#ef4444" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between"><span>Total km</span><span className="font-medium">{deliveryKpi.total_km} km</span></div>
                      <div className="flex justify-between"><span>Combustible</span><span className="font-medium">{deliveryKpi.total_liters_fuel} L</span></div>
                      <div className="flex justify-between"><span>Rendimiento</span><span className="font-medium">{deliveryKpi.fuel_efficiency_kmpl} km/L</span></div>
                      <div className="flex justify-between"><span>Costo x km</span><span className="font-medium">{formatPYG(deliveryKpi.avg_cost_per_km)}</span></div>
                      <div className="flex justify-between"><span>Tarifa promedio</span><span className="font-medium">{formatPYG(deliveryKpi.avg_fee)}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Margins by Route */}
              {marginRoutes.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Route className="w-4 h-4 text-blue-500" /> Rentabilidad por Ruta</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Ruta</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Entregas</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Ingresos</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Costo</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Margen</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">%</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Distancia</th>
                      </tr></thead>
                      <tbody>
                        {marginRoutes.map(r => (
                          <tr key={r.route_id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-2 font-medium">{r.route_nombre}</td>
                            <td className="py-2 px-2 text-right">{r.deliveries}</td>
                            <td className="py-2 px-2 text-right text-green-600 font-medium">{formatPYG(r.revenue)}</td>
                            <td className="py-2 px-2 text-right text-amber-600">{formatPYG(r.estimated_cost)}</td>
                            <td className={`py-2 px-2 text-right font-bold ${r.margin >= 0 ? "text-green-600" : "text-red-600"}`}>{formatPYG(r.margin)}</td>
                            <td className={`py-2 px-2 text-right font-medium ${r.margin_pct >= 0 ? "text-green-600" : "text-red-600"}`}>{r.margin_pct}%</td>
                            <td className="py-2 px-2 text-right text-gray-500">{r.distance_km} km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Margins by Driver */}
              {marginDrivers.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Rentabilidad por Repartidor</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Repartidor</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Entregas</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Ingresos</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Margen</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">%</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Rating</th>
                      </tr></thead>
                      <tbody>
                        {marginDrivers.map(d => (
                          <tr key={d.driver_id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-2 font-medium">{d.driver_nombre}</td>
                            <td className="py-2 px-2 text-right">{d.deliveries}</td>
                            <td className="py-2 px-2 text-right text-green-600 font-medium">{formatPYG(d.revenue)}</td>
                            <td className={`py-2 px-2 text-right font-bold ${d.margin >= 0 ? "text-green-600" : "text-red-600"}`}>{formatPYG(d.margin)}</td>
                            <td className={`py-2 px-2 text-right ${d.margin_pct >= 0 ? "text-green-600" : "text-red-600"}`}>{d.margin_pct}%</td>
                            <td className="py-2 px-2 text-right text-amber-500">⭐ {d.rating}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Margins by Vehicle */}
              {marginVehicles.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Truck className="w-4 h-4 text-blue-500" /> Rentabilidad por Vehículo</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Vehículo</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Entregas</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Ingresos</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Combustible</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Mantenimiento</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Costo Total</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Margen</th>
                        <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">%</th>
                      </tr></thead>
                      <tbody>
                        {marginVehicles.map(v => (
                          <tr key={v.vehicle_id} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 px-2 font-medium text-xs">{v.vehicle_label}</td>
                            <td className="py-2 px-2 text-right">{v.deliveries}</td>
                            <td className="py-2 px-2 text-right text-green-600 font-medium">{formatPYG(v.revenue)}</td>
                            <td className="py-2 px-2 text-right text-amber-600">{formatPYG(v.fuel_cost)}</td>
                            <td className="py-2 px-2 text-right text-orange-600">{formatPYG(v.maintenance_cost)}</td>
                            <td className="py-2 px-2 text-right text-red-600">{formatPYG(v.total_cost)}</td>
                            <td className={`py-2 px-2 text-right font-bold ${v.margin >= 0 ? "text-green-600" : "text-red-600"}`}>{formatPYG(v.margin)}</td>
                            <td className={`py-2 px-2 text-right ${v.margin_pct >= 0 ? "text-green-600" : "text-red-600"}`}>{v.margin_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Margins by Zone + Business Lines */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {marginZones.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-blue-500" /> Rentabilidad por Zona</h3>
                    <div className="space-y-2">
                      {marginZones.map(z => (
                        <div key={z.zone_id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                          <div>
                            <p className="text-sm font-medium">{z.zone_nombre}</p>
                            <p className="text-xs text-gray-500">{z.deliveries} entregas</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-600">{formatPYG(z.revenue)}</p>
                            <p className={`text-xs font-medium ${z.margin_pct >= 0 ? "text-green-500" : "text-red-500"}`}>{z.margin_pct}% margen</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {businessLines.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-blue-500" /> Líneas de Negocio</h3>
                    <div className="space-y-2">
                      {businessLines.map(b => {
                        const colors = ["#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e"]
                        const idx = businessLines.indexOf(b)
                        return (
                          <div key={b.linea} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                              <div>
                                <p className="text-sm font-medium">{b.linea}</p>
                                <p className="text-xs text-gray-500">{b.deliveries} entregas</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600">{formatPYG(b.revenue)}</p>
                              <p className={`text-xs font-medium ${b.margin_pct >= 0 ? "text-green-500" : "text-red-500"}`}>{b.margin_pct}% margen</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════ MODALS ════════════════════ */}

      {/* Assign modal */}
      {showAssignModal && assignDelivery && (
        <Modal onClose={() => setShowAssignModal(false)} title={`Asignar: ${assignDelivery.customer_nombre}`}>
          {/* Auto-assign button */}
          <div className="mb-4">
            <button onClick={() => handleAutoAssignCandidates(assignDelivery.id)} disabled={loadingCandidates}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium border border-indigo-200 dark:border-indigo-800/50">
              {loadingCandidates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loadingCandidates ? "Buscando mejores repartidores..." : autoCandidates ? "Actualizar sugerencias" : "Sugerir mejor repartidor"}
            </button>
          </div>

          {/* Auto-assign candidates */}
          {autoCandidates && autoCandidates.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs text-gray-500 font-medium">Mejores candidatos:</p>
              {autoCandidates.map((c, i) => (
                <button key={c.driver_id} onClick={() => handleAssign(assignDelivery.id, c.driver_id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50/50 to-transparent dark:from-indigo-900/20 dark:to-transparent hover:from-indigo-100 dark:hover:from-indigo-900/40 transition-colors text-left border border-indigo-100 dark:border-indigo-900/50">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? "bg-green-500" : "bg-indigo-400"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.driver_nombre}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>⭐ {c.driver_rating}</span>
                      <span>· {c.driver_total_deliveries} entregas</span>
                      {c.distance_km !== null && <span>· 📍 {c.distance_km}km</span>}
                      {c.vehicle_tipo && <span>· 🚚 {c.vehicle_tipo}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-indigo-600">{c.score}%</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {autoCandidates && autoCandidates.length === 0 && (
            <p className="text-sm text-amber-600 text-center py-3 mb-4">No hay repartidores disponibles</p>
          )}

          {/* Manual driver list */}
          <p className="text-xs text-gray-500 font-medium mb-2">Todos los repartidores disponibles:</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {drivers.filter(d => d.activo && d.status !== "on_delivery").map(d => (
              <button key={d.id} onClick={() => handleAssign(assignDelivery.id, d.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors text-left">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs">
                  {d.nombre.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{d.nombre}</p>
                  <p className="text-xs text-gray-500">⭐ {d.rating} · {d.total_deliveries} entregas</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Delivery detail modal */}
      {showDetail && (
        <Modal onClose={() => setShowDetail(null)} title={showDetail.customer_nombre}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Dirección</p><p className="font-medium">{showDetail.direccion}</p></div>
              <div><p className="text-xs text-gray-500">Teléfono</p><p className="font-medium">{showDetail.customer_telefono || "—"}</p></div>
              <div><p className="text-xs text-gray-500">Estado</p><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[showDetail.estado] || ""}`}>{STATUS_LABEL[showDetail.estado]}</span></div>
              <div><p className="text-xs text-gray-500">Prioridad</p><p className="font-medium">{showDetail.prioridad}</p></div>
            </div>

            {/* Time window */}
            {showDetail.scheduled_from && showDetail.scheduled_to && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Ventana Horaria</p>
                <p className="text-sm font-medium mt-1">
                  {new Date(showDetail.scheduled_from).toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-sm">
                  {new Date(showDetail.scheduled_from).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })} — {new Date(showDetail.scheduled_to).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}

            {showDetail.observaciones && <div><p className="text-xs text-gray-500">Observaciones</p><p className="text-sm">{showDetail.observaciones}</p></div>}
            <div className="grid grid-cols-3 gap-2 text-xs">
              {showDetail.assigned_at && <div className="p-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg"><p className="text-gray-500">Asignado</p><p className="font-medium">{new Date(showDetail.assigned_at).toLocaleString("es-PY")}</p></div>}
              {showDetail.picked_up_at && <div className="p-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg"><p className="text-gray-500">Retirado</p><p className="font-medium">{new Date(showDetail.picked_up_at).toLocaleString("es-PY")}</p></div>}
              {showDetail.delivered_at && <div className="p-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg"><p className="text-gray-500">Entregado</p><p className="font-medium">{new Date(showDetail.delivered_at).toLocaleString("es-PY")}</p></div>}
            </div>
            {showDetail.estado === "pending" && (
              <button onClick={() => { setShowDetail(null); setAssignDelivery(showDetail); setShowAssignModal(true) }}
                className="w-full py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark">
                Asignar Repartidor
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Maintenance form modal */}
      {showMaintenanceForm && (
        <Modal onClose={() => setShowMaintenanceForm(false)} title="Nuevo Mantenimiento">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Vehículo</label>
              <select value={maintenanceForm.vehicle_id} onChange={e => setMaintenanceForm(f => ({ ...f, vehicle_id: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm">
                <option value="">Seleccionar...</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.marca || "—"} {v.modelo || ""} · {v.patente || "sin patente"}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Tipo</label>
              <select value={maintenanceForm.tipo} onChange={e => setMaintenanceForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm">
                <option value="oil_change">Cambio de Aceite</option>
                <option value="tires">Neumáticos</option>
                <option value="brakes">Frenos</option>
                <option value="general_service">Service General</option>
                <option value="itv">ITV / Revisión</option>
                <option value="insurance">Seguro</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div><label className="text-xs font-medium text-gray-500 mb-1 block">Descripción</label>
              <textarea value={maintenanceForm.descripcion} onChange={e => setMaintenanceForm(f => ({ ...f, descripcion: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Costo Gs.</label>
                <input type="number" value={maintenanceForm.costo} onChange={e => setMaintenanceForm(f => ({ ...f, costo: Number(e.target.value) }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Proveedor</label>
                <input type="text" value={maintenanceForm.proveedor} onChange={e => setMaintenanceForm(f => ({ ...f, proveedor: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <button onClick={handleCreateMaintenance} className="w-full py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark">
              Registrar Mantenimiento
            </button>
          </div>
        </Modal>
      )}

      {/* Fuel form */}
      {showFuelForm && (
        <Modal onClose={() => setShowFuelForm(false)} title="Registrar Carga de Combustible">
          <div className="space-y-3">
            <div><label className="text-xs font-medium text-gray-500 mb-1 block">Vehículo</label>
              <select value={fuelForm.vehicle_id} onChange={e => setFuelForm(f => ({ ...f, vehicle_id: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm">
                <option value="">Seleccionar...</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.marca || "—"} · {v.patente || "sin patente"}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Litros</label>
                <input type="number" value={fuelForm.litros} onChange={e => setFuelForm(f => ({ ...f, litros: Number(e.target.value) }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Gs./Litro</label>
                <input type="number" value={fuelForm.costo_por_litro} onChange={e => setFuelForm(f => ({ ...f, costo_por_litro: Number(e.target.value) }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div><label className="text-xs font-medium text-gray-500 mb-1 block">Proveedor</label>
              <input type="text" value={fuelForm.proveedor} onChange={e => setFuelForm(f => ({ ...f, proveedor: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" /></div>
            <button onClick={handleAddFuel} className="w-full py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark">
              Registrar Carga
            </button>
          </div>
        </Modal>
      )}

      {/* Expense form */}
      {showExpenseForm && (
        <Modal onClose={() => setShowExpenseForm(false)} title="Nuevo Gasto">
          <div className="space-y-3">
            <div><label className="text-xs font-medium text-gray-500 mb-1 block">Vehículo</label>
              <select value={expenseForm.vehicle_id} onChange={e => setExpenseForm(f => ({ ...f, vehicle_id: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm">
                <option value="">Seleccionar...</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.marca || "—"} · {v.patente || "sin patente"}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Categoría</label>
                <select value={expenseForm.categoria} onChange={e => setExpenseForm(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm">
                  <option value="toll">Peaje</option>
                  <option value="parking">Estacionamiento</option>
                  <option value="washing">Lavado</option>
                  <option value="fine">Multa</option>
                  <option value="other">Otro</option>
                </select></div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Monto Gs.</label>
                <input type="number" value={expenseForm.monto} onChange={e => setExpenseForm(f => ({ ...f, monto: Number(e.target.value) }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div><label className="text-xs font-medium text-gray-500 mb-1 block">Descripción</label>
              <input type="text" value={expenseForm.descripcion} onChange={e => setExpenseForm(f => ({ ...f, descripcion: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" /></div>
            <button onClick={handleAddExpense} className="w-full py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark">
              Registrar Gasto
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FleetMaintenanceList({ vehicles, onRefresh }: { vehicles: TrackVehicle[]; onRefresh: () => void }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    intelientregasApi.fleet.maintenance.list().then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return <p className="text-sm text-gray-400">Cargando...</p>
  if (items.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Sin registros de mantenimiento</p>
  return (
    <div className="space-y-2">
      {items.map(m => {
        const v = vehicles.find(v => v.id === m.vehicle_id)
        const statusColor = m.status === "completed" ? "text-green-600 bg-green-100" : m.status === "in_progress" ? "text-blue-600 bg-blue-100" : "text-amber-600 bg-amber-100"
        return (
          <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{m.tipo?.replace(/_/g, " ") || "Mantenimiento"}</p>
              <p className="text-xs text-gray-500">{v?.marca || "—"} {v?.modelo || ""} · {m.descripcion?.slice(0, 60) || ""}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{m.status === "completed" ? "Completado" : m.status === "in_progress" ? "En curso" : "Programado"}</span>
              {m.costo > 0 && <p className="text-xs text-gray-500 mt-0.5">Gs. {m.costo.toLocaleString()}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FleetFuelList({ vehicles }: { vehicles: TrackVehicle[] }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    intelientregasApi.fleet.fuel.list({ limit: 50 }).then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return <p className="text-sm text-gray-400">Cargando...</p>
  if (items.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Sin cargas registradas</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-200 dark:border-gray-700">
          <th className="text-left py-2 px-2 text-xs text-gray-500 font-medium">Vehículo</th>
          <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Litros</th>
          <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Gs./L</th>
          <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Total</th>
          <th className="text-right py-2 px-2 text-xs text-gray-500 font-medium">Fecha</th>
        </tr></thead>
        <tbody>
          {items.map(f => {
            const v = vehicles.find(v => v.id === f.vehicle_id)
            return (
              <tr key={f.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 px-2 text-sm">{v?.marca || "—"} · {v?.patente || ""}</td>
                <td className="py-2 px-2 text-right font-medium">{f.litros}L</td>
                <td className="py-2 px-2 text-right text-gray-500">Gs. {f.costo_por_litro?.toFixed(0) || 0}</td>
                <td className="py-2 px-2 text-right font-medium text-amber-600">Gs. {(f.litros * f.costo_por_litro).toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-500 text-xs">{new Date(f.fecha).toLocaleDateString("es-PY")}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FleetExpenseList({ vehicles }: { vehicles: TrackVehicle[] }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    intelientregasApi.fleet.expenses.list({ limit: 50 }).then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])
  if (loading) return <p className="text-sm text-gray-400">Cargando...</p>
  if (items.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Sin gastos registrados</p>
  return (
    <div className="space-y-2">
      {items.map(e => {
        const v = vehicles.find(v => v.id === e.vehicle_id)
        return (
          <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <DollarSign className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-sm font-medium capitalize">{e.categoria}</p>
                <p className="text-xs text-gray-500">{v?.marca || "—"} · {e.descripcion?.slice(0, 40) || ""}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-red-600">Gs. {e.monto.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">{new Date(e.fecha).toLocaleDateString("es-PY")}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FleetChecklistView() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newCat, setNewCat] = useState("pre_trip")
  useEffect(() => {
    intelientregasApi.fleet.checklistItems.list().then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const addItem = async () => {
    if (!newName.trim()) return
    try {
      await intelientregasApi.fleet.checklistItems.create({ nombre: newName, categoria: newCat })
      setNewName("")
      const updated = await intelientregasApi.fleet.checklistItems.list()
      setItems(updated)
    } catch {}
  }

  const categories = [
    { value: "pre_trip", label: "Pre-Viaje" },
    { value: "post_trip", label: "Post-Viaje" },
    { value: "weekly", label: "Semanal" },
    { value: "monthly", label: "Mensual" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nuevo item..."
          className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" />
        <select value={newCat} onChange={e => setNewCat(e.target.value)}
          className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-sm">
          {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button onClick={addItem} className="px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {loading ? <p className="text-sm text-gray-400">Cargando...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map((item: any) => (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
              <CheckSquare className={`w-4 h-4 ${item.obligatorio ? "text-blue-500" : "text-gray-400"}`} />
              <span className="text-sm flex-1">{item.nombre}</span>
              <span className="text-[10px] text-gray-500 capitalize">{categories.find(c => c.value === item.categoria)?.label || item.categoria}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
