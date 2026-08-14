import { useState, useEffect } from "react"
import { Search, Plus, Package, AlertTriangle, Edit, Trash2, Loader2, Eye, X, Save, Tag, Barcode, DollarSign, Layers, Upload, Download, Shirt } from "lucide-react"
import { api, type Product, type Category, type ProductVariant } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [perishableConfigs, setPerishableConfigs] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [productDetail, setProductDetail] = useState<Product & { stock_actual?: number; costo_promedio?: number; precio_referencia?: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formTab, setFormTab] = useState<"general" | "precios" | "perecederos">("general")
  const [form, setForm] = useState({
    sku: "", nombre: "", codigo_barra: "", categoria_id: "",
    tipo: "producto", unidad_medida: "UN", iva_tasa: 10,
    stock_minimo: 0, descripcion: "", costo: 0, precio: 0,
    plu_codigo: "", es_perecedero: false, vida_util_dias: 0,
    temperatura_min: 0, temperatura_max: 0, markdown_opt_in: false
  })
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ total_rows: number; success: number; errors: number; details: Array<{ row: number; status: string; message: string }> } | null>(null)
  const [importing, setImporting] = useState(false)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [variantForm, setVariantForm] = useState({ tipo: "talle", valor: "", sku_variante: "", codigo_barra: "", precio_extra: 0, stock: 0 })
  const [variantSaving, setVariantSaving] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [prods, cats, pConfigs] = await Promise.all([
        api.products.list({ search: search || undefined }),
        api.categories.list(),
        api.supermer.perishableConfigs.list().catch(() => []),
      ])
      setProducts(prods)
      setCategories(cats)
      setPerishableConfigs(pConfigs)
    } catch {
      toast.error("Error de conexión", "Conectá el backend para ver datos reales")
      setProducts([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData()
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    const formData = new FormData()
    formData.append("file", importFile)
    try {
      const result = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/v1/imports/products`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
        body: formData,
      })
      const data = await result.json()
      if (!result.ok) throw new Error(data.detail || "Error en importación")
      setImportResult(data)
      toast.success("Importación completada", `${data.success} de ${data.total_rows} productos importados`)
      if (data.success > 0) fetchData()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo importar")
    } finally {
      setImporting(false)
    }
  }

  const loadProductDetail = async (product: Product) => {
    setViewingProduct(product)
    setDetailLoading(true)
    try {
      const [detail, variantData] = await Promise.all([
        api.products.get(product.id),
        api.variants.list(product.id),
      ])
      setProductDetail(detail as Product & { stock_actual?: number; costo_promedio?: number; precio_referencia?: number })
      setVariants(variantData)
    } catch {
      setProductDetail(product as Product & { stock_actual?: number; costo_promedio?: number; precio_referencia?: number })
      setVariants([])
    } finally {
      setDetailLoading(false)
    }
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    const match = perishableConfigs.find(c => c.producto_id === product.id)
    setFormTab("general")
    setForm({
      sku: product.sku,
      nombre: product.nombre,
      codigo_barra: product.codigo_barra || "",
      categoria_id: product.categoria_id || "",
      tipo: product.tipo || "producto",
      unidad_medida: product.unidad_medida || "UN",
      iva_tasa: product.iva_tasa ?? 10,
      stock_minimo: product.stock_minimo ?? 0,
      descripcion: product.descripcion || "",
      costo: product.costo_promedio ?? 0,
      precio: product.precio_venta ?? 0,
      plu_codigo: (product as any).plu_codigo || "",
      es_perecedero: !!match,
      vida_util_dias: match?.vida_util_dias || 0,
      temperatura_min: 0,
      temperatura_max: 0,
      markdown_opt_in: match?.requiere_markdown || false,
    })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { es_perecedero, vida_util_dias, temperatura_min, temperatura_max, markdown_opt_in, plu_codigo, ...cleanForm } = form
      const newProd = await api.products.create({
        ...cleanForm,
        activo: true,
        precio_venta: form.precio,
        costo_promedio: form.costo,
        plu_codigo: plu_codigo || undefined,
      } as any)

      if (form.es_perecedero) {
        await api.supermer.perishableConfigs.upsert({
          producto_id: newProd.id,
          vida_util_dias: form.vida_util_dias,
          requiere_markdown: form.markdown_opt_in,
          categoria_perecedera: "Perecedero"
        })
      }

      toast.success("Producto creado", form.nombre)
      setShowForm(false)
      setForm({ sku: "", nombre: "", codigo_barra: "", categoria_id: "", tipo: "producto", unidad_medida: "UN", iva_tasa: 10, stock_minimo: 0, descripcion: "", costo: 0, precio: 0, plu_codigo: "", es_perecedero: false, vida_util_dias: 0, temperatura_min: 0, temperatura_max: 0, markdown_opt_in: false })
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear producto"
      toast.error("Error", msg)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    setSaving(true)
    try {
      const { es_perecedero, vida_util_dias, temperatura_min, temperatura_max, markdown_opt_in, plu_codigo, ...cleanForm } = form
      await api.products.update(editingProduct.id, {
        sku: form.sku,
        nombre: form.nombre,
        codigo_barra: form.codigo_barra || undefined,
        categoria_id: form.categoria_id || undefined,
        tipo: form.tipo,
        unidad_medida: form.unidad_medida,
        iva_tasa: form.iva_tasa,
        stock_minimo: form.stock_minimo,
        descripcion: form.descripcion || undefined,
        precio_venta: form.precio || undefined,
        costo_promedio: form.costo || undefined,
        plu_codigo: plu_codigo || undefined,
      } as any)

      if (form.es_perecedero) {
        await api.supermer.perishableConfigs.upsert({
          producto_id: editingProduct.id,
          vida_util_dias: form.vida_util_dias,
          requiere_markdown: form.markdown_opt_in,
          categoria_perecedera: "Perecedero"
        })
      }

      toast.success("Producto actualizado", form.nombre)
      setEditingProduct(null)
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar"
      toast.error("Error", msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (product: Product) => {
    const ok = await confirm({
      title: "Eliminar producto",
      message: `¿Estás seguro de eliminar "${product.nombre}"?`,
      confirmText: "Eliminar",
      variant: "danger",
    })
    if (!ok) return
    try {
      await api.products.delete(product.id)
      toast.success("Producto eliminado")
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar"
      toast.error("Error", msg)
    }
  }

  const toggleActive = async (product: Product) => {
    try {
      await api.products.update(product.id, { activo: !product.activo })
      toast.success(product.activo ? "Producto desactivado" : "Producto activado", product.nombre)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo cambiar el estado")
    }
  }

  const filtered = products.filter(p =>
    !search ||
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.codigo_barra && p.codigo_barra.includes(search))
  )

  const lowStock = products.filter(p => p.activo && (p.stock || 0) <= (p.stock_minimo || 0))

  const formModal = (
    <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingProduct(null) }}>
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingProduct ? "Editar producto" : "Nuevo producto"}</h3>
          <button onClick={() => { setShowForm(false); setEditingProduct(null) }} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-6 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all ${
              formTab === "general"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            onClick={() => setFormTab("general")}
          >
            General
          </button>
          <button
            type="button"
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all ${
              formTab === "precios"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            onClick={() => setFormTab("precios")}
          >
            Precios y Variantes
          </button>
          <button
            type="button"
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all ${
              formTab === "perecederos"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            onClick={() => setFormTab("perecederos")}
          >
            Control de Perecederos
          </button>
        </div>

        <form onSubmit={editingProduct ? handleUpdate : handleCreate} className="p-6 space-y-4">
          {formTab === "general" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required">SKU</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="input-field pl-10" value={form.sku} onChange={(e) => setForm({...form, sku: e.target.value})} required placeholder="PROD-001" />
                  </div>
                </div>
                <div>
                  <label className="input-label">Código de barra</label>
                  <div className="relative">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className="input-field pl-10" value={form.codigo_barra} onChange={(e) => setForm({...form, codigo_barra: e.target.value})} placeholder="7891234567890" />
                  </div>
                </div>
              </div>
              <div>
                <label className="input-label label-required">Nombre</label>
                <input className="input-field" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} required placeholder="Nombre del producto" />
              </div>
              <div>
                <label className="input-label">Descripción</label>
                <textarea className="input-field resize-none" rows={2} value={form.descripcion} onChange={(e) => setForm({...form, descripcion: e.target.value})} placeholder="Descripción del producto..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Categoría</label>
                  <select className="input-field" value={form.categoria_id} onChange={(e) => setForm({...form, categoria_id: e.target.value})}>
                    <option value="">Sin categoría</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Tipo</label>
                  <select className="input-field" value={form.tipo} onChange={(e) => setForm({...form, tipo: e.target.value})}>
                    <option value="producto">Producto</option>
                    <option value="servicio">Servicio</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="input-label">IVA</label>
                  <select className="input-field" value={form.iva_tasa} onChange={(e) => setForm({...form, iva_tasa: Number(e.target.value)})}>
                    <option value={10}>10%</option>
                    <option value={5}>5%</option>
                    <option value={0}>0% (Exento)</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">U. medida</label>
                  <select className="input-field" value={form.unidad_medida} onChange={(e) => setForm({...form, unidad_medida: e.target.value})}>
                    <option value="UN">Unidad</option>
                    <option value="KG">Kilogramo</option>
                    <option value="LT">Litro</option>
                    <option value="MT">Metro</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Stock mínimo</label>
                  <input type="number" className="input-field" value={form.stock_minimo} onChange={(e) => setForm({...form, stock_minimo: Number(e.target.value)})} min="0" />
                </div>
              </div>
              <div>
                <label className="input-label">Código PLU (Balanza)</label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input-field pl-10" value={form.plu_codigo} onChange={(e) => setForm({...form, plu_codigo: e.target.value})} placeholder="Ej: 2005" />
                </div>
              </div>
            </div>
          )}

          {formTab === "precios" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Costo</label>
                  <input type="number" className="input-field" value={form.costo} onChange={(e) => setForm({...form, costo: Number(e.target.value)})} min="0" step="100" />
                </div>
                <div>
                  <label className="input-label">Precio venta</label>
                  <input type="number" className="input-field" value={form.precio} onChange={(e) => setForm({...form, precio: Number(e.target.value)})} min="0" step="500" />
                </div>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 rounded-xl text-xs space-y-1">
                <p className="font-bold">Información de Variantes:</p>
                <p>Las variantes técnicas como color, talle, sabor o presentación se definen y administran individualmente desde el panel de detalle técnico una vez guardado el producto.</p>
              </div>
            </div>
          )}

          {formTab === "perecederos" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <input
                  type="checkbox"
                  id="es_perecedero"
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                  checked={form.es_perecedero}
                  onChange={(e) => setForm({...form, es_perecedero: e.target.checked})}
                />
                <label htmlFor="es_perecedero" className="text-sm font-bold text-gray-900 dark:text-white cursor-pointer select-none">
                  ¿Es un producto fresco / perecedero?
                </label>
              </div>

              {form.es_perecedero && (
                <div className="space-y-4 border border-gray-100 dark:border-gray-800 p-4 rounded-xl">
                  <div>
                    <label className="input-label">Vida útil en góndola (Días)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={form.vida_util_dias}
                      onChange={(e) => setForm({...form, vida_util_dias: Number(e.target.value)})}
                      min="1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">Temperatura Mínima (°C)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={form.temperatura_min}
                        onChange={(e) => setForm({...form, temperatura_min: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="input-label">Temperatura Máxima (°C)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={form.temperatura_max}
                        onChange={(e) => setForm({...form, temperatura_max: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2">
                    <input
                      type="checkbox"
                      id="markdown_opt_in"
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                      checked={form.markdown_opt_in}
                      onChange={(e) => setForm({...form, markdown_opt_in: e.target.checked})}
                    />
                    <label htmlFor="markdown_opt_in" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                      Habilitar regla de Markdown (descuento automático por vencimiento sugerido)
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button type="button" className="btn-outline flex-1" onClick={() => { setShowForm(false); setEditingProduct(null) }}>Cancelar</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingProduct ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Productos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{products.length} productos registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-outline">
            <Upload className="w-4 h-4" />
            Importar
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nuevo producto
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" className="input-field pl-10" placeholder="Buscar por nombre, SKU o código de barra..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary">Buscar</button>
      </form>

      {lowStock.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-400">
            <strong>{lowStock.length}</strong> {lowStock.length === 1 ? "producto con" : "productos con"} stock bajo el mínimo
          </span>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">SKU</th>
              <th className="table-cell">Nombre</th>
              <th className="table-cell">Código barra</th>
              <th className="table-cell">Categoría</th>
              <th className="table-cell">Stock</th>
              <th className="table-cell">Precio</th>
              <th className="table-cell">IVA</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No se encontraron productos
              </td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="table-td font-mono text-xs font-bold text-primary">{p.sku}</td>
                  <td className="table-td font-medium">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{p.nombre}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {p.descripcion && <span className="text-xs text-gray-400 truncate max-w-48">{p.descripcion}</span>}
                        {(p as any).plu_codigo && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            PLU: {(p as any).plu_codigo}
                          </span>
                        )}
                        {perishableConfigs.some(pc => pc.producto_id === p.id) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            Cold Chain
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-td font-mono text-xs text-gray-400">{p.codigo_barra || "—"}</td>
                  <td className="table-td text-sm">{p.categoria?.nombre || "—"}</td>
                  <td className="table-td">
                    <span className={`font-mono font-bold ${(p.stock || 0) <= (p.stock_minimo || 0) ? "text-red-500" : "text-gray-900 dark:text-white"}`}>
                      {p.stock ?? 0}
                    </span>
                  </td>
              <td className="table-td font-mono font-bold text-green-600">{formatPYG(p.precio_venta || 0)}</td>
              <td className="table-td font-mono">{p.iva_tasa}%</td>
              <td className="table-td">
                    <button onClick={() => toggleActive(p)} className="cursor-pointer">
                      <StatusBadge status={p.activo ? "activo" : "cancelado"} />
                    </button>
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost" title="Ver detalle" onClick={() => loadProductDetail(p)}><Eye className="w-4 h-4" /></button>
                      <button className="btn-ghost" title="Editar" onClick={() => openEdit(p)}><Edit className="w-4 h-4" /></button>
                      <button className="btn-ghost text-red-400 hover:text-red-500" title="Eliminar" onClick={(e) => { e.stopPropagation(); handleDelete(p) }}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewingProduct && (
        <div className="modal-overlay" onClick={() => { setViewingProduct(null); setProductDetail(null) }}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detalle del producto</h3>
              <button onClick={() => { setViewingProduct(null); setProductDetail(null) }} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : productDetail ? (
              <div className="p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-light rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Package className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white">{productDetail.nombre}</h4>
                    <p className="text-sm text-gray-500 font-mono">{productDetail.sku}</p>
                    {productDetail.codigo_barra && (
                      <p className="text-xs text-gray-400 font-mono flex items-center gap-1 mt-1">
                        <Barcode className="w-3 h-3" /> {productDetail.codigo_barra}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={productDetail.activo ? "activo" : "cancelado"} />
                </div>

                {productDetail.descripcion && (
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <p className="text-sm text-gray-600 dark:text-gray-300">{productDetail.descripcion}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4">
                    <div className="flex items-center gap-2 mb-1"><Layers className="w-4 h-4 text-gray-400" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Categoría</span></div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{productDetail.categoria?.nombre || "Sin categoría"}</p>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-2 mb-1"><Tag className="w-4 h-4 text-gray-400" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo</span></div>
                    <StatusBadge status={productDetail.tipo || "-"} map={{ producto: "badge-info", servicio: "badge-accent" }} />
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-gray-400" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stock actual</span></div>
                    <p className={`text-2xl font-bold ${(productDetail.stock || 0) <= (productDetail.stock_minimo || 0) ? "text-red-500" : "text-gray-900 dark:text-white"}`}>
                      {productDetail.stock ?? 0} <span className="text-sm text-gray-400">{productDetail.unidad_medida}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Mínimo: {productDetail.stock_minimo}</p>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-gray-400" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">IVA</span></div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{productDetail.iva_tasa}%</p>
                  </div>
                </div>

                {(productDetail as { costo_promedio?: number }).costo_promedio != null && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="card p-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Costo promedio</span>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{formatPYG((productDetail as { costo_promedio?: number }).costo_promedio || 0)}</p>
                    </div>
                    <div className="card p-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Precio referencia</span>
                      <p className="text-lg font-bold text-green-600">{formatPYG((productDetail as { precio_referencia?: number }).precio_referencia || 0)}</p>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                  Creado: {productDetail.created_at ? new Date(productDetail.created_at).toLocaleDateString("es-PY") : "—"} &middot; Actualizado: {productDetail.updated_at ? new Date(productDetail.updated_at).toLocaleDateString("es-PY") : "—"}
                </div>

                {/* Variants Section */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1"><Shirt className="w-4 h-4" /> Variantes ({variants.length})</span>
                    <button className="btn-ghost text-xs text-primary" onClick={() => {
                      setEditingVariant(null)
                      setVariantForm({ tipo: "talle", valor: "", sku_variante: "", codigo_barra: "", precio_extra: 0, stock: 0 })
                      setShowVariantForm(true)
                    }}>
                      <Plus className="w-3 h-3" /> Añadir
                    </button>
                  </div>
                  {variants.length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {variants.map(v => (
                        <div key={v.id} className="flex items-center justify-between py-1 px-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-500">{v.tipo}</span>
                            <span className="font-bold">{v.valor}</span>
                            <span className="font-mono text-gray-400">{v.sku_variante}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {(v.precio_extra ?? 0) > 0 && <span className="text-green-500">{formatPYG(v.precio_extra ?? 0)}</span>}
                            <span className="text-gray-400">Stock: {v.stock}</span>
                            <button className="text-gray-400 hover:text-primary" onClick={() => {
                              setEditingVariant(v)
                              setVariantForm({ tipo: v.tipo ?? "", valor: v.valor ?? "", sku_variante: v.sku_variante ?? "", codigo_barra: v.codigo_barra ?? "", precio_extra: v.precio_extra ?? 0, stock: v.stock ?? 0 })
                              setShowVariantForm(true)
                            }}><Edit className="w-3 h-3" /></button>
                            <button className="text-gray-400 hover:text-red-500" onClick={async () => {
                              try { await api.variants.delete(v.id); setVariants(prev => prev.filter(x => x.id !== v.id)); toast.success("Eliminada", "Variante eliminada") } catch { toast.error("Error", "No se pudo eliminar") }
                            }}><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-2">Sin variantes. Agregá talles, colores, etc.</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button className="btn-outline flex-1" onClick={() => { setViewingProduct(null); openEdit(productDetail); }}>
                    <Edit className="w-4 h-4" /> Editar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {(showForm || editingProduct) && formModal}

      {/* Variant Form Modal */}
      {showVariantForm && viewingProduct && (
        <div className="modal-overlay" onClick={() => setShowVariantForm(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingVariant ? "Editar variante" : "Nueva variante"}</h3>
              <button onClick={() => setShowVariantForm(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Tipo</label>
                  <select className="input-field" value={variantForm.tipo} onChange={(e) => setVariantForm({...variantForm, tipo: e.target.value})}>
                    <option value="talle">Talle</option>
                    <option value="color">Color</option>
                    <option value="material">Material</option>
                    <option value="sabor">Sabor</option>
                    <option value="presentacion">Presentación</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required">Valor</label>
                  <input className="input-field" placeholder="XL / Rojo / 500ml" value={variantForm.valor} onChange={(e) => setVariantForm({...variantForm, valor: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="input-label label-required">SKU Variante</label>
                <input className="input-field" placeholder="PROD-001-XL" value={variantForm.sku_variante} onChange={(e) => setVariantForm({...variantForm, sku_variante: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Código de barra</label>
                <input className="input-field" placeholder="1234567890123" value={variantForm.codigo_barra} onChange={(e) => setVariantForm({...variantForm, codigo_barra: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Precio extra (PYG)</label>
                  <input className="input-field" type="number" value={variantForm.precio_extra || ""} onChange={(e) => setVariantForm({...variantForm, precio_extra: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="input-label">Stock</label>
                  <input className="input-field" type="number" value={variantForm.stock || ""} onChange={(e) => setVariantForm({...variantForm, stock: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowVariantForm(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={async () => {
                  if (!variantForm.valor || !variantForm.sku_variante) { toast.error("Error", "Valor y SKU son obligatorios"); return }
                  setVariantSaving(true)
                  try {
                    if (editingVariant) {
                      await api.variants.update(editingVariant.id, variantForm)
                      toast.success("Actualizada", "Variante actualizada")
                    } else {
                      await api.variants.create({ product_id: viewingProduct.id, ...variantForm })
                      toast.success("Creada", "Variante creada")
                    }
                    const updated = await api.variants.list(viewingProduct.id)
                    setVariants(updated)
                    setShowVariantForm(false)
                  } catch { toast.error("Error", "No se pudo guardar la variante") }
                  finally { setVariantSaving(false) }
                }} disabled={variantSaving}>
                  {variantSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Importar productos</h3>
              <button onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Subí un archivo CSV con las columnes: sku, nombre, codigo_barra, descripcion, unidad_medida, iva_tasa, stock_minimo, categoria_id</p>
              <a href={`${import.meta.env.VITE_API_URL || "/api"}/v1/imports/template/products`} className="text-sm text-primary hover:underline flex items-center gap-1" download>
                <Download className="w-3 h-3" /> Descargar plantilla
              </a>
              <div>
                <label className="input-label">Archivo CSV</label>
                <input type="file" accept=".csv" className="input-field" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
              </div>
              {importFile && (
                <p className="text-sm text-gray-500">Archivo: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
              )}
              {importResult && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex gap-2 text-sm">
                    <span className="text-green-500 font-bold">{importResult.success} éxitos</span>
                    <span className="text-red-500 font-bold">{importResult.errors} errores</span>
                  </div>
                  {importResult.details.filter(d => d.status !== "success").slice(0, 5).map(d => (
                    <div key={d.row} className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600">
                      Fila {d.row}: {d.message}
                    </div>
                  ))}
                  {importResult.errors > 5 && <p className="text-xs text-gray-400">... y {importResult.errors - 5} errores más</p>}
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null) }}>Cerrar</button>
                <button className="btn-primary flex-1" onClick={handleImport} disabled={!importFile || importing}>
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Importar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
