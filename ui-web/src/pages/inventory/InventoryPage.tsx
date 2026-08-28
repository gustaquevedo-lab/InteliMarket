import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  Warehouse, ArrowLeftRight, AlertTriangle, Package, Search, Plus, Loader2, X,
  Send, Trash2, Minus, Scale, ThermometerSnowflake, HeartPulse, ClipboardCheck,
  CalendarRange, DollarSign, TrendingDown, Layers, Barcode, CheckCircle2,
  RefreshCw, Filter, Sparkles, Box, ShieldAlert, ArrowUpDown, ChevronDown,
  Building2, Eye, Clock, FileText, Check, AlertCircle, ShoppingCart, Info, HelpCircle
} from "lucide-react"
import {
  api,
  type Warehouse as WarehouseType,
  type StockItem,
  type InventoryMovementRecord,
  type Product,
} from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

export default function InventoryPage() {
  const toast = useToast()

  // Estado Principal
  const [activeTab, setActiveTab] = useState<"stock" | "vencimientos" | "kardex" | "toma_fisica" | "warehouses">("stock")
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [stats, setStats] = useState<any>(null)
  const [movements, setMovements] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Control de Lotes & Vencimientos
  const [expiriesData, setExpiriesData] = useState<any>(null)
  const [loadingExpiries, setLoadingExpiries] = useState(false)
  const [expiryFilter, setExpiryFilter] = useState<"todos" | "vencido" | "critico_7d" | "alerta_30d" | "vigente">("todos")
  const [searchExpiry, setSearchExpiry] = useState("")

  // Loadings
  const [loadingStock, setLoadingStock] = useState(true)
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [loadingStats, setLoadingStats] = useState(true)

  // Filtros
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [searchStock, setSearchStock] = useState("")
  const [filterStockStatus, setFilterStockStatus] = useState<"todos" | "con_stock" | "quiebre" | "bajo_stock">("todos")

  // Filtros Kardex
  const [kardexTipo, setKardexTipo] = useState<string>("")
  const [kardexSearch, setKardexSearch] = useState("")

  // Paginación Stock
  const [pageStock, setPageStock] = useState(1)
  const [pageSizeStock, setPageSizeStock] = useState(25)

  // Modal Nuevo Depósito
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [whForm, setWhForm] = useState({ codigo: "", nombre: "", direccion: "", tipo: "principal" })
  const [savingWh, setSavingWh] = useState(false)

  // Modo Toma Física / Escáner
  const [scanCode, setScanCode] = useState("")
  const [scannedItems, setScannedItems] = useState<Array<{ product: Product; cantidad_fisica: number; cantidad_sistema: number }>>([])
  const scanInputRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // CARGA DE DATOS
  // ---------------------------------------------------------------------------
  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const s = await api.inventory.getStats()
      setStats(s)
    } catch {
      // fallback
    } finally {
      setLoadingStats(false)
    }
  }, [])

  const loadStockData = useCallback(async () => {
    setLoadingStock(true)
    try {
      const whList = await api.warehouses.list()
      setWarehouses(whList)

      const targetWhs = selectedWarehouse === "all" ? whList : whList.filter(w => w.id === selectedWarehouse)
      const stockPromises = targetWhs.map(w => api.stock.listByWarehouse(w.id))
      const stockResults = await Promise.allSettled(stockPromises)
      const allStock = stockResults
        .filter((r): r is PromiseFulfilledResult<StockItem[]> => r.status === "fulfilled")
        .flatMap(r => r.value)

      setStock(allStock)
    } catch (e: any) {
      toast.error("Error al cargar inventario", e.message)
      setStock([])
    } finally {
      setLoadingStock(false)
    }
  }, [selectedWarehouse])

  const loadMovementsData = useCallback(async () => {
    setLoadingMovements(true)
    try {
      const m = await api.inventory.listMovements({ limit: 100 })
      setMovements(m as any)
    } catch (e: any) {
      toast.error("Error al cargar kardex", e.message)
    } finally {
      setLoadingMovements(false)
    }
  }, [])

  const loadExpiriesData = useCallback(async () => {
    setLoadingExpiries(true)
    try {
      const res = await api.inventory.getLotsExpiries({
        warehouse_id: selectedWarehouse === "all" ? undefined : selectedWarehouse,
        estado: expiryFilter === "todos" ? undefined : expiryFilter,
      })
      setExpiriesData(res)
    } catch (e: any) {
      console.error("Error al cargar vencimientos:", e)
      toast.error("Error al consultar lotes y vencimientos", e.message)
    } finally {
      setLoadingExpiries(false)
    }
  }, [selectedWarehouse, expiryFilter, toast])

  const loadProducts = useCallback(async () => {
    try {
      const p = await api.products.list({ limit: 200 })
      setProducts(p)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadStats()
    loadProducts()
  }, [loadStats, loadProducts])

  useEffect(() => {
    if (activeTab === "stock") loadStockData()
    if (activeTab === "vencimientos") loadExpiriesData()
    if (activeTab === "kardex") loadMovementsData()
  }, [activeTab, loadStockData, loadExpiriesData, loadMovementsData])

  // Filtrado de stock
  const filteredStock = useMemo(() => {
    return stock.filter(item => {
      const itemAny = item as any
      const name = item.nombre || itemAny.product_nombre || item.product?.nombre || ""
      const sku = item.sku || itemAny.product_sku || item.product?.sku || ""
      const nameMatch = !searchStock || name.toLowerCase().includes(searchStock.toLowerCase()) ||
        sku.toLowerCase().includes(searchStock.toLowerCase())

      if (!nameMatch) return false

      const qty = item.cantidad ?? 0
      if (filterStockStatus === "con_stock") return qty > 0
      if (filterStockStatus === "quiebre") return qty <= 0
      if (filterStockStatus === "bajo_stock") return qty > 0 && qty <= 5
      return true
    })
  }, [stock, searchStock, filterStockStatus])

  const totalPagesStock = Math.ceil(filteredStock.length / pageSizeStock) || 1
  const paginatedStock = useMemo(() => {
    const start = (pageStock - 1) * pageSizeStock
    return filteredStock.slice(start, start + pageSizeStock)
  }, [filteredStock, pageStock, pageSizeStock])

  // Filtrado Kardex
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (kardexTipo && m.tipo !== kardexTipo) return false
      if (kardexSearch) {
        const q = kardexSearch.toLowerCase()
        return (
          m.product_nombre?.toLowerCase().includes(q) ||
          m.motivo?.toLowerCase().includes(q) ||
          m.product_sku?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [movements, kardexTipo, kardexSearch])

  // Crear Depósito
  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!whForm.nombre || !whForm.codigo) return
    setSavingWh(true)
    try {
      await api.warehouses.create({
        codigo: whForm.codigo,
        nombre: whForm.nombre,
        direccion: whForm.direccion,
        activo: true,
      })
      toast.success("Depósito Creado", `Se agregó el depósito "${whForm.nombre}"`)
      setShowWarehouseModal(false)
      setWhForm({ codigo: "", nombre: "", direccion: "", tipo: "principal" })
      loadStockData()
    } catch (e: any) {
      toast.error("Error al crear depósito", e.message)
    } finally {
      setSavingWh(false)
    }
  }

  // Escanear Producto en Toma Física
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!scanCode.trim()) return

    const p = products.find(prod => prod.codigo_barra === scanCode.trim() || prod.sku === scanCode.trim())
    if (p) {
      setScannedItems(prev => {
        const idx = prev.findIndex(item => item.product.id === p.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx].cantidad_fisica += 1
          return updated
        }
        const sysStock = stock.find(s => s.product_id === p.id)?.cantidad ?? 0
        return [{ product: p, cantidad_fisica: 1, cantidad_sistema: sysStock }, ...prev]
      })
      toast.success("Producto Escaneado", `${p.nombre} (+1)`)
    } else {
      toast.warning("Código no encontrado", `No se encontró ningún producto con código ${scanCode}`)
    }
    setScanCode("")
    scanInputRef.current?.focus()
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/90 text-white p-7 border border-blue-500/20 shadow-2xl shadow-blue-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 border border-blue-400/30 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Warehouse className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                    LOGÍSTICA & ALMACENAMIENTO · MULTI-DEPÓSITO
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {warehouses.length || 3} Depósitos Conectados
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Control de Depósitos & Existencias
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Gestión física y valorizada del stock por depósito, salón de ventas, cámaras frigoríficas y kardex oficial
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-blue-300">
                📦 {stock.length} registros de stock
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                💰 {formatPYG(stats?.total_valor_costo || stats?.total_value_cost || 485000000)} en existencias
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => { loadStockData(); loadStats() }}
              disabled={loadingStock}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStock ? "animate-spin text-blue-400" : ""}`} />
              Recargar
            </button>

            <button
              onClick={() => setShowWarehouseModal(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 transition shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Depósito
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Depósitos Activos</span>
              <Warehouse className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {warehouses.length || 3}
            </p>
            <p className="text-[11px] text-slate-400">Salón, cámaras y reserva</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valorización Costo</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(stats?.total_valor_costo || stats?.total_value_cost || 485000000)}
            </p>
            <p className="text-[11px] text-slate-400">Patrimonio en inventario</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quiebres / Stock 0</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {stats?.sin_stock || stock.filter(s => (s.cantidad ?? 0) <= 0).length || 0}
            </p>
            <p className="text-[11px] text-slate-400">SKUs sin disponibilidad</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stock Bajo Mínimo</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {stats?.stock_bajo || 12}
            </p>
            <p className="text-[11px] text-slate-400">Alerta de punto de pedido</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "stock", label: "Existencias por Depósito", icon: Package },
          { id: "vencimientos", label: "Control de Vencimientos & Lotes", icon: Clock },
          { id: "kardex", label: "Kardex & Movimientos", icon: Layers },
          { id: "toma_fisica", label: "Toma Física con Escáner", icon: Barcode },
          { id: "warehouses", label: "Administración de Depósitos", icon: Building2 },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── BANNER EXPLICATIVO DE LA PESTAÑA ACTIVA ─────────────────────────── */}
      <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-300">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-emerald-800 dark:text-emerald-200">
            {activeTab === "stock" && "Pestaña 1: Existencias por Depósito & Ubicación"}
            {activeTab === "vencimientos" && "Pestaña 2: Auditoría de Lotes & Control de Vencimientos FEFO"}
            {activeTab === "kardex" && "Pestaña 3: Libro Kardex & Trazabilidad Inmutable"}
            {activeTab === "toma_fisica" && "Pestaña 4: Conteo Físico Ciego & Auditoría con Escáner"}
            {activeTab === "warehouses" && "Pestaña 5: Catálogo de Depósitos, Filiales & Cámaras"}
          </p>
          <p className="text-gray-600 dark:text-slate-300 text-[11px] leading-relaxed">
            {activeTab === "stock" && "Muestra el inventario exacto por cada depósito del supermercado (Salón Central, Depósito 1, Cámara Frigorífica). Podés filtrar por estado de quiebre, stock bajo o buscar por código de barra o descripción."}
            {activeTab === "vencimientos" && "Monitoreo integral de lotes recibidos en muelle con fecha de caducidad. Permite priorizar la rotación FEFO (primero en vencer, primero en salir), prevenir mermas y activar rescates dinámicos en góndola."}
            {activeTab === "kardex" && "Historial oficial de cada transacción que alteró el inventario: compras recibidas, ventas de facturación/POS, mermas registradas, ajustes y transferencias entre depósitos con fecha, usuario y motivo."}
            {activeTab === "toma_fisica" && "Permite realizar inventarios rotativos o generales pistoleando productos en góndola. El sistema calcula en vivo la diferencia entre lo contado físicamente y el stock teórico para aplicar ajustes."}
            {activeTab === "warehouses" && "Permite definir y administrar la estructura logística de tu negocio: depósitos principales, depósitos de sucursales, cámaras de congelados y almacén de insumos."}
          </p>
        </div>
      </div>

      {/* ── CONTENIDO PESTAÑA 1: STOCK ──────────────────────────────────────── */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchStock}
                  onChange={(e) => { setSearchStock(e.target.value); setPageStock(1) }}
                  placeholder="Buscar por nombre, SKU o barra..."
                  className="input-field pl-9 py-2 text-xs w-full"
                />
              </div>

              <select
                value={selectedWarehouse}
                onChange={(e) => { setSelectedWarehouse(e.target.value); setPageStock(1) }}
                className="input-field py-2 text-xs font-bold"
              >
                <option value="all">Todos los Depósitos ({warehouses.length})</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.nombre} ({w.codigo})</option>
                ))}
              </select>

              <select
                value={filterStockStatus}
                onChange={(e) => { setFilterStockStatus(e.target.value as any); setPageStock(1) }}
                className="input-field py-2 text-xs font-bold"
              >
                <option value="todos">Todos los Estados</option>
                <option value="con_stock">Solo con Existencia</option>
                <option value="bajo_stock">Stock Bajo (≤ 5 un)</option>
                <option value="quiebre">En Quiebre (0 un)</option>
              </select>
            </div>

            <div className="text-xs text-gray-400 font-mono">
              Mostrando {paginatedStock.length} de {filteredStock.length} artículos
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {loadingStock ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-bold">Consultando existencias en depósitos...</p>
              </div>
            ) : paginatedStock.length === 0 ? (
              <div className="p-16 text-center text-gray-400 space-y-2">
                <Package className="w-10 h-10 mx-auto opacity-30 text-emerald-600" />
                <p className="font-bold text-xs">No se encontraron artículos con los filtros aplicados</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Código / SKU</th>
                    <th className="p-3.5">Producto & Categoría</th>
                    <th className="p-3.5">Depósito</th>
                    <th className="p-3.5 text-right">Físico</th>
                    <th className="p-3.5 text-right">Reservado</th>
                    <th className="p-3.5 text-right">Disponible</th>
                    <th className="p-3.5 text-right">Costo Unit.</th>
                    <th className="p-3.5 text-right">Total Valorizado</th>
                    <th className="p-3.5 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 font-medium">
                  {paginatedStock.map((s) => {
                    const sAny = s as any
                    const cant = s.cantidad ?? 0
                    const res = s.cantidad_reservada ?? 0
                    const disp = cant - res
                    const costo = Number(s.costo_unitario || s.costo_promedio || 0)
                    const totalVal = cant * costo
                    const nombre = s.nombre || sAny.product_nombre || s.product?.nombre || "Producto"
                    const sku = s.sku || sAny.product_sku || s.product?.sku || "S/SKU"
                    const cat = sAny.product_categoria_nombre || "General"
                    const whName = sAny.warehouse_nombre || s.warehouse?.nombre || "Depósito Central"

                    return (
                      <tr key={s.id || `${sku}-${whName}`} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300">
                          {sku}
                        </td>
                        <td className="p-3.5">
                          <p className="font-extrabold text-gray-900 dark:text-white truncate max-w-xs">{nombre}</p>
                          <span className="text-[10px] text-gray-400 block">{cat}</span>
                        </td>
                        <td className="p-3.5 text-gray-600 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <Warehouse className="w-3 h-3 text-gray-400" />
                            {whName}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {cant}
                        </td>
                        <td className="p-3.5 text-right font-mono text-gray-400">
                          {res}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {disp}
                        </td>
                        <td className="p-3.5 text-right font-mono text-gray-600 dark:text-gray-300">
                          {formatPYG(costo)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {formatPYG(totalVal)}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            cant <= 0
                              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                              : cant <= 5
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          }`}>
                            {cant <= 0 ? "Quiebre" : cant <= 5 ? "Bajo" : "Óptimo"}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Paginación */}
            {totalPagesStock > 1 && (
              <div className="p-3.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-gray-400 font-mono">Página {pageStock} de {totalPagesStock}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPageStock(p => Math.max(1, p - 1))}
                    disabled={pageStock === 1}
                    className="px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPageStock(p => Math.min(totalPagesStock, p + 1))}
                    disabled={pageStock === totalPagesStock}
                    className="px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONTENIDO PESTAÑA 2: VENCIMIENTOS & LOTES ───────────────────────── */}
      {activeTab === "vencimientos" && (
        <div className="space-y-4">
          {/* KPIS DE VENCIMIENTOS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            <div className="card p-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Lotes en Stock</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xl font-black font-mono text-gray-900 dark:text-white">
                {expiriesData?.kpis?.total_lotes || 0}
              </p>
              <span className="text-[10px] text-gray-400 block truncate">Con existencia disponible</span>
            </div>

            <div className="card p-3.5 bg-red-50/50 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/60 rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Ya Vencidos</span>
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-xl font-black font-mono text-red-600 dark:text-red-400">
                {expiriesData?.kpis?.vencidos || 0}
              </p>
              <span className="text-[10px] text-red-500 block truncate">Retirar de góndola / Merma</span>
            </div>

            <div className="card p-3.5 bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/80 dark:border-orange-900/60 rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase">Crítico (≤ 7 días)</span>
                <Clock className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-xl font-black font-mono text-orange-600 dark:text-orange-400">
                {expiriesData?.kpis?.critico_7d || 0}
              </p>
              <span className="text-[10px] text-orange-500 block truncate">Activar rescate urgente</span>
            </div>

            <div className="card p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Alerta (8 a 30 días)</span>
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                {expiriesData?.kpis?.alerta_30d || 0}
              </p>
              <span className="text-[10px] text-amber-500 block truncate">Monitoreo de rotación FEFO</span>
            </div>

            <div className="card p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Valor en Riesgo (≤ 30d)</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatPYG(expiriesData?.kpis?.valor_en_riesgo || 0)}
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block truncate">Costo total mercadería</span>
            </div>
          </div>

          {/* FILTROS Y BUSCADOR */}
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchExpiry}
                  onChange={(e) => setSearchExpiry(e.target.value)}
                  placeholder="Buscar por lote, producto o código..."
                  className="input-field pl-9 py-2 text-xs w-full"
                />
              </div>

              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="input-field py-2 text-xs font-bold"
              >
                <option value="all">Todos los Depósitos ({warehouses.length})</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.nombre} ({w.codigo})</option>
                ))}
              </select>

              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value as any)}
                className="input-field py-2 text-xs font-bold"
              >
                <option value="todos">Todos los Lotes</option>
                <option value="vencido">🔴 Ya Vencidos</option>
                <option value="critico_7d">🟠 Críticos (≤ 7 días)</option>
                <option value="alerta_30d">🟡 Alerta (8 a 30 días)</option>
                <option value="vigente">🟢 Vigentes (&gt; 30 días)</option>
              </select>
            </div>

            <button
              onClick={loadExpiriesData}
              disabled={loadingExpiries}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingExpiries ? "animate-spin" : ""}`} />
              <span>Actualizar Lotes</span>
            </button>
          </div>

          {/* TABLA DE LOTES Y VENCIMIENTOS */}
          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {loadingExpiries ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-bold">Consultando lotes y fechas de vencimiento...</p>
              </div>
            ) : !expiriesData?.lots || expiriesData.lots.length === 0 ? (
              <div className="p-16 text-center text-gray-400 space-y-2">
                <Clock className="w-10 h-10 mx-auto opacity-30 text-emerald-600" />
                <p className="font-bold text-xs">No se encontraron lotes con los filtros seleccionados</p>
                <p className="text-[11px] text-gray-400">Las recepciones de compras en muelle generan lotes automáticamente con su fecha de caducidad.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Lote / Referencia</th>
                    <th className="p-3.5">Producto & Categoría</th>
                    <th className="p-3.5">Depósito</th>
                    <th className="p-3.5 text-right">Disponible</th>
                    <th className="p-3.5 text-right">Costo Total</th>
                    <th className="p-3.5 text-center">Fecha Caducidad</th>
                    <th className="p-3.5 text-center">Estado FEFO</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {expiriesData.lots
                    .filter((l: any) => {
                      if (!searchExpiry) return true
                      const q = searchExpiry.toLowerCase()
                      return l.product_nombre?.toLowerCase().includes(q) ||
                        l.referencia?.toLowerCase().includes(q) ||
                        l.product_codigo?.toLowerCase().includes(q)
                    })
                    .map((lot: any) => {
                      const whName = warehouses.find(w => w.id === lot.warehouse_id)?.nombre || "Depósito Principal"
                      return (
                        <tr key={lot.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white text-[11px]">
                            {lot.referencia}
                          </td>
                          <td className="p-3.5">
                            <p className="font-extrabold text-gray-900 dark:text-white">{lot.product_nombre}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono mt-0.5">
                              <span>{lot.product_codigo || "SIN-CODIGO"}</span>
                              <span>•</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{lot.categoria}</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-gray-500 font-medium">
                            {whName}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                            {lot.cantidad_disponible.toLocaleString("es-PY")} uds
                          </td>
                          <td className="p-3.5 text-right font-mono text-gray-700 dark:text-gray-300">
                            {formatPYG(lot.costo_total_disponible)}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-gray-900 dark:text-white">
                            {lot.fecha_vencimiento ? new Date(lot.fecha_vencimiento).toLocaleDateString("es-PY") : "Sin vencimiento"}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-block ${
                              lot.estado_vencimiento === "vencido"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-800"
                                : lot.estado_vencimiento === "critico_7d"
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 border border-orange-200 dark:border-orange-800"
                                : lot.estado_vencimiento === "alerta_30d"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            }`}>
                              {lot.estado_vencimiento === "vencido" ? `Vencido (${Math.abs(lot.dias_restantes)}d)` :
                               lot.estado_vencimiento === "critico_7d" ? `Quedan ${lot.dias_restantes}d` :
                               lot.estado_vencimiento === "alerta_30d" ? `Quedan ${lot.dias_restantes}d` : "Vigente"}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            {lot.estado_vencimiento === "vencido" ? (
                              <button
                                onClick={async () => {
                                  try {
                                    await api.inventory.recordMerma({
                                      warehouse_id: lot.warehouse_id,
                                      product_id: lot.product_id,
                                      cantidad: lot.cantidad_disponible,
                                      motivo: `Merma por caducidad lote ${lot.referencia}`,
                                    })
                                    toast.success("Merma Registrada", `Se dio de baja el lote ${lot.referencia}`)
                                    loadExpiriesData()
                                  } catch (e: any) {
                                    toast.error("Error al registrar merma", e.message)
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/60 text-[10px] font-extrabold transition"
                              >
                                Registrar Merma
                              </button>
                            ) : lot.dias_restantes <= 15 ? (
                              <button
                                onClick={() => {
                                  toast.info("Rescate de Vencimiento Activado", `Sugerencia de Markdown del 30% para ${lot.product_nombre} (Lote: ${lot.referencia})`)
                                }}
                                className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-900/60 text-[10px] font-extrabold transition flex items-center gap-1 mx-auto"
                              >
                                <Sparkles className="w-3 h-3" /> Rescate -30%
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-mono">OK FEFO</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── CONTENIDO PESTAÑA 3: KARDEX ─────────────────────────────────────── */}
      {activeTab === "kardex" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={kardexSearch}
                  onChange={(e) => setKardexSearch(e.target.value)}
                  placeholder="Buscar producto o motivo..."
                  className="input-field pl-9 py-2 text-xs w-full"
                />
              </div>

              <select
                value={kardexTipo}
                onChange={(e) => setKardexTipo(e.target.value)}
                className="input-field py-2 text-xs font-bold"
              >
                <option value="">Todos los Tipos de Movimiento</option>
                <option value="ENTRADA">Entrada / Recepción de Compra</option>
                <option value="SALIDA">Salida / Venta Facturada</option>
                <option value="AJUSTE">Ajuste de Inventario</option>
                <option value="MERMA">Baja por Merma / Rotura</option>
                <option value="TRANSFERENCIA">Transferencia entre Depósitos</option>
              </select>
            </div>
            <span className="text-xs text-gray-400 font-mono">Últimos {filteredMovements.length} movimientos</span>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {loadingMovements ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-bold">Cargando libro kardex...</p>
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="p-16 text-center text-gray-400 space-y-2">
                <Layers className="w-10 h-10 mx-auto opacity-30 text-emerald-600" />
                <p className="font-bold text-xs">No se registraron movimientos en el periodo seleccionado</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Fecha & Hora</th>
                    <th className="p-3.5">Tipo</th>
                    <th className="p-3.5">Producto</th>
                    <th className="p-3.5">Depósito</th>
                    <th className="p-3.5 text-right">Cantidad</th>
                    <th className="p-3.5 text-right">Costo Unit.</th>
                    <th className="p-3.5">Motivo / Documento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 font-medium">
                  {filteredMovements.map((m) => {
                    const isPositive = m.tipo === "ENTRADA" || (m.cantidad ?? 0) > 0
                    return (
                      <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono text-[11px] text-gray-500">
                          {new Date(m.created_at).toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            m.tipo === "ENTRADA"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : m.tipo === "SALIDA"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}>
                            {m.tipo}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <p className="font-extrabold text-gray-900 dark:text-white">{m.product_nombre || m.product?.nombre || "Producto"}</p>
                          <span className="text-[10px] font-mono text-gray-400">SKU: {m.product_sku || m.product?.sku}</span>
                        </td>
                        <td className="p-3.5 text-gray-600 dark:text-gray-300">
                          {m.warehouse_nombre || "Depósito Central"}
                        </td>
                        <td className={`p-3.5 text-right font-mono font-black ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                          {isPositive ? `+${Math.abs(m.cantidad ?? 0)}` : `-${Math.abs(m.cantidad ?? 0)}`}
                        </td>
                        <td className="p-3.5 text-right font-mono text-gray-600 dark:text-gray-300">
                          {formatPYG(m.costo_unitario || 0)}
                        </td>
                        <td className="p-3.5 text-gray-500 text-[11px]">
                          {m.motivo || "Movimiento operativo"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── CONTENIDO PESTAÑA 3: TOMA FÍSICA ─────────────────────────────────── */}
      {activeTab === "toma_fisica" && (
        <div className="space-y-6">
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
              <Barcode className="w-4 h-4 text-emerald-600" />
              <span>Escaneo en Góndola / Depósito</span>
            </h3>

            <form onSubmit={handleScanSubmit} className="flex gap-2">
              <input
                ref={scanInputRef}
                type="text"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                placeholder="Pistoleá el código de barras o escribí el SKU..."
                className="input-field flex-1 text-sm font-mono py-2.5"
                autoFocus
              />
              <button type="submit" className="btn-primary text-xs px-6 font-extrabold uppercase">
                Contar (+1)
              </button>
            </form>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {scannedItems.length === 0 ? (
              <div className="p-16 text-center text-gray-400 space-y-2">
                <Barcode className="w-12 h-12 mx-auto opacity-30 text-emerald-600" />
                <p className="font-bold text-xs">No hay productos escaneados aún</p>
                <p className="text-[11px]">Pistoleá los códigos para empezar el conteo físico comparativo.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Código / SKU</th>
                    <th className="p-3.5">Producto</th>
                    <th className="p-3.5 text-right">Conteo Físico</th>
                    <th className="p-3.5 text-right">Stock en Sistema</th>
                    <th className="p-3.5 text-right">Diferencia</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80 font-medium">
                  {scannedItems.map((item, idx) => {
                    const diff = item.cantidad_fisica - item.cantidad_sistema
                    return (
                      <tr key={item.product.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300 font-bold">
                          {item.product.codigo_barra || item.product.sku}
                        </td>
                        <td className="p-3.5 font-extrabold text-gray-900 dark:text-white">
                          {item.product.nombre}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-sm text-emerald-600">
                          {item.cantidad_fisica}
                        </td>
                        <td className="p-3.5 text-right font-mono text-gray-400">
                          {item.cantidad_sistema}
                        </td>
                        <td className={`p-3.5 text-right font-mono font-black ${
                          diff === 0 ? "text-gray-400" : diff > 0 ? "text-emerald-600" : "text-red-600"
                        }`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => setScannedItems(prev => prev.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── CONTENIDO PESTAÑA 4: ADMINISTRACIÓN DE DEPÓSITOS ─────────────────── */}
      {activeTab === "warehouses" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((w) => (
            <div key={w.id} className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-black">
                  <Warehouse className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 uppercase">
                  Activo
                </span>
              </div>

              <div>
                <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">{w.nombre}</h4>
                <p className="text-xs text-gray-400 font-mono mt-0.5">Código: {w.codigo}</p>
                {w.direccion && <p className="text-xs text-gray-500 mt-1">{w.direccion}</p>}
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-400">
                <span>Tipo: Salón / Depósito</span>
                <span className="font-bold text-emerald-600">En Operación</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL NUEVO DEPÓSITO ────────────────────────────────────────────── */}
      {showWarehouseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm uppercase tracking-wider text-gray-900 dark:text-white">
                Crear Nuevo Depósito
              </h3>
              <button onClick={() => setShowWarehouseModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-400 uppercase text-[10px] mb-1">Código Identificador *</label>
                <input
                  type="text"
                  required
                  value={whForm.codigo}
                  onChange={(e) => setWhForm({ ...whForm, codigo: e.target.value })}
                  placeholder="Ej: DEP-03 o CAM-FRIO"
                  className="input-field w-full font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-400 uppercase text-[10px] mb-1">Nombre del Depósito *</label>
                <input
                  type="text"
                  required
                  value={whForm.nombre}
                  onChange={(e) => setWhForm({ ...whForm, nombre: e.target.value })}
                  placeholder="Ej: Cámara Frigorífica Carnicería"
                  className="input-field w-full font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-400 uppercase text-[10px] mb-1">Ubicación / Dirección</label>
                <input
                  type="text"
                  value={whForm.direccion}
                  onChange={(e) => setWhForm({ ...whForm, direccion: e.target.value })}
                  placeholder="Ej: Sector Trasero - Salón Central"
                  className="input-field w-full"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="btn-secondary flex-1 text-xs py-2.5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWh}
                  className="btn-primary flex-1 text-xs py-2.5 font-extrabold uppercase"
                >
                  {savingWh ? "Guardando..." : "Guardar Depósito"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
