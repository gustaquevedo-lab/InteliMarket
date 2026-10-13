import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

export interface MapMarkerItem {
  id: string
  title: string
  subtitle?: string
  lat: number
  lng: number
  color?: string
  status?: string
  badge?: string
  iconType?: "user" | "truck" | "pin"
  details?: Record<string, string | number>
}

interface InteractiveMapProps {
  markers?: MapMarkerItem[]
  center?: [number, number] // [lng, lat]
  zoom?: number
  height?: string
  onMarkerClick?: (marker: MapMarkerItem) => void
}

export function InteractiveMap({
  markers = [],
  center = [-55.7478, -22.5319], // Default Pedro Juan Caballero
  zoom = 13,
  height = "520px",
  onMarkerClick,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    if (!mapContainerRef.current) return

    // Clean existing map instance if any
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
          },
        },
        layers: [
          {
            id: "osm-layer",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: center,
      zoom: zoom,
    })

    map.addControl(new maplibregl.NavigationControl(), "top-right")
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update Markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (markers.length === 0) return

    const bounds = new maplibregl.LngLatBounds()

    markers.forEach(m => {
      if (isNaN(m.lat) || isNaN(m.lng) || m.lat === 0 || m.lng === 0) return

      bounds.extend([m.lng, m.lat])

      // Custom DOM Marker element
      const el = document.createElement("div")
      el.className = "cursor-pointer group transform transition-transform hover:scale-110"
      
      const pinColor = m.color || (m.iconType === "truck" ? "#2563eb" : "#4f46e5")
      const iconEmoji = m.iconType === "truck" ? "🚚" : m.iconType === "pin" ? "📍" : "👤"

      el.innerHTML = `
        <div style="background-color: ${pinColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.35);" class="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold border-2 border-white shadow-xl">
          <span style="font-size: 16px;">${iconEmoji}</span>
        </div>
        <div class="hidden group-hover:block absolute bottom-11 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-950/90 text-white text-[11px] font-bold rounded-lg shadow-lg whitespace-nowrap border border-slate-700 pointer-events-none z-50">
          ${m.title}
        </div>
      `

      // Popup
      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; min-width: 180px;">
          <h4 style="margin: 0; font-size: 13px; font-weight: 800; color: #1e293b;">${m.title}</h4>
          ${m.subtitle ? `<p style="margin: 2px 0 6px 0; font-size: 11px; color: #64748b;">${m.subtitle}</p>` : ""}
          ${m.badge ? `<span style="display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: 700; background: #e0e7ff; color: #3730a3; border-radius: 6px; margin-bottom: 6px;">${m.badge}</span>` : ""}
          <div style="font-size: 10px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px;">
            Coordenadas: <strong>${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}</strong>
          </div>
        </div>
      `
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .setPopup(popup)
        .addTo(map)

      el.addEventListener("click", () => {
        if (onMarkerClick) onMarkerClick(m)
      })

      markersRef.current.push(marker)
    })

    // Auto fit bounds if multiple valid markers
    if (markers.length > 1 && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 })
    }
  }, [markers, onMarkerClick])

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-gray-200 dark:border-slate-800 shadow-sm dark:shadow-xl">
      <div ref={mapContainerRef} style={{ width: "100%", height }} />
    </div>
  )
}
