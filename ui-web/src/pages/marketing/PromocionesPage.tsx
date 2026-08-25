import { useState, useEffect } from "react"
import { Tags, Plus, Trash2, BadgeDollarSign, ShoppingCart, Loader2, Search, X } from "lucide-react"
import { api, type Promotion, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

const TIPO_LABELS: Record<string, string> = {
  porcentaje: "Descuento %",
  monto_fijo: "Descuento monto fijo",
  dos_por_uno: "2x1 (o Nx M)",
  combo_precio: "Combo a precio fijo",
  cantidad_lleva: "Lleva N y paga M",
}

const APLICA_LABELS: Record<string, string> = {
  producto: "Productos especificos",
  categoria: "Categoria",
  carrito: "Carrito completo",
  marca: "Marca",
}

interface SimCartItem { product_id: string; nombre: string; precio: number; cantidad: number }

export default function PromocionesPage() {
  const toast = useToast()
  const [rules, setRules] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const [newNombre, setNewNombre] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newTipo, setNewTipo] = useState("porcentaje")
  const [newAplicaA, setNewAplicaA] = useState("carrito")
  const [newValor, setNewValor] = useState<number | "">(10)
  const [newDesde, setNewDesde] = useState(new Date().toISOString().slice(0, 10))
  const [newHasta, setNewHasta] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
  const [newCupon, setNewCupon] = useState("")
  const [newProductIds, setNewProductIds] = useState<string[]>([])
  const [prodSearch, setProdSearch] = useState("")
  const [prodResults, setProdResults] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)

  const [simItems, setSimItems] = useState<SimCartItem[]>([])
  const [simProdSearch, setSimProdSearch] = useState("")
  const [simProdResults, setSimProdResults] = useState<Product[]>([])
  const [simResult, setSimResult] = useState<{ applicable_promotions: any[]; total_descuento: number; total_final: number } | null>(null)
  const [simulating, setSimulating] = useState(false)

  const loadRules = async () => {
    setLoading(true)
    try {
      setRules(await api.promotions.list())
    } catch {
      toast.error("Error", "No se pudieron cargar las promociones")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRules() }, [])

  useEffect(() => {
    if (!showCreateModal || !prodSearch) { setProdResults([]); return }
    const t = setTimeout(() => {
      api.products.list({ search: prodSearch, activo: true }).then(setProdResults).catch(() => setProdResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [prodSearch, showCreateModal])

  useEffect(() => {
    if (!simProdSearch) { setSimProdResults([]); return }
    const t = setTimeout(() => {
      api.products.list({ search: simProdSearch, activo: true }).then(setSimProdResults).catch(() => setSimProdResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [simProdSearch])

  const resetCreateForm = () => {
    setNewNombre(""); setNewDesc(""); setNewTipo("porcentaje"); setNewAplicaA("carrito")
    setNewValor(10); setNewCupon(""); setNewProductIds([]); setProdSearch("")
  }

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNombre.trim()) return
    setSaving(true)
    try {
      await api.promotions.create({
        nombre: newNombre,
        descripcion: newDesc || undefined,
        tipo: newTipo,
        valor: newValor === "" ? undefined : Number(newValor),
        aplica_a: newAplicaA,
        producto_ids: newAplicaA === "producto" && newProductIds.length > 0 ? newProductIds : undefined,
        valido_desde: newDesde,
        valido_hasta: newHasta,
        codigo_cupon: newCupon || undefined,
        requiere_cupon: !!newCupon,
        activo: true,
      })
      toast.success("Promocion creada", newNombre)
      setShowCreateModal(false)
      resetCreateForm()
      loadRules()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo crear la promocion")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleRule = async (r: Promotion) => {
    try {
      await api.promotions.update(r.id, { activo: !r.activo })
      toast.success(r.activo ? "Pausada" : "Activada", r.nombre)
      loadRules()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo actualizar la promocion")
    }
  }

  const handleDeleteRule = async (r: Promotion) => {
    if (!confirm(`Eliminar "${r.nombre}"?`)) return
    try {
      await api.promotions.delete(r.id)
      toast.success("Eliminada", r.nombre)
      loadRules()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo eliminar la promocion")
    }
  }

  const addSimProduct = (p: Product) => {
    if (simItems.some(i => i.product_id === p.id)) return
    setSimItems([...simItems, { product_id: p.id, nombre: p.nombre, precio: p.precio_venta ?? p.precio ?? 0, cantidad: 1 }])
    setSimResult(null)
  }
  const updateSimQty = (id: string, qty: number) => {
    setSimItems(simItems.map(i => i.product_id === id ? { ...i, cantidad: Math.max(1, qty) } : i))
    setSimResult(null)
  }
  const removeSimItem = (id: string) => {
    setSimItems(simItems.filter(i => i.product_id !== id))
    setSimResult(null)
  }

  const subtotal = simItems.reduce((s, i) => s + i.precio * i.cantidad, 0)

  const handleSimulate = async () => {
    if (simItems.length === 0) return
    setSimulating(true)
    try {
      const result = await api.promotions.calculate({
        items: simItems.map(i => ({ producto_id: i.product_id, cantidad: i.cantidad, precio_unitario: i.precio })),
      })
      setSimResult(result)
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo calcular las promociones aplicables")
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-2">
            <Tags className="w-6 h-6 text-primary" />
            Promociones
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Reglas reales que el POS aplica en el momento de la venta.
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva Promocion
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Promociones</h3>
          {loading ? (
            <div className="card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
          ) : rules.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <BadgeDollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No hay promociones registradas todavia.</p>
            </div>
          ) : (
            rules.map(rule => (
              <div key={rule.id} className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-gray-200 dark:border-gray-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                      {TIPO_LABELS[rule.tipo] || rule.tipo}
                    </span>
                    <h4 className="text-md font-bold text-gray-900 dark:text-white">{rule.nombre}</h4>
                  </div>
                  {rule.descripcion && <p className="text-xs text-gray-500 dark:text-gray-400">{rule.descripcion}</p>}
                  <p className="font-mono text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-800 py-0.5 px-2 rounded w-max">
                    {APLICA_LABELS[rule.aplica_a] || rule.aplica_a} · {rule.valido_desde} a {rule.valido_hasta} · {rule.usos_actuales ?? 0} usos
                  </p>
                </div>

                <div className="flex items-center gap-3 justify-end border-t md:border-t-0 pt-3 md:pt-0">
                  <button
                    onClick={() => handleToggleRule(rule)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${rule.activo ? "bg-green-500 text-white shadow-sm" : "bg-gray-200 dark:bg-slate-700 text-gray-500"}`}
                  >
                    {rule.activo ? "Activa" : "Pausada"}
                  </button>
                  <button onClick={() => handleDeleteRule(rule)} className="text-red-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="card p-6 space-y-6 border border-gray-200 dark:border-gray-800 sticky top-6">
            <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Probar carrito real
            </h3>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar producto real..." value={simProdSearch} onChange={e => setSimProdSearch(e.target.value)} />
            </div>
            {simProdSearch && (
              <div className="max-h-[120px] overflow-y-auto space-y-1 -mt-3">
                {simProdResults.map(p => (
                  <button key={p.id} onClick={() => addSimProduct(p)} className="w-full text-left text-xs p-2 rounded-lg hover:bg-primary/10 flex justify-between">
                    <span>{p.nombre}</span><span className="text-primary font-bold">+</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {simItems.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Agrega productos reales para probar que promociones aplicarian</p>
              ) : simItems.map(item => (
                <div key={item.product_id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl text-xs">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{item.nombre}</p>
                    <p className="text-gray-500">{formatPYG(item.precio)} x {item.cantidad}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateSimQty(item.product_id, item.cantidad - 1)} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">-</button>
                    <span className="font-bold font-mono w-5 text-center">{item.cantidad}</span>
                    <button onClick={() => updateSimQty(item.product_id, item.cantidad + 1)} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">+</button>
                    <button onClick={() => removeSimItem(item.product_id)} className="text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>

            {simItems.length > 0 && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                <button onClick={handleSimulate} disabled={simulating} className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 text-xs">
                  {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Calcular promociones aplicables"}
                </button>

                {simResult && (
                  <div className="space-y-2 bg-slate-950 p-4 rounded-xl font-mono text-xs">
                    <div className="flex justify-between text-gray-400"><span>Subtotal:</span><span>{formatPYG(subtotal)}</span></div>
                    {simResult.applicable_promotions.length === 0 ? (
                      <p className="text-gray-500 text-center py-2">Ninguna promocion activa aplica a este carrito</p>
                    ) : simResult.applicable_promotions.map((p: any) => (
                      <div key={p.promotion_id} className="flex justify-between text-amber-500 font-bold">
                        <span>{p.nombre}:</span><span>-{formatPYG(p.descuento)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-base font-extrabold text-white border-t border-slate-800 pt-2 mt-2">
                      <span>Total con descuentos:</span><span className="text-green-400">{formatPYG(simResult.total_final)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nueva Promocion</h3>
              <form onSubmit={handleAddRule} className="space-y-4">
                <div>
                  <label className="input-label label-required">Nombre</label>
                  <input className="input-field" placeholder="ej. 20% en Cervezas Pilsen" value={newNombre} onChange={e => setNewNombre(e.target.value)} required />
                </div>
                <div>
                  <label className="input-label">Descripcion</label>
                  <input className="input-field" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Tipo</label>
                    <select className="input-field" value={newTipo} onChange={e => setNewTipo(e.target.value)}>
                      {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Aplica a</label>
                    <select className="input-field" value={newAplicaA} onChange={e => setNewAplicaA(e.target.value)}>
                      {Object.entries(APLICA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="input-label">Valor (% o Gs segun el tipo)</label>
                  <input type="number" className="input-field" value={newValor} onChange={e => setNewValor(e.target.value === "" ? "" : parseFloat(e.target.value))} />
                </div>

                {newAplicaA === "producto" && (
                  <div>
                    <label className="input-label">Productos</label>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input className="input-field pl-10" placeholder="Buscar producto..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                    </div>
                    {prodSearch && (
                      <div className="max-h-[100px] overflow-y-auto space-y-1 mb-2">
                        {prodResults.map(p => (
                          <button key={p.id} type="button" onClick={() => { if (!newProductIds.includes(p.id)) setNewProductIds([...newProductIds, p.id]) }} className="w-full text-left text-xs p-2 rounded-lg hover:bg-primary/10 flex justify-between">
                            <span>{p.nombre}</span><span className="text-primary font-bold">+</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {newProductIds.length > 0 && <p className="text-xs text-gray-400">{newProductIds.length} producto(s) seleccionados</p>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="input-label label-required">Desde</label><input type="date" className="input-field" value={newDesde} onChange={e => setNewDesde(e.target.value)} required /></div>
                  <div><label className="input-label label-required">Hasta</label><input type="date" className="input-field" value={newHasta} onChange={e => setNewHasta(e.target.value)} required /></div>
                </div>
                <div>
                  <label className="input-label">Codigo de cupon (opcional)</label>
                  <input className="input-field" placeholder="ej. VERANO20" value={newCupon} onChange={e => setNewCupon(e.target.value)} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" className="btn-outline flex-1" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Crear"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
