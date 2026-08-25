import { useState, useEffect } from "react"
import { Repeat, Calendar, Package, DollarSign, TrendingUp, Clock, CheckCircle, XCircle, PauseCircle, Play, SkipForward, User, Phone, MapPin, ShoppingCart, Plus, Trash2, Edit3, Search, Filter, Loader2, AlertCircle, BarChart3, List, Activity, Percent } from "lucide-react"
import { useToast } from "../../hooks/useToast"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"

type Tab = "dashboard" | "plans" | "create" | "orders" | "products"

const FREQUENCIES = [
  { id: "weekly", label: "Semanal", days: 7 },
  { id: "biweekly", label: "Quincenal", days: 14 },
  { id: "monthly", label: "Mensual", days: 30 },
]

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

const AVAILABLE_PRODUCTS = [
  { id: "sp1", name: "Leche Entera 1L", price: 7500, category: "Lácteos", image: "🥛" },
  { id: "sp2", name: "Yogurt Natural 1kg", price: 14500, category: "Lácteos", image: "🫗" },
  { id: "sp3", name: "Queso Paraguay 500g", price: 18500, category: "Lácteos", image: "🧀" },
  { id: "sp4", name: "Pan Molde 600g", price: 8500, category: "Panadería", image: "🍞" },
  { id: "sp5", name: "Pan Hamburguesa 8un", price: 9500, category: "Panadería", image: "🍔" },
  { id: "sp6", name: "Huevos 12un", price: 12500, category: "Huevos", image: "🥚" },
  { id: "sp7", name: "Gaseosa Cola 2L", price: 11200, category: "Bebidas", image: "🥤" },
  { id: "sp8", name: "Agua Mineral 1.5L", price: 4200, category: "Bebidas", image: "💧" },
  { id: "sp9", name: "Cerveza 6un", price: 28500, category: "Bebidas", image: "🍺" },
  { id: "sp10", name: "Arroz Tipo 1 5kg", price: 28500, category: "Almacén", image: "🍚" },
  { id: "sp11", name: "Fideo Tallarín 500g", price: 5500, category: "Almacén", image: "🍝" },
  { id: "sp12", name: "Aceite Girasol 1L", price: 12800, category: "Almacén", image: "🫒" },
  { id: "sp13", name: "Azúcar 1kg", price: 6200, category: "Almacén", image: "🍬" },
  { id: "sp14", name: "Yerba Mate 1kg", price: 14500, category: "Almacén", image: "🧉" },
  { id: "sp15", name: "Carne Vacuna kg", price: 38000, category: "Carnes", image: "🥩" },
  { id: "sp16", name: "Pollo Entero kg", price: 16500, category: "Carnes", image: "🍗" },
  { id: "sp17", name: "Tomate kg", price: 8500, category: "Verduras", image: "🍅" },
  { id: "sp18", name: "Cebolla kg", price: 6200, category: "Verduras", image: "🧅" },
  { id: "sp19", name: "Papá kg", price: 5500, category: "Verduras", image: "🥔" },
  { id: "sp20", name: "Banana kg", price: 7800, category: "Frutas", image: "🍌" },
]

const DUMMY_DASHBOARD = {
  total_plans: 24,
  active_plans: 18,
  paused_plans: 4,
  cancelled_plans: 2,
  total_customers: 22,
  mrr: 4875000,
  avg_order_value: 89250,
  retention_rate: 91.7,
  orders_generated_total: 156,
  next_due_generations: 5,
  plans_by_frequency: [
    { frequency: "weekly", count: 12 },
    { frequency: "biweekly", count: 5 },
    { frequency: "monthly", count: 7 },
  ],
  recent_generations: [
    { id: "go1", order_number: "SUSC-250604-0001", status: "generated", total: 124500, scheduled_date: "2026-06-11", generated_at: "2026-06-04T10:00:00" },
    { id: "go2", order_number: "SUSC-250604-0002", status: "generated", total: 87500, scheduled_date: "2026-06-11", generated_at: "2026-06-04T10:00:00" },
    { id: "go3", order_number: "SUSC-250604-0003", status: "generated", total: 156000, scheduled_date: "2026-06-11", generated_at: "2026-06-04T10:00:00" },
  ],
  top_products: [
    { product_name: "Leche Entera 1L", total_quantity: 48 },
    { product_name: "Pan Molde 600g", total_quantity: 36 },
    { product_name: "Huevos 12un", total_quantity: 30 },
    { product_name: "Yogurt Natural 1kg", total_quantity: 24 },
    { product_name: "Gaseosa Cola 2L", total_quantity: 18 },
  ],
}

const DUMMY_PLANS = [
  { id: "p1", customer_name: "María González", frequency: "weekly", status: "active", discount_pct: 10, total_generated: 8, total_spent: 980000, next_generation_date: "2026-06-11", delivery_day: 4, items: [{ product_name: "Leche Entera 1L", quantity: 3 }, { product_name: "Pan Molde 600g", quantity: 1 }, { product_name: "Huevos 12un", quantity: 1 }] },
  { id: "p2", customer_name: "Carlos Benítez", frequency: "biweekly", status: "active", discount_pct: 5, total_generated: 4, total_spent: 650000, next_generation_date: "2026-06-14", delivery_day: 0, items: [{ product_name: "Gaseosa Cola 2L", quantity: 2 }, { product_name: "Cerveza 6un", quantity: 1 }, { product_name: "Carne Vacuna kg", quantity: 1 }] },
  { id: "p3", customer_name: "Ana Martínez", frequency: "monthly", status: "paused", discount_pct: 8, total_generated: 3, total_spent: 420000, pause_reason: "De viaje", delivery_day: 15, items: [{ product_name: "Yogurt Natural 1kg", quantity: 2 }, { product_name: "Queso Paraguay 500g", quantity: 1 }, { product_name: "Arroz Tipo 1 5kg", quantity: 1 }] },
  { id: "p4", customer_name: "Pedro Ramírez", frequency: "weekly", status: "active", discount_pct: 0, total_generated: 12, total_spent: 1450000, next_generation_date: "2026-06-08", delivery_day: 1, items: [{ product_name: "Leche Entera 1L", quantity: 2 }, { product_name: "Pan Hamburguesa 8un", quantity: 2 }, { product_name: "Papá kg", quantity: 1 }] },
  { id: "p5", customer_name: "Laura Villalba", frequency: "monthly", status: "active", discount_pct: 12, total_generated: 6, total_spent: 1200000, next_generation_date: "2026-06-20", delivery_day: 20, items: [{ product_name: "Aceite Girasol 1L", quantity: 2 }, { product_name: "Arroz Tipo 1 5kg", quantity: 2 }, { product_name: "Yerba Mate 1kg", quantity: 1 }, { product_name: "Azúcar 1kg", quantity: 1 }] },
  { id: "p6", customer_name: "Roberto Acosta", frequency: "weekly", status: "active", discount_pct: 5, total_generated: 15, total_spent: 1100000, next_generation_date: "2026-06-10", delivery_day: 3, items: [{ product_name: "Huevos 12un", quantity: 1 }, { product_name: "Pollo Entero kg", quantity: 1 }, { product_name: "Banana kg", quantity: 1 }] },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: "Activo", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle },
  paused: { label: "Pausado", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: PauseCircle },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
}

export default function SuscripcionesPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<any>(DUMMY_DASHBOARD)
  const [plans, setPlans] = useState<any[]>(DUMMY_PLANS)
  const [statusFilter, setStatusFilter] = useState("")
  const [freqFilter, setFreqFilter] = useState("")
  const toast = useToast()

  const [newPlan, setNewPlan] = useState({
    customer_name: "", customer_phone: "", customer_email: "",
    frequency: "weekly", delivery_day: 1, delivery_address: "",
    discount_pct: 0, start_date: "", items: [] as any[],
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [dashRes, plansRes] = await Promise.all([
        api.suscripciones.getDashboard().catch(() => DUMMY_DASHBOARD),
        api.suscripciones.plans.list().catch(() => DUMMY_PLANS),
      ])
      setDashboard(dashRes)
      setPlans(plansRes)
    } catch { setDashboard(DUMMY_DASHBOARD); setPlans(DUMMY_PLANS) }
    setLoading(false)
  }

  const filteredPlans = plans.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false
    if (freqFilter && p.frequency !== freqFilter) return false
    return true
  })

  const addProductToPlan = (product: any) => {
    const existing = newPlan.items.find(i => i.product_id === product.id)
    if (existing) {
      setNewPlan({ ...newPlan, items: newPlan.items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i) })
    } else {
      setNewPlan({ ...newPlan, items: [...newPlan.items, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.price }] })
    }
  }

  const removeItem = (idx: number) => {
    setNewPlan({ ...newPlan, items: newPlan.items.filter((_, i) => i !== idx) })
  }

  const planSubtotal = newPlan.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const planDiscount = planSubtotal * (newPlan.discount_pct / 100)
  const planTotal = planSubtotal - planDiscount

  const tabs = [
    { id: "dashboard" as Tab, label: "Dashboard", icon: BarChart3 },
    { id: "plans" as Tab, label: "Planes", icon: List },
    { id: "create" as Tab, label: "Nuevo Plan", icon: Plus },
    { id: "orders" as Tab, label: "Órdenes", icon: Package },
    { id: "products" as Tab, label: "Productos", icon: ShoppingCart },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate flex items-center gap-2">
            <Repeat className="w-6 h-6 text-emerald-500" />
            Suscripciones & Órdenes Recurrentes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Planes semanales/quincenales/mensuales — generación automática, MRR, retención
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Repeat className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Planes Activos</p>
                  <p className="text-xl font-bold">{dashboard.active_plans}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">MRR</p>
                  <p className="text-xl font-bold">{formatPYG(dashboard.mrr)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Retención</p>
                  <p className="text-xl font-bold">{dashboard.retention_rate}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Próximas</p>
                  <p className="text-xl font-bold">{dashboard.next_due_generations}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                  <Package className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Órdenes</p>
                  <p className="text-xl font-bold">{dashboard.orders_generated_total}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" /> Planes por Frecuencia</h3>
              <div className="space-y-3">
                {dashboard.plans_by_frequency?.map((p: any) => {
                  const f = FREQUENCIES.find(f => f.id === p.frequency)
                  return (
                    <div key={p.frequency} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{f?.label || p.frequency}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">{p.count} planes</span>
                        <div className="w-24 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(p.count / Math.max(...dashboard.plans_by_frequency.map((x: any) => x.count))) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Top Productos</h3>
              <div className="space-y-3">
                {dashboard.top_products?.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{p.product_name}</span>
                    <span className="text-sm font-medium text-emerald-600">{p.total_quantity} un/mes</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "plans" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter className="w-4 h-4" /> Filtros:
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
            >
              <option value="">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="paused">Pausados</option>
              <option value="cancelled">Cancelados</option>
            </select>
            <select value={freqFilter} onChange={e => setFreqFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
            >
              <option value="">Todas las frecuencias</option>
              {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 text-xs uppercase bg-gray-50 dark:bg-slate-800/50">
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Frecuencia</th>
                  <th className="p-4">Dto.</th>
                  <th className="p-4">Órdenes</th>
                  <th className="p-4">Gastado</th>
                  <th className="p-4">Próxima</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredPlans.map(p => {
                  const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.active
                  const freq = FREQUENCIES.find(f => f.id === p.frequency)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{p.customer_name}</span>
                          <span className="text-xs text-gray-500">{p.items?.length || 0} productos</span>
                        </div>
                      </td>
                      <td className="p-4">{freq?.label || p.frequency}</td>
                      <td className="p-4">
                        {p.discount_pct > 0 ? <span className="text-emerald-600 font-medium">{p.discount_pct}%</span> : "-"}
                      </td>
                      <td className="p-4">{p.total_generated}</td>
                      <td className="p-4 font-medium">{formatPYG(p.total_spent)}</td>
                      <td className="p-4 text-xs">
                        {p.next_generation_date ? new Date(p.next_generation_date + "T12:00:00").toLocaleDateString("es-PY") : "-"}
                        {p.delivery_day !== undefined && <span className="text-gray-500 ml-1">({WEEKDAYS[p.delivery_day]})</span>}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                          <sc.icon className="w-3 h-3" /> {sc.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          {p.status === "active" && (
                            <>
                              <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500" title="Skip próxima"><SkipForward className="w-4 h-4" /></button>
                              <button className="p-1.5 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/20 text-yellow-600" title="Pausar"><PauseCircle className="w-4 h-4" /></button>
                            </>
                          )}
                          {p.status === "paused" && (
                            <button className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/20 text-emerald-600" title="Reanudar"><Play className="w-4 h-4" /></button>
                          )}
                          <button className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-500" title="Editar"><Edit3 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Datos del Cliente</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nombre</label>
                <input type="text" value={newPlan.customer_name} onChange={e => setNewPlan({ ...newPlan, customer_name: e.target.value })}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" placeholder="Nombre del cliente" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Teléfono</label>
                <input type="text" value={newPlan.customer_phone} onChange={e => setNewPlan({ ...newPlan, customer_phone: e.target.value })}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" placeholder="0981 123 456" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Email</label>
                <input type="email" value={newPlan.customer_email} onChange={e => setNewPlan({ ...newPlan, customer_email: e.target.value })}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" placeholder="cliente@email.com" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Dirección</label>
                <input type="text" value={newPlan.delivery_address} onChange={e => setNewPlan({ ...newPlan, delivery_address: e.target.value })}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" placeholder="Dirección de entrega" />
              </div>
            </div>

            <h3 className="font-semibold pt-2 flex items-center gap-2"><Calendar className="w-4 h-4" /> Configuración</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Frecuencia</label>
                <select value={newPlan.frequency} onChange={e => setNewPlan({ ...newPlan, frequency: e.target.value })}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700">
                  {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Día de Entrega</label>
                <select value={newPlan.delivery_day} onChange={e => setNewPlan({ ...newPlan, delivery_day: Number(e.target.value) })}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700">
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Descuento (%)</label>
                <input type="number" value={newPlan.discount_pct} onChange={e => setNewPlan({ ...newPlan, discount_pct: Number(e.target.value) })}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700" min={0} max={30} />
              </div>
            </div>

            <h3 className="font-semibold pt-2 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Productos del Plan</h3>
            {newPlan.items.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Seleccioná productos de la lista de la derecha</p>
            ) : (
              <div className="space-y-2">
                {newPlan.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{AVAILABLE_PRODUCTS.find(p => p.id === item.product_id)?.image || "📦"}</span>
                      <div>
                        <p className="text-sm font-medium">{item.product_name}</p>
                        <p className="text-xs text-gray-500">{formatPYG(item.unit_price)} c/u</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => {
                          if (item.quantity <= 1) removeItem(i)
                          else {
                            const items = [...newPlan.items]
                            items[i] = { ...items[i], quantity: items[i].quantity - 1 }
                            setNewPlan({ ...newPlan, items })
                          }
                        }} className="w-6 h-6 rounded bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-sm">-</button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button onClick={() => {
                          const items = [...newPlan.items]
                          items[i] = { ...items[i], quantity: items[i].quantity + 1 }
                          setNewPlan({ ...newPlan, items })
                        }} className="w-6 h-6 rounded bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-sm">+</button>
                      </div>
                      <span className="text-sm font-medium w-20 text-right">{formatPYG(item.quantity * item.unit_price)}</span>
                      <button onClick={() => removeItem(i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-slate-700">
              <div className="text-right space-y-1">
                <div className="flex justify-between gap-8 text-sm"><span className="text-gray-500">Subtotal</span><span>{formatPYG(planSubtotal)}</span></div>
                {newPlan.discount_pct > 0 && <div className="flex justify-between gap-8 text-sm"><span className="text-gray-500">Descuento ({newPlan.discount_pct}%)</span><span className="text-emerald-600">-{formatPYG(planDiscount)}</span></div>}
                <div className="flex justify-between gap-8 text-lg font-bold"><span>Total</span><span className="text-emerald-600">{formatPYG(planTotal)}</span></div>
              </div>
            </div>

            <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-3 font-medium transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Crear Plan de Suscripción
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Productos</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {AVAILABLE_PRODUCTS.map(p => (
                <button key={p.id} onClick={() => addProductToPlan(p)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 text-left transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                >
                  <span className="text-lg">{p.image}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{formatPYG(p.price)} · {p.category}</p>
                  </div>
                  <Plus className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold mb-4">Órdenes Generadas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 text-xs uppercase">
                  <th className="pb-3 pr-4">N° Orden</th>
                  <th className="pb-3 pr-4">Total</th>
                  <th className="pb-3 pr-4">Fecha Programada</th>
                  <th className="pb-3 pr-4">Generada</th>
                  <th className="pb-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {dashboard.recent_generations?.map((o: any) => (
                  <tr key={o.id} className="text-sm">
                    <td className="py-3 pr-4 font-mono text-xs">{o.order_number}</td>
                    <td className="py-3 pr-4 font-medium">{formatPYG(o.total)}</td>
                    <td className="py-3 pr-4">{o.scheduled_date ? new Date(o.scheduled_date + "T12:00:00").toLocaleDateString("es-PY") : "-"}</td>
                    <td className="py-3 pr-4 text-xs text-gray-500">{o.generated_at ? new Date(o.generated_at).toLocaleString("es-PY") : "-"}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        o.status === "generated" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {o.status === "generated" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {o.status === "generated" ? "Generada" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "products" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold mb-4">Productos Disponibles para Suscripción</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {AVAILABLE_PRODUCTS.map(p => (
              <div key={p.id} className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                <div className="text-3xl mb-2">{p.image}</div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-gray-500 mb-2">{p.category}</p>
                <p className="text-sm font-semibold text-emerald-600">{formatPYG(p.price)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
