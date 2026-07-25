import { useState, useEffect, useRef, useCallback } from "react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { MapPin, Navigation, BatteryFull, BatteryMedium, BatteryWarning, Users, Bell, AlertTriangle, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp, Clock, DollarSign, ShoppingCart } from "lucide-react"

const POLL_INTERVAL = 15000
const TILE_URL = "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"

const STATUS_COLORS: Record<string, string> = {
  online: "#22c55e",
  busy: "#f59e0b",
  idle: "#6b7280",
  offline: "#9ca3af",
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#dc2626",
}

function SellerMarker({ photo, nombre, status, battery, lat, lng, map }: any) {
  const el = document.createElement("div")
  el.className = "seller-marker"
  el.style.cssText = `
    position: relative; width: 48px; height: 48px; cursor: pointer;
    transform: translate(-50%, -100%);
  `
  const borderColor = STATUS_COLORS[status] || "#9ca3af"

  if (photo) {
    el.innerHTML = `
      <div style="width:44px;height:44px;border-radius:50%;border:3px solid ${borderColor};overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:white;">
        <img src="${photo}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>
      </div>
      <div style="position:absolute;bottom:-2px;right:-4px;display:flex;align-items:center;gap:2px;
        background:rgba(0,0,0,0.8);color:white;font-size:10px;padding:1px 4px;border-radius:8px;">
        ${getBatteryIcon(battery)}
        <span>${battery}%</span>
      </div>
      <div style="position:absolute;top:-4px;left:-4px;width:14px;height:14px;border-radius:50%;
        background:${borderColor};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
      <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);
        background:rgba(0,0,0,0.75);color:white;font-size:10px;padding:2px 6px;border-radius:4px;
        white-space:nowrap;font-weight:600;">${nombre}</div>
    `
  } else {
    el.innerHTML = `
      <div style="width:44px;height:44px;border-radius:50%;border:3px solid ${borderColor};
        background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;
        color:white;font-weight:bold;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
        ${nombre.charAt(0).toUpperCase()}
      </div>
      <div style="position:absolute;bottom:-2px;right:-4px;display:flex;align-items:center;gap:2px;
        background:rgba(0,0,0,0.8);color:white;font-size:10px;padding:1px 4px;border-radius:8px;">
        ${getBatteryIcon(battery)}
        <span>${battery}%</span>
      </div>
      <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);
        background:rgba(0,0,0,0.75);color:white;font-size:10px;padding:2px 6px;border-radius:4px;
        white-space:nowrap;font-weight:600;">${nombre}</div>
    `
  }

  const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([Number(lng), Number(lat)]).addTo(map)
  return marker
}

function getBatteryIcon(level: number): string {
  if (level <= 15) return "🪫"
  if (level <= 30) return "🔋"
  if (level <= 60) return "🔋"
  return "🔋"
}

export default function MapaPage() {
  const { user } = useAuth()
  const companyId = user?.company_id || "00000000-0000-0000-0000-000000000010"
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const tracesRef = useRef<any[]>([])
  const zonesRef = useRef<any[]>([])

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSeller, setSelectedSeller] = useState<any>(null)
  const [showTraces, setShowTraces] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [sellerFilter, setSellerFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [timeAgo, setTimeAgo] = useState("")

  const loadData = useCallback(async () => {
    try {
      const d = await api.distribuidora.tracking.liveMap(companyId)
      setData(d)
      setTimeAgo(new Date().toLocaleTimeString())
    } catch { console.error("Failed to load map data") }
    setLoading(false)
  }, [companyId])

  useEffect(() => {
    loadData()
    if (autoRefresh) {
      const iv = setInterval(loadData, POLL_INTERVAL)
      return () => clearInterval(iv)
    }
  }, [loadData, autoRefresh])

  useEffect(() => {
    if (!mapContainer.current || map.current) return
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: { version: 8, sources: { osm: { type: "raster", tiles: [TILE_URL], tileSize: 256, attribution: "© OpenStreetMap" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
      center: [-57.5759, -25.2637],
      zoom: 12,
    })
    map.current.addControl(new maplibregl.NavigationControl(), "top-right")
  }, [])

  useEffect(() => {
    if (!map.current || !data) return
    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    tracesRef.current.forEach(t => map.current.removeLayer(t.id).removeSource(t.id))
    tracesRef.current = []
    zonesRef.current.forEach(z => map.current.removeLayer(z.id).removeSource(z.id))
    zonesRef.current = []

    const sellers = (data.sellers || []).filter((s: any) => {
      if (sellerFilter !== "all" && s.seller_id !== sellerFilter) return false
      if (statusFilter !== "all" && s.status !== statusFilter) return false
      return true
    })

    // Add markers
    sellers.forEach((s: any) => {
      if (!s.lat || !s.lng) return
      const marker = SellerMarker({ ...s, map: map.current })
      marker.getElement().addEventListener("click", () => setSelectedSeller(s))
      markersRef.current.push(marker)
    })

    // GPS traces
    if (showTraces && sellers.length > 0) {
      sellers.forEach(async (s: any) => {
        if (!s.seller_id) return
        try {
          const trail = await api.distribuidora.tracking.tracking.trail(s.seller_id, 100)
          if (!trail || trail.length < 2) return
          const coords = trail.map((p: any) => [Number(p.lng), Number(p.lat)])
          const sourceId = `trace-${s.seller_id}`
          const layerId = `trace-line-${s.seller_id}`
          map.current.addSource(sourceId, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } })
          map.current.addLayer({ id: layerId, type: "line", source: sourceId, paint: { "line-color": STATUS_COLORS[s.status] || "#3b82f6", "line-width": 3, "line-opacity": 0.7 } })
          tracesRef.current.push({ id: layerId, sourceId })
        } catch {}
      })
    }

    // Geofence zones
    if (showZones && data.geofence_zones) {
      data.geofence_zones.forEach((z: any) => {
        if (z.geometry_type !== "polygon" || !z.coordinates || !Array.isArray(z.coordinates)) return
        const coords = z.coordinates.map((c: any) => [c[0], c[1]])
        if (coords.length < 3) return
        coords.push(coords[0]) // Close polygon
        const sourceId = `zone-${z.id}`
        const fillId = `zone-fill-${z.id}`
        const outlineId = `zone-outline-${z.id}`
        map.current.addSource(sourceId, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } } })
        map.current.addLayer({ id: fillId, type: "fill", source: sourceId, paint: { "fill-color": z.color || "#ef4444", "fill-opacity": 0.15 } })
        map.current.addLayer({ id: outlineId, type: "line", source: sourceId, paint: { "line-color": z.color || "#ef4444", "line-width": 2, "line-dasharray": [2, 2] } })
        zonesRef.current.push({ id: fillId, sourceId }, { id: outlineId })

        // Popup on hover
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
        map.current.on("mouseenter", fillId, (e: any) => {
          map.current.getCanvas().style.cursor = "pointer"
          popup.setLngLat(e.lngLat).setHTML(`<strong>${z.nombre}</strong><br/>${z.zone_type}<br/>${z.severity}`).addTo(map.current)
        })
        map.current.on("mouseleave", fillId, () => { map.current.getCanvas().style.cursor = ""; popup.remove() })
      })
    }

    // Fit bounds to show all markers
    if (sellers.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      sellers.filter((s: any) => s.lat && s.lng).forEach((s: any) => bounds.extend([Number(s.lng), Number(s.lat)]))
      if (!bounds.isEmpty()) map.current.fitBounds(bounds, { padding: 80, maxZoom: 15 })
    }
  }, [data, showTraces, showZones, sellerFilter, statusFilter])

  const seller = selectedSeller
  const onlineCount = data?.sellers?.filter((s: any) => s.status === "online").length || 0
  const offlineCount = (data?.sellers?.length || 0) - onlineCount

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Mapa en Tiempo Real</h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500" /> {onlineCount} online</span>
            <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-400" /> {offlineCount} offline</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{timeAgo && `Última actualización: ${timeAgo}`}</span>
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`p-1.5 rounded-lg ${autoRefresh ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-400 dark:bg-gray-700"}`} title="Auto-refresh">
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)} className="text-sm px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="all">Todos los vendedores</option>
          {(data?.sellers || []).map((s: any) => <option key={s.seller_id} value={s.seller_id}>{s.nombre}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="all">Todos estados</option>
          <option value="online">Online</option>
          <option value="busy">Ocupado</option>
          <option value="idle">Inactivo</option>
          <option value="offline">Offline</option>
        </select>
        <button onClick={() => setShowTraces(!showTraces)} className={`flex items-center gap-1 text-sm px-2 py-1 rounded ${showTraces ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700"}`}>
          {showTraces ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Rutas GPS
        </button>
        <button onClick={() => setShowZones(!showZones)} className={`flex items-center gap-1 text-sm px-2 py-1 rounded ${showZones ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700"}`}>
          {showZones ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Geocercas
        </button>
      </div>

      {/* Main content: Map + Side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div ref={mapContainer} className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Visitas hoy</p>
              <p className="text-xl font-bold text-blue-600">{data?.today_visits || 0}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Completadas</p>
              <p className="text-xl font-bold text-green-600">{data?.today_completed || 0}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Pedidos</p>
              <p className="text-xl font-bold text-purple-600">{data?.today_orders || 0}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Monto Gs.</p>
              <p className="text-xl font-bold text-amber-600">{(data?.today_amount || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Seller list */}
          <div className="p-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" /> Vendedores ({data?.sellers?.length || 0})
            </h3>
            {(data?.sellers || []).map((s: any) => (
              <div key={s.seller_id} onClick={() => setSelectedSeller(s)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors mb-1 ${selectedSeller?.seller_id === s.seller_id ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}>
                <div className="relative flex-shrink-0">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt="" className="w-9 h-9 rounded-full object-cover border-2" style={{ borderColor: STATUS_COLORS[s.status] || "#9ca3af" }} />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold border-2" style={{ borderColor: STATUS_COLORS[s.status] || "#9ca3af" }}>
                      {(s.nombre || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white ${s.status === "online" ? "bg-green-500" : s.status === "busy" ? "bg-yellow-500" : "bg-gray-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.nombre}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{s.status}</span>
                    {s.battery_level !== undefined && <span>🔋 {s.battery_level}%</span>}
                  </div>
                </div>
                {s.speed_kmh > 0 && <span className="text-xs text-gray-400">{s.speed_kmh} km/h</span>}
              </div>
            ))}
          </div>

          {/* Active alerts */}
          {(data?.active_alerts || []).length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Alertas activas ({data.active_alerts.length})
              </h3>
              {data.active_alerts.slice(0, 5).map((a: any) => (
                <div key={a.id} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/10 rounded-lg mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium text-red-700 dark:text-red-400">
                      Entrada a zona restringida
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                      {new Date(a.detected_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Seller detail panel */}
          {seller && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Detalle Vendedor</h3>
                <button onClick={() => setSelectedSeller(null)} className="text-xs text-gray-400 hover:text-gray-600">Cerrar</button>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Nombre:</span> <span className="font-medium">{seller.nombre}</span></p>
                <p><span className="text-gray-500">Estado:</span> <span className={`font-medium ${seller.status === "online" ? "text-green-600" : "text-gray-500"}`}>{seller.status}</span></p>
                <p><span className="text-gray-500">Batería:</span> <span className="font-medium">{seller.battery_level}%</span></p>
                {seller.speed_kmh > 0 && <p><span className="text-gray-500">Velocidad:</span> <span className="font-medium">{seller.speed_kmh} km/h</span></p>}
                <p><span className="text-gray-500">Ubicación:</span> <span className="font-medium">{Number(seller.lat || 0).toFixed(5)}, {Number(seller.lng || 0).toFixed(5)}</span></p>
                {seller.last_updated && <p><span className="text-gray-500">Última actualización:</span> <span className="font-medium">{new Date(seller.last_updated).toLocaleTimeString()}</span></p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
