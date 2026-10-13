import { useState, useEffect, useCallback } from "react"
import { Warehouse, PackageCheck, ClipboardList, Lightbulb, Loader2, Search, Plus, Trash2, CheckCircle2 } from "lucide-react"
import { api, type Warehouse as WarehouseType, type PurchaseOrder, type PurchaseSuggestion, type Product, type MobileDashboard } from "../../api"
import { useToast } from "../../context/ToastContext"

type Tab = "recepcion" | "conteo" | "sugerencias"

export default function DepositoPage() {
  const [tab, setTab] = useState<Tab>("recepcion")
  const [dashboard, setDashboard] = useState<MobileDashboard | null>(null)
  const toast = useToast()

  useEffect(() => {
    api.mobile.dashboard().then(setDashboard).catch(() => setDashboard(null))
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Depósito</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Recepción de remitos, conteo físico de inventario y sugerencias de compra pendientes</p>
      </div>

      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recepciones pendientes</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{dashboard.recepciones_pendientes}</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sugerencias pendientes</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{dashboard.sugerencias_pendientes}</p>
          </div>
          <div className="card p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Entregas hoy</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{dashboard.entregas_hoy}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700">
        {[
          { key: "recepcion" as Tab, label: "Recepción de remitos", icon: PackageCheck },
          { key: "conteo" as Tab, label: "Conteo de inventario", icon: ClipboardList },
          { key: "sugerencias" as Tab, label: "Sugerencias de compra", icon: Lightbulb },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition ${tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === "recepcion" && <RecepcionTab toast={toast} onDone={() => api.mobile.dashboard().then(setDashboard).catch(() => {})} />}
      {tab === "conteo" && <ConteoTab toast={toast} onDone={() => api.mobile.dashboard().then(setDashboard).catch(() => {})} />}
      {tab === "sugerencias" && <SugerenciasTab toast={toast} onDone={() => api.mobile.dashboard().then(setDashboard).catch(() => {})} />}
    </div>
  )
}

// ── Recepción de remitos ─────────────────────────────────────────────────

function RecepcionTab({ toast, onDone }: { toast: ReturnType<typeof useToast>; onDone: () => void }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [cantidades, setCantidades] = useState<Record<string, string>>({})
  const [bonificaciones, setBonificaciones] = useState<Record<string, string>>({})
  const [bonificacionesTocadas, setBonificacionesTocadas] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.purchases.listPOs()
      .then(list => setOrders(list.filter(o => o.estado === "confirmada" || o.estado === "parcial")))
      .catch(() => toast.error("Error", "No se pudieron cargar las órdenes de compra"))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openOrder = async (o: PurchaseOrder) => {
    try {
      const full = await api.purchases.getOrder(o.id)
      setSelected(full)
      setCantidades({})
      setBonificaciones({})
      setBonificacionesTocadas(new Set())
    } catch {
      toast.error("Error", "No se pudo cargar el detalle de la orden")
    }
  }

  // Al cargar una cantidad recibida, sugiere la bonificacion por volumen si
  // hay una escala cargada para este proveedor+producto (no pisa lo que el
  // usuario ya haya editado a mano).
  const onCantidadChange = async (key: string, productId: string, value: string) => {
    setCantidades(c => ({ ...c, [key]: value }))
    if (!selected?.supplier_id || !value || Number(value) <= 0 || bonificacionesTocadas.has(key)) return
    try {
      const sug = await api.purchaseBonuses.suggest(selected.supplier_id, productId, Number(value))
      if (sug.cantidad_bonificada_sugerida > 0) {
        setBonificaciones(b => ({ ...b, [key]: String(sug.cantidad_bonificada_sugerida) }))
      }
    } catch { /* sin escala cargada, no pasa nada */ }
  }

  const submit = async () => {
    if (!selected) return
    const items = (selected.items || [])
      .map((it: any) => {
        const key = it.id || it.product_id
        return {
          product_id: it.product_id || it.producto_id,
          cantidad_recibida: Number(cantidades[key] || 0),
          cantidad_bonificada: Number(bonificaciones[key] || 0),
        }
      })
      .filter(it => it.cantidad_recibida > 0 || it.cantidad_bonificada > 0)
    if (items.length === 0) {
      toast.info("Sin cantidades", "Ingresá al menos una cantidad recibida")
      return
    }
    setSubmitting(true)
    try {
      const result = await api.mobile.receiveRemit({ orden_id: selected.id, items })
      toast.success("Remito procesado", `${result.procesados} ítems recibidos`)
      setSelected(null)
      setOrders(prev => prev.filter(o => o.id !== selected.id))
      onDone()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo procesar el remito")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>

  if (selected) {
    return (
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Orden {selected.numero}</h3>
            <p className="text-sm text-gray-500">{selected.supplier?.razon_social || "—"}</p>
          </div>
          <button className="btn-outline" onClick={() => setSelected(null)}>Volver</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th className="py-2">Producto</th>
              <th className="py-2">Pedido</th>
              <th className="py-2">Ya recibido</th>
              <th className="py-2">Recibiendo ahora</th>
              <th className="py-2">Bonificación</th>
            </tr>
          </thead>
          <tbody>
            {(selected.items || []).map((it: any) => {
              const key = it.id || it.product_id
              const productId = it.product_id || it.producto_id
              return (
                <tr key={key} className="border-b border-gray-50 dark:border-gray-800">
                  <td className="py-2">{it.producto?.nombre || it.descripcion || it.product_id}</td>
                  <td className="py-2 font-mono">{it.cantidad}</td>
                  <td className="py-2 font-mono text-gray-400">{it.cantidad_recibida || it.recibido || 0}</td>
                  <td className="py-2">
                    <input type="number" min={0} className="input-field w-28" value={cantidades[key] || ""}
                      onChange={e => onCantidadChange(key, productId, e.target.value)} />
                  </td>
                  <td className="py-2">
                    <input type="number" min={0} className="input-field w-24 text-green-600" value={bonificaciones[key] || ""}
                      placeholder="0"
                      onChange={e => {
                        setBonificacionesTocadas(s => new Set(s).add(key))
                        setBonificaciones(b => ({ ...b, [key]: e.target.value }))
                      }} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button className="btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar recepción"}
        </button>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {orders.length === 0 ? (
        <p className="text-center py-12 text-gray-400">No hay órdenes de compra pendientes de recepción</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Orden</th>
              <th className="table-cell">Proveedor</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Total</th>
              <th className="table-cell"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="table-row cursor-pointer" onClick={() => openOrder(o)}>
                <td className="table-td font-mono">{o.numero}</td>
                <td className="table-td">{o.supplier?.razon_social || "—"}</td>
                <td className="table-td capitalize">{o.estado}</td>
                <td className="table-td font-mono">₲ {(o.total || 0).toLocaleString()}</td>
                <td className="table-td"><PackageCheck className="w-4 h-4 text-primary" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Conteo de inventario ─────────────────────────────────────────────────

function ConteoTab({ toast, onDone }: { toast: ReturnType<typeof useToast>; onDone: () => void }) {
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
  const [warehouseId, setWarehouseId] = useState("")
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Product[]>([])
  const [items, setItems] = useState<{ product: Product; cantidad_real: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { api.warehouses.list().then(setWarehouses).catch(() => setWarehouses([])) }, [])

  const doSearch = useCallback(async () => {
    if (search.trim().length < 2) { setResults([]); return }
    try {
      setResults(await api.products.list({ search, activo: true }))
    } catch { setResults([]) }
  }, [search])

  useEffect(() => { const t = setTimeout(doSearch, 300); return () => clearTimeout(t) }, [doSearch])

  const addProduct = (p: Product) => {
    if (items.some(i => i.product.id === p.id)) return
    setItems(prev => [...prev, { product: p, cantidad_real: "" }])
    setSearch("")
    setResults([])
  }

  const submit = async () => {
    if (!warehouseId || items.length === 0) {
      toast.info("Faltan datos", "Elegí un almacén y agregá al menos un producto")
      return
    }
    setSubmitting(true)
    try {
      const result = await api.mobile.inventoryCount({
        warehouse_id: warehouseId,
        items: items.map(i => ({ product_id: i.product.id, cantidad_real: Number(i.cantidad_real || 0) })),
      })
      const discrepancias = result.discrepancias.length
      toast.success("Conteo registrado", discrepancias > 0 ? `${discrepancias} diferencia(s) detectada(s) y ajustada(s)` : "Sin diferencias con el sistema")
      setItems([])
      onDone()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo registrar el conteo")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <label className="input-label">Almacén</label>
        <select className="input-field max-w-xs" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
          <option value="">Seleccionar...</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
        </select>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input-field pl-10" placeholder="Buscar producto por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
            {results.map(p => (
              <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center justify-between" onClick={() => addProduct(p)}>
                <span>{p.nombre}</span>
                <Plus className="w-3.5 h-3.5 text-primary" />
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th className="py-2">Producto</th>
              <th className="py-2">Cantidad real contada</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.product.id} className="border-b border-gray-50 dark:border-gray-800">
                <td className="py-2">{it.product.nombre}</td>
                <td className="py-2">
                  <input type="number" min={0} className="input-field w-28" value={it.cantidad_real}
                    onChange={e => setItems(prev => prev.map((p, i) => i === idx ? { ...p, cantidad_real: e.target.value } : p))} />
                </td>
                <td className="py-2">
                  <button className="btn-ghost text-red-400" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button className="btn-primary" onClick={submit} disabled={submitting}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar conteo"}
      </button>
    </div>
  )
}

// ── Sugerencias de compra ────────────────────────────────────────────────

function SugerenciasTab({ toast, onDone }: { toast: ReturnType<typeof useToast>; onDone: () => void }) {
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[]>([])
  const [products, setProducts] = useState<Record<string, Product>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const list = await api.purchases.listPurchaseSuggestions("pendiente")
      setSuggestions(list)
      const all = await api.products.list({ activo: true })
      setProducts(Object.fromEntries(all.map(p => [p.id, p])))
    } catch {
      toast.error("Error", "No se pudieron cargar las sugerencias")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const approve = async () => {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      const result = await api.mobile.approveSuggestions({ suggestion_ids: Array.from(selected) })
      toast.success("Aprobadas", `${result.aprobadas} de ${result.total}`)
      setSelected(new Set())
      fetchData()
      onDone()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudieron aprobar")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>

  return (
    <div className="card overflow-hidden">
      {suggestions.length === 0 ? (
        <p className="text-center py-12 text-gray-400">No hay sugerencias de compra pendientes</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="table-cell"></th>
                <th className="table-cell">Producto</th>
                <th className="table-cell">Motivo</th>
                <th className="table-cell">Cantidad sugerida</th>
                <th className="table-cell">Cobertura (días)</th>
                <th className="table-cell">Urgencia</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map(s => (
                <tr key={s.id} className="table-row cursor-pointer" onClick={() => toggle(s.id)}>
                  <td className="table-td"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} onClick={e => e.stopPropagation()} /></td>
                  <td className="table-td">{products[s.product_id]?.nombre || s.product_id}</td>
                  <td className="table-td text-xs text-gray-500">{s.motivo}</td>
                  <td className="table-td font-mono">{s.cantidad_sugerida}</td>
                  <td className="table-td font-mono">{s.dias_cobertura ?? "—"}</td>
                  <td className="table-td capitalize">{s.urgencia || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <button className="btn-primary flex items-center gap-2" onClick={approve} disabled={submitting || selected.size === 0}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Aprobar {selected.size > 0 ? `(${selected.size})` : ""}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
