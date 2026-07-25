import { useState } from "react"
import { ArrowLeftRight, Search, Plus, Trash2, Send, CheckCircle2, AlertTriangle, Truck, Eye, FileText } from "lucide-react"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface TransferOrder {
  id: string
  codigo: string
  origen: string
  destino: string
  fecha: string
  itemsCount: number
  valorTotal: number
  estado: "Borrador" | "En Tránsito" | "Recibido"
  asignado: string
  mermasReportadas?: number
  observaciones?: string
  items: {
    product_id: string
    nombre: string
    sku: string
    cantidad: number
    recibido?: number
    merma?: number
  }[]
}

const MOCK_TRANSFERS: TransferOrder[] = [
  {
    id: "TR-001",
    codigo: "TRF-2026-001",
    origen: "Centro de Distribución (CD)",
    destino: "Sucursal Centro (Súper)",
    fecha: "2026-05-27",
    itemsCount: 15,
    valorTotal: 12500000,
    estado: "Recibido",
    asignado: "Carlos Maidana",
    mermasReportadas: 2,
    observaciones: "Palé de lácteos y carnes en frío.",
    items: [
      { product_id: "1", nombre: "Leche Entera Trébol 1L", sku: "7840001002231", cantidad: 120, recibido: 118, merma: 2 },
      { product_id: "2", nombre: "Queso Paraguay Fresco kg", sku: "7840003004456", cantidad: 45, recibido: 45, merma: 0 },
      { product_id: "3", nombre: "Pechuga de Pollo Kzero kg", sku: "7840005001123", cantidad: 80, recibido: 80, merma: 0 }
    ]
  },
  {
    id: "TR-002",
    codigo: "TRF-2026-002",
    origen: "Centro de Distribución (CD)",
    destino: "Sucursal San Lorenzo",
    fecha: "2026-05-27",
    itemsCount: 8,
    valorTotal: 8400000,
    estado: "En Tránsito",
    asignado: "Marta Benítez",
    observaciones: "Artículos de limpieza y bazar.",
    items: [
      { product_id: "4", nombre: "Detergente OMO Multiactivo 800g", sku: "7840007008899", cantidad: 50 },
      { product_id: "5", nombre: "Desodorante de Ambiente Glade", sku: "7840009002211", cantidad: 30 }
    ]
  },
  {
    id: "TR-003",
    codigo: "TRF-2026-003",
    origen: "Sucursal Luque",
    destino: "Sucursal Centro (Súper)",
    fecha: "2026-05-26",
    itemsCount: 4,
    valorTotal: 1800000,
    estado: "Borrador",
    asignado: "José Giménez",
    items: [
      { product_id: "6", nombre: "Aceite de Girasol Natura 900ml", sku: "7790272001029", cantidad: 24 }
    ]
  }
]

export default function TransferenciasPage() {
  const [transfers, setTransfers] = useState<TransferOrder[]>(MOCK_TRANSFERS)
  const [selectedTransfer, setSelectedTransfer] = useState<TransferOrder | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [search, setSearch] = useState("")
  const toast = useToast()

  // Form State
  const [origen, setOrigen] = useState("Centro de Distribución (CD)")
  const [destino, setDestino] = useState("Sucursal Centro (Súper)")
  const [observaciones, setObservaciones] = useState("")
  const [asignado, setAsignado] = useState("")
  const [newItems, setNewItems] = useState<{ product_id: string; nombre: string; sku: string; cantidad: number }[]>([])
  
  // Quick Search for product selection inside modal
  const [prodSearch, setProdSearch] = useState("")
  const MOCK_PRODUCTS = [
    { id: "1", nombre: "Leche Entera Trébol 1L", sku: "7840001002231" },
    { id: "2", nombre: "Queso Paraguay Fresco kg", sku: "7840003004456" },
    { id: "3", nombre: "Pechuga de Pollo Kzero kg", sku: "7840005001123" },
    { id: "4", nombre: "Detergente OMO Multiactivo 800g", sku: "7840007008899" },
    { id: "5", nombre: "Desodorante de Ambiente Glade", sku: "7840009002211" }
  ]

  const handleAddProduct = (prod: typeof MOCK_PRODUCTS[0]) => {
    if (newItems.some(item => item.product_id === prod.id)) {
      toast.info("Ya agregado", "El producto ya está en la lista de picking")
      return
    }
    setNewItems([...newItems, { product_id: prod.id, nombre: prod.nombre, sku: prod.sku, cantidad: 10 }])
  }

  const handleRemoveProduct = (id: string) => {
    setNewItems(newItems.filter(item => item.product_id !== id))
  }

  const handleUpdateQty = (id: string, qty: number) => {
    setNewItems(newItems.map(item => item.product_id === id ? { ...item, cantidad: Math.max(1, qty) } : item))
  }

  const handleCreateTransfer = () => {
    if (origen === destino) {
      toast.error("Error de Origen/Destino", "El origen y el destino no pueden ser iguales.")
      return
    }
    if (newItems.length === 0) {
      toast.error("Lista Vacía", "Agrega al menos un artículo a la transferencia.")
      return
    }

    const newTr: TransferOrder = {
      id: `TR-00${transfers.length + 1}`,
      codigo: `TRF-2026-00${transfers.length + 1}`,
      origen,
      destino,
      fecha: new Date().toISOString().split("T")[0],
      itemsCount: newItems.reduce((sum, item) => sum + item.cantidad, 0),
      valorTotal: newItems.length * 350000, // Dummy pricing
      estado: "Borrador",
      asignado: asignado || "Sin asignar",
      observaciones,
      items: newItems.map(it => ({ ...it }))
    }

    setTransfers([newTr, ...transfers])
    setShowCreateModal(false)
    // Clear states
    setObservaciones("")
    setAsignado("")
    setNewItems([])
    toast.success("Transferencia Creada", `Se registró el borrador ${newTr.codigo}`)
  }

  const handleTransitionStatus = (transferId: string, nextStatus: "En Tránsito" | "Recibido") => {
    setTransfers(prev => prev.map(tr => {
      if (tr.id === transferId) {
        let updatedItems = [...tr.items]
        let mermas = 0
        if (nextStatus === "Recibido") {
          // Simulate receiving check where maybe 1 item has a minor loss (merma)
          updatedItems = tr.items.map(item => {
            const lossSim = Math.floor(Math.random() * 2) // 0 or 1
            const actualRec = Math.max(0, item.cantidad - lossSim)
            mermas += lossSim
            return {
              ...item,
              recibido: actualRec,
              merma: lossSim
            }
          })
          toast.success("Recibido y Conciliado", `Transferencia recibida con ${mermas} mermas.`)
        } else {
          toast.info("En Tránsito", `El cargamento ha salido hacia ${tr.destino}.`)
        }
        
        const nextTr = {
          ...tr,
          estado: nextStatus,
          items: updatedItems,
          mermasReportadas: mermas > 0 ? mermas : undefined
        }
        if (selectedTransfer?.id === tr.id) {
          setSelectedTransfer(nextTr)
        }
        return nextTr
      }
      return tr
    }))
  }

  const filteredTransfers = transfers.filter(tr => 
    tr.codigo.toLowerCase().includes(search.toLowerCase()) ||
    tr.origen.toLowerCase().includes(search.toLowerCase()) ||
    tr.destino.toLowerCase().includes(search.toLowerCase()) ||
    tr.estado.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
            Transferencias entre Sucursales & Logística
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestioná el abastecimiento de mercaderías e insumos entre almacenes y centros de distribución.
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva Transferencia
        </button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            className="input-field pl-10" 
            placeholder="Buscar por código, origen, destino..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de transferencias */}
        <div className="lg:col-span-2 space-y-4">
          {filteredTransfers.length === 0 ? (
            <div className="card p-12 text-center text-gray-400 flex flex-col items-center justify-center">
              <Truck className="w-12 h-12 mb-3 opacity-20" />
              <p>No se encontraron registros de transferencias.</p>
            </div>
          ) : (
            filteredTransfers.map(tr => (
              <div 
                key={tr.id} 
                onClick={() => setSelectedTransfer(tr)}
                className={`card p-5 cursor-pointer border transition-all hover:border-primary/55 ${selectedTransfer?.id === tr.id ? "border-primary bg-primary/5 dark:bg-primary/10" : "border-gray-200 dark:border-gray-800"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      tr.estado === "Recibido" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                      tr.estado === "En Tránsito" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {tr.estado}
                    </span>
                    <span className="font-mono text-xs text-gray-500 font-bold">{tr.codigo}</span>
                  </div>
                  <span className="text-xs text-gray-400">{tr.fecha}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Origen</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{tr.origen}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Destino</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{tr.destino}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
                  <div className="flex gap-4">
                    <span>Items: <strong className="text-gray-700 dark:text-gray-300">{tr.items.length}</strong></span>
                    <span>Total Estimado: <strong className="text-gray-700 dark:text-gray-300">{formatPYG(tr.valorTotal)}</strong></span>
                  </div>
                  {tr.mermasReportadas !== undefined && (
                    <span className="flex items-center gap-1 text-amber-600 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" /> {tr.mermasReportadas} mermas
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel Detalle Lateral */}
        <div className="lg:col-span-1">
          {selectedTransfer ? (
            <div className="card p-6 space-y-6 sticky top-6 border border-gray-200 dark:border-gray-800">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white font-mono">{selectedTransfer.codigo}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Asignado: {selectedTransfer.asignado}</p>
                </div>
                <button 
                  onClick={() => setSelectedTransfer(null)} 
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm font-bold"
                >
                  Cerrar
                </button>
              </div>

              <div className="space-y-3 bg-gray-50 dark:bg-slate-800/40 p-4 rounded-xl text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Ruta:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedTransfer.origen} → {selectedTransfer.destino}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fecha Envío:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedTransfer.fecha}</span>
                </div>
                {selectedTransfer.observaciones && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-400 block mb-1">Notas/Obs:</span>
                    <p className="text-gray-600 dark:text-gray-300 italic">{selectedTransfer.observaciones}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Lista de Picking / Artículos</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {selectedTransfer.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-lg text-xs">
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{it.nombre}</p>
                        <p className="font-mono text-[10px] text-gray-400">{it.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-700 dark:text-gray-300">{it.cantidad} Unidades</p>
                        {it.recibido !== undefined && (
                          <p className="text-[10px] text-green-600 font-medium">Recibido: {it.recibido}</p>
                        )}
                        {it.merma !== undefined && it.merma > 0 && (
                          <p className="text-[10px] text-red-500 font-medium">Merma: {it.merma}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones de acción / transición de estado */}
              <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                {selectedTransfer.estado === "Borrador" && (
                  <button 
                    onClick={() => handleTransitionStatus(selectedTransfer.id, "En Tránsito")}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    <Truck className="w-4 h-4" /> Despachar Envío (En Tránsito)
                  </button>
                )}
                {selectedTransfer.estado === "En Tránsito" && (
                  <button 
                    onClick={() => handleTransitionStatus(selectedTransfer.id, "Recibido")}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Validar y Confirmar Recepción
                  </button>
                )}
                {selectedTransfer.estado === "Recibido" && (
                  <div className="text-center p-4 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Envío recibido y conciliado en Sucursal
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center text-gray-400 py-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-800">
              <Eye className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Seleccioná una transferencia para ver el detalle de carga y validaciones.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal para Crear Transferencia */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-primary" /> Crear Orden de Transferencia (Picking)
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><Trash2 className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required">Almacén Origen</label>
                  <select className="input-field" value={origen} onChange={e => setOrigen(e.target.value)}>
                    <option value="Centro de Distribución (CD)">Centro de Distribución (CD)</option>
                    <option value="Sucursal Centro (Súper)">Sucursal Centro (Súper)</option>
                    <option value="Sucursal San Lorenzo">Sucursal San Lorenzo</option>
                    <option value="Sucursal Luque">Sucursal Luque</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required">Almacén Destino</label>
                  <select className="input-field" value={destino} onChange={e => setDestino(e.target.value)}>
                    <option value="Sucursal Centro (Súper)">Sucursal Centro (Súper)</option>
                    <option value="Centro de Distribución (CD)">Centro de Distribución (CD)</option>
                    <option value="Sucursal San Lorenzo">Sucursal San Lorenzo</option>
                    <option value="Sucursal Luque">Sucursal Luque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Operador Asignado (Picking)</label>
                  <input className="input-field" placeholder="Nombre del chofer/operador" value={asignado} onChange={e => setAsignado(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Observaciones</label>
                  <input className="input-field" placeholder="Detalle del camión, carga refrigerada..." value={observaciones} onChange={e => setObservaciones(e.target.value)} />
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Agregar Artículos</h4>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      className="input-field pl-10" 
                      placeholder="Buscar en catálogo..." 
                      value={prodSearch} 
                      onChange={e => setProdSearch(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto mb-4 bg-gray-50 dark:bg-slate-800/40 p-2 rounded-lg">
                  {MOCK_PRODUCTS.filter(p => p.nombre.toLowerCase().includes(prodSearch.toLowerCase())).map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => handleAddProduct(p)}
                      className="flex items-center justify-between p-2 hover:bg-primary/10 dark:hover:bg-primary/20 rounded-md text-xs text-left"
                    >
                      <span>{p.nombre}</span>
                      <span className="font-mono text-primary font-bold text-[10px]">Agregar +</span>
                    </button>
                  ))}
                </div>

                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Lista para Picking ({newItems.length})</h4>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {newItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-800/70 rounded-lg text-xs">
                      <div>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{item.nombre}</span>
                        <span className="font-mono text-[9px] text-gray-400 block">{item.sku}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input 
                          type="number" 
                          className="input-field w-16 text-center py-0.5 px-1 h-7 text-xs" 
                          value={item.cantidad} 
                          onChange={(e) => handleUpdateQty(item.product_id, parseInt(e.target.value) || 1)}
                          min={1} 
                        />
                        <button onClick={() => handleRemoveProduct(item.product_id)} className="text-red-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  {newItems.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-6">Haz clic en los productos para agregarlos al picking.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" className="btn-outline flex-1" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="button" className="btn-primary flex-1 font-bold" onClick={handleCreateTransfer}>Guardar Borrador de Transferencia</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
