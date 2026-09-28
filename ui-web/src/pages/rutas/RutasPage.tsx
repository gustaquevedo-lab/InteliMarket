import { useState, useEffect, useMemo } from "react"
import {
  Map, Plus, Play, Square, Users, Calendar, Clock, MoreHorizontal,
  ListOrdered, CheckCircle2, AlertCircle, XCircle, DollarSign,
  TrendingUp, MapPin, Search, Filter, ShieldCheck, Sparkles, User as UserIcon
} from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { useEntityLookup, getCustomerName } from "../../hooks/useEntityLookup"

const formatPYG = (n?: number | string) => {
  if (n == null) return "Gs 0"
  return "Gs " + Number(n).toLocaleString("es-PY")
}

export default function RutasPage() {
  useEntityLookup()
  const { user } = useAuth()
  const companyId = user?.tenant_id || (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"
  const toast = useToast()

  const [instances, setInstances] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [customersMap, setCustomersMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterSeller, setFilterSeller] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterDate, setFilterDate] = useState<string>("")

  // Form & Selection
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    route_id: "",
    seller_id: "",
    fecha: new Date().toISOString().split("T")[0],
    notas: "",
  })
  const [selected, setSelected] = useState<any>(null)
  const [stops, setStops] = useState<any[]>([])
  const [loadingStops, setLoadingStops] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, r, i, c] = await Promise.all([
        api.distribuidora.tracking.sellers.list(companyId).catch(() => []),
        api.distribuidora.routes.list(companyId).catch(() => []),
        api.distribuidora.tracking.routeInstances.list(companyId).catch(() => []),
        api.customers.list({ limit: 1000 }).catch(() => []),
      ])
      setSellers(s || [])
      setRoutes(r || [])
      setInstances(i || [])

      const cList = Array.isArray(c) ? c : (c as any)?.data || []
      const cMap: Record<string, any> = {}
      cList.forEach((cust: any) => {
        if (cust.id) cMap[cust.id] = cust
      })
      setCustomersMap(cMap)
    } catch (e: any) {
      toast.error("Error al cargar datos", e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const loadStops = async (instanceId: string) => {
    setLoadingStops(true)
    try {
      const s = await api.distribuidora.tracking.routeInstances.stops.list(instanceId)
      setStops(s || [])
    } catch {
      setStops([])
    } finally {
      setLoadingStops(false)
    }
  }

  const selectInstance = async (inst: any) => {
    setSelected(inst)
    if (inst) await loadStops(inst.id)
  }

  const createInstance = async () => {
    if (!form.route_id) {
      toast.error("Ruta requerida", "Seleccioná una ruta para iniciar la ejecución.")
      return
    }
    if (!form.seller_id) {
      toast.error("Preventista requerido", "Asigná un vendedor/preventista a la ruta.")
      return
    }
    try {
      await api.distribuidora.tracking.routeInstances.create(companyId, form)
      toast.success("Ejecución de Ruta Creada", "Se planificó el recorrido para el vendedor.")
      setShowForm(false)
      setForm({ route_id: "", seller_id: "", fecha: new Date().toISOString().split("T")[0], notas: "" })
      await loadAll()
    } catch (e: any) {
      toast.error("Error al crear ejecución", e.message || String(e))
    }
  }

  const startInstance = async (id: string) => {
    try {
      await api.distribuidora.tracking.routeInstances.start(id)
      toast.success("Ruta Iniciada", "El preventista está en tránsito.")
      await loadAll()
      if (selected?.id === id) {
        setSelected((prev: any) => ({ ...prev, status: "in_progress", started_at: new Date().toISOString() }))
      }
    } catch (e: any) {
      toast.error("Error", e.message || String(e))
    }
  }

  const endInstance = async (id: string) => {
    try {
      await api.distribuidora.tracking.routeInstances.end(id)
      toast.success("Ruta Finalizada", "Se cerró la jornada de visitas.")
      await loadAll()
      if (selected?.id === id) {
        setSelected((prev: any) => ({ ...prev, status: "completed", ended_at: new Date().toISOString() }))
      }
    } catch (e: any) {
      toast.error("Error", e.message || String(e))
    }
  }

  const getSellerName = (id: string) => {
    const s = sellers.find(x => x.user_id === id || x.seller_id === id)
    return s?.user_nombre || s?.nombre || id.slice(0, 8)
  }

  const getRouteName = (id: string) => {
    const r = routes.find(x => x.id === id)
    return r?.nombre ? `${r.nombre} (${r.codigo || "S/C"})` : id.slice(0, 8)
  }

  // Filtrado reactivo de instancias
  const filteredInstances = useMemo(() => {
    return instances.filter(inst => {
      if (filterSeller !== "all" && inst.seller_id !== filterSeller) return false
      if (filterStatus !== "all" && inst.status !== filterStatus) return false
      if (filterDate && !inst.fecha.startsWith(filterDate)) return false
      return true
    })
  }, [instances, filterSeller, filterStatus, filterDate])

  // Métricas de la ruta seleccionada
  const selectedStats = useMemo(() => {
    if (!stops || stops.length === 0) return { total: 0, completed: 0, pct: 0, totalOrders: 0 }
    const total = stops.length
    const completed = stops.filter(s => s.status === "completed").length
    const pct = Math.round((completed / total) * 100)
    const totalOrders = stops.reduce((sum, s) => sum + (Number(s.order_amount) || 0), 0)
    return { total, completed, pct, totalOrders }
  }, [stops])

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
            Planificador & Monitoreo de Rutas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Supervisión en vivo de recorridos de preventistas, visitas completadas y pedidos tomados.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Ejecución</span>
        </button>
      </div>

      {/* Modal Nueva Ejecución */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nueva Ejecución de Ruta</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Ruta Maestra *</label>
                <select
                  value={form.route_id}
                  onChange={e => setForm({ ...form, route_id: e.target.value })}
                  className="input-field text-xs font-medium"
                >
                  <option value="">-- Seleccionar ruta --</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} ({r.codigo || "S/C"}) {r.zona ? `- ${r.zona}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Preventista Asignado *</label>
                <select
                  value={form.seller_id}
                  onChange={e => setForm({ ...form, seller_id: e.target.value })}
                  className="input-field text-xs font-medium"
                >
                  <option value="">-- Seleccionar vendedor/preventista --</option>
                  {sellers.map(s => (
                    <option key={s.user_id || s.seller_id} value={s.user_id || s.seller_id}>
                      {s.user_nombre || s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Fecha del Recorrido *</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm({ ...form, fecha: e.target.value })}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Notas de Despacho (Opcional)</label>
                <textarea
                  placeholder="Instrucciones especiales para el preventista..."
                  value={form.notas}
                  onChange={e => setForm({ ...form, notas: e.target.value })}
                  className="input-field text-xs"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={createInstance}
                className="btn-primary px-4 py-2 rounded-xl text-xs font-bold"
              >
                Crear Ejecución
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-500 font-bold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros:</span>
          </div>
          <select
            value={filterSeller}
            onChange={e => setFilterSeller(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-xs"
          >
            <option value="all">Todos los Preventistas ({sellers.length})</option>
            {sellers.map(s => (
              <option key={s.user_id || s.seller_id} value={s.user_id || s.seller_id}>
                {s.user_nombre || s.nombre}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-xs"
          >
            <option value="all">Todos los Estados</option>
            <option value="planned">Planificada</option>
            <option value="in_progress">En Progreso</option>
            <option value="completed">Completada</option>
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-xs"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              className="text-xs text-blue-600 hover:underline"
            >
              Limpiar fecha
            </button>
          )}
        </div>

        <div className="text-slate-500 font-medium text-[11px]">
          Mostrando <span className="font-bold text-slate-800 dark:text-slate-200">{filteredInstances.length}</span> de {instances.length} recorridos
        </div>
      </div>

      {/* Grid Principal: Listado a la izquierda, Detalle a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Listado de Ejecuciones */}
        <div className="lg:col-span-1 space-y-2.5">
          {loading ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
              <span>Cargando recorridos...</span>
            </div>
          ) : filteredInstances.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              No hay recorridos que coincidan con los filtros seleccionados.
            </div>
          ) : (
            filteredInstances.map((inst) => {
              const isSelected = selected?.id === inst.id
              return (
                <div
                  key={inst.id}
                  onClick={() => selectInstance(inst)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700 shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {getRouteName(inst.route_id)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        inst.status === "in_progress"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-500/20"
                          : inst.status === "completed"
                          ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-500/20"
                      }`}
                    >
                      {inst.status === "in_progress" ? "En Ruta" : inst.status === "completed" ? "Finalizada" : "Planificada"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Preventista:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{getSellerName(inst.seller_id)}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(inst.fecha + "T00:00:00").toLocaleDateString("es-PY")}
                    </span>
                    {inst.started_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-500" />
                        {new Date(inst.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Columna Derecha: Detalle de Paradas y Avance */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="text-center py-24 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Map className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-semibold">Seleccioná una ejecución de ruta para monitorear sus paradas</p>
              <p className="text-xs text-slate-500 mt-1">Podrás ver tiempos de atención, coordenadas y pedidos registrados por el vendedor.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-5">
              {/* Header Detalle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{getRouteName(selected.route_id)}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        selected.status === "in_progress"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : selected.status === "completed"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {selected.status === "in_progress" ? "En Ruta" : selected.status === "completed" ? "Finalizada" : "Planificada"}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Preventista: <span className="font-bold text-slate-800 dark:text-slate-200">{getSellerName(selected.seller_id)}</span> — Fecha: {new Date(selected.fecha + "T00:00:00").toLocaleDateString("es-PY")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selected.status === "planned" && (
                    <button
                      onClick={() => startInstance(selected.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Iniciar Recorrido</span>
                    </button>
                  )}
                  {selected.status === "in_progress" && (
                    <button
                      onClick={() => endInstance(selected.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Finalizar Recorrido</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tarjetas KPI de Avance de la Ruta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <span className="text-slate-500 block mb-1">Avance de Visitas</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                      {selectedStats.completed} / {selectedStats.total}
                    </span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      ({selectedStats.pct}%)
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-500"
                      style={{ width: `${selectedStats.pct}%` }}
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs">
                  <span className="text-emerald-700 dark:text-emerald-400 block mb-1">Ventas Generadas (Preventa)</span>
                  <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
                    {formatPYG(selectedStats.totalOrders)}
                  </span>
                  <p className="text-[10px] text-emerald-600/80 mt-1">Total de pedidos captados en la jornada</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <span className="text-slate-500 block mb-1">Horarios Registrados</span>
                  <div className="space-y-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    <div>Inicio: {selected.started_at ? new Date(selected.started_at).toLocaleTimeString() : "Pendiente"}</div>
                    <div>Cierre: {selected.ended_at ? new Date(selected.ended_at).toLocaleTimeString() : (selected.status === "in_progress" ? "En curso" : "-")}</div>
                  </div>
                </div>
              </div>

              {/* Timeline de Paradas con Nombres Reales de Clientes */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ListOrdered className="w-4 h-4 text-blue-500" />
                  <span>Secuencia de Paradas ({stops.length})</span>
                </h3>

                {loadingStops ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <Clock className="w-5 h-5 animate-spin mx-auto mb-1.5 opacity-50" />
                    <span>Cargando paradas de la ruta...</span>
                  </div>
                ) : stops.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center">
                    Esta ejecución de ruta no tiene paradas asignadas aún.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stops.map((stop, idx) => {
                      const cust = customersMap[stop.customer_id]
                      const custName = cust?.razon_social || cust?.nombre || getCustomerName(stop.customer_id)
                      const isCompleted = stop.status === "completed"
                      const isMissed = stop.status === "missed"

                      // Cálculo de tiempo de visita en minutos si hay llegada y salida
                      let durationMinutes: number | null = null
                      if (stop.actual_arrival && stop.actual_departure) {
                        const arr = new Date(stop.actual_arrival).getTime()
                        const dep = new Date(stop.actual_departure).getTime()
                        if (dep >= arr) {
                          durationMinutes = Math.round((dep - arr) / 60000)
                        }
                      }

                      return (
                        <div key={stop.id} className="flex gap-3">
                          {/* Columna con número e indicador vertical */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                isCompleted
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/30"
                                  : isMissed
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {idx + 1}
                            </div>
                            {idx < stops.length - 1 && (
                              <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-800 my-1" />
                            )}
                          </div>

                          {/* Tarjeta de parada */}
                          <div className="flex-1 pb-4">
                            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                                      {custName}
                                    </span>
                                    {cust?.ruc && (
                                      <span className="font-mono text-[10px] text-slate-400">
                                        RUC: {cust.ruc}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{cust?.direccion || "Sin dirección registrada"}</span>
                                  </p>
                                </div>

                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider self-start sm:self-auto ${
                                    isCompleted
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                      : isMissed
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                  }`}
                                >
                                  {isCompleted ? "Visitado" : isMissed ? "No visitado" : "Pendiente"}
                                </span>
                              </div>

                              {/* Horarios y duración */}
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                {stop.actual_arrival && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    Llegada: {new Date(stop.actual_arrival).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                                {stop.actual_departure && (
                                  <span className="flex items-center gap-1">
                                    Salida: {new Date(stop.actual_departure).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                                {durationMinutes != null && (
                                  <span className="font-bold text-blue-600 dark:text-blue-400">
                                    ({durationMinutes} min de atención)
                                  </span>
                                )}
                              </div>

                              {stop.result && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">
                                  Nota: {stop.result}
                                </p>
                              )}

                              {stop.order_amount > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                                  <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                                    <DollarSign className="w-3.5 h-3.5" /> Pedido Tomado:
                                  </span>
                                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                    {formatPYG(stop.order_amount)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
