import { useState, useEffect } from "react"
import {
  LayoutDashboard, Package, Search, Plus, X, Loader2, RefreshCw,
  Pencil, Trash2, type LucideIcon, Boxes, Hash,
} from "lucide-react"
import { api, type ProductVariant, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"

type TabKey = "dashboard" | "variants"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "variants",  label: "Variantes por Producto", icon: Package },
]

export default function VariantsPage() {
  const [tab, setTab] = useState<TabKey>("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Variantes de Producto</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de talles, colores y SKUs por producto</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "variants"  && <VariantsTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: { icon: LucideIcon; label: string; value?: React.ReactNode; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
    pink: "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400",
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colors[color] || colors.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? "—"}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// ==================== DASHBOARD ====================
function DashboardTab() {
  const [productCount, setProductCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.products.list().catch(() => [] as Product[]).then((products) => {
      setProductCount(products.length)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Boxes} label="Productos" value={productCount} color="blue" />
      </div>
      <p className="text-xs text-gray-400">El total de variantes no se puede calcular en conjunto todavia -- elegi un producto en la pestana "Variantes por Producto" para ver las suyas.</p>
    </div>
  )
}

// ==================== VARIANTES POR PRODUCTO ====================
function VariantsTab() {
  const [productSearch, setProductSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editVariant, setEditVariant] = useState<ProductVariant | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (productSearch.length < 2) { setProducts([]); return }
    const timer = setTimeout(() => {
      api.products.list({ search: productSearch }).then(setProducts).catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch])

  async function loadVariants(productId: string) {
    setLoading(true)
    try {
      const data = await api.variants.list(productId)
      setVariants(data)
    } catch { toast.error("Error", "No se pudieron cargar las variantes") }
    finally { setLoading(false) }
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p)
    setProductSearch(`${p.nombre} (${p.sku})`)
    setProducts([])
    loadVariants(p.id)
  }

  function clearSelection() {
    setSelectedProduct(null)
    setProductSearch("")
    setVariants([])
  }

  async function handleDelete(variantId: string) {
    try {
      await api.variants.delete(variantId)
      toast.success("Eliminada", "Variante eliminada correctamente")
      if (selectedProduct) loadVariants(selectedProduct.id)
    } catch { toast.error("Error", "No se pudo eliminar la variante") }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10 w-full" placeholder="Buscar producto..." value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)} />
          {products.length > 0 && (
            <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-700 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {products.map((p) => (
                <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600"
                  onClick={() => selectProduct(p)}>
                  {p.nombre} — {p.sku}
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedProduct && (
          <>
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva Variante</button>
            <button onClick={clearSelection} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">Limpiar</button>
          </>
        )}
      </div>

      {selectedProduct ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{selectedProduct.nombre}</p>
              <p className="text-xs text-gray-400">{selectedProduct.sku} — {variants.length} variante(s)</p>
            </div>
            <button onClick={() => { setShowModal(true); loadVariants(selectedProduct.id) }} className="btn-ghost p-1"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : variants.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><Package className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">Sin variantes</p></div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-3">SKU</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Valor</th>
                  <th className="text-right px-4 py-3">Precio extra</th>
                  <th className="text-right px-4 py-3">Stock</th>
                  <th className="text-center px-4 py-3">Activo</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {variants.map((v) => (
                  <tr key={v.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-mono font-medium">{v.sku_variante || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{v.tipo || "—"}</td>
                    <td className="px-4 py-3">{v.valor || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{v.precio_extra != null ? `₲ ${v.precio_extra.toLocaleString("es-PY")}` : "—"}</td>
                    <td className="px-4 py-3 text-right">{v.stock ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${v.activo !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {v.activo !== false ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setEditVariant(v); setShowModal(true) }} className="btn-ghost p-1"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(v.id)} className="btn-ghost p-1 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">Buscá un producto</p>
          <p className="text-sm">Escribí el nombre o SKU del producto para ver sus variantes</p>
        </div>
      )}

      {showModal && selectedProduct && (
        <VariantFormModal productId={selectedProduct.id} variant={editVariant}
          onClose={() => { setShowModal(false); setEditVariant(null) }}
          onSaved={() => { setShowModal(false); setEditVariant(null); loadVariants(selectedProduct.id) }} />
      )}
    </div>
  )
}

function VariantFormModal({ productId, variant, onClose, onSaved }: { productId: string; variant?: ProductVariant | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    tipo: variant?.tipo || "", valor: variant?.valor || "",
    sku_variante: variant?.sku_variante || "", codigo_barra: variant?.codigo_barra || "",
    precio_extra: variant?.precio_extra || 0, stock: variant?.stock || 0, activo: variant?.activo !== false,
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.tipo || !form.valor) { toast.error("Error", "Tipo y valor son requeridos"); return }
    setSaving(true)
    try {
      const payload = { product_id: productId, ...form }
      if (variant) {
        await api.variants.update(variant.id, payload)
        toast.success("Actualizada", "Variante actualizada correctamente")
      } else {
        await api.variants.create(payload)
        toast.success("Creada", "Variante creada correctamente")
      }
      onSaved()
    } catch { toast.error("Error", "No se pudo guardar la variante") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{variant ? "Editar Variante" : "Nueva Variante"}</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Tipo *</label>
            <select className="input-field w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="">Seleccionar</option>
              <option value="talle">Talle</option>
              <option value="color">Color</option>
              <option value="talla">Talla</option>
              <option value="volumen">Volumen</option>
              <option value="presentacion">Presentación</option>
              <option value="otro">Otro</option>
            </select></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Valor *</label>
            <input className="input-field w-full" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">SKU Variante</label>
            <input className="input-field w-full" value={form.sku_variante} onChange={(e) => setForm({ ...form, sku_variante: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Código Barra</label>
            <input className="input-field w-full" value={form.codigo_barra} onChange={(e) => setForm({ ...form, codigo_barra: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Precio Extra</label>
            <input className="input-field w-full" type="number" value={form.precio_extra} onChange={(e) => setForm({ ...form, precio_extra: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Stock</label>
            <input className="input-field w-full" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} /></div>
          <div className="col-span-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="rounded" />Activo</label></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? <Spinner /> : variant ? "Actualizar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  )
}
