import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Warehouse, ArrowLeftRight, AlertTriangle, Package, Search, Plus, Loader2, X,
  Send, Trash2, Minus, Scale, ThermometerSnowflake, HeartPulse, ClipboardCheck,
  CalendarRange, DollarSign, TrendingDown, Layers, Barcode, CheckCircle2,
  RefreshCw, Filter, Sparkles, Box, ShieldAlert, ArrowUpDown, ChevronDown,
  Building2, Eye, Clock, FileText, Check, AlertCircle, ShoppingCart, Info, HelpCircle, FileSpreadsheet,
  Edit2, CornerDownRight, FolderTree, Truck, RotateCcw
} from "lucide-react"
import {
  api,
  type Warehouse as WarehouseType,
  type StockItem,
  type InventoryMovementRecord,
  type Product,
  type PackBarcode,
} from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import AjustesTab from "./AjustesTab"
import TomaFisicaTab from "./TomaFisicaTab"
import WarehouseModal, { type WarehouseFormData } from "./WarehouseModal"
import KardexProductoDetalleModal, { type KardexProductoInfo } from "./KardexProductoDetalleModal"
import KardexProductPickerModal from "./KardexProductPickerModal"

export default function InventoryPage() {
  const toast = useToast()
  const [searchParams] = useSearchParams()

  // Estado Principal
  const [activeTab, setActiveTab] = useState<"stock" | "stock_valorizado" | "vencimientos" | "kardex" | "ajustes" | "toma_fisica" | "warehouses">("stock")
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [stats, setStats] = useState<any>(null)
  const [movements, setMovements] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [packBarcodeMap, setPackBarcodeMap] = useState<Map<string, { productId: string; etiqueta: string; unidadesPorPaquete: number }>>(new Map())

  // Stock Valorizado por Proveedor & Fecha de Corte Histórica
  const [valuationData, setValuationData] = useState<any>(null)
  const [loadingValuation, setLoadingValuation] = useState(false)
  const [valuationWarehouse, setValuationWarehouse] = useState<string>("all")
  const [valuationSupplier, setValuationSupplier] = useState<string>("all")
  const [valuationFechaCorte, setValuationFechaCorte] = useState<string>("")
  const [valuationSearch, setValuationSearch] = useState<string>("")
  const [downloadingValuationPdf, setDownloadingValuationPdf] = useState(false)
  const [downloadingValuationXlsx, setDownloadingValuationXlsx] = useState(false)
  const [suppliersList, setSuppliersList] = useState<any[]>([])

  const [expiriesData, setExpiriesData] = useState<any>(null)
  const [loadingExpiries, setLoadingExpiries] = useState(false)
  const [expiryFilter, setExpiryFilter] = useState<"todos" | "vencido" | "critico_7d" | "alerta_30d" | "vigente">("todos")
  const [searchExpiry, setSearchExpiry] = useState("")

  // Sincronizar pestaña y filtros desde URL params (ej. badges del layout o encabezado)
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["stock", "stock_valorizado", "vencimientos", "kardex", "ajustes", "toma_fisica", "warehouses"].includes(tab)) {
      setActiveTab(tab as any)
    }
    const filter = searchParams.get("filter")
    if (filter === "criticos" || filter === "critico_7d") {
      setExpiryFilter("critico_7d")
    } else if (filter === "vencidos" || filter === "vencido") {
      setExpiryFilter("vencido")
    }
  }, [searchParams])

  // Modal de Acción para Lote (Merma / Devolución a Proveedor)
  const [lotActionModal, setLotActionModal] = useState<{
    open: boolean
    lot: any | null
    tipo: "merma" | "devolucion"
    cantidad: number
    motivo: string
    observaciones: string
    submitting: boolean
  }>({
    open: false,
    lot: null,
    tipo: "merma",
    cantidad: 1,
    motivo: "Caducidad / Fecha Vencida",
    observaciones: "",
    submitting: false,
  })

  const handleOpenLotAction = (lot: any, tipo: "merma" | "devolucion") => {
    setLotActionModal({
      open: true,
      lot,
      tipo,
      cantidad: lot.cantidad_disponible || 1,
      motivo: tipo === "merma" ? "Caducidad / Fecha Vencida" : "Canje acordado por vencimiento con proveedor",
      observaciones: tipo === "merma" ? `Baja por caducidad lote ${lot.referencia}` : `Devolución para canje lote ${lot.referencia}`,
      submitting: false,
    })
  }

  const handleConfirmLotAction = async () => {
    if (!lotActionModal.lot) return
    const cant = Number(lotActionModal.cantidad)
    if (isNaN(cant) || cant <= 0 || cant > lotActionModal.lot.cantidad_disponible) {
      toast.error("Cantidad Inválida", `Debe ser entre 1 y ${lotActionModal.lot.cantidad_disponible}`)
      return
    }
    setLotActionModal(prev => ({ ...prev, submitting: true }))
    try {
      const isDev = lotActionModal.tipo === "devolucion"
      await api.inventory.recordMerma({
        warehouse_id: lotActionModal.lot.warehouse_id,
        product_id: lotActionModal.lot.product_id,
        lot_id: lotActionModal.lot.id,
        cantidad: cant,
        motivo: isDev
          ? `Devolución a Proveedor: ${lotActionModal.motivo}`
          : `Merma: ${lotActionModal.motivo}`,
        observaciones: lotActionModal.observaciones,
      })
      toast.success(
        isDev ? "Devolución a Proveedor Registrada" : "Merma Registrada",
        `Se procesaron ${cant} uds del lote ${lotActionModal.lot.referencia}`
      )
      setLotActionModal(prev => ({ ...prev, open: false, submitting: false }))
      loadExpiriesData()
    } catch (e: any) {
      toast.error("Error al procesar acción de lote", e.message)
      setLotActionModal(prev => ({ ...prev, submitting: false }))
    }
  }

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
  const [kardexFechaDesde, setKardexFechaDesde] = useState("")
  const [kardexFechaHasta, setKardexFechaHasta] = useState("")
  // Antes el kardex traia siempre limit=100 fijo, sin forma de ver mas --
  // con miles de movimientos reales eso mostraba una fraccion minima del
  // historial. Ahora es paginado de verdad (cargar mas por offset) y
  // ademas se puede hacer clic en un producto para ver SU historial
  // completo aparte, sin competir con el limite de pagina del listado
  // general.
  const [kardexOffset, setKardexOffset] = useState(0)
  const [kardexHasMore, setKardexHasMore] = useState(true)
  const [loadingMoreMovements, setLoadingMoreMovements] = useState(false)
  const [kardexProductoDetalle, setKardexProductoDetalle] = useState<{ id: string; nombre: string; sku?: string } | null>(null)
  const [kardexDetalleMovs, setKardexDetalleMovs] = useState<any[]>([])
  const [loadingKardexDetalle, setLoadingKardexDetalle] = useState(false)
  const [kardexSummary, setKardexSummary] = useState<any>(null)
  const [loadingKardexSummary, setLoadingKardexSummary] = useState(false)
  const [exportingKardex, setExportingKardex] = useState<"xlsx" | "pdf" | null>(null)
  const [showProductKardexPicker, setShowProductKardexPicker] = useState(false)

  const loadKardexSummary = useCallback(async () => {
    setLoadingKardexSummary(true)
    try {
      const s = await api.inventory.getKardexSummary({
        fecha_desde: kardexFechaDesde || undefined,
        fecha_hasta: kardexFechaHasta || undefined,
      })
      setKardexSummary(s)
    } catch (e: any) {
      // El dashboard es un extra visual -- si falla, no tapamos la tabla del kardex con un error
    } finally {
      setLoadingKardexSummary(false)
    }
  }, [kardexFechaDesde, kardexFechaHasta])

  const handleExportKardex = async (formato: "xlsx" | "pdf") => {
    setExportingKardex(formato)
    try {
      const params = { fecha_desde: kardexFechaDesde || undefined, fecha_hasta: kardexFechaHasta || undefined, tipo: kardexTipo || undefined }
      if (formato === "xlsx") await api.inventory.downloadKardexExcel(params)
      else await api.inventory.downloadKardexPdf(params)
    } catch (e: any) {
      toast.error("No se pudo exportar", e.message)
    } finally {
      setExportingKardex(null)
    }
  }

  // Paginación Stock
  const [pageStock, setPageStock] = useState(1)
  const [pageSizeStock, setPageSizeStock] = useState(25)

  // Modal Nuevo Depósito / Subdepósito
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [editingWh, setEditingWh] = useState<WarehouseType | null>(null)
  const [deletingWhId, setDeletingWhId] = useState<string | null>(null)
  const [whFilterTipo, setWhFilterTipo] = useState<string>("all")
  const [whForm, setWhForm] = useState<{
    codigo: string
    nombre: string
    direccion: string
    tipo: string
    parent_id: string | null
    responsable: string
    descripcion: string
  }>({
    codigo: "",
    nombre: "",
    direccion: "",
    tipo: "principal",
    parent_id: null,
    responsable: "",
    descripcion: "",
  })
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

  const loadMovementsData = useCallback(async (customSearch?: string, customTipo?: string) => {
    setLoadingMovements(true)
    setKardexOffset(0)
    try {
      const searchVal = customSearch !== undefined ? customSearch : kardexSearch
      const tipoVal = customTipo !== undefined ? customTipo : kardexTipo
      const m = await api.inventory.listMovements({
        limit: 200,
        offset: 0,
        search: searchVal ? searchVal.trim() : undefined,
        tipo: tipoVal || undefined,
        fecha_desde: kardexFechaDesde || undefined,
        fecha_hasta: kardexFechaHasta || undefined,
      })
      setMovements(m as any)
      setKardexHasMore((m as any[]).length === 200)
    } catch (e: any) {
      toast.error("Error al cargar kardex", e.message)
    } finally {
      setLoadingMovements(false)
    }
  }, [kardexFechaDesde, kardexFechaHasta, kardexSearch, kardexTipo])

  const loadMoreMovements = async () => {
    const nextOffset = kardexOffset + 200
    setLoadingMoreMovements(true)
    try {
      const m = await api.inventory.listMovements({
        limit: 200,
        offset: nextOffset,
        search: kardexSearch ? kardexSearch.trim() : undefined,
        tipo: kardexTipo || undefined,
        fecha_desde: kardexFechaDesde || undefined,
        fecha_hasta: kardexFechaHasta || undefined,
      })
      setMovements(prev => [...prev, ...(m as any)])
      setKardexOffset(nextOffset)
      setKardexHasMore((m as any[]).length === 200)
    } catch (e: any) {
      toast.error("Error al cargar mas movimientos", e.message)
    } finally {
      setLoadingMoreMovements(false)
    }
  }

  // Historial COMPLETO de un producto puntual -- se abre al hacer clic en
  // cualquier fila del kardex general. No hereda el filtro de fecha del
  // listado general (el cajero quiere ver TODO el historial de ese SKU,
  // no solo lo que estaba viendo en la grilla).
  const openKardexProductoDetalle = async (productId: string, nombre: string, sku?: string) => {
    setKardexProductoDetalle({ id: productId, nombre, sku })
    setLoadingKardexDetalle(true)
    try {
      const m = await api.inventory.listMovements({ product_id: productId, limit: 500 })
      setKardexDetalleMovs(m as any)
    } catch (e: any) {
      toast.error("Error al cargar historial del producto", e.message)
    } finally {
      setLoadingKardexDetalle(false)
    }
  }

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
    try {
      const packBarcodes = await api.products.packBarcodes.list()
      const map = new Map<string, { productId: string; etiqueta: string; unidadesPorPaquete: number }>()
      for (const pb of (packBarcodes || []) as PackBarcode[]) {
        if (!pb.activo) continue
        map.set(pb.codigo_barra, {
          productId: pb.product_id,
          etiqueta: pb.etiqueta,
          unidadesPorPaquete: Number(pb.unidades_por_paquete),
        })
      }
      setPackBarcodeMap(map)
    } catch {
      // ignore
    }
  }, [])

  const loadSuppliers = useCallback(async () => {
    try {
      const sups = await api.purchases.listSuppliers()
      if (Array.isArray(sups)) {
        setSuppliersList(sups)
      }
    } catch {
      // ignore
    }
  }, [])

  const loadValuationData = useCallback(async () => {
    setLoadingValuation(true)
    try {
      const res = await api.reports.inventoryValuation({
        warehouse_id: valuationWarehouse === "all" ? undefined : valuationWarehouse,
        supplier_id: valuationSupplier === "all" ? undefined : valuationSupplier,
        fecha_corte: valuationFechaCorte || undefined,
      })
      setValuationData(res)
    } catch (e: any) {
      toast.error("Error al cargar inventario valorizado", e.message)
    } finally {
      setLoadingValuation(false)
    }
  }, [valuationWarehouse, valuationSupplier, valuationFechaCorte, toast])

  const handleExportValuationPdf = async () => {
    setDownloadingValuationPdf(true)
    try {
      await api.reports.downloadInventoryValuationPdf({
        warehouse_id: valuationWarehouse === "all" ? undefined : valuationWarehouse,
        supplier_id: valuationSupplier === "all" ? undefined : valuationSupplier,
        fecha_corte: valuationFechaCorte || undefined,
      })
      toast.success("PDF Descargado", "Informe institucional de stock valorizado descargado")
    } catch (e: any) {
      toast.error("Error al generar PDF", e.message)
    } finally {
      setDownloadingValuationPdf(false)
    }
  }

  const handleExportValuationXlsx = async () => {
    setDownloadingValuationXlsx(true)
    try {
      await api.reports.downloadInventoryValuationXlsx({
        warehouse_id: valuationWarehouse === "all" ? undefined : valuationWarehouse,
        supplier_id: valuationSupplier === "all" ? undefined : valuationSupplier,
        fecha_corte: valuationFechaCorte || undefined,
      })
      toast.success("Excel Descargado", "Planilla contable de stock valorizado descargada")
    } catch (e: any) {
      toast.error("Error al exportar Excel", e.message)
    } finally {
      setDownloadingValuationXlsx(false)
    }
  }

  useEffect(() => {
    loadStats()
    loadProducts()
    loadSuppliers()
  }, [loadStats, loadProducts, loadSuppliers])

  useEffect(() => {
    if (activeTab === "stock") loadStockData()
    if (activeTab === "stock_valorizado") loadValuationData()
    if (activeTab === "vencimientos") loadExpiriesData()
  }, [activeTab, loadStockData, loadValuationData, loadExpiriesData])

  useEffect(() => {
    if (activeTab !== "kardex") return
    loadKardexSummary()
    const timer = setTimeout(() => {
      loadMovementsData(kardexSearch, kardexTipo)
    }, 300)
    return () => clearTimeout(timer)
  }, [activeTab, loadKardexSummary, loadMovementsData, kardexSearch, kardexTipo, kardexFechaDesde, kardexFechaHasta])



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

  // Movimientos de Kardex provistos directamente por la Base de Datos (con filtros de búsqueda en SQL)
  const filteredMovements = movements

  // Crear Depósito
  // Crear / Editar Depósito o Subdepósito
  const handleOpenCreateWhModal = (parentId: string | null = null) => {
    setEditingWh(null)
    setWhForm({
      codigo: "",
      nombre: "",
      direccion: "",
      tipo: parentId ? "subdeposito" : "principal",
      parent_id: parentId,
      responsable: "",
      descripcion: "",
    })
    setShowWarehouseModal(true)
  }

  const handleOpenEditWhModal = (w: WarehouseType) => {
    setEditingWh(w)
    setWhForm({
      codigo: w.codigo || "",
      nombre: w.nombre,
      direccion: w.direccion || "",
      tipo: w.tipo || (w.parent_id ? "subdeposito" : "principal"),
      parent_id: w.parent_id || null,
      responsable: w.responsable || "",
      descripcion: w.descripcion || "",
    })
    setShowWarehouseModal(true)
  }

  const handleSaveWarehouse = async (formData: WarehouseFormData) => {
    if (!formData.nombre.trim() || !formData.codigo.trim()) return
    setSavingWh(true)
    try {
      const payload = {
        codigo: formData.codigo.trim().toUpperCase(),
        nombre: formData.nombre.trim(),
        direccion: formData.direccion.trim() || undefined,
        tipo: formData.tipo,
        parent_id: formData.parent_id || undefined,
        responsable: formData.responsable.trim() || undefined,
        descripcion: formData.descripcion.trim() || undefined,
        activo: true,
      }
      if (editingWh) {
        await api.warehouses.update(editingWh.id, payload)
        toast.success("Depósito Actualizado", `Se guardaron los cambios en "${payload.nombre}"`)
      } else {
        await api.warehouses.create(payload)
        toast.success(
          payload.parent_id ? "Subdepósito Creado" : "Depósito Creado",
          `Se agregó "${payload.nombre}" exitosamente.`
        )
      }
      setShowWarehouseModal(false)
      setEditingWh(null)
      loadStockData()
    } catch (e: any) {
      toast.error("Error al guardar depósito", e.message || "No se pudo procesar la solicitud.")
    } finally {
      setSavingWh(false)
    }
  }

  const handleDeleteWarehouse = async (w: WarehouseType) => {
    const isSub = !!w.parent_id
    const conf = window.confirm(
      `¿Está seguro de dar de baja el ${isSub ? "subdepósito" : "depósito"} "${w.nombre}" (Código: ${w.codigo})?\n\nSolo podrá desactivarse si no posee existencias de stock activas.`
    )
    if (!conf) return
    setDeletingWhId(w.id)
    try {
      await api.warehouses.delete(w.id)
      toast.success(
        "Depósito Desactivado",
        `El ${isSub ? "subdepósito" : "depósito"} "${w.nombre}" fue dado de baja correctamente.`
      )
      loadStockData()
    } catch (e: any) {
      toast.error("No se pudo desactivar", e.message || "Error al dar de baja el depósito.")
    } finally {
      setDeletingWhId(null)
    }
  }

  // Escanear Producto en Toma Física
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!scanCode.trim()) return

    const cleanCode = scanCode.trim()
    const p = products.find(prod => prod.codigo_barra === cleanCode || prod.sku === cleanCode)
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
      const packMatch = packBarcodeMap.get(cleanCode)
      const baseProduct = packMatch ? products.find(prod => prod.id === packMatch.productId) : undefined
      if (packMatch && baseProduct) {
        setScannedItems(prev => {
          const idx = prev.findIndex(item => item.product.id === baseProduct.id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx].cantidad_fisica += packMatch.unidadesPorPaquete
            return updated
          }
          const sysStock = stock.find(s => s.product_id === baseProduct.id)?.cantidad ?? 0
          return [{ product: baseProduct, cantidad_fisica: packMatch.unidadesPorPaquete, cantidad_sistema: sysStock }, ...prev]
        })
        toast.success(`${packMatch.etiqueta} detectado`, `${baseProduct.nombre} (+${packMatch.unidadesPorPaquete})`)
      } else {
        toast.warning("Código no encontrado", `No se encontró ningún producto con código ${scanCode}`)
      }
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
                    {warehouses.length} Depósitos Conectados
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
                💰 {loadingStats ? "Cargando existencias..." : `${formatPYG(stats?.valor_total_costo ?? 0)} en existencias`}
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
              onClick={() => handleOpenCreateWhModal()}
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
              {warehouses.length}
            </p>
            <p className="text-[11px] text-slate-400">Salón, cámaras y reserva</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valorización Costo</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {loadingStats ? "—" : formatPYG(stats?.valor_total_costo ?? 0)}
            </p>
            <p className="text-[11px] text-slate-400">Patrimonio en inventario</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quiebres / Stock 0</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {loadingStats ? "—" : (stats?.total_quiebres ?? stock.filter(s => (s.cantidad ?? 0) <= 0).length)}
            </p>
            <p className="text-[11px] text-slate-400">SKUs sin disponibilidad</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stock Bajo Mínimo</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {loadingStats ? "—" : (stats?.total_bajos ?? 0)}
            </p>
            <p className="text-[11px] text-slate-400">Alerta de punto de pedido</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "stock", label: "Existencias por Depósito", icon: Package },
          { id: "stock_valorizado", label: "Stock Valorizado (Proveedor & Corte)", icon: DollarSign },
          { id: "vencimientos", label: "Control de Vencimientos & Lotes", icon: Clock },
          { id: "kardex", label: "Kardex & Movimientos", icon: Layers },
          { id: "ajustes", label: "Ajustes de Stock (Doble Aprobación)", icon: ShieldAlert },
          { id: "toma_fisica", label: "Toma Física (Doble Ciego)", icon: Barcode },
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
            {activeTab === "stock_valorizado" && "Pestaña Especial: Stock Valorizado por Proveedor & Fecha de Corte"}
            {activeTab === "vencimientos" && "Pestaña 2: Auditoría de Lotes & Control de Vencimientos FEFO"}
            {activeTab === "kardex" && "Pestaña 3: Libro Kardex & Trazabilidad Inmutable"}
            {activeTab === "ajustes" && "Pestaña 4: Ajustes de Stock & Flujo de Doble Aprobación"}
            {activeTab === "toma_fisica" && "Pestaña 5: Toma Física & Conteo Doble Ciego"}
            {activeTab === "warehouses" && "Pestaña 6: Catálogo de Depósitos, Filiales & Cámaras"}
          </p>
          <p className="text-gray-600 dark:text-slate-300 text-[11px] leading-relaxed">
            {activeTab === "stock" && "Muestra el inventario exacto por cada depósito del supermercado (Salón Central, Depósito 1, Cámara Frigorífica). Podés filtrar por estado de quiebre, stock bajo o buscar por código de barra o descripción."}
            {activeTab === "stock_valorizado" && "Valorización oficial del inventario a costo promedio ponderado. Permite filtrar por proveedor asignado y fijar fecha de corte histórica reconstruida retrospectivamente mediante los movimientos del Kardex."}
            {activeTab === "vencimientos" && "Monitoreo integral de lotes recibidos en muelle con fecha de caducidad. Permite priorizar la rotación FEFO (primero en vencer, primero en salir), prevenir mermas y activar rescates dinámicos en góndola."}
            {activeTab === "kardex" && "Historial oficial de cada transacción que alteró el inventario: compras recibidas, ventas de facturación/POS, mermas registradas, ajustes y transferencias entre depósitos con fecha, usuario y motivo."}
            {activeTab === "ajustes" && "Protocolo profesional e infalible de ajuste de stock con catalogación de riesgos, justificación obligatoria, evidencia documental y doble aprobación requerida de Gerencia y Administración."}
            {activeTab === "toma_fisica" && "Gestión de sesiones de inventario físico total, parcial o rotativo con doble conteo ciego independiente, detección y reconciliación de discrepancias, y generación automática de ajustes de stock."}
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
                <span className="text-gray-400 font-mono text-[11px]">
                  Mostrando página {pageStock} de {totalPagesStock} · {filteredStock.length.toLocaleString("es-PY")} artículos totales
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPageStock(p => Math.max(1, p - 1))}
                    disabled={pageStock === 1}
                    className="px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer font-medium"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPageStock(p => Math.min(totalPagesStock, p + 1))}
                    disabled={pageStock === totalPagesStock}
                    className="px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer font-medium"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONTENIDO PESTAÑA ESPECIAL: STOCK VALORIZADO ────────────────────── */}
      {activeTab === "stock_valorizado" && (
        <div className="space-y-6">
          {/* BARRA DE HERRAMIENTAS & FILTROS DE VALUACIÓN */}
          <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Filtro Depósito */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Depósito / Salón</label>
                  <select
                    value={valuationWarehouse}
                    onChange={(e) => setValuationWarehouse(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">🏢 Todos los Depósitos</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro Proveedor */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Proveedor</label>
                  <select
                    value={valuationSupplier}
                    onChange={(e) => setValuationSupplier(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 max-w-xs"
                  >
                    <option value="all">🏭 Todos los Proveedores</option>
                    {suppliersList.filter((s: any) => (s.total_productos || 0) > 0).length > 0 && (
                      <optgroup label={`📦 Con Mercaderías (${suppliersList.filter((s: any) => (s.total_productos || 0) > 0).length})`}>
                        {suppliersList
                          .filter((s: any) => (s.total_productos || 0) > 0)
                          .map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.razon_social || s.nombre_fantasia || "Proveedor"} ({s.total_productos} prods)
                            </option>
                          ))}
                      </optgroup>
                    )}
                    <optgroup label={`📋 Otros Proveedores (${suppliersList.filter((s: any) => (s.total_productos || 0) === 0).length})`}>
                      {suppliersList
                        .filter((s: any) => (s.total_productos || 0) === 0)
                        .map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.razon_social || s.nombre_fantasia || "Proveedor"} {s.ruc ? `(${s.ruc})` : ""}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                {/* Fecha de Corte Histórica */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Fecha de Corte Histórica (Kardex)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={valuationFechaCorte}
                      onChange={(e) => setValuationFechaCorte(e.target.value)}
                      placeholder="Hoy (Stock actual)"
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                    />
                    {valuationFechaCorte && (
                      <button
                        onClick={() => setValuationFechaCorte("")}
                        className="text-[10px] text-slate-400 hover:text-red-500 font-bold"
                        title="Limpiar fecha de corte (ver hoy)"
                      >
                        ✕ Actual
                      </button>
                    )}
                  </div>
                </div>

                {/* Búsqueda de producto */}
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Filtrar por Artículo</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={valuationSearch}
                      onChange={(e) => setValuationSearch(e.target.value)}
                      placeholder="Buscar por SKU o descripción..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción y descarga */}
              <div className="flex items-center gap-2 self-end lg:self-center">
                <button
                  onClick={loadValuationData}
                  disabled={loadingValuation}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingValuation ? "animate-spin" : ""}`} />
                  Recalcular
                </button>
                <button
                  onClick={handleExportValuationPdf}
                  disabled={downloadingValuationPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 text-white text-xs font-bold shadow-sm hover:from-red-500 hover:to-rose-600 transition cursor-pointer disabled:opacity-50"
                >
                  {downloadingValuationPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  PDF Oficial
                </button>
                <button
                  onClick={handleExportValuationXlsx}
                  disabled={downloadingValuationXlsx}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-bold shadow-sm hover:from-emerald-500 hover:to-teal-600 transition cursor-pointer disabled:opacity-50"
                >
                  {downloadingValuationXlsx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  Exportar Excel
                </button>
              </div>
            </div>
          </div>

          {/* KPIS DE CAPITAL INMOVILIZADO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capital Total en Stock</span>
              <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatPYG(valuationData?.total_value || 0)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {valuationFechaCorte ? `Valuado a corte ${valuationFechaCorte}` : "Valuado al costo actual"}
              </p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Líneas / SKUs con Existencia</span>
              <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
                {(valuationData?.total_products || 0).toLocaleString("es-PY")} artículos
              </p>
              <p className="text-xs text-slate-400 mt-1">Con saldo mayor a 0</p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Volumen Físico Total</span>
              <p className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400 mt-1">
                {(valuationData?.total_units || 0).toLocaleString("es-PY")} unidades
              </p>
              <p className="text-xs text-slate-400 mt-1">Unidades y kilogramos ponderados</p>
            </div>
          </div>

          {/* CONCENTRACIÓN DE CAPITAL POR PROVEEDOR */}
          {valuationData?.by_supplier && valuationData.by_supplier.length > 0 && (
            <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Capital Inmovilizado por Proveedor
                  </h4>
                  <p className="text-xs text-slate-400">
                    Distribución de capital inmovilizado según el proveedor asignado en el catálogo
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {valuationData.by_supplier.slice(0, 8).map((s: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate max-w-[140px]" title={s.supplier_name}>
                        {s.supplier_name}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                        {s.percentage}%
                      </span>
                    </div>
                    <p className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {formatPYG(s.total_value)}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{s.total_products} SKUs</span>
                      <span>{s.total_units.toLocaleString("es-PY")} un.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABLA DETALLADA DE PRODUCTOS VALORIZADOS */}
          <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Detalle de Artículos Valorizados
                </h4>
                <p className="text-xs text-slate-400">
                  Valuación línea por línea calculada con costo promedio ponderado
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {valuationData?.items ? valuationData.items.length : 0} artículos listados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">SKU / Código</th>
                    <th className="py-3 px-4">Descripción Producto</th>
                    <th className="py-3 px-4">Proveedor Asignado</th>
                    <th className="py-3 px-4">Depósito</th>
                    <th className="py-3 px-4 text-right">Stock</th>
                    <th className="py-3 px-4 text-right">Costo Unit. (Gs.)</th>
                    <th className="py-3 px-4 text-right">Total Valorizado (Gs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingValuation ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                        Reconstruyendo valuación retrospectiva por Kardex...
                      </td>
                    </tr>
                  ) : !valuationData?.items || valuationData.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No se encontraron artículos con existencia para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    valuationData.items
                      .filter((it: any) => {
                        if (!valuationSearch.trim()) return true
                        const q = valuationSearch.toLowerCase()
                        return it.producto.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q)
                      })
                      .map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {it.sku}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {it.producto}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                            {it.supplier_name}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                            {it.warehouse_name}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {it.stock} <span className="text-[10px] text-slate-400 font-normal">{it.unidad_medida}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                            {formatPYG(it.costo_unitario)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {formatPYG(it.valor_total)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
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
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => handleOpenLotAction(lot, "devolucion")}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60 text-[10px] font-extrabold transition cursor-pointer flex items-center gap-1"
                                title="Generar devolución o canje con el proveedor"
                              >
                                <Truck className="w-3 h-3" />
                                <span>Devolver Proveedor</span>
                              </button>
                              <button
                                onClick={() => handleOpenLotAction(lot, "merma")}
                                className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/60 text-[10px] font-extrabold transition cursor-pointer flex items-center gap-1"
                                title="Dar de baja definitiva por merma / caducidad"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Generar Merma</span>
                              </button>
                            </div>
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
          {/* ── DASHBOARD DEL KARDEX: KPIs, Top Productos, movimiento diario ── */}
          {kardexSummary && !loadingKardexSummary && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Movimientos</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white mt-1">{kardexSummary.total_movimientos?.toLocaleString("es-PY")}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{kardexSummary.productos_con_movimiento?.toLocaleString("es-PY")} productos distintos</p>
                </div>
                <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Entradas del período</p>
                  <p className="text-xl font-black text-emerald-600 mt-1">+{Math.abs(kardexSummary.total_entradas || 0).toLocaleString("es-PY")}</p>
                </div>
                <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Salidas del período</p>
                  <p className="text-xl font-black text-red-600 mt-1">-{Math.abs(kardexSummary.total_salidas || 0).toLocaleString("es-PY")}</p>
                </div>
                <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Neto del período</p>
                  <p className={`text-xl font-black mt-1 ${(kardexSummary.total_entradas + kardexSummary.total_salidas) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {(kardexSummary.total_entradas + kardexSummary.total_salidas) >= 0 ? "+" : ""}{Math.round(kardexSummary.total_entradas + kardexSummary.total_salidas).toLocaleString("es-PY")}
                  </p>
                </div>
              </div>

              {(kardexSummary.top_productos?.length > 0 || kardexSummary.por_dia?.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                  {kardexSummary.top_productos?.length > 0 && (
                    <div className="lg:col-span-2 card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-2">Top Productos por Volumen Movido</p>
                      <div className="space-y-1.5">
                        {kardexSummary.top_productos.slice(0, 6).map((p: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-gray-700 dark:text-gray-300 font-medium">{p.nombre}</span>
                            <span className="font-mono font-black text-gray-900 dark:text-white shrink-0">{p.volumen.toLocaleString("es-PY")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {kardexSummary.por_dia?.length > 0 && (
                    <div className="lg:col-span-3 card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-2">Movimiento Diario (Entradas vs. Salidas)</p>
                      <div className="flex items-end gap-1.5 h-24">
                        {(() => {
                          const maxVal = Math.max(1, ...kardexSummary.por_dia.map((d: any) => Math.max(d.entradas, Math.abs(d.salidas))))
                          return kardexSummary.por_dia.slice(-14).map((d: any, idx: number) => (
                            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5" title={`${d.dia}: +${d.entradas} / ${d.salidas}`}>
                              <div className="w-full bg-emerald-500/70 rounded-t-sm" style={{ height: `${(d.entradas / maxVal) * 45}%`, minHeight: d.entradas > 0 ? "2px" : "0" }} />
                              <div className="w-full bg-red-500/70 rounded-b-sm" style={{ height: `${(Math.abs(d.salidas) / maxVal) * 45}%`, minHeight: d.salidas < 0 ? "2px" : "0" }} />
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={kardexFechaDesde}
                  onChange={(e) => setKardexFechaDesde(e.target.value)}
                  className="input-field py-2 text-xs font-bold"
                  title="Desde"
                />
                <span className="text-gray-400 text-xs">–</span>
                <input
                  type="date"
                  value={kardexFechaHasta}
                  onChange={(e) => setKardexFechaHasta(e.target.value)}
                  className="input-field py-2 text-xs font-bold"
                  title="Hasta"
                />
                {(kardexFechaDesde || kardexFechaHasta) && (
                  <button
                    onClick={() => { setKardexFechaDesde(""); setKardexFechaHasta("") }}
                    className="text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowProductKardexPicker(true)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Buscar cualquier producto en toda la base de datos para ver su Kardex"
              >
                <Search className="w-3.5 h-3.5" />
                Consultar Producto BD
              </button>
              <span className="text-xs text-gray-400 font-mono hidden md:inline">{filteredMovements.length} movimientos</span>
              <button
                onClick={() => handleExportKardex("xlsx")}
                disabled={exportingKardex !== null}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                {exportingKardex === "xlsx" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                Excel
              </button>
              <button
                onClick={() => handleExportKardex("pdf")}
                disabled={exportingKardex !== null}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/70 disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                {exportingKardex === "pdf" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                PDF
              </button>
            </div>
          </div>

          {/* Modal Picker para consultar Kardex de cualquier producto en la Base de Datos (Regla 14) */}
          <KardexProductPickerModal
            isOpen={showProductKardexPicker}
            onClose={() => setShowProductKardexPicker(false)}
            onSelectProduct={(p: any) => {
              setShowProductKardexPicker(false)
              openKardexProductoDetalle(p.id, p.nombre, p.sku)
            }}
          />

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
                    <th className="p-3.5 text-right">Saldo</th>
                    <th className="p-3.5 text-right">Costo Unit.</th>
                    <th className="p-3.5">Usuario</th>
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
                          <button
                            onClick={() => openKardexProductoDetalle(m.product_id, m.product_nombre || m.product?.nombre || "Producto", m.product_sku || m.product?.sku)}
                            className="text-left hover:underline cursor-pointer"
                            title="Ver historial completo de este producto"
                          >
                            <p className="font-extrabold text-gray-900 dark:text-white">{m.product_nombre || m.product?.nombre || "Producto"}</p>
                            <span className="text-[10px] font-mono text-gray-400">SKU: {m.product_sku || m.product?.sku}</span>
                          </button>
                        </td>
                        <td className="p-3.5 text-gray-600 dark:text-gray-300">
                          {m.warehouse_nombre || "Depósito Central"}
                        </td>
                        <td className={`p-3.5 text-right font-mono font-black ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                          {isPositive ? `+${Math.abs(m.cantidad ?? 0)}` : `-${Math.abs(m.cantidad ?? 0)}`}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-gray-900 dark:text-white">
                          {(m as any).saldo_acumulado ?? "—"}
                        </td>
                        <td className="p-3.5 text-right font-mono text-gray-600 dark:text-gray-300">
                          {formatPYG(m.costo_unitario || 0)}
                        </td>
                        <td className="p-3.5 text-gray-500 text-[11px]">
                          {(m as any).user_nombre || "—"}
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
            {!loadingMovements && kardexHasMore && (
              <div className="p-4 text-center border-t border-gray-100 dark:border-slate-800">
                <button
                  onClick={loadMoreMovements}
                  disabled={loadingMoreMovements}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 disabled:opacity-50 cursor-pointer"
                >
                  {loadingMoreMovements ? "Cargando..." : `Cargar ${filteredMovements.length} más`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: HISTORIAL COMPLETO DE UN PRODUCTO (Regla 14) ── */}
      <KardexProductoDetalleModal
        producto={kardexProductoDetalle}
        movimientos={kardexDetalleMovs}
        loading={loadingKardexDetalle}
        onClose={() => {
          setKardexProductoDetalle(null)
          setKardexDetalleMovs([])
        }}
      />

      {/* ── CONTENIDO PESTAÑA 4: AJUSTES DE STOCK ──────────────────────────── */}
      {activeTab === "ajustes" && (
        <AjustesTab warehouses={warehouses} products={products} />
      )}

      {/* ── CONTENIDO PESTAÑA 5: TOMA FÍSICA DOBLE CIEGO ────────────────────── */}
      {activeTab === "toma_fisica" && (
        <TomaFisicaTab
          warehouses={warehouses}
          products={products}
          onGoToAdjustments={() => setActiveTab("ajustes")}
        />
      )}

      {/* ── CONTENIDO PESTAÑA 4: ADMINISTRACIÓN DE DEPÓSITOS Y SUBDEPÓSITOS ─────── */}
      {activeTab === "warehouses" && (() => {
        const principalWhs = warehouses.filter(w => !w.parent_id)
        const subWhs = warehouses.filter(w => !!w.parent_id)
        const camarasWhs = warehouses.filter(w => w.tipo === "camara")

        const filteredWhs = warehouses.filter(w => {
          if (whFilterTipo === "principales") return !w.parent_id
          if (whFilterTipo === "subdepositos") return !!w.parent_id
          if (whFilterTipo === "camaras") return w.tipo === "camara"
          return true
        })

        const getTipoLabel = (tipo?: string) => {
          switch (tipo) {
            case "camara": return { label: "Cámara Frigorífica", color: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800", icon: "❄️" }
            case "salon": return { label: "Salón de Ventas", color: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800", icon: "🛒" }
            case "produccion": return { label: "Área Producción", color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800", icon: "🥩" }
            case "merma": return { label: "Mermas / Averías", color: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800", icon: "⚠️" }
            case "subdeposito": return { label: "Subdepósito Sector", color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800", icon: "📦" }
            default: return { label: "Depósito Principal", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800", icon: "🏢" }
          }
        }

        return (
          <div className="space-y-6">
            {/* Toolbar y Filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setWhFilterTipo("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    whFilterTipo === "all"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                      : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}
                >
                  Todos ({warehouses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWhFilterTipo("principales")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    whFilterTipo === "principales"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}
                >
                  🏢 Principales ({principalWhs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWhFilterTipo("subdepositos")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    whFilterTipo === "subdepositos"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}
                >
                  ↳ Subdepósitos ({subWhs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWhFilterTipo("camaras")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    whFilterTipo === "camaras"
                      ? "bg-cyan-600 text-white shadow-xs"
                      : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}
                >
                  ❄️ Cámaras Frigoríficas ({camarasWhs.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenCreateWhModal(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 border border-gray-200 dark:border-slate-700 transition flex items-center gap-1.5"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  + Depósito Principal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstParent = principalWhs[0]?.id || null
                    handleOpenCreateWhModal(firstParent)
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition shadow-md shadow-purple-600/20 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Nuevo Subdepósito
                </button>
              </div>
            </div>

            {/* Vista Jerárquica de Depósitos */}
            {whFilterTipo === "all" ? (
              <div className="space-y-6">
                {principalWhs.map((pw) => {
                  const children = warehouses.filter(c => c.parent_id === pw.id)
                  const pBadge = getTipoLabel(pw.tipo)

                  return (
                    <div
                      key={pw.id}
                      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4"
                    >
                      {/* Cabecera Depósito Principal */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-800">
                        <div className="flex items-start sm:items-center gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black border border-blue-100 dark:border-blue-900/50 shrink-0">
                            <Building2 className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-base text-gray-900 dark:text-white">
                                {pw.nombre}
                              </h4>
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                                Cód: {pw.codigo}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${pBadge.color}`}>
                                {pBadge.icon} {pBadge.label}
                              </span>
                              {pw.activo ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase">
                                  Activo
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 uppercase">
                                  Inactivo
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mt-1 flex-wrap">
                              {pw.direccion && <span>📍 {pw.direccion}</span>}
                              {pw.responsable && <span>👤 Responsable: <b className="text-gray-700 dark:text-slate-300">{pw.responsable}</b></span>}
                              <span>↳ <b>{children.length}</b> subdepósito{children.length !== 1 ? "s" : ""} vinculado{children.length !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                        </div>

                        {/* Botones de Acción de Depósito Principal */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleOpenCreateWhModal(pw.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 transition flex items-center gap-1"
                            title="Agregar un subdepósito o cámara bajo este almacén"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Subdepósito</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditWhModal(pw)}
                            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                            title="Editar información del depósito"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWarehouse(pw)}
                            disabled={deletingWhId === pw.id}
                            className="p-2 rounded-xl text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Desactivar depósito"
                          >
                            {deletingWhId === pw.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Lista de Subdepósitos Hijos */}
                      {children.length > 0 ? (
                        <div className="pl-2 sm:pl-6 space-y-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 block">
                            Subdepósitos & Cámaras del Almacén:
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {children.map((sub) => {
                              const sBadge = getTipoLabel(sub.tipo)
                              return (
                                <div
                                  key={sub.id}
                                  className="p-3.5 rounded-2xl bg-gray-50/80 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/60 space-y-2 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all shadow-2xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <CornerDownRight className="w-4 h-4 text-purple-500 shrink-0" />
                                      <div>
                                        <h5 className="font-extrabold text-xs text-gray-900 dark:text-white">
                                          {sub.nombre}
                                        </h5>
                                        <span className="font-mono text-[10px] text-gray-400">
                                          Cód: {sub.codigo}
                                        </span>
                                      </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${sBadge.color}`}>
                                      {sBadge.icon} {sBadge.label}
                                    </span>
                                  </div>

                                  {(sub.direccion || sub.responsable) && (
                                    <div className="text-[11px] text-gray-500 dark:text-slate-400 space-y-0.5 pt-1 border-t border-gray-100 dark:border-slate-700/50">
                                      {sub.direccion && <p className="truncate">📍 {sub.direccion}</p>}
                                      {sub.responsable && <p className="truncate">👤 {sub.responsable}</p>}
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between pt-1 text-[11px]">
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                      ✓ Operativo
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditWhModal(sub)}
                                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                                        title="Editar subdepósito"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteWarehouse(sub)}
                                        disabled={deletingWhId === sub.id}
                                        className="p-1 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                        title="Desactivar subdepósito"
                                      >
                                        {deletingWhId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-gray-50/50 dark:bg-slate-800/30 border border-dashed border-gray-200 dark:border-slate-800 text-center space-y-2">
                          <p className="text-xs text-gray-400 dark:text-slate-500">
                            Este depósito principal aún no tiene subdepósitos ni cámaras sectorizadas creadas.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleOpenCreateWhModal(pw.id)}
                            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Crear el primer subdepósito (ej: Carnicería, Frutas, Salón)
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Vista en Grilla para Filtros Específicos */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWhs.map((w) => {
                  const badge = getTipoLabel(w.tipo)
                  return (
                    <div
                      key={w.id}
                      className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                          {w.parent_id ? <CornerDownRight className="w-5 h-5 text-purple-500" /> : <Warehouse className="w-5 h-5" />}
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${badge.color}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">{w.nombre}</h4>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">Código: {w.codigo}</p>
                        {w.parent_nombre && (
                          <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1">
                            Depósito Padre: {w.parent_nombre}
                          </p>
                        )}
                        {w.direccion && <p className="text-xs text-gray-500 mt-1">📍 {w.direccion}</p>}
                        {w.responsable && <p className="text-xs text-gray-500 mt-0.5">👤 {w.responsable}</p>}
                      </div>

                      <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-400">
                        <span className="font-bold text-emerald-600">✓ En Operación</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditWhModal(w)}
                            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWarehouse(w)}
                            disabled={deletingWhId === w.id}
                            className="p-1 rounded-lg text-rose-400 hover:text-rose-600 transition"
                          >
                            {deletingWhId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── MODAL NUEVO / EDITAR DEPÓSITO Y SUBDEPÓSITO (Regla 14) ──────────── */}
      <WarehouseModal
        isOpen={showWarehouseModal}
        onClose={() => {
          setShowWarehouseModal(false)
          setEditingWh(null)
        }}
        editingWh={editingWh}
        warehouses={warehouses}
        initialParentId={whForm.parent_id}
        onSave={handleSaveWarehouse}
        isSaving={savingWh}
      />

      {/* ── MODAL: ACCIÓN DE LOTE (MERMA / DEVOLUCIÓN A PROVEEDOR) ── */}
      {lotActionModal.open && lotActionModal.lot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Cabecera (shrink-0) */}
            <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
              lotActionModal.tipo === "devolucion"
                ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40"
                : "bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40"
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  lotActionModal.tipo === "devolucion"
                    ? "bg-blue-500 text-white"
                    : "bg-red-500 text-white"
                }`}>
                  {lotActionModal.tipo === "devolucion" ? <Truck className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight">
                    {lotActionModal.tipo === "devolucion" ? "Generar Devolución / Canje a Proveedor" : "Generar Baja por Merma"}
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Lote <span className="font-mono font-bold">{lotActionModal.lot.referencia}</span> · {lotActionModal.lot.product_nombre}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLotActionModal(prev => ({ ...prev, open: false }))}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo central (flex-1 overflow-y-auto) */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {/* Tarjeta Resumen Lote */}
              <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 border border-gray-100 dark:border-slate-800 text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Depósito</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {warehouses.find(w => w.id === lotActionModal.lot.warehouse_id)?.nombre || "Depósito Principal"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Caducidad</span>
                  <span className="font-semibold text-gray-900 dark:text-white font-mono">
                    {lotActionModal.lot.fecha_vencimiento ? new Date(lotActionModal.lot.fecha_vencimiento).toLocaleDateString("es-PY") : "Sin fecha"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Disponible en Lote</span>
                  <span className="font-bold text-gray-900 dark:text-white font-mono">
                    {lotActionModal.lot.cantidad_disponible.toLocaleString("es-PY")} unidades
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Costo Unitario</span>
                  <span className="font-semibold text-gray-900 dark:text-white font-mono">
                    {formatPYG(lotActionModal.lot.costo_unitario || 0)}
                  </span>
                </div>
              </div>

              {/* Selector de Tipo (Toggle) */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide block mb-1.5">
                  Tipo de Operación
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLotActionModal(prev => ({
                      ...prev,
                      tipo: "devolucion",
                      motivo: "Canje acordado por vencimiento con proveedor",
                    }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      lotActionModal.tipo === "devolucion"
                        ? "bg-blue-500 text-white border-blue-600 shadow-xs"
                        : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50"
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Devolución a Proveedor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLotActionModal(prev => ({
                      ...prev,
                      tipo: "merma",
                      motivo: "Caducidad / Fecha Vencida",
                    }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      lotActionModal.tipo === "merma"
                        ? "bg-red-500 text-white border-red-600 shadow-xs"
                        : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Baja por Merma</span>
                  </button>
                </div>
              </div>

              {/* Cantidad a Procesar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">
                    Cantidad a Procesar (Uds)
                  </label>
                  <button
                    type="button"
                    onClick={() => setLotActionModal(prev => ({ ...prev, cantidad: lotActionModal.lot.cantidad_disponible }))}
                    className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    Descargar todo ({lotActionModal.lot.cantidad_disponible} uds)
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLotActionModal(prev => ({ ...prev, cantidad: Math.max(1, prev.cantidad - 1) }))}
                    className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition flex items-center justify-center cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={lotActionModal.lot.cantidad_disponible}
                    value={lotActionModal.cantidad}
                    onChange={(e) => {
                      const val = Math.min(lotActionModal.lot.cantidad_disponible, Math.max(1, parseInt(e.target.value) || 1))
                      setLotActionModal(prev => ({ ...prev, cantidad: val }))
                    }}
                    className="flex-1 py-2 text-center text-sm font-mono font-bold rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setLotActionModal(prev => ({ ...prev, cantidad: Math.min(lotActionModal.lot.cantidad_disponible, prev.cantidad + 1) }))}
                    className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide block mb-1.5">
                  Motivo de la Operación
                </label>
                <select
                  value={lotActionModal.motivo}
                  onChange={(e) => setLotActionModal(prev => ({ ...prev, motivo: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {lotActionModal.tipo === "devolucion" ? (
                    <>
                      <option value="Canje acordado por vencimiento con proveedor">Canje acordado por vencimiento con proveedor</option>
                      <option value="Devolución por rotura o empaque defectuoso de fábrica">Devolución por rotura o empaque defectuoso de fábrica</option>
                      <option value="Producto próximo a vencer rechazado en salón">Producto próximo a vencer rechazado en salón</option>
                      <option value="Reclamo de calidad o corte de cadena de frío en origen">Reclamo de calidad o corte de cadena de frío en origen</option>
                    </>
                  ) : (
                    <>
                      <option value="Caducidad / Fecha Vencida">Caducidad / Fecha Vencida</option>
                      <option value="Deterioro / Avería en Góndola">Deterioro / Avería en Góndola</option>
                      <option value="Pérdida de Vacío / Rotura Accidental">Pérdida de Vacío / Rotura Accidental</option>
                      <option value="Corte de Cadena de Frío en Heladera">Corte de Cadena de Frío en Heladera</option>
                    </>
                  )}
                </select>
              </div>

              {/* Observaciones */}
              <div>
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide block mb-1.5">
                  Observaciones / Nro Comprobante o Acta
                </label>
                <textarea
                  rows={2}
                  value={lotActionModal.observaciones}
                  onChange={(e) => setLotActionModal(prev => ({ ...prev, observaciones: e.target.value }))}
                  placeholder="Detalles sobre el retiro, nombre del repositor o número de nota..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Impacto Valorizado */}
              <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 block">
                    Impacto Económico Total
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {lotActionModal.cantidad} uds × {formatPYG(lotActionModal.lot.costo_unitario || 0)}
                  </span>
                </div>
                <span className="text-base font-black font-mono text-purple-700 dark:text-purple-300">
                  {formatPYG(lotActionModal.cantidad * (lotActionModal.lot.costo_unitario || 0))}
                </span>
              </div>
            </div>

            {/* Pie de Acciones (shrink-0) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setLotActionModal(prev => ({ ...prev, open: false }))}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={lotActionModal.submitting}
                onClick={handleConfirmLotAction}
                className={`flex-1 py-2.5 rounded-xl text-white font-bold transition shadow-md flex items-center justify-center gap-1.5 text-xs cursor-pointer ${
                  lotActionModal.tipo === "devolucion"
                    ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30"
                    : "bg-red-600 hover:bg-red-700 shadow-red-600/30"
                }`}
              >
                {lotActionModal.submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{lotActionModal.tipo === "devolucion" ? "Confirmar Devolución" : "Confirmar Baja por Merma"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
