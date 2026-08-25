import { useState, useEffect, useCallback, useRef } from "react"
import { Truck, MapPin, Phone, CheckCircle, XCircle, Clock, Package, Navigation, AlertCircle, Camera, User, LogOut, Loader2, ChevronRight, ChevronLeft } from "lucide-react"
import { driverAppApi, type DriverDelivery, type DriverInfo } from "../../api/driverapp"

const statusLabel: Record<string, string> = {
  pending: "Pendiente", assigned: "Asignado", picked_up: "Retirado",
  in_transit: "En tránsito", delivered: "Entregado", failed: "Fallido", cancelled: "Cancelado",
}

const statusColor: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700", assigned: "bg-purple-100 text-purple-700",
  picked_up: "bg-amber-100 text-amber-700", in_transit: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700", failed: "bg-red-100 text-red-700",
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [telefono, setTelefono] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!telefono || !pin) { setError("Completá todos los campos"); return }
    setLoading(true)
    try {
      const res = await driverAppApi.login(telefono, pin)
      localStorage.setItem("driver_token", res.access_token)
      localStorage.setItem("driver_id", res.driver_id)
      onLogin()
    } catch {
      setError("Credenciales inválidas")
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-white">InteliEntregas</h1>
          <p className="text-blue-200 text-sm mt-1">App del repartidor</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Teléfono</label>
            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
              placeholder="0981 123 456"
              className="input-field w-full mt-1 text-lg" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">PIN</label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)}
              placeholder="••••" maxLength={6} inputMode="numeric"
              className="input-field w-full mt-1 text-lg text-center tracking-widest" />
          </div>
          {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  )
}

function HomeScreen({ driver, onLogout }: { driver: DriverInfo; onLogout: () => void }) {
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([])
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [showDetail, setShowDetail] = useState<DriverDelivery | null>(null)
  const [activeTab, setActiveTab] = useState<"pendientes" | "activos" | "completados">("activos")

  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    try {
      const all = await driverAppApi.deliveries.list()
      setDeliveries(all)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDeliveries() }, [fetchDeliveries])

  const pending = deliveries.filter(d => d.estado === "pending" || d.estado === "assigned")
  const active = deliveries.filter(d => d.estado === "picked_up" || d.estado === "in_transit")
  const completed = deliveries.filter(d => d.estado === "delivered" || d.estado === "failed" || d.estado === "cancelled")

  const visible = filter
    ? deliveries.filter(d => d.estado === filter)
    : activeTab === "pendientes" ? pending : activeTab === "activos" ? active : completed

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 max-w-lg mx-auto">
      <header className="bg-white dark:bg-slate-800 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold">
              {driver.nombre.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">{driver.nombre}</h2>
              <p className="text-xs text-gray-500">{driver.total_deliveries} entregas</p>
            </div>
          </div>
          <button onClick={onLogout} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-1 px-4 pb-3 overflow-x-auto">
          {["activos", "pendientes", "completados"].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab as any); setFilter("") }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"
              }`}>
              {tab === "activos" ? `Activos (${active.length})` : tab === "pendientes" ? `Pendientes (${pending.length})` : `Completados (${completed.length})`}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 space-y-3 pb-24">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No hay entregas</p>
          </div>
        ) : visible.map(d => (
          <button key={d.id} onClick={() => setShowDetail(d)}
            className="w-full text-left bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[d.estado] || ""}`}>
                    {statusLabel[d.estado] || d.estado}
                  </span>
                  {d.prioridad === "urgent" && <AlertCircle className="w-3 h-3 text-red-500" />}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{d.customer_nombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{d.direccion}{d.barrio ? `, ${d.barrio}` : ""}</span>
                </p>
                {d.tracking_code && <p className="text-xs font-mono text-gray-400 mt-0.5">{d.tracking_code}</p>}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 ml-2" />
            </div>
          </button>
        ))}
      </div>

      {showDetail && <DeliveryDetailModal delivery={showDetail} onClose={() => setShowDetail(null)} onUpdated={() => { setShowDetail(null); fetchDeliveries() }} />}
    </div>
  )
}

function DeliveryDetailModal({ delivery, onClose, onUpdated }: { delivery: DriverDelivery; onClose: () => void; onUpdated: () => void }) {
  const [estado, setEstado] = useState(delivery.estado)
  const [saving, setSaving] = useState(false)
  const [motivoFalla, setMotivoFalla] = useState("")
  const [proofTipo, setProofTipo] = useState("photo")
  const [proofNombre, setProofNombre] = useState("")
  const [proofObs, setProofObs] = useState("")
  const [error, setError] = useState("")
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [gpsAvailable, setGpsAvailable] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  useEffect(() => {
    setGpsAvailable("geolocation" in navigator)
  }, [])

  async function captureGPS() {
    setGpsLoading(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      )
      setLat(pos.coords.latitude)
      setLng(pos.coords.longitude)
      await driverAppApi.tracking.send({ delivery_id: delivery.id, latitud: pos.coords.latitude, longitud: pos.coords.longitude })
    } catch { setError("No se pudo obtener ubicación") }
    finally { setGpsLoading(false) }
  }

  async function handleUpdateStatus(newStatus: string) {
    setSaving(true)
    setError("")
    try {
      await driverAppApi.deliveries.updateStatus(delivery.id, {
        estado: newStatus,
        motivo_falla: newStatus === "failed" ? motivoFalla : undefined,
      })
      setEstado(newStatus)
      if (gpsAvailable && !lat) await captureGPS()
      onUpdated()
    } catch { setError("Error al actualizar") }
    finally { setSaving(false) }
  }

  async function handleUploadProof() {
    if (!proofNombre) { setError("Nombre de quien recibe es requerido"); return }
    setSaving(true)
    setError("")
    try {
      if (gpsAvailable && !lat) await captureGPS()
      await driverAppApi.deliveries.proofs.add(delivery.id, {
        tipo: proofTipo, nombre_recibio: proofNombre,
        observaciones: proofObs, latitud: lat, longitud: lng,
      })
      setProofNombre("")
      setProofObs("")
      onUpdated()
    } catch { setError("Error al subir comprobante") }
    finally { setSaving(false) }
  }

  const transitions: Record<string, string[]> = {
    assigned: ["picked_up"], picked_up: ["in_transit"],
    in_transit: ["delivered", "failed"],
  }

  const nextStatuses = transitions[estado] || []

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">{delivery.customer_nombre}</h3>
            <p className="text-xs text-gray-500 font-mono">{delivery.tracking_code}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <XCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2 text-sm">
            <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />{delivery.direccion}{delivery.barrio ? `, ${delivery.barrio}` : ""}</p>
            {delivery.customer_telefono && (
              <a href={`tel:${delivery.customer_telefono}`} className="flex items-center gap-2 text-blue-600 font-medium">
                <Phone className="w-4 h-4" />{delivery.customer_telefono}
              </a>
            )}
            {delivery.referencia && <p className="text-gray-500 text-xs">Ref: {delivery.referencia}</p>}
            {delivery.instrucciones_entrega && <p className="text-gray-500 text-xs">Instrucciones: {delivery.instrucciones_entrega}</p>}
            {delivery.observaciones && <p className="text-gray-500 text-xs">Obs: {delivery.observaciones}</p>}
          </div>

          <div className="flex gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor[estado] || ""}`}>
              {statusLabel[estado] || estado}
            </span>
          </div>

          {nextStatuses.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Actualizar estado</h4>
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map(s => (
                  <button key={s} onClick={() => handleUpdateStatus(s)} disabled={saving}
                    className={`px-4 py-2 rounded-xl font-semibold text-sm flex items-center gap-1.5 transition-all ${
                      s === "delivered" ? "bg-green-600 text-white hover:bg-green-700" :
                      s === "failed" ? "bg-red-600 text-white hover:bg-red-700" :
                      s === "picked_up" ? "bg-amber-600 text-white hover:bg-amber-700" :
                      "bg-blue-600 text-white hover:bg-blue-700"
                    }`}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                    {s === "delivered" ? "Entregado" : s === "failed" ? "Fallido" : s === "picked_up" ? "Recoger" : statusLabel[s]}
                  </button>
                ))}
              </div>
              {estado === "in_transit" && (
                <div className="mt-2">
                  <input type="text" value={motivoFalla} onChange={e => setMotivoFalla(e.target.value)}
                    placeholder="Motivo de falla (si aplica)"
                    className="input-field w-full text-sm" />
                </div>
              )}
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Comprobante de entrega</h4>
            <div className="space-y-2">
              <input type="text" value={proofNombre} onChange={e => setProofNombre(e.target.value)}
                placeholder="Nombre de quien recibe"
                className="input-field w-full text-sm" />
              <input type="text" value={proofObs} onChange={e => setProofObs(e.target.value)}
                placeholder="Observaciones"
                className="input-field w-full text-sm" />
              <button onClick={handleUploadProof} disabled={saving || !proofNombre}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                Registrar entrega
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Ubicación</h4>
            <div className="flex gap-2">
              <button onClick={captureGPS} disabled={gpsLoading}
                className="flex-1 bg-gray-100 dark:bg-gray-700 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                {lat ? `${lat.toFixed(4)}, ${lng?.toFixed(4)}` : "Enviar ubicación"}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
        </div>
      </div>
    </div>
  )
}

export default function DriverAppPage() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("driver_token"))
  const [driver, setDriver] = useState<DriverInfo | null>(null)

  useEffect(() => {
    if (loggedIn) {
      driverAppApi.me().then(setDriver).catch(() => {
        localStorage.removeItem("driver_token")
        setLoggedIn(false)
      })
    }
  }, [loggedIn])

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />
  if (!driver) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
    </div>
  )

  return <HomeScreen driver={driver} onLogout={() => {
    localStorage.removeItem("driver_token")
    localStorage.removeItem("driver_id")
    setLoggedIn(false)
  }} />
}
