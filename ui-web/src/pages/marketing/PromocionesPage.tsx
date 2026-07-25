import { useState } from "react"
import { Tags, Plus, Trash2, Percent, BadgeDollarSign, HelpCircle, CheckCircle, RefreshCw, ShoppingCart } from "lucide-react"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface PromoRule {
  id: string
  nombre: string
  tipo: "3x2" | "MixMatch" | "Banco"
  descripcion: string
  activo: boolean
  parametros: string
}

const INITIAL_RULES: PromoRule[] = [
  {
    id: "PR-1",
    nombre: "3x2 en Lácteos Trébol",
    tipo: "3x2",
    descripcion: "Lleva 3 leches o quesos Trébol y paga solo 2 (el de menor valor es gratis).",
    activo: true,
    parametros: "Categoría: Lácteos | Marca: Trébol"
  },
  {
    id: "PR-2",
    nombre: "Combo Hamburguesa + Gaseosa",
    tipo: "MixMatch",
    descripcion: "Pan Felipe + Carne Hamburguesa Kzero + Gaseosa Cola 2L por solo Gs. 22.000.",
    activo: true,
    parametros: "Items: [p2, p3, p5]"
  },
  {
    id: "PR-3",
    nombre: "15% Reintegro Itaú Martes",
    tipo: "Banco",
    descripcion: "Descuento directo del 15% pagando con tarjetas de crédito Itaú.",
    activo: true,
    parametros: "Banco: Itaú | Día: Martes | Descuento: 15%"
  }
]

export default function PromocionesPage() {
  const [rules, setRules] = useState<PromoRule[]>(INITIAL_RULES)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newNombre, setNewNombre] = useState("")
  const [newTipo, setNewTipo] = useState<"3x2" | "MixMatch" | "Banco">("3x2")
  const [newDesc, setNewDesc] = useState("")
  const [newParams, setNewParams] = useState("")
  const toast = useToast()

  // Sandbox simulation variables
  const [cartItems, setCartItems] = useState<{ id: string; nombre: string; precio: number; cantidad: number }[]>([
    { id: "1", nombre: "Leche Entera Trébol 1L", precio: 6500, cantidad: 3 },
    { id: "2", nombre: "Gaseosa Cola 2L", precio: 9000, cantidad: 1 },
    { id: "3", nombre: "Queso Paraguay Fresco kg", precio: 38000, cantidad: 1 }
  ])
  const [bankPaymentSelected, setBankPaymentSelected] = useState(false)

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNombre.trim()) return

    const newRule: PromoRule = {
      id: `PR-${rules.length + 1}`,
      nombre: newNombre,
      tipo: newTipo,
      descripcion: newDesc,
      activo: true,
      parametros: newParams || "Parámetros globales"
    }

    setRules([...rules, newRule])
    setShowCreateModal(false)
    setNewNombre("")
    setNewDesc("")
    setNewParams("")
    toast.success("Campaña Creada", `La promoción '${newRule.nombre}' se ha guardado en el catálogo.`)
  }

  const handleToggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, activo: !r.activo } : r))
    toast.info("Estado de Regla Modificado", "El POS volverá a calcular las campañas activas.")
  }

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id))
    toast.error("Regla Eliminada", "Campaña comercial borrada.")
  }

  // Calculate sandbox prices
  const subtotal = cartItems.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  
  // Calculate specific 3x2 rule discount (Leche Trébol, 3 items for price of 2)
  let discount3x2 = 0
  const trebolLeche = cartItems.find(i => i.nombre.includes("Trébol"))
  if (trebolLeche && trebolLeche.cantidad >= 3 && rules.find(r => r.id === "PR-1")?.activo) {
    const freeQty = Math.floor(trebolLeche.cantidad / 3)
    discount3x2 = freeQty * trebolLeche.precio
  }

  // Bank discount calculation
  let discountBank = 0
  if (bankPaymentSelected && rules.find(r => r.id === "PR-3")?.activo) {
    discountBank = Math.round((subtotal - discount3x2) * 0.15)
  }

  const totalDescuentos = discount3x2 + discountBank
  const totalPagar = subtotal - totalDescuentos

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tags className="w-6 h-6 text-primary" />
            Motor de Promociones Enterprise (Promotions Rules Engine)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Diseñá e integrá campañas comerciales de descuento dinámico aplicados al Punto de Venta en caliente.
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Crear Promoción / Campaña
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Rules Catalog */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Reglas Comerciales Activas</h3>
          {rules.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <BadgeDollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No hay campañas comerciales registradas en este momento.</p>
            </div>
          ) : (
            rules.map(rule => (
              <div key={rule.id} className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-gray-200 dark:border-gray-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      rule.tipo === "3x2" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                      rule.tipo === "MixMatch" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" :
                      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    }`}>
                      {rule.tipo}
                    </span>
                    <h4 className="text-md font-bold text-gray-900 dark:text-white">{rule.nombre}</h4>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{rule.descripcion}</p>
                  <p className="font-mono text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-800 py-0.5 px-2 rounded w-max">
                    {rule.parametros}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 justify-end border-t md:border-t-0 pt-3 md:pt-0">
                  <button 
                    onClick={() => handleToggleRule(rule.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      rule.activo ? "bg-green-500 text-white shadow-sm" : "bg-gray-200 dark:bg-slate-700 text-gray-500"
                    }`}
                  >
                    {rule.activo ? "Activo" : "Pausado"}
                  </button>
                  <button 
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-red-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sandbox Calculator Drawer */}
        <div className="lg:col-span-1">
          <div className="card p-6 space-y-6 border border-gray-200 dark:border-gray-800 sticky top-6">
            <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Simulador de Carrito POS
            </h3>
            
            <div className="space-y-3">
              {cartItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl text-xs">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{item.nombre}</p>
                    <p className="text-gray-500">{formatPYG(item.precio)} × {item.cantidad}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCartItems(cartItems.map(i => i.id === item.id ? { ...i, cantidad: Math.max(1, i.cantidad - 1) } : i))}
                      className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      -
                    </button>
                    <span className="font-bold font-mono w-5 text-center text-gray-800 dark:text-white">{item.cantidad}</span>
                    <button 
                      onClick={() => setCartItems(cartItems.map(i => i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i))}
                      className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={bankPaymentSelected} 
                    onChange={e => setBankPaymentSelected(e.target.checked)} 
                    className="rounded border-gray-300 dark:border-gray-700 text-primary focus:ring-primary h-4 w-4"
                  />
                  Pagar con Tarjeta Itaú (Descuento Itaú)
                </label>
              </div>

              <div className="space-y-2 bg-slate-950 p-4 rounded-xl font-mono text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal:</span>
                  <span>{formatPYG(subtotal)}</span>
                </div>
                {discount3x2 > 0 && (
                  <div className="flex justify-between text-amber-500 font-bold">
                    <span>Ahorro 3x2 Lácteos:</span>
                    <span>-{formatPYG(discount3x2)}</span>
                  </div>
                )}
                {discountBank > 0 && (
                  <div className="flex justify-between text-emerald-500 font-bold">
                    <span>Reintegro Itaú:</span>
                    <span>-{formatPYG(discountBank)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-white border-t border-slate-800 pt-2 mt-2">
                  <span>Total Neto:</span>
                  <span className="text-green-400">{formatPYG(totalPagar)}</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  toast.success("Venta Simulada", `Venta registrada por ${formatPYG(totalPagar)} con ${formatPYG(totalDescuentos)} en descuentos.`)
                  setCartItems([
                    { id: "1", nombre: "Leche Entera Trébol 1L", precio: 6500, cantidad: 3 },
                    { id: "2", nombre: "Gaseosa Cola 2L", precio: 9000, cantidad: 1 },
                    { id: "3", nombre: "Queso Paraguay Fresco kg", precio: 38000, cantidad: 1 }
                  ])
                  setBankPaymentSelected(false)
                }}
                className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 text-xs"
              >
                <CheckCircle className="w-4 h-4" /> Registrar Venta con Oferta
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nueva Campaña / Promoción</h3>
              <form onSubmit={handleAddRule} className="space-y-4">
                <div>
                  <label className="input-label label-required">Nombre de la Promoción</label>
                  <input className="input-field" placeholder="ej. 20% en Cervezas Pilsen" value={newNombre} onChange={e => setNewNombre(e.target.value)} required />
                </div>
                <div>
                  <label className="input-label">Tipo de Oferta</label>
                  <select className="input-field" value={newTipo} onChange={e => setNewTipo(e.target.value as any)}>
                    <option value="3x2">Lleva 3 y Paga 2 (3x2)</option>
                    <option value="MixMatch">Mix & Match / Combos Cerrados</option>
                    <option value="Banco">Descuento / Reintegro Bancario</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Descripción de la Oferta</label>
                  <input className="input-field" placeholder="Explicación clara de las condiciones de la oferta" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Parámetros (Filtros de Aplicación)</label>
                  <input className="input-field" placeholder="ej. Marca: Pilsen | Categoría: Bebidas" value={newParams} onChange={e => setNewParams(e.target.value)} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" className="btn-outline flex-1" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary flex-1">Crear Promoción</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
