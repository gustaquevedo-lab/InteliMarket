import { useState, useEffect } from "react"
import { Truck, Route, Plus, Search, Loader2, X, MapPin, User, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { api, type Delivery, type Route as RouteType, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"

export default function LogisticsPage() {
  const [activeTab, setActiveTab] = useState<"deliveries" | "routes">("deliveries")
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [routes, setRoutes] = useState<RouteType[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [deliveryForm, setDeliveryForm] = useState({ customer_id: "", direccion_entrega: "", driver_name: "", vehicle_plate: "", fecha_programada: "", observaciones: "" })
  const [routeForm, setRouteForm] = useState({ nombre: "", driver_name: "", vehicle_plate: "", fecha: "" })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [deliveriesData, routesData, customersData] = await Promise.allSettled([
        api.logistics.deliveries.list(),
        api.logistics.routes.list(),
        api.customers.list({ activo: true }),
      ])
      if (deliveriesData.status === "fulfilled") setDeliveries(deliveriesData.value)
      if (routesData.status === "fulfilled") setRoutes(routesData.value)
      if (customersData.status === "fulfilled") setCustomers(customersData.value)
    } catch {
      toast.info("Datos demo", "Conectá el backend para ver logística")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filteredDeliveries = deliveries.filter(d => {
    const customer = customers.find(c => c.id === d.customer_id)
    return !search || (customer?.razon_social?.toLowerCase().includes(search.toLowerCase()) ?? false) || (d.driver_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  })

  const filteredRoutes = routes.filter(r =>
    !search ||
    (r.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.driver_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  const handleCreateDelivery = async () => {
    if (!deliveryForm.customer_id || !deliveryForm.direccion_entrega) {
      toast.error("Error", "Seleccioná un cliente y dirección")
      return
    }
    setSubmitting(true)
    try {
      await api.logistics.deliveries.create(deliveryForm)
      toast.success("Creada", "Entrega creada correctamente")
      setShowDeliveryModal(false)
      setDeliveryForm({ customer_id: "", direccion_entrega: "", driver_name: "", vehicle_plate: "", fecha_programada: "", observaciones: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear la entrega")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateRoute = async () => {
    if (!routeForm.nombre || !routeForm.fecha) {
      toast.error("Error", "Completá nombre y fecha")
      return
    }
    setSubmitting(true)
    try {
      await api.logistics.routes.create(routeForm)
      toast.success("Creada", "Ruta creada correctamente")
      setShowRouteModal(false)
      setRouteForm({ nombre: "", driver_name: "", vehicle_plate: "", fecha: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear la ruta")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Logística
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Entregas, rutas y seguimiento</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRouteModal(true)} className="btn-outline flex items-center gap-2">
            <Route className="w-4 h-4" />
            Nueva ruta
          </button>
          <button onClick={() => setShowDeliveryModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nueva entrega
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pendientes</span></div>
          <p className="text-2xl font-bold text-amber-500">{deliveries.filter(d => d.estado === "pending").length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Truck className="w-5 h-5 text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">En tránsito</span></div>
          <p className="text-2xl font-bold text-blue-500">{deliveries.filter(d => d.estado === "in_transit").length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Entregadas</span></div>
          <p className="text-2xl font-bold text-green-500">{deliveries.filter(d => d.estado === "delivered").length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Route className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rutas activas</span></div>
          <p className="text-2xl font-bold text-primary">{routes.filter(r => r.estado === "active").length}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("deliveries")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "deliveries" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Entregas</button>
        <button onClick={() => setActiveTab("routes")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "routes" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Rutas</button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder={activeTab === "deliveries" ? "Buscar por cliente o chofer..." : "Buscar por nombre o chofer..."} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={fetchData} className="btn-outline">Actualizar</button>
      </div>

      {activeTab === "deliveries" ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Cliente</th>
                <th className="table-cell">Dirección</th>
                <th className="table-cell">Chofer</th>
                <th className="table-cell">Fecha</th>
                <th className="table-cell">Estado</th>
                <th className="table-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay entregas</td></tr>
              ) : (
                filteredDeliveries.map((d) => {
                  const customer = customers.find(c => c.id === d.customer_id)
                  return (
                    <tr key={d.id} className="table-row">
                      <td className="table-td">
                        <p className="text-sm font-medium">{customer?.razon_social || "—"}</p>
                        <p className="text-xs text-gray-400">{customer?.ruc || ""}</p>
                      </td>
                      <td className="table-td text-sm">
                        <div className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3 h-3" />
                          {d.direccion_entrega}
                        </div>
                      </td>
                      <td className="table-td">
                        {d.driver_name ? (
                          <div className="flex items-center gap-1 text-sm">
                            <User className="w-3 h-3" />
                            {d.driver_name}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="table-td text-sm text-gray-500">
                        {d.fecha_programada ? new Date(d.fecha_programada).toLocaleDateString("es-PY") : "—"}
                      </td>
                      <td className="table-td">
                        <StatusBadge status={d.estado || "-"} map={{
                          pending: "badge-warning",
                          in_transit: "badge-info",
                          delivered: "badge-success",
                          cancelled: "badge-danger",
                          returned: "badge-danger",
                        }} />
                      </td>
                      <td className="table-td">
                        <button className="btn-ghost" title="Ver detalle" onClick={() => toast.info("Detalle", `Entrega ${d.id.slice(0, 8)}`)}>
                          <AlertCircle className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Nombre</th>
                <th className="table-cell">Chofer</th>
                <th className="table-cell">Fecha</th>
                <th className="table-cell">Entregas</th>
                <th className="table-cell">Estado</th>
                <th className="table-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredRoutes.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay rutas</td></tr>
              ) : (
                filteredRoutes.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-td font-medium">{r.nombre}</td>
                    <td className="table-td">
                      {r.driver_name ? (
                        <div className="flex items-center gap-1 text-sm">
                          <User className="w-3 h-3" />
                          {r.driver_name}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="table-td text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {r.fecha ? new Date(r.fecha).toLocaleDateString("es-PY") : "-"}
                      </div>
                    </td>
                    <td className="table-td text-sm">
                      <span className="font-mono">{r.completed_deliveries || 0}/{r.total_deliveries || 0}</span>
                    </td>
                    <td className="table-td">
                      <StatusBadge status={r.estado || "-"} map={{
                        pending: "badge-warning",
                        active: "badge-info",
                        completed: "badge-success",
                      }} />
                    </td>
                    <td className="table-td">
                      <button className="btn-ghost" title="Ver paradas" onClick={() => toast.info("Ruta", `${r.nombre || "-"} - ${r.total_deliveries || 0} entregas`)}>
                        <Route className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delivery Modal */}
      {showDeliveryModal && (
        <div className="modal-overlay" onClick={() => setShowDeliveryModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva entrega</h3>
              <button onClick={() => setShowDeliveryModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="input-label label-required">Cliente</label>
                <select className="input-field" value={deliveryForm.customer_id} onChange={(e) => setDeliveryForm({ ...deliveryForm, customer_id: e.target.value })}>
                  <option value="">Seleccionar cliente...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label label-required">Dirección de entrega</label>
                <input className="input-field" placeholder="Av. España 1234, Asunción" value={deliveryForm.direccion_entrega} onChange={(e) => setDeliveryForm({ ...deliveryForm, direccion_entrega: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Chofer</label>
                  <input className="input-field" placeholder="Juan Pérez" value={deliveryForm.driver_name} onChange={(e) => setDeliveryForm({ ...deliveryForm, driver_name: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Vehículo</label>
                  <input className="input-field" placeholder="ABC-123" value={deliveryForm.vehicle_plate} onChange={(e) => setDeliveryForm({ ...deliveryForm, vehicle_plate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="input-label">Fecha programada</label>
                <input className="input-field" type="datetime-local" value={deliveryForm.fecha_programada} onChange={(e) => setDeliveryForm({ ...deliveryForm, fecha_programada: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Observaciones</label>
                <input className="input-field" placeholder="Instrucciones especiales..." value={deliveryForm.observaciones} onChange={(e) => setDeliveryForm({ ...deliveryForm, observaciones: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowDeliveryModal(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleCreateDelivery} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Modal */}
      {showRouteModal && (
        <div className="modal-overlay" onClick={() => setShowRouteModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva ruta</h3>
              <button onClick={() => setShowRouteModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="input-label label-required">Nombre</label>
                <input className="input-field" placeholder="Ruta Norte - Lunes" value={routeForm.nombre} onChange={(e) => setRouteForm({ ...routeForm, nombre: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Chofer</label>
                  <input className="input-field" placeholder="Juan Pérez" value={routeForm.driver_name} onChange={(e) => setRouteForm({ ...routeForm, driver_name: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Vehículo</label>
                  <input className="input-field" placeholder="ABC-123" value={routeForm.vehicle_plate} onChange={(e) => setRouteForm({ ...routeForm, vehicle_plate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="input-label label-required">Fecha</label>
                <input className="input-field" type="date" value={routeForm.fecha} onChange={(e) => setRouteForm({ ...routeForm, fecha: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowRouteModal(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleCreateRoute} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
