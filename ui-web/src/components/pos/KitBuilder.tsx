import { useState } from "react"
import { X, Plus, Minus, Package, Loader2 } from "lucide-react"

interface KitComponent {
  productId: string
  nombre: string
  cantidad: number
  precio: number
}

interface KitBuilderProps {
  open: boolean
  onClose: () => void
  onSave: (data: { nombre: string; descripcion: string; precioVenta: number; items: KitComponent[] }) => void
  products: Array<{ id: string; nombre: string; sku: string; precio?: number; categoria?: string }>
  formatPrice: (value: number) => string
  saving?: boolean
}

export default function KitBuilder({ open, onClose, onSave, products, formatPrice, saving }: KitBuilderProps) {
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [precioVenta, setPrecioVenta] = useState(0)
  const [components, setComponents] = useState<KitComponent[]>([])
  const [search, setSearch] = useState("")

  if (!open) return null

  const filteredProducts = products.filter(p =>
    !search || p.nombre.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const addComponent = (product: { id: string; nombre: string; precio?: number }) => {
    setComponents(prev => {
      const existing = prev.find(c => c.productId === product.id)
      if (existing) {
        return prev.map(c => c.productId === product.id ? { ...c, cantidad: c.cantidad + 1 } : c)
      }
      return [...prev, { productId: product.id, nombre: product.nombre, cantidad: 1, precio: product.precio || 0 }]
    })
  }

  const updateQty = (productId: string, delta: number) => {
    setComponents(prev => {
      const item = prev.find(c => c.productId === productId)
      if (!item) return prev
      const newQty = item.cantidad + delta
      if (newQty <= 0) return prev.filter(c => c.productId !== productId)
      return prev.map(c => c.productId === productId ? { ...c, cantidad: newQty } : c)
    })
  }

  const removeComponent = (productId: string) => {
    setComponents(prev => prev.filter(c => c.productId !== productId))
  }

  const precioCalculado = components.reduce((sum, c) => sum + c.precio * c.cantidad, 0)

  const handleSave = () => {
    if (!nombre.trim() || components.length === 0) return
    onSave({ nombre: nombre.trim(), descripcion, precioVenta, items: components })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Crear Kit / Combo
          </h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Nombre del kit</label>
              <input className="input-field" placeholder="Ej: Combo Familiar" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="input-label">Precio de venta (opcional)</label>
              <input className="input-field" type="number" placeholder="Dejar vacío = calculado" value={precioVenta || ""} onChange={e => setPrecioVenta(parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div>
            <label className="input-label">Descripción</label>
            <textarea className="input-field" rows={2} placeholder="Descripción opcional..." value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>

          <div>
            <label className="input-label">Agregar componentes</label>
            <input className="input-field mb-2" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin resultados</p>
              ) : (
                filteredProducts.slice(0, 20).map(p => {
                  const inKit = components.some(c => c.productId === p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => addComponent(p)}
                      disabled={inKit}
                      className={`w-full text-left p-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                        inKit
                          ? "bg-primary/10 text-primary cursor-default"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span className="font-medium truncate">{p.nombre}</span>
                      <span className="text-xs font-mono text-gray-400">{formatPrice(p.precio || 0)}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {components.length > 0 && (
            <div>
              <label className="input-label">Componentes del kit</label>
              <div className="space-y-2">
                {components.map(c => (
                  <div key={c.productId} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{c.nombre}</p>
                      <p className="text-xs text-gray-400">{formatPrice(c.precio)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(c.productId, -1)} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"><Minus className="w-3 h-3" /></button>
                      <span className="w-6 text-center text-sm font-mono font-bold">{c.cantidad}</span>
                      <button onClick={() => updateQty(c.productId, 1)} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"><Plus className="w-3 h-3" /></button>
                    </div>
                    <p className="text-sm font-mono font-bold w-20 text-right">{formatPrice(c.precio * c.cantidad)}</p>
                    <button onClick={() => removeComponent(c.productId)} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-400">Precio calculado</span>
                <span className="text-sm font-bold font-mono">{formatPrice(precioCalculado)}</span>
              </div>
              {precioVenta > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Diferencia</span>
                  <span className={`font-mono font-bold ${precioVenta > precioCalculado ? "text-green-500" : "text-red-500"}`}>
                    {formatPrice(precioVenta - precioCalculado)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
          <button className="btn-outline flex-1" onClick={onClose}>Cancelar</button>
          <button
            className="btn-primary flex-1"
            onClick={handleSave}
            disabled={!nombre.trim() || components.length === 0 || saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Kit"}
          </button>
        </div>
      </div>
    </div>
  )
}
