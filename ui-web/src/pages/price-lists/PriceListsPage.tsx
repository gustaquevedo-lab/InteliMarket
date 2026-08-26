import { useState, useEffect } from "react"
import {
  LayoutDashboard, List, Package, Users, Layers, Plus, X, Loader2, RefreshCw,
  Pencil, Trash2, Tag,
  type LucideIcon,
} from "lucide-react"
import { api, COMPANY_ID, type PriceList, type PriceListItem, type Product, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type TabKey = "dashboard" | "lists" | "items" | "assignments" | "tiers"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard",   label: "Dashboard",           icon: LayoutDashboard },
  { key: "lists",       label: "Listas de Precios",   icon: List },
  { key: "items",       label: "Items",               icon: Package },
  { key: "assignments", label: "Asignaciones",        icon: Users },
  { key: "tiers",       label: "Precios por Escalón", icon: Layers },
]

export default function PriceListsPage() {
  const [tab, setTab] = useState<TabKey>("dashboard")
  const [lists, setLists] = useState<PriceList[]>([])

  async function loadLists() {
    try { setLists(await api.priceLists.list()) } catch { /* silencioso, cada tab maneja su propio error */ }
  }
  useEffect(() => { loadLists() }, [])

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-3"><List className="w-7 h-7 text-blue-600 dark:text-blue-400 shrink-0" /> Listas de Precios</h1>
          <p className="text-sm text-gray-500 mt-1">Listas de precios, asignaciones por cliente/grupo y precios por escalón de cantidad</p>
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

      {tab === "dashboard"    && <DashboardTab lists={lists} />}
      {tab === "lists"        && <ListsTab lists={lists} reload={loadLists} />}
      {tab === "items"        && <ItemsTab lists={lists} />}
      {tab === "assignments"  && <AssignmentsTab lists={lists} />}
      {tab === "tiers"        && <TieredPricesTab lists={lists} />}
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
  const borderColors: Record<string, string> = {
    blue: "border-l-blue-500", green: "border-l-green-500", red: "border-l-red-500",
    yellow: "border-l-yellow-500", purple: "border-l-purple-500", indigo: "border-l-indigo-500", pink: "border-l-pink-500",
  }
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 border-l-4 ${borderColors[color] || borderColors.blue} p-4 hover:-translate-y-0.5 transition-all`}>
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

// ==================== BÚSQUEDA DEBOUNCED REUTILIZABLE (producto / cliente) ====================
function useDebouncedSearch<T>(searchFn: (q: string) => Promise<T[]>, query: string, minLen = 2, delayMs = 300) {
  const [results, setResults] = useState<T[]>([])
  useEffect(() => {
    if (query.trim().length < minLen) { setResults([]); return }
    const timer = setTimeout(() => {
      searchFn(query).then(setResults).catch(() => setResults([]))
    }, delayMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
  return results
}

function ProductPicker({ productId, productLabel, onChange }: { productId: string; productLabel: string; onChange: (id: string, label: string) => void }) {
  const [search, setSearch] = useState("")
  const results = useDebouncedSearch<Product>((q) => api.products.list({ search: q }), search)
  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Producto</label>
      <input className="input-field w-full" placeholder="Buscar producto..." value={productId && !search ? productLabel : search}
        onChange={(e) => { setSearch(e.target.value); if (!e.target.value) onChange("", "") }} />
      {results.length > 0 && (
        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-700 border rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {results.map((p) => (
            <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600"
              onClick={() => { onChange(p.id, p.nombre); setSearch("") }}>
              {p.nombre} — {formatPYG(p.precio || 0)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerPicker({ customerId, customerLabel, onChange }: { customerId: string; customerLabel: string; onChange: (id: string, label: string) => void }) {
  const [search, setSearch] = useState("")
  const results = useDebouncedSearch<Customer>((q) => api.customers.list({ search: q }), search)
  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cliente</label>
      <input className="input-field w-full" placeholder="Buscar cliente..." value={customerId && !search ? customerLabel : search}
        onChange={(e) => { setSearch(e.target.value); if (!e.target.value) onChange("", "") }} />
      {results.length > 0 && (
        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-700 border rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {results.map((c) => (
            <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600"
              onClick={() => { onChange(c.id, resolveCustomerLabel(c)); setSearch("") }}>
              {resolveCustomerLabel(c)} {c.ruc ? `— RUC ${c.ruc}` : c.ci ? `— CI ${c.ci}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// El backend de clientes reales no siempre manda "nombre" -- usa razon_social /
// nombre_fantasia (mismo quirk ya documentado en POSPage.tsx).
function resolveCustomerLabel(c: Customer): string {
  return c.nombre || (c as any).nombre_fantasia || c.razon_social || "Sin nombre"
}

// Campo condicional por `tipo`: cliente -> picker de cliente, texto libre -> input, sin referencia -> nada.
function TipoRefFields({
  tipo, refId, refLabel, onRefChange, freeTextTypes, freeTextPlaceholders,
}: {
  tipo: string
  refId: string
  refLabel: string
  onRefChange: (id: string, label: string) => void
  freeTextTypes: string[]
  freeTextPlaceholders: Record<string, string>
}) {
  if (tipo === "cliente") {
    return <CustomerPicker customerId={refId} customerLabel={refLabel} onChange={onRefChange} />
  }
  if (freeTextTypes.includes(tipo)) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{freeTextPlaceholders[tipo] || "Referencia"}</label>
        <input className="input-field w-full" value={refId} onChange={(e) => onRefChange(e.target.value, e.target.value)}
          placeholder={freeTextPlaceholders[tipo] || ""} />
      </div>
    )
  }
  return null
}

// ==================== DASHBOARD ====================
function DashboardTab({ lists }: { lists: PriceList[] }) {
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
function ListsTab({ lists, reload }: { lists: PriceList[]; reload: () => void }) {
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editList, setEditList] = useState<PriceList | null>(null)
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({})
  const toast = useToast()

  async function load() {
    setLoading(true)
    try { await reload() } catch { toast.error("Error", "No se pudieron cargar las listas") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ids = Array.from(new Set(lists.filter(l => l.tipo === "cliente" && l.customer_id).map(l => l.customer_id as string)))
    const missing = ids.filter(id => !(id in customerNames))
    if (missing.length === 0) return
    Promise.all(missing.map(id => api.customers.get(id).then(c => [id, resolveCustomerLabel(c)] as const).catch(() => [id, id] as const)))
      .then(pairs => setCustomerNames(prev => ({ ...prev, ...Object.fromEntries(pairs) })))
  }, [lists]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <button onClick={() => { setEditList(null); setShowModal(true) }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva Lista</button>
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
                <th className="text-left px-4 py-3">Cliente / Grupo</th>
                <th className="text-center px-4 py-3">Activo</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {lists.map((l) => (
                <tr key={l.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium">{l.nombre}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{l.tipo || "general"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {l.tipo === "cliente" && l.customer_id ? (customerNames[l.customer_id] || "…") : l.tipo === "grupo" ? l.grupo : "—"}
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
  const [nombre, setNombre] = useState(list?.nombre || "")
  const [tipo, setTipo] = useState(list?.tipo || "general")
  const [customerId, setCustomerId] = useState(list?.customer_id || "")
  const [customerLabel, setCustomerLabel] = useState("")
  const [grupo, setGrupo] = useState(list?.grupo || "")
  const [activo, setActivo] = useState(list?.activo !== false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  // Precargar el nombre del cliente al editar una lista tipo=cliente -- el
  // backend solo guarda el customer_id, no el nombre.
  useEffect(() => {
    if (list?.tipo === "cliente" && list.customer_id) {
      api.customers.get(list.customer_id).then(c => setCustomerLabel(resolveCustomerLabel(c))).catch(() => {})
    }
  }, [list])

  function handleTipoChange(next: string) {
    setTipo(next)
    setCustomerId(""); setCustomerLabel(""); setGrupo("")
  }

  async function handleSubmit() {
    if (!nombre.trim()) { toast.error("Error", "Nombre es requerido"); return }
    if (tipo === "cliente" && !customerId) { toast.error("Error", "Elegí un cliente para una lista de tipo cliente"); return }
    if (tipo === "grupo" && !grupo.trim()) { toast.error("Error", "Ingresá el nombre del grupo"); return }
    setSaving(true)
    try {
      const payload = {
        nombre,
        tipo,
        customer_id: tipo === "cliente" ? customerId : null,
        grupo: tipo === "grupo" ? grupo : null,
        activo,
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
        <div className="space-y-4">
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nombre *</label>
            <input className="input-field w-full" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Tipo</label>
            <select className="input-field w-full" value={tipo} onChange={(e) => handleTipoChange(e.target.value)}>
              <option value="general">General</option>
              <option value="grupo">Grupo</option>
              <option value="cliente">Cliente</option>
            </select></div>
          <TipoRefFields
            tipo={tipo} refId={tipo === "cliente" ? customerId : grupo} refLabel={customerLabel}
            onRefChange={(id, label) => { if (tipo === "cliente") { setCustomerId(id); setCustomerLabel(label) } else { setGrupo(id) } }}
            freeTextTypes={["grupo"]} freeTextPlaceholders={{ grupo: "Nombre del grupo" }}
          />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="rounded" />Activo</label>
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
function ItemsTab({ lists }: { lists: PriceList[] }) {
  const [selectedListId, setSelectedListId] = useState("")
  const [items, setItems] = useState<PriceListItem[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<PriceListItem | null>(null)
  const toast = useToast()

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

  // El backend no expande el producto en la respuesta -- resolver nombre client-side.
  useEffect(() => {
    const ids = Array.from(new Set(items.filter(i => i.product_id).map(i => i.product_id as string)))
    const missing = ids.filter(id => !(id in productNames))
    if (missing.length === 0) return
    Promise.all(missing.map(id => api.products.get(id).then(p => [id, p.nombre] as const).catch(() => [id, id] as const)))
      .then(pairs => setProductNames(prev => ({ ...prev, ...Object.fromEntries(pairs) })))
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

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
              <option key={l.id} value={l.id}>{l.nombre} {l.tipo && l.tipo !== "general" ? `(${l.tipo})` : ""}</option>
            ))}
          </select>
          {selectedListId && (
            <button onClick={() => { setEditItem(null); setShowModal(true) }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar Item</button>
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
                  <th className="text-left px-4 py-3">Notas</th>
                  <th className="text-center px-4 py-3">Activo</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map((item) => (
                  <tr key={item.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium">{item.product_id ? (productNames[item.product_id] || "…") : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{item.precio != null ? formatPYG(item.precio) : "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.notas || "—"}</td>
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
        <ItemFormModal listId={selectedListId} item={editItem} productNames={productNames}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSaved={() => { setShowModal(false); setEditItem(null); loadItems(selectedListId) }} />
      )}
    </div>
  )
}

function ItemFormModal({ listId, item, productNames, onClose, onSaved }: { listId: string; item?: PriceListItem | null; productNames: Record<string, string>; onClose: () => void; onSaved: () => void }) {
  const [productId, setProductId] = useState(item?.product_id || "")
  const [productLabel, setProductLabel] = useState(item?.product_id ? (productNames[item.product_id] || "") : "")
  const [precio, setPrecio] = useState(item?.precio || 0)
  const [notas, setNotas] = useState(item?.notas || "")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!productId) { toast.error("Error", "Seleccioná un producto"); return }
    if (precio <= 0) { toast.error("Error", "El precio debe ser mayor a cero"); return }
    setSaving(true)
    try {
      if (item) {
        await api.priceLists.updateItem(listId, item.id, { precio, notas })
        toast.success("Actualizado", "Item actualizado correctamente")
      } else {
        await api.priceLists.addItem(listId, { product_id: productId, precio, notas, moneda: "PYG" })
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
          {item ? (
            <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Producto</label>
              <p className="text-sm font-medium py-2">{productLabel || productId}</p></div>
          ) : (
            <ProductPicker productId={productId} productLabel={productLabel} onChange={(id, label) => { setProductId(id); setProductLabel(label) }} />
          )}
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Precio</label>
            <input className="input-field w-full" type="number" value={precio} onChange={(e) => setPrecio(parseFloat(e.target.value) || 0)} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Notas</label>
            <textarea className="input-field w-full" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
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

// ==================== ASIGNACIONES ====================
type Assignment = { id: string; company_id: string; price_list_id: string; tipo: string; ref_id: string; created_at: string }

const ASSIGNMENT_TIPOS: { value: string; label: string }[] = [
  { value: "cliente", label: "Cliente" },
  { value: "grupo", label: "Grupo" },
  { value: "canal", label: "Canal" },
  { value: "zona", label: "Zona" },
]
const ASSIGNMENT_PLACEHOLDERS: Record<string, string> = {
  grupo: "Nombre del grupo", canal: "Slug del canal", zona: "Nombre de la zona",
}

function AssignmentsTab({ lists }: { lists: PriceList[] }) {
  const [selectedListId, setSelectedListId] = useState("")
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const toast = useToast()

  async function loadAssignments(listId: string) {
    setLoading(true)
    try {
      const data = await api.smartPricing.listAssignments(COMPANY_ID, listId)
      setAssignments(data)
    } catch { toast.error("Error", "No se pudieron cargar las asignaciones") }
    finally { setLoading(false) }
  }

  function onListChange(listId: string) {
    setSelectedListId(listId)
    if (listId) loadAssignments(listId)
    else setAssignments([])
  }

  useEffect(() => {
    const ids = Array.from(new Set(assignments.filter(a => a.tipo === "cliente").map(a => a.ref_id)))
    const missing = ids.filter(id => !(id in customerNames))
    if (missing.length === 0) return
    Promise.all(missing.map(id => api.customers.get(id).then(c => [id, resolveCustomerLabel(c)] as const).catch(() => [id, id] as const)))
      .then(pairs => setCustomerNames(prev => ({ ...prev, ...Object.fromEntries(pairs) })))
  }, [assignments]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: string) {
    try {
      await api.smartPricing.deleteAssignment(id)
      toast.success("Eliminada", "Asignación eliminada")
      loadAssignments(selectedListId)
    } catch { toast.error("Error", "No se pudo eliminar la asignación") }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Seleccionar Lista de Precios</label>
        <div className="flex gap-3">
          <select className="input-field flex-1 max-w-md" value={selectedListId} onChange={(e) => onListChange(e.target.value)}>
            <option value="">Seleccionar lista...</option>
            {lists.map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
          </select>
          {selectedListId && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva Asignación</button>
          )}
        </div>
      </div>

      {selectedListId ? (
        loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><Users className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">Sin asignaciones para esta lista</p></div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Referencia</th>
                  <th className="text-left px-4 py-3">Creada</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {assignments.map((a) => (
                  <tr key={a.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 capitalize">{a.tipo}</td>
                    <td className="px-4 py-3 font-medium">{a.tipo === "cliente" ? (customerNames[a.ref_id] || "…") : a.ref_id}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{a.created_at ? new Date(a.created_at).toLocaleDateString("es-PY") : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(a.id)} className="btn-ghost p-1 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">Seleccioná una lista</p>
          <p className="text-sm">Elegí una lista de precios para ver y crear sus asignaciones</p>
        </div>
      )}

      {showModal && selectedListId && (
        <AssignmentFormModal listId={selectedListId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadAssignments(selectedListId) }} />
      )}
    </div>
  )
}

function AssignmentFormModal({ listId, onClose, onSaved }: { listId: string; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState("cliente")
  const [refId, setRefId] = useState("")
  const [refLabel, setRefLabel] = useState("")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  function handleTipoChange(next: string) {
    setTipo(next)
    setRefId(""); setRefLabel("")
  }

  async function handleSubmit() {
    if (!refId.trim()) { toast.error("Error", "Completá la referencia de la asignación"); return }
    setSaving(true)
    try {
      await api.smartPricing.createAssignment({ price_list_id: listId, tipo, ref_id: refId })
      toast.success("Creada", "Asignación creada correctamente")
      onSaved()
    } catch { toast.error("Error", "No se pudo crear la asignación") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Asignación</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Tipo</label>
            <select className="input-field w-full" value={tipo} onChange={(e) => handleTipoChange(e.target.value)}>
              {ASSIGNMENT_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>
          <TipoRefFields
            tipo={tipo} refId={refId} refLabel={refLabel}
            onRefChange={(id, label) => { setRefId(id); setRefLabel(label) }}
            freeTextTypes={["grupo", "canal", "zona"]} freeTextPlaceholders={ASSIGNMENT_PLACEHOLDERS}
          />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? <Spinner /> : "Crear"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== PRECIOS POR ESCALÓN ====================
type TieredPriceDto = {
  id: string; company_id: string; price_list_id: string | null; product_id: string
  min_qty: number; max_qty: number | null; precio_unitario: number; moneda: string; activo: boolean
}

function TieredPricesTab({ lists }: { lists: PriceList[] }) {
  const [productId, setProductId] = useState("")
  const [productLabel, setProductLabel] = useState("")
  const [priceListId, setPriceListId] = useState("") // "" = todas las listas (global)
  const [tiers, setTiers] = useState<TieredPriceDto[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTier, setEditTier] = useState<TieredPriceDto | null>(null)
  const toast = useToast()

  async function loadTiers() {
    if (!productId) return
    setLoading(true)
    try {
      const data = await api.smartPricing.listTieredPrices(COMPANY_ID, productId, priceListId || undefined)
      setTiers(data)
    } catch { toast.error("Error", "No se pudieron cargar los precios por escalón") }
    finally { setLoading(false) }
  }

  useEffect(() => { loadTiers() }, [productId, priceListId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: string) {
    try {
      await api.smartPricing.deleteTieredPrice(id)
      toast.success("Eliminado", "Precio por escalón eliminado")
      loadTiers()
    } catch { toast.error("Error", "No se pudo eliminar") }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <ProductPicker productId={productId} productLabel={productLabel} onChange={(id, label) => { setProductId(id); setProductLabel(label) }} />
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Lista de Precios</label>
          <select className="input-field w-full max-w-md" value={priceListId} onChange={(e) => setPriceListId(e.target.value)}>
            <option value="">Todas las listas (global)</option>
            {lists.map((l) => (<option key={l.id} value={l.id}>{l.nombre}</option>))}
          </select>
        </div>
        {productId && (
          <button onClick={() => { setEditTier(null); setShowModal(true) }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Escalón</button>
        )}
      </div>

      {!productId ? (
        <div className="text-center py-16 text-gray-400">
          <Layers className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">Seleccioná un producto</p>
          <p className="text-sm">Elegí un producto para ver o crear sus precios por escalón</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : tiers.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><Layers className="w-12 h-12 mx-auto mb-3" /><p className="text-sm font-bold">Sin precios por escalón para este producto</p></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-right px-4 py-3">Min. Cant.</th>
                <th className="text-right px-4 py-3">Max. Cant.</th>
                <th className="text-right px-4 py-3">Precio Unitario</th>
                <th className="text-center px-4 py-3">Activo</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {tiers.sort((a, b) => a.min_qty - b.min_qty).map((t) => (
                <tr key={t.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-right font-mono">{t.min_qty}</td>
                  <td className="px-4 py-3 text-right font-mono">{t.max_qty ?? "sin límite"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatPYG(t.precio_unitario)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${t.activo !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {t.activo !== false ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditTier(t); setShowModal(true) }} className="btn-ghost p-1"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(t.id)} className="btn-ghost p-1 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && productId && (
        <TieredPriceFormModal productId={productId} priceListId={priceListId || null} tier={editTier} existingTiers={tiers}
          onClose={() => { setShowModal(false); setEditTier(null) }}
          onSaved={() => { setShowModal(false); setEditTier(null); loadTiers() }} />
      )}
    </div>
  )
}

function TieredPriceFormModal({
  productId, priceListId, tier, existingTiers, onClose, onSaved,
}: {
  productId: string; priceListId: string | null; tier?: TieredPriceDto | null; existingTiers: TieredPriceDto[]
  onClose: () => void; onSaved: () => void
}) {
  const [minQty, setMinQty] = useState(tier?.min_qty ?? 1)
  const [maxQty, setMaxQty] = useState<string>(tier?.max_qty != null ? String(tier.max_qty) : "")
  const [precioUnitario, setPrecioUnitario] = useState(tier?.precio_unitario ?? 0)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  // Chequeo de solapamiento solo en el cliente -- el backend no lo valida hoy,
  // así que sigue siendo posible crear escalones solapados vía API directa.
  function overlaps(): boolean {
    const maxVal = maxQty.trim() ? parseInt(maxQty, 10) : Infinity
    return existingTiers
      .filter(t => t.id !== tier?.id)
      .some(t => {
        const tMax = t.max_qty ?? Infinity
        return minQty <= tMax && t.min_qty <= maxVal
      })
  }

  async function handleSubmit() {
    if (precioUnitario <= 0) { toast.error("Error", "El precio unitario debe ser mayor a cero"); return }
    if (maxQty.trim() && parseInt(maxQty, 10) < minQty) { toast.error("Error", "La cantidad máxima no puede ser menor a la mínima"); return }
    if (overlaps()) { toast.error("Rango solapado", "Este escalón se superpone con uno ya existente para este producto/lista"); return }
    setSaving(true)
    try {
      const maxQtyVal = maxQty.trim() ? parseInt(maxQty, 10) : null
      if (tier) {
        await api.smartPricing.updateTieredPrice(tier.id, { min_qty: minQty, max_qty: maxQtyVal, precio_unitario: precioUnitario })
        toast.success("Actualizado", "Precio por escalón actualizado")
      } else {
        await api.smartPricing.createTieredPrice({
          price_list_id: priceListId, product_id: productId,
          min_qty: minQty, max_qty: maxQtyVal, precio_unitario: precioUnitario, moneda: "PYG",
        })
        toast.success("Creado", "Precio por escalón creado")
      }
      onSaved()
    } catch { toast.error("Error", "No se pudo guardar el precio por escalón") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tier ? "Editar Escalón" : "Nuevo Escalón"}</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cantidad Mínima</label>
            <input className="input-field w-full" type="number" min={1} value={minQty} onChange={(e) => setMinQty(parseInt(e.target.value, 10) || 1)} /></div>
          <div><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cantidad Máxima</label>
            <input className="input-field w-full" type="number" placeholder="Sin límite" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} /></div>
          <div className="col-span-2"><label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Precio Unitario (₲)</label>
            <input className="input-field w-full" type="number" value={precioUnitario} onChange={(e) => setPrecioUnitario(parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? <Spinner /> : tier ? "Actualizar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  )
}
