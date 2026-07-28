import { useState, useEffect } from "react"
import { ClipboardList, TrendingUp, Search, Plus, AlertTriangle, Coins, Settings, Trash2, X, Loader2 } from "lucide-react"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"

interface ReplenishItem {
  id: string
  producto: string
  sku: string
  proveedor: string
  stockActual: number
  stockSeguridad: number
  velocidadVenta: number
  leadTime: number
  sugerido: number
  costoUnitario: number
  prioridad: "Alta" | "Media" | "Baja"
}

interface ReplenishRule {
  id: string
  product_id: string
  warehouse_id: string
  stock_minimo: number
  stock_seguridad: number
  cantidad_reorden: number | null
  lead_time_dias: number
  supplier_id: string | null
}

// Las sugerencias se calculan en el backend cruzando stock real, velocidad de
// venta real (ultimos 30 dias) y las reglas configuradas abajo — no hay datos
// inventados. Si no hay reglas configuradas para ningun producto, la tabla
// queda vacia: es esperable, significa que todavia no se definieron umbrales.
export default function AutoReplenishPage() {
  const [tab, setTab] = useState<"sugerencias" | "reglas">("sugerencias")
  const [items, setItems] = useState<ReplenishItem[]>([])
  const [rules, setRules] = useState<ReplenishRule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const toast = useToast()

  const fetchSuggestions = () => {
    setLoading(true)
    api.advancedInventory.replenishSuggestions()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  const fetchRules = () => {
    api.advancedInventory.replenishRules.list()
      .then(setRules)
      .catch(() => setRules([]))
  }

  useEffect(() => { fetchSuggestions(); fetchRules() }, [])

  const handleDeleteRule = async (id: string) => {
    try {
      await api.advancedInventory.replenishRules.delete(id)
      toast.success("Regla eliminada")
      fetchRules()
      fetchSuggestions()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo eliminar la regla")
    }
  }

  const filteredItems = items.filter(item =>
    item.producto.toLowerCase().includes(search.toLowerCase()) ||
    item.sku.toLowerCase().includes(search.toLowerCase()) ||
    item.proveedor.toLowerCase().includes(search.toLowerCase())
  )

  const highPriorityCount = items.filter(i => i.prioridad === "Alta" && i.sugerido > 0).length
  const totalSuggestedCost = items.reduce((sum, i) => sum + i.costoUnitario * i.sugerido, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Reabastecimiento Automático
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cruza stock actual, velocidad de venta real y lead time del proveedor contra los umbrales que configures.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(["sugerencias", "reglas"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-px ${tab === t ? "text-primary border-primary" : "text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            {t === "sugerencias" ? "Sugerencias" : "Reglas de Reposición"}
          </button>
        ))}
      </div>

      {tab === "sugerencias" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Críticos (Alta Prioridad)</span>
              </div>
              <p className="text-2xl font-bold text-amber-500">{highPriorityCount} productos</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <Coins className="w-5 h-5 text-green-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Inversión Sugerida Total</span>
              </div>
              <p className="text-2xl font-bold text-green-500">{formatPYG(totalSuggestedCost)}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <Settings className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reglas Configuradas</span>
              </div>
              <p className="text-2xl font-bold text-primary">{rules.length}</p>
            </div>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input-field pl-10"
              placeholder="Buscar por producto, SKU o proveedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="p-3">Producto / SKU</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3 text-right">Stock Actual</th>
                  <th className="p-3 text-right">Stock Seguridad</th>
                  <th className="p-3 text-right">Vel. Venta (día)</th>
                  <th className="p-3 text-right">Lead Time</th>
                  <th className="p-3 text-right">Sugerido Compra</th>
                  <th className="p-3 text-right">Costo Estimado</th>
                  <th className="p-3">Prioridad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                    {rules.length === 0 ? "Sin reglas configuradas todavía — andá a la pestaña Reglas para definir umbrales por producto." : "Sin sugerencias — todo el stock está por encima del mínimo configurado."}
                  </td></tr>
                ) : filteredItems.map(item => (
                  <tr key={item.id} className="table-row">
                    <td className="p-3">
                      <div className="font-semibold text-gray-900 dark:text-white">{item.producto}</div>
                      <div className="font-mono text-[10px] text-primary">{item.sku}</div>
                    </td>
                    <td className="p-3 font-medium text-gray-600 dark:text-gray-300">{item.proveedor}</td>
                    <td className="p-3 text-right font-mono font-bold">{item.stockActual}</td>
                    <td className="p-3 text-right font-mono text-gray-400">{item.stockSeguridad}</td>
                    <td className="p-3 text-right font-mono font-bold text-gray-700 dark:text-gray-200">+{item.velocidadVenta} /d</td>
                    <td className="p-3 text-right font-mono text-gray-500">{item.leadTime} días</td>
                    <td className="p-3 text-right font-mono font-bold text-primary text-sm bg-primary/5">
                      {item.sugerido > 0 ? `${item.sugerido} uds` : "Abastecido"}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {item.sugerido > 0 ? formatPYG(item.costoUnitario * item.sugerido) : formatPYG(0)}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.prioridad === "Alta" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        item.prioridad === "Media" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {item.prioridad}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            Para generar la orden de compra a partir de una sugerencia, andá a Gestión de Compras y cargala manualmente con estos datos — la generación automática de órdenes todavía no está conectada.
          </p>
        </>
      )}

      {tab === "reglas" && <ReglasTab rules={rules} onDelete={handleDeleteRule} onCreated={() => { fetchRules(); fetchSuggestions() }} />}
    </div>
  )
}

function ReglasTab({ rules, onDelete, onCreated }: { rules: ReplenishRule[]; onDelete: (id: string) => void; onCreated: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [products, setProducts] = useState<{ id: string; nombre: string; sku: string }[]>([])
  const [warehouses, setWarehouses] = useState<{ id: string; nombre: string }[]>([])
  const [suppliers, setSuppliers] = useState<{ id: string; razon_social: string }[]>([])
  const [prodSearch, setProdSearch] = useState("")
  const [form, setForm] = useState({
    product_id: "", product_label: "", warehouse_id: "", supplier_id: "",
    stock_minimo: "", stock_seguridad: "", cantidad_reorden: "", lead_time_dias: "3",
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!showForm) return
    api.warehouses.list().then((d: any[]) => setWarehouses(d)).catch(() => setWarehouses([]))
    api.purchases.suppliers().then((d: any[]) => setSuppliers(d)).catch(() => setSuppliers([]))
  }, [showForm])

  useEffect(() => {
    if (!showForm) return
    const t = setTimeout(() => {
      api.products.list({ search: prodSearch || undefined, activo: true })
        .then((data: any[]) => setProducts(data.map(p => ({ id: p.id, nombre: p.nombre, sku: p.sku }))))
        .catch(() => setProducts([]))
    }, 250)
    return () => clearTimeout(t)
  }, [prodSearch, showForm])

  const resetForm = () => setForm({ product_id: "", product_label: "", warehouse_id: "", supplier_id: "", stock_minimo: "", stock_seguridad: "", cantidad_reorden: "", lead_time_dias: "3" })

  const handleSave = async () => {
    if (!form.product_id || !form.warehouse_id || !form.stock_minimo) {
      toast.error("Faltan datos", "Producto, almacén y stock mínimo son obligatorios.")
      return
    }
    setSaving(true)
    try {
      await api.advancedInventory.replenishRules.create({
        product_id: form.product_id,
        warehouse_id: form.warehouse_id,
        stock_minimo: Number(form.stock_minimo),
        stock_seguridad: form.stock_seguridad ? Number(form.stock_seguridad) : 0,
        cantidad_reorden: form.cantidad_reorden ? Number(form.cantidad_reorden) : undefined,
        lead_time_dias: form.lead_time_dias ? Number(form.lead_time_dias) : 3,
        supplier_id: form.supplier_id || undefined,
      })
      toast.success("Regla creada")
      setShowForm(false)
      resetForm()
      onCreated()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo crear la regla")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva Regla
        </button>
      </div>

      <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="p-3">Stock Mínimo</th>
              <th className="p-3">Stock Seguridad</th>
              <th className="p-3">Cantidad Reorden</th>
              <th className="p-3">Lead Time</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rules.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Sin reglas configuradas — creá la primera con "Nueva Regla".</td></tr>
            ) : rules.map(r => (
              <tr key={r.id} className="table-row">
                <td className="p-3 font-mono">{r.stock_minimo}</td>
                <td className="p-3 font-mono text-gray-400">{r.stock_seguridad}</td>
                <td className="p-3 font-mono">{r.cantidad_reorden ?? "Auto"}</td>
                <td className="p-3 font-mono">{r.lead_time_dias} días</td>
                <td className="p-3 text-right">
                  <button onClick={() => onDelete(r.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Nueva Regla de Reposición</h3>
              <button onClick={() => { setShowForm(false); resetForm() }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div>
              <label className="input-label label-required">Producto</label>
              <input className="input-field" placeholder="Buscar producto..." value={form.product_label || prodSearch}
                onChange={e => { setProdSearch(e.target.value); setForm(f => ({ ...f, product_id: "", product_label: "" })) }} />
              {prodSearch && !form.product_id && (
                <div className="mt-1 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  {products.map(p => (
                    <button key={p.id} type="button" className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary/10"
                      onClick={() => { setForm(f => ({ ...f, product_id: p.id, product_label: p.nombre })); setProdSearch("") }}>
                      {p.nombre} <span className="text-gray-400 font-mono">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="input-label label-required">Almacén</label>
              <select className="input-field" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="input-label">Proveedor</label>
              <select className="input-field" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">Sin proveedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.razon_social}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label label-required">Stock Mínimo</label>
                <input type="number" className="input-field" value={form.stock_minimo} onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Stock Seguridad</label>
                <input type="number" className="input-field" value={form.stock_seguridad} onChange={e => setForm(f => ({ ...f, stock_seguridad: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Cantidad Reorden (fija)</label>
                <input type="number" className="input-field" placeholder="Auto por velocidad" value={form.cantidad_reorden} onChange={e => setForm(f => ({ ...f, cantidad_reorden: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Lead Time (días)</label>
                <input type="number" className="input-field" value={form.lead_time_dias} onChange={e => setForm(f => ({ ...f, lead_time_dias: e.target.value }))} />
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear Regla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
