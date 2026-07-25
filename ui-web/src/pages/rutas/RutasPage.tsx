import { useState, useEffect } from "react"
import { Map, Plus, Play, Square, Users, Calendar, Clock, MoreHorizontal, ListOrdered } from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"

export default function RutasPage() {
  const { user } = useAuth()
  const companyId = user?.company_id || "00000000-0000-0000-0000-000000000010"
  const [instances, setInstances] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ route_id: "", seller_id: "", fecha: new Date().toISOString().split("T")[0], notas: "" })
  const [selected, setSelected] = useState<any>(null)
  const [stops, setStops] = useState<any[]>([])

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, r, i] = await Promise.all([
        api.distribuidora.tracking.sellers.list(companyId).catch(() => []),
        api.distribuidora.routes.list(companyId).catch(() => []),
        api.distribuidora.tracking.routeInstances.list(companyId).catch(() => []),
      ])
      setSellers(s || [])
      setRoutes(r || [])
      setInstances(i || [])
    } catch {}
    setLoading(false)
  }

  const loadStops = async (instanceId: string) => {
    try {
      const stops = await api.distribuidora.tracking.routeInstances.stops.list(instanceId)
      setStops(stops || [])
    } catch { setStops([]) }
  }

  const selectInstance = async (inst: any) => {
    setSelected(inst)
    if (inst) await loadStops(inst.id)
  }

  const createInstance = async () => {
    try {
      await api.distribuidora.tracking.routeInstances.create(companyId, form)
      setShowForm(false)
      setForm({ route_id: "", seller_id: "", fecha: new Date().toISOString().split("T")[0], notas: "" })
      await loadAll()
    } catch {}
  }

  const startInstance = async (id: string) => {
    await api.distribuidora.tracking.routeInstances.start(id)
    await loadAll()
  }

  const endInstance = async (id: string) => {
    await api.distribuidora.tracking.routeInstances.end(id)
    await loadAll()
  }

  const getSellerName = (id: string) => sellers.find(s => s.user_id === id)?.user_nombre || sellers.find(s => s.seller_id === id)?.user_nombre || id.slice(0, 8)
  const getRouteName = (id: string) => routes.find(r => r.id === id)?.nombre || id.slice(0, 8)
  const TOTAL_STOPS = (s: string) => stops.length

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rutas de Venta</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{instances.length} ejecuciones de ruta</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nueva Ejecución
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Nueva Ejecución de Ruta</h2>
            <select value={form.route_id} onChange={e => setForm({ ...form, route_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="">Seleccionar ruta...</option>
              {routes.map(r => <option key={r.id} value={r.id}>{r.nombre} ({r.codigo || "sin código"})</option>)}
            </select>
            <select value={form.seller_id} onChange={e => setForm({ ...form, seller_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <option value="">Seleccionar vendedor...</option>
              {sellers.map(s => <option key={s.user_id} value={s.user_id}>{s.user_nombre}</option>)}
            </select>
            <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            <textarea placeholder="Notas (opcional)" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" />
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">Cancelar</button>
              <button onClick={createInstance} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Crear</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Cargando...</div>
          ) : instances.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No hay ejecuciones de ruta</div>
          ) : instances.map((inst) => (
            <div key={inst.id} onClick={() => selectInstance(inst)}
              className={`p-3 rounded-xl border cursor-pointer transition-colors ${selected?.id === inst.id ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-sm"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold">{getRouteName(inst.route_id)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${inst.status === "in_progress" ? "bg-green-100 text-green-700" : inst.status === "completed" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"}`}>
                  {inst.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">{getSellerName(inst.seller_id)}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                <Calendar className="w-3 h-3" /> {new Date(inst.fecha).toLocaleDateString()}
                {inst.started_at && <><Clock className="w-3 h-3" /> {new Date(inst.started_at).toLocaleTimeString()}</>}
              </div>
            </div>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="text-center py-20 text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <Map className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Seleccioná una ejecución de ruta para ver sus paradas</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{getRouteName(selected.route_id)}</h2>
                  <p className="text-sm text-gray-500">{getSellerName(selected.seller_id)} — {new Date(selected.fecha).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  {selected.status === "planned" && (
                    <button onClick={() => startInstance(selected.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">
                      <Play className="w-3 h-3" /> Iniciar
                    </button>
                  )}
                  {selected.status === "in_progress" && (
                    <button onClick={() => endInstance(selected.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-600 text-white text-sm hover:bg-gray-700">
                      <Square className="w-3 h-3" /> Finalizar
                    </button>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2"><ListOrdered className="w-4 h-4" /> Paradas ({stops.length})</h3>
                {stops.length === 0 ? (
                  <p className="text-sm text-gray-400">Esta ruta no tiene paradas asignadas aún.</p>
                ) : stops.map((stop, idx) => (
                  <div key={stop.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${stop.status === "completed" ? "bg-green-100 text-green-700" : stop.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                        {idx + 1}
                      </div>
                      {idx < stops.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 my-1" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Cliente: {stop.customer_id.slice(0, 8)}...</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${stop.status === "completed" ? "bg-green-100 text-green-700" : stop.status === "missed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {stop.status}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500 mt-1">
                        {stop.actual_arrival && <span>🕐 Llegada: {new Date(stop.actual_arrival).toLocaleTimeString()}</span>}
                        {stop.actual_departure && <span>🚶 Salida: {new Date(stop.actual_departure).toLocaleTimeString()}</span>}
                      </div>
                      {stop.result && <p className="text-xs text-gray-500 mt-1">Resultado: {stop.result}</p>}
                      {stop.order_amount > 0 && <p className="text-xs font-medium text-green-600 mt-1">💰 Pedido: Gs. {Number(stop.order_amount).toLocaleString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
