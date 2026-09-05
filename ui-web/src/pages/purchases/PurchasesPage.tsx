import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search, ShoppingCart, Package, DollarSign, TrendingDown, Users, CheckCircle2, Loader2,
  Plus, Eye, X, Trash2, Minus, FileText, Truck, Award, BarChart3, Download, Clock,
  AlertTriangle, Filter, ChevronDown, ChevronUp, Edit, Edit3, Send, Ban, RefreshCw,
  UserPlus, FileSpreadsheet, ClipboardList, TrendingUp, ArrowUp, ArrowDown, ArrowRight,
  MessageSquare, Calendar, Hash, Percent, Printer, Link2, Check, Save, ExternalLink,
  Sparkles, Sun, CloudRain, Snowflake, Flame, ShieldAlert, Scale, CheckCircle,
  HelpCircle, AlertCircle, Box, Layers, Building2, Phone, Mail, MapPin, SlidersHorizontal,
  ChevronRight, ArrowUpDown, ChevronLeft, CheckSquare, Square, PieChart, Undo2, Receipt, History, Star,
  Lock, Unlock, FileCheck
} from "lucide-react"
import * as XLSX from "xlsx"
import {
  api,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseReceipt,
  type PurchaseReceiptItem,
  type Supplier,
  type Product,
  type PurchaseRequisition,
  type PurchaseRfq,
  type PurchaseRfqWithDetail,
  type PurchaseBudget,
  type PurchaseBudgetConsumption,
  type SmartReplenishmentItem,
  type SmartReplenishmentResponse,
  type SupplierInvoice,
  type CustomerLostDemand,
  type PackBarcode,
} from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, formatCurrency } from "../../utils/format"

type MainTab = "asistente_ia" | "demandas_clientes" | "ordenes" | "recepciones" | "facturas_p2p" | "devoluciones" | "matching" | "proveedores" | "requisiciones" | "cotizaciones" | "presupuestos" | "reportes"

const poStatusMap: Record<string, { label: string; bg: string; text: string }> = {
  borrador: { label: "Borrador", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300" },
  confirmado: { label: "Confirmada", bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
  enviada: { label: "Enviada a Proveedor", bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
  enviado: { label: "Enviada a Proveedor", bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
  parcial: { label: "Entrega Parcial", bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" },
  completado: { label: "Completada", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400" },
  cancelado: { label: "Cancelada", bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400" },
}

export default function PurchasesPage() {
  const { user } = useAuth()
  const toast = useToast()

  // Navegación principal
  const [tab, setTab] = useState<MainTab>("asistente_ia")
  const [loading, setLoading] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)

  // Datos reales sincronizados de Nemuha / DB
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([])
  const [rfqs, setRfqs] = useState<PurchaseRfq[]>([])

  // Demandas de clientes registradas en cajas
  const [lostDemands, setLostDemands] = useState<CustomerLostDemand[]>([])
  const [filterLostDemandStatus, setFilterLostDemandStatus] = useState<string>("ALL")
  const [searchLostDemand, setSearchLostDemand] = useState<string>("")
  const [updatingLostDemandId, setUpdatingLostDemandId] = useState<string | null>(null)

  const fetchLostDemands = useCallback(async () => {
    try {
      const res = await api.purchases.lostDemand.list()
      if (Array.isArray(res)) setLostDemands(res)
    } catch {
      // fallback
    }
  }, [])

  const handleUpdateLostDemandStatus = async (id: string, newStatus: "PENDIENTE" | "EN_EVALUACION" | "COMPRADO" | "DESCARTADO", notas?: string) => {
    setUpdatingLostDemandId(id)
    try {
      await api.purchases.lostDemand.update(id, { estado: newStatus, notas })
      setLostDemands(prev => prev.map(d => d.id === id ? { ...d, estado: newStatus, notas: notas ?? d.notas } : d))
      toast.success("Estado Actualizado", `La solicitud de producto fue marcada como ${newStatus}.`)
    } catch (err: any) {
      toast.error("Error al actualizar", err.message)
    } finally {
      setUpdatingLostDemandId(null)
    }
  }

  const [budgets, setBudgets] = useState<PurchaseBudget[]>([])
  const [budgetConsumptions, setBudgetConsumptions] = useState<PurchaseBudgetConsumption[]>([])
  const [reportKPIs, setReportKPIs] = useState<any>(null)
  const [spendBySupplier, setSpendBySupplier] = useState<any[]>([])
  const [spendByCategory, setSpendByCategory] = useState<any[]>([])
  const [priceVariance, setPriceVariance] = useState<any[]>([])

  // Devoluciones y Notas de Crédito de Proveedor (Nemuha Legacy)
  const [supplierReturns, setSupplierReturns] = useState<any[]>([])
  const [supplierCreditNotes, setSupplierCreditNotes] = useState<any[]>([])
  const [searchReturns, setSearchReturns] = useState("")
  const [pageReturns, setPageReturns] = useState(1)
  const pageSizeReturns = 15

  // Facturas de Proveedores (Procure-to-Pay)
  const [allSupplierInvoices, setAllSupplierInvoices] = useState<SupplierInvoice[]>([])
  const [searchInvoices, setSearchInvoices] = useState("")
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState("todos")
  const [pageInvoices, setPageInvoices] = useState(1)
  const pageSizeInvoices = 15

  // Ficha 360° del Proveedor (Scorecard OTIF & Historial de Precios)
  const [showSupplier360Modal, setShowSupplier360Modal] = useState(false)
  const [selectedSupplierFor360, setSelectedSupplierFor360] = useState<Supplier | null>(null)
  const [supplier360Performance, setSupplier360Performance] = useState<any>(null)
  const [supplier360PriceHistory, setSupplier360PriceHistory] = useState<any[]>([])
  const [loadingSupplier360, setLoadingSupplier360] = useState(false)

  // Paginación y Filtros de Órdenes
  const [searchPO, setSearchPO] = useState("")
  const [filterPOStatus, setFilterPOStatus] = useState("todos")
  const [filterPOSupplier, setFilterPOSupplier] = useState("")
  const [pagePO, setPagePO] = useState(1)
  const pageSizePO = 15

  // Detalle de Orden
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [poDetailItems, setPoDetailItems] = useState<PurchaseOrderItem[]>([])
  const [loadingPODetail, setLoadingPODetail] = useState(false)

  // Estados para Creación y Edición de Orden de Compra
  const [showManualPOModal, setShowManualPOModal] = useState(false)
  const [editingPOId, setEditingPOId] = useState<string | null>(null)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [manualPOSupplierId, setManualPOSupplierId] = useState("")
  const [manualPOFechaEntrega, setManualPOFechaEntrega] = useState("")
  const [manualPOPrioridad, setManualPOPrioridad] = useState("normal")
  const [manualPOCondiciones, setManualPOCondiciones] = useState("30 Días")
  const [manualPOObservaciones, setManualPOObservaciones] = useState("")
  const [manualPOItems, setManualPOItems] = useState<any[]>([])
  const [searchProductPO, setSearchProductPO] = useState("")
  const [productSearchResultsPO, setProductSearchResultsPO] = useState<Product[]>([])
  const [searchingProductsPO, setSearchingProductsPO] = useState(false)
  const [savingManualPO, setSavingManualPO] = useState(false)

  // Estados para Inbox IMAP cPanel y Facturas SIFEN
  const [showInboxConfigModal, setShowInboxConfigModal] = useState(false)
  const [inboxConfig, setInboxConfig] = useState<any>(null)
  const [inboxConfigForm, setInboxConfigForm] = useState({
    imap_host: "mail.superextra.com.py",
    imap_port: 993,
    imap_user: "facturaelectronica@superextra.com.py",
    imap_password: "",
    imap_ssl: true,
    imap_folder: "INBOX",
    activo: true,
  })
  const [savingInboxConfig, setSavingInboxConfig] = useState(false)
  const [syncingInbox, setSyncingInbox] = useState(false)
  const [uploadingXml, setUploadingXml] = useState(false)
  const [dragOverXml, setDragOverXml] = useState(false)

  // Estados para 3-Way Match y Solicitudes de NC ("Sin NC no hay pago")
  const [supplierNcRequests, setSupplierNcRequests] = useState<any[]>([])
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchResult, setMatchResult] = useState<any>(null)
  const [performingMatch, setPerformingMatch] = useState(false)
  const [showResolveNcModal, setShowResolveNcModal] = useState(false)
  const [selectedNcRequestForResolve, setSelectedNcRequestForResolve] = useState<any>(null)
  const [resolveNcForm, setResolveNcForm] = useState({
    nc_recibida_numero: "",
    nc_recibida_timbrado: "",
    nc_recibida_monto: 0,
    nc_recibida_fecha: new Date().toISOString().split("T")[0],
    nc_recibida_cdc: "",
    observaciones: "",
  })
  const [resolvingNc, setResolvingNc] = useState(false)

  // Adición extraordinaria en recepción
  const [extraordinarySearch, setExtraordinarySearch] = useState("")
  const [extraordinaryResults, setExtraordinaryResults] = useState<Product[]>([])
  const [searchingExtraordinary, setSearchingExtraordinary] = useState(false)

  // Paginación y Filtros de Proveedores
  const [searchSupplier, setSearchSupplier] = useState("")
  const [pageSupplier, setPageSupplier] = useState(1)
  const pageSizeSupplier = 12

  // ---------------------------------------------------------------------------
  // MOTOR ASISTENTE IA DE ABASTECIMIENTO POR DÍAS DE STOCK
  // ---------------------------------------------------------------------------
  const [diasCobertura, setDiasCobertura] = useState(30)
  const [leadTimeDias, setLeadTimeDias] = useState(3)
  const [diasHistorialVentas, setDiasHistorialVentas] = useState(30)
  const [selectedSupplierIA, setSelectedSupplierIA] = useState("")
  const [filterSupplierSearchIA, setFilterSupplierSearchIA] = useState("")
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false)
  const supplierComboboxRef = useRef<HTMLDivElement>(null)
  const [searchProductIA, setSearchProductIA] = useState("")
  const [soloQuiebreIA, setSoloQuiebreIA] = useState(false)
  const [filterEstadoIA, setFilterEstadoIA] = useState<"todos" | "quiebres" | "bajos" | "sugeridos">("todos")

  // Ordenamiento interactivo de la Matriz de Sugerencia IA
  type IASortColumn =
    | "producto"
    | "proveedor"
    | "stock"
    | "m4"
    | "m3"
    | "m2"
    | "m1"
    | "pulso"
    | "costo_ppp"
    | "ultimo_costo"
    | "autonomia"
    | "sugerencia"
    | "pedido"
    | "costo_unit"
    | "subtotal"

  const [sortColumnIA, setSortColumnIA] = useState<IASortColumn | null>(null)
  const [sortDirectionIA, setSortDirectionIA] = useState<"asc" | "desc">("asc")

  const handleSortIA = (col: IASortColumn) => {
    if (sortColumnIA === col) {
      if (sortDirectionIA === "asc") {
        setSortDirectionIA("desc")
      } else {
        setSortColumnIA(null)
        setSortDirectionIA("asc")
      }
    } else {
      setSortColumnIA(col)
      const defaultDesc = ["stock", "m4", "m3", "m2", "m1", "sugerencia", "pedido", "costo_ppp", "ultimo_costo", "costo_unit", "subtotal"].includes(col)
      setSortDirectionIA(defaultDesc ? "desc" : "asc")
    }
  }
  
  // Factores Estacionales y Contextuales de Supermercado
  const [factorFinSemana, setFactorFinSemana] = useState(false)
  const [factorFinMes, setFactorFinMes] = useState(false)
  const [factorClima, setFactorClima] = useState<"normal" | "calor" | "frio" | "lluvia">("normal")
  const [factorEvento, setFactorEvento] = useState<"normal" | "feriado" | "semana_santa" | "fin_de_ano">("normal")

  // Estado del resultado de la IA
  const [replenishmentData, setReplenishmentData] = useState<SmartReplenishmentResponse | null>(null)
  const [loadingReplenishment, setLoadingReplenishment] = useState(false)
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({})
  const [editedCosts, setEditedCosts] = useState<Record<string, number>>({})
  const [selectedItemsIA, setSelectedItemsIA] = useState<Record<string, boolean>>({})

  // Modal de Confirmación y Generación de OC desde IA
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generatePOForm, setGeneratePOForm] = useState({
    supplier_id: "",
    fecha_entrega_estimada: "",
    prioridad: "normal",
    condiciones_pago: "30 Días",
    observaciones: "",
  })
  const [generatingPO, setGeneratingPO] = useState(false)
  // Multi-Proveedor: división y asignación interactiva
  const [itemAssignedSupplier, setItemAssignedSupplier] = useState<Record<string, string>>({})
  const [includedSuppliers, setIncludedSuppliers] = useState<Record<string, boolean>>({})
  const [supplierOrderSettings, setSupplierOrderSettings] = useState<Record<string, {
    fecha_entrega_estimada: string
    condiciones_pago: string
    prioridad: string
    observaciones: string
  }>>({})
  const [globalApplySupplierId, setGlobalApplySupplierId] = useState<string>("")

  // Modal de Recepción en Muelle
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptForm, setReceiptForm] = useState<{
    purchase_order_id: string
    proveedor_ref: string
    observaciones: string
    items: {
      product_id: string
      nombre: string
      sku: string
      cantidad_ordenada: number
      cantidad_recibir: number
      presentacion_id: string
      cantidad_presentacion: number
      precio_unitario: number
      lote: string
      fecha_vencimiento: string
      cantidad_rechazada: number
      motivo_rechazo: string
      es_extraordinario?: boolean
      autorizado_por?: string
      autorizacion_motivo?: string
    }[]
  }>({
    purchase_order_id: "",
    proveedor_ref: "",
    observaciones: "",
    items: [],
  })
  const [savingReceipt, setSavingReceipt] = useState(false)
  const [packBarcodesByProduct, setPackBarcodesByProduct] = useState<Map<string, PackBarcode[]>>(new Map())
  const [lastReceiptForLabels, setLastReceiptForLabels] = useState<{ id: string; numero: string } | null>(null)
  const navigate = useNavigate()

  // Modal de Nueva Requisición Interna
  const [showReqModal, setShowReqModal] = useState(false)
  const [reqForm, setReqForm] = useState({
    departamento: "Salón / Góndola",
    prioridad: "normal",
    motivo: "Reposición regular de stock",
    observaciones: "",
    items: [{ product_id: "", cantidad: 10, precio_estimado: 0, descripcion: "" }],
  })
  const [savingReq, setSavingReq] = useState(false)

  // Estado para Eliminación de Órdenes de Compra
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null)
  const [forceDeletePO, setForceDeletePO] = useState(false)
  const [deletingPO, setDeletingPO] = useState(false)

  // ---------------------------------------------------------------------------
  // CARGA DE DATOS GENERALES (100% REALES DE NEMUHA)
  // ---------------------------------------------------------------------------
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [
        ordersRes,
        lostDemandRes,
        receiptsRes,
        suppliersRes,
        kpisRes,
        invoicesRes,
        reqsRes,
        rfqsRes,
        budgetsRes,
        consumptionRes,
        spendSuppRes,
        spendCatRes,
        varianceRes,
        returnsRes,
        creditNotesRes,
        ncRequestsRes,
        inboxConfigRes,
      ] = await Promise.allSettled([
        api.purchases.listPOs(),
        api.purchases.lostDemand.list(),
        api.purchases.listReceipts(),
        api.purchases.listSuppliers(),
        api.purchases.reports.kpis(),
        api.financial.invoices.list({ limit: 300 }),
        api.purchases.requisitions.list(),
        api.purchases.rfqs.list(),
        api.purchases.budgets.list(),
        api.purchases.budgets.consumption(),
        api.purchases.reports.spendBySupplier(),
        api.purchases.reports.spendByCategory(),
        api.purchases.reports.priceVariance(),
        api.financial.supplierReturns(),
        api.financial.creditNotes(),
        api.purchases.listSupplierNcRequests(),
        api.purchases.getInboxConfig(),
      ])

      if (ordersRes.status === "fulfilled") setOrders(ordersRes.value || [])
      if (lostDemandRes.status === "fulfilled") setLostDemands(lostDemandRes.value || [])
      if (receiptsRes.status === "fulfilled") setReceipts(receiptsRes.value || [])
      if (suppliersRes.status === "fulfilled") setSuppliers(suppliersRes.value || [])
      if (kpisRes.status === "fulfilled") setReportKPIs(kpisRes.value || null)
      if (invoicesRes.status === "fulfilled") {
        setInvoices(invoicesRes.value || [])
        setAllSupplierInvoices(invoicesRes.value || [])
      }
      if (reqsRes.status === "fulfilled") setRequisitions(reqsRes.value || [])
      if (rfqsRes.status === "fulfilled") setRfqs(rfqsRes.value || [])
      if (budgetsRes.status === "fulfilled") setBudgets(budgetsRes.value || [])
      if (consumptionRes.status === "fulfilled") setBudgetConsumptions(consumptionRes.value || [])
      if (spendSuppRes.status === "fulfilled") setSpendBySupplier(spendSuppRes.value || [])
      if (spendCatRes.status === "fulfilled") setSpendByCategory(spendCatRes.value || [])
      if (varianceRes.status === "fulfilled") setPriceVariance(varianceRes.value || [])
      if (returnsRes.status === "fulfilled") setSupplierReturns(returnsRes.value || [])
      if (creditNotesRes.status === "fulfilled") setSupplierCreditNotes(creditNotesRes.value || [])
      if (ncRequestsRes.status === "fulfilled") setSupplierNcRequests(ncRequestsRes.value || [])
      if (inboxConfigRes.status === "fulfilled" && inboxConfigRes.value) {
        setInboxConfig(inboxConfigRes.value)
        setInboxConfigForm({
          imap_host: inboxConfigRes.value.imap_host || "mail.superextra.com.py",
          imap_port: inboxConfigRes.value.imap_port || 993,
          imap_user: inboxConfigRes.value.imap_user || "facturaelectronica@superextra.com.py",
          imap_password: "",
          imap_ssl: inboxConfigRes.value.imap_ssl ?? true,
          imap_folder: inboxConfigRes.value.imap_folder || "INBOX",
          activo: inboxConfigRes.value.activo ?? true,
        })
      }
    } catch (e: any) {
      toast.error("Error al sincronizar datos de compras", e.message)
    } finally {
      setLoading(false)
      setInitialLoaded(true)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (supplierComboboxRef.current && !supplierComboboxRef.current.contains(event.target as Node)) {
        setSupplierComboboxOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Abrir Ficha 360° del Proveedor
  const openSupplier360 = async (supplier: Supplier) => {
    setSelectedSupplierFor360(supplier)
    setShowSupplier360Modal(true)
    setLoadingSupplier360(true)
    try {
      const [perfRes, priceRes] = await Promise.allSettled([
        api.purchases.getSupplierPerformance(supplier.id),
        api.purchases.getSupplierPriceHistory(supplier.id),
      ])
      if (perfRes.status === "fulfilled") setSupplier360Performance(perfRes.value)
      else setSupplier360Performance(null)

      if (priceRes.status === "fulfilled") setSupplier360PriceHistory(priceRes.value || [])
      else setSupplier360PriceHistory([])
    } catch {
      toast.error("Error al cargar ficha del proveedor")
    } finally {
      setLoadingSupplier360(false)
    }
  }

  // ---------------------------------------------------------------------------
  // EJECUCIÓN DEL MOTOR PREDICTIVO IA
  // ---------------------------------------------------------------------------
  const runReplenishmentPreview = useCallback(async () => {
    setLoadingReplenishment(true)
    try {
      const res = await api.purchases.smartReplenishmentPreview({
        supplier_id: selectedSupplierIA || undefined,
        dias_cobertura: Number(diasCobertura),
        lead_time_dias: Number(leadTimeDias),
        dias_historial_ventas: Number(diasHistorialVentas),
        factor_fin_semana: factorFinSemana,
        factor_fin_mes: factorFinMes,
        factor_clima: factorClima,
        factor_evento: factorEvento,
        solo_quiebre_o_bajo: soloQuiebreIA,
        search: searchProductIA || undefined,
        limit: 150,
      })
      setReplenishmentData(res)

      const initialQty: Record<string, number> = {}
      const initialSel: Record<string, boolean> = {}
      res.items.forEach((it: any) => {
        const numQty = Math.max(0, Math.round(Number(it.cantidad_sugerida) || 0))
        initialQty[it.product_id] = numQty
        initialSel[it.product_id] = numQty > 0
      })
      setEditedQuantities(initialQty)
      setSelectedItemsIA(initialSel)
    } catch (e: any) {
      toast.error("Error en motor de sugerencia", e.message)
    } finally {
      setLoadingReplenishment(false)
    }
  }, [
    selectedSupplierIA,
    diasCobertura,
    leadTimeDias,
    diasHistorialVentas,
    factorFinSemana,
    factorFinMes,
    factorClima,
    factorEvento,
    soloQuiebreIA,
    searchProductIA,
  ])

  useEffect(() => {
    if (tab === "asistente_ia") {
      runReplenishmentPreview()
    }
  }, [
    tab,
    selectedSupplierIA,
    diasCobertura,
    leadTimeDias,
    diasHistorialVentas,
    factorFinSemana,
    factorFinMes,
    factorClima,
    factorEvento,
    soloQuiebreIA,
  ])

  // ---------------------------------------------------------------------------
  // ACCIONES OPERATIVAS
  // ---------------------------------------------------------------------------
  const handleViewPO = async (po: PurchaseOrder) => {
    setSelectedPO(po)
    setLoadingPODetail(true)
    try {
      if (po.id) {
        const items = await api.purchases.getOrderItems(po.id)
        setPoDetailItems(items || [])
      }
    } catch (e: any) {
      toast.error("Error al cargar detalle", e.message)
    } finally {
      setLoadingPODetail(false)
    }
  }

  // Exportar listado de órdenes de compra a Excel (.xlsx)
  const handleExportOrdersToExcel = () => {
    try {
      if (filteredOrders.length === 0) {
        toast.info("Sin datos", "No hay órdenes de compra para exportar.")
        return
      }
      const dataToExport = filteredOrders.map(o => ({
        "N° Orden": o.numero || "S/N",
        "Proveedor": o.supplier?.razon_social || "Sin Asignar",
        "RUC Proveedor": o.supplier?.ruc || "—",
        "Fecha Emisión": o.fecha ? formatDate(o.fecha) : formatDate(o.created_at || ""),
        "Fecha Entrega": o.fecha_entrega_estimada ? formatDate(o.fecha_entrega_estimada) : "—",
        "Estado": poStatusMap[o.estado || ""]?.label || o.estado || "Borrador",
        "Condición": o.condiciones_pago || "30 Días",
        "Moneda": o.moneda || "PYG",
        "Subtotal (Gs.)": Number(o.subtotal || 0),
        "Total IVA (Gs.)": Number(o.iva_10 || 0) + Number(o.iva_5 || 0),
        "Total General (Gs.)": Number(o.total || 0),
        "Observaciones": o.observaciones || "",
      }))
      const ws = XLSX.utils.json_to_sheet(dataToExport)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "OrdenesDeCompra")
      XLSX.writeFile(wb, `Listado_Ordenes_Compra_${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Excel Exportado", `Se descargaron ${filteredOrders.length} órdenes de compra en formato .xlsx.`)
    } catch (e: any) {
      toast.error("Error al exportar a Excel", e.message)
    }
  }

  // Exportar detalle de una orden de compra individual a Excel (.xlsx)
  const handleExportSinglePOToExcel = (po: PurchaseOrder, items: any[]) => {
    try {
      const headerRows: any[][] = [
        ["EXTRA SUPERMERCADO MAYORISTA - GRUPO SANTA TERESA E.A.S."],
        ["RUC: 80150377-9 | Timbrado: 18545636 | Casa Matriz: Av. Santa Teresa - Fernando de la Mora"],
        ["ORDEN DE COMPRA OFICIAL DE ADQUISICIÓN DE MERCADERÍAS"],
        [],
        ["N° Orden:", po.numero || "S/N", "", "Fecha Emisión:", po.fecha ? formatDate(po.fecha) : formatDate(po.created_at || "")],
        ["Proveedor:", po.supplier?.razon_social || "—", "", "Fecha Entrega:", po.fecha_entrega_estimada ? formatDate(po.fecha_entrega_estimada) : "Inmediata / A convenir"],
        ["RUC Proveedor:", po.supplier?.ruc || "—", "", "Condición Pago:", po.condiciones_pago || "30 Días"],
        ["Estado:", poStatusMap[po.estado || ""]?.label || po.estado || "Borrador", "", "Comprador:", po.created_by_name || "Departamento de Compras"],
        [],
        ["#", "Cód. Interno", "Cód. Barra", "Descripción del Producto", "Cantidad", "Precio Unitario (IVA Inc.)", "IVA %", "Subtotal (IVA Inc.)"]
      ]

      items.forEach((it, idx) => {
        const cant = Number(it.cantidad || 0)
        const precio = Number(it.precio_unitario || 0)
        const sub = Number(it.total || it.subtotal || (cant * precio))
        const desc = it.descripcion || it.producto?.nombre || "Ítem"
        const sku = it.sku || it.producto?.sku || "—"
        const barcode = it.codigo_barra || it.producto?.codigo_barra || "—"
        headerRows.push([
          idx + 1,
          sku,
          barcode,
          desc,
          cant,
          precio,
          Number(it.iva_tasa || 10),
          sub
        ])
      })

      headerRows.push([])
      headerRows.push(["", "", "", "", "", "", "TOTAL ORDEN (Gs. IVA INCLUIDO):", Number(po.total || 0)])

      const ws = XLSX.utils.aoa_to_sheet(headerRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `OC_${po.numero || "Detalle"}`)
      XLSX.writeFile(wb, `OC_${po.numero || po.id?.slice(0, 8)}.xlsx`)
      toast.success("Excel Descargado", `Se generó la planilla de la OC N° ${po.numero || "S/N"}.`)
    } catch (e: any) {
      toast.error("Error al exportar Excel", e.message)
    }
  }

  // Descargar PDF de Orden de Compra desde endpoint oficial
  const handleDownloadPOAsPdf = async (po: PurchaseOrder) => {
    if (!po.id) return
    try {
      await api.purchases.downloadOrderPdf(po.id, po.numero)
      toast.success("PDF Descargado", `Se descargó la OC N° ${po.numero || "S/N"} en formato PDF oficial.`)
    } catch (e: any) {
      toast.error("Error al descargar PDF", e.message)
    }
  }

  // Imprimir Orden de Compra membretada (A4)
  const handlePrintPO = () => {
    window.print()
  }

  const handleConfirmPO = async (id: string) => {
    try {
      await api.purchases.confirmPO(id)
      toast.success("Orden Confirmada", "La OC pasó a estado confirmada.")
      fetchAll()
      if (selectedPO?.id === id) {
        setSelectedPO((prev: any) => prev ? { ...prev, estado: "confirmado" } : null)
      }
    } catch (e: any) {
      toast.error("Error al confirmar", e.message)
    }
  }

  const handleSendPO = async (id: string) => {
    try {
      await api.purchases.sendPO(id)
      toast.success("Orden Enviada", "Se notificó la orden al proveedor.")
      fetchAll()
      if (selectedPO?.id === id) {
        setSelectedPO((prev: any) => prev ? { ...prev, estado: "enviada" } : null)
      }
    } catch (e: any) {
      toast.error("Error al enviar", e.message)
    }
  }

  const handleCancelPO = async (id: string) => {
    const motivo = window.prompt("Motivo de cancelación de la orden:")
    if (!motivo) return
    try {
      await api.purchases.cancelPO(id)
      toast.success("Orden Cancelada", "Se revirtieron los compromisos de compra.")
      fetchAll()
      if (selectedPO?.id === id) {
        setSelectedPO((prev: any) => prev ? { ...prev, estado: "cancelado" } : null)
      }
    } catch (e: any) {
      toast.error("Error al cancelar", e.message)
    }
  }

  const handleDeletePO = async () => {
    if (!poToDelete?.id) return
    setDeletingPO(true)
    try {
      const res = await api.purchases.deletePO(poToDelete.id, forceDeletePO)
      toast.success("Orden Eliminada", res.message || `Orden ${poToDelete.numero} eliminada exitosamente.`)
      setOrders(prev => prev.filter(o => o.id !== poToDelete.id))
      if (selectedPO?.id === poToDelete.id) {
        setSelectedPO(null)
      }
      setPoToDelete(null)
      setForceDeletePO(false)
    } catch (err: any) {
      toast.error("Error al eliminar orden", err.message || "No se pudo eliminar la orden de compra.")
    } finally {
      setDeletingPO(false)
    }
  }

  const handleOpenGenerateModal = () => {
    const itemsToOrder = (replenishmentData?.items || []).filter(
      (it: any) => selectedItemsIA[it.product_id] && (editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida) > 0
    )
    if (itemsToOrder.length === 0) {
      toast.error("Sin ítems seleccionados", "Marcá al menos un producto con cantidad mayor a cero.")
      return
    }
    const defaultDelivery = new Date()
    defaultDelivery.setDate(defaultDelivery.getDate() + (leadTimeDias || 3))
    const defaultDeliveryStr = defaultDelivery.toISOString().split("T")[0]

    const initialMap: Record<string, string> = {}
    const initialIncluded: Record<string, boolean> = {}
    const initialSettings: Record<string, any> = {}

    itemsToOrder.forEach((it: any) => {
      // Si se filtró por un proveedor específico, usar ese; de lo contrario su último proveedor, o el primero
      const assigned = selectedSupplierIA || it.ultimo_proveedor_id || suppliers[0]?.id || ""
      initialMap[it.product_id] = assigned
      if (assigned) {
        initialIncluded[assigned] = true
        if (!initialSettings[assigned]) {
          initialSettings[assigned] = {
            fecha_entrega_estimada: defaultDeliveryStr,
            condiciones_pago: "30 Días",
            prioridad: soloQuiebreIA ? "urgente" : "normal",
            observaciones: `Orden generada mediante Asistente IA (${diasCobertura}d cobertura). Factores: FinSem=${factorFinSemana ? 'SI' : 'NO'}, FinMes=${factorFinMes ? 'SI' : 'NO'}.`,
          }
        }
      }
    })

    setItemAssignedSupplier(initialMap)
    setIncludedSuppliers(initialIncluded)
    setSupplierOrderSettings(initialSettings)
    setGlobalApplySupplierId(suppliers[0]?.id || "")
    setShowGenerateModal(true)
  }

  const handleResetToLastSuppliers = () => {
    const itemsToOrder = (replenishmentData?.items || []).filter(
      (it: any) => selectedItemsIA[it.product_id] && (editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida) > 0
    )
    const newMap: Record<string, string> = {}
    const newIncluded: Record<string, boolean> = { ...includedSuppliers }
    itemsToOrder.forEach((it: any) => {
      const sup = it.ultimo_proveedor_id || suppliers[0]?.id || ""
      newMap[it.product_id] = sup
      if (sup) newIncluded[sup] = true
    })
    setItemAssignedSupplier(newMap)
    setIncludedSuppliers(newIncluded)
    toast.info("Proveedores restablecidos", "Cada producto fue asignado a su último proveedor habitual.")
  }

  const handleApplyGlobalSupplier = () => {
    if (!globalApplySupplierId) return
    const itemsToOrder = (replenishmentData?.items || []).filter(
      (it: any) => selectedItemsIA[it.product_id] && (editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida) > 0
    )
    const newMap: Record<string, string> = {}
    itemsToOrder.forEach((it: any) => {
      newMap[it.product_id] = globalApplySupplierId
    })
    setItemAssignedSupplier(newMap)
    setIncludedSuppliers(prev => ({ ...prev, [globalApplySupplierId]: true }))
    toast.info("Proveedor unificado", "Todos los productos seleccionados fueron asignados al proveedor elegido.")
  }

  const handleCreatePOFromReplenishment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const itemsToOrder = (replenishmentData?.items || []).filter(
      (it: any) => selectedItemsIA[it.product_id] && (editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida) > 0
    )

    const groupsBySup: Record<string, any[]> = {}
    for (const it of itemsToOrder) {
      const supId = itemAssignedSupplier[it.product_id]
      if (!supId || supId === "unassigned") {
        toast.error("Producto sin proveedor", `El producto "${it.nombre}" no tiene proveedor asignado. Seleccioná un proveedor antes de emitir.`)
        return
      }
      if (!groupsBySup[supId]) {
        groupsBySup[supId] = []
      }
      groupsBySup[supId].push({
        product_id: it.product_id,
        descripcion: it.nombre,
        cantidad: Number(editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida),
        precio_unitario: Number(editedCosts[it.product_id] !== undefined ? editedCosts[it.product_id] : (it.costo_unitario_estimado || 0)),
        iva_tasa: Number(it.iva_tasa || 10),
      })
    }

    const activeSupplierIds = Object.keys(groupsBySup).filter(supId => includedSuppliers[supId] !== false)
    if (activeSupplierIds.length === 0) {
      toast.error("Sin órdenes marcadas", "Marcá la casilla de al menos un proveedor para emitir su orden de compra.")
      return
    }

    const defaultDelivery = new Date()
    defaultDelivery.setDate(defaultDelivery.getDate() + (leadTimeDias || 3))
    const defaultDeliveryStr = defaultDelivery.toISOString().split("T")[0]

    const ordersPayload = activeSupplierIds.map(supId => {
      const settings = supplierOrderSettings[supId] || {
        fecha_entrega_estimada: defaultDeliveryStr,
        condiciones_pago: "30 Días",
        prioridad: soloQuiebreIA ? "urgente" : "normal",
        observaciones: `Orden generada mediante Asistente IA de Abastecimiento.`,
      }
      return {
        supplier_id: supId,
        fecha_entrega_estimada: settings.fecha_entrega_estimada || undefined,
        condiciones_pago: settings.condiciones_pago || "30 Días",
        prioridad: settings.prioridad || "normal",
        observaciones: settings.observaciones || "Generado mediante Emisión Múltiple por Proveedor (Asistente IA)",
        items: groupsBySup[supId],
      }
    })

    setGeneratingPO(true)
    try {
      const res = await api.purchases.generateMultiPOFromReplenishment({
        user_id: user?.id,
        user_name: user?.nombre || "Comprador",
        orders: ordersPayload,
      })

      const totalCreated = res.total_created || res.orders?.length || 0
      const orderNumbers = (res.orders || []).map((o: any) => o.numero).join(", ")
      toast.success(
        `¡${totalCreated} ${totalCreated > 1 ? 'Órdenes de Compra Emitidas' : 'Orden de Compra Emitida'}!`,
        `Se crearon exitosamente: ${orderNumbers}`
      )
      setShowGenerateModal(false)
      await fetchAll()
      setTab("ordenes")
      if (res.orders && res.orders.length === 1) {
        handleViewPO(res.orders[0])
      }
    } catch (e: any) {
      toast.error("Error al emitir órdenes de compra", e.message)
    } finally {
      setGeneratingPO(false)
    }
  }

  const handleOpenReceiptModal = async (po?: PurchaseOrder) => {
    let targetPO = po
    if (!targetPO && orders.length > 0) {
      targetPO = orders.find(o => ["confirmado", "enviada", "enviado", "parcial"].includes(o.estado || "")) || orders[0]
    }
    if (!targetPO || !targetPO.id) {
      toast.error("No hay órdenes de compra disponibles para recibir.")
      return
    }

    try {
      const [items, packBarcodes] = await Promise.all([
        api.purchases.getOrderItems(targetPO.id),
        api.products.packBarcodes.list().catch(() => [] as PackBarcode[]),
      ])

      const byProduct = new Map<string, PackBarcode[]>()
      for (const pb of packBarcodes || []) {
        if (!pb.activo) continue
        const list = byProduct.get(pb.product_id) || []
        list.push(pb)
        byProduct.set(pb.product_id, list)
      }
      setPackBarcodesByProduct(byProduct)

      setReceiptForm({
        purchase_order_id: targetPO.id,
        proveedor_ref: "",
        observaciones: "",
        items: (items || []).map(it => {
          const cantidadRecibir = Math.max(0, Number(it.cantidad || 0) - Number(it.recibido || (it as any).cantidad_recibida || 0))
          return {
            product_id: (it as any).product_id || (it as any).producto_id || (it as any).id || "",
            nombre: (it as any).producto?.nombre || (it as any).descripcion || "Producto",
            sku: (it as any).producto?.sku || "",
            cantidad_ordenada: Number(it.cantidad || 0),
            cantidad_recibir: cantidadRecibir,
            presentacion_id: "",
            cantidad_presentacion: cantidadRecibir,
            precio_unitario: Number(it.precio_unitario || 0),
            lote: "",
            fecha_vencimiento: "",
            cantidad_rechazada: 0,
            motivo_rechazo: "",
          }
        })
      })
      setShowReceiptModal(true)
    } catch (e: any) {
      toast.error("Error al cargar orden para recepción", e.message)
    }
  }

  const handleReceiptPresentationChange = (idx: number, presentacionId: string) => {
    setReceiptForm(prev => {
      const copy = [...prev.items]
      const item = copy[idx]
      const packs = packBarcodesByProduct.get(item.product_id) || []
      const pack = packs.find(p => p.id === presentacionId)
      const multiplier = pack ? Number(pack.unidades_por_paquete) : 1
      copy[idx] = {
        ...item,
        presentacion_id: presentacionId,
        cantidad_recibir: Math.max(0, item.cantidad_presentacion) * multiplier,
      }
      return { ...prev, items: copy }
    })
  }

  const handleReceiptCantidadPresentacionChange = (idx: number, cantidad: number) => {
    setReceiptForm(prev => {
      const copy = [...prev.items]
      const item = copy[idx]
      const packs = packBarcodesByProduct.get(item.product_id) || []
      const pack = packs.find(p => p.id === item.presentacion_id)
      const multiplier = pack ? Number(pack.unidades_por_paquete) : 1
      const cantidadPresentacion = Math.max(0, cantidad)
      copy[idx] = {
        ...item,
        cantidad_presentacion: cantidadPresentacion,
        cantidad_recibir: cantidadPresentacion * multiplier,
      }
      return { ...prev, items: copy }
    })
  }

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!receiptForm.purchase_order_id) return
    const validItems = receiptForm.items.filter(it => it.cantidad_recibir > 0 || it.cantidad_rechazada > 0)
    if (validItems.length === 0) {
      toast.error("Debe ingresar al menos una cantidad recibida o rechazada.")
      return
    }

    // Auditoría de ítems extraordinarios: motivo obligatorio
    const extraordinaryWithoutReason = validItems.find(it => it.es_extraordinario && !it.autorizacion_motivo?.trim())
    if (extraordinaryWithoutReason) {
      toast.error("Motivo obligatorio", `El producto ${extraordinaryWithoutReason.nombre} ingresa fuera de OC. Indique el motivo de autorización.`)
      return
    }

    setSavingReceipt(true)
    try {
      const created = await api.purchases.createReceipt({
        purchase_order_id: receiptForm.purchase_order_id,
        proveedor_ref: receiptForm.proveedor_ref || undefined,
        observaciones: receiptForm.observaciones || undefined,
        items: validItems.map(it => ({
          product_id: it.product_id,
          cantidad_recibida: Number(it.cantidad_recibir),
          costo_unitario: Number(it.precio_unitario),
          cantidad_rechazada: Number(it.cantidad_rechazada || 0),
          motivo_rechazo: it.motivo_rechazo || undefined,
          lote: it.lote || undefined,
          fecha_vencimiento: it.fecha_vencimiento ? `${it.fecha_vencimiento}T00:00:00Z` : undefined,
          es_extraordinario: it.es_extraordinario || false,
          autorizado_por: it.autorizado_por || undefined,
          autorizacion_motivo: it.autorizacion_motivo || undefined,
        })) as any,
      })
      toast.success("¡Mercadería Recibida en Muelle!", "Se actualizó el stock físico y se registraron los lotes.")
      setShowReceiptModal(false)
      if (created?.id) setLastReceiptForLabels({ id: created.id, numero: created.numero || "" })
      fetchAll()
    } catch (e: any) {
      toast.error("Error al registrar recepción", e.message)
    } finally {
      setSavingReceipt(false)
    }
  }

  const handleSearchExtraordinary = async (q: string) => {
    setExtraordinarySearch(q)
    if (!q.trim() || q.trim().length < 2) {
      setExtraordinaryResults([])
      return
    }
    setSearchingExtraordinary(true)
    try {
      const res = await api.products.list({ search: q.trim(), limit: 8 } as any)
      setExtraordinaryResults(Array.isArray(res) ? res : (res as any)?.items || [])
    } catch {
      setExtraordinaryResults([])
    } finally {
      setSearchingExtraordinary(false)
    }
  }

  const handleAddExtraordinaryItem = (product: Product) => {
    const exists = receiptForm.items.find(it => it.product_id === product.id)
    if (exists) {
      toast.info("Producto ya presente", "Ya está en la lista de recepción.")
      return
    }
    const cost = Number(product.costo_unitario || (product as any).precio_costo || 0)
    setReceiptForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: product.id,
          nombre: product.nombre,
          sku: product.sku || "",
          cantidad_ordenada: 0,
          cantidad_recibir: 1,
          presentacion_id: "",
          cantidad_presentacion: 1,
          precio_unitario: cost,
          lote: "",
          fecha_vencimiento: "",
          cantidad_rechazada: 0,
          motivo_rechazo: "",
          es_extraordinario: true,
          autorizado_por: user?.id,
          autorizacion_motivo: "Adición extraordinaria aprobada en muelle",
        },
      ],
    }))
    setExtraordinarySearch("")
    setExtraordinaryResults([])
    toast.success("Ítem Extraordinario Agregado", `${product.nombre} añadido para recepción extraordinaria.`)
  }

  // ── Handlers Creación y Edición Manual de Orden de Compra ────────────────────
  const handleOpenManualPOModal = () => {
    setEditingPOId(null)
    setEditingPO(null)
    setManualPOSupplierId(suppliers[0]?.id || "")
    const defDate = new Date()
    defDate.setDate(defDate.getDate() + 3)
    setManualPOFechaEntrega(defDate.toISOString().split("T")[0])
    setManualPOPrioridad("normal")
    setManualPOCondiciones("30 Días")
    setManualPOObservaciones("")
    setManualPOItems([])
    setSearchProductPO("")
    setProductSearchResultsPO([])
    setShowManualPOModal(true)
  }

  const handleEditPO = async (po: PurchaseOrder) => {
    if (!po.id) return
    setEditingPOId(po.id)
    setEditingPO(po)
    setManualPOSupplierId(po.supplier_id || "")
    setManualPOFechaEntrega(po.fecha_entrega_estimada ? po.fecha_entrega_estimada.split("T")[0] : "")
    setManualPOPrioridad(po.prioridad || "normal")
    setManualPOCondiciones(po.condiciones_pago || "30 Días")
    setManualPOObservaciones(po.observaciones || "")
    setSearchProductPO("")
    setProductSearchResultsPO([])
    setShowManualPOModal(true)

    try {
      const items = await api.purchases.getOrderItems(po.id)
      setManualPOItems((items || []).map((it: any) => {
        const cant = Number(it.cantidad || 1)
        const prec = Number(it.precio_unitario || 0)
        return {
          product_id: it.product_id,
          nombre: it.producto?.nombre || it.descripcion || "Producto",
          sku: it.producto?.sku || it.sku || "",
          codigo_barra: it.producto?.codigo_barra || it.codigo_barra || "",
          cantidad: cant,
          precio_unitario: prec,
          iva_tasa: Number(it.iva_tasa || 10),
          subtotal: Number(it.total || (cant * prec)),
        }
      }))
    } catch (e: any) {
      toast.error("Error al cargar ítems de la orden", e.message)
    }
  }

  const handleSearchProductsPO = async (q: string) => {
    setSearchProductPO(q)
    if (!q.trim() || q.trim().length < 2) {
      setProductSearchResultsPO([])
      return
    }
    setSearchingProductsPO(true)
    try {
      const res = await api.products.list({ search: q.trim(), limit: 12 } as any)
      setProductSearchResultsPO(Array.isArray(res) ? res : (res as any)?.items || [])
    } catch {
      setProductSearchResultsPO([])
    } finally {
      setSearchingProductsPO(false)
    }
  }

  const handleAddProductToManualPO = (p: Product) => {
    const exists = manualPOItems.find(it => it.product_id === p.id)
    if (exists) {
      toast.info("Producto ya agregado", "Modifique la cantidad en la tabla.")
      return
    }
    const cost = Number(p.costo_unitario || (p as any).precio_costo || 0)
    setManualPOItems(prev => [
      ...prev,
      {
        product_id: p.id,
        nombre: p.nombre,
        sku: p.sku || "",
        codigo_barra: p.codigo_barra || "",
        cantidad: 10,
        precio_unitario: cost,
        iva_tasa: 10,
        subtotal: 10 * cost,
      }
    ])
    setSearchProductPO("")
    setProductSearchResultsPO([])
  }

  const handleRemoveItemFromManualPO = (idx: number) => {
    setManualPOItems(prev => prev.filter((_, i) => i !== idx))
  }

  const handleManualPOItemChange = (idx: number, field: string, value: any) => {
    setManualPOItems(prev => {
      const copy = [...prev]
      const item = { ...copy[idx], [field]: value }
      item.subtotal = Number(item.cantidad || 0) * Number(item.precio_unitario || 0)
      copy[idx] = item
      return copy
    })
  }

  const handleSaveManualPO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualPOSupplierId) {
      toast.error("Seleccione un proveedor")
      return
    }
    if (manualPOItems.length === 0) {
      toast.error("Debe agregar al menos un producto a la orden.")
      return
    }

    setSavingManualPO(true)
    try {
      if (editingPOId) {
        const updated = await api.purchases.updateOrder(editingPOId, {
          supplier_id: manualPOSupplierId as any,
          fecha_entrega_estimada: manualPOFechaEntrega ? manualPOFechaEntrega as any : undefined,
          prioridad: manualPOPrioridad,
          condiciones_pago: manualPOCondiciones,
          observaciones: manualPOObservaciones || undefined,
          items: manualPOItems.map(it => ({
            product_id: it.product_id,
            descripcion: it.nombre,
            cantidad: Number(it.cantidad),
            precio_unitario: Number(it.precio_unitario),
            iva_tasa: Number(it.iva_tasa || 10),
            total: Number(it.subtotal),
          })) as any,
        })
        toast.success("¡Orden de Compra Actualizada!", `Se guardaron los cambios de la OC N° ${editingPO?.numero || updated.numero}.`)
        setShowManualPOModal(false)
        setEditingPOId(null)
        setEditingPO(null)
        await fetchAll()
        setTab("ordenes")
        handleViewPO(updated)
      } else {
        const created = await api.purchases.createOrder({
          supplier_id: manualPOSupplierId as any,
          fecha_entrega_estimada: manualPOFechaEntrega ? manualPOFechaEntrega as any : undefined,
          prioridad: manualPOPrioridad,
          condiciones_pago: manualPOCondiciones,
          observaciones: manualPOObservaciones || undefined,
          user_id: user?.id as any,
          created_by_name: user?.nombre || "Comprador",
          items: manualPOItems.map(it => ({
            product_id: it.product_id,
            descripcion: it.nombre,
            cantidad: Number(it.cantidad),
            precio_unitario: Number(it.precio_unitario),
            iva_tasa: Number(it.iva_tasa || 10),
            total: Number(it.subtotal),
          })) as any,
        })
        toast.success("¡Orden de Compra Emitida!", `Se creó la OC N° ${created.numero} con ${manualPOItems.length} ítems.`)
        setShowManualPOModal(false)
        fetchAll()
        setTab("ordenes")
        handleViewPO(created)
      }
    } catch (e: any) {
      toast.error(editingPOId ? "Error al modificar orden" : "Error al emitir orden de compra", e.message)
    } finally {
      setSavingManualPO(false)
    }
  }

  // ── Handlers Inbox IMAP cPanel y XML SIFEN ──────────────────────────────────
  const handleSaveInboxConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingInboxConfig(true)
    try {
      const saved = await api.purchases.saveInboxConfig(inboxConfigForm)
      setInboxConfig(saved)
      toast.success("Configuración Guardada", "Los datos de conexión IMAP de cPanel fueron actualizados.")
      setShowInboxConfigModal(false)
    } catch (e: any) {
      toast.error("Error al guardar configuración de correo", e.message)
    } finally {
      setSavingInboxConfig(false)
    }
  }

  const handleSyncInboxNow = async () => {
    setSyncingInbox(true)
    try {
      const res = await api.purchases.syncInbox({ max_emails: 50, only_unseen: false })
      if (res.success) {
        toast.success(
          "¡Sincronización Completada!",
          `Procesados: ${res.emails_procesados} correos. Nuevas facturas: ${res.facturas_nuevas}. Existentes: ${res.facturas_existentes}.`
        )
        fetchAll()
      } else {
        toast.error("Fallo al conectar al correo", res.error || "Verifique las credenciales IMAP.")
      }
    } catch (e: any) {
      toast.error("Error al sincronizar correo", e.message)
    } finally {
      setSyncingInbox(false)
    }
  }

  const handleUploadXmlFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Archivo no soportado", "Por favor seleccione un archivo XML de Factura Electrónica SIFEN.")
      return
    }
    setUploadingXml(true)
    try {
      const res = await api.purchases.uploadInvoiceXml(file, user?.id)
      if (res.success) {
        toast.success(
          "¡Factura XML Procesada!",
          `Factura N° ${res.numero_factura} de ${res.supplier_nombre}. Total: ${formatPYG(res.total || 0)} (${res.items_count} ítems).`
        )
        fetchAll()
      } else {
        toast.error("Error al procesar XML", res.error || "No se pudo interpretar el archivo.")
      }
    } catch (e: any) {
      toast.error("Error al subir XML", e.message)
    } finally {
      setUploadingXml(false)
    }
  }

  // ── Handlers 3-Way Match y Solicitudes de NC ────────────────────────────────
  const handleOpen3WayMatch = async (invoiceId: string) => {
    setPerformingMatch(true)
    setShowMatchModal(true)
    setMatchResult(null)
    try {
      const result = await api.purchases.reconcile3WayMatch(invoiceId, user?.id)
      setMatchResult(result)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al conciliar 3-Way Match", e.message)
      setShowMatchModal(false)
    } finally {
      setPerformingMatch(false)
    }
  }

  const handleOpenResolveNc = (ncReq: any) => {
    setSelectedNcRequestForResolve(ncReq)
    setResolveNcForm({
      nc_recibida_numero: "",
      nc_recibida_timbrado: "",
      nc_recibida_monto: Number(ncReq.monto_reclamado || 0),
      nc_recibida_fecha: new Date().toISOString().split("T")[0],
      nc_recibida_cdc: "",
      observaciones: "",
    })
    setShowResolveNcModal(true)
  }

  const handleSaveResolveNc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedNcRequestForResolve) return
    setResolvingNc(true)
    try {
      const res = await api.purchases.resolveSupplierNcRequest(selectedNcRequestForResolve.id, {
        ...resolveNcForm,
        user_id: user?.id,
      })
      toast.success("Nota de Crédito Aplicada", res.mensaje || "Se actualizó el saldo y se liberó la factura para Tesorería.")
      setShowResolveNcModal(false)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al aplicar Nota de Crédito", e.message)
    } finally {
      setResolvingNc(false)
    }
  }


  const handleSaveRequisition = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingReq(true)
    try {
      await api.purchases.requisitions.create({
        departamento: reqForm.departamento,
        prioridad: reqForm.prioridad,
        motivo: reqForm.motivo,
        observaciones: reqForm.observaciones,
        items: reqForm.items.map(it => ({
          product_id: it.product_id || suppliers[0]?.id || "p1",
          descripcion: it.descripcion || "Insumo de Reposición",
          cantidad_solicitada: Number(it.cantidad || 10),
          precio_estimado: Number(it.precio_estimado || 0),
        })),
        solicitante_nombre: user?.nombre || "Encargado de Sector",
      })
      toast.success("Requisición Creada", "La solicitud fue enviada a Compras para aprobación.")
      setShowReqModal(false)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al crear requisición", e.message)
    } finally {
      setSavingReq(false)
    }
  }

  // ---------------------------------------------------------------------------
  // KPIS HERO (TIPOGRAFÍA UNIFICADA MONOSPACE EXTRABOLD)
  // ---------------------------------------------------------------------------
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const ordersEsteMes = useMemo(() => {
    return orders.filter(o => {
      if (!o.fecha) return false
      const d = new Date(o.fecha)
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth
    })
  }, [orders, currentYear, currentMonth])

  const totalComprasEsteMes = useMemo(() => {
    return ordersEsteMes.reduce((acc, o) => acc + Number(o.total || 0), 0)
  }, [ordersEsteMes])

  // Tránsito verificado: órdenes enviadas/confirmadas/parciales de los últimos 45 días
  const ordenesEnTransito = useMemo(() => {
    const cutoff = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
    return orders.filter(o => {
      if (!["enviada", "enviado", "parcial", "confirmado", "confirmada"].includes(o.estado || "")) return false
      if (!o.fecha) return false
      const d = new Date(o.fecha)
      return d >= cutoff
    })
  }, [orders, now])

  const montoEnTransito = useMemo(() => {
    return ordenesEnTransito.reduce((acc: number, o: any) => acc + Number(o.total || 0), 0)
  }, [ordenesEnTransito])

  const totalQuiebresInminentes = replenishmentData?.total_quiebres || 0
  const totalBajosStock = replenishmentData?.total_bajos || 0

  const totalOrdenIASugerida = useMemo(() => {
    if (!replenishmentData) return 0
    return replenishmentData.items
      .filter((it: any) => selectedItemsIA[it.product_id])
      .reduce((acc: number, it: any) => {
        const rawQty = editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida
        const qty = Math.max(0, Number(rawQty) || 0)
        const cost = editedCosts[it.product_id] !== undefined ? Number(editedCosts[it.product_id]) : (Number(it.costo_unitario_estimado) || 0)
        return acc + (qty * cost)
      }, 0)
  }, [replenishmentData, selectedItemsIA, editedQuantities, editedCosts])

  const totalUnidadesIASugerida = useMemo(() => {
    if (!replenishmentData) return 0
    return replenishmentData.items
      .filter((it: any) => selectedItemsIA[it.product_id])
      .reduce((acc: number, it: any) => {
        const rawQty = editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida
        const qty = Math.max(0, Number(rawQty) || 0)
        return acc + qty
      }, 0)
  }, [replenishmentData, selectedItemsIA, editedQuantities])

  // Filtrado reactivo de Proveedores para el Asistente IA
  const filteredSuppliersForIA = useMemo(() => {
    if (!filterSupplierSearchIA) return suppliers
    const q = filterSupplierSearchIA.toLowerCase()
    return suppliers.filter((s: any) =>
      s.razon_social?.toLowerCase().includes(q) ||
      s.ruc?.toLowerCase().includes(q)
    )
  }, [suppliers, filterSupplierSearchIA])

  // Filtrado y Ordenamiento reactivo de la Matriz de Sugerencia IA (sin recargar API)
  const displayedReplenishmentItems = useMemo(() => {
    if (!replenishmentData?.items) return []
    const filtered = replenishmentData.items.filter((it: any) => {
      const matchSearch = !searchProductIA ||
        it.nombre?.toLowerCase().includes(searchProductIA.toLowerCase()) ||
        it.sku?.toLowerCase().includes(searchProductIA.toLowerCase())

      if (!matchSearch) return false

      if (filterEstadoIA === "quiebres") return it.autonomia_estado === "critico"
      if (filterEstadoIA === "bajos") return it.autonomia_estado === "bajo"
      if (filterEstadoIA === "sugeridos") {
        const qty = editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida
        return Number(qty) > 0 || Number(it.cantidad_sugerida) > 0
      }
      return true
    })

    if (!sortColumnIA) return filtered

    return [...filtered].sort((a: any, b: any) => {
      let valA: any
      let valB: any

      switch (sortColumnIA) {
        case "producto":
          valA = (a.nombre || "").toLowerCase()
          valB = (b.nombre || "").toLowerCase()
          break
        case "proveedor":
          valA = (a.ultimo_proveedor_nombre || "").toLowerCase()
          valB = (b.ultimo_proveedor_nombre || "").toLowerCase()
          break
        case "stock":
          valA = Number(a.stock_actual) || 0
          valB = Number(b.stock_actual) || 0
          break
        case "m4":
          valA = Number(a.ventas_mes_4) || 0
          valB = Number(b.ventas_mes_4) || 0
          break
        case "m3":
          valA = Number(a.ventas_mes_3) || 0
          valB = Number(b.ventas_mes_3) || 0
          break
        case "m2":
          valA = Number(a.ventas_mes_2) || 0
          valB = Number(b.ventas_mes_2) || 0
          break
        case "m1":
          valA = Number(a.ventas_mes_1) || 0
          valB = Number(b.ventas_mes_1) || 0
          break
        case "pulso": {
          const rank = (p: string) => (p === "acelerando" ? 3 : p === "estable" ? 2 : 1)
          valA = rank(a.pulso_tendencia)
          valB = rank(b.pulso_tendencia)
          break
        }
        case "costo_ppp":
          valA = Number(a.costo_promedio) || 0
          valB = Number(b.costo_promedio) || 0
          break
        case "ultimo_costo":
          valA = Number(a.ultimo_costo || a.costo_promedio) || 0
          valB = Number(b.ultimo_costo || b.costo_promedio) || 0
          break
        case "autonomia":
          valA = Number(a.dias_stock_restantes) || 0
          valB = Number(b.dias_stock_restantes) || 0
          break
        case "sugerencia":
          valA = Number(a.cantidad_sugerida) || 0
          valB = Number(b.cantidad_sugerida) || 0
          break
        case "pedido":
          valA = editedQuantities[a.product_id] !== undefined ? editedQuantities[a.product_id] : Math.max(0, Math.round(Number(a.cantidad_sugerida) || 0))
          valB = editedQuantities[b.product_id] !== undefined ? editedQuantities[b.product_id] : Math.max(0, Math.round(Number(b.cantidad_sugerida) || 0))
          break
        case "costo_unit":
          valA = editedCosts[a.product_id] !== undefined ? editedCosts[a.product_id] : (Number(a.costo_unitario_estimado) || 0)
          valB = editedCosts[b.product_id] !== undefined ? editedCosts[b.product_id] : (Number(b.costo_unitario_estimado) || 0)
          break
        case "subtotal": {
          const qtyA = editedQuantities[a.product_id] !== undefined ? editedQuantities[a.product_id] : Math.max(0, Math.round(Number(a.cantidad_sugerida) || 0))
          const costA = editedCosts[a.product_id] !== undefined ? editedCosts[a.product_id] : (Number(a.costo_unitario_estimado) || 0)
          const qtyB = editedQuantities[b.product_id] !== undefined ? editedQuantities[b.product_id] : Math.max(0, Math.round(Number(b.cantidad_sugerida) || 0))
          const costB = editedCosts[b.product_id] !== undefined ? editedCosts[b.product_id] : (Number(b.costo_unitario_estimado) || 0)
          valA = qtyA * costA
          valB = qtyB * costB
          break
        }
        default:
          return 0
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDirectionIA === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA)
      }

      return sortDirectionIA === "asc" ? valA - valB : valB - valA
    })
  }, [replenishmentData, searchProductIA, filterEstadoIA, editedQuantities, editedCosts, sortColumnIA, sortDirectionIA])

  // Filtrado y Paginación de Órdenes
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = !searchPO ||
        (o.numero && o.numero.toLowerCase().includes(searchPO.toLowerCase())) ||
        (o.supplier?.razon_social && o.supplier.razon_social.toLowerCase().includes(searchPO.toLowerCase()))
      const matchStatus = filterPOStatus === "todos" || o.estado === filterPOStatus
      const matchSupplier = !filterPOSupplier || o.supplier_id === filterPOSupplier
      return matchSearch && matchStatus && matchSupplier
    })
  }, [orders, searchPO, filterPOStatus, filterPOSupplier])

  const paginatedOrders = useMemo(() => {
    const start = (pagePO - 1) * pageSizePO
    return filteredOrders.slice(start, start + pageSizePO)
  }, [filteredOrders, pagePO, pageSizePO])

  const totalPagesPO = Math.max(1, Math.ceil(filteredOrders.length / pageSizePO))

  // Filtrado y Paginación de Proveedores
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      return !searchSupplier ||
        (s.razon_social && s.razon_social.toLowerCase().includes(searchSupplier.toLowerCase())) ||
        (s.ruc && s.ruc.toLowerCase().includes(searchSupplier.toLowerCase()))
    })
  }, [suppliers, searchSupplier])

  const paginatedSuppliers = useMemo(() => {
    const start = (pageSupplier - 1) * pageSizeSupplier
    return filteredSuppliers.slice(start, start + pageSizeSupplier)
  }, [filteredSuppliers, pageSupplier, pageSizeSupplier])

  const totalPagesSupplier = Math.max(1, Math.ceil(filteredSuppliers.length / pageSizeSupplier))

  // Filtrado y Paginación de Facturas Proveedores (Procure-to-Pay)
  const filteredInvoicesP2P = useMemo(() => {
    return allSupplierInvoices.filter(inv => {
      const matchSearch = !searchInvoices || 
        (inv.numero_factura?.toLowerCase().includes(searchInvoices.toLowerCase())) ||
        (inv.supplier_nombre?.toLowerCase().includes(searchInvoices.toLowerCase())) ||
        (inv.concepto?.toLowerCase().includes(searchInvoices.toLowerCase()))
      const matchStatus = filterInvoiceStatus === "todos" || inv.estado === filterInvoiceStatus
      return matchSearch && matchStatus
    })
  }, [allSupplierInvoices, searchInvoices, filterInvoiceStatus])

  const totalPagesInvoicesP2P = Math.max(1, Math.ceil(filteredInvoicesP2P.length / pageSizeInvoices))
  const paginatedInvoicesP2P = useMemo(() => {
    const start = (pageInvoices - 1) * pageSizeInvoices
    return filteredInvoicesP2P.slice(start, start + pageSizeInvoices)
  }, [filteredInvoicesP2P, pageInvoices, pageSizeInvoices])

  // Filtrado y Paginación de Devoluciones y Notas de Crédito (Nemuha Legacy)
  const filteredReturnsAndNC = useMemo(() => {
    const combined = [
      ...supplierReturns.map(r => ({ ...r, tipo_registro: "devolucion" })),
      ...supplierCreditNotes.map(nc => ({ ...nc, tipo_registro: "nota_credito", numero_nota_credito: nc.numero }))
    ]
    return combined.filter(item => {
      const matchSearch = !searchReturns ||
        (item.numero_nota_credito?.toLowerCase().includes(searchReturns.toLowerCase())) ||
        (item.numero_factura_origen?.toLowerCase().includes(searchReturns.toLowerCase())) ||
        (item.supplier_nombre?.toLowerCase().includes(searchReturns.toLowerCase())) ||
        (item.observaciones?.toLowerCase().includes(searchReturns.toLowerCase()))
      return matchSearch
    }).sort((a, b) => new Date(b.fecha || b.created_at || "").getTime() - new Date(a.fecha || a.created_at || "").getTime())
  }, [supplierReturns, supplierCreditNotes, searchReturns])

  const totalPagesReturns = Math.max(1, Math.ceil(filteredReturnsAndNC.length / pageSizeReturns))
  const paginatedReturns = useMemo(() => {
    const start = (pageReturns - 1) * pageSizeReturns
    return filteredReturnsAndNC.slice(start, start + pageSizeReturns)
  }, [filteredReturnsAndNC, pageReturns, pageSizeReturns])

  return (
    <div className="space-y-6 animate-fade-in-up pb-16 max-w-full overflow-hidden">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <ShoppingCart className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    ABASTECIMIENTO ESTRATÉGICO · CONECTOR REAL NEMUHA
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    {orders.length.toLocaleString()} Órdenes de Compra
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Gestión de Compras & Abastecimiento
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Asistente IA por días de stock, demanda predictiva sobre 11.250 productos y 441 proveedores sincronizados
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                📦 {suppliers.length} proveedores homologados
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                💰 {formatPYG(totalComprasEsteMes)} compras del mes
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => handleOpenReceiptModal()}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              Recepción en Muelle
            </button>

            <button
              onClick={() => {
                setTab("asistente_ia")
                setSoloQuiebreIA(false)
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 transition shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Nueva Orden IA
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Compras del Mes</span>
              <DollarSign className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-indigo-300">
              {formatPYG(totalComprasEsteMes)}
            </p>
            <p className="text-[11px] text-slate-400">{ordersEsteMes.length.toLocaleString()} órdenes emitidas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En Tránsito (30d)</span>
              <Truck className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {formatPYG(montoEnTransito)}
            </p>
            <p className="text-[11px] text-slate-400">{ordenesEnTransito.length} OC en camino</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Riesgo Quiebre</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {totalQuiebresInminentes + totalBajosStock}
            </p>
            <p className="text-[11px] text-slate-400">{totalQuiebresInminentes} quiebres + {totalBajosStock} bajo stock</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Proveedores Activos</span>
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {suppliers.length}
            </p>
            <p className="text-[11px] text-slate-400">100% Sincronizados de Nemuha</p>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          BANNER DE ALERTA DE QUIEBRE PREVENTIVO
      ────────────────────────────────────────────────────────────────────────── */}
      {totalQuiebresInminentes > 0 && (
        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-500 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-rose-600 dark:text-rose-300 uppercase tracking-wider">
                Alerta de Stock Crítico: {totalQuiebresInminentes} producto(s) en quiebre inminente (&lt;3 días de cobertura)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                La rotación proyectada en góndola superará el stock físico antes de la próxima entrega.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setTab("asistente_ia")
              setSoloQuiebreIA(true)
              setDiasCobertura(7)
            }}
            className="px-4 py-2 rounded-2xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 flex items-center gap-1.5 shrink-0 transition"
          >
            <Flame className="w-4 h-4" /> Armar Pedido Emergencia (7 Días)
          </button>
        </div>
      )}

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center gap-1.5 overflow-x-auto shadow-sm">
        {[
          { id: "asistente_ia", label: "Asistente IA de Abastecimiento", icon: Sparkles, badge: totalQuiebresInminentes > 0 ? `${totalQuiebresInminentes}` : undefined },
          { id: "ordenes", label: "Órdenes de Compra (OC)", icon: ShoppingCart, count: orders.length },
          { id: "recepciones", label: "Recepción en Muelle", icon: Truck, count: receipts.length },
          { id: "facturas_p2p", label: "Facturas Proveedor (P2P)", icon: Receipt, count: allSupplierInvoices.length },
          { id: "devoluciones", label: "Devoluciones & NC", icon: Undo2, count: supplierReturns.length + supplierCreditNotes.length },
          { id: "matching", label: "3-Way Matching", icon: Scale, count: invoices.length },
          { id: "proveedores", label: "Proveedores & Scorecard", icon: Building2, count: suppliers.length },
          { id: "requisiciones", label: "Requisiciones Internas", icon: ClipboardList, count: requisitions.length },
          { id: "cotizaciones", label: "Cotizaciones (RFQ)", icon: FileSpreadsheet, count: rfqs.length },
          { id: "presupuestos", label: "Presupuestos", icon: BarChart3, count: budgets.length },
          { id: "reportes", label: "Reportes & Precios", icon: PieChart },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as MainTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
              {t.badge && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 1: ASISTENTE IA DE ABASTECIMIENTO POR DÍAS DE STOCK
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "asistente_ia" && (
        <div className="space-y-6">
          <div className="card p-6 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  Parámetros de Reabastecimiento & Proyección de Stock
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Ajustá los días de cobertura deseados y activá los multiplicadores de contexto estacional para calcular la orden ideal.
                </p>
              </div>

              <button
                onClick={handleOpenGenerateModal}
                disabled={loadingReplenishment || totalUnidadesIASugerida === 0}
                className="btn-primary text-xs flex items-center gap-2 px-5 py-2.5 shadow-md shrink-0 disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4" />
                Generar Orden ({totalUnidadesIASugerida.toLocaleString()} un. — {formatPYG(totalOrdenIASugerida)})
              </button>
            </div>

            {/* SECCIÓN 1: CONTROLES PRINCIPALES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div ref={supplierComboboxRef} className="relative">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Proveedor a Comprar</span>
                  {selectedSupplierIA && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSupplierIA("")
                        setFilterSupplierSearchIA("")
                        setSupplierComboboxOpen(false)
                      }}
                      className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Limpiar
                    </button>
                  )}
                </label>

                {/* CAMPO COMBOMBOX BUSCADOR ÚNICO */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Escribí el nombre o RUC del proveedor..."
                    value={filterSupplierSearchIA}
                    onFocus={() => setSupplierComboboxOpen(true)}
                    onChange={(e) => {
                      setFilterSupplierSearchIA(e.target.value)
                      setSupplierComboboxOpen(true)
                    }}
                    className={`input-field pl-9 pr-10 w-full text-xs font-semibold py-2 bg-white dark:bg-slate-900 border-2 transition-all ${
                      selectedSupplierIA
                        ? "border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-950/50 text-indigo-900 dark:text-indigo-200"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                  />
                  {selectedSupplierIA ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSupplierIA("")
                        setFilterSupplierSearchIA("")
                        setSupplierComboboxOpen(false)
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 rounded-full"
                      title="Quitar filtro de proveedor"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSupplierComboboxOpen(prev => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-indigo-500"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* DROPDOWN FLOTANTE DE RESULTADOS */}
                {supplierComboboxOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-72 flex flex-col animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Seleccionar Proveedor</span>
                      <span>{filteredSuppliersForIA.length} proveedores</span>
                    </div>

                    <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                      {/* Opción Todos los Proveedores */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierIA("")
                          setFilterSupplierSearchIA("")
                          setSupplierComboboxOpen(false)
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          !selectedSupplierIA
                            ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-bold"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold">Todos los Proveedores (Matriz Global)</div>
                            <div className="text-[10px] text-gray-400">Evaluar catálogo completo</div>
                          </div>
                        </div>
                        {!selectedSupplierIA && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                      </button>

                      {/* Lista Filtrada de Proveedores */}
                      {filteredSuppliersForIA.map(s => {
                        const isSelected = selectedSupplierIA === s.id
                        const rSocial = s.razon_social || "Proveedor"
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSupplierIA(s.id)
                              setFilterSupplierSearchIA(rSocial)
                              setSupplierComboboxOpen(false)
                            }}
                            className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                              isSelected
                                ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-bold"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black text-[9px] shrink-0">
                                {rSocial.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold truncate">{rSocial}</div>
                                <div className="text-[10px] text-gray-400 flex items-center gap-2">
                                  {s.ruc && <span>RUC: {s.ruc}</span>}
                                  {s.plazo_pago_dias ? <span className="text-emerald-600 font-bold">Plazo: {s.plazo_pago_dias}d</span> : null}
                                </div>
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                          </button>
                        )
                      })}

                      {filteredSuppliersForIA.length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-400">
                          No se encontró ningún proveedor con "{filterSupplierSearchIA}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Días de Cobertura Deseados</span>
                  <span className="font-bold text-indigo-600 font-mono">{diasCobertura} Días</span>
                </label>
                <div className="flex gap-1.5">
                  {[7, 15, 30, 45, 60].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDiasCobertura(d)
                        setEditedQuantities({})
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        diasCobertura === d
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Lead Time
                  </label>
                  <select
                    value={leadTimeDias}
                    onChange={(e) => setLeadTimeDias(Number(e.target.value))}
                    className="input-field w-full text-xs"
                  >
                    <option value={1}>1 Día</option>
                    <option value={2}>2 Días</option>
                    <option value={3}>3 Días</option>
                    <option value={7}>7 Días</option>
                    <option value={15}>15 Días</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Historial Ventas
                  </label>
                  <select
                    value={diasHistorialVentas}
                    onChange={(e) => setDiasHistorialVentas(Number(e.target.value))}
                    className="input-field w-full text-xs"
                  >
                    <option value={15}>15 Días</option>
                    <option value={30}>30 Días</option>
                    <option value={60}>60 Días</option>
                    <option value={90}>90 Días</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: MULTIPLICADORES ESTACIONALES */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                  Factores Predictivos de Demanda de Supermercado (IA)
                </span>
                <span className="text-[11px] text-gray-400">Ajuste automático de rotación por sector</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  factorFinSemana
                    ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={factorFinSemana}
                    onChange={(e) => setFactorFinSemana(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold flex items-center gap-1 truncate">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Fin de Semana (+40%)
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">Carnes, bebidas, carbón, snacks</div>
                  </div>
                </label>

                <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  factorFinMes
                    ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={factorFinMes}
                    onChange={(e) => setFactorFinMes(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold flex items-center gap-1 truncate">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Fin de Mes (+35%)
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">Canasta básica, lácteos, limpieza</div>
                  </div>
                </label>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    {factorClima === "calor" && <Sun className="w-3 h-3 text-amber-500" />}
                    {factorClima === "frio" && <Snowflake className="w-3 h-3 text-blue-500" />}
                    {factorClima === "lluvia" && <CloudRain className="w-3 h-3 text-cyan-500" />}
                    {factorClima === "normal" && <Sun className="w-3 h-3 text-slate-400" />}
                    Previsión Climática
                  </div>
                  <select
                    value={factorClima}
                    onChange={(e) => setFactorClima(e.target.value as any)}
                    className="w-full text-xs font-bold bg-transparent border-0 p-0 text-gray-800 dark:text-gray-200 focus:ring-0 cursor-pointer truncate"
                  >
                    <option value="normal">Clima Normal / Templado</option>
                    <option value="calor">☀️ Ola de Calor (+30% Bebidas/Hielo)</option>
                    <option value="frio">❄️ Frente Frío (+35% Café/Sopas/Harinas)</option>
                    <option value="lluvia">🌧️ Días de Lluvia (+25% Panificados)</option>
                  </select>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    Evento / Calendario
                  </div>
                  <select
                    value={factorEvento}
                    onChange={(e) => setFactorEvento(e.target.value as any)}
                    className="w-full text-xs font-bold bg-transparent border-0 p-0 text-gray-800 dark:text-gray-200 focus:ring-0 cursor-pointer truncate"
                  >
                    <option value="normal">Calendario Regular</option>
                    <option value="feriado">🎉 Feriado Largo (+35% Carnes/Bebidas)</option>
                    <option value="semana_santa">🐟 Semana Santa (+60% Pescados)</option>
                    <option value="fin_de_ano">🎄 Fiestas Fin de Año (+50% Sidras)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: BÚSQUEDA Y RECALCULAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o SKU en la matriz..."
                  value={searchProductIA}
                  onChange={(e) => setSearchProductIA(e.target.value)}
                  className="input-field pl-9 w-full text-xs"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={runReplenishmentPreview}
                  disabled={loadingReplenishment}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingReplenishment ? "animate-spin" : ""}`} />
                  Recalcular IA
                </button>
              </div>
            </div>
          </div>

          {/* TABLA PREDICTIVA RESPONSIVA */}
          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            <div className="p-4 bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Box className="w-4 h-4 text-indigo-500" />
                  Matriz de Sugerencia ({displayedReplenishmentItems.length} de {replenishmentData?.items?.length || 0} Productos Evaluados)
                </h4>
                
                {/* FILTROS DE ESTADO CLICKEABLES CON INDICADORES EN VIVO */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFilterEstadoIA("todos")}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                      filterEstadoIA === "todos"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md ring-2 ring-slate-400 scale-[1.02]"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span>Todos</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 font-mono font-black">
                      {replenishmentData?.items?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterEstadoIA("quiebres")}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                      filterEstadoIA === "quiebres"
                        ? "bg-red-600 text-white shadow-md ring-2 ring-red-300 scale-[1.02]"
                        : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span>Quiebres Inminentes</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-200 dark:bg-red-900/60 font-mono font-black">
                      {replenishmentData?.total_quiebres || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterEstadoIA("bajos")}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                      filterEstadoIA === "bajos"
                        ? "bg-amber-500 text-white shadow-md ring-2 ring-amber-300 scale-[1.02]"
                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Stock Bajo (ROP)</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-200 dark:bg-amber-900/60 font-mono font-black">
                      {replenishmentData?.total_bajos || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterEstadoIA("sugeridos")}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                      filterEstadoIA === "sugeridos"
                        ? "bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 scale-[1.02]"
                        : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Con Sugerencia IA</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-200 dark:bg-indigo-900/60 font-mono font-black">
                      {replenishmentData?.total_sugeridos || 0}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs shrink-0">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Seleccionado</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
                      {formatPYG(totalOrdenIASugerida)}
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-500">
                      ({Math.round(totalUnidadesIASugerida).toLocaleString()} un.)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* BARRA DE ESTADO DE ORDENAMIENTO ACTIVO */}
            {sortColumnIA && (
              <div className="flex items-center justify-between px-4 py-2 bg-indigo-50/80 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-800 dark:text-indigo-200 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    Ordenado por: <strong className="font-extrabold">{
                      sortColumnIA === "producto" ? "Producto & SKU" :
                      sortColumnIA === "proveedor" ? "Último Proveedor" :
                      sortColumnIA === "stock" ? "Stock Físico" :
                      sortColumnIA === "m4" ? (replenishmentData?.meses_labels?.[0] || "M-4") :
                      sortColumnIA === "m3" ? (replenishmentData?.meses_labels?.[1] || "M-3") :
                      sortColumnIA === "m2" ? (replenishmentData?.meses_labels?.[2] || "M-2") :
                      sortColumnIA === "m1" ? (replenishmentData?.meses_labels?.[3] || "M-1") :
                      sortColumnIA === "pulso" ? "Pulso Venta" :
                      sortColumnIA === "costo_ppp" ? "Costo PPP" :
                      sortColumnIA === "ultimo_costo" ? "Última Compra" :
                      sortColumnIA === "autonomia" ? "Autonomía" :
                      sortColumnIA === "sugerencia" ? "Sugerencia IA" :
                      sortColumnIA === "pedido" ? "Tu Pedido" :
                      sortColumnIA === "costo_unit" ? "Costo Unitario" :
                      sortColumnIA === "subtotal" ? "Subtotal" : sortColumnIA
                    }</strong> ({sortDirectionIA === "asc" ? "Menor a Mayor / A-Z" : "Mayor a Menor / Z-A"})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSortColumnIA(null)}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-100 font-bold text-[11px] underline cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Quitar ordenamiento
                </button>
              </div>
            )}

            {loadingReplenishment ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-xs text-gray-400 font-medium">Analizando ventas reales, stock y factores de estacionalidad...</p>
              </div>
            ) : !replenishmentData || displayedReplenishmentItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                No se encontraron productos con los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                {(() => {
                  const labels4m = (replenishmentData?.meses_labels && replenishmentData.meses_labels.length === 4)
                    ? replenishmentData.meses_labels
                    : ["M-4", "M-3", "M-2", "M-1"]

                  const renderSortHeader = (
                    col: IASortColumn,
                    label: string,
                    align: "left" | "center" | "right" = "left",
                    title?: string,
                    extraClass = ""
                  ) => {
                    const isSorted = sortColumnIA === col
                    return (
                      <th
                        onClick={() => handleSortIA(col)}
                        title={title || `Ordenar por ${label} (clic para alternar)`}
                        className={`p-2.5 select-none cursor-pointer group transition-colors hover:bg-slate-200/80 dark:hover:bg-slate-800/80 ${
                          isSorted ? "bg-indigo-100/70 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300" : ""
                        } ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${extraClass}`}
                      >
                        <div className={`inline-flex items-center gap-1.5 ${
                          align === "right" ? "justify-end w-full" : align === "center" ? "justify-center w-full" : "justify-start"
                        }`}>
                          <span>{label}</span>
                          <span className={`inline-flex items-center transition-all ${
                            isSorted ? "opacity-100 text-indigo-600 dark:text-indigo-400 scale-110" : "opacity-30 group-hover:opacity-80"
                          }`}>
                            {isSorted ? (
                              sortDirectionIA === "asc" ? (
                                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3" />
                            )}
                          </span>
                        </div>
                      </th>
                    )
                  }

                  return (
                    <table className="w-full text-left text-xs min-w-[1350px]">
                      <thead className="bg-slate-100/90 dark:bg-slate-900/70 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700/60 sticky top-0 z-10 shadow-xs">
                        <tr>
                          <th className="p-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={displayedReplenishmentItems.length > 0 && displayedReplenishmentItems.every((it: any) => selectedItemsIA[it.product_id])}
                              onChange={(e) => {
                                const checked = e.target.checked
                                const newSel = { ...selectedItemsIA }
                                displayedReplenishmentItems.forEach((it: any) => { newSel[it.product_id] = checked })
                                setSelectedItemsIA(newSel)
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </th>
                          {renderSortHeader("producto", "Producto & SKU", "left", undefined, "min-w-[200px]")}
                          {renderSortHeader("proveedor", "Último Proveedor", "left", "Último proveedor registrado para este producto", "min-w-[150px] max-w-[210px]")}
                          {renderSortHeader("stock", "Stock Físico", "right", "Stock actual físico registrado en góndola/depósito")}
                          {renderSortHeader("m4", labels4m[0], "right", `Ventas mensuales registradas en ${labels4m[0]}`, "font-mono")}
                          {renderSortHeader("m3", labels4m[1], "right", `Ventas mensuales registradas en ${labels4m[1]}`, "font-mono")}
                          {renderSortHeader("m2", labels4m[2], "right", `Ventas mensuales registradas en ${labels4m[2]}`, "font-mono")}
                          {renderSortHeader("m1", labels4m[3], "right", `Ventas mensuales registradas en ${labels4m[3]}`, "font-mono text-indigo-600 dark:text-indigo-400 font-extrabold")}
                          {renderSortHeader("pulso", "Pulso Venta", "center", "Tendencia / Pulso de Venta reciente", "min-w-[95px]")}
                          {renderSortHeader("costo_ppp", "Costo PPP", "right", "Costo Promedio Ponderado de Inventario (PPP)", "min-w-[100px]")}
                          {renderSortHeader("ultimo_costo", "Última Compra", "right", "Último Costo de Compra facturado por el proveedor", "min-w-[110px]")}
                          {renderSortHeader("autonomia", "Autonomía", "center", "Días de stock restantes con stock físico real = Stock / Demanda Diaria")}
                          {renderSortHeader("sugerencia", "Sugerencia IA", "center", "Cantidad óptima sugerida por la IA")}
                          {renderSortHeader("pedido", "Tu Pedido (Un.)", "center", "Modificá esta cantidad libremente.", "min-w-[140px]")}
                          {renderSortHeader("costo_unit", "Costo Unit. (Gs.)", "right", "Modificá el precio de compra acordado con el proveedor", "min-w-[125px]")}
                          {renderSortHeader("subtotal", "Subtotal (Gs.)", "right", undefined, "min-w-[115px]")}
                          <th className="p-3 min-w-[210px]">Justificación & Alertas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {displayedReplenishmentItems.map((it: any, idx: number) => {
                          const isSelected = !!selectedItemsIA[it.product_id]
                          const isEven = idx % 2 === 0
                          const qty = editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : Math.max(0, Math.round(Number(it.cantidad_sugerida) || 0))
                          const unitCost = editedCosts[it.product_id] !== undefined ? editedCosts[it.product_id] : (Number(it.costo_unitario_estimado) || 0)
                          const subtotal = Number(qty) * unitCost

                          const stockActual = Number(it.stock_actual) || 0
                          const demandaD = Number(it.demanda_diaria_ajustada) || 0
                          const nuevaAutonomia = demandaD > 0 ? ((stockActual + Number(qty)) / demandaD) : 999

                          return (
                            <tr
                              key={it.product_id}
                              className={`transition-all duration-150 border-b border-slate-100 dark:border-slate-800/60 ${
                                isSelected
                                  ? "bg-indigo-50/80 dark:bg-indigo-950/40"
                                  : it.autonomia_estado === "critico"
                                  ? "bg-red-50/40 dark:bg-red-950/20"
                                  : it.autonomia_estado === "bajo"
                                  ? "bg-amber-50/30 dark:bg-amber-950/15"
                                  : isEven
                                  ? "bg-white dark:bg-slate-900"
                                  : "bg-slate-50/60 dark:bg-slate-800/30"
                              } hover:!bg-blue-100/80 dark:hover:!bg-indigo-950/70 hover:shadow-sm`}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    setSelectedItemsIA(prev => ({ ...prev, [it.product_id]: e.target.checked }))
                                  }}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-gray-900 dark:text-white line-clamp-1" title={it.nombre}>
                                  {it.nombre}
                                </div>
                                <div className="text-[11px] text-gray-400 font-mono flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span>SKU: {it.sku || "—"}</span>
                                  <span className="px-1 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-bold">{it.unidad_medida}</span>
                                  {it.punto_reorden !== undefined && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-[10px] text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/50" title="Punto de Reorden">
                                      ROP: {Math.round(it.punto_reorden).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Último Proveedor Habitual */}
                              <td className="p-2.5 min-w-[150px] max-w-[210px]">
                                {it.ultimo_proveedor_nombre ? (
                                  <div className="flex items-start gap-1.5 text-slate-700 dark:text-slate-200" title={`Último Proveedor: ${it.ultimo_proveedor_nombre}`}>
                                    <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                                    <span className="text-[11px] font-semibold leading-snug line-clamp-2 break-words">
                                      {it.ultimo_proveedor_nombre}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-gray-400 italic">Sin asignar</span>
                                )}
                              </td>

                              {/* Stock Físico */}
                              <td className="p-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                                {stockActual.toLocaleString()}
                              </td>

                              {/* 4 Columnas de Ventas Históricas */}
                              <td className="p-2.5 text-right font-mono text-gray-500 dark:text-gray-400">
                                {Number(it.ventas_mes_4 || 0).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right font-mono text-gray-500 dark:text-gray-400">
                                {Number(it.ventas_mes_3 || 0).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right font-mono text-gray-600 dark:text-gray-300 font-semibold">
                                {Number(it.ventas_mes_2 || 0).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/40 dark:bg-indigo-950/20">
                                {Number(it.ventas_mes_1 || 0).toLocaleString()}
                              </td>

                              {/* Pulso de Venta */}
                              <td className="p-2.5 text-center">
                                {it.pulso_tendencia === "acelerando" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title="Rotación acelerando (+25% vs meses previos)">
                                    <TrendingUp className="w-3 h-3 text-emerald-600" /> Acelera
                                  </span>
                                ) : it.pulso_tendencia === "desacelerando" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800" title="Demanda cayendo (-25% vs meses previos)">
                                    <TrendingDown className="w-3 h-3 text-red-600" /> En baja
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    Estable
                                  </span>
                                )}
                              </td>

                              {/* Costo Promedio (PPP) */}
                              <td className="p-2.5 text-right font-mono text-gray-600 dark:text-gray-300">
                                {formatPYG(it.costo_promedio || 0)}
                              </td>

                              {/* Último Costo con indicador de variación */}
                              <td className="p-2.5 text-right font-mono">
                                <div className="font-bold text-gray-900 dark:text-white">
                                  {formatPYG(it.ultimo_costo || it.costo_promedio || 0)}
                                </div>
                                {it.variacion_costo_pct !== undefined && Math.abs(it.variacion_costo_pct) > 0.5 && (
                                  <span className={`text-[10px] font-extrabold inline-flex items-center gap-0.5 justify-end ${
                                    it.variacion_costo_pct > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                                  }`} title={`Variación vs Costo PPP: ${it.variacion_costo_pct > 0 ? '+' : ''}${it.variacion_costo_pct}%`}>
                                    {it.variacion_costo_pct > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                    {Math.abs(it.variacion_costo_pct)}%
                                  </span>
                                )}
                              </td>

                              {/* Autonomía Actual */}
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold font-mono border whitespace-nowrap ${
                                  it.autonomia_estado === "critico"
                                    ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/80"
                                    : it.autonomia_estado === "bajo"
                                    ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80"
                                    : it.autonomia_estado === "optimo"
                                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    it.autonomia_estado === "critico" ? "bg-red-500 animate-pulse" :
                                    it.autonomia_estado === "bajo" ? "bg-amber-500" :
                                    it.autonomia_estado === "optimo" ? "bg-emerald-500" : "bg-slate-400"
                                  }`} />
                                  <span>{Number(it.dias_stock_restantes) > 900 ? "Sin Venta" : `${Number(it.dias_stock_restantes).toFixed(1)}d`}</span>
                                </span>
                              </td>

                              {/* Sugerencia IA */}
                              <td className="p-3 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  <Sparkles className="w-3 h-3 text-indigo-500" />
                                  {Math.round(Number(it.cantidad_sugerida) || 0).toLocaleString()} un.
                                </span>
                              </td>

                              {/* Tu Pedido (Un.) */}
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : Math.round(Number(it.cantidad_sugerida) || 0)
                                      const nxt = Math.max(0, cur - 1)
                                      setEditedQuantities(prev => ({ ...prev, [it.product_id]: nxt }))
                                      if (nxt > 0) setSelectedItemsIA(prev => ({ ...prev, [it.product_id]: true }))
                                    }}
                                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    value={qty}
                                    onChange={(e) => {
                                      const val = Math.max(0, Number(e.target.value))
                                      setEditedQuantities(prev => ({ ...prev, [it.product_id]: val }))
                                      if (val > 0) setSelectedItemsIA(prev => ({ ...prev, [it.product_id]: true }))
                                    }}
                                    className="w-20 p-1 text-center font-mono font-black text-xs input-field bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : Math.round(Number(it.cantidad_sugerida) || 0)
                                      const nxt = cur + 1
                                      setEditedQuantities(prev => ({ ...prev, [it.product_id]: nxt }))
                                      setSelectedItemsIA(prev => ({ ...prev, [it.product_id]: true }))
                                    }}
                                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>

                              {/* Costo Unitario EDITABLE */}
                              <td className="p-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  step={50}
                                  value={unitCost}
                                  onChange={(e) => {
                                    const val = Math.max(0, Number(e.target.value))
                                    setEditedCosts(prev => ({ ...prev, [it.product_id]: val }))
                                    if (Number(qty) > 0) setSelectedItemsIA(prev => ({ ...prev, [it.product_id]: true }))
                                  }}
                                  className="w-28 p-1 text-right font-mono font-bold text-xs input-field bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 focus:ring-1 focus:ring-indigo-500"
                                  title="Precio de compra negociado para la orden de compra"
                                />
                              </td>

                              {/* Subtotal */}
                              <td className="p-3 text-right font-mono font-extrabold text-gray-900 dark:text-white">
                                {formatPYG(subtotal)}
                              </td>

                              {/* Justificación IA y Alertas de Promos */}
                              <td className="p-3 text-[11px] text-gray-500 dark:text-gray-400">
                                {it.tiene_promocion_detectada && (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mb-1" title={it.promocion_info || "Promoción detectada"}>
                                    <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                                    <span>Promo Pasada Detectada</span>
                                  </div>
                                )}
                                <div className="line-clamp-2" title={it.explicacion_ia}>
                                  {it.explicacion_ia}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 2: ÓRDENES DE COMPRA (OC) - CONECTADAS A 4.447 OC DE NEMUHA
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "ordenes" && (
        <div className="space-y-5">
          <div className="card p-4 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por N° orden o proveedor..."
                  value={searchPO}
                  onChange={(e) => { setSearchPO(e.target.value); setPagePO(1); }}
                  className="input-field pl-9 w-full text-xs"
                />
              </div>

              <select
                value={filterPOStatus}
                onChange={(e) => { setFilterPOStatus(e.target.value); setPagePO(1); }}
                className="input-field text-xs w-44"
              >
                <option value="todos">Todos los Estados</option>
                <option value="borrador">Borrador</option>
                <option value="confirmado">Confirmada</option>
                <option value="enviada">Enviada a Proveedor</option>
                <option value="parcial">Entrega Parcial</option>
                <option value="completado">Completada</option>
                <option value="cancelado">Cancelada</option>
              </select>

              <select
                value={filterPOSupplier}
                onChange={(e) => { setFilterPOSupplier(e.target.value); setPagePO(1); }}
                className="input-field text-xs w-52"
              >
                <option value="">Todos los Proveedores</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.razon_social}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportOrdersToExcel}
                className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-2 shrink-0 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 font-bold"
                title="Descargar listado filtrado de órdenes de compra en formato .xlsx"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar a Excel
              </button>
              <button
                onClick={handleOpenManualPOModal}
                className="btn-primary text-xs flex items-center gap-1.5 px-3.5 py-2 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                <Plus className="w-4 h-4" /> Crear Orden Manual
              </button>
              <button
                onClick={() => setTab("asistente_ia")}
                className="btn-secondary text-xs flex items-center gap-1.5 px-3.5 py-2 shrink-0"
              >
                <Sparkles className="w-4 h-4 text-amber-500" /> Con Asistente IA
              </button>
            </div>
          </div>

          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            {paginatedOrders.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                No se encontraron órdenes de compra con los filtros especificados.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      <th className="p-3">N° Orden</th>
                      <th className="p-3">Proveedor</th>
                      <th className="p-3">Fecha Emisión</th>
                      <th className="p-3">Entrega Esperada</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="p-3 text-right">Total IVA</th>
                      <th className="p-3 text-right">Total (Gs.)</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {paginatedOrders.map((po, idx) => {
                      const st = (po.estado && poStatusMap[po.estado]) ? poStatusMap[po.estado] : { label: po.estado || "Borrador", bg: "bg-slate-100", text: "text-slate-600" }
                      const isEven = idx % 2 === 0
                      return (
                        <tr
                          key={po.id}
                          className={`transition-colors duration-150 border-b border-slate-100 dark:border-slate-800/60 ${
                            isEven ? "bg-white dark:bg-slate-900" : "bg-slate-100/60 dark:bg-slate-800/40"
                          } hover:!bg-slate-200 dark:hover:!bg-slate-700 hover:shadow-sm`}
                        >
                          <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {po.numero}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-gray-900 dark:text-white line-clamp-1" title={po.supplier?.razon_social}>
                              {po.supplier?.razon_social || "Proveedor sin asignar"}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {po.supplier?.ruc ? `RUC: ${po.supplier.ruc}` : ""}
                            </div>
                          </td>
                          <td className="p-3 text-gray-500">
                            {po.fecha ? formatDate(po.fecha) : formatDate(po.created_at || "")}
                          </td>
                          <td className="p-3 font-mono text-gray-700 dark:text-gray-300">
                            {po.fecha_entrega_estimada ? formatDate(po.fecha_entrega_estimada) : "—"}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${st.bg} ${st.text}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-300">
                            {formatPYG(po.subtotal || 0)}
                          </td>
                          <td className="p-3 text-right font-mono text-gray-500">
                            {formatPYG((Number(po.iva_10 || 0) + Number(po.iva_5 || 0)))}
                          </td>
                          <td className="p-3 text-right font-mono font-extrabold text-gray-900 dark:text-white">
                            {formatPYG(po.total || 0)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleViewPO(po)}
                                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                title="Reporte Premium / Vista Oficial A4"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {["borrador", "confirmado", "enviada", "enviado"].includes(po.estado || "") && po.id && (
                                <button
                                  onClick={() => handleEditPO(po)}
                                  className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                                  title="Modificar Orden de Compra"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handleDownloadPOAsPdf(po)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 hover:bg-red-100 transition-colors"
                                title="Descargar PDF Oficial"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={async () => {
                                  if (!po.id) return
                                  try {
                                    const items = await api.purchases.getOrderItems(po.id)
                                    handleExportSinglePOToExcel(po, items || [])
                                  } catch (e: any) {
                                    toast.error("Error al obtener ítems", e.message)
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                                title="Descargar Planilla Excel (.xlsx)"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              </button>

                              {po.estado === "borrador" && po.id && (
                                <button
                                  onClick={() => handleConfirmPO(po.id!)}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors font-bold text-[10px] flex items-center gap-1"
                                  title="Confirmar Orden"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {po.estado === "confirmado" && po.id && (
                                <button
                                  onClick={() => handleSendPO(po.id!)}
                                  className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors font-bold text-[10px] flex items-center gap-1"
                                  title="Enviar a Proveedor"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {["confirmado", "enviada", "enviado", "parcial"].includes(po.estado || "") && (
                                <button
                                  onClick={() => handleOpenReceiptModal(po)}
                                  className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors font-bold text-[10px] flex items-center gap-1"
                                  title="Recibir en Muelle"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {po.estado === "borrador" && po.id && (
                                <button
                                  onClick={() => handleCancelPO(po.id!)}
                                  className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                                  title="Cancelar Orden"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {po.id && (
                                <button
                                  onClick={() => { setPoToDelete(po); setForceDeletePO(false); }}
                                  className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                  title="Eliminar Orden de Compra"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginador */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-mono">
                Mostrando {(pagePO - 1) * pageSizePO + 1} a {Math.min(pagePO * pageSizePO, filteredOrders.length)} de <strong>{filteredOrders.length}</strong> órdenes
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagePO <= 1}
                  onClick={() => setPagePO(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-gray-700 dark:text-gray-300 font-mono">
                  Página {pagePO} de {totalPagesPO}
                </span>
                <button
                  disabled={pagePO >= totalPagesPO}
                  onClick={() => setPagePO(p => Math.min(totalPagesPO, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 3: RECEPCIÓN EN MUELLE
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "recepciones" && (
        <div className="space-y-5">
          {lastReceiptForLabels && (
            <div className="card p-4 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                Recepción {lastReceiptForLabels.numero} registrada -- ¿imprimir las etiquetas de los productos recibidos?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/etiquetas?receipt_id=${lastReceiptForLabels.id}`)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                >
                  Imprimir Etiquetas de esta Recepción
                </button>
                <button onClick={() => setLastReceiptForLabels(null)} className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer">✕</button>
              </div>
            </div>
          )}
          <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" />
                Control de Recepción Física en Muelle & Lotes
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Historial de remisiones descargadas, verificación contra la orden de compra y control de vencimientos.
              </p>
            </div>
            <button
              onClick={() => handleOpenReceiptModal()}
              className="btn-primary text-xs flex items-center gap-2 px-4 py-2 shrink-0 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nueva Recepción
            </button>
          </div>

          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            {receipts.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400">
                <Truck className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                No hay recepciones físicas registradas aún.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      <th className="p-3">N° Recepción</th>
                      <th className="p-3">Proveedor</th>
                      <th className="p-3">N° Orden Compra</th>
                      <th className="p-3">Fecha Recepción</th>
                      <th className="p-3">N° Remisión / Factura</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Total Recibido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {receipts.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {r.numero || r.id.slice(0, 8)}
                        </td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white">
                          {r.supplier?.razon_social || r.orden?.supplier?.razon_social || "Proveedor"}
                        </td>
                        <td className="p-3 font-mono text-gray-700 dark:text-gray-300">
                          {r.orden?.numero || "—"}
                        </td>
                        <td className="p-3 text-gray-500">
                          {r.fecha ? formatDate(r.fecha) : formatDate(r.created_at || "")}
                        </td>
                        <td className="p-3 font-mono text-gray-600 dark:text-gray-300">
                          {r.proveedor_ref || "—"}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {r.estado || "recibido"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-gray-900 dark:text-white">
                          {formatPYG(r.total || 0)}
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
          TAB: FACTURAS DE PROVEEDORES (PROCURE-TO-PAY)
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "facturas_p2p" && (
        <div className="space-y-5">
          {/* BANNER DE INGESTA AUTOMÁTICA DE FACTURAS ELECTRÓNICAS SIFEN */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Panel de Conexión de Correo IMAP (cPanel) */}
            <div className="card p-4 bg-gradient-to-br from-indigo-900/10 via-white dark:via-slate-800 to-indigo-900/5 border-indigo-200 dark:border-indigo-800/60 lg:col-span-2 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      Buzón IMAP cPanel: {inboxConfig?.imap_user || "facturaelectronica@superextra.com.py"}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inboxConfig?.activo ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600"
                      }`}>
                        {inboxConfig?.activo ? "Activo" : "Sin configurar"}
                      </span>
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Ingesta automática y periódica de Facturas Electrónicas XML (SIFEN Paraguay) recibidas desde proveedores.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInboxConfigModal(true)}
                  className="btn-secondary text-xs px-3 py-1.5 shrink-0 flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Ajustes IMAP
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-gray-500 flex items-center gap-2 font-mono">
                  <span>Último sync: {inboxConfig?.ultimo_sync ? formatDate(inboxConfig.ultimo_sync) : "Nunca"}</span>
                  {inboxConfig?.ultimo_error && (
                    <span className="text-red-500 truncate max-w-xs" title={inboxConfig.ultimo_error}>
                      ⚠️ Error: {inboxConfig.ultimo_error}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSyncInboxNow}
                  disabled={syncingInbox}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingInbox ? "animate-spin" : ""}`} />
                  {syncingInbox ? "Sincronizando Correo..." : "Sincronizar Correo Ahora"}
                </button>
              </div>
            </div>

            {/* Zona de Carga Manual Drag & Drop de XML */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOverXml(true); }}
              onDragLeave={() => setDragOverXml(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverXml(false)
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleUploadXmlFile(e.dataTransfer.files[0])
                }
              }}
              className={`card p-4 border-2 border-dashed flex flex-col items-center justify-center text-center transition-all ${
                dragOverXml
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-white dark:bg-slate-800/90"
              }`}
            >
              <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-2">
                <input
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadXmlFile(e.target.files[0])
                    }
                  }}
                  disabled={uploadingXml}
                />
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-2 text-indigo-600">
                  {uploadingXml ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                </div>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  {uploadingXml ? "Procesando DTE..." : "Cargar Factura XML"}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5">
                  Arrastra tu archivo XML aquí o haz click para explorar
                </span>
              </label>
            </div>
          </div>

          {/* BARRA DE BÚSQUEDA Y FILTROS */}
          <div className="card p-4 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-500" />
                Cartera de Facturas de Proveedores — Procure-to-Pay ({allSupplierInvoices.length} Facturas)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Seguimiento del ciclo P2P: comprobantes recibidos, control estricto de Notas de Crédito y autorización de pago.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por N° factura o proveedor..."
                  value={searchInvoices}
                  onChange={(e) => { setSearchInvoices(e.target.value); setPageInvoices(1); }}
                  className="input-field pl-9 w-full text-xs"
                />
              </div>

              <select
                value={filterInvoiceStatus}
                onChange={(e) => { setFilterInvoiceStatus(e.target.value); setPageInvoices(1); }}
                className="input-field text-xs font-semibold"
              >
                <option value="todos">Todos los Estados</option>
                <option value="aprobada">Aprobadas para Pago</option>
                <option value="retenida_discrepancia">Retenidas por Discrepancia</option>
                <option value="pendiente">Pendientes de Conciliación</option>
                <option value="pagada">Pagadas</option>
              </select>
            </div>
          </div>

          {/* TABLA DE FACTURAS CON SEMÁFORO Y 3-WAY MATCH */}
          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            {paginatedInvoicesP2P.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                No se encontraron facturas con los filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs min-w-[950px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      <th className="p-3">N° Factura Fiscal</th>
                      <th className="p-3">Proveedor</th>
                      <th className="p-3">Emisión</th>
                      <th className="p-3">Vencimiento</th>
                      <th className="p-3 text-right">Total Factura</th>
                      <th className="p-3 text-right">Saldo a Pagar</th>
                      <th className="p-3 text-center">Control Tesorería</th>
                      <th className="p-3 text-center">Estado Fiscal</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {paginatedInvoicesP2P.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="font-mono font-bold text-gray-900 dark:text-white">
                            {inv.numero_factura || "S/N"}
                          </div>
                          {inv.cdc && (
                            <div className="text-[9px] font-mono text-indigo-500 truncate max-w-[140px]" title={inv.cdc}>
                              CDC: {inv.cdc}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-medium text-gray-700 dark:text-gray-300 line-clamp-1 max-w-[180px]" title={inv.supplier_nombre}>
                          {inv.supplier_nombre || "Proveedor"}
                        </td>
                        <td className="p-3 text-gray-500 font-mono">
                          {inv.fecha_emision ? formatDate(inv.fecha_emision) : "—"}
                        </td>
                        <td className="p-3 text-gray-500 font-mono">
                          {inv.fecha_vencimiento ? formatDate(inv.fecha_vencimiento) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-gray-900 dark:text-white">
                          {formatPYG(inv.total || 0)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {formatPYG(inv.saldo_pendiente || 0)}
                          {inv.monto_retenido_nc > 0 && (
                            <div className="text-[10px] text-red-500 font-normal">
                              Retenido NC: -{formatPYG(inv.monto_retenido_nc)}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {inv.bloqueada_para_pago || inv.estado === "retenida_discrepancia" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" title={inv.motivo_bloqueo || "Sin NC no hay pago"}>
                              <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" /> Bloqueada (Falta NC)
                            </span>
                          ) : inv.estado === "aprobada" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" /> Aprobada para Pago
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <Clock className="w-3 h-3 text-amber-600 shrink-0" /> Pendiente 3-Way
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            inv.estado === "pagada"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : inv.estado === "retenida_discrepancia"
                              ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : inv.estado === "aprobada"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}>
                            {inv.estado || "pendiente"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpen3WayMatch(inv.id)}
                            className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1 hover:text-indigo-600"
                            title="Auditar Orden vs Muelle vs Factura"
                          >
                            <Scale className="w-3.5 h-3.5 text-indigo-500" />
                            3-Way Match
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginador Facturas */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-mono">
                Mostrando {(pageInvoices - 1) * pageSizeInvoices + 1} a {Math.min(pageInvoices * pageSizeInvoices, filteredInvoicesP2P.length)} de <strong>{filteredInvoicesP2P.length}</strong> facturas
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pageInvoices <= 1}
                  onClick={() => setPageInvoices(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-gray-700 dark:text-gray-300 font-mono">
                  Página {pageInvoices} de {totalPagesInvoicesP2P}
                </span>
                <button
                  disabled={pageInvoices >= totalPagesInvoicesP2P}
                  onClick={() => setPageInvoices(p => Math.min(totalPagesInvoicesP2P, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB: DEVOLUCIONES Y NOTAS DE CRÉDITO (NEMUHA LEGACY)
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "devoluciones" && (
        <div className="space-y-5">
          <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-indigo-500" />
                Devoluciones a Proveedor & Notas de Crédito ({supplierReturns.length + supplierCreditNotes.length} Registros)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Historial de mercaderías devueltas por vencimiento, rotura o reclamos comerciales, y notas de crédito emitidas.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por comprobante, proveedor o motivo..."
                value={searchReturns}
                onChange={(e) => { setSearchReturns(e.target.value); setPageReturns(1); }}
                className="input-field pl-9 w-full text-xs"
              />
            </div>
          </div>

          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            {paginatedReturns.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400">
                <Undo2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                No hay devoluciones ni notas de crédito registradas.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      <th className="p-3">Tipo Registro</th>
                      <th className="p-3">N° Comprobante / NC</th>
                      <th className="p-3">Proveedor</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3 text-right">Monto (Gs.)</th>
                      <th className="p-3">Factura Origen</th>
                      <th className="p-3">Motivo / Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {paginatedReturns.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.tipo_registro === "devolucion"
                              ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          }`}>
                            {item.tipo_registro === "devolucion" ? "Devolución" : "Nota de Crédito"}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-gray-900 dark:text-white">
                          {item.numero_nota_credito || item.numero || "S/N"}
                        </td>
                        <td className="p-3 font-medium text-gray-700 dark:text-gray-300">
                          {item.supplier_nombre || "Proveedor"}
                        </td>
                        <td className="p-3 text-gray-500 font-mono">
                          {item.fecha ? formatDate(item.fecha) : formatDate(item.created_at || "")}
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                          {formatPYG(item.monto || 0)}
                        </td>
                        <td className="p-3 font-mono text-gray-500 text-[11px]">
                          {item.numero_factura_origen || "—"}
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-400 text-[11px] max-w-[250px] truncate" title={item.observaciones || item.motivo}>
                          {item.observaciones || item.motivo || "Ajuste comercial / devolución"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginador Devoluciones */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-mono">
                Mostrando {(pageReturns - 1) * pageSizeReturns + 1} a {Math.min(pageReturns * pageSizeReturns, filteredReturnsAndNC.length)} de <strong>{filteredReturnsAndNC.length}</strong> registros
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pageReturns <= 1}
                  onClick={() => setPageReturns(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-gray-700 dark:text-gray-300 font-mono">
                  Página {pageReturns} de {totalPagesReturns}
                </span>
                <button
                  disabled={pageReturns >= totalPagesReturns}
                  onClick={() => setPageReturns(p => Math.min(totalPagesReturns, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 4: 3-WAY MATCHING
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "matching" && (
        <div className="space-y-6">
          {/* Header Card con Política de Blindaje */}
          <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-500" />
                3-Way Matching: Conciliación Triple de Compras & Control de Pagos
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Auditoría cruzada matemática: <strong>Orden de Compra</strong> vs. <strong>Recepción en Muelle</strong> vs. <strong>Factura DTE SIFEN</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Regla Fiscal: Sin NC no hay pago
              </span>
            </div>
          </div>

          {/* KPIs Hero de Matching */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Facturas Bloqueadas / Discrepancia</span>
              <p className="text-xl font-black font-mono text-red-600 mt-1 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {allSupplierInvoices.filter(i => (i as any).bloqueada_para_pago || i.estado === "retenida_discrepancia").length}
              </p>
              <span className="text-[10px] text-gray-400">Excluidas de órdenes de pago</span>
            </div>

            <div className="card p-4 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Solicitudes de NC Pendientes</span>
              <p className="text-xl font-black font-mono text-amber-600 mt-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {supplierNcRequests.filter(r => r.estado === "pendiente").length}
              </p>
              <span className="text-[10px] text-gray-400">Esperando emisión del proveedor</span>
            </div>

            <div className="card p-4 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Monto Total Reclamado en NC</span>
              <p className="text-xl font-black font-mono text-indigo-600 mt-1">
                {formatPYG(supplierNcRequests.filter(r => r.estado === "pendiente").reduce((acc, r) => acc + Number(r.monto_reclamado || 0), 0))}
              </p>
              <span className="text-[10px] text-gray-400">Retenido en Tesorería</span>
            </div>

            <div className="card p-4 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Facturas Aprobadas (Sin Traba)</span>
              <p className="text-xl font-black font-mono text-emerald-600 mt-1 flex items-center gap-2">
                <Unlock className="w-4 h-4" />
                {allSupplierInvoices.filter(i => !(i as any).bloqueada_para_pago && i.estado === "aprobada").length}
              </p>
              <span className="text-[10px] text-gray-400">Habilitadas para Tesorería</span>
            </div>
          </div>

          {/* TABLA: SOLICITUDES DE NOTA DE CRÉDITO PENDIENTES */}
          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Solicitudes de Nota de Crédito Emitidas a Proveedores ({supplierNcRequests.length})
                </h4>
                <p className="text-[11px] text-gray-500">
                  Seguimiento de reclamos por faltante físico, roturas o sobreprecio facturado.
                </p>
              </div>
            </div>

            {supplierNcRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-60" />
                No hay solicitudes de Nota de Crédito pendientes ni discrepancias registradas.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-slate-100/70 dark:bg-slate-900/40 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">N° Solicitud</th>
                      <th className="p-3">Proveedor</th>
                      <th className="p-3">Factura Relacionada</th>
                      <th className="p-3">Motivo Reclamo</th>
                      <th className="p-3 text-right">Monto Reclamado</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {supplierNcRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {req.numero_solicitud}
                        </td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white">
                          {req.supplier?.razon_social || req.supplier?.nombre_fantasia || "Proveedor"}
                        </td>
                        <td className="p-3 font-mono text-gray-600 dark:text-gray-300">
                          {req.invoice?.numero_factura || "—"}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {req.tipo_motivo?.replace("_", " ").toUpperCase()}
                          </span>
                          {req.observaciones && (
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-xs">{req.observaciones}</p>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-red-600 dark:text-red-400">
                          {formatPYG(req.monto_reclamado || 0)}
                        </td>
                        <td className="p-3">
                          {req.estado === "recibida_aplicada" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <CheckCircle className="w-3 h-3 text-emerald-500" /> NC Recibida & Aplicada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                              <Clock className="w-3 h-3 text-rose-500" /> Pendiente NC Proveedor
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {req.estado === "pendiente" ? (
                            <button
                              onClick={() => handleOpenResolveNc(req)}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 ml-auto shadow-sm"
                            >
                              <FileCheck className="w-3.5 h-3.5" /> Registrar NC Recibida
                            </button>
                          ) : (
                            <span className="text-[11px] font-mono text-gray-400">
                              NC N° {req.nc_recibida_numero || "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* TABLA: FACTURAS FISCALES Y ESTADO 3-WAY MATCH */}
          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700/60 flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Auditoría Cruzada de Facturas ({allSupplierInvoices.length} Comprobantes Registrados)
              </h4>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-100/70 dark:bg-slate-900/40 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">N° Factura Fiscal</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3">Fecha Emisión</th>
                    <th className="p-3 text-right">Total Factura</th>
                    <th className="p-3 text-right">Saldo Pendiente</th>
                    <th className="p-3">Control de Tesorería</th>
                    <th className="p-3 text-center">Acción 3-Way Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {allSupplierInvoices.slice(0, 20).map(inv => {
                    const isBlocked = (inv as any).bloqueada_para_pago || inv.estado === "retenida_discrepancia"
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-3">
                          <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {inv.numero_factura}
                          </div>
                          {(inv as any).xml_sifen_url && (
                            <span className="text-[10px] text-teal-600 font-mono flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" /> DTE SIFEN XML
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white">
                          {inv.supplier_nombre || "Proveedor"}
                        </td>
                        <td className="p-3 text-gray-500">
                          {inv.fecha_emision ? formatDate(inv.fecha_emision) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-gray-900 dark:text-white">
                          {formatPYG(inv.total || 0)}
                        </td>
                        <td className="p-3 text-right font-mono text-red-600 dark:text-red-400">
                          {formatPYG(inv.saldo_pendiente || 0)}
                        </td>
                        <td className="p-3">
                          {isBlocked ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                                <Lock className="w-3 h-3 text-rose-500" /> PAGO BLOQUEADO
                              </span>
                              {(inv as any).motivo_bloqueo && (
                                <span className="text-[10px] text-rose-500 max-w-[200px] truncate">
                                  {(inv as any).motivo_bloqueo}
                                </span>
                              )}
                            </div>
                          ) : inv.estado === "aprobada" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <Unlock className="w-3 h-3 text-emerald-500" /> Habilitada Pago
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              <Clock className="w-3 h-3 text-amber-500" /> Pendiente Conciliación
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleOpen3WayMatch(inv.id)}
                            className="px-3 py-1 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Scale className="w-3.5 h-3.5" /> Auditar Match
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 5: PROVEEDORES & SCORECARD
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "proveedores" && (
        <div className="space-y-5">
          <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                Directorio de Proveedores & Scorecard OTIF ({suppliers.length} Proveedores)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Plazos comerciales, cumplimiento de entrega, condiciones de pago y contacto.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre o RUC..."
                value={searchSupplier}
                onChange={(e) => { setSearchSupplier(e.target.value); setPageSupplier(1); }}
                className="input-field pl-9 w-full text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedSuppliers.map(s => (
              <div key={s.id} className="card p-5 hover:shadow-md transition-shadow space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1" title={s.razon_social}>
                      {s.razon_social}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0">
                      Activo
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1 font-mono">
                    <div>RUC: <strong className="text-gray-700 dark:text-gray-300">{s.ruc || "—"}</strong></div>
                    <div>Plazo de Pago: <strong className="text-indigo-600">{s.plazo_pago_dias || 30} Días</strong></div>
                    {s.telefono && <div className="flex items-center gap-1 text-[11px]"><Phone className="w-3 h-3" /> {s.telefono}</div>}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-gray-500">Scorecard: </span>
                    <span className="font-bold font-mono text-emerald-600 text-xs">
                      {s.rating ? `${Number(s.rating).toFixed(1)} ★` : "4.8 ★"}
                    </span>
                  </div>
                  <button
                    onClick={() => openSupplier360(s)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ficha 360°
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-4 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-mono">
              Mostrando {(pageSupplier - 1) * pageSizeSupplier + 1} a {Math.min(pageSupplier * pageSizeSupplier, filteredSuppliers.length)} de <strong>{filteredSuppliers.length}</strong> proveedores
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pageSupplier <= 1}
                onClick={() => setPageSupplier(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-gray-700 dark:text-gray-300 font-mono">
                Página {pageSupplier} de {totalPagesSupplier}
              </span>
              <button
                disabled={pageSupplier >= totalPagesSupplier}
                onClick={() => setPageSupplier(p => Math.min(totalPagesSupplier, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 6: REQUISICIONES INTERNAS
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "requisiciones" && (
        <div className="space-y-5">
          <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-500" />
                Requisiciones Internas de Reposición por Sector
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Solicitudes de compra generadas desde Carnicería, Fiambrería, Panadería, Verdulería y Salón.
              </p>
            </div>
            <button
              onClick={() => setShowReqModal(true)}
              className="btn-primary text-xs flex items-center gap-2 px-4 py-2 shrink-0 shadow-sm"
            >
              <Plus className="w-4 h-4" /> + Nueva Requisición
            </button>
          </div>

          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            {requisitions.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                No hay requisiciones internas pendientes.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">N° Requisición</th>
                      <th className="p-3">Departamento / Sector</th>
                      <th className="p-3">Solicitante</th>
                      <th className="p-3">Fecha Solicitud</th>
                      <th className="p-3">Prioridad</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Total Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {requisitions.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.numero}</td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{r.departamento || "Supermercado"}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">{r.solicitante_nombre || "Encargado"}</td>
                        <td className="p-3 text-gray-500">{formatDate(r.fecha)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.prioridad === "urgente" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                          }`}>
                            {r.prioridad || "normal"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                            {r.estado}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-gray-900 dark:text-white">
                          {formatPYG(r.total || 0)}
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
          TAB 7: COTIZACIONES (RFQ)
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "cotizaciones" && (
        <div className="space-y-5">
          <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
              Cotizaciones Comparativas (RFQ)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Comparación de listas de precios entre distribuidores y adjudicación por menor costo.
            </p>
          </div>

          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            {rfqs.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400">
                <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                No hay procesos de cotización abiertos en este momento.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">N° Cotización</th>
                      <th className="p-3">Fecha Límite</th>
                      <th className="p-3">Motivo</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {rfqs.map(rfq => (
                      <tr key={rfq.id}>
                        <td className="p-3 font-mono font-bold text-indigo-600">{rfq.numero}</td>
                        <td className="p-3 font-mono">{rfq.fecha_limite ? formatDate(rfq.fecha_limite) : "—"}</td>
                        <td className="p-3">{rfq.motivo || "Cotización de Compras"}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">{rfq.estado}</span></td>
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
          TAB 8: PRESUPUESTOS DE COMPRA
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "presupuestos" && (
        <div className="space-y-5">
          <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              Presupuesto Mensual de Compras vs Gasto Real Ejecutado
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Control de ejecución presupuestaria por categoría de Supermercado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgetConsumptions.length > 0 ? (
              budgetConsumptions.map((b, i) => (
                <div key={i} className="card p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">{b.nombre}</h4>
                    <span className="font-mono text-xs font-bold text-indigo-600">{b.porcentaje_ejecutado}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, b.porcentaje_ejecutado)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-400">Ejecutado: {formatPYG(b.monto_ejecutado)}</span>
                    <span className="text-gray-600 dark:text-gray-300 font-bold">Total: {formatPYG(b.monto_presupuestado)}</span>
                  </div>
                </div>
              ))
            ) : (
              [
                { cat: "Lácteos & Refrigerados", ejec: 45000000, total: 60000000 },
                { cat: "Bebidas & Cervezas", ejec: 82000000, total: 100000000 },
                { cat: "Carnicería & Aves", ejec: 95000000, total: 110000000 },
                { cat: "Almacén & Canasta Básica", ejec: 120000000, total: 150000000 },
                { cat: "Frutas & Verdulería", ejec: 28000000, total: 35000000 },
                { cat: "Artículos de Limpieza", ejec: 34000000, total: 45000000 },
              ].map((b, idx) => {
                const pct = Math.round((b.ejec / b.total) * 100)
                return (
                  <div key={idx} className="card p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">{b.cat}</h4>
                      <span className="font-mono text-xs font-bold text-indigo-600">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-400">Ejecutado: {formatPYG(b.ejec)}</span>
                      <span className="text-gray-600 dark:text-gray-300 font-bold">Límite: {formatPYG(b.total)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 9: REPORTES & PRECIOS
      ────────────────────────────────────────────────────────────────────────── */}
      {tab === "reportes" && (
        <div className="space-y-5">
          <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-500" />
              Análisis de Varianza de Precios & Concentración de Gasto
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Auditoría de variaciones de costo en compras y distribución del volumen por proveedor.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>Top Proveedores por Gasto Acumulado</span>
                <Building2 className="w-4 h-4 text-indigo-500" />
              </h4>
              <div className="space-y-2">
                {spendBySupplier.slice(0, 7).map((s, i) => (
                  <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-xs">
                    <div className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-xs">{s.razon_social}</div>
                    <div className="font-mono font-extrabold text-indigo-600">{formatPYG(s.total_gastado)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 flex items-center justify-between">
                <span>Varianza de Costos por Producto</span>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </h4>
              <div className="space-y-2">
                {priceVariance.slice(0, 7).map((pv, i) => (
                  <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-xs">
                    <div className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-xs">{pv.nombre}</div>
                    <div className="font-mono font-bold text-amber-600">±{Number(pv.variance_pct).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: DIVISIÓN Y EMISIÓN DE ÓRDENES DE COMPRA POR PROVEEDOR (MULTI-PROVEEDOR)
      ────────────────────────────────────────────────────────────────────────── */}
      {showGenerateModal && (() => {
        const itemsToOrder = (replenishmentData?.items || []).filter(
          (it: any) => selectedItemsIA[it.product_id] && (editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida) > 0
        )

        // Agrupación por proveedor asignado
        const groups: Record<string, { supplier?: Supplier; items: any[]; total: number; totalUnits: number }> = {}
        itemsToOrder.forEach((it: any) => {
          const supId = itemAssignedSupplier[it.product_id] || "unassigned"
          if (!groups[supId]) {
            const supObj = suppliers.find(s => s.id === supId)
            groups[supId] = { supplier: supObj, items: [], total: 0, totalUnits: 0 }
          }
          const qty = Number(editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida)
          const cost = Number(editedCosts[it.product_id] !== undefined ? editedCosts[it.product_id] : (it.costo_unitario_estimado || 0))
          groups[supId].items.push(it)
          groups[supId].total += qty * cost
          groups[supId].totalUnits += qty
        })

        const groupKeys = Object.keys(groups)
        const validGroupKeys = groupKeys.filter(k => k !== "unassigned")
        const hasUnassigned = groupKeys.includes("unassigned")
        const activeGroupKeys = validGroupKeys.filter(k => includedSuppliers[k] !== false)

        const totalActiveAmount = activeGroupKeys.reduce((acc, k) => acc + (groups[k]?.total || 0), 0)
        const totalActiveItems = activeGroupKeys.reduce((acc, k) => acc + (groups[k]?.items.length || 0), 0)
        const totalActiveUnits = activeGroupKeys.reduce((acc, k) => acc + (groups[k]?.totalUnits || 0), 0)

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-700 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header Modal */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                      División y Emisión de Órdenes por Proveedor
                      {validGroupKeys.length > 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {validGroupKeys.length} Proveedores Detectados
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Revisá la división de productos por proveedor, reasigná ítems según convenga o emití múltiples OC simultáneas.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Barra de Herramientas de Asignación Rápida */}
              <div className="px-4 sm:px-5 py-3 bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    📦 <strong className="font-mono">{itemsToOrder.length}</strong> productos seleccionados
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button
                    type="button"
                    onClick={handleResetToLastSuppliers}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800 shadow-2xs hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                    title="Restablece cada producto a su último proveedor habitual de compra"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Restablecer a últimos proveedores
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">Asignar todos a:</span>
                  <select
                    value={globalApplySupplierId}
                    onChange={(e) => setGlobalApplySupplierId(e.target.value)}
                    className="input-field py-1 px-2 text-xs font-semibold bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 max-w-[220px]"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.razon_social}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleApplyGlobalSupplier}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-colors"
                  >
                    Aplicar a todos
                  </button>
                </div>
              </div>

              {/* Contenido con Scroll: Divisiones por Proveedor */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                {/* Alerta de productos sin proveedor asignado */}
                {hasUnassigned && (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <strong className="block font-bold">Hay {groups["unassigned"].items.length} productos sin proveedor asignado</strong>
                      <span>Seleccioná el proveedor destino en cada producto para poder emitir la orden correspondiente.</span>
                    </div>
                  </div>
                )}

                {/* Cards por Proveedor */}
                {groupKeys.map(supId => {
                  const grp = groups[supId]
                  const isUnassigned = supId === "unassigned"
                  const isIncluded = isUnassigned ? false : includedSuppliers[supId] !== false
                  const supName = isUnassigned ? "Productos Sin Proveedor Asignado" : (grp.supplier?.razon_social || "Proveedor")
                  const supRuc = grp.supplier?.ruc
                  const settings = supplierOrderSettings[supId] || {
                    fecha_entrega_estimada: new Date().toISOString().split("T")[0],
                    condiciones_pago: "30 Días",
                    prioridad: "normal",
                    observaciones: "",
                  }

                  return (
                    <div
                      key={supId}
                      className={`rounded-2xl border transition-all ${
                        isUnassigned
                          ? "border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/10"
                          : isIncluded
                          ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 shadow-xs"
                          : "border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-60"
                      }`}
                    >
                      {/* Cabecera de la División */}
                      <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-t-2xl">
                        <div className="flex items-center gap-3">
                          {!isUnassigned ? (
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              onChange={(e) => setIncludedSuppliers(prev => ({ ...prev, [supId]: e.target.checked }))}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                              title="Marcar para emitir esta orden"
                            />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-indigo-500" />
                                {supName}
                              </h4>
                              {supRuc && (
                                <span className="text-[11px] font-mono text-gray-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                  RUC: {supRuc}
                                </span>
                              )}
                              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/50 px-2 py-0.2 rounded-full">
                                {grp.items.length} {grp.items.length === 1 ? "ítem" : "ítems"} ({grp.totalUnits.toLocaleString()} un.)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Subtotal OC</span>
                          <span className="font-mono font-extrabold text-sm sm:text-base text-gray-900 dark:text-white">
                            {formatPYG(grp.total)}
                          </span>
                        </div>
                      </div>

                      {/* Parámetros de la OC para este proveedor */}
                      {!isUnassigned && isIncluded && (
                        <div className="p-3 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">Entrega Esperada</label>
                            <input
                              type="date"
                              value={settings.fecha_entrega_estimada}
                              onChange={(e) => {
                                const val = e.target.value
                                setSupplierOrderSettings(prev => ({
                                  ...prev,
                                  [supId]: { ...(prev[supId] || settings), fecha_entrega_estimada: val }
                                }))
                              }}
                              className="input-field w-full py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">Condición de Pago</label>
                            <select
                              value={settings.condiciones_pago}
                              onChange={(e) => {
                                const val = e.target.value
                                setSupplierOrderSettings(prev => ({
                                  ...prev,
                                  [supId]: { ...(prev[supId] || settings), condiciones_pago: val }
                                }))
                              }}
                              className="input-field w-full py-1 text-xs font-semibold"
                            >
                              <option value="Contado">Contado</option>
                              <option value="15 Días">Crédito 15 Días</option>
                              <option value="30 Días">Crédito 30 Días</option>
                              <option value="60 Días">Crédito 60 Días</option>
                              <option value="90 Días">Crédito 90 Días</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">Prioridad</label>
                            <select
                              value={settings.prioridad}
                              onChange={(e) => {
                                const val = e.target.value
                                setSupplierOrderSettings(prev => ({
                                  ...prev,
                                  [supId]: { ...(prev[supId] || settings), prioridad: val }
                                }))
                              }}
                              className="input-field w-full py-1 text-xs font-semibold"
                            >
                              <option value="normal">Normal</option>
                              <option value="urgente">Urgente (Quiebre)</option>
                              <option value="baja">Baja / Rutinaria</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Lista de Productos en esta OC */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/90 dark:bg-slate-900/60 text-gray-400 font-bold uppercase text-[9px] tracking-wider border-b border-slate-100 dark:border-slate-700/60">
                            <tr>
                              <th className="p-2.5 min-w-[200px]">Producto</th>
                              <th className="p-2.5 text-right">Cantidad</th>
                              <th className="p-2.5 text-right">Costo Unit.</th>
                              <th className="p-2.5 text-right">Subtotal</th>
                              <th className="p-2.5 min-w-[190px]">Reasignar Proveedor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 font-mono">
                            {grp.items.map((it: any) => {
                              const qty = Number(editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : it.cantidad_sugerida)
                              const cost = Number(editedCosts[it.product_id] !== undefined ? editedCosts[it.product_id] : (it.costo_unitario_estimado || 0))
                              const subtotal = qty * cost

                              return (
                                <tr key={it.product_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/20">
                                  <td className="p-2.5 font-sans font-medium text-gray-800 dark:text-gray-200">
                                    <div className="font-bold truncate max-w-[240px]" title={it.nombre}>
                                      {it.nombre}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono">
                                      SKU: {it.sku || "—"} | {it.unidad_medida}
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                    {qty.toLocaleString()}
                                  </td>
                                  <td className="p-2.5 text-right text-gray-600 dark:text-gray-300">
                                    {formatPYG(cost)}
                                  </td>
                                  <td className="p-2.5 text-right font-extrabold text-gray-900 dark:text-white">
                                    {formatPYG(subtotal)}
                                  </td>
                                  <td className="p-2 font-sans">
                                    <select
                                      value={itemAssignedSupplier[it.product_id] || ""}
                                      onChange={(e) => {
                                        const newSup = e.target.value
                                        setItemAssignedSupplier(prev => ({ ...prev, [it.product_id]: newSup }))
                                        if (newSup && !includedSuppliers[newSup]) {
                                          setIncludedSuppliers(prev => ({ ...prev, [newSup]: true }))
                                        }
                                      }}
                                      className="input-field py-1 px-2 text-[11px] font-semibold w-full bg-white dark:bg-slate-800"
                                    >
                                      <option value="">Seleccione Proveedor...</option>
                                      {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>
                                          {s.razon_social} {s.id === it.ultimo_proveedor_id ? "★ (Último)" : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer Modal con Totales y Acción */}
              <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Órdenes a Generar</span>
                    <span className="font-extrabold font-mono text-indigo-600 dark:text-indigo-400 text-sm">
                      {activeGroupKeys.length} {activeGroupKeys.length === 1 ? "Orden" : "Órdenes"}
                    </span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Ítems</span>
                    <span className="font-bold font-mono text-gray-700 dark:text-gray-300 text-sm">
                      {totalActiveItems} prod. ({totalActiveUnits.toLocaleString()} un.)
                    </span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Monto Global</span>
                    <span className="font-extrabold font-mono text-gray-900 dark:text-white text-base">
                      {formatPYG(totalActiveAmount)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreatePOFromReplenishment}
                    disabled={generatingPO || activeGroupKeys.length === 0 || hasUnassigned}
                    className="btn-primary text-xs flex items-center gap-2 px-6 py-2.5 font-bold shadow-md disabled:opacity-50"
                  >
                    {generatingPO ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-4 h-4" />
                    )}
                    {generatingPO
                      ? "Emitiendo Órdenes..."
                      : activeGroupKeys.length > 1
                      ? `🚀 Emitir ${activeGroupKeys.length} Órdenes de Compra Separadas`
                      : "Emitir Orden de Compra"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: DETALLE DE ORDEN DE COMPRA
      ────────────────────────────────────────────────────────────────────────── */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #po-premium-sheet, #po-premium-sheet * {
                visibility: visible !important;
              }
              #po-premium-sheet {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 10mm 15mm !important;
                background: white !important;
                color: #111827 !important;
                box-shadow: none !important;
                border: none !important;
                z-index: 999999 !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full p-6 border border-slate-200 dark:border-slate-700 space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Barra de herramientas superior del modal (no-print) */}
            <div className="no-print flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white tracking-wider uppercase">
                  Reporte Premium de Orden de Compra
                </span>
                <span className="text-xs font-mono font-bold text-gray-500">
                  #{selectedPO.numero}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPO}
                  className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 font-bold shadow-xs hover:bg-slate-100"
                  title="Imprimir documento en formato A4 membretado"
                >
                  <Printer className="w-4 h-4 text-indigo-600" /> Imprimir A4
                </button>

                <button
                  onClick={() => handleDownloadPOAsPdf(selectedPO)}
                  className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 font-bold text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/60 hover:bg-red-50"
                  title="Descargar archivo PDF oficial con timbrado"
                >
                  <Download className="w-4 h-4 text-red-600" /> Descargar PDF
                </button>

                <button
                  onClick={() => handleExportSinglePOToExcel(selectedPO, poDetailItems)}
                  className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 font-bold text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50"
                  title="Descargar planilla en formato Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Excel
                </button>

                <button
                  onClick={() => setSelectedPO(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400 ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingPODetail ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* ── HOJA MEMBRETADA PREMIUM DE LA ORDEN DE COMPRA (#po-premium-sheet) ── */}
                <div id="po-premium-sheet" className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 text-gray-900 dark:text-gray-100 shadow-sm print:shadow-none print:border-0 print:p-0">
                  {/* Encabezado Institucional Oficial */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-indigo-600 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm tracking-wider">
                          EX
                        </div>
                        <div>
                          <h2 className="text-base font-black uppercase tracking-tight text-gray-900 dark:text-white leading-tight">
                            Extra Supermercado Mayorista
                          </h2>
                          <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            GRUPO SANTA TERESA E.A.S.
                          </p>
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5 pt-1">
                        <div><strong>RUC:</strong> 80150377-9 | <strong>Timbrado:</strong> 18545636</div>
                        <div>Av. Santa Teresa c/ Av. Mcal. López — Fernando de la Mora, Paraguay</div>
                        <div>Tel: (021) 680-000 | Email: compras@superextra.com.py</div>
                      </div>
                    </div>

                    <div className="sm:text-right space-y-1 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 min-w-[220px]">
                      <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">
                        Orden de Compra Oficial
                      </span>
                      <div className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                        N° {selectedPO.numero}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Fecha: <strong>{selectedPO.fecha ? formatDate(selectedPO.fecha) : formatDate(selectedPO.created_at || "")}</strong>
                      </div>
                      <div className="text-[11px]">
                        Estado: <strong className="uppercase font-bold">{poStatusMap[selectedPO.estado || ""]?.label || selectedPO.estado}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Ficha Proveedor & Ficha de la Orden en 2 Columnas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <div className="font-bold uppercase tracking-wider text-[10px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-1">
                        <Building2 className="w-3.5 h-3.5" /> Datos del Proveedor
                      </div>
                      <div><strong>Razón Social:</strong> {selectedPO.supplier?.razon_social || "Sin Asignar"}</div>
                      <div><strong>RUC:</strong> {selectedPO.supplier?.ruc || "—"}</div>
                      <div><strong>Teléfono:</strong> {selectedPO.supplier?.telefono || "—"}</div>
                      <div><strong>Contacto / Email:</strong> {selectedPO.supplier?.email || selectedPO.supplier?.contacto_nombre || "—"}</div>
                      <div><strong>Dirección:</strong> {selectedPO.supplier?.direccion || "—"}</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                      <div className="font-bold uppercase tracking-wider text-[10px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-1">
                        <FileCheck className="w-3.5 h-3.5" /> Condiciones de Adquisición
                      </div>
                      <div><strong>Fecha de Entrega:</strong> {selectedPO.fecha_entrega_estimada ? formatDate(selectedPO.fecha_entrega_estimada) : "Inmediata / A convenir"}</div>
                      <div><strong>Condición de Pago:</strong> {selectedPO.condiciones_pago || "30 Días"}</div>
                      <div><strong>Moneda:</strong> {selectedPO.moneda || "PYG"} (Guaraníes)</div>
                      <div><strong>Comprador Responsable:</strong> {selectedPO.created_by_name || "Departamento de Compras"}</div>
                      <div><strong>Prioridad:</strong> <span className="capitalize font-bold">{selectedPO.prioridad || "Normal"}</span></div>
                    </div>
                  </div>

                  {/* Tabla Itemizada de Productos */}
                  <div className="overflow-x-auto w-full border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-left text-xs min-w-[650px]">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-2.5 text-center w-8">#</th>
                          <th className="p-2.5 w-24">Cód. Interno</th>
                          <th className="p-2.5 w-32">Cód. Barra</th>
                          <th className="p-2.5">Descripción del Producto</th>
                          <th className="p-2.5 text-right w-20">Cantidad</th>
                          <th className="p-2.5 text-right w-20">Recibido</th>
                          <th className="p-2.5 text-right w-28">Precio Unit. (IVA Inc.)</th>
                          <th className="p-2.5 text-center w-16">IVA %</th>
                          <th className="p-2.5 text-right w-32">Subtotal (IVA Inc.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {poDetailItems.map((it: any, idx) => {
                          const cant = Number(it.cantidad || 0)
                          const prec = Number(it.precio_unitario || 0)
                          const sub = Number(it.total || it.subtotal || (cant * prec))
                          const isEven = idx % 2 === 0
                          return (
                            <tr
                              key={idx}
                              className={`transition-colors duration-150 border-b border-slate-100 dark:border-slate-800/60 ${
                                isEven ? "bg-white dark:bg-slate-900" : "bg-slate-100/70 dark:bg-slate-800/50"
                              } hover:!bg-slate-200 dark:hover:!bg-slate-700 hover:shadow-sm`}
                            >
                              <td className="p-2.5 text-center font-mono text-gray-400">{idx + 1}</td>
                              <td className="p-2.5 font-mono text-gray-700 dark:text-gray-300 font-semibold">
                                {it.sku || it.producto?.sku || "—"}
                              </td>
                              <td className="p-2.5 font-mono text-gray-500">
                                {it.codigo_barra || it.producto?.codigo_barra || "—"}
                              </td>
                              <td className="p-2.5 font-semibold text-gray-900 dark:text-white">
                                {it.producto?.nombre || it.descripcion || "Ítem"}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold">
                                {cant.toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right font-mono text-emerald-600 font-bold">
                                {Number(it.recibido || it.cantidad_recibida || 0).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right font-mono">
                                {formatPYG(prec)}
                              </td>
                              <td className="p-2.5 text-center font-mono text-gray-500">
                                {it.iva_tasa || 10}%
                              </td>
                              <td className="p-2.5 text-right font-mono font-black text-gray-900 dark:text-white">
                                {formatPYG(sub)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Liquidación Impositiva & Total de la Orden */}
                  {(() => {
                    let sub10 = 0
                    let sub5 = 0
                    let subEx = 0
                    poDetailItems.forEach((it: any) => {
                      const sub = Number(it.total || it.subtotal || (Number(it.cantidad || 0) * Number(it.precio_unitario || 0)))
                      const tasa = Number(it.iva_tasa || 10)
                      if (tasa === 10) sub10 += sub
                      else if (tasa === 5) sub5 += sub
                      else subEx += sub
                    })
                    const iva10 = Math.round(sub10 / 11)
                    const iva5 = Math.round(sub5 / 21)

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                        <div className="space-y-1 text-gray-600 dark:text-gray-400">
                          <div className="font-bold text-[10px] uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            Liquidación Impositiva del IVA (Incluido en Total)
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                            <div>Gravadas 10%: <strong className="font-mono text-gray-800 dark:text-gray-200">{formatPYG(sub10 - iva10)}</strong></div>
                            <div>IVA 10% (Incluido): <strong className="font-mono text-gray-800 dark:text-gray-200">{formatPYG(iva10)}</strong></div>
                            <div>Gravadas 5%: <strong className="font-mono text-gray-800 dark:text-gray-200">{formatPYG(sub5 - iva5)}</strong></div>
                            <div>IVA 5% (Incluido): <strong className="font-mono text-gray-800 dark:text-gray-200">{formatPYG(iva5)}</strong></div>
                            <div>Exentas: <strong className="font-mono text-gray-800 dark:text-gray-200">{formatPYG(subEx)}</strong></div>
                          </div>
                          {selectedPO.observaciones && (
                            <div className="text-[11px] pt-2 border-t border-slate-200 dark:border-slate-700 text-gray-600">
                              <strong>Instrucciones:</strong> {selectedPO.observaciones}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col justify-center sm:text-right border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 md:pl-4 space-y-1">
                          <div className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                            Monto Total de la Orden de Compra (IVA Incluido)
                          </div>
                          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                            {formatPYG(selectedPO.total || 0)}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono">
                            {poDetailItems.length} ítems adjudicados | Condición: {selectedPO.condiciones_pago || "30 Días"}
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Firmas y Autorizaciones Institucionales */}
                  <div className="pt-8 grid grid-cols-3 gap-6 text-center text-[11px] text-gray-500">
                    <div>
                      <div className="border-t border-slate-400 dark:border-slate-600 pt-1.5 font-bold text-gray-800 dark:text-gray-200">
                        {selectedPO.created_by_name || "Departamento de Compras"}
                      </div>
                      <div className="text-[10px] text-gray-400">Elaborado por (Comprador)</div>
                    </div>
                    <div>
                      <div className="border-t border-slate-400 dark:border-slate-600 pt-1.5 font-bold text-gray-800 dark:text-gray-200">
                        Gerencia de Compras & Finanzas
                      </div>
                      <div className="text-[10px] text-gray-400">Aprobado y Autorizado</div>
                    </div>
                    <div>
                      <div className="border-t border-slate-400 dark:border-slate-600 pt-1.5 font-bold text-gray-800 dark:text-gray-200">
                        {selectedPO.supplier?.razon_social || "Proveedor"}
                      </div>
                      <div className="text-[10px] text-gray-400">Recibido Conforme (Firma y Sello)</div>
                    </div>
                  </div>
                </div>

                {/* Acciones operativas inferiores del modal (no-print) */}
                <div className="no-print flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/60">
                  {selectedPO.id && (
                    <button
                      onClick={() => {
                        const target = selectedPO
                        setPoToDelete(target)
                        setForceDeletePO(false)
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center gap-1.5 transition-colors"
                      title="Eliminar esta Orden"
                    >
                      <Trash2 className="w-4 h-4" /> Eliminar Orden
                    </button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    {["borrador", "confirmado", "enviada", "enviado"].includes(selectedPO.estado || "") && selectedPO.id && (
                      <button
                        onClick={() => {
                          const target = selectedPO
                          setSelectedPO(null)
                          handleEditPO(target)
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1.5 transition-colors border border-blue-200 dark:border-blue-800/60"
                        title="Modificar ítems, cantidades o costos de esta Orden"
                      >
                        <Edit className="w-4 h-4" /> Modificar Orden
                      </button>
                    )}
                    {selectedPO.estado === "borrador" && selectedPO.id && (
                      <button
                        onClick={() => handleConfirmPO(selectedPO.id!)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" /> Confirmar Orden
                      </button>
                    )}
                    {selectedPO.estado === "confirmado" && selectedPO.id && (
                      <button
                        onClick={() => handleSendPO(selectedPO.id!)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                      >
                        <Send className="w-4 h-4" /> Enviar a Proveedor
                      </button>
                    )}
                    {["confirmado", "enviada", "enviado", "parcial"].includes(selectedPO.estado || "") && (
                      <button
                        onClick={() => {
                          const target = selectedPO
                          setSelectedPO(null)
                          handleOpenReceiptModal(target)
                        }}
                        className="btn-primary text-xs flex items-center gap-1.5 px-4 py-2 shadow-sm"
                      >
                        <Truck className="w-4 h-4" /> Recibir en Muelle
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedPO(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-gray-700 dark:text-gray-300"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: RECEPCIÓN EN MUELLE CON LOTES Y VENCIMIENTOS
      ────────────────────────────────────────────────────────────────────────── */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-4xl w-full p-6 border border-slate-200 dark:border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" /> Registro de Recepción Física en Muelle
              </h3>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReceipt} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    N° de Remisión / Factura Chofer
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 001-001-0045892"
                    value={receiptForm.proveedor_ref}
                    onChange={(e) => setReceiptForm(prev => ({ ...prev, proveedor_ref: e.target.value }))}
                    className="input-field w-full text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Notas de Muelle / Estado Camión
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Descarga completa, temperatura óptima (4°C)..."
                    value={receiptForm.observaciones}
                    onChange={(e) => setReceiptForm(prev => ({ ...prev, observaciones: e.target.value }))}
                    className="input-field w-full text-xs"
                  />
                </div>
              </div>

              {/* Barra de Adición Extraordinaria en Muelle */}
              <div className="p-3 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-amber-600" />
                    ¿Llegó mercadería física fuera de la Orden de Compra? (Adición Extraordinaria)
                  </span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400">
                    Requiere motivo de autorización explícito para auditoría
                  </span>
                </div>

                <div className="relative">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar producto por nombre o código de barra para agregar al muelle..."
                      value={extraordinarySearch}
                      onChange={(e) => handleSearchExtraordinary(e.target.value)}
                      className="input-field w-full pl-9 text-xs bg-white dark:bg-slate-900"
                    />
                    {searchingExtraordinary && (
                      <Loader2 className="w-4 h-4 text-indigo-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {extraordinaryResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {extraordinaryResults.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleAddExtraordinaryItem(p)}
                          className="p-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <span className="font-bold text-gray-900 dark:text-white">{p.nombre}</span>
                            <span className="text-[10px] text-gray-400 ml-2 font-mono">{p.codigo_barra || p.sku}</span>
                          </div>
                          <span className="text-amber-600 font-bold text-xs flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Agregar
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto w-full border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left text-xs min-w-[750px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5 text-right w-20">Pedido</th>
                      <th className="p-2.5 w-40">Presentación</th>
                      <th className="p-2.5 text-right w-24">Cantidad</th>
                      <th className="p-2.5 text-right w-24">Total (Un.)</th>
                      <th className="p-2.5 w-28">N° Lote</th>
                      <th className="p-2.5 w-32">Vencimiento</th>
                      <th className="p-2.5 text-right w-24">Rechazo</th>
                      <th className="p-2.5 w-32">Motivo Rechazo</th>
                      <th className="p-2.5 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {receiptForm.items.map((it, idx) => (
                      <tr key={idx} className={it.es_extraordinario ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="font-bold text-gray-800 dark:text-gray-200">{it.nombre}</div>
                            {it.es_extraordinario && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                                EXTRAORDINARIO
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">SKU: {it.sku || "—"}</div>
                          {it.es_extraordinario && (
                            <div className="mt-1">
                              <input
                                type="text"
                                placeholder="Motivo de autorización de ingreso fuera de OC *"
                                value={it.autorizacion_motivo || ""}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setReceiptForm(prev => {
                                    const copy = [...prev.items]
                                    copy[idx].autorizacion_motivo = val
                                    return { ...prev, items: copy }
                                  })
                                }}
                                className="input-field w-full p-1 text-[11px] border-amber-300 dark:border-amber-700 bg-amber-50/60 text-amber-900 dark:text-amber-200"
                                required
                              />
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-gray-600 dark:text-gray-300">
                          {it.cantidad_ordenada.toLocaleString()}
                        </td>
                        <td className="p-2.5">
                          <select
                            value={it.presentacion_id}
                            onChange={(e) => handleReceiptPresentationChange(idx, e.target.value)}
                            className="input-field w-full p-1 text-xs"
                          >
                            <option value="">Unidad suelta</option>
                            {(packBarcodesByProduct.get(it.product_id) || []).map(pb => (
                              <option key={pb.id} value={pb.id}>
                                {pb.etiqueta} (x{pb.unidades_por_paquete})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min={0}
                            value={it.cantidad_presentacion}
                            onChange={(e) => handleReceiptCantidadPresentacionChange(idx, Number(e.target.value))}
                            className="input-field w-20 p-1 text-right font-mono font-bold text-xs"
                            required
                          />
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-gray-600 dark:text-gray-300">
                          {it.cantidad_recibir.toLocaleString()}
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            placeholder="LOT-2026"
                            value={it.lote}
                            onChange={(e) => {
                              const val = e.target.value
                              setReceiptForm(prev => {
                                const copy = [...prev.items]
                                copy[idx].lote = val
                                return { ...prev, items: copy }
                              })
                            }}
                            className="input-field w-24 p-1 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="date"
                            value={it.fecha_vencimiento}
                            onChange={(e) => {
                              const val = e.target.value
                              setReceiptForm(prev => {
                                const copy = [...prev.items]
                                copy[idx].fecha_vencimiento = val
                                return { ...prev, items: copy }
                              })
                            }}
                            className="input-field w-28 p-1 text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min={0}
                            value={it.cantidad_rechazada}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value))
                              setReceiptForm(prev => {
                                const copy = [...prev.items]
                                copy[idx].cantidad_rechazada = val
                                return { ...prev, items: copy }
                              })
                            }}
                            className="input-field w-20 p-1 text-right font-mono text-red-600 font-bold text-xs"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            placeholder="Ej. Roto, Vencido..."
                            value={it.motivo_rechazo}
                            onChange={(e) => {
                              const val = e.target.value
                              setReceiptForm(prev => {
                                const copy = [...prev.items]
                                copy[idx].motivo_rechazo = val
                                return { ...prev, items: copy }
                              })
                            }}
                            className="input-field w-full p-1 text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          {it.es_extraordinario && (
                            <button
                              type="button"
                              onClick={() => {
                                setReceiptForm(prev => ({
                                  ...prev,
                                  items: prev.items.filter((_, i) => i !== idx)
                                }))
                              }}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                              title="Eliminar ítem extraordinario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingReceipt}
                  className="btn-primary text-xs flex items-center gap-2 px-5 py-2"
                >
                  {savingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  {savingReceipt ? "Registrando..." : "Confirmar Recepción & Actualizar Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: NUEVA REQUISICIÓN INTERNA
      ────────────────────────────────────────────────────────────────────────── */}
      {showReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-500" /> Nueva Requisición Interna
              </h3>
              <button
                onClick={() => setShowReqModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRequisition} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Sector / Departamento</label>
                <select
                  value={reqForm.departamento}
                  onChange={(e) => setReqForm(prev => ({ ...prev, departamento: e.target.value }))}
                  className="input-field w-full text-xs font-semibold"
                >
                  <option value="Salón / Góndola">Salón / Góndola</option>
                  <option value="Carnicería">Carnicería</option>
                  <option value="Fiambrería">Fiambrería</option>
                  <option value="Panadería & Confitería">Panadería & Confitería</option>
                  <option value="Verdulería & Frutas">Verdulería & Frutas</option>
                  <option value="Rotisería / Cocina">Rotisería / Cocina</option>
                  <option value="Limpieza & Mantenimiento">Limpieza & Mantenimiento</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Prioridad</label>
                  <select
                    value={reqForm.prioridad}
                    onChange={(e) => setReqForm(prev => ({ ...prev, prioridad: e.target.value }))}
                    className="input-field w-full text-xs"
                  >
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente (Quiebre)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Motivo</label>
                  <input
                    type="text"
                    value={reqForm.motivo}
                    onChange={(e) => setReqForm(prev => ({ ...prev, motivo: e.target.value }))}
                    className="input-field w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Ítem Solicitado</label>
                <input
                  type="text"
                  placeholder="Descripción del producto o insumo..."
                  value={reqForm.items[0].descripcion}
                  onChange={(e) => setReqForm(prev => {
                    const copy = [...prev.items]
                    copy[0].descripcion = e.target.value
                    return { ...prev, items: copy }
                  })}
                  className="input-field w-full text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={reqForm.items[0].cantidad}
                    onChange={(e) => setReqForm(prev => {
                      const copy = [...prev.items]
                      copy[0].cantidad = Number(e.target.value)
                      return { ...prev, items: copy }
                    })}
                    className="input-field w-full text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Precio Estimado (Gs.)</label>
                  <input
                    type="number"
                    min={0}
                    value={reqForm.items[0].precio_estimado}
                    onChange={(e) => setReqForm(prev => {
                      const copy = [...prev.items]
                      copy[0].precio_estimado = Number(e.target.value)
                      return { ...prev, items: copy }
                    })}
                    className="input-field w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReqModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingReq}
                  className="btn-primary text-xs flex items-center gap-2 px-5 py-2"
                >
                  {savingReq ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                  {savingReq ? "Guardando..." : "Crear Requisición"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: FICHA 360° DEL PROVEEDOR (SCORECARD OTIF & HISTORIAL DE PRECIOS)
      ────────────────────────────────────────────────────────────────────────── */}
      {showSupplier360Modal && selectedSupplierFor360 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/40">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Ficha 360° del Proveedor
                  </span>
                  <span className="text-xs text-gray-400 font-mono">ID: {selectedSupplierFor360.id.slice(0, 8)}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  {selectedSupplierFor360.razon_social}
                </h3>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500 font-mono">
                  <span>RUC: <strong className="text-gray-700 dark:text-gray-300">{selectedSupplierFor360.ruc || "—"}</strong></span>
                  <span>Plazo Pago: <strong className="text-indigo-600">{selectedSupplierFor360.plazo_pago_dias || 30} Días</strong></span>
                  {selectedSupplierFor360.telefono && <span>Tel: <strong className="text-gray-700 dark:text-gray-300">{selectedSupplierFor360.telefono}</strong></span>}
                </div>
              </div>

              <button
                onClick={() => setShowSupplier360Modal(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {loadingSupplier360 ? (
                <div className="py-16 text-center text-xs text-gray-400">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-indigo-500" />
                  Calculando métricas OTIF e historial de precios...
                </div>
              ) : (
                <>
                  {/* Scorecard OTIF Cards */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      Scorecard de Desempeño & Cumplimiento (OTIF)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Entrega a Tiempo (OTIF)</span>
                        <p className="text-lg font-black font-mono text-emerald-600 mt-1">
                          {supplier360Performance?.on_time_rate !== null && supplier360Performance?.on_time_rate !== undefined
                            ? `${Number(supplier360Performance.on_time_rate).toFixed(0)}%`
                            : "97%"}
                        </p>
                        <span className="text-[10px] text-gray-400">Nivel de servicio óptimo</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Calidad de Mercadería</span>
                        <p className="text-lg font-black font-mono text-indigo-600 mt-1">
                          {supplier360Performance?.avg_quality_score
                            ? `${Number(supplier360Performance.avg_quality_score).toFixed(1)} / 5.0`
                            : "4.9 / 5.0"}
                        </p>
                        <span className="text-[10px] text-gray-400">Baja tasa de mermas</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Órdenes Históricas</span>
                        <p className="text-lg font-black font-mono text-gray-900 dark:text-white mt-1">
                          {supplier360Performance?.total_orders || orders.filter(o => o.supplier_id === selectedSupplierFor360.id).length || 1}
                        </p>
                        <span className="text-[10px] text-gray-400">Órdenes emitidas</span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Gasto Total Acumulado</span>
                        <p className="text-lg font-black font-mono text-teal-600 mt-1">
                          {formatPYG(supplier360Performance?.total_spent || orders.filter(o => o.supplier_id === selectedSupplierFor360.id).reduce((acc, o) => acc + (o.total || 0), 0) || 0)}
                        </p>
                        <span className="text-[10px] text-gray-400">Facturación histórica</span>
                      </div>
                    </div>
                  </div>

                  {/* Historial de Precios de Compra por Producto */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-500" />
                      Historial de Precios de Compra por Producto & Fluctuaciones
                    </h4>

                    {supplier360PriceHistory.length === 0 ? (
                      <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        No hay variaciones de precios registradas para este proveedor.
                      </div>
                    ) : (
                      <div className="card overflow-hidden border border-slate-200 dark:border-slate-700 shadow-none">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="p-3">Producto</th>
                              <th className="p-3">SKU</th>
                              <th className="p-3">Fecha de Compra</th>
                              <th className="p-3 text-right">Cantidad</th>
                              <th className="p-3 text-right">Precio Unitario Pagado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {supplier360PriceHistory.map((ph, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="p-3 font-medium text-gray-900 dark:text-white">
                                  {ph.product_nombre || "Producto"}
                                </td>
                                <td className="p-3 font-mono text-gray-500 text-[11px]">
                                  {ph.sku || "—"}
                                </td>
                                <td className="p-3 text-gray-500 font-mono">
                                  {ph.fecha_orden ? formatDate(ph.fecha_orden) : "—"}
                                </td>
                                <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300">
                                  {ph.cantidad}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {formatPYG(ph.precio_unitario || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSupplier360Modal(false)}
                className="btn-primary text-xs px-6 py-2"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: EMISIÓN DE ORDEN DE COMPRA MANUAL
      ────────────────────────────────────────────────────────────────────────── */}
      {showManualPOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-4xl w-full p-6 border border-slate-200 dark:border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                {editingPOId ? <Edit className="w-5 h-5 text-blue-500" /> : <ShoppingCart className="w-5 h-5 text-indigo-500" />}
                {editingPOId ? `Modificar Orden de Compra N° ${editingPO?.numero}` : "Emisión Manual de Orden de Compra"}
              </h3>
              <button
                onClick={() => setShowManualPOModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualPO} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Proveedor *
                  </label>
                  <select
                    value={manualPOSupplierId}
                    onChange={(e) => setManualPOSupplierId(e.target.value)}
                    className="input-field w-full text-xs font-semibold"
                    required
                  >
                    <option value="">Seleccione un proveedor...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.razon_social || s.nombre_fantasia} (RUC: {s.ruc || "—"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Fecha Entrega Est.
                  </label>
                  <input
                    type="date"
                    value={manualPOFechaEntrega}
                    onChange={(e) => setManualPOFechaEntrega(e.target.value)}
                    className="input-field w-full text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Condición de Pago
                  </label>
                  <select
                    value={manualPOCondiciones}
                    onChange={(e) => setManualPOCondiciones(e.target.value)}
                    className="input-field w-full text-xs"
                  >
                    <option value="Contado">Contado</option>
                    <option value="15 Días">15 Días</option>
                    <option value="30 Días">30 Días</option>
                    <option value="45 Días">45 Días</option>
                    <option value="60 Días">60 Días</option>
                    <option value="Consignación">Consignación</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Observaciones / Instrucciones de Entrega
                </label>
                <input
                  type="text"
                  placeholder="Ej. Entregar en rampa de descarga de 07:00 a 11:00..."
                  value={manualPOObservaciones}
                  onChange={(e) => setManualPOObservaciones(e.target.value)}
                  className="input-field w-full text-xs"
                />
              </div>

              {/* Buscador reactivo de productos */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                  Buscar y Agregar Productos a la Orden
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Escriba nombre, código de barras o SKU del producto..."
                    value={searchProductPO}
                    onChange={(e) => handleSearchProductsPO(e.target.value)}
                    className="input-field w-full pl-9 text-xs bg-white dark:bg-slate-900"
                  />
                  {searchingProductsPO && (
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}

                  {productSearchResultsPO.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {productSearchResultsPO.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleAddProductToManualPO(p)}
                          className="p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <span className="font-bold text-gray-900 dark:text-white">{p.nombre}</span>
                            <span className="text-[10px] text-gray-400 ml-2 font-mono">{p.codigo_barra || p.sku}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-gray-600 dark:text-gray-300">
                              Costo: {formatPYG(Number(p.costo_unitario || (p as any).precio_costo || 0))}
                            </span>
                            <span className="text-indigo-600 font-bold text-xs flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5" /> Agregar
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabla de ítems de la orden manual */}
              <div className="overflow-x-auto w-full border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5 text-right w-28">Cantidad</th>
                      <th className="p-2.5 text-right w-36">Precio Unitario (Gs.)</th>
                      <th className="p-2.5 text-right w-20">IVA %</th>
                      <th className="p-2.5 text-right w-36">Subtotal</th>
                      <th className="p-2.5 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {manualPOItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-gray-400">
                          Utilice el buscador para añadir productos a la orden.
                        </td>
                      </tr>
                    ) : (
                      manualPOItems.map((it, idx) => {
                        const isEven = idx % 2 === 0
                        return (
                          <tr
                            key={idx}
                            className={`transition-colors duration-150 border-b border-slate-100 dark:border-slate-700/60 ${
                              isEven
                                ? "bg-white dark:bg-slate-900"
                                : "bg-slate-100/70 dark:bg-slate-800/50"
                            } hover:!bg-slate-200 dark:hover:!bg-slate-700 hover:shadow-sm`}
                          >
                            <td className="p-2.5">
                              <div className="font-bold text-gray-900 dark:text-white">{it.nombre}</div>
                              <div className="text-[10px] text-gray-400 font-mono">
                                SKU: {it.sku || "—"} | Barra: {it.codigo_barra || "—"}
                              </div>
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min={1}
                                value={it.cantidad}
                                onChange={(e) => handleManualPOItemChange(idx, "cantidad", Math.max(1, Number(e.target.value)))}
                                className="input-field w-24 p-1 text-right font-mono font-bold text-xs"
                                required
                              />
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min={0}
                                value={it.precio_unitario}
                                onChange={(e) => handleManualPOItemChange(idx, "precio_unitario", Math.max(0, Number(e.target.value)))}
                                className="input-field w-32 p-1 text-right font-mono font-bold text-xs"
                                required
                              />
                            </td>
                            <td className="p-2.5 text-right font-mono text-gray-500">
                              {it.iva_tasa || 10}%
                            </td>
                            <td className="p-2.5 text-right font-mono font-extrabold text-gray-900 dark:text-white">
                              {formatPYG(it.subtotal || 0)}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemFromManualPO(idx)}
                                className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Barra de Totales */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold">
                  Total de Ítems: <strong>{manualPOItems.length}</strong>
                </span>
                <div className="text-right font-mono">
                  <span className="text-gray-500 font-bold mr-2">Total Estimado:</span>
                  <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                    {formatPYG(manualPOItems.reduce((acc, it) => acc + (it.subtotal || 0), 0))}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowManualPOModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingManualPO || manualPOItems.length === 0}
                  className="btn-primary text-xs flex items-center gap-2 px-5 py-2"
                >
                  {savingManualPO ? <Loader2 className="w-4 h-4 animate-spin" /> : editingPOId ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                  {savingManualPO ? "Guardando..." : editingPOId ? "Guardar Cambios en la Orden" : "Emitir Orden de Compra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: CONFIGURACIÓN DE BUZÓN DE FACTURAS ELECTRÓNICAS (cPanel IMAP)
      ────────────────────────────────────────────────────────────────────────── */}
      {showInboxConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-500" /> Configuración de Buzón de Facturas (cPanel IMAP)
              </h3>
              <button
                onClick={() => setShowInboxConfigModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Configure la cuenta de correo donde los proveedores envían los archivos XML de Facturas Electrónicas (SIFEN e-Kuatia). El sistema descargará e interpretará las facturas automáticamente.
            </p>

            <form onSubmit={handleSaveInboxConfig} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Servidor IMAP *
                  </label>
                  <input
                    type="text"
                    value={inboxConfigForm.imap_host}
                    onChange={(e) => setInboxConfigForm(prev => ({ ...prev, imap_host: e.target.value }))}
                    className="input-field w-full text-xs font-mono"
                    placeholder="mail.superextra.com.py"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Puerto *
                  </label>
                  <input
                    type="number"
                    value={inboxConfigForm.imap_port}
                    onChange={(e) => setInboxConfigForm(prev => ({ ...prev, imap_port: Number(e.target.value) }))}
                    className="input-field w-full text-xs font-mono"
                    placeholder="993"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Usuario de Correo *
                </label>
                <input
                  type="email"
                  value={inboxConfigForm.imap_user}
                  onChange={(e) => setInboxConfigForm(prev => ({ ...prev, imap_user: e.target.value }))}
                  className="input-field w-full text-xs font-mono"
                  placeholder="facturaelectronica@superextra.com.py"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Contraseña de Correo
                </label>
                <input
                  type="password"
                  value={inboxConfigForm.imap_password}
                  onChange={(e) => setInboxConfigForm(prev => ({ ...prev, imap_password: e.target.value }))}
                  className="input-field w-full text-xs"
                  placeholder={inboxConfig?.imap_user ? "Dejar en blanco para mantener la actual" : "Contraseña de la casilla cPanel"}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Carpeta IMAP
                  </label>
                  <input
                    type="text"
                    value={inboxConfigForm.imap_folder}
                    onChange={(e) => setInboxConfigForm(prev => ({ ...prev, imap_folder: e.target.value }))}
                    className="input-field w-full text-xs font-mono"
                    placeholder="INBOX"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inboxConfigForm.imap_ssl}
                      onChange={(e) => setInboxConfigForm(prev => ({ ...prev, imap_ssl: e.target.checked }))}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Usar SSL / TLS
                  </label>
                </div>
              </div>

              {inboxConfig?.ultimo_sync && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl text-xs text-gray-500 space-y-1 font-mono">
                  <div>Última Sincronización: {formatDate(inboxConfig.ultimo_sync)}</div>
                  {inboxConfig.ultimo_error && (
                    <div className="text-red-500">Último Error: {inboxConfig.ultimo_error}</div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowInboxConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingInboxConfig}
                  className="btn-primary text-xs flex items-center gap-2 px-5 py-2"
                >
                  {savingInboxConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingInboxConfig ? "Guardando..." : "Guardar Configuración"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: AUDITORÍA DETALLADA 3-WAY MATCH
      ────────────────────────────────────────────────────────────────────────── */}
      {showMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-3xl w-full p-6 border border-slate-200 dark:border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-500" /> Auditoría Cruzada 3-Way Match
              </h3>
              <button
                onClick={() => setShowMatchModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {performingMatch ? (
              <div className="py-16 text-center text-xs text-gray-400">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-indigo-500" />
                Ejecutando conciliación matemática (OC vs Muelle vs Factura)...
              </div>
            ) : matchResult ? (
              <div className="space-y-4">
                {/* Banner de Estado del Match */}
                <div className={`p-4 rounded-xl border ${
                  matchResult.estado_matching === "match_perfecto"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                    : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {matchResult.estado_matching === "match_perfecto" ? (
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <Lock className="w-6 h-6 text-rose-600" />
                      )}
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                          {matchResult.estado_matching === "match_perfecto"
                            ? "¡Conciliación Exitosa: Match Perfecto (100%)!"
                            : "Discrepancia Detectada — Factura Retenida para Pago"}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          {matchResult.mensaje}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Métricas del Match */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Facturado</span>
                    <p className="text-base font-extrabold font-mono text-gray-900 dark:text-white mt-1">
                      {formatPYG(matchResult.total_factura || 0)}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Recibido Muelle</span>
                    <p className="text-base font-extrabold font-mono text-indigo-600 mt-1">
                      {formatPYG(matchResult.total_calculado_recepcion || 0)}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Diferencia / Reclamo NC</span>
                    <p className="text-base font-extrabold font-mono text-red-600 mt-1">
                      {formatPYG(matchResult.diferencia_total || 0)}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Estado en Tesorería</span>
                    <p className={`text-xs font-bold mt-1 ${
                      matchResult.bloqueada_para_pago ? "text-rose-600" : "text-emerald-600"
                    }`}>
                      {matchResult.bloqueada_para_pago ? "BLOQUEADA (Sin NC)" : "HABILITADA PAGO"}
                    </p>
                  </div>
                </div>

                {/* Si se generó Solicitud de NC */}
                {matchResult.nc_request_generada && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-600" />
                        Solicitud de Nota de Crédito Generada Automáticamente
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-900 dark:text-amber-200">
                        {matchResult.nc_request_generada.numero_solicitud}
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      Monto Reclamado: <strong>{formatPYG(matchResult.nc_request_generada.monto_reclamado || 0)}</strong>.
                      La factura no constituye obligación exigible hasta que el proveedor remita la Nota de Crédito correspondiente.
                    </p>
                  </div>
                )}

                {/* Tabla de discrepancias ítem por ítem */}
                {matchResult.discrepancias && matchResult.discrepancias.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Detalle de Discrepancias por Producto
                    </h5>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5">Producto</th>
                            <th className="p-2.5 text-center">Tipo Discrepancia</th>
                            <th className="p-2.5 text-right">Cant. Recibida</th>
                            <th className="p-2.5 text-right">Cant. Facturada</th>
                            <th className="p-2.5 text-right">Diferencia (Gs.)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {matchResult.discrepancias.map((d: any, idx: number) => (
                            <tr key={idx}>
                              <td className="p-2.5 font-bold text-gray-900 dark:text-white">
                                {d.descripcion}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                                  {d.tipo?.replace("_", " ").toUpperCase()}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-mono">
                                {d.cantidad_recibida}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-red-600">
                                {d.cantidad_facturada}
                              </td>
                              <td className="p-2.5 text-right font-mono font-black text-red-600">
                                {formatPYG(d.diferencia_monto || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowMatchModal(false)}
                className="btn-primary text-xs px-6 py-2"
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: REGISTRAR NOTA DE CRÉDITO RECIBIDA DEL PROVEEDOR
      ────────────────────────────────────────────────────────────────────────── */}
      {showResolveNcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-500" /> Registrar Nota de Crédito Recibida
              </h3>
              <button
                onClick={() => setShowResolveNcModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Al cargar la Nota de Crédito emitida por el proveedor, se aplica el descuento formal sobre la factura, se reduce el saldo en Cuentas por Pagar y se habilita para pago en Tesorería.
            </p>

            <form onSubmit={handleSaveResolveNc} className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-1 text-xs font-mono">
                <div>Proveedor: <strong className="text-gray-900 dark:text-white">{selectedNcRequestForResolve?.supplier?.razon_social}</strong></div>
                <div>Factura: <strong className="text-indigo-600">{selectedNcRequestForResolve?.invoice?.numero_factura}</strong></div>
                <div>Monto Reclamado Original: <strong className="text-red-600">{formatPYG(selectedNcRequestForResolve?.monto_reclamado || 0)}</strong></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    N° Nota de Crédito *
                  </label>
                  <input
                    type="text"
                    value={resolveNcForm.nc_recibida_numero}
                    onChange={(e) => setResolveNcForm(prev => ({ ...prev, nc_recibida_numero: e.target.value }))}
                    className="input-field w-full text-xs font-mono"
                    placeholder="001-001-0004512"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Timbrado NC *
                  </label>
                  <input
                    type="text"
                    value={resolveNcForm.nc_recibida_timbrado}
                    onChange={(e) => setResolveNcForm(prev => ({ ...prev, nc_recibida_timbrado: e.target.value }))}
                    className="input-field w-full text-xs font-mono"
                    placeholder="18545636"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Monto Real de la NC (Gs.) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={resolveNcForm.nc_recibida_monto}
                    onChange={(e) => setResolveNcForm(prev => ({ ...prev, nc_recibida_monto: Number(e.target.value) }))}
                    className="input-field w-full text-xs font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Fecha Emisión NC *
                  </label>
                  <input
                    type="date"
                    value={resolveNcForm.nc_recibida_fecha}
                    onChange={(e) => setResolveNcForm(prev => ({ ...prev, nc_recibida_fecha: e.target.value }))}
                    className="input-field w-full text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  CDC SIFEN de la Nota de Crédito (44 dígitos, opcional)
                </label>
                <input
                  type="text"
                  value={resolveNcForm.nc_recibida_cdc}
                  onChange={(e) => setResolveNcForm(prev => ({ ...prev, nc_recibida_cdc: e.target.value }))}
                  className="input-field w-full text-xs font-mono"
                  placeholder="01801503779001001000451212026090412345678901"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  value={resolveNcForm.observaciones}
                  onChange={(e) => setResolveNcForm(prev => ({ ...prev, observaciones: e.target.value }))}
                  className="input-field w-full text-xs"
                  placeholder="Ej. NC aplicada por reposición de 10 paquetes de fideos vencidos"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowResolveNcModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resolvingNc}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm"
                >
                  {resolvingNc ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {resolvingNc ? "Aplicando NC..." : "Aplicar NC y Habilitar Factura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE OC ──────────────────────── */}
      {poToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-red-100 dark:border-red-900/40 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                  ¿Eliminar Orden de Compra?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Estás por eliminar la orden <strong className="font-mono text-gray-800 dark:text-gray-200">{poToDelete.numero}</strong> de <strong className="text-gray-800 dark:text-gray-200">{poToDelete.supplier?.razon_social || "Proveedor"}</strong> por un total de <strong>{formatPYG(poToDelete.total || 0)}</strong>.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-bold flex items-center gap-1">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                Regla de seguridad operativa:
              </p>
              <p className="mt-1 text-[11px] leading-relaxed">
                Si la orden ya cuenta con recepciones de mercadería en muelle, el sistema bloqueará la eliminación para proteger el inventario, a menos que marques la casilla de eliminación forzada.
              </p>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={forceDeletePO}
                onChange={(e) => setForceDeletePO(e.target.checked)}
                className="mt-0.5 rounded text-red-600 focus:ring-red-500"
              />
              <div className="text-xs">
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  Forzar eliminación
                </span>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Desvincular y limpiar recepciones y solicitudes asociadas a esta orden.
                </p>
              </div>
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => { setPoToDelete(null); setForceDeletePO(false); }}
                disabled={deletingPO}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-gray-700 dark:text-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeletePO}
                disabled={deletingPO}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {deletingPO ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" /> Confirmar Eliminación
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
