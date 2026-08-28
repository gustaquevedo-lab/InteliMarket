import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Palette, Plus, Search, Loader2, X, Trash2, Edit, RefreshCw,
  Package, Tag, Layers, Barcode, DollarSign, CheckCircle2, ShieldAlert,
  Info, HelpCircle, ArrowRight, BookOpen, Filter, Box, Sparkles, Copy
} from "lucide-react"
import { api, type Product, type ProductVariant } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG } from "../../utils/format"

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
      setVariants(vars || [])
      setProducts(prods || [])
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
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Copy className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    CATÁLOGO DERIVADO · PRESENTACIONES & PACKS
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    {variants.length} Variantes Registradas
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Variantes & Empaques por Producto
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Gestión de presentaciones, talles, sabores, packs x6/x12 y códigos EAN específicos por variante
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                📦 {productosConVariantes} productos matrices
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                📊 {totalStockVariantes.toLocaleString()} unidades en stock
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
              Recargar
            </button>

            <button
              onClick={() => {
                setEditingVariant(null)
                setForm({ product_id: products[0]?.id || "", tipo: "talle", valor: "", sku_variante: "", codigo_barra: "", precio_extra: 0, stock: 0 })
                setShowModal(true)
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 transition shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Variante
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Variantes Activas</span>
              <Palette className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-indigo-300">
              {variants.length.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400">Opciones configuradas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Productos Base</span>
              <Package className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {productosConVariantes}
            </p>
            <p className="text-[11px] text-slate-400">Artículos matrices en góndola</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stock en Variantes</span>
              <Box className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {totalStockVariantes.toLocaleString()} <span className="text-xs text-slate-400 font-semibold">un.</span>
            </p>
            <p className="text-[11px] text-slate-400">Existencia física acumulada</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lectura en Cajas</span>
              <Barcode className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              100% EAN
            </p>
            <p className="text-[11px] text-slate-400">Sincronización POS directa</p>
          </div>
        </div>
      </div>

      {/* ── TOOLBAR DE FILTROS ── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por artículo, SKU variante, código EAN o valor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap">
          <select
            value={selectedTipo}
            onChange={(e) => setSelectedTipo(e.target.value)}
            className="px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="all">Todos los Atributos</option>
            <option value="talle">Talle / Medida</option>
            <option value="color">Color / Tono</option>
            <option value="sabor">Sabor / Fragancia</option>
            <option value="presentacion">Presentación / Pack</option>
            <option value="otro">Otro Atributo</option>
          </select>

          <select
            value={selectedParentId}
            onChange={(e) => setSelectedParentId(e.target.value)}
            className="px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none max-w-[220px] truncate"
          >
            <option value="all">Todos los Productos Padres ({products.length})</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── TABLA DE VARIANTES ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Producto Padre / Base</th>
                <th className="p-4">Tipo Atributo</th>
                <th className="p-4">Valor / Presentación</th>
                <th className="p-4 font-mono">SKU / EAN Variante</th>
                <th className="p-4 text-right">Sobreprecio</th>
                <th className="p-4 text-right">Stock Físico</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Cargando variantes...</span>
                  </td>
                </tr>
              ) : filteredVariants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    No se encontraron variantes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredVariants.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <p className="font-extrabold text-slate-900 dark:text-white">{v.product_nombre || "Producto Base"}</p>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {v.product_id?.slice(0, 8)}</span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {v.tipo}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-black text-xs text-indigo-600 dark:text-indigo-400">
                        {v.valor}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      <div>{v.sku_variante || "—"}</div>
                      {v.codigo_barra && <span className="text-[10px] text-slate-400">EAN: {v.codigo_barra}</span>}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      {v.precio_extra > 0 ? `+${formatPYG(v.precio_extra)}` : "—"}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {v.stock || 0} un.
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingVariant(v)
                            setForm({
                              product_id: v.product_id,
                              tipo: v.tipo,
                              valor: v.valor,
                              sku_variante: v.sku_variante || "",
                              codigo_barra: v.codigo_barra || "",
                              precio_extra: v.precio_extra || 0,
                              stock: v.stock || 0,
                            })
                            setShowModal(true)
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: CREAR / EDITAR VARIANTE ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <Palette className="w-5 h-5 text-indigo-600" />
                {editingVariant ? "Editar Variante" : "Nueva Variante"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Producto Padre (Base)</label>
                <select
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  disabled={!!editingVariant}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-medium"
                >
                  <option value="">Seleccionar artículo...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.sku || "Sin SKU"})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipo de Atributo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="talle">Talle / Medida</option>
                    <option value="color">Color / Tono</option>
                    <option value="sabor">Sabor / Fragancia</option>
                    <option value="presentacion">Presentación / Pack</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Valor (ej. XL, Pack x12)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. XL o Pack x12"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">SKU Específico Variante</label>
                  <input
                    type="text"
                    placeholder="Ej. REM-BLA-XL"
                    value={form.sku_variante}
                    onChange={(e) => setForm({ ...form, sku_variante: e.target.value })}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Código de Barras EAN</label>
                  <input
                    type="text"
                    placeholder="784..."
                    value={form.codigo_barra}
                    onChange={(e) => setForm({ ...form, codigo_barra: e.target.value })}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sobreprecio Adicional (₲)</label>
                  <input
                    type="number"
                    value={form.precio_extra}
                    onChange={(e) => setForm({ ...form, precio_extra: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Stock Físico Inicial</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 flex-1 transition"
                >
                  {saving ? "Guardando..." : "Guardar Variante"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
