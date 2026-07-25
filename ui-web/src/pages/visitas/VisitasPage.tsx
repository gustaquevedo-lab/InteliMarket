import { useState, useEffect } from "react"
import { Search, Filter, Calendar, Clock, DollarSign, ShoppingCart, Star, MapPin, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"

const RESULT_LABELS: Record<string, string> = {
  order_taken: "Pedido tomado",
  payment_collected: "Cobranza realizada",
  delivery: "Entrega",
  no_answer: "Sin respuesta",
  rescheduled: "Reprogramada",
  no_sale: "Sin venta",
  visit_only: "Solo visita",
}

export default function VisitasPage() {
  const { user } = useAuth()
  const companyId = user?.company_id || "00000000-0000-0000-0000-000000000010"
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedVisit, setSelectedVisit] = useState<any>(null)
  const [stats, setStats] = useState({ total: 0, completed: 0, missed: 0, orders: 0, amount: 0 })

  useEffect(() => { loadVisits() }, [])
  useEffect(() => { calculateStats() }, [visits])

  const loadVisits = async () => {
    setLoading(true)
    try {
      const instances = await api.distribuidora.tracking.routeInstances.list(companyId)
      const allStops: any[] = []
      for (const inst of instances || []) {
        try {
          const stops = await api.distribuidora.tracking.routeInstances.stops.list(inst.id)
          allStops.push(...(stops || []).map((s: any) => ({ ...s, routeDate: inst.fecha, sellerId: inst.seller_id, routeStatus: inst.status })))
        } catch {}
      }
      setVisits(allStops.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    } catch {}
    setLoading(false)
  }

  const calculateStats = () => {
    const total = visits.length
    const completed = visits.filter(v => v.status === "completed").length
    const missed = visits.filter(v => v.status === "missed" || v.status === "cancelled").length
    const orders = visits.filter(v => v.order_amount > 0).length
    const amount = visits.reduce((sum, v) => sum + Number(v.order_amount || 0), 0)
    setStats({ total, completed, missed, orders, amount })
  }

  const filtered = visits.filter(v => {
    if (statusFilter && v.status !== statusFilter) return false
    if (search && !v.customer_id?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Visitas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stats.total} visitas registradas</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3"><p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold">{stats.total}</p></div>
        <div className="bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-800 p-3"><p className="text-xs text-green-600">Completadas</p><p className="text-xl font-bold text-green-700">{stats.completed}</p></div>
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800 p-3"><p className="text-xs text-red-600">Perdidas</p><p className="text-xl font-bold text-red-700">{stats.missed}</p></div>
        <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-200 dark:border-purple-800 p-3"><p className="text-xs text-purple-600">Pedidos</p><p className="text-xl font-bold text-purple-700">{stats.orders}</p></div>
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 p-3"><p className="text-xs text-amber-600">Monto Gs.</p><p className="text-xl font-bold text-amber-700">{stats.amount.toLocaleString()}</p></div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar por cliente..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="in_progress">En curso</option>
          <option value="completed">Completada</option>
          <option value="missed">Perdida</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left p-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left p-3 font-medium text-gray-500">Estado</th>
                <th className="text-left p-3 font-medium text-gray-500">Resultado</th>
                <th className="text-right p-3 font-medium text-gray-500">Pedido Gs.</th>
                <th className="text-center p-3 font-medium text-gray-500">Rating</th>
                <th className="text-left p-3 font-medium text-gray-500">Fecha</th>
                <th className="text-center p-3 font-medium text-gray-500">GPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((v: any) => (
                <tr key={v.id} onClick={() => setSelectedVisit(v)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                  <td className="p-3 font-medium">{v.customer_id?.slice(0, 8)}...</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${v.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : v.status === "missed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{RESULT_LABELS[v.result] || v.result || "-"}</td>
                  <td className="p-3 text-right font-medium">{Number(v.order_amount || 0).toLocaleString()}</td>
                  <td className="p-3 text-center">{v.customer_rating ? "⭐".repeat(v.customer_rating) : "-"}</td>
                  <td className="p-3 text-gray-500 text-xs">{v.actual_arrival ? new Date(v.actual_arrival).toLocaleDateString() : v.routeDate ? new Date(v.routeDate).toLocaleDateString() : "-"}</td>
                  <td className="p-3 text-center">{v.checkin_lat ? <MapPin className="w-4 h-4 text-blue-500 mx-auto" /> : <span className="text-gray-300">-</span>}</td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">No hay visitas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visit detail modal */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVisit(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Detalle de Visita</h2>
              <button onClick={() => setSelectedVisit(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Cliente:</span> <span className="font-medium">{selectedVisit.customer_id?.slice(0, 8)}...</span></div>
              <div><span className="text-gray-500">Estado:</span> <span className={`font-medium ${selectedVisit.status === "completed" ? "text-green-600" : selectedVisit.status === "missed" ? "text-red-600" : "text-yellow-600"}`}>{selectedVisit.status}</span></div>
              <div><span className="text-gray-500">Resultado:</span> <span>{RESULT_LABELS[selectedVisit.result] || selectedVisit.result || "-"}</span></div>
              <div><span className="text-gray-500">Rating:</span> <span>{selectedVisit.customer_rating ? "⭐".repeat(selectedVisit.customer_rating) : "-"}</span></div>
              {selectedVisit.actual_arrival && <div><span className="text-gray-500">Llegada:</span> <span>{new Date(selectedVisit.actual_arrival).toLocaleTimeString()}</span></div>}
              {selectedVisit.actual_departure && <div><span className="text-gray-500">Salida:</span> <span>{new Date(selectedVisit.actual_departure).toLocaleTimeString()}</span></div>}
              {selectedVisit.actual_arrival && selectedVisit.actual_departure && (
                <div className="col-span-2">
                  <span className="text-gray-500">Duración:</span>{" "}
                  <span>{Math.round((new Date(selectedVisit.actual_departure).getTime() - new Date(selectedVisit.actual_arrival).getTime()) / 60000)} min</span>
                </div>
              )}
            </div>
            {selectedVisit.order_amount > 0 && (
              <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3">
                <p className="text-sm font-bold text-green-700">💰 Pedido: Gs. {Number(selectedVisit.order_amount).toLocaleString()}</p>
                <p className="text-xs text-green-600">Productos: {selectedVisit.products_count || 0}</p>
              </div>
            )}
            {selectedVisit.payment_collected > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3">
                <p className="text-sm font-bold text-blue-700">💵 Cobrado: Gs. {Number(selectedVisit.payment_collected).toLocaleString()}</p>
              </div>
            )}
            {selectedVisit.notas && <p className="text-sm text-gray-600 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">{selectedVisit.notas}</p>}
            {selectedVisit.checkin_lat && selectedVisit.checkin_lng && (
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> GPS: {Number(selectedVisit.checkin_lat).toFixed(5)}, {Number(selectedVisit.checkin_lng).toFixed(5)}
                {selectedVisit.distance_from_customer_meters !== null && <span>({selectedVisit.distance_from_customer_meters}m del cliente)</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
