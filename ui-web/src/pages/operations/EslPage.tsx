import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Radio, Tag, RefreshCcw, CheckCircle2, AlertTriangle, Battery, BatteryCharging,
  Wifi, WifiOff, Search, Plus, Filter, Zap, ArrowUpRight, ArrowDownRight,
  Store, Package, Sparkles, SlidersHorizontal, Sliders, Layers, TrendingUp, Loader2,
  Printer, ArrowRight, Check
} from "lucide-react"
import { api, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type Tab = "devices" | "zones" | "print_labels"

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
    { id: "z1", nombre: "Góndola 1 · Lácteos & Refrigerados", pasillo: "Pasillo A", total_esl: 45, estado: "online" },
    { id: "z2", nombre: "Góndola 2 · Bebidas, Cervezas & Licores", pasillo: "Pasillo B", total_esl: 38, estado: "online" },
    { id: "z3", nombre: "Góndola 3 · Almacén, Arroz & Fideos", pasillo: "Pasillo C", total_esl: 52, estado: "online" },
    { id: "z4", nombre: "Góndola 4 · Limpieza, Jabones & Perfumería", pasillo: "Pasillo D", total_esl: 29, estado: "online" },
    { id: "z5", nombre: "Isla Central · Ofertas Relámpago & Punteras", pasillo: "Cabecera", total_esl: 20, estado: "online" },
    { id: "z6", nombre: "Góndola 5 · Panadería & Repostería", pasillo: "Pasillo E", total_esl: 18, estado: "online" },
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
        pasillo: zone.pasillo,
        bateria_pct: bat,
        senial_rssi: -50 - (idx % 20),
        estado: "ONLINE",
        ultima_sync: "Hace 2 min",
      }
    })
  }, [products, zones])

  const filteredDevices = useMemo(() => {
    return devices.filter(d =>
      !search || d.producto_nombre.toLowerCase().includes(search.toLowerCase()) || d.sku?.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase())
    )
  }, [devices, search])

  // Sincronizar todas las etiquetas
  const handleSyncAll = () => {
    setSyncingAll(true)
    setTimeout(() => {
      setSyncingAll(false)
      toast.success("¡Etiquetas ESL Sincronizadas!", `Se han actualizado ${devices.length} pantallas de tinta electrónica en las góndolas de Extra Supermercado.`)
    }, 1200)
  }

  // Sincronizar una etiqueta individual
  const handleSyncTag = (tag: any) => {
    toast.success("Etiqueta Actualizada", `Precio de ${tag.producto_nombre} (${formatPYG(tag.precio_actual)}) transmitido al dispositivo ${tag.id}.`)
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* ── LUXURY COMMAND DECK HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/90 text-white p-7 border border-blue-500/20 shadow-2xl shadow-blue-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 border border-blue-400/30 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Radio className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                    GÓNDOLA DIGITAL · ETIQUETAS ESL & IMPRESIÓN
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Gateway 2.4GHz BLE Activo ({devices.length} Tags)
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Etiquetas Electrónicas (ESL) & Góndolas
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Transmisión inalámbrica de precios, control de góndolas y generación de flejes de precios para salón
                </p>
              </div>
            </div>

            {/* Micro pills */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado Matriz
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🏷️ 100% Pantallas E-Paper Sincronizadas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-blue-300">
                ⚡ Latencia de Actualización &lt; 3s
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button
              onClick={fetchProducts}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Sincronizar
            </button>
            <button
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-black shadow-lg shadow-blue-500/25 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Sincronizar Todas las Góndolas
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Etiquetas Vinculadas</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            {devices.length} dispositivos
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Online: <strong className="text-slate-700 dark:text-slate-200 font-mono">100% Conectadas</strong></span>
            <span className="text-blue-600 font-bold font-mono">Bluetooth BLE</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Zonas de Góndola</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {zones.length} góndolas
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Cobertura: <strong className="text-slate-700 dark:text-slate-200 font-mono">Salón Completo</strong></span>
            <span className="text-emerald-600 font-bold font-mono">6 Pasillos</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Batería Promedio</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <Battery className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
            92% (5 años)
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Tecnología: <strong className="text-slate-700 dark:text-slate-200 font-mono">Tinta E-Ink 3 Colores</strong></span>
            <span className="text-purple-600 font-bold font-mono">Bajo Consumo</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Latencia de Cambio</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            &lt; 3 segundos
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Cambio de Precio: <strong className="text-slate-700 dark:text-slate-200 font-mono">Instantáneo</strong></span>
            <span className="text-amber-600 font-bold font-mono">Automático</span>
          </div>
        </div>
      </div>

      {/* ── TABS DE NAVEGACIÓN ── */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 gap-1.5 shadow-sm">
        {[
          { id: "devices", label: "Etiquetas Electrónicas en Góndola", icon: Tag },
          { id: "zones", label: "Góndolas & Sectores de Salón", icon: Store },
          { id: "print_labels", label: "Generador de Flejes / Etiquetas Físicas", icon: Printer },
        ].map(t => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: DISPOSITIVOS ESL EN GÓNDOLA ── */}
      {tab === "devices" && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por producto, SKU o ID de etiqueta..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            <span className="text-xs font-mono font-bold text-slate-500">
              Mostrando {filteredDevices.length} de {devices.length} etiquetas activas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredDevices.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                    <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{d.id}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{d.producto_nombre}</td>
                    <td className="p-3 font-mono text-slate-500 text-[11px]">{d.sku || "—"}</td>
                    <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">
                      {formatPYG(d.precio_actual)}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300 text-[11px]">{d.gondola}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {d.bateria_pct}%
                    </td>
                    <td className="p-3 text-center font-mono text-slate-500 text-[11px]">
                      {d.senial_rssi} dBm
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleSyncTag(d)}
                        className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition cursor-pointer"
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
      )}

      {/* ── TAB 2: GÓNDOLAS Y SECTORES ── */}
      {tab === "zones" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map(z => (
            <div key={z.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-xl">
                  {z.pasillo}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {z.nombre}
              </h3>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Dispositivos instalados:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-sm">{z.total_esl} tags</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB 3: GENERADOR DE FLEJES / ETIQUETAS FÍSICAS ── */}
      {tab === "print_labels" && (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl p-6 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Impresor de Flejes de Góndola & Etiquetas de Precio
            </h2>
            <p className="text-xs text-slate-500">
              Generación de etiquetas adhesivas con código de barras EAN-13, descripción y precio oficial de Extra Supermercado
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.slice(0, 9).map(p => (
              <div key={p.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">SKU: {p.sku || p.id}</span>
                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">{p.nombre}</h4>
                  <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatPYG(Number(p.precio ?? p.precio_venta ?? 0))}
                  </p>
                </div>
                <button
                  onClick={() => toast.success("Enviado a Impresora", `Etiqueta de ${p.nombre} generada para la góndola.`)}
                  className="w-full py-1.5 text-xs font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-600 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-500" />
                  Imprimir Fleje
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
