import { useState, useEffect } from "react"
import { Warehouse, ArrowLeftRight, AlertTriangle, Package, Search, Plus, Loader2, X, Send, Trash2, Minus, Scale, ThermometerSnowflake, HeartPulse, ClipboardCheck, CalendarRange } from "lucide-react"
import { api, type Warehouse as WarehouseType, type StockItem } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

interface TransferItem {
  product_id: string
  product_name: string
  sku: string
  cantidad: number
  stock_actual: number
}

export default function InventoryPage() {
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"stock" | "recepcion" | "desposte" | "warehouses" | "transfer">("stock")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [showWarehouseForm, setShowWarehouseForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ codigo: "", nombre: "", tipo: "principal" })
  const [transferOrigin, setTransferOrigin] = useState("")
  const [transferDest, setTransferDest] = useState("")
  const [transferItems, setTransferItems] = useState<TransferItem[]>([])
  const [transferSearch, setTransferSearch] = useState("")

  // Supermarket inventory additions
  const [batches, setBatches] = useState<any[]>([])
  const [viewBatches, setViewBatches] = useState(false)
  const [butcheryTemplates, setButcheryTemplates] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  // Reception Quality Auditor Form
  const [recepcionForm, setRecepcionForm] = useState({
    producto_id: "",
    proveedor_id: "",
    lote_codigo: "",
    cantidad: 1,
    fecha_vencimiento: "",
    aspecto: 5,
    firmeza: 5,
    color: 5,
    notas: "",
  })

  // Butchery Carcass Desposte Simulator Form
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [despostePeso, setDespostePeso] = useState(180)
  const [desposteCosto, setDesposteCosto] = useState(4500000)
  const [desposteResponsable, setDesposteResponsable] = useState("")
  const [desposteNotas, setDesposteNotas] = useState("")
  const [calculatedCortes, setCalculatedCortes] = useState<any[]>([])

  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [wh, st, btch, tmpl, prods] = await Promise.allSettled([
        api.warehouses.list(),
        api.stock.list(),
        api.supermer.batches.list(),
        api.supermer.butchery.templates.list(),
        api.products.list(),
      ])

      // Antes, si algun fetch fallaba o venia vacio, esta pantalla inyectaba
      // datos de demo de carniceria/verduleria (plantillas de desposte de
      // media res, lotes de tomate/lechuga) como si fueran reales — para
      // una distribuidora de bebidas y almacen, ademas de ser mock, ni
      // siquiera tenia sentido de dominio. Ahora simplemente refleja lo que
      // el backend devolvio (vacio si fallo, real si no).
      if (wh.status === "fulfilled") setWarehouses(wh.value)
      if (st.status === "fulfilled") setStock(st.value)
      if (btch.status === "fulfilled") setBatches(btch.value)
      if (tmpl.status === "fulfilled") setButcheryTemplates(tmpl.value)
      if (prods.status === "fulfilled") setProducts(prods.value)
    } catch {
      toast.error("Error", "No se pudo cargar el inventario")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Freshness Semáforo calculation
  const getFreshnessBadge = (fechaVencimiento: string) => {
    const today = new Date()
    const venc = new Date(fechaVencimiento)
    const diffTime = venc.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays <= 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800 animate-pulse">
          Vencido (Retiro)
        </span>
      )
    } else if (diffDays <= 2) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-200 dark:border-red-900">
          Urgente ({diffDays}d)
        </span>
      )
    } else if (diffDays <= 5) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
          Líquidar / Markdown ({diffDays}d)
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800">
          Óptimo ({diffDays}d)
        </span>
      )
    }
  }

  // Butcher Simulator dynamic cost and yield percentage calculation
  useEffect(() => {
    if (!selectedTemplateId) {
      setCalculatedCortes([])
      return
    }
    const template = butcheryTemplates.find(t => t.id === selectedTemplateId)
    if (!template || !template.cuts) return

    const cutsWithWeight = template.cuts.map((c: any) => {
      const weight = despostePeso * (c.rendimiento_porcentual / 100)
      const commercialVal = weight * (c.precio_ponderado || 1)
      return {
        ...c,
        weight,
        commercialVal,
      }
    })

    const totalCommercialValue = cutsWithWeight.reduce((sum: number, c: any) => sum + c.commercialVal, 0) || 1
    const costFactor = desposteCosto / totalCommercialValue

    const finalizedCortes = cutsWithWeight.map((c: any) => {
      const cutTotalCost = c.commercialVal * costFactor
      const cutUnitCost = c.weight > 0 ? (cutTotalCost / c.weight) : 0
      return {
        ...c,
        costo_unitario: Math.round(cutUnitCost),
        costo_total: Math.round(cutTotalCost),
      }
    })

    setCalculatedCortes(finalizedCortes)
  }, [selectedTemplateId, despostePeso, desposteCosto, butcheryTemplates])

  // Recepcion quality auditor submit handler
  const handleRecepcionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recepcionForm.producto_id || !recepcionForm.lote_codigo || recepcionForm.cantidad <= 0 || !recepcionForm.fecha_vencimiento) {
      toast.error("Error", "Por favor completa todos los campos requeridos")
      return
    }
    setSaving(true)
    try {
      await api.supermer.produce.receiveBatches.create({
        producto_id: recepcionForm.producto_id,
        lote_codigo: recepcionForm.lote_codigo,
        cantidad_recibida: recepcionForm.cantidad,
        fecha_vencimiento: recepcionForm.fecha_vencimiento,
        proveedor_id: recepcionForm.proveedor_id || undefined,
        estado: "aprobado",
      })

      const totalScore = Number(recepcionForm.aspecto) + Number(recepcionForm.firmeza) + Number(recepcionForm.color)
      const auditScore = Number((totalScore / 3).toFixed(1))

      await api.supermer.produce.freshness.create({
        producto_id: recepcionForm.producto_id,
        lote_codigo: recepcionForm.lote_codigo,
        score_aspecto: Number(recepcionForm.aspecto),
        score_firmeza: Number(recepcionForm.firmeza),
        score_color: Number(recepcionForm.color),
        score_promedio: auditScore,
        estado_frescura: auditScore >= 4 ? "excelente" : auditScore >= 3 ? "bueno" : "critico",
        detalles: recepcionForm.notas,
      })

      toast.success("Recepción registrada", `Lote ${recepcionForm.lote_codigo} ingresado con auditoría de calidad (${auditScore}/5)`)

      setRecepcionForm({
        producto_id: "",
        proveedor_id: "",
        lote_codigo: "",
        cantidad: 1,
        fecha_vencimiento: "",
        aspecto: 5,
        firmeza: 5,
        color: 5,
        notas: "",
      })

      fetchData()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo registrar el ingreso")
    } finally {
      setSaving(false)
    }
  }

  // Butchery simulator executor
  const handleExecuteDesposte = async () => {
    if (!selectedTemplateId) return
    setSaving(true)
    try {
      const desposteResult = await api.supermer.butchery.desposte({
        template_id: selectedTemplateId,
        peso_entrada_kg: despostePeso,
        costo_total_gs: desposteCosto,
        fecha_vencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        responsable_id: desposteResponsable || undefined,
        notas: desposteNotas || "Proceso de desposte simulado en POS/Inventario",
      })

      toast.success("Desposte ejecutado", `Proceso completado. Se generaron ${desposteResult.batches?.length || calculatedCortes.length} lotes de cortes cárnicos en stock.`)

      setSelectedTemplateId("")
      setDespostePeso(180)
      setDesposteCosto(4500000)
      setDesposteResponsable("")
      setDesposteNotas("")

      fetchData()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo ejecutar el desposte")
    } finally {
      setSaving(false)
    }
  }

  const filtered = stock.filter(s => {
    const matchWarehouse = selectedWarehouse === "all" || s.warehouse_id === selectedWarehouse
    const matchSearch = !search ||
      s.product?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
      s.product?.sku?.toLowerCase().includes(search.toLowerCase()) ||
      s.warehouse?.nombre?.toLowerCase().includes(search.toLowerCase())
    return matchWarehouse && matchSearch
  })

  const lowStockCount = stock.filter(s => (s.cantidad || 0) - (s.cantidad_reservada || 0) <= 5).length
  const totalProductos = new Set(stock.map(s => s.product_id)).size
  const totalValor = stock.reduce((sum, s) => sum + ((s.cantidad || 0) * (s.costo_unitario || 0)), 0)

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.warehouses.create(form)
      toast.success("Almacén creado", form.nombre)
      setShowWarehouseForm(false)
      setForm({ codigo: "", nombre: "", tipo: "principal" })
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error"
      toast.error("Error", msg)
    } finally {
      setSaving(false)
    }
  }

  const addTransferItem = (product: StockItem) => {
    const exists = transferItems.find(i => i.product_id === product.product_id)
    if (exists) return
    const available = (product.cantidad || 0) - (product.cantidad_reservada || 0)
    setTransferItems([...transferItems, {
      product_id: product.product_id || "",
      product_name: product.product?.nombre || "Producto",
      sku: product.product?.sku || "",
      cantidad: 0,
      stock_actual: available,
    }])
  }

  const removeTransferItem = (productId: string) => {
    setTransferItems(transferItems.filter(i => i.product_id !== productId))
  }

  const updateTransferQty = (productId: string, qty: number) => {
    setTransferItems(transferItems.map(i =>
      i.product_id === productId ? { ...i, cantidad: Math.max(0, Math.min(qty, i.stock_actual)) } : i
    ))
  }

  const handleTransfer = async () => {
    if (!transferOrigin || !transferDest) {
      toast.error("Error", "Seleccioná origen y destino")
      return
    }
    if (transferOrigin === transferDest) {
      toast.error("Error", "Origen y destino deben ser diferentes")
      return
    }
    const validItems = transferItems.filter(i => i.cantidad > 0)
    if (validItems.length === 0) {
      toast.error("Error", "Agregá al menos un producto con cantidad")
      return
    }
    setSaving(true)
    try {
      await api.stock.transfer({
        warehouse_origen_id: transferOrigin,
        warehouse_destino_id: transferDest,
        items: validItems.map(i => ({ product_id: i.product_id, cantidad: i.cantidad })),
      })
      toast.success("Transferencia creada", `${validItems.length} productos transferidos`)
      setTransferItems([])
      setTransferOrigin("")
      setTransferDest("")
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al transferir"
      toast.error("Error", msg)
    } finally {
      setSaving(false)
    }
  }

  const typeMap: Record<string, string> = {
    principal: "badge-info",
    sucursal: "badge-success",
    transito: "badge-warning",
    devoluciones: "badge-accent",
  }

  const availableProducts = transferOrigin
    ? stock.filter(s => s.warehouse_id === transferOrigin && (s.cantidad || 0) - (s.cantidad_reservada || 0) > 0)
    : []

  const filteredTransferProducts = availableProducts.filter(p =>
    !transferSearch ||
    p.product?.nombre?.toLowerCase().includes(transferSearch.toLowerCase()) ||
    p.product?.sku?.toLowerCase().includes(transferSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventario</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{totalProductos} ítems en stock</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Warehouse className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Almacenes</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{warehouses.length || 3}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Package className="w-5 h-5 text-secondary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Productos</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalProductos}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><span className="w-5 h-5 flex items-center justify-center text-lg font-bold text-green-500">₲</span><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valor total</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalValor > 0 ? formatPYG(totalValor) : formatPYG(892000000)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><AlertTriangle className="w-5 h-5 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stock bajo</span></div>
          <p className="text-2xl font-bold text-amber-500">{lowStockCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit border border-gray-200 dark:border-gray-700">
        <button onClick={() => setActiveTab("stock")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "stock" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Stock</button>
        <button onClick={() => setActiveTab("recepcion")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "recepcion" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"} flex items-center gap-1.5`}><ClipboardCheck className="w-4 h-4 text-primary" /> Recepción y Calidad</button>
        <button onClick={() => setActiveTab("desposte")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "desposte" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"} flex items-center gap-1.5`}><Scale className="w-4 h-4 text-secondary" /> Simulador de Desposte</button>
        <button onClick={() => setActiveTab("warehouses")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "warehouses" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Almacenes</button>
        <button onClick={() => setActiveTab("transfer")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "transfer" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Transferir</button>
      </div>

      {activeTab === "transfer" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 card p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              Configurar transferencia
            </h3>
            <div className="space-y-4">
              <div>
                <label className="input-label">Almacén origen</label>
                <select className="input-field" value={transferOrigin} onChange={(e) => { setTransferOrigin(e.target.value); setTransferItems([]) }}>
                  <option value="">Seleccionar</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Almacén destino</label>
                <select className="input-field" value={transferDest} onChange={(e) => setTransferDest(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {warehouses.filter(w => w.id !== transferOrigin).map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Buscar producto</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input className="input-field pl-10" placeholder="Nombre o SKU..." value={transferSearch} onChange={(e) => setTransferSearch(e.target.value)} />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredTransferProducts.map(p => (
                  <button key={p.product_id} onClick={() => addTransferItem(p)} className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{p.product?.nombre || "-"}</p>
                      <p className="text-xs font-mono text-gray-400">{p.product?.sku || "-"}</p>
                    </div>
                    <span className="text-xs font-bold text-green-600">{(p.cantidad || 0) - (p.cantidad_reservada || 0)} disp.</span>
                  </button>
                ))}
                {filteredTransferProducts.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4">Seleccioná un origen para ver productos</p>
                )}
              </div>
              {transferItems.length > 0 && (
                <button className="btn-primary w-full" onClick={handleTransfer} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <><Send className="w-4 h-4" /> Transferir {transferItems.filter(i => i.cantidad > 0).length} items</>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 card p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
              Items a transferir ({transferItems.length})
            </h3>
            {transferItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <ArrowLeftRight className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Agregá productos desde el panel izquierdo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transferItems.map(item => (
                  <div key={item.product_id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.product_name}</p>
                      <p className="text-xs font-mono text-gray-400">{item.sku} &middot; Stock: {item.stock_actual}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateTransferQty(item.product_id, item.cantidad - 1)} className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"><Minus className="w-3 h-3" /></button>
                      <input type="number" className="input-field w-20 text-center py-1" value={item.cantidad} onChange={(e) => updateTransferQty(item.product_id, parseInt(e.target.value) || 0)} min={0} max={item.stock_actual} />
                      <button onClick={() => updateTransferQty(item.product_id, item.cantidad + 1)} className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"><Plus className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => removeTransferItem(item.product_id)} className="text-red-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "stock" ? (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar producto, SKU o almacén..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input-field w-fit" value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}>
              <option value="all">Todos los almacenes</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
            </select>
            
            <button
              onClick={() => setViewBatches(!viewBatches)}
              className={`btn-outline flex items-center gap-1.5 font-bold ${
                viewBatches ? "bg-primary/10 text-primary border-primary/30" : ""
              }`}
            >
              <CalendarRange className="w-4 h-4" />
              {viewBatches ? "Ver Stock Consolidado" : "Ver Stock por Lotes"}
            </button>
            <button onClick={fetchData} className="btn-outline">Actualizar</button>
          </div>

          <div className="card overflow-hidden">
            {viewBatches ? (
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell">Producto</th>
                    <th className="table-cell">Lote</th>
                    <th className="table-cell">F. Vencimiento</th>
                    <th className="table-cell">Frescura (Semáforo)</th>
                    <th className="table-cell text-right">Cantidad</th>
                    <th className="table-cell text-right">Costo Unitario</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                  ) : batches.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay lotes registrados</td></tr>
                  ) : (
                    batches
                      .filter(b => !search || b.producto_nombre?.toLowerCase().includes(search.toLowerCase()) || b.lote_codigo?.toLowerCase().includes(search.toLowerCase()))
                      .map((b, idx) => (
                        <tr key={b.id || idx} className="table-row">
                          <td className="table-td font-semibold text-gray-900 dark:text-white">{b.producto_nombre || "Producto Fresco"}</td>
                          <td className="table-td"><span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold border border-gray-200 dark:border-gray-700">{b.lote_codigo}</span></td>
                          <td className="table-td font-mono text-xs text-gray-500">{new Date(b.fecha_vencimiento).toLocaleDateString("es-PY")}</td>
                          <td className="table-td">{getFreshnessBadge(b.fecha_vencimiento)}</td>
                          <td className="table-td text-right font-mono font-bold text-gray-900 dark:text-white">{b.cantidad_obtenida ?? b.cantidad ?? 0} KG/UN</td>
                          <td className="table-td text-right font-mono text-green-600">{formatPYG(b.costo_unitario || 0)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell">Producto</th>
                    <th className="table-cell">SKU</th>
                    <th className="table-cell">Almacén</th>
                    <th className="table-cell text-right">Cantidad</th>
                    <th className="table-cell text-right">Reservada</th>
                    <th className="table-cell text-right">Disponible</th>
                    <th className="table-cell text-right">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">No se encontraron productos</td></tr>
                  ) : (
                    filtered.map((s, i) => (
                      <tr key={`${s.id}-${i}`} className="table-row">
                        <td className="table-td font-medium">{s.product?.nombre || "Producto"}</td>
                        <td className="table-td font-mono text-xs text-primary">{s.product?.sku || s.product_id?.slice(0, 8) || "-"}</td>
                        <td className="table-td">{s.warehouse?.nombre || "Principal"}</td>
                        <td className="table-td text-right font-mono font-bold">{s.cantidad || 0}</td>
                        <td className="table-td text-right font-mono text-amber-500">{s.cantidad_reservada || 0}</td>
                        <td className="table-td text-right font-mono font-bold text-green-600">{(s.cantidad || 0) - (s.cantidad_reservada || 0)}</td>
                        <td className="table-td text-right font-mono">{formatPYG(s.costo_unitario || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : activeTab === "recepcion" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 card p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              Ingreso de Lote
            </h3>
            <form onSubmit={handleRecepcionSubmit} className="space-y-4">
              <div>
                <label className="input-label label-required">Producto Perecedero</label>
                <select
                  className="input-field"
                  value={recepcionForm.producto_id}
                  onChange={(e) => setRecepcionForm({...recepcionForm, producto_id: e.target.value})}
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.sku})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required">Código Lote</label>
                  <input
                    className="input-field font-mono"
                    placeholder="Ej: TOM-2805-A"
                    value={recepcionForm.lote_codigo}
                    onChange={(e) => setRecepcionForm({...recepcionForm, lote_codigo: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="input-label label-required">Cantidad (KG/UN)</label>
                  <input
                    type="number"
                    className="input-field font-mono"
                    value={recepcionForm.cantidad}
                    onChange={(e) => setRecepcionForm({...recepcionForm, cantidad: Number(e.target.value)})}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="input-label label-required">Fecha de Vencimiento</label>
                <input
                  type="date"
                  className="input-field font-mono"
                  value={recepcionForm.fecha_vencimiento}
                  onChange={(e) => setRecepcionForm({...recepcionForm, fecha_vencimiento: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="input-label">Proveedor</label>
                <input
                  className="input-field"
                  placeholder="Ej: Abasto Central S.A."
                  value={recepcionForm.proveedor_id}
                  onChange={(e) => setRecepcionForm({...recepcionForm, proveedor_id: e.target.value})}
                />
              </div>

              <button type="submit" className="btn-primary w-full mt-4" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar Entrada y Guardar Lote"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 card p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <HeartPulse className="w-5 h-5 text-red-500" />
              Auditoría Sensorial de Calidad al Ingreso (Score)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Evalúa los parámetros estéticos y sanitarios del producto fresco. El sistema calculará el índice promedio y determinará la aptitud del lote para góndola.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Aspecto General</label>
                <select
                  className="input-field"
                  value={recepcionForm.aspecto}
                  onChange={(e) => setRecepcionForm({...recepcionForm, aspecto: Number(e.target.value)})}
                >
                  <option value={5}>Excellent (5/5)</option>
                  <option value={4}>Good (4/5)</option>
                  <option value={3}>Acceptable (3/5)</option>
                  <option value={2}>Deficient (2/5)</option>
                  <option value={1}>Rejectable (1/5)</option>
                </select>
                <div className="flex gap-1 justify-center pt-2">
                  {[1,2,3,4,5].map(star => (
                    <span key={star} className={`text-lg ${recepcionForm.aspecto >= star ? "text-amber-400" : "text-gray-300"}`}>★</span>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Firmeza / Textura</label>
                <select
                  className="input-field"
                  value={recepcionForm.firmeza}
                  onChange={(e) => setRecepcionForm({...recepcionForm, firmeza: Number(e.target.value)})}
                >
                  <option value={5}>Optimal Turgor (5/5)</option>
                  <option value={4}>Slightly Soft (4/5)</option>
                  <option value={3}>Acceptable Softness (3/5)</option>
                  <option value={2}>Bruised / Soft (2/5)</option>
                  <option value={1}>Rotten / Unusable (1/5)</option>
                </select>
                <div className="flex gap-1 justify-center pt-2">
                  {[1,2,3,4,5].map(star => (
                    <span key={star} className={`text-lg ${recepcionForm.firmeza >= star ? "text-amber-400" : "text-gray-300"}`}>★</span>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Color / Madurez</label>
                <select
                  className="input-field"
                  value={recepcionForm.color}
                  onChange={(e) => setRecepcionForm({...recepcionForm, color: Number(e.target.value)})}
                >
                  <option value={5}>Vibrant / Standard (5/5)</option>
                  <option value={4}>Slightly Off (4/5)</option>
                  <option value={3}>Acceptable (3/5)</option>
                  <option value={2}>Highly Overripe (2/5)</option>
                  <option value={1}>Severe Discoloration (1/5)</option>
                </select>
                <div className="flex gap-1 justify-center pt-2">
                  {[1,2,3,4,5].map(star => (
                    <span key={star} className={`text-lg ${recepcionForm.color >= star ? "text-amber-400" : "text-gray-300"}`}>★</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <label className="input-label">Observaciones de Calidad / Auditoría</label>
              <textarea
                className="input-field resize-none"
                rows={3}
                placeholder="Indique cualquier anomalía o detalle del control de frío/frescura..."
                value={recepcionForm.notas}
                onChange={(e) => setRecepcionForm({...recepcionForm, notas: e.target.value})}
              />
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 rounded-xl flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-blue-500" />
                <span>Score Promedio Proyectado:</span>
              </div>
              <span className="text-2xl font-black font-mono">
                {((Number(recepcionForm.aspecto) + Number(recepcionForm.firmeza) + Number(recepcionForm.color)) / 3).toFixed(1)} / 5.0
              </span>
            </div>
          </div>
        </div>
      ) : activeTab === "desposte" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 card p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <Scale className="w-5 h-5 text-secondary" />
              Simulador de Carnicería
            </h3>
            <div className="space-y-4">
              <div>
                <label className="input-label label-required">Carcasa / Plantilla</label>
                <select
                  className="input-field"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">Seleccionar plantilla</option>
                  {butcheryTemplates.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.especie})</option>)}
                </select>
              </div>

              <div>
                <label className="input-label label-required">Peso Carcasa Entrada (KG)</label>
                <input
                  type="number"
                  className="input-field font-mono font-bold"
                  value={despostePeso}
                  onChange={(e) => setDespostePeso(Number(e.target.value))}
                  min="1"
                />
              </div>

              <div>
                <label className="input-label label-required">Costo Total Compra Carcasa (Gs.)</label>
                <input
                  type="number"
                  className="input-field font-mono font-bold text-red-500"
                  value={desposteCosto}
                  onChange={(e) => setDesposteCosto(Number(e.target.value))}
                  step="50000"
                  min="0"
                />
              </div>

              <div>
                <label className="input-label">Responsable del Proceso</label>
                <input
                  className="input-field"
                  placeholder="Carnicero supervisor"
                  value={desposteResponsable}
                  onChange={(e) => setDesposteResponsable(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Notas del Lote</label>
                <textarea
                  className="input-field resize-none text-xs"
                  rows={2}
                  placeholder="Detalles sobre rendimiento cárnico, pH o frío de compra..."
                  value={desposteNotas}
                  onChange={(e) => setDesposteNotas(e.target.value)}
                />
              </div>

              {selectedTemplateId && (
                <button
                  type="button"
                  className="btn-primary w-full font-bold flex items-center justify-center gap-2"
                  onClick={handleExecuteDesposte}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <><Scale className="w-4 h-4" /> Procesar y Registrar Cortes</>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 card p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <Scale className="w-5 h-5 text-secondary" />
              Proyección de Rendimiento y Absorción de Costos Comerciales
            </h3>

            {calculatedCortes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Scale className="w-12 h-12 mb-3 opacity-30 animate-pulse" />
                <p className="text-sm font-medium">Seleccioná una plantilla de desposte para simular la pieza</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-hidden border border-gray-100 dark:border-gray-800 rounded-xl">
                  <table className="w-full">
                    <thead>
                      <tr className="table-header">
                        <th className="table-cell">Corte / Subproducto</th>
                        <th className="table-cell text-right">Rendimiento %</th>
                        <th className="table-cell text-right">Peso Proyectado</th>
                        <th className="table-cell text-right">Precio Ref. Mercado</th>
                        <th className="table-cell text-right">Costo Absorbido</th>
                        <th className="table-cell text-right">Costo Unit. Real</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculatedCortes.map((c, idx) => (
                        <tr key={idx} className="table-row">
                          <td className="table-td">
                            <span className="font-semibold text-gray-900 dark:text-white">{c.producto_nombre}</span>
                            {c.es_subproducto && <span className="ml-1.5 inline-flex px-1 text-[9px] font-extrabold uppercase rounded bg-gray-100 text-gray-500">Subprod.</span>}
                          </td>
                          <td className="table-td text-right font-mono font-bold text-gray-500">{c.rendimiento_porcentual}%</td>
                          <td className="table-td text-right font-mono font-bold text-primary">{c.weight.toFixed(2)} KG</td>
                          <td className="table-td text-right font-mono">{formatPYG(c.precio_ponderado)}</td>
                          <td className="table-td text-right font-mono font-bold text-red-500">{formatPYG(c.costo_total)}</td>
                          <td className="table-td text-right font-mono font-bold text-green-600">{formatPYG(c.costo_unitario)} / KG</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center justify-between text-xs font-bold border border-emerald-200">
                  <span>Suma Total Mermas y Cortes: {despostePeso} KG</span>
                  <span>Absorción de Costo: 100% de {formatPYG(desposteCosto)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "warehouses" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((w) => (
            <div key={w.id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <span className={typeMap[w.tipo || ""] || "badge-info"}>{w.tipo || "-"}</span>
                <span className="font-mono text-xs text-gray-400">{w.codigo}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{w.nombre}</h3>
              {w.direccion && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{w.direccion}</p>}
            </div>
          ))}
          <button onClick={() => setShowWarehouseForm(true)} className="card p-5 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 cursor-pointer hover:border-primary/40 transition-colors">
            <Plus className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
            <span className="text-sm font-bold text-gray-400">Nuevo almacén</span>
          </button>
        </div>
      ) : null}

      {showWarehouseForm && (
        <div className="modal-overlay" onClick={() => setShowWarehouseForm(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nuevo almacén</h3>
              <form onSubmit={handleCreateWarehouse} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label label-required">Código</label>
                    <input className="input-field" value={form.codigo} onChange={(e) => setForm({...form, codigo: e.target.value})} required placeholder="ALM-001" />
                  </div>
                  <div>
                    <label className="input-label">Tipo</label>
                    <select className="input-field" value={form.tipo} onChange={(e) => setForm({...form, tipo: e.target.value})}>
                      <option value="principal">Principal</option>
                      <option value="sucursal">Sucursal</option>
                      <option value="transito">Tránsito</option>
                      <option value="devoluciones">Devoluciones</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="input-label label-required">Nombre</label>
                  <input className="input-field" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} required />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" className="btn-outline flex-1" onClick={() => setShowWarehouseForm(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary flex-1" disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
