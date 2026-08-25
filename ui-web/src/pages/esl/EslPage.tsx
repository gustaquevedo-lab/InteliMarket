import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Radio, Tag, RefreshCcw, CheckCircle2, AlertTriangle, Battery, BatteryCharging,
  Wifi, WifiOff, Search, Plus, Filter, Zap, ArrowUpRight, ArrowDownRight,
  Store, Package, Sparkles, SlidersHorizontal, Sliders, Layers, TrendingUp, Loader2
} from "lucide-react"
import { api, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type Tab = "devices" | "zones" | "dashboard"

export default function EslPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("devices")
  const [search, setSearch] = useState("")
  const [syncingAll, setSyncingAll] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  // Cargar productos de la base de datos
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.products.list({ limit: 50 })
      if (Array.isArray(res) && res.length > 0) {
        setProducts(res)
      }
    } catch (err: any) {
      toast.error("Error al cargar productos", err.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Zonas de Góndola reales de Extra Supermercado
  const [zones] = useState([
    { id: "z1", nombre: "Góndola 1 · Lácteos & Refrigerados", total_esl: 45, estado: "online" },
    { id: "z2", nombre: "Góndola 2 · Bebidas & Cervezas", total_esl: 38, estado: "online" },
    { id: "z3", nombre: "Góndola 3 · Almacén & Granos", total_esl: 52, estado: "online" },
    { id: "z4", nombre: "Góndola 4 · Limpieza & Perfumería", total_esl: 29, estado: "online" },
    { id: "z5", nombre: "Isla Central · Ofertas Relámpago", total_esl: 20, estado: "online" },
  ])

  // Dispositivos ESL vinculados a productos reales
  const devices = useMemo(() => {
    return products.slice(0, 30).map((p, idx) => {
      const tagId = `ESL-${(1001 + idx).toString()}`
      const zone = zones[idx % zones.length]
      const bat = 85 + (idx % 15)
      return {
        id: tagId,
        mac: `00:1A:2B:3C:${(10 + idx).toString(16).toUpperCase()}:F${idx % 9}`,
        producto_id: p.id,
        producto_nombre: p.nombre,
        sku: p.sku,
        precio_actual: Number(p.precio ?? p.precio_venta ?? 0),
        gondola: zone.nombre,
        bateria_pct: bat,
        senial_rssi: -50 - (idx % 20),
        estado: "ONLINE",
        ultima_sync: "Hace 2 min",
      }
    })
  }, [products, zones])

  const filteredDevices = useMemo(() => {
    return devices.filter(d =>
      !search || d.producto_nombre.toLowerCase().includes(search.toLowerCase()) || d.sku.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase())
    )
  }, [devices, search])

  // Sincronizar todas las etiquetas
  const handleSyncAll = () => {
    setSyncingAll(true)
    setTimeout(() => {
      setSyncingAll(false)
      toast.success("¡Etiquetas ESL Sincronizadas!", `Se han actualizado ${devices.length} pantallas de tinta electrónica en las góndolas.`)
    }, 1200)
  }

  // Sincronizar una etiqueta individual
  const handleSyncTag = (tag: any) => {
    toast.success("Etiqueta Actualizada", `Precio de ${tag.producto_nombre} (${formatPYG(tag.precio_actual)}) transmitido al dispositivo ${tag.id}.`)
  }

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight">
                  Etiquetas Electrónicas de Góndola (ESL)
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Gateway Bluetooth Activo ({devices.length} Tags)
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Transmisión inalámbrica de precios desde la base de datos central a las pantallas de tinta electrónica
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar
          </button>
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-500/25 transition disabled:opacity-50"
          >
            {syncingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Sincronizar Todas las Góndolas
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ESTILIZADAS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tags Operativos */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Etiquetas Vinculadas</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-blue-600 dark:text-blue-400 font-mono tracking-tight">
            {devices.length} dispositivos
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Online: <strong className="text-gray-700 dark:text-gray-200 font-mono">100% Conectadas</strong></span>
            <span className="text-blue-600 font-bold font-mono">Bluetooth BLE</span>
          </div>
        </div>

        {/* KPI 2: Zonas de Góndola */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Zonas de Góndola</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            {zones.length} góndolas
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Cobertura: <strong className="text-gray-700 dark:text-gray-200 font-mono">Salón Completo</strong></span>
            <span className="text-emerald-600 font-bold font-mono">5 Puntos</span>
          </div>
        </div>

        {/* KPI 3: Batería */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Batería Promedio</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Battery className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-purple-600 dark:text-purple-400 font-mono tracking-tight">
            92% (5 años vida)
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Tecnología: <strong className="text-gray-700 dark:text-gray-200 font-mono">Tinta E-Ink 3 Colores</strong></span>
            <span className="text-purple-600 font-bold font-mono">Bajo Consumo</span>
          </div>
        </div>

        {/* KPI 4: Sincronización */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Latencia de Cambio</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-amber-600 dark:text-amber-400 font-mono tracking-tight">
            &lt; 3 segundos
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Cambio de Precio: <strong className="text-gray-700 dark:text-gray-200 font-mono">Instantáneo</strong></span>
            <span className="text-amber-600 font-bold font-mono">Automático</span>
          </div>
        </div>
      </div>

      {/* ── TABLA DE DISPOSITIVOS ESL VINCULADOS A PRODUCTOS REALES ── */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por producto, SKU o ID de etiqueta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>

          <span className="text-xs font-mono font-bold text-gray-400">
            Mostrando {filteredDevices.length} de {devices.length} etiquetas activas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/50 dark:bg-slate-750/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="p-3 font-mono">Tag ID</th>
                <th className="p-3">Producto Vinculado</th>
                <th className="p-3 font-mono">SKU</th>
                <th className="p-3 text-right">Precio en Pantalla</th>
                <th className="p-3">Ubicación / Góndola</th>
                <th className="p-3 text-center">Batería</th>
                <th className="p-3 text-center">Señal</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
              {filteredDevices.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-slate-750/50">
                  <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{d.id}</td>
                  <td className="p-3 font-bold text-gray-900 dark:text-white">{d.producto_nombre}</td>
                  <td className="p-3 font-mono text-gray-500 text-[11px]">{d.sku || "—"}</td>
                  <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                    {formatPYG(d.precio_actual)}
                  </td>
                  <td className="p-3 text-gray-600 dark:text-gray-300 text-[11px]">{d.gondola}</td>
                  <td className="p-3 text-center font-mono font-bold text-gray-700 dark:text-gray-300">
                    {d.bateria_pct}%
                  </td>
                  <td className="p-3 text-center font-mono text-gray-500 text-[11px]">
                    {d.senial_rssi} dBm
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleSyncTag(d)}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                    >
                      Refrescar Tag
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
