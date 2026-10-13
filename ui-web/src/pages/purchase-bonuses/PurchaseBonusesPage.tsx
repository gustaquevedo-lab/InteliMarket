import { useState, useEffect, useCallback } from "react"
import { Gift, Plus, Trash2, Loader2, Search, X } from "lucide-react"
import { api, type Supplier, type Product, type PurchaseBonusScale } from "../../api"
import { useToast } from "../../context/ToastContext"

export default function PurchaseBonusesPage() {
  const [scales, setScales] = useState<PurchaseBonusScale[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Record<string, Product>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [scalesData, suppliersData] = await Promise.all([
        api.purchaseBonuses.list(),
        api.purchases.suppliers(),
      ])
      setScales(scalesData)
      setSuppliers(suppliersData)
      const ids = Array.from(new Set(scalesData.map(s => s.product_id)))
      if (ids.length > 0) {
        const all = await api.products.list({})
        setProducts(Object.fromEntries(all.filter(p => ids.includes(p.id)).map(p => [p.id, p])))
      }
    } catch {
      toast.info("Sin datos", "Conectá el backend para ver escalas de bonificación")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.razon_social || "—"

  const handleDelete = async (scale: PurchaseBonusScale) => {
    try {
      await api.purchaseBonuses.delete(scale.id)
      toast.success("Eliminada")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo eliminar")
    }
  }

  const toggleActivo = async (scale: PurchaseBonusScale) => {
    try {
      await api.purchaseBonuses.update(scale.id, { activo: !scale.activo })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo actualizar")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bonificaciones por Volumen de Compra</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Escalas puntuales del proveedor (ej. "a partir de 100 cajas, 5 gratis") — distinto del rebate mensual acumulado</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="w-4 h-4" />Nueva escala</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Proveedor</th>
              <th className="table-cell">Producto</th>
              <th className="table-cell">A partir de</th>
              <th className="table-cell">Bonifica</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : scales.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay escalas de bonificación cargadas</td></tr>
            ) : (
              scales.map(s => (
                <tr key={s.id} className="table-row">
                  <td className="table-td">{supplierName(s.supplier_id)}</td>
                  <td className="table-td">{products[s.product_id]?.nombre || s.product_id}</td>
                  <td className="table-td font-mono">{s.cantidad_minima}</td>
                  <td className="table-td font-mono text-green-600">+{s.cantidad_bonificada}</td>
                  <td className="table-td">
                    <button className={`badge ${s.activo ? "badge-success" : "badge-danger"}`} onClick={() => toggleActivo(s)}>
                      {s.activo ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="table-td">
                    <button className="btn-ghost text-red-400" onClick={() => handleDelete(s)}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <NewScaleModal
          suppliers={suppliers}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); fetchData() }}
          toast={toast}
        />
      )}
    </div>
  )
}

function NewScaleModal({ suppliers, onClose, onCreated, toast }: {
  suppliers: Supplier[]; onClose: () => void; onCreated: () => void; toast: ReturnType<typeof useToast>
}) {
  const [supplierId, setSupplierId] = useState("")
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<Product[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const [cantidadMinima, setCantidadMinima] = useState("")
  const [cantidadBonificada, setCantidadBonificada] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [saving, setSaving] = useState(false)

  const doSearch = useCallback(async () => {
    if (search.trim().length < 2) { setResults([]); return }
    try { setResults(await api.products.list({ search, activo: true })) } catch { setResults([]) }
  }, [search])
  useEffect(() => { const t = setTimeout(doSearch, 300); return () => clearTimeout(t) }, [doSearch])

  const submit = async () => {
    if (!supplierId || !product || !cantidadMinima || !cantidadBonificada) {
      toast.info("Faltan datos", "Completá proveedor, producto y las cantidades")
      return
    }
    setSaving(true)
    try {
      await api.purchaseBonuses.create({
        supplier_id: supplierId,
        product_id: product.id,
        cantidad_minima: Number(cantidadMinima),
        cantidad_bonificada: Number(cantidadBonificada),
        observaciones: observaciones || undefined,
      })
      toast.success("Escala creada")
      onCreated()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo crear la escala")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Gift className="w-5 h-5 text-primary" />Nueva escala de bonificación</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="input-label label-required">Proveedor</label>
            <select className="input-field" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.razon_social}</option>)}
            </select>
          </div>
          <div className="relative">
            <label className="input-label label-required">Producto</label>
            {product ? (
              <div className="input-field flex items-center justify-between">
                <span>{product.nombre}</span>
                <button onClick={() => setProduct(null)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input-field pl-10" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
                {results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                    {results.map(p => (
                      <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" onClick={() => { setProduct(p); setSearch(""); setResults([]) }}>
                        {p.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label label-required">A partir de (cantidad)</label>
              <input type="number" min={0} className="input-field" value={cantidadMinima} onChange={e => setCantidadMinima(e.target.value)} placeholder="100" />
            </div>
            <div>
              <label className="input-label label-required">Se bonifican</label>
              <input type="number" min={0} className="input-field" value={cantidadBonificada} onChange={e => setCantidadBonificada(e.target.value)} placeholder="5" />
            </div>
          </div>
          <div>
            <label className="input-label">Observaciones</label>
            <input className="input-field" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-outline flex-1" onClick={onClose}>Cancelar</button>
            <button className="btn-primary flex-1" onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear escala"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
