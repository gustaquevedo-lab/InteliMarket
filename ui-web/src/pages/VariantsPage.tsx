import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Palette, Plus, Search, Loader2, X, Trash2, Edit, RefreshCw,
  Package, Tag, Layers, Barcode, DollarSign, CheckCircle2, ShieldAlert,
  Info, HelpCircle, ArrowRight, BookOpen, Filter, Box
} from "lucide-react"
import { api, type Product, type ProductVariant } from "../api"
import { useToast } from "../context/ToastContext"
import { useConfirm } from "../components/ConfirmDialog"
import { formatPYG } from "../utils/format"

export default function VariantsPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [variants, setVariants] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedTipo, setSelectedTipo] = useState<string>("all")
  const [selectedParentId, setSelectedParentId] = useState<string>("all")

  // Modal Alta
  const [showModal, setShowModal] = useState(false)
  const [editingVariant, setEditingVariant] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    product_id: "",
    tipo: "talle",
    valor: "",
    sku_variante: "",
    codigo_barra: "",
    precio_extra: 0,
    stock: 0,
  })

  // Carga de datos
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [vars, prods] = await Promise.all([
        api.variants.list(),
        api.products.list({ limit: 500 }),
      ])
      setVariants(vars)
      setProducts(prods)
    } catch (e: any) {
      toast.error("Error al cargar variantes", e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtrado
  const filteredVariants = useMemo(() => {
    return variants.filter(v => {
      const matchesSearch = !search || 
        v.product_nombre?.toLowerCase().includes(search.toLowerCase()) ||
        v.sku_variante?.toLowerCase().includes(search.toLowerCase()) ||
        v.codigo_barra?.toLowerCase().includes(search.toLowerCase()) ||
        v.valor?.toLowerCase().includes(search.toLowerCase())

      const matchesTipo = selectedTipo === "all" || v.tipo === selectedTipo
      const matchesParent = selectedParentId === "all" || v.product_id === selectedParentId

      return matchesSearch && matchesTipo && matchesParent
    })
  }, [variants, search, selectedTipo, selectedParentId])

  // KPIs
  const totalStockVariantes = variants.reduce((acc, v) => acc + Number(v.stock || 0), 0)
  const productosConVariantes = new Set(variants.map(v => v.product_id)).size

  // Guardar Variante
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.product_id || !form.valor) {
      toast.error("Datos incompletos", "Seleccione el producto padre y el valor de la variante.")
      return
    }

    setSaving(true)
    try {
      if (editingVariant) {
        await api.variants.update(editingVariant.id, form)
        toast.success("Variante Actualizada", `Variante ${form.valor} guardada correctamente.`)
      } else {
        await api.variants.create(form)
        toast.success("Variante Creada", `Variante ${form.valor} agregada al catálogo.`)
      }
      setShowModal(false)
      setEditingVariant(null)
      setForm({ product_id: "", tipo: "talle", valor: "", sku_variante: "", codigo_barra: "", precio_extra: 0, stock: 0 })
      fetchData()
    } catch (e: any) {
      toast.error("Error al guardar", e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (v: any) => {
    const ok = await confirm({
      title: "Eliminar Variante",
      message: `¿Desea eliminar la variante "${v.valor}" de ${v.product_nombre}?`,
      confirmText: "Eliminar",
    })
    if (!ok) return

    try {
      await api.variants.delete(v.id)
      toast.success("Variante eliminada", "")
      fetchData()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in pb-24">
      {/* ──────────────────────────────────────────────────────────────────────────
          HEADER
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Variantes de Producto
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gestión de presentaciones, talles, colores, sabores y SKUs derivados por artículo base.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
          <button
            onClick={() => {
              setEditingVariant(null)
              setForm({ product_id: products[0]?.id || "", tipo: "talle", valor: "", sku_variante: "", codigo_barra: "", precio_extra: 0, stock: 0 })
              setShowModal(true)
            }}
            className="btn-primary text-xs flex items-center gap-2 px-4 py-2.5 shadow-md"
          >
            <Plus className="w-4 h-4" /> + Nueva Variante
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          HERO KPIS
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Variantes Activas</span>
            <Palette className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
            {variants.length.toLocaleString()}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Opciones configuradas</span>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Productos con Variantes</span>
            <Package className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {productosConVariantes}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Artículos matrices en catálogo</span>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stock Total en Variantes</span>
            <Box className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
            {totalStockVariantes.toLocaleString()} un.
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Inventario físico desglosado</span>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Integración POS & EAN</span>
            <Barcode className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            100% Sincronizado
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Lectura directa en caja</span>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          BANNER DE GUÍA OPERATIVA
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="card p-5 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 rounded-3xl space-y-3">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              Guía de Uso: ¿Cómo funcionan las Variantes en InteliMarket?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Las variantes permiten manejar múltiples opciones (talles, colores, sabores, empaques) sin crear productos repetidos en el catálogo principal.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                <strong className="text-indigo-600 dark:text-indigo-400 block font-mono">1. Producto Padre</strong>
                Representa el artículo base (ej. "Remera de Algodón").
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                <strong className="text-indigo-600 dark:text-indigo-400 block font-mono">2. Atributo & SKU</strong>
                Asignás Talle (XL) o Color con su propio código de barra y sobreprecio opcional.
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                <strong className="text-indigo-600 dark:text-indigo-400 block font-mono">3. Venta en Caja</strong>
                El cajero escanea el código específico y descuenta el stock de esa variante exacta.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          FILTROS Y TABLA
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar variante por producto, SKU, código de barras o valor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 pr-8 w-full text-xs font-medium py-2.5"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              className="input-field w-full text-xs font-semibold py-2.5"
            >
              <option value="all">Todos los Tipos</option>
              <option value="talle">Talles</option>
              <option value="color">Colores</option>
              <option value="sabor">Sabores</option>
              <option value="presentacion">Presentación / Pack</option>
            </select>
          </div>

          <div className="w-full sm:w-64">
            <select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              className="input-field w-full text-xs font-semibold py-2.5 truncate"
            >
              <option value="all">Todos los Productos Padres ({products.length})</option>
              {products.slice(0, 100).map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Cargando variantes...</p>
          </div>
        ) : filteredVariants.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <Palette className="w-10 h-10 mx-auto opacity-40 text-indigo-500" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No se encontraron variantes</p>
            <p className="text-xs">Hacé clic en "+ Nueva Variante" para agregar opciones a tus productos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 min-w-[220px]">Producto Padre</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Opción / Valor</th>
                  <th className="p-3.5">SKU Variante</th>
                  <th className="p-3.5">Código de Barras</th>
                  <th className="p-3.5 text-right">Precio Extra</th>
                  <th className="p-3.5 text-right font-bold">Stock</th>
                  <th className="p-3.5 text-right pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredVariants.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{v.product_nombre || "Producto Base"}</div>
                      <div className="text-[10px] text-slate-400 font-mono">SKU Base: {v.product_sku || "—"}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600">
                        {v.tipo}
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      {v.valor}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">{v.sku_variante || "—"}</td>
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">{v.codigo_barra || "—"}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-600">
                      {Number(v.precio_extra || 0) > 0 ? `+${formatPYG(Number(v.precio_extra))}` : "—"}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {v.stock || 0}
                    </td>
                    <td className="p-3.5 text-right pr-4">
                      <button
                        onClick={() => handleDelete(v)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar variante"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: ALTA / EDICIÓN
      ────────────────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Palette className="w-5 h-5 text-indigo-600" /> Nueva Variante
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Producto Matriz *</label>
                <select
                  required
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="input-field w-full text-xs font-bold"
                >
                  <option value="">Seleccionar Producto...</option>
                  {products.slice(0, 150).map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} (SKU: {p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tipo de Variante *</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="input-field w-full text-xs font-bold"
                  >
                    <option value="talle">Talle (S, M, L, XL)</option>
                    <option value="color">Color</option>
                    <option value="sabor">Sabor</option>
                    <option value="presentacion">Presentación / Pack</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Opción / Valor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. XL, Rojo, 6-Pack"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                    className="input-field w-full text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">SKU Derivado</label>
                  <input
                    type="text"
                    placeholder="Ej. 120480-XL"
                    value={form.sku_variante}
                    onChange={(e) => setForm({ ...form, sku_variante: e.target.value })}
                    className="input-field w-full text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Código EAN</label>
                  <input
                    type="text"
                    placeholder="784..."
                    value={form.codigo_barra}
                    onChange={(e) => setForm({ ...form, codigo_barra: e.target.value })}
                    className="input-field w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Sobreprecio (+Gs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.precio_extra}
                    onChange={(e) => setForm({ ...form, precio_extra: Number(e.target.value) })}
                    className="input-field w-full text-xs font-mono font-bold text-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                    className="input-field w-full text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs px-5 py-2 flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar Variante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
