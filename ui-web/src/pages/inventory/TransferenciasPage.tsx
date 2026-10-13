import { useState, useEffect } from "react"
import { ArrowLeftRight, Search, Plus, Trash2, Send, CheckCircle2, AlertTriangle, Truck, Eye, Loader2, Info } from "lucide-react"
import { api, type Branch, type BranchTransfer, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

export default function TransferenciasPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [transfers, setTransfers] = useState<BranchTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTransfer, setSelectedTransfer] = useState<BranchTransfer | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [search, setSearch] = useState("")
  const toast = useToast()

  // Form state
  const [origen, setOrigen] = useState("")
  const [destino, setDestino] = useState("")
  const [transportista, setTransportista] = useState("")
  const [notas, setNotas] = useState("")
  const [newItems, setNewItems] = useState<{ product_id: string; nombre: string; sku: string; cantidad: number }[]>([])
  const [prodSearch, setProdSearch] = useState("")
  const [prodResults, setProdResults] = useState<Product[]>([])
  const [creating, setCreating] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [b, t] = await Promise.all([api.branches.list(), api.branches.transfers.list()])
      setBranches(b)
      setTransfers(t)
      if (b.length >= 2 && !origen) { setOrigen(b[0].id); setDestino(b[1].id) }
    } catch {
      toast.error("Error", "No se pudieron cargar las transferencias")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    if (!showCreateModal || !prodSearch) { setProdResults([]); return }
    const t = setTimeout(() => {
      api.products.list({ search: prodSearch, activo: true }).then(setProdResults).catch(() => setProdResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [prodSearch, showCreateModal])

  const branchName = (id?: string) => branches.find(b => b.id === id)?.nombre || id || "-"

  const handleAddProduct = (p: Product) => {
    if (newItems.some(i => i.product_id === p.id)) { toast.info("Ya agregado", p.nombre); return }
    setNewItems([...newItems, { product_id: p.id, nombre: p.nombre, sku: p.sku, cantidad: 10 }])
  }
  const handleRemoveProduct = (id: string) => setNewItems(newItems.filter(i => i.product_id !== id))
  const handleUpdateQty = (id: string, qty: number) => setNewItems(newItems.map(i => i.product_id === id ? { ...i, cantidad: Math.max(1, qty) } : i))

  const resetCreateForm = () => {
    setNotas(""); setTransportista(""); setNewItems([]); setProdSearch(""); setProdResults([])
  }

  const handleCreateTransfer = async () => {
    if (!origen || !destino || origen === destino) { toast.error("Error", "Elegi un origen y un destino distintos"); return }
    if (newItems.length === 0) { toast.error("Lista vacia", "Agrega al menos un articulo"); return }
    setCreating(true)
    try {
      await api.branches.transfers.create({
        origen_branch_id: origen,
        destino_branch_id: destino,
        notas: notas || undefined,
        transportista: transportista || undefined,
        items: newItems.map(i => ({ product_id: i.product_id, cantidad: i.cantidad })),
      })
      toast.success("Transferencia creada", "Queda en estado pendiente hasta que la despaches")
      setShowCreateModal(false)
      resetCreateForm()
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo crear la transferencia")
    } finally {
      setCreating(false)
    }
  }

  const handleSend = async (tr: BranchTransfer) => {
    try {
      await api.branches.transfers.send(tr.id)
      toast.success("Despachada", "La transferencia quedo en transito")
      fetchAll()
      setSelectedTransfer(null)
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo despachar la transferencia")
    }
  }

  const handleReceive = async (tr: BranchTransfer) => {
    try {
      await api.branches.transfers.receive(tr.id, {
        items: (tr.items || []).map(it => ({ item_id: it.id, cantidad_recibida: it.cantidad })),
      })
      toast.success("Recibida", "Stock actualizado en la sucursal de destino")
      fetchAll()
      setSelectedTransfer(null)
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo confirmar la recepcion")
    }
  }

  const filteredTransfers = transfers.filter(tr =>
    !search ||
    tr.numero?.toLowerCase().includes(search.toLowerCase()) ||
    branchName(tr.origen_branch_id).toLowerCase().includes(search.toLowerCase()) ||
    branchName(tr.destino_branch_id).toLowerCase().includes(search.toLowerCase()) ||
    tr.estado?.toLowerCase().includes(search.toLowerCase())
  )

  const estadoBadge = (estado: string) =>
    estado === "recibido" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    estado === "en_transito" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"

  if (!loading && branches.length < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
            Transferencias entre Sucursales
          </h1>
        </div>
        <div className="card p-10 text-center space-y-3">
          <Info className="w-8 h-8 text-primary mx-auto" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Esta funcion todavia no aplica</p>
          <p className="text-sm text-gray-500 max-w-lg mx-auto">
            Transferencias mueve mercaderia entre sucursales, y hoy la empresa opera con
            {branches.length === 0 ? " ninguna sucursal configurada" : " una sola sucursal configurada"} en el sistema.
            En cuanto se cargue una segunda sucursal, esta pantalla te va a dejar crear, despachar y recibir transferencias reales.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
            Transferencias entre Sucursales
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Movimiento de mercaderia entre sucursales, con stock real actualizado al recibir.
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva Transferencia
        </button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por numero, origen, destino..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="card p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
          ) : filteredTransfers.length === 0 ? (
            <div className="card p-12 text-center text-gray-400 flex flex-col items-center justify-center">
              <Truck className="w-12 h-12 mb-3 opacity-20" />
              <p>No hay transferencias registradas.</p>
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
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${estadoBadge(tr.estado)}`}>{tr.estado}</span>
                    <span className="font-mono text-xs text-gray-500 font-bold">{tr.numero}</span>
                  </div>
                  <span className="text-xs text-gray-400">{tr.created_at?.slice(0, 10)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Origen</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{tr.origen_nombre || branchName(tr.origen_branch_id)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">Destino</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{tr.destino_nombre || branchName(tr.destino_branch_id)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
                  <span>Items: <strong className="text-gray-700 dark:text-gray-300">{tr.items?.length ?? 0}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-1">
          {selectedTransfer ? (
            <div className="card p-6 space-y-6 sticky top-6 border border-gray-200 dark:border-gray-800">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white font-mono">{selectedTransfer.numero}</h3>
                  {selectedTransfer.transportista && <p className="text-xs text-gray-400 mt-0.5">Transportista: {selectedTransfer.transportista}</p>}
                </div>
                <button onClick={() => setSelectedTransfer(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm font-bold">Cerrar</button>
              </div>

              <div className="space-y-3 bg-gray-50 dark:bg-slate-800/40 p-4 rounded-xl text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Ruta:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedTransfer.origen_nombre || branchName(selectedTransfer.origen_branch_id)} → {selectedTransfer.destino_nombre || branchName(selectedTransfer.destino_branch_id)}</span>
                </div>
                {selectedTransfer.notas && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-400 block mb-1">Notas:</span>
                    <p className="text-gray-600 dark:text-gray-300 italic">{selectedTransfer.notas}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Articulos</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {(selectedTransfer.items || []).map((it, idx) => (
                    <div key={it.id || idx} className="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-lg text-xs">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{it.product_nombre || it.product_id}</p>
                      <div className="text-right">
                        <p className="font-bold text-gray-700 dark:text-gray-300">{it.cantidad} Unidades</p>
                        {it.cantidad_recibida !== undefined && it.cantidad_recibida !== null && (
                          <p className="text-[10px] text-green-600 font-medium">Recibido: {it.cantidad_recibida}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                {selectedTransfer.estado === "pendiente" && (
                  <button onClick={() => handleSend(selectedTransfer)} className="w-full btn-primary flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" /> Despachar (En Transito)
                  </button>
                )}
                {selectedTransfer.estado === "en_transito" && (
                  <button onClick={() => handleReceive(selectedTransfer)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Confirmar Recepcion
                  </button>
                )}
                {selectedTransfer.estado === "recibido" && (
                  <div className="text-center p-4 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Recibida y con stock actualizado
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center text-gray-400 py-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-800">
              <Eye className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Selecciona una transferencia para ver el detalle.</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-primary" /> Nueva Transferencia
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><Trash2 className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required">Sucursal Origen</label>
                  <select className="input-field" value={origen} onChange={e => setOrigen(e.target.value)}>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label label-required">Sucursal Destino</label>
                  <select className="input-field" value={destino} onChange={e => setDestino(e.target.value)}>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Transportista</label>
                  <input className="input-field" placeholder="Chofer u operador" value={transportista} onChange={e => setTransportista(e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Notas</label>
                  <input className="input-field" placeholder="Observaciones" value={notas} onChange={e => setNotas(e.target.value)} />
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Agregar Articulos</h4>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input-field pl-10" placeholder="Buscar en catalogo real..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                </div>

                {prodSearch && (
                  <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto mb-4 bg-gray-50 dark:bg-slate-800/40 p-2 rounded-lg">
                    {prodResults.length === 0 ? (
                      <p className="text-xs text-gray-400 col-span-2 text-center py-3">Sin resultados</p>
                    ) : prodResults.map(p => (
                      <button key={p.id} onClick={() => handleAddProduct(p)} className="flex items-center justify-between p-2 hover:bg-primary/10 dark:hover:bg-primary/20 rounded-md text-xs text-left">
                        <span>{p.nombre}</span>
                        <span className="font-mono text-primary font-bold text-[10px]">Agregar +</span>
                      </button>
                    ))}
                  </div>
                )}

                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Lista ({newItems.length})</h4>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {newItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-800/70 rounded-lg text-xs">
                      <div>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{item.nombre}</span>
                        <span className="font-mono text-[9px] text-gray-400 block">{item.sku}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="number" className="input-field w-16 text-center py-0.5 px-1 h-7 text-xs" value={item.cantidad} onChange={(e) => handleUpdateQty(item.product_id, parseInt(e.target.value) || 1)} min={1} />
                        <button onClick={() => handleRemoveProduct(item.product_id)} className="text-red-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  {newItems.length === 0 && <p className="text-center text-xs text-gray-400 py-6">Busca productos para agregarlos.</p>}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" className="btn-outline flex-1" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="button" className="btn-primary flex-1 font-bold" onClick={handleCreateTransfer} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Crear Transferencia"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
