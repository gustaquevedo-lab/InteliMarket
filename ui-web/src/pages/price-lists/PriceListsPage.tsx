import { useState, useEffect } from "react"
import {
  LayoutDashboard, List, Package, Search, Plus, X, Loader2, RefreshCw,
  Pencil, Trash2, DollarSign, Hash, Tag,
  type LucideIcon,
} from "lucide-react"
import { api, type PriceList, type PriceListItem, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type TabKey = "dashboard" | "lists" | "items"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard",       icon: LayoutDashboard },
  { key: "lists",     label: "Listas de Precios", icon: List },
  { key: "items",     label: "Items",            icon: Package },
]

export default function PriceListsPage() {
  const [tab, setTab] = useState<TabKey>("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Listas de Precios</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de listas de precios, descuentos y asignaciones</p>
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
      {tab === "lists"     && <ListsTab />}
      {tab === "items"     && <ItemsTab />}
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
  const [lists, setLists] = useState<PriceList[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.priceLists.list()
      .then(setLists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  const activeLists = lists.filter(l => l.activo !== false)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Tag} label="Total Listas" value={lists.length} color="blue" />
        <KpiCard icon={Tag} label="Listas Activas" value={activeLists.length} color="green" />
      </div>
    </div>
  )
}

// ==================== LISTAS DE PRECIOS ====================
function ListsTab() {
  const [lists, setLists] = useState<PriceList[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editList, setEditList] = useState<PriceList | null>(null)
  const toast = useToast()

  async function load() {
    setLoading(true)
    try {
      const data = await api.priceLists.list()
      setLists(data)
    } catch { toast.error("Error", "No se pudieron cargar las listas") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(listId: string) {
    try {
      await api.priceLists.delete(listId)
      toast.success("Eliminada", "Lista eliminada correctamente")
      load()
    } catch { toast.error("Error", "No se pudo eliminar la lista") }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva Lista</button>
        <button onClick={load} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : lists.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Tag className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">No hay listas de precios</p></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Dto. Gral</th>
                <th className="text-left px-4 py-3">Vigencia</th>
                <th className="text-center px-4 py-3">Activo</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {lists.map((l) => (
                <tr key={l.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium">{l.nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{l.tipo || "—"}</td>
                  <td className="px-4 py-3 text-right">{l.descuento_general != null ? `${l.descuento_general}%` : "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {l.fecha_inicio ? new Date(l.fecha_inicio).toLocaleDateString("es-PY") : "—"}
                    {l.fecha_fin ? ` → ${new Date(l.fecha_fin).toLocaleDateString("es-PY")}` : ""}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${l.activo !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {l.activo !== false ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditList(l); setShowModal(true) }} className="btn-ghost p-1"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(l.id)} className="btn-ghost p-1 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <ListFormModal list={editList} onClose={() => { setShowModal(false); setEditList(null) }} onSaved={() => { setShowModal(false); setEditList(null); load() }} />}
    </div>
  )
}

function ListFormModal({ list, onClose, onSaved }: { list?: PriceList | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nombre: list?.nombre || "", descripcion: list?.descripcion || "",
    tipo: list?.tipo || "", descuento_general: list?.descuento_general || 0,
    fecha_inicio: list?.fecha_inicio ? list.fecha_inicio.slice(0, 10) : "",
    fecha_fin: list?.fecha_fin ? list.fecha_fin.slice(0, 10) : "",
    activo: list?.activo !== false,
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.nombre) { toast.error("Error", "Nombre es requerido"); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        fecha_inicio: form.fecha_inicio || undefined,
        fecha_fin: form.fecha_fin || undefined,
      }
      if (list) {
        await api.priceLists.update(list.id, payload)
        toast.success("Actualizada", "Lista actualizada correctamente")
      } else {
        await api.priceLists.create(payload)
        toast.success("Creada", "Lista creada correctamente")
      }
      onSaved()
    } catch { toast.error("Error", "No se pudo guardar la lista") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{list ? "Editar Lista" : "Nueva Lista de Precios"}</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nombre *</label>
            <input className="input-field w-full" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Descripción</label>
            <textarea className="input-field w-full" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Tipo</label>
            <select className="input-field w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="">General</option>
              <option value="mayorista">Mayorista</option>
              <option value="distribuidor">Distribuidor</option>
              <option value="promocional">Promocional</option>
              <option value="especial">Especial</option>
            </select></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Dto. General %</label>
            <input className="input-field w-full" type="number" value={form.descuento_general} onChange={(e) => setForm({ ...form, descuento_general: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Fecha Inicio</label>
            <input className="input-field w-full" type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Fecha Fin</label>
            <input className="input-field w-full" type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} /></div>
          <div className="col-span-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="rounded" />Activo</label></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? <Spinner /> : list ? "Actualizar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== ITEMS ====================
function ItemsTab() {
  const [lists, setLists] = useState<PriceList[]>([])
  const [selectedListId, setSelectedListId] = useState("")
  const [items, setItems] = useState<PriceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<PriceListItem | null>(null)
  const toast = useToast()

  useEffect(() => {
    api.priceLists.list()
      .then(setLists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function loadItems(listId: string) {
    setLoading(true)
    try {
      const data = await api.priceLists.items(listId)
      setItems(data)
    } catch { toast.error("Error", "No se pudieron cargar los items") }
    finally { setLoading(false) }
  }

  function onListChange(listId: string) {
    setSelectedListId(listId)
    if (listId) loadItems(listId)
    else setItems([])
  }

  async function handleRemoveItem(itemId: string) {
    try {
      await api.priceLists.removeItem(selectedListId, itemId)
      toast.success("Eliminado", "Item eliminado de la lista")
      loadItems(selectedListId)
    } catch { toast.error("Error", "No se pudo eliminar el item") }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Seleccionar Lista de Precios</label>
        <div className="flex gap-3">
          <select className="input-field flex-1 max-w-md" value={selectedListId} onChange={(e) => onListChange(e.target.value)}>
            <option value="">Seleccionar lista...</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre} {l.tipo ? `(${l.tipo})` : ""}</option>
            ))}
          </select>
          {selectedListId && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar Item</button>
          )}
        </div>
      </div>

      {selectedListId ? (
        loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><Package className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">Sin items en esta lista</p></div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-3">Producto</th>
                  <th className="text-right px-4 py-3">Precio</th>
                  <th className="text-right px-4 py-3">Descuento</th>
                  <th className="text-right px-4 py-3">Margen</th>
                  <th className="text-center px-4 py-3">Activo</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map((item) => (
                  <tr key={item.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium">{item.producto?.nombre || item.producto_id}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{item.precio != null ? formatPYG(item.precio) : "—"}</td>
                    <td className="px-4 py-3 text-right">{item.descuento != null ? `${item.descuento}%` : "—"}</td>
                    <td className="px-4 py-3 text-right">{item.margen != null ? `${(item.margen * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${item.activo !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {item.activo !== false ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setEditItem(item); setShowModal(true) }} className="btn-ghost p-1"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleRemoveItem(item.id)} className="btn-ghost p-1 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="text-center py-16 text-gray-400">
          <List className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">Seleccioná una lista</p>
          <p className="text-sm">Elegí una lista de precios para ver sus items</p>
        </div>
      )}

      {showModal && selectedListId && (
        <ItemFormModal listId={selectedListId} item={editItem}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSaved={() => { setShowModal(false); setEditItem(null); loadItems(selectedListId) }} />
      )}
    </div>
  )
}

function ItemFormModal({ listId, item, onClose, onSaved }: { listId: string; item?: PriceListItem | null; onClose: () => void; onSaved: () => void }) {
  const [productSearch, setProductSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState(item?.producto_id || "")
  const [productName, setProductName] = useState(item?.producto?.nombre || "")
  const [form, setForm] = useState({
    precio: item?.precio || 0, descuento: item?.descuento || 0, margen: item?.margen || 0,
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (productSearch.length < 2) { setProducts([]); return }
    const timer = setTimeout(() => {
      api.products.list({ search: productSearch }).then(setProducts).catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch])

  async function handleSubmit() {
    if (!productId) { toast.error("Error", "Seleccioná un producto"); return }
    setSaving(true)
    try {
      if (item) {
        await api.priceLists.updateItem(listId, item.id, { ...form, producto_id: productId })
        toast.success("Actualizado", "Item actualizado correctamente")
      } else {
        await api.priceLists.addItem(listId, { ...form, producto_id: productId })
        toast.success("Agregado", "Item agregado a la lista")
      }
      onSaved()
    } catch { toast.error("Error", "No se pudo guardar el item") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{item ? "Editar Item" : "Agregar Item"}</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Producto</label>
            <input className="input-field w-full" placeholder="Buscar producto..." value={productId && !productSearch ? productName : productSearch}
              onChange={(e) => { setProductSearch(e.target.value); if (!e.target.value) { setProductId(""); setProductName("") } }} />
            {products.length > 0 && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-700 border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {products.map((p) => (
                  <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600"
                    onClick={() => { setProductId(p.id); setProductName(p.nombre); setProductSearch(p.nombre); setProducts([]) }}>
                    {p.nombre} — {formatPYG(p.precio || 0)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Precio</label>
            <input className="input-field w-full" type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Descuento %</label>
            <input className="input-field w-full" type="number" step="0.1" value={form.descuento} onChange={(e) => setForm({ ...form, descuento: parseFloat(e.target.value) || 0 })} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Margen</label>
            <input className="input-field w-full" type="number" step="0.01" value={form.margen} onChange={(e) => setForm({ ...form, margen: parseFloat(e.target.value) || 0 })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? <Spinner /> : item ? "Actualizar" : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  )
}
