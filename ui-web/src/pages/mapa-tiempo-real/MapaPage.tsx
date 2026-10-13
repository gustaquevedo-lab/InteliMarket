import { useState, useEffect, useCallback, useRef } from "react"
import { GoogleMap, useJsApiLoader, Polyline, Marker, InfoWindow } from "@react-google-maps/api"
import { api, MapRouteData, MapCustomerData } from "../../api"
import { useAuth } from "../../context/AuthContext"
import {
  MapPin, Navigation, Users, RefreshCw, Eye, EyeOff,
  BatteryFull, BatteryMedium, BatteryWarning, AlertTriangle,
} from "lucide-react"

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined
const POLL_INTERVAL_MS = 15_000

const DEPOT = { lat: -25.3235, lng: -57.5641 }
const MAP_CENTER = { lat: -25.29, lng: -57.57 }

const ROUTE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#0ea5e9",
]

const VISIT_STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e",
  in_progress: "#3b82f6",
  pending: "#94a3b8",
  missed: "#ef4444",
  cancelled: "#6b7280",
  rescheduled: "#f97316",
}

const SELLER_STATUS_COLORS: Record<string, string> = {
  online: "#22c55e",
  busy: "#f59e0b",
  idle: "#6b7280",
  offline: "#9ca3af",
}

function visitStatusIcon(status: string): string {
  const colors: Record<string, string> = VISIT_STATUS_COLORS
  const c = colors[status] ?? "#94a3b8"
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="11" fill="${c}" stroke="white" stroke-width="2.5"/>
    </svg>`
  )}`
}

function depotIcon(): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <polygon points="18,2 34,34 2,34" fill="#1e293b" stroke="white" stroke-width="2"/>
    </svg>`
  )}`
}

export default function MapaPage() {
  const { user } = useAuth()
  const companyId = (user as any)?.company_id ?? "00000000-0000-0000-0000-000000000010"

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GMAPS_KEY ?? "",
    id: "google-map-script",
  })

  const [routes, setRoutes] = useState<MapRouteData[]>([])
  const [customers, setCustomers] = useState<MapCustomerData[]>([])
  const [liveData, setLiveData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState("")

  const [layerRoutes, setLayerRoutes] = useState(true)
  const [layerCustomers, setLayerCustomers] = useState(true)
  const [layerSellers, setLayerSellers] = useState(true)

  const [selectedRoute, setSelectedRoute] = useState<MapRouteData | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<MapCustomerData | null>(null)
  const [selectedSeller, setSelectedSeller] = useState<any | null>(null)

  const mapRef = useRef<google.maps.Map | null>(null)

  const loadStaticLayers = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        api.distribuidora.tracking.map.routes(companyId),
        api.distribuidora.tracking.map.customers(companyId),
      ])
      setRoutes(r)
      setCustomers(c)
    } catch (e) {
      console.error("map layers error", e)
    }
  }, [companyId])

  const loadLive = useCallback(async () => {
    try {
      const d = await api.distribuidora.tracking.liveMap(companyId)
      setLiveData(d)
      setLastUpdate(new Date().toLocaleTimeString())
    } catch {}
    setLoading(false)
  }, [companyId])

  useEffect(() => {
    loadStaticLayers()
    loadLive()
    const iv = setInterval(loadLive, POLL_INTERVAL_MS)
    return () => clearInterval(iv)
  }, [loadStaticLayers, loadLive])

  if (!GMAPS_KEY) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <AlertTriangle className="w-12 h-12 text-yellow-500" />
        <h2 className="text-xl font-semibold">Clave de Google Maps no configurada</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Agrega <code className="bg-gray-100 px-1 rounded">VITE_GOOGLE_MAPS_KEY=&lt;tu_clave&gt;</code> en{" "}
          <code className="bg-gray-100 px-1 rounded">ui-web/.env.local</code> y reinicia el servidor.
        </p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <p className="text-sm text-red-600">Error al cargar Google Maps: {loadError.message}</p>
      </div>
    )
  }

  const sellers = (liveData?.sellers ?? [])

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b flex-wrap">
        <h1 className="text-base font-semibold mr-2">Mapa en tiempo real</h1>

        {/* Layer toggles */}
        <LayerToggle active={layerRoutes} onClick={() => setLayerRoutes(v => !v)} icon={<Navigation className="w-4 h-4" />} label="Rutas" />
        <LayerToggle active={layerCustomers} onClick={() => setLayerCustomers(v => !v)} icon={<MapPin className="w-4 h-4" />} label="Clientes" />
        <LayerToggle active={layerSellers} onClick={() => setLayerSellers(v => !v)} icon={<Users className="w-4 h-4" />} label="Vendedores" />

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          {lastUpdate && <span>{lastUpdate}</span>}
          <button onClick={() => { loadStaticLayers(); loadLive() }} className="p-1 hover:bg-gray-100 rounded" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={MAP_CENTER}
            zoom={13}
            options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
            onLoad={m => { mapRef.current = m }}
          >
            {/* LAYER 1: Routes */}
            {layerRoutes && routes.map(route => {
              const validWps = route.waypoints.filter(w => w.lat != null && w.lng != null)
              const allPoints = [
                { lat: DEPOT.lat, lng: DEPOT.lng },
                ...validWps.map(w => ({ lat: w.lat!, lng: w.lng! })),
                { lat: DEPOT.lat, lng: DEPOT.lng },
              ]
              const color = ROUTE_COLORS[route.color_index] ?? "#3b82f6"
              return (
                <span key={route.route_id}>
                  <Polyline
                    path={allPoints}
                    options={{ strokeColor: color, strokeWeight: 3, strokeOpacity: 0.8, geodesic: true }}
                  />
                  {/* Waypoint stop markers */}
                  {validWps.map((wp, i) => (
                    <Marker
                      key={`wp-${route.route_id}-${i}`}
                      position={{ lat: wp.lat!, lng: wp.lng! }}
                      icon={{ url: visitStatusIcon(wp.visit_status), scaledSize: new google.maps.Size(22, 22), anchor: new google.maps.Point(11, 11) }}
                      label={{ text: String(wp.orden_visita + 1), color: "white", fontSize: "9px", fontWeight: "bold" }}
                      onClick={() => setSelectedRoute(route)}
                    />
                  ))}
                </span>
              )
            })}

            {/* Depot marker */}
            {layerRoutes && (
              <Marker
                position={DEPOT}
                icon={{ url: depotIcon(), scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 16) }}
                title="Depósito Gonzalito"
              />
            )}

            {/* LAYER 2: Customers */}
            {layerCustomers && customers.map(c => (
              <Marker
                key={c.customer_id}
                position={{ lat: c.lat, lng: c.lng }}
                icon={{ url: visitStatusIcon(c.visit_status), scaledSize: new google.maps.Size(18, 18), anchor: new google.maps.Point(9, 9) }}
                onClick={() => setSelectedCustomer(c)}
              />
            ))}

            {/* LAYER 3: Live sellers */}
            {layerSellers && sellers.map((s: any) => {
              if (!s.lat || !s.lng) return null
              const color = SELLER_STATUS_COLORS[s.status] ?? "#9ca3af"
              const svgIcon = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="18" fill="${color}" stroke="white" stroke-width="3" opacity="0.9"/>
                  <text x="22" y="27" text-anchor="middle" fill="white" font-size="18" font-weight="bold">${(s.nombre ?? "?").charAt(0).toUpperCase()}</text>
                </svg>`
              )}`
              return (
                <Marker
                  key={s.seller_id}
                  position={{ lat: Number(s.lat), lng: Number(s.lng) }}
                  icon={{ url: svgIcon, scaledSize: new google.maps.Size(40, 40), anchor: new google.maps.Point(20, 20) }}
                  onClick={() => setSelectedSeller(s)}
                />
              )
            })}

            {/* InfoWindow: selected route */}
            {selectedRoute && (
              <InfoWindow
                position={{ lat: DEPOT.lat, lng: DEPOT.lng }}
                onCloseClick={() => setSelectedRoute(null)}
              >
                <div className="text-sm">
                  <div className="font-semibold mb-1">{selectedRoute.route_name}</div>
                  <div className="text-gray-500">{selectedRoute.seller_name}</div>
                  <div className="mt-1">{selectedRoute.waypoints.length} paradas</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: ROUTE_COLORS[selectedRoute.color_index] }} />
                    <span className="text-xs text-gray-400">Ruta {selectedRoute.color_index + 1}</span>
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* InfoWindow: selected customer */}
            {selectedCustomer && (
              <InfoWindow
                position={{ lat: selectedCustomer.lat, lng: selectedCustomer.lng }}
                onCloseClick={() => setSelectedCustomer(null)}
              >
                <div className="text-sm max-w-xs">
                  <div className="font-semibold">{selectedCustomer.razon_social}</div>
                  {selectedCustomer.direccion && <div className="text-gray-500 text-xs">{selectedCustomer.direccion}</div>}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: VISIT_STATUS_COLORS[selectedCustomer.visit_status] ?? "#94a3b8" }} />
                    <span className="text-xs capitalize">{selectedCustomer.visit_status}</span>
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* InfoWindow: selected seller */}
            {selectedSeller && (
              <InfoWindow
                position={{ lat: Number(selectedSeller.lat), lng: Number(selectedSeller.lng) }}
                onCloseClick={() => setSelectedSeller(null)}
              >
                <div className="text-sm">
                  <div className="font-semibold">{selectedSeller.nombre}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: SELLER_STATUS_COLORS[selectedSeller.status] }} />
                    <span className="capitalize text-xs">{selectedSeller.status}</span>
                  </div>
                  {selectedSeller.battery_level != null && (
                    <div className="flex items-center gap-1 mt-1">
                      {selectedSeller.battery_level <= 20
                        ? <BatteryWarning className="w-3 h-3 text-red-500" />
                        : selectedSeller.battery_level <= 50
                        ? <BatteryMedium className="w-3 h-3 text-yellow-500" />
                        : <BatteryFull className="w-3 h-3 text-green-500" />}
                      <span className="text-xs">{selectedSeller.battery_level}%</span>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg shadow p-3 text-xs space-y-1">
          {Object.entries(VISIT_STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>

        {/* Seller count badge */}
        {layerSellers && sellers.length > 0 && (
          <div className="absolute top-4 right-4 bg-white/90 rounded-lg shadow px-3 py-2 text-xs flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span>{sellers.filter((s: any) => s.status === "online").length} en línea</span>
          </div>
        )}
      </div>
    </div>
  )
}

function LayerToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-blue-50 border-blue-300 text-blue-700"
          : "bg-gray-50 border-gray-200 text-gray-400"
      }`}
    >
      {active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      {icon}
      {label}
    </button>
  )
}
