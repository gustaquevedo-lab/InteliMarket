import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  Warehouse, ArrowLeftRight, AlertTriangle, Package, Search, Plus, Loader2, X,
  Send, Trash2, Minus, Scale, ThermometerSnowflake, HeartPulse, ClipboardCheck,
  CalendarRange, DollarSign, TrendingDown, Layers, Barcode, CheckCircle2,
  RefreshCw, Filter, Sparkles, Box, ShieldAlert, ArrowUpDown, ChevronDown,
  Building2, Eye, Clock, FileText, Check, AlertCircle, ShoppingCart
} from "lucide-react"
import {
  api,
  type Warehouse as WarehouseType,
  type StockItem,
  type InventoryStatsResponse,
  type InventoryMovementRecord,
  type InventoryAdjustmentRecord,
  type Product,
} from "../api"
import { useToast } from "../context/ToastContext"
import { formatPYG } from "../utils/format"

export default function InventoryPage() {
  const toast = useToast()

  // Estado Principal
  const [activeTab, setActiveTab] = useState<"stock" | "kardex" | "mermas" | "toma_fisica" | "warehouses" | "desposte">("stock")
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [stats, setStats] = useState<InventoryStatsResponse | null>(null)
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([])
  const [adjustments, setAdjustments] = useState<InventoryAdjustmentRecord[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Loadings
  const [loadingStock, setLoadingStock] = useState(true)
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [loadingAdjustments, setLoadingAdjustments] = useState(false)
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

  // Modal Registrar Merma
  const [showMermaModal, setShowMermaModal] = useState(false)
  const [mermaForm, setMermaForm] = useState({
    warehouse_id: "",
    product_id: "",
    product_search: "",
    cantidad: 1,
    motivo: "Vencimiento / Caducado",
    observaciones: "",
  })
  const [savingMerma, setSavingMerma] = useState(false)
  const [mermaSelectedProduct, setMermaSelectedProduct] = useState<Product | null>(null)

  // Modal Nuevo Depósito
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [whForm, setWhForm] = useState({ codigo: "", nombre: "", direccion: "", tipo: "principal" })
  const [savingWh, setSavingWh] = useState(false)

  // Modo Toma Física / Escáner
  const [scanCode, setScanCode] = useState("")
  const [scannedItems, setScannedItems] = useState<Array<{ product: Product; cantidad_fisica: number; cantidad_sistema: number }>>([])
  const scanInputRef = useRef<HTMLInputElement>(null)

  // Simulador de Desposte (Carnicería)
  const [despostePeso, setDespostePeso] = useState(180)
  const [desposteCosto, setDesposteCosto] = useState(4500000)
  const [desposteCortes, setDesposteCortes] = useState<any[]>([])

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

      if (whList.length > 0 && !mermaForm.warehouse_id) {
        setMermaForm(prev => ({ ...prev, warehouse_id: whList[0].id }))
      }

      // Cargar stock
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
  }, [selectedWarehouse, mermaForm.warehouse_id])

  const loadMovements = useCallback(async () => {
    setLoadingMovements(true)
    try {
      const movs = await api.inventory.listMovements({
        tipo: kardexTipo || undefined,
        warehouse_id: selectedWarehouse !== "all" ? selectedWarehouse : undefined,
        limit: 150,
      })
      setMovements(movs)
    } catch (e: any) {
      toast.error("Error al cargar Kardex", e.message)
    } finally {
      setLoadingMovements(false)
    }
  }, [kardexTipo, selectedWarehouse])

  const loadAdjustments = useCallback(async () => {
    setLoadingAdjustments(true)
    try {
      const adjs = await api.inventory.listAdjustments({
        warehouse_id: selectedWarehouse !== "all" ? selectedWarehouse : undefined,
        limit: 100,
      })
      setAdjustments(adjs)
    } catch (e: any) {
      toast.error("Error al cargar ajustes", e.message)
    } finally {
      setLoadingAdjustments(false)
    }
  }, [selectedWarehouse])

  useEffect(() => {
    loadStats()
    loadStockData()
    api.products.list({ limit: 500 }).then(setProducts).catch(() => {})
  }, [loadStats, loadStockData])

  useEffect(() => {
    if (activeTab === "kardex") loadMovements()
    if (activeTab === "mermas") loadAdjustments()
  }, [activeTab, loadMovements, loadAdjustments])

  // ---------------------------------------------------------------------------
  // FILTRADO DE STOCK
  // ---------------------------------------------------------------------------
  const filteredStock = useMemo(() => {
    let list = [...stock]

    if (searchStock) {
      const q = searchStock.toLowerCase()
      list = list.filter(s =>
        (s as any).nombre?.toLowerCase().includes(q) ||
        (s as any).sku?.toLowerCase().includes(q) ||
        (s as any).product?.nombre?.toLowerCase().includes(q) ||
        (s as any).product?.sku?.toLowerCase().includes(q) ||
        (s as any).product?.codigo_barra?.toLowerCase().includes(q)
      )
    }

    if (filterStockStatus === "con_stock") {
      list = list.filter(s => Number(s.cantidad || 0) > 0)
    } else if (filterStockStatus === "quiebre") {
      list = list.filter(s => Number(s.cantidad || 0) <= 0)
    } else if (filterStockStatus === "bajo_stock") {
      list = list.filter(s => Number(s.cantidad || 0) > 0 && Number(s.cantidad || 0) <= 10)
    }

    return list
  }, [stock, searchStock, filterStockStatus])

  const paginatedStock = useMemo(() => {
    const start = (pageStock - 1) * pageSizeStock
    return filteredStock.slice(start, start + pageSizeStock)
  }, [filteredStock, pageStock, pageSizeStock])

  const totalStockPages = Math.ceil(filteredStock.length / pageSizeStock) || 1

  // ---------------------------------------------------------------------------
  // REGISTRAR MERMA
  // ---------------------------------------------------------------------------
  const handleSaveMerma = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mermaForm.product_id || !mermaForm.warehouse_id || mermaForm.cantidad <= 0) {
      toast.error("Datos incompletos", "Seleccione producto, depósito y una cantidad válida mayor a cero.")
      return
    }

    setSavingMerma(true)
    try {
      const res = await api.inventory.recordMerma({
        warehouse_id: mermaForm.warehouse_id,
        product_id: mermaForm.product_id,
        cantidad: Number(mermaForm.cantidad),
        motivo: mermaForm.motivo,
        observaciones: mermaForm.observaciones,
      })

      toast.success(
        "Merma Registrada",
        `Se descontaron ${mermaForm.cantidad} un. de ${res.product_nombre}. Impacto: ${formatPYG(res.impacto_financiero_gs)}.`
      )
      setShowMermaModal(false)
      setMermaSelectedProduct(null)
      setMermaForm({
        warehouse_id: warehouses[0]?.id || "",
        product_id: "",
        product_search: "",
        cantidad: 1,
        motivo: "Vencimiento / Caducado",
        observaciones: "",
      })

      loadStats()
      loadStockData()
      if (activeTab === "kardex") loadMovements()
      if (activeTab === "mermas") loadAdjustments()
    } catch (e: any) {
      toast.error("Error al registrar merma", e.message)
    } finally {
      setSavingMerma(false)
    }
  }

  // ---------------------------------------------------------------------------
  // ESCÁNER TOMA FÍSICA
  // ---------------------------------------------------------------------------
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scanCode.trim()) return

    const term = scanCode.trim().toLowerCase()
    const found = products.find(p =>
      p.codigo_barra?.toLowerCase() === term ||
      p.sku?.toLowerCase() === term ||
      p.nombre?.toLowerCase().includes(term)
    )

    if (found) {
      setScannedItems(prev => {
        const idx = prev.findIndex(item => item.product.id === found.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx].cantidad_fisica += 1
          return updated
        }
        // Buscar stock actual en sistema
        const stockActual = stock.find(s => s.product_id === found.id)?.cantidad || 0
        return [{ product: found, cantidad_fisica: 1, cantidad_sistema: stockActual }, ...prev]
      })
      toast.success("Producto Escaneado", found.nombre)
      setScanCode("")
    } else {
      toast.error("Código no encontrado", `No se halló ningún producto con "${scanCode}"`)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in pb-24">
      {/* ──────────────────────────────────────────────────────────────────────────
          HEADER PRINCIPAL
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Control de Inventario & Almacenes
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Existencias físicas valorizadas, trazabilidad Kardex en tiempo real, registro de mermas y auditoría de stock.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              loadStats()
              loadStockData()
              if (activeTab === "kardex") loadMovements()
              if (activeTab === "mermas") loadAdjustments()
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
            title="Refrescar inventario"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStock ? "animate-spin text-indigo-600" : ""}`} />
          </button>

          <button
            onClick={() => setShowMermaModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md flex items-center gap-2 transition-colors"
          >
            <ShieldAlert className="w-4 h-4" /> + Registrar Merma / Baja
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          HERO KPIS (TIPOGRAFÍA UNIFICADA MONOSPACE EXTRABOLD)
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Valor Total al Costo */}
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor Stock (Costo)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {formatPYG(stats?.valor_total_costo || 0)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">
            Costo promedio ponderado de inventario
          </span>
        </div>

        {/* KPI 2: Venta Proyectada */}
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor Venta Proyectada</span>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
            {formatPYG(stats?.valor_total_venta_proyectada || 0)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">
            <strong className="text-slate-700 dark:text-slate-300 font-mono">
              {stats?.total_unidades_fisicas?.toLocaleString() || 0}
            </strong> unidades físicas totales
          </span>
        </div>

        {/* KPI 3: Quiebres / Bajo Stock */}
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quiebres de Stock</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-extrabold text-red-600 dark:text-red-400 font-mono">
            {stats?.total_quiebres?.toLocaleString() || 0}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">
            <strong className="text-amber-500 font-bold font-mono">{stats?.total_bajos || 0}</strong> en punto de reorden
          </span>
        </div>

        {/* KPI 4: Mermas del Mes */}
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mermas (Últimos 30d)</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {formatPYG(stats?.monto_mermas_mes_gs || 0)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">
            <strong className="text-slate-700 dark:text-slate-300 font-mono">{stats?.cant_mermas_mes || 0}</strong> eventos de baja
          </span>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑAS DE NAVEGACIÓN
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {[
          { key: "stock", label: "Existencias Físicas", icon: Package },
          { key: "kardex", label: "Kardex de Movimientos", icon: Layers },
          { key: "mermas", label: `Mermas & Ajustes (${adjustments.length})`, icon: ShieldAlert },
          { key: "toma_fisica", label: "Toma Física / Escáner", icon: Barcode },
          { key: "warehouses", label: `Almacenes (${warehouses.length})`, icon: Building2 },
          { key: "desposte", label: "Simulador de Desposte", icon: Scale },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 1: EXISTENCIAS FÍSICAS
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto en stock por nombre, SKU o código de barra..."
                  value={searchStock}
                  onChange={(e) => setSearchStock(e.target.value)}
                  className="input-field pl-9 pr-8 w-full text-xs font-medium py-2.5"
                />
                {searchStock && (
                  <button onClick={() => setSearchStock("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="w-full sm:w-64">
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="input-field w-full text-xs font-semibold py-2.5"
                >
                  <option value="all">Todos los Almacenes ({warehouses.length})</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nombre} ({w.codigo})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags de Estado */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" /> Estado:
              </span>
              {[
                { key: "todos", label: `Todos (${stock.length})` },
                { key: "con_stock", label: "Con Stock Físico" },
                { key: "quiebre", label: "Quiebre / Stock 0" },
                { key: "bajo_stock", label: "Stock Bajo (1-10 un.)" },
              ].map((tag) => (
                <button
                  key={tag.key}
                  onClick={() => setFilterStockStatus(tag.key as any)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    filterStockStatus === tag.key
                      ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 dark:ring-indigo-900"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla de Stock */}
          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mostrando {paginatedStock.length} de {filteredStock.length} existencias
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Páginas:</span>
                {[25, 50, 100].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setPageSizeStock(size)
                      setPageStock(1)
                    }}
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                      pageSizeStock === size ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {loadingStock ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-500">Cargando existencias físicas...</p>
              </div>
            ) : paginatedStock.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-500" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No se encontraron existencias</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[900px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5 min-w-[260px]">Producto & SKU</th>
                      <th className="p-3.5">Almacén / Depósito</th>
                      <th className="p-3.5 text-right font-bold">Stock Físico</th>
                      <th className="p-3.5 text-right text-slate-400">Reservado</th>
                      <th className="p-3.5 text-right font-bold text-emerald-600">Disponible</th>
                      <th className="p-3.5 text-right">Costo Unit.</th>
                      <th className="p-3.5 text-right">Valor Total</th>
                      <th className="p-3.5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedStock.map((s: any) => {
                      const pName = s.nombre || s.product?.nombre || "Producto"
                      const pSku = s.sku || s.product?.sku || s.product_id?.substring(0, 8)
                      const wName = s.warehouse?.nombre || warehouses.find(w => w.id === s.warehouse_id)?.nombre || "Depósito Central"
                      const qty = Number(s.cantidad || 0)
                      const res = Number(s.cantidad_reservada || 0)
                      const disp = Math.max(0, qty - res)
                      const costo = Number(s.costo_unitario || s.costo_promedio || 0)
                      const valorTotal = qty * costo

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 dark:text-white truncate">{pName}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {pSku}</div>
                          </td>
                          <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">{wName}</td>
                          <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">{qty}</td>
                          <td className="p-3.5 text-right font-mono text-slate-400">{res}</td>
                          <td className="p-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{disp}</td>
                          <td className="p-3.5 text-right font-mono text-slate-600 dark:text-slate-400">{formatPYG(costo)}</td>
                          <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">{formatPYG(valorTotal)}</td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                qty <= 0
                                  ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                                  : qty <= 10
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                              }`}
                            >
                              {qty <= 0 ? "QUIEBRE" : qty <= 10 ? "BAJO" : "ÓPTIMO"}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginador */}
            {!loadingStock && filteredStock.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Página <strong className="text-slate-800 dark:text-slate-200">{pageStock}</strong> de <strong className="text-slate-800 dark:text-slate-200">{totalStockPages}</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPageStock(prev => Math.max(1, prev - 1))}
                    disabled={pageStock === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-40 hover:bg-slate-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPageStock(prev => Math.min(totalStockPages, prev + 1))}
                    disabled={pageStock === totalStockPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-40 hover:bg-slate-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 2: KARDEX DE MOVIMIENTOS
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "kardex" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar movimientos por producto, motivo o usuario..."
                value={kardexSearch}
                onChange={(e) => setKardexSearch(e.target.value)}
                className="input-field pl-9 pr-8 w-full text-xs font-medium py-2.5"
              />
            </div>

            <div className="w-full sm:w-56">
              <select
                value={kardexTipo}
                onChange={(e) => setKardexTipo(e.target.value)}
                className="input-field w-full text-xs font-semibold py-2.5"
              >
                <option value="">Todos los Tipos</option>
                <option value="entrada_compra">Entradas por Compra</option>
                <option value="salida_venta">Salidas por Venta</option>
                <option value="merma">Mermas / Bajas</option>
                <option value="ajuste">Ajustes de Inventario</option>
                <option value="transferencia">Transferencias</option>
              </select>
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            {loadingMovements ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-500">Cargando Kardex...</p>
              </div>
            ) : movements.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-500" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Sin movimientos registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Fecha & Hora</th>
                      <th className="p-3.5 min-w-[220px]">Producto & SKU</th>
                      <th className="p-3.5">Almacén</th>
                      <th className="p-3.5 text-center">Tipo</th>
                      <th className="p-3.5 text-right font-bold">Cantidad</th>
                      <th className="p-3.5 text-right">Costo Unit.</th>
                      <th className="p-3.5">Motivo / Documento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                          {new Date(m.created_at).toLocaleString("es-PY")}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 dark:text-white truncate">{m.product_nombre || "Producto"}</div>
                          <div className="text-[10px] text-slate-400 font-mono">SKU: {m.product_sku || "—"}</div>
                        </td>
                        <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">{m.warehouse_nombre || "Depósito Central"}</td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              m.tipo.includes("entrada")
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : m.tipo.includes("merma")
                                ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                                : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                            }`}
                          >
                            {m.tipo}
                          </span>
                        </td>
                        <td className={`p-3.5 text-right font-mono font-bold ${m.cantidad > 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                        </td>
                        <td className="p-3.5 text-right font-mono text-slate-600">{formatPYG(m.costo_unitario)}</td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400 truncate max-w-xs">{m.motivo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 3: MERMAS & AJUSTES
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "mermas" && (
        <div className="space-y-4">
          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Historial de Ajustes y Mermas</h3>
                <p className="text-xs text-slate-500">Diferencias de inventario, bajas operativas y mermas valorizadas.</p>
              </div>

              <button
                onClick={() => setShowMermaModal(true)}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Registrar Nueva Merma
              </button>
            </div>

            {loadingAdjustments ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-500">Cargando historial de ajustes...</p>
              </div>
            ) : adjustments.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-500" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay ajustes registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Código Ajuste</th>
                      <th className="p-3.5">Fecha</th>
                      <th className="p-3.5">Almacén</th>
                      <th className="p-3.5">Motivo</th>
                      <th className="p-3.5 text-center">Ítems</th>
                      <th className="p-3.5 text-right">Diferencia Un.</th>
                      <th className="p-3.5 text-right font-bold">Impacto Gs.</th>
                      <th className="p-3.5 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {adjustments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-indigo-600">{a.codigo}</td>
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                          {new Date(a.created_at).toLocaleDateString("es-PY")}
                        </td>
                        <td className="p-3.5 font-medium">{a.warehouse_nombre || "Depósito Central"}</td>
                        <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">{a.motivo}</td>
                        <td className="p-3.5 text-center font-mono">{a.total_items}</td>
                        <td className={`p-3.5 text-right font-mono font-bold ${a.diferencia_unidades < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {a.diferencia_unidades}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatPYG(a.diferencia_valorizada_gs)}
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              a.estado === "aprobado"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                            }`}
                          >
                            {a.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 4: TOMA FÍSICA / ESCÁNER
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "toma_fisica" && (
        <div className="space-y-6">
          <div className="card p-6 bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-indigo-950/30 dark:to-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-3xl">
            <div className="max-w-xl mx-auto text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
                <Barcode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Modo Auditoría / Toma Física de Pasillo</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Pistoleá el código de barras del producto con el colector de datos para auditar existencias en góndola.
                </p>
              </div>

              <form onSubmit={handleScanSubmit} className="flex gap-2">
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="Escaneá código de barras o escribí SKU..."
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  className="input-field flex-1 text-center font-mono font-bold text-sm py-3"
                  autoFocus
                />
                <button type="submit" className="btn-primary text-xs px-6 font-bold shadow-md">
                  Contar (+1)
                </button>
              </form>
            </div>
          </div>

          {/* Lista de Ítems Contados */}
          {scannedItems.length > 0 && (
            <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Ítems Auditados en la Sesión ({scannedItems.length})
                </h4>
                <button
                  onClick={() => setScannedItems([])}
                  className="text-xs text-red-500 font-bold hover:underline"
                >
                  Limpiar sesión
                </button>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Producto</th>
                    <th className="p-3.5 text-right">Stock Teórico</th>
                    <th className="p-3.5 text-right font-bold">Físico Contado</th>
                    <th className="p-3.5 text-right font-bold">Diferencia</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {scannedItems.map((item, idx) => {
                    const diff = item.cantidad_fisica - item.cantidad_sistema
                    return (
                      <tr key={item.product.id}>
                        <td className="p-3.5">
                          <div className="font-bold">{item.product.nombre}</div>
                          <div className="text-[10px] text-slate-400 font-mono">SKU: {item.product.sku}</div>
                        </td>
                        <td className="p-3.5 text-right font-mono">{item.cantidad_sistema}</td>
                        <td className="p-3.5 text-right font-mono font-black text-indigo-600 text-sm">
                          {item.cantidad_fisica}
                        </td>
                        <td className={`p-3.5 text-right font-mono font-bold ${diff === 0 ? "text-slate-400" : diff > 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => {
                              setScannedItems(prev => prev.filter((_, i) => i !== idx))
                            }}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 5: ALMACENES / DEPÓSITOS
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "warehouses" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {warehouses.map((w) => (
            <div key={w.id} className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600">
                  {w.tipo || "Principal"}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{w.nombre}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Código: {w.codigo}</p>
                {w.direccion && <p className="text-xs text-slate-500 mt-1">{w.direccion}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 6: SIMULADOR DE DESPOSTE (CARNICERÍA)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "desposte" && (
        <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Simulador de Desposte de Res</h3>
              <p className="text-xs text-slate-500">Fraccionamiento de media res en cortes nobles, hueso y merma.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Peso Media Res (Kg)</label>
              <input
                type="number"
                value={despostePeso}
                onChange={(e) => setDespostePeso(Number(e.target.value))}
                className="input-field w-full text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Costo Total Compra (Gs.)</label>
              <input
                type="number"
                value={desposteCosto}
                onChange={(e) => setDesposteCosto(Number(e.target.value))}
                className="input-field w-full text-xs font-mono font-bold text-indigo-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: REGISTRAR MERMA / BAJA DE STOCK
      ────────────────────────────────────────────────────────────────────────── */}
      {showMermaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-600 text-white">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Registrar Merma / Baja</h3>
                  <p className="text-[11px] text-slate-500">Descuenta stock físico y registra pérdida monetaria.</p>
                </div>
              </div>
              <button onClick={() => setShowMermaModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMerma} className="p-6 space-y-4">
              {/* Almacén */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Almacén / Depósito *</label>
                <select
                  required
                  value={mermaForm.warehouse_id}
                  onChange={(e) => setMermaForm({ ...mermaForm, warehouse_id: e.target.value })}
                  className="input-field w-full text-xs font-semibold"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nombre} ({w.codigo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Producto */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Producto a dar de baja *</label>
                <select
                  required
                  value={mermaForm.product_id}
                  onChange={(e) => {
                    const prodId = e.target.value
                    const p = products.find(p => p.id === prodId) || null
                    setMermaSelectedProduct(p)
                    setMermaForm({ ...mermaForm, product_id: prodId })
                  }}
                  className="input-field w-full text-xs font-bold"
                >
                  <option value="">Seleccionar Producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (SKU: {p.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Cantidad y Motivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cantidad a descontar *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={mermaForm.cantidad}
                    onChange={(e) => setMermaForm({ ...mermaForm, cantidad: Math.max(1, Number(e.target.value)) })}
                    className="input-field w-full text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Motivo Estandarizado *</label>
                  <select
                    value={mermaForm.motivo}
                    onChange={(e) => setMermaForm({ ...mermaForm, motivo: e.target.value })}
                    className="input-field w-full text-xs font-semibold"
                  >
                    <option value="Vencimiento / Caducado">Vencimiento / Caducado</option>
                    <option value="Rotura / Daño en Góndola">Rotura / Daño en Góndola</option>
                    <option value="Consumo Interno">Consumo Interno</option>
                    <option value="Robo / Faltante Identificado">Robo / Faltante Identificado</option>
                    <option value="Merma de Fraccionamiento">Merma de Fraccionamiento</option>
                  </select>
                </div>
              </div>

              {/* Resumen de Impacto Financiero */}
              {mermaSelectedProduct && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Impacto en Pérdidas</span>
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mt-0.5">
                      Costo Unit.: {formatPYG(Number(mermaSelectedProduct.costo_promedio || 0))}
                    </p>
                  </div>
                  <p className="text-base font-black font-mono text-red-600">
                    -{formatPYG(Number(mermaForm.cantidad) * Number(mermaSelectedProduct.costo_promedio || 0))}
                  </p>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Observaciones / Justificación</label>
                <textarea
                  rows={2}
                  value={mermaForm.observaciones}
                  onChange={(e) => setMermaForm({ ...mermaForm, observaciones: e.target.value })}
                  placeholder="Detalle de la merma, responsable o lote afectado..."
                  className="input-field w-full text-xs"
                />
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMermaModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMerma}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {savingMerma && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar Baja de Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
