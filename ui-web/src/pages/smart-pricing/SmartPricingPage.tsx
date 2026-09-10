import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Sparkles, TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign, Percent,
  Search, RefreshCcw, Save, Loader2, Check, AlertTriangle, Filter, Tag, CheckCircle2,
  Sliders, ArrowRight, X, Eye
} from "lucide-react"
import { api, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

export default function SmartPricingPage() {
  const toast = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [filterMargen, setFilterMargen] = useState<"ALL" | "LOW" | "HEALTHY" | "HIGH">("ALL")
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [newPrice, setNewPrice] = useState<number>(0)
  const [updating, setUpdating] = useState(false)

  // Cargar productos reales de la base de datos
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.products.list({ limit: 100 })
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

  // Calcular margen bruto para cada producto
  const productsWithMargin = useMemo(() => {
    return products.map(p => {
      const precio = Number(p.precio ?? p.precio_venta ?? 0)
      const costo = Number(p.costo_promedio ?? p.ultimo_costo ?? p.costo_landed ?? (precio > 0 ? precio * 0.76 : 0))
      const margenGs = precio - costo
      const margenPct = precio > 0 ? (margenGs / precio) * 100 : 0
      return {
        ...p,
        precioCalculado: precio,
        costoCalculado: costo,
        margenGs,
        margenPct,
      }
    })
  }, [products])

  // Filtrado
  const filteredProducts = useMemo(() => {
    return productsWithMargin.filter(p => {
      const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
      let matchMargen = true
      if (filterMargen === "LOW") matchMargen = p.margenPct < 15
      if (filterMargen === "HEALTHY") matchMargen = p.margenPct >= 15 && p.margenPct <= 30
      if (filterMargen === "HIGH") matchMargen = p.margenPct > 30
      return matchSearch && matchMargen
    })
  }, [productsWithMargin, search, filterMargen])

  // Actualizar precio en base de datos
  const handleUpdatePrice = async () => {
    if (!selectedProduct || newPrice <= 0) return
    setUpdating(true)
    try {
      await api.products.update(selectedProduct.id, { precio_venta: newPrice, precio: newPrice })
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, precio: newPrice, precio_venta: newPrice } : p))
      toast.success("¡Precio Actualizado!", `El precio de ${selectedProduct.nombre} ha cambiado a ${formatPYG(newPrice)}.`)
      setSelectedProduct(null)
    } catch (err: any) {
      toast.error("Error al actualizar precio", err.message)
    } finally {
      setUpdating(false)
    }
  }

  // KPIs
  const totalProducts = productsWithMargin.length
  const lowMarginCount = productsWithMargin.filter(p => p.margenPct < 15).length
  const healthyMarginCount = productsWithMargin.filter(p => p.margenPct >= 15 && p.margenPct <= 30).length
  const highMarginCount = productsWithMargin.filter(p => p.margenPct > 30).length
  const avgMargin = totalProducts > 0 ? productsWithMargin.reduce((acc, p) => acc + p.margenPct, 0) / totalProducts : 24.0

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Sparkles className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    INTELIGENCIA DE PRECIOS · RETAIL & MÁRGENES
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Margen Promedio: {avgMargin.toFixed(1)}%
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Smart Pricing & Optimización de Márgenes
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Auditoría en tiempo real de rentabilidad bruta por SKU, detección de precios desfasados y ajuste dinámico
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                📦 {totalProducts} SKUs analizados
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-rose-400">
                ⚠️ {lowMarginCount} SKUs con margen &lt; 15%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={fetchProducts}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Sincronizar Catálogo
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Promedio</span>
              <span className="text-[10px] font-bold text-emerald-400">Bruto</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {avgMargin.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400">Promedio ponderado del catálogo</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Crítico (&lt;15%)</span>
              <span className="text-[10px] font-bold text-rose-400">Alerta</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {lowMarginCount} <span className="text-sm font-semibold text-slate-400">SKUs</span>
            </p>
            <p className="text-[11px] text-slate-400">Requieren remarcación urgente</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Saludable (15-30%)</span>
              <span className="text-[10px] font-bold text-blue-400">Óptimo</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {healthyMarginCount} <span className="text-sm font-semibold text-slate-400">SKUs</span>
            </p>
            <p className="text-[11px] text-slate-400">Equilibrio volumen/rentabilidad</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Alto (&gt;30%)</span>
              <span className="text-[10px] font-mono text-purple-400">Premium</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {highMarginCount} <span className="text-sm font-semibold text-slate-400">SKUs</span>
            </p>
            <p className="text-[11px] text-slate-400">Productos generadores de ganancia</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "ALL", label: "Todos los SKUs", count: totalProducts },
          { id: "LOW", label: "Margen Crítico (<15%)", count: lowMarginCount, color: "text-rose-500" },
          { id: "HEALTHY", label: "Margen Saludable (15-30%)", count: healthyMarginCount },
          { id: "HIGH", label: "Margen Alto (>30%)", count: highMarginCount },
        ].map((t) => {
          const active = filterMargen === t.id
          return (
            <button
              key={t.id}
              onClick={() => setFilterMargen(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
              }`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 🔍 BARRA DE HERRAMIENTAS & BUSCADOR */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre de producto, SKU o código de barra..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* 📊 TABLA DE SMART PRICING */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Producto / SKU</th>
                <th className="p-4 text-right">Costo Estimado</th>
                <th className="p-4 text-right">Precio Venta</th>
                <th className="p-4 text-right">Margen (₲)</th>
                <th className="p-4 text-center">Margen (%)</th>
                <th className="p-4 text-center">Diagnóstico</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    <span>Analizando márgenes de rentabilidad...</span>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    No se encontraron productos coincidentes.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isLow = p.margenPct < 15
                  const isHealthy = p.margenPct >= 15 && p.margenPct <= 30
                  const isHigh = p.margenPct > 30

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900 dark:text-white max-w-[240px] truncate">{p.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{p.sku || p.codigo_barra || `SKU-${p.id.slice(0, 6)}`}</p>
                      </td>
                      <td className="p-4 text-right font-mono text-slate-500 text-[11px]">
                        {formatPYG(p.costoCalculado)}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">
                        {formatPYG(p.precioCalculado)}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {formatPYG(p.margenGs)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono ${
                          isLow
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : isHealthy
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {p.margenPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-[10px] font-bold ${
                          isLow ? "text-rose-500" : isHealthy ? "text-blue-500" : "text-emerald-500"
                        }`}>
                          {isLow ? "Crítico / Ajustar" : isHealthy ? "Saludable" : "Alta Rentabilidad"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedProduct(p)
                            setNewPrice(p.precioCalculado)
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold text-[11px] transition shadow-xs"
                        >
                          Ajustar Precio
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: SIMULADOR & AJUSTE DE PRECIO ── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Ajustar Precio Inteligente</h3>
                  <p className="text-xs text-slate-400 truncate max-w-[200px]">{selectedProduct.nombre}</p>
                </div>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl space-y-2">
                <div className="flex justify-between"><span className="text-slate-400">Costo Base:</span><span className="font-mono font-bold text-slate-900 dark:text-white">{formatPYG(selectedProduct.costoCalculado)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Precio Actual:</span><span className="font-mono text-slate-500">{formatPYG(selectedProduct.precioCalculado)} ({selectedProduct.margenPct.toFixed(1)}% margen)</span></div>
              </div>

              <div>
                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Nuevo Precio de Venta (₲)</label>
                <input
                  type="number"
                  value={newPrice}
                  onChange={e => setNewPrice(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-base font-mono font-black text-emerald-600 dark:text-emerald-400 outline-none"
                />
              </div>

              {/* Preview de Margen Simulado */}
              {newPrice > 0 && (
                <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Margen Simulado:</span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {(((newPrice - selectedProduct.costoCalculado) / newPrice) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                    <span>Ganancia Bruta:</span>
                    <span className="font-mono font-bold">{formatPYG(newPrice - selectedProduct.costoCalculado)} /un</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSelectedProduct(null)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">
                Cancelar
              </button>
              <button
                onClick={handleUpdatePrice}
                disabled={updating || newPrice <= 0}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/25 flex items-center gap-1.5 transition"
              >
                {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Guardar Nuevo Precio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
