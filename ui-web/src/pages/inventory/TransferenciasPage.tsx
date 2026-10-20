import { useState, useEffect, useRef, useCallback } from "react"
import {
  ArrowLeftRight, Search, Plus, Trash2, Send, CheckCircle2, AlertTriangle, Truck, Eye, Loader2, Info,
  Boxes, Scan, Camera, CameraOff, Check, X, RefreshCw, ShoppingCart, History, Store, Package, Minus
} from "lucide-react"
import { api, type Warehouse, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { useBarcodeScannerCamera } from "../../hooks"

interface CartItem {
  product: Product
  cantidad: number
  stockOrigen: number
  stockDestino: number
}

export default function TransferenciasPage() {
  const toast = useToast()

  // Pestaña Activa
  const [activeTab, setActiveTab] = useState<"picking" | "historial" | "sucursales">("picking")

  // Depósitos
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loadingWh, setLoadingWh] = useState(true)
  const [origenId, setOrigenId] = useState<string>("")
  const [destinoId, setDestinoId] = useState<string>("")

  // Estado del Picking
  const [searchCode, setSearchCode] = useState("")
  const [searchingProd, setSearchingProd] = useState(false)
  const [activeProduct, setActiveProduct] = useState<Product | null>(null)
  const [activeProductStock, setActiveProductStock] = useState<{ origen: number; destino: number }>({ origen: 0, destino: 0 })
  const [replenishQty, setReplenishQty] = useState<number>(1)
  const [submittingSingle, setSubmittingSingle] = useState(false)

  // Carro de Picking (Lote)
  const [pickingCart, setPickingCart] = useState<CartItem[]>([])
  const [submittingCart, setSubmittingCart] = useState(false)

  // Historial de Transferencias Internas
  const [internalTransfers, setInternalTransfers] = useState<any[]>([])
  const [loadingInternal, setLoadingInternal] = useState(false)

  // Cámara Escáner Móvil
  const [showCamera, setShowCamera] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Cargar Depósitos
  const loadWarehouses = useCallback(async () => {
    setLoadingWh(true)
    try {
      const data = await api.warehouses.list()
      if (Array.isArray(data)) {
        setWarehouses(data)
        const central = data.find(w => w.codigo === "CENTRAL" || w.tipo === "principal") || data[0]
        const salon = data.find(w => w.codigo === "SALON" || w.tipo === "salon") || (data.length > 1 ? data[1] : data[0])
        if (central) setOrigenId(central.id)
        if (salon) setDestinoId(salon.id)
      }
    } catch (e: any) {
      toast.error("Error al cargar depósitos", e.message)
    } finally {
      setLoadingWh(false)
    }
  }, [])

  // Cargar Historial de Transferencias Internas
  const loadInternalTransfers = useCallback(async () => {
    setLoadingInternal(true)
    try {
      const res = await api.inventory.transfers.list({ limit: 30 })
      setInternalTransfers(Array.isArray(res) ? res : [])
    } catch {
      setInternalTransfers([])
    } finally {
      setLoadingInternal(false)
    }
  }, [])

  useEffect(() => {
    loadWarehouses()
    loadInternalTransfers()
  }, [loadWarehouses, loadInternalTransfers])

  // Obtener stocks por producto en origen y destino
  const fetchProductStocks = async (prodId: string, origWh: string, destWh: string) => {
    try {
      const stocks = await api.inventory.getProductStock(prodId)
      if (Array.isArray(stocks)) {
        const orig = stocks.find((s: any) => s.warehouse_id === origWh)?.cantidad || 0
        const dest = stocks.find((s: any) => s.warehouse_id === destWh)?.cantidad || 0
        return { origen: orig, destino: dest }
      }
    } catch {
      // fallback
    }
    return { origen: 0, destino: 0 }
  }

  // Buscar / Escanear Producto
  const handleProductLookup = async (code: string) => {
    const clean = code.trim()
    if (!clean) return
    setSearchingProd(true)
    try {
      const results = await api.products.list({ search: clean, activo: true, limit: 5 })
      if (results && results.length > 0) {
        const prod = results[0]
        setActiveProduct(prod)
        const stocks = await fetchProductStocks(prod.id, origenId, destinoId)
        setActiveProductStock(stocks)
        setReplenishQty(1)
        toast.success("Producto Identificado", `${prod.nombre} · Stock en Trastienda: ${stocks.origen}`)
        if (showCamera) setShowCamera(false)
      } else {
        toast.error("No Encontrado", `No se encontró producto con código o nombre "${clean}"`)
      }
    } catch (e: any) {
      toast.error("Error en búsqueda", e.message)
    } finally {
      setSearchingProd(false)
      setSearchCode("")
    }
  }

  // Hook Cámara
  const { videoRef, cameraActive, cameraLoading, startCamera, stopCamera } = useBarcodeScannerCamera({
    onScan: (scanned) => {
      handleProductLookup(scanned)
    },
  })

  useEffect(() => {
    if (showCamera) {
      startCamera()
    } else {
      stopCamera()
    }
  }, [showCamera])

  // Acción 1: Reponer Inmediato (1 producto)
  const handleQuickReplenishSingle = async () => {
    if (!activeProduct || !origenId || !destinoId) return
    if (replenishQty <= 0) {
      toast.error("Cantidad Inválida", "La cantidad debe ser mayor a cero")
      return
    }
    setSubmittingSingle(true)
    try {
      const res = await api.inventory.transfers.quickReplenish({
        warehouse_origen_id: origenId,
        warehouse_destino_id: destinoId,
        items: [{ product_id: activeProduct.id, cantidad: replenishQty }],
        observaciones: `Picking rápido Góndola · ${activeProduct.nombre}`,
      })
      toast.success(
        "Góndola Repuesta",
        `Se trasladaron ${replenishQty} uds de ${activeProduct.nombre} a Salón Góndola (${res.codigo})`
      )
      // Refrescar stocks en pantalla
      const updated = await fetchProductStocks(activeProduct.id, origenId, destinoId)
      setActiveProductStock(updated)
      loadInternalTransfers()
      // Mantener foco en el buscador
      setTimeout(() => searchInputRef.current?.focus(), 100)
    } catch (e: any) {
      toast.error("Error al reponer", e.message)
    } finally {
      setSubmittingSingle(false)
    }
  }

  // Acción 2: Agregar al Carro de Reposición
  const handleAddToCart = () => {
    if (!activeProduct) return
    if (replenishQty <= 0) {
      toast.error("Cantidad Inválida", "La cantidad debe ser mayor a cero")
      return
    }
    const existingIndex = pickingCart.findIndex(i => i.product.id === activeProduct.id)
    if (existingIndex >= 0) {
      const updated = [...pickingCart]
      updated[existingIndex].cantidad += replenishQty
      setPickingCart(updated)
      toast.info("Carro Actualizado", `Total: ${updated[existingIndex].cantidad} uds de ${activeProduct.nombre}`)
    } else {
      setPickingCart([
        ...pickingCart,
        {
          product: activeProduct,
          cantidad: replenishQty,
          stockOrigen: activeProductStock.origen,
          stockDestino: activeProductStock.destino,
        }
      ])
      toast.success("Agregado al Carro", `${replenishQty} uds de ${activeProduct.nombre}`)
    }
    setActiveProduct(null)
    setSearchCode("")
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }

  // Acción 3: Confirmar Traslado del Carro Completo
  const handleConfirmCartReplenish = async () => {
    if (pickingCart.length === 0 || !origenId || !destinoId) return
    setSubmittingCart(true)
    try {
      const payload = {
        warehouse_origen_id: origenId,
        warehouse_destino_id: destinoId,
        items: pickingCart.map(item => ({
          product_id: item.product.id,
          cantidad: item.cantidad,
        })),
        observaciones: `Picking Lote Góndola (${pickingCart.length} productos)`,
      }
      const res = await api.inventory.transfers.quickReplenish(payload)
      toast.success(
        "Carro de Reposición Confirmado",
        `Se trasladaron ${res.total_unidades} unidades a Salón Góndola bajo comprobante ${res.codigo}`
      )
      setPickingCart([])
      loadInternalTransfers()
    } catch (e: any) {
      toast.error("Error al confirmar carro", e.message)
    } finally {
      setSubmittingCart(false)
    }
  }

  const origenWh = warehouses.find(w => w.id === origenId)
  const destinoWh = warehouses.find(w => w.id === destinoId)

  return (
    <div className="space-y-6">
      {/* ── ENCABEZADO Y TABS ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
            Reposición & Transferencias de Mercadería
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Picking con escáner, traslado rápido de Trastienda a Góndola y trazabilidad Kardex en tiempo real.
          </p>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-bold border border-gray-200 dark:border-slate-700 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("picking")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "picking"
                ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Picking Góndola</span>
            {pickingCart.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[9px] font-black">
                {pickingCart.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("historial")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "historial"
                ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial Traslados</span>
          </button>
        </div>
      </div>

      {/* ── CONTENIDO: PESTAÑA PICKING & REPOSICIÓN ───────────────────── */}
      {activeTab === "picking" && (
        <div className="space-y-6">
          {/* Barra de Depósitos (Trastienda -> Salón) */}
          <div className="card p-4 sm:p-5 bg-gradient-to-r from-purple-50/50 via-white to-indigo-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/60 border border-purple-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/20">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">Circuito de Reposición en Piso</h3>
                  <p className="text-xs text-gray-500">Traslado ágil de bultos y mercaderías a piso de venta</p>
                </div>
              </div>

              {/* Selector Origen y Destino */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Origen (Bajar de)</span>
                  <select
                    value={origenId}
                    onChange={(e) => setOrigenId(e.target.value)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.nombre} ({w.codigo})</option>
                    ))}
                  </select>
                </div>

                <div className="self-end mb-1 text-purple-600 dark:text-purple-400">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Destino (Subir a)</span>
                  <select
                    value={destinoId}
                    onChange={(e) => setDestinoId(e.target.value)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.nombre} ({w.codigo})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── BARRA DE ESCÁNER & BÚSQUEDA ────────────────────────── */}
          <div className="card p-4 sm:p-5 border border-gray-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                <Scan className="w-4 h-4 text-purple-600" />
                <span>Escanear Producto o Ingresar Código</span>
              </label>

              <button
                type="button"
                onClick={() => setShowCamera(!showCamera)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  showCamera
                    ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200"
                    : "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                }`}
              >
                {showCamera ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                <span>{showCamera ? "Cerrar Cámara" : "Escanear con Cámara"}</span>
              </button>
            </div>

            {/* Viewfinder de Cámara */}
            {showCamera && (
              <div className="relative rounded-2xl overflow-hidden bg-black max-w-sm mx-auto aspect-video flex items-center justify-center border-2 border-purple-500 shadow-xl">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                <div className="absolute inset-0 border-2 border-dashed border-white/50 m-6 rounded-xl pointer-events-none flex items-center justify-center">
                  <span className="text-[10px] text-white/80 bg-black/50 px-2 py-0.5 rounded-md font-mono">
                    Apunta al código de barras
                  </span>
                </div>
              </div>
            )}

            {/* Input Barcode Gun */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleProductLookup(searchCode)
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  autoFocus
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder="Escaneá con lector láser o escribí código / nombre..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm font-mono bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <Scan className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
              <button
                type="submit"
                disabled={searchingProd || !searchCode.trim()}
                className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-md shadow-purple-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {searchingProd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="hidden sm:inline">Buscar</span>
              </button>
            </form>
          </div>

          {/* ── FICHA DE PRODUCTO ESCANEADO (REPOSITOR READY) ──────── */}
          {activeProduct && (
            <div className="card p-5 border-2 border-purple-500/50 bg-white dark:bg-slate-900 shadow-xl rounded-2xl animate-in fade-in duration-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono">
                    {activeProduct.categoria?.nombre || "General"}
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white mt-1">
                    {activeProduct.nombre}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-0.5">
                    <span>SKU: <strong className="text-gray-700 dark:text-gray-300">{activeProduct.sku}</strong></span>
                    <span>•</span>
                    <span>Cód: <strong className="text-gray-700 dark:text-gray-300">{activeProduct.codigo_barra || "S/C"}</strong></span>
                  </div>
                </div>

                {/* Badges de Stock en Vivo */}
                <div className="flex items-center gap-2">
                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-center min-w-[100px]">
                    <span className="text-[9px] uppercase font-bold text-purple-700 dark:text-purple-300 block">
                      Trastienda (Origen)
                    </span>
                    <span className="text-base font-black font-mono text-purple-700 dark:text-purple-300">
                      {activeProductStock.origen} uds
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-center min-w-[100px]">
                    <span className="text-[9px] uppercase font-bold text-blue-700 dark:text-blue-300 block">
                      Góndola (Destino)
                    </span>
                    <span className="text-base font-black font-mono text-blue-700 dark:text-blue-300">
                      {activeProductStock.destino} uds
                    </span>
                  </div>
                </div>
              </div>

              {/* Selector de Cantidad Rápida */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">
                    Cantidad a Trasladar a Salón:
                  </label>
                  <span className="text-xs text-gray-400 font-mono">
                    Disponible: {activeProductStock.origen} uds
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Botones de incremento rápido */}
                  <div className="flex items-center gap-1">
                    {[1, 6, 12, 24, 48].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReplenishQty(n)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          replenishQty === n
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-200"
                        }`}
                      >
                        +{n}
                      </button>
                    ))}
                    {activeProductStock.origen > 0 && (
                      <button
                        type="button"
                        onClick={() => setReplenishQty(activeProductStock.origen)}
                        className="px-3 py-1.5 rounded-xl text-xs font-black bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 cursor-pointer"
                      >
                        Todo ({activeProductStock.origen})
                      </button>
                    )}
                  </div>

                  {/* Input con +/- */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => setReplenishQty(Math.max(1, replenishQty - 1))}
                      className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-bold hover:bg-gray-200 transition flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={replenishQty}
                      onChange={(e) => setReplenishQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 py-1.5 text-center text-sm font-mono font-bold rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setReplenishQty(replenishQty + 1)}
                      className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-bold hover:bg-gray-200 transition flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={submittingSingle}
                  onClick={handleQuickReplenishSingle}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submittingSingle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>⚡ Reponer Inmediato ({replenishQty} uds a Góndola)</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="py-3 px-4 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 hover:bg-purple-100 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border border-purple-200 dark:border-purple-800"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Agregar al Carro de Reposición</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProduct(null)}
                  className="p-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer flex items-center justify-center"
                  title="Cerrar ficha"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── CARRO DE REPOSICIÓN EN LOTE (ZORRA / CARRO DE SALÓN) ── */}
          {pickingCart.length > 0 && (
            <div className="card p-5 border border-purple-200 dark:border-slate-800 rounded-2xl space-y-4 bg-purple-50/30 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                    {pickingCart.length}
                  </div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">
                    Carro de Reposición ({pickingCart.reduce((acc, i) => acc + i.cantidad, 0)} uds totales)
                  </h3>
                </div>
                <button
                  onClick={() => setPickingCart([])}
                  className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
                >
                  Vaciar carro
                </button>
              </div>

              {/* Lista de Items en Carro */}
              <div className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                {pickingCart.map((item, idx) => (
                  <div key={item.product.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="font-extrabold text-gray-900 dark:text-white truncate block">
                        {item.product.nombre}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        SKU: {item.product.sku} · Trastienda: {item.stockOrigen} uds
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1)
                          const updated = [...pickingCart]
                          updated[idx].cantidad = val
                          setPickingCart(updated)
                        }}
                        className="w-16 py-1 text-center font-mono font-bold rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white text-xs"
                      />
                      <span className="text-gray-500 font-semibold">uds</span>
                      <button
                        onClick={() => setPickingCart(pickingCart.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-red-500 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirmar Carro */}
              <button
                type="button"
                disabled={submittingCart}
                onClick={handleConfirmCartReplenish}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-sm transition shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submittingCart ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Trasladando stock en lote...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Traslado de Carro a Salón ({pickingCart.reduce((acc, i) => acc + i.cantidad, 0)} unidades)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── CONTENIDO: HISTORIAL DE TRASLADOS ─────────────────────────── */}
      {activeTab === "historial" && (
        <div className="card p-5 border border-gray-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-purple-600" />
              <span>Historial de Traslados de Inventario</span>
            </h3>
            <button
              onClick={loadInternalTransfers}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500 cursor-pointer"
              title="Refrescar lista"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingInternal ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loadingInternal ? (
            <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Cargando traslados...</span>
            </div>
          ) : internalTransfers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              Aún no se han registrado traslados entre depósitos.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Origen</th>
                    <th className="py-2.5 px-3">Destino</th>
                    <th className="py-2.5 px-3 text-right">Unidades</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-mono">
                  {internalTransfers.map((tr) => {
                    const origName = warehouses.find(w => w.id === tr.warehouse_origen_id)?.nombre || "Trastienda"
                    const destName = warehouses.find(w => w.id === tr.warehouse_destino_id)?.nombre || "Salón Góndola"
                    return (
                      <tr key={tr.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-white">
                          {tr.codigo}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 font-sans">
                          {tr.created_at ? new Date(tr.created_at).toLocaleString("es-PY") : "-"}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-gray-700 dark:text-gray-300">
                          {origName}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-gray-700 dark:text-gray-300">
                          {destName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-purple-600 dark:text-purple-400">
                          {tr.total_unidades} uds
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                            {tr.estado}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-gray-500 truncate max-w-xs">
                          {tr.items?.map((it: any) => `${it.product_nombre} (${it.cantidad_enviada})`).join(", ") || tr.observaciones || "-"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
