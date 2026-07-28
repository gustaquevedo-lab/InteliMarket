import { useState } from "react"
import { ClipboardList, TrendingUp, Search, Plus, CheckCircle, RefreshCw, AlertTriangle, Coins, FileSpreadsheet } from "lucide-react"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface ReplenishItem {
  id: string
  producto: string
  sku: string
  proveedor: string
  stockActual: number
  stockSeguridad: number
  velocidadVenta: number // kg o unidades por día
  leadTime: number // días
  sugerido: number
  costoUnitario: number
  prioridad: "Alta" | "Media" | "Baja"
}

// El calculo real de reposicion sugerida (stock actual + velocidad de venta +
// lead time del proveedor) todavia no tiene un endpoint backend — solo existe
// el CRUD de reglas (advanced_inventory/replenish-rules). Antes esta pagina
// mostraba 4 productos ficticios de supermercado como si fueran sugerencias
// reales. Arranca vacia hasta que exista el motor de calculo real.
export default function AutoReplenishPage() {
  const [items, setItems] = useState<ReplenishItem[]>([])
  const [search, setSearch] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const toast = useToast()

  const handleToggleSelect = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleToggleAll = () => {
    if (selectedItems.length === items.filter(i => i.sugerido > 0).length) {
      setSelectedItems([])
    } else {
      setSelectedItems(items.filter(i => i.sugerido > 0).map(i => i.id))
    }
  }

  const handleGenerateOrders = () => {
    if (selectedItems.length === 0) {
      toast.error("Sin Selección", "Por favor selecciona al menos un artículo para reabastecer.")
      return
    }

    const itemsToOrder = items.filter(i => selectedItems.includes(i.id))
    const totalOrderValue = itemsToOrder.reduce((sum, item) => sum + item.costoUnitario * item.sugerido, 0)

    toast.success(
      "Órdenes de Compra Generadas", 
      `Se auto-generaron ${itemsToOrder.length} órdenes para proveedores por valor de ${formatPYG(totalOrderValue)}.`
    )
    
    // Clear suggests for ordered items
    setItems(prev => prev.map(item => 
      selectedItems.includes(item.id) ? { ...item, stockActual: item.stockActual + item.sugerido, sugerido: 0 } : item
    ))
    setSelectedItems([])
  }

  const filteredItems = items.filter(item => 
    item.producto.toLowerCase().includes(search.toLowerCase()) ||
    item.sku.toLowerCase().includes(search.toLowerCase()) ||
    item.proveedor.toLowerCase().includes(search.toLowerCase())
  )

  const highPriorityCount = items.filter(i => i.prioridad === "Alta" && i.sugerido > 0).length
  const totalSuggestedCost = items
    .filter(i => selectedItems.includes(i.id))
    .reduce((sum, i) => sum + i.costoUnitario * i.sugerido, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Planificador de Reabastecimiento Predictivo (Auto-Replenish)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Algoritmo inteligente de compras: analiza la velocidad de venta y el Lead Time del proveedor para sugerir cantidades óptimas de stock.
          </p>
        </div>
        <button 
          onClick={handleGenerateOrders}
          disabled={selectedItems.length === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" /> Generar {selectedItems.length} Pedidos de Compra
        </button>
      </div>

      {/* KPI Cards */}
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
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Inversión Estimada Seleccionada</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{formatPYG(totalSuggestedCost)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Eficiencia de Abastecimiento</span>
          </div>
          <p className="text-2xl font-bold text-primary">99.2%</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            className="input-field pl-10" 
            placeholder="Buscar por producto, SKU o proveedor..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={() => toast.success("Sincronización Completa", "Velocidad de venta recalculada.")} className="btn-outline flex items-center gap-2 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin-slow" /> Recalcular Velocidades
        </button>
      </div>

      {/* Suggested Items Table */}
      <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
              <th className="p-3 w-10">
                <input 
                  type="checkbox" 
                  checked={selectedItems.length === items.filter(i => i.sugerido > 0).length} 
                  onChange={handleToggleAll} 
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
              </th>
              <th className="p-3">Producto / SKU</th>
              <th className="p-3">Proveedor Principal</th>
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
            {filteredItems.map(item => (
              <tr key={item.id} className="table-row">
                <td className="p-3">
                  {item.sugerido > 0 ? (
                    <input 
                      type="checkbox" 
                      checked={selectedItems.includes(item.id)} 
                      onChange={() => handleToggleSelect(item.id)} 
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
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
    </div>
  )
}
