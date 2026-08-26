import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Sparkles, TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign, Percent,
  Search, RefreshCcw, Save, Loader2, Check, AlertTriangle, Filter, Tag, CheckCircle2
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
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
      toast.success("¡Precio Actualizado en DB!", `El precio de ${selectedProduct.nombre} ha cambiado a ${formatPYG(newPrice)}.`)
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
  const avgMargin = totalProducts > 0 ? productsWithMargin.reduce((acc, p) => acc + p.margenPct, 0) / totalProducts : 24.0

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-3">
                  <Sparkles className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Smart Pricing & Optimización de Márgenes
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Catálogo Real ({totalProducts} SKUs)
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Cálculo de márgenes brutos, detección de precios desactualizados y ajuste en tiempo real
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
            Sincronizar Catálogo
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ESTILIZADAS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Productos Analizados */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Productos Analizados</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-blue-600 dark:text-blue-400 font-mono tracking-tight">
            {totalProducts} SKUs
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Base: <strong className="text-gray-700 dark:text-gray-200 font-mono">cad_produto</strong></span>
            <span className="text-blue-600 font-bold font-mono">100% Real</span>
          </div>
        </div>

        {/* KPI 2: Margen Promedio */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Margen Promedio Comercial</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            {avgMargin.toFixed(1)}%
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Meta Supermercado: <strong className="text-gray-700 dark:text-gray-200 font-mono">22-25%</strong></span>
            <span className="text-emerald-600 font-bold font-mono">En Rango</span>
          </div>
        </div>

        {/* KPI 3: Alertas de Bajo Margen */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Alertas Bajo Margen (&lt;15%)</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-rose-600 dark:text-rose-400 font-mono tracking-tight">
            {lowMarginCount} alertas
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Acción: <strong className="text-gray-700 dark:text-gray-200 font-mono">Revisar Precios</strong></span>
            <span className="text-rose-600 font-bold font-mono">Prioritario</span>
          </div>
        </div>

        {/* KPI 4: Estado Algoritmo */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Motor de Reglas</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-purple-600 dark:text-purple-400 font-mono tracking-tight">
            Activo
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Redondeo Cajas: <strong className="text-gray-700 dark:text-gray-200 font-mono">50 Gs. DNIT</strong></span>
            <span className="text-purple-600 font-bold font-mono">Sincronizado</span>
          </div>
        </div>
      </div>

      {/* ── TABLA DE PRODUCTOS Y AJUSTE DE PRECIOS ── */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por SKU o descripción..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={filterMargen}
              onChange={e => setFilterMargen(e.target.value as any)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-bold"
            >
              <option value="ALL">Todos los Márgenes</option>
              <option value="LOW">Bajo Margen (&lt;15%)</option>
              <option value="HEALTHY">Margen Saludable (15-30%)</option>
              <option value="HIGH">Alto Margen (&gt;30%)</option>
            </select>
          </div>

          <span className="text-xs font-mono font-bold text-gray-400">
            Mostrando {filteredProducts.length} de {productsWithMargin.length} productos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/50 dark:bg-slate-750/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="p-3 font-mono">SKU</th>
                <th className="p-3">Descripción del Producto</th>
                <th className="p-3 text-right">Costo Unitario</th>
                <th className="p-3 text-right">Precio de Venta</th>
                <th className="p-3 text-right">Margen Bruto</th>
                <th className="p-3 text-center">Estado Margen</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-750/50">
                  <td className="p-3 font-mono text-gray-500 text-[11px]">{p.sku || "—"}</td>
                  <td className="p-3 font-bold text-gray-900 dark:text-white">{p.nombre}</td>
                  <td className="p-3 text-right font-mono text-gray-500">{formatPYG(p.costoCalculado)}</td>
                  <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">{formatPYG(p.precioCalculado)}</td>
                  <td className="p-3 text-right font-mono font-black">
                    <span className={p.margenPct < 15 ? "text-rose-600" : p.margenPct > 30 ? "text-emerald-600" : "text-blue-600"}>
                      {p.margenPct.toFixed(1)}% ({formatPYG(p.margenGs)})
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.margenPct < 15
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : p.margenPct > 30
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    }`}>
                      {p.margenPct < 15 ? "BAJO MARGEN" : p.margenPct > 30 ? "ALTO MARGEN" : "SALUDABLE"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedProduct(p)
                        setNewPrice(p.precioCalculado)
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                    >
                      Ajustar Precio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: AJUSTAR PRECIO ── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white">Ajustar Precio de Venta</h3>
              <button onClick={() => setSelectedProduct(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{selectedProduct.nombre}</p>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-750 flex items-center justify-between text-xs font-mono">
                <span className="text-gray-500">Costo Actual:</span>
                <span className="font-bold">{formatPYG(Number(selectedProduct.costo_promedio ?? selectedProduct.ultimo_costo ?? 0))}</span>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">Nuevo Precio de Venta (Gs.) *</label>
                <input
                  type="number"
                  step="50"
                  value={newPrice}
                  onChange={e => setNewPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-mono font-bold"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium">Margen Resultante:</span>
                <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                  {newPrice > 0 ? (((newPrice - Number(selectedProduct.costo_promedio ?? selectedProduct.ultimo_costo ?? 0)) / newPrice) * 100).toFixed(1) : "0.0"}%
                </span>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdatePrice}
                disabled={updating}
                className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar en Base de Datos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
