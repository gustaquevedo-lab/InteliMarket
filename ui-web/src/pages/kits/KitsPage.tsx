import { useState, useEffect } from "react"
import {
  LayoutDashboard, Package, Search, Plus, X, Loader2, RefreshCw,
  Pencil, Trash2, Calculator, DollarSign, Box, CheckCircle,
  type LucideIcon,
} from "lucide-react"
import { api, type Kit, type KitItem, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type TabKey = "dashboard" | "kits" | "calcular"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "kits",      label: "Kits",       icon: Package },
  { key: "calcular",  label: "Calcular Precio", icon: Calculator },
]

export default function KitsPage() {
  const [tab, setTab] = useState<TabKey>("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kits / Combos</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de kits, combos y paquetes de productos</p>
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
      {tab === "kits"      && <KitsTab />}
      {tab === "calcular"  && <CalcularPrecioTab />}
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
  const [kits, setKits] = useState<Kit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.kits.list()
      .then(setKits)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  const activeKits = kits.filter(k => k.activo !== false)
  const totalCosto = kits.reduce((s, k) => s + (k.costo || 0), 0)
  const totalPrecio = kits.reduce((s, k) => s + (k.precio || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Box} label="Total Kits" value={kits.length} color="blue" />
        <KpiCard icon={CheckCircle} label="Kits Activos" value={activeKits.length} color="green" />
        <KpiCard icon={DollarSign} label="Costo Total" value={formatPYG(totalCosto)} color="yellow" />
        <KpiCard icon={DollarSign} label="Precio Total" value={formatPYG(totalPrecio)} color="purple" />
      </div>
    </div>
  )
}

// ==================== KITS ====================
function KitsTab() {
  const [kits, setKits] = useState<Kit[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editKit, setEditKit] = useState<Kit | null>(null)
  const toast = useToast()

  async function load() {
    setLoading(true)
    try {
      const data = await api.kits.list()
      setKits(data)
    } catch { toast.error("Error", "No se pudieron cargar los kits") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(kitId: string) {
    try {
      await api.kits.delete(kitId)
      toast.success("Eliminado", "Kit eliminado correctamente")
      load()
    } catch { toast.error("Error", "No se pudo eliminar el kit") }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Kit</button>
        <button onClick={load} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : kits.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Package className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">No hay kits</p></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">SKU</th>
                <th className="text-right px-4 py-3">Costo</th>
                <th className="text-right px-4 py-3">Precio</th>
                <th className="text-right px-4 py-3">Margen</th>
                <th className="text-center px-4 py-3">Items</th>
                <th className="text-center px-4 py-3">Activo</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {kits.map((k) => (
                <tr key={k.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium">{k.nombre}</td>
                  <td className="px-4 py-3 font-mono text-gray-500">{k.sku || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{k.costo != null ? formatPYG(k.costo) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{k.precio != null ? formatPYG(k.precio) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {k.margen != null ? `${(k.margen * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">{k.items?.length || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${k.activo !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {k.activo !== false ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditKit(k); setShowModal(true) }} className="btn-ghost p-1"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(k.id)} className="btn-ghost p-1 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <KitFormModal kit={editKit} onClose={() => { setShowModal(false); setEditKit(null) }} onSaved={() => { setShowModal(false); setEditKit(null); load() }} />}
    </div>
  )
}

function KitFormModal({ kit, onClose, onSaved }: { kit?: Kit | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nombre: kit?.nombre || "", descripcion: kit?.descripcion || "",
    sku: kit?.sku || "", precio: kit?.precio || 0, costo: kit?.costo || 0,
  })
  const [items, setItems] = useState<{ producto_id: string; cantidad: number; precio_unitario: number; producto_nombre?: string }[]>(
    kit?.items?.map(i => ({ producto_id: i.producto_id || "", cantidad: i.cantidad || 1, precio_unitario: i.precio_unitario || 0, producto_nombre: i.producto?.nombre })) || []
  )
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [searchIdx, setSearchIdx] = useState<number | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (productSearch.length < 2) { setProducts([]); return }
    const timer = setTimeout(() => {
      api.products.list({ search: productSearch }).then(setProducts).catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch])

  async function handleSubmit() {
    if (!form.nombre) { toast.error("Error", "Nombre del kit es requerido"); return }
    setSaving(true)
    try {
      const payload = { ...form, items: items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario })) }
      if (kit) {
        await api.kits.update(kit.id, payload)
        toast.success("Actualizado", "Kit actualizado correctamente")
      } else {
        await api.kits.create(payload)
        toast.success("Creado", "Kit creado correctamente")
      }
      onSaved()
    } catch { toast.error("Error", "No se pudo guardar el kit") }
    finally { setSaving(false) }
  }

  function addItem() {
    setItems([...items, { producto_id: "", cantidad: 1, precio_unitario: 0 }])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{kit ? "Editar Kit" : "Nuevo Kit"}</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nombre *</label>
            <input className="input-field w-full" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">SKU</label>
            <input className="input-field w-full" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Descripción</label>
            <textarea className="input-field w-full" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Costo</label>
            <input className="input-field w-full" type="number" value={form.costo} onChange={(e) => setForm({ ...form, costo: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Precio</label>
            <input className="input-field w-full" type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: parseFloat(e.target.value) || 0 })} /></div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Items ({items.length})</h4>
            <button onClick={addItem} className="text-sm text-primary font-medium">+ Agregar producto</button>
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1 relative">
                  <input className="input-field w-full" placeholder="Buscar producto..." value={searchIdx === idx ? productSearch : item.producto_nombre || item.producto_id}
                    onChange={(e) => { setSearchIdx(idx); setProductSearch(e.target.value) }} onFocus={() => setSearchIdx(idx)} />
                  {searchIdx === idx && products.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-700 border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {products.map((p) => (
                        <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600"
                          onClick={() => { const n = [...items]; n[idx] = { ...n[idx], producto_id: p.id, producto_nombre: p.nombre, precio_unitario: p.precio || 0 }; setItems(n); setSearchIdx(null); setProductSearch("") }}>
                          {p.nombre} — {formatPYG(p.precio || 0)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input className="input-field w-20" type="number" placeholder="Cant" value={item.cantidad}
                  onChange={(e) => { const n = [...items]; n[idx].cantidad = parseInt(e.target.value) || 1; setItems(n) }} />
                <input className="input-field w-28" type="number" placeholder="P. Unit" value={item.precio_unitario}
                  onChange={(e) => { const n = [...items]; n[idx].precio_unitario = parseFloat(e.target.value) || 0; setItems(n) }} />
                {items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 p-2"><X className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end text-sm text-gray-500 mt-2">
          Subtotal items: <span className="font-bold ml-1">{formatPYG(items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0))}</span>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? <Spinner /> : kit ? "Actualizar" : "Crear Kit"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== CALCULAR PRECIO ====================
function CalcularPrecioTab() {
  const [kits, setKits] = useState<Kit[]>([])
  const [selectedKitId, setSelectedKitId] = useState("")
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    api.kits.list()
      .then(setKits)
      .catch(() => toast.error("Error", "No se pudieron cargar los kits"))
      .finally(() => setLoading(false))
  }, [])

  const selectedKit = selectedKitId ? kits.find(k => k.id === selectedKitId) : null

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Seleccionar Kit</label>
        <select className="input-field w-full max-w-md" value={selectedKitId} onChange={(e) => setSelectedKitId(e.target.value)}>
          <option value="">Seleccionar un kit...</option>
          {kits.map((k) => (
            <option key={k.id} value={k.id}>{k.nombre} {k.sku ? `(${k.sku})` : ""}</option>
          ))}
        </select>
      </div>

      {selectedKit && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="font-semibold text-gray-900 dark:text-white">{selectedKit.nombre}</p>
            {selectedKit.descripcion && <p className="text-xs text-gray-400">{selectedKit.descripcion}</p>}
          </div>

          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-right px-4 py-3">Cantidad</th>
                <th className="text-right px-4 py-3">P. Unitario</th>
                <th className="text-right px-4 py-3">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(selectedKit.items || []).map((item, idx) => (
                <tr key={item.id || idx} className="text-sm">
                  <td className="px-4 py-3 font-medium">{item.producto?.nombre || item.producto_id}</td>
                  <td className="px-4 py-3 text-right">{item.cantidad}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatPYG(item.precio_unitario || 0)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatPYG((item.cantidad || 0) * (item.precio_unitario || 0))}</td>
                </tr>
              ))}
              {(selectedKit.items || []).length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Sin items en este kit</td></tr>
              )}
            </tbody>
          </table>

          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Suma de items</span>
              <span className="font-mono font-bold">{formatPYG((selectedKit.items || []).reduce((s, i) => s + (i.cantidad || 0) * (i.precio_unitario || 0), 0))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Costo registrado</span>
              <span className="font-mono">{selectedKit.costo != null ? formatPYG(selectedKit.costo) : "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Precio registrado</span>
              <span className="font-mono font-bold">{selectedKit.precio != null ? formatPYG(selectedKit.precio) : "—"}</span>
            </div>
            {selectedKit.margen != null && (
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-gray-500">Margen</span>
                <span className="font-bold text-green-600">{(selectedKit.margen * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedKitId && (
        <div className="text-center py-16 text-gray-400">
          <Calculator className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">Seleccioná un kit</p>
          <p className="text-sm">Elegí un kit para ver el desglose de su precio</p>
        </div>
      )}
    </div>
  )
}
