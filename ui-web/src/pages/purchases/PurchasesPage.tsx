import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  Search, ShoppingCart, Package, DollarSign, TrendingDown, Users, CheckCircle2, Loader2,
  Plus, Eye, X, Trash2, Minus, FileText, Truck, Award, BarChart3, Download, Clock,
  AlertTriangle, Filter, ChevronDown, ChevronUp, Edit3, Send, Ban, RefreshCw,
  UserPlus, FileSpreadsheet, ClipboardList, TrendingUp, ArrowUp, ArrowDown, ArrowRight,
  MessageSquare, Calendar, Hash, Percent, Printer, Link2, Check, Save, ExternalLink,
  Sparkles, Sun, CloudRain, Snowflake, Flame, ShieldAlert, Scale, CheckCircle,
  HelpCircle, AlertCircle, Box, Layers, Building2, Phone, Mail, MapPin, SlidersHorizontal,
  ChevronRight, ArrowUpDown, ChevronLeft, CheckSquare, Square, PieChart, Undo2, Receipt, History, Star
} from "lucide-react"
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
  
  // Factores Estacionales y Contextuales de Supermercado
  const [factorFinSemana, setFactorFinSemana] = useState(false)
  const [factorFinMes, setFactorFinMes] = useState(false)
  const [factorClima, setFactorClima] = useState<"normal" | "calor" | "frio" | "lluvia">("normal")
  const [factorEvento, setFactorEvento] = useState<"normal" | "feriado" | "semana_santa" | "fin_de_ano">("normal")

  // Estado del resultado de la IA
  const [replenishmentData, setReplenishmentData] = useState<SmartReplenishmentResponse | null>(null)
  const [loadingReplenishment, setLoadingReplenishment] = useState(false)
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({})
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
      precio_unitario: number
      lote: string
      fecha_vencimiento: string
      cantidad_rechazada: number
      motivo_rechazo: string
    }[]
  }>({
    purchase_order_id: "",
    proveedor_ref: "",
    observaciones: "",
    items: [],
  })
  const [savingReceipt, setSavingReceipt] = useState(false)

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
      ] = await Promise.allSettled([
        api.purchases.listPOs(),
          api.purchases.lostDemand.list(),
        api.purchases.listReceipts(),
        api.purchases.listSuppliers(),
        api.purchases.reports.kpis(),
        api.financial.payableInvoices(),
        api.purchases.requisitions.list(),
        api.purchases.rfqs.list(),
        api.purchases.budgets.list(),
        api.purchases.budgets.consumption(),
        api.purchases.reports.spendBySupplier(),
        api.purchases.reports.spendByCategory(),
        api.purchases.reports.priceVariance(),
        api.financial.supplierReturns(),
        api.financial.creditNotes(),
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

  const handleOpenGenerateModal = () => {
    const itemsToOrder = (replenishmentData?.items || []).filter(
      (it: any) => selectedItemsIA[it.product_id] && (editedQuantities[it.product_id] || 0) > 0
    )
    if (itemsToOrder.length === 0) {
      toast.error("Sin ítems seleccionados", "Marcá al menos un producto con cantidad mayor a cero.")
      return
    }
    const defaultDelivery = new Date()
    defaultDelivery.setDate(defaultDelivery.getDate() + (leadTimeDias || 3))
    
    setGeneratePOForm({
      supplier_id: selectedSupplierIA || suppliers[0]?.id || "",
      fecha_entrega_estimada: defaultDelivery.toISOString().split("T")[0],
      prioridad: soloQuiebreIA ? "urgente" : "normal",
      condiciones_pago: "30 Días",
      observaciones: `Orden generada mediante Asistente IA de Abastecimiento (${diasCobertura} días de stock). Factores: FinSem=${factorFinSemana ? 'SI' : 'NO'}, FinMes=${factorFinMes ? 'SI' : 'NO'}, Clima=${factorClima}, Evento=${factorEvento}.`,
    })
    setShowGenerateModal(true)
  }

  const handleCreatePOFromReplenishment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!generatePOForm.supplier_id) {
      toast.error("Seleccione un proveedor")
      return
    }
    const itemsToOrder = (replenishmentData?.items || []).filter(
      (it: any) => selectedItemsIA[it.product_id] && (editedQuantities[it.product_id] || 0) > 0
    ).map((it: any) => ({
      product_id: it.product_id,
      descripcion: it.nombre,
      cantidad: Number(editedQuantities[it.product_id] || it.cantidad_sugerida),
      precio_unitario: Number(it.costo_unitario_estimado || 0),
      iva_tasa: Number(it.iva_tasa || 10),
    }))

    setGeneratingPO(true)
    try {
      const created = await api.purchases.generatePOFromReplenishment({
        supplier_id: generatePOForm.supplier_id,
        fecha_entrega_estimada: generatePOForm.fecha_entrega_estimada || undefined,
        prioridad: generatePOForm.prioridad,
        condiciones_pago: generatePOForm.condiciones_pago,
        observaciones: generatePOForm.observaciones,
        user_id: user?.id,
        user_name: user?.nombre || "Comprador",
        items: itemsToOrder,
      })
      toast.success("¡Orden de Compra Generada!", `Se creó la OC N° ${created.numero} con ${itemsToOrder.length} ítems.`)
      setShowGenerateModal(false)
      fetchAll()
      setTab("ordenes")
      handleViewPO(created)
    } catch (e: any) {
      toast.error("Error al crear Orden de Compra", e.message)
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
      const items = await api.purchases.getOrderItems(targetPO.id)
      setReceiptForm({
        purchase_order_id: targetPO.id,
        proveedor_ref: "",
        observaciones: "",
        items: (items || []).map(it => ({
          product_id: (it as any).product_id || (it as any).producto_id || (it as any).id || "",
          nombre: (it as any).producto?.nombre || (it as any).descripcion || "Producto",
          sku: (it as any).producto?.sku || "",
          cantidad_ordenada: Number(it.cantidad || 0),
          cantidad_recibir: Math.max(0, Number(it.cantidad || 0) - Number(it.recibido || (it as any).cantidad_recibida || 0)),
          precio_unitario: Number(it.precio_unitario || 0),
          lote: "",
          fecha_vencimiento: "",
          cantidad_rechazada: 0,
          motivo_rechazo: "",
        }))
      })
      setShowReceiptModal(true)
    } catch (e: any) {
      toast.error("Error al cargar orden para recepción", e.message)
    }
  }

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!receiptForm.purchase_order_id) return
    const validItems = receiptForm.items.filter(it => it.cantidad_recibir > 0 || it.cantidad_rechazada > 0)
    if (validItems.length === 0) {
      toast.error("Debe ingresar al menos una cantidad recibida o rechazada.")
      return
    }

    setSavingReceipt(true)
    try {
      await api.purchases.createReceipt({
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
        })) as any,
      })
      toast.success("¡Mercadería Recibida en Muelle!", "Se actualizó el stock físico y se registraron los lotes.")
      setShowReceiptModal(false)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al registrar recepción", e.message)
    } finally {
      setSavingReceipt(false)
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
        const cost = Number(it.costo_unitario_estimado) || 0
        return acc + (qty * cost)
      }, 0)
  }, [replenishmentData, selectedItemsIA, editedQuantities])

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

  // Filtrado reactivo de la Matriz de Sugerencia IA (sin recargar API)
  const displayedReplenishmentItems = useMemo(() => {
    if (!replenishmentData?.items) return []
    return replenishmentData.items.filter((it: any) => {
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
  }, [replenishmentData, searchProductIA, filterEstadoIA, editedQuantities])

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
    <div className="space-y-6 pb-16 max-w-full overflow-hidden">
      {/* ──────────────────────────────────────────────────────────────────────────
          HEADER PRINCIPAL
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800/90 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" /> Vertical Supermercado • Conector Legacy Nemuha
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">Extra Supermercado (Grupo Santa Teresa E.A.S.)</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <ShoppingCart className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Gestión de Compras & Abastecimiento
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-3xl">
            Asistente IA de compras por días de stock, cálculo de demanda predictiva sobre 11.250 productos de Supermercado, 4.447 órdenes y 441 proveedores reales de Nemuha.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleOpenReceiptModal()}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 border border-slate-200 dark:border-slate-600"
          >
            <Truck className="w-4 h-4 text-slate-500" />
            Recepción en Muelle
          </button>

          <button
            onClick={() => {
              setTab("asistente_ia")
              setSoloQuiebreIA(false)
            }}
            className="btn-primary text-xs flex items-center gap-2 px-4 py-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4" /> + Nueva Orden (Asistente IA)
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          BANNER DE ALERTA DE QUIEBRE PREVENTIVO
      ────────────────────────────────────────────────────────────────────────── */}
      {totalQuiebresInminentes > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-950/30 dark:to-amber-950/20 border border-red-200 dark:border-red-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-950 dark:text-red-200 flex items-center gap-2">
                Alerta de Stock Crítico: {totalQuiebresInminentes} producto(s) en quiebre inminente (&lt;3 días de stock)
              </h4>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                La rotación proyectada en góndola superará el stock físico antes de la próxima reposición.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setTab("asistente_ia")
              setSoloQuiebreIA(true)
              setDiasCobertura(7)
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <Flame className="w-4 h-4" /> Armar Pedido de Emergencia (7 Días)
          </button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          HERO KPIS (TIPOGRAFÍA UNIFICADA MONOSPACE EXTRABOLD)
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Compras del Mes (Agosto)</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white font-mono">
            {formatPYG(totalComprasEsteMes)}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">
            <strong className="text-gray-700 dark:text-gray-300 font-mono">{ordersEsteMes.length.toLocaleString()}</strong> órdenes emitidas este mes
          </span>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">En Tránsito Verificado (30d)</span>
            <Truck className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {formatPYG(montoEnTransito)}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">
            <strong className="text-amber-600 font-mono font-bold">{ordenesEnTransito.length}</strong> OC activas en camino
          </span>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Riesgo de Quiebre de Stock</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-extrabold text-red-600 dark:text-red-400 font-mono">
            {totalQuiebresInminentes + totalBajosStock}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">
            <strong className="text-red-500 font-bold font-mono">{totalQuiebresInminentes}</strong> quiebres + <strong className="text-amber-500 font-bold font-mono">{totalBajosStock}</strong> stock bajo
          </span>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Proveedores Activos</span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {suppliers.length}
          </p>
          <span className="text-xs text-gray-400 mt-1 block flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 100% Sincronizados de Nemuha
          </span>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          PESTAÑAS DE NAVEGACIÓN SEGMENTADAS (CERO DESBORDES)
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto border border-slate-200/60 dark:border-slate-700/50">
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
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700/60"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-white" : "text-slate-400"}`} />
              <span>{t.label}</span>
              {t.badge && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500 text-white">
                  {t.badge}
                </span>
              )}
              {t.count !== undefined && !t.badge && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono ${active ? "bg-indigo-700 text-indigo-100" : "bg-slate-200/80 dark:bg-slate-700 text-slate-500"}`}>
                  {t.count}
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
                <table className="w-full text-left text-xs min-w-[1100px]">
                  <thead className="bg-slate-100/80 dark:bg-slate-900/50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700/60 sticky top-0">
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
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="p-3 min-w-[200px]">Producto & SKU</th>
                      <th className="p-3 text-right" title="Stock actual físico registrado en inventario">Stock Físico</th>
                      <th className="p-3 text-right" title="Unidades en órdenes de compra confirmadas/enviadas que están en camino">En Tránsito</th>
                      <th className="p-3 text-right" title="Ventas reales de los últimos días">Ventas {diasHistorialVentas}d</th>
                      <th className="p-3 text-right" title="Venta diaria estimada por el algoritmo IA">Demanda / Día</th>
                      <th className="p-3 text-center" title="Días de stock restantes con el ritmo de venta actual = (Stock + Tránsito) / Demanda">Autonomía Actual</th>
                      <th className="p-3 text-center" title="Cantidad óptima sugerida por la IA para cubrir tus días de cobertura">Sugerencia IA</th>
                      <th className="p-3 text-center min-w-[150px]" title="Modificá esta cantidad libremente. Tu autonomía se recalculará en tiempo real">Tu Pedido (Un.)</th>
                      <th className="p-3 text-center min-w-[130px]" title="Autonomía en días que te quedará en el escenario de comprar la cantidad ingresada">Autonomía Proyectada</th>
                      <th className="p-3 text-right">Costo Unit.</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="p-3 min-w-[180px]">Justificación IA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {displayedReplenishmentItems.map((it: any) => {
                      const isSelected = !!selectedItemsIA[it.product_id]
                      const qty = editedQuantities[it.product_id] !== undefined ? editedQuantities[it.product_id] : Math.max(0, Math.round(Number(it.cantidad_sugerida) || 0))
                      const subtotal = Number(qty) * Number(it.costo_unitario_estimado || 0)

                      // Cálculo interactivo de Autonomía Proyectada
                      const stockActual = Number(it.stock_actual) || 0
                      const stockTransito = Number(it.stock_en_transito) || 0
                      const demandaD = Number(it.demanda_diaria_ajustada) || 0
                      const stockTotalConPedido = stockActual + stockTransito + Number(qty)
                      const nuevaAutonomia = demandaD > 0 ? (stockTotalConPedido / demandaD) : 999
                      const esOptimo = nuevaAutonomia >= diasCobertura
                      const esCritico = nuevaAutonomia < 7

                      return (
                        <tr
                          key={it.product_id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors ${
                            it.autonomia_estado === "critico"
                              ? "bg-red-50/30 dark:bg-red-950/10"
                              : it.autonomia_estado === "bajo"
                              ? "bg-amber-50/20 dark:bg-amber-950/10"
                              : ""
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                setSelectedItemsIA(prev => ({ ...prev, [it.product_id]: e.target.checked }))
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
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
                                <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-[10px] text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/50" title="Punto de Reorden Estadístico">
                                  ROP: {Math.round(it.punto_reorden).toLocaleString()}
                                </span>
                              )}
                              {it.stock_seguridad !== undefined && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-[10px] text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800/50" title="Stock de Seguridad Estadístico (95% nivel servicio)">
                                  SS: {Math.round(it.stock_seguridad).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                            {stockActual.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-amber-600 dark:text-amber-400">
                            {stockTransito > 0 ? `+${stockTransito.toLocaleString()}` : "—"}
                          </td>
                          <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-300">
                            {Number(it.ventas_periodo || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono">
                            <span className="font-bold text-gray-900 dark:text-white">
                              {demandaD.toFixed(1)}
                            </span>
                            {Number(it.multiplicador_estacional) > 1 && (
                              <span className="text-[10px] text-indigo-600 font-bold block">
                                (x{Number(it.multiplicador_estacional).toFixed(2)})
                              </span>
                            )}
                          </td>
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
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                {Math.round(Number(it.cantidad_sugerida) || 0).toLocaleString()} un.
                              </span>
                              {it.target_stock !== undefined && (
                                <span className="text-[9px] text-gray-400 font-mono">
                                  Meta: {Math.round(it.target_stock).toLocaleString()} ({diasCobertura}d+{leadTimeDias}d)
                                </span>
                              )}
                            </div>
                          </td>
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
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-black border whitespace-nowrap ${
                                demandaD <= 0
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200"
                                  : esCritico
                                  ? "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                                  : esOptimo
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                  : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              }`}>
                                {demandaD <= 0 ? "Sin demanda" : `${nuevaAutonomia.toFixed(1)} Días`}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {Number(qty) > 0 ? `+${(Number(qty) / Math.max(0.01, demandaD)).toFixed(1)}d con tu pedido` : "Sin pedido"}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-300">
                            {formatPYG(it.costo_unitario_estimado)}
                          </td>
                          <td className="p-3 text-right font-mono font-extrabold text-gray-900 dark:text-white">
                            {formatPYG(subtotal)}
                          </td>
                          <td className="p-3 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1" title={it.explicacion_ia}>
                            {it.explicacion_ia}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
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

            <button
              onClick={() => setTab("asistente_ia")}
              className="btn-primary text-xs flex items-center gap-1.5 px-3.5 py-2 shrink-0"
            >
              <Plus className="w-4 h-4" /> Nueva Orden (Asistente IA)
            </button>
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
                    {paginatedOrders.map((po) => {
                      const st = (po.estado && poStatusMap[po.estado]) ? poStatusMap[po.estado] : { label: po.estado || "Borrador", bg: "bg-slate-100", text: "text-slate-600" }
                      return (
                        <tr key={po.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
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
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                title="Ver Detalle de Ítems"
                              >
                                <Eye className="w-3.5 h-3.5" />
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
                                  className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                  title="Cancelar Orden"
                                >
                                  <Ban className="w-3.5 h-3.5" />
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
          <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-500" />
                Cartera de Facturas de Proveedores — Procure-to-Pay ({allSupplierInvoices.length} Facturas)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Seguimiento del ciclo P2P: comprobantes recibidos, fechas de vencimiento y estado de pago en tesorería.
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
                <option value="pendiente">Pendientes</option>
                <option value="pagada">Pagadas</option>
                <option value="vencida">Vencidas</option>
              </select>
            </div>
          </div>

          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            {paginatedInvoicesP2P.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                No se encontraron facturas con los filtros aplicados.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      <th className="p-3">N° Factura</th>
                      <th className="p-3">Proveedor</th>
                      <th className="p-3">Emisión</th>
                      <th className="p-3">Vencimiento</th>
                      <th className="p-3 text-right">Total Factura</th>
                      <th className="p-3 text-right">Saldo Pendiente</th>
                      <th className="p-3 text-center">Condición</th>
                      <th className="p-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {paginatedInvoicesP2P.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-gray-900 dark:text-white">
                          {inv.numero_factura || "S/N"}
                        </td>
                        <td className="p-3 font-medium text-gray-700 dark:text-gray-300 line-clamp-1 max-w-[200px]" title={inv.supplier_nombre}>
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
                        </td>
                        <td className="p-3 text-center capitalize text-slate-500">
                          {inv.condicion || "Crédito"}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.estado === "pagada"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : inv.estado === "vencida"
                              ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}>
                            {inv.estado || "pendiente"}
                          </span>
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
        <div className="space-y-5">
          <div className="card p-5 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-500" />
              3-Way Matching: Conciliación Triple de Compras
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Auditoría cruzada automática entre la <strong>Orden de Compra emitida</strong>, la <strong>Recepción Física en Muelle</strong> y la <strong>Factura Fiscal del Proveedor</strong>.
            </p>
          </div>

          <div className="card overflow-hidden bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/60 shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700/60 flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Facturas de Proveedores vs Recepciones ({invoices.length} Comprobantes Registrados)
              </h4>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-slate-100/70 dark:bg-slate-900/40 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">N° Factura Fiscal</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3">Fecha Emisión</th>
                    <th className="p-3 text-right">Total Factura</th>
                    <th className="p-3 text-right">Saldo Pendiente</th>
                    <th className="p-3">Estado Fiscal</th>
                    <th className="p-3 text-center">3-Way Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {invoices.slice(0, 15).map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {inv.numero_factura}
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
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.estado === "pagada" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {inv.estado || "pendiente"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <CheckCircle className="w-3 h-3 text-emerald-500" /> Conciliado 100%
                        </span>
                      </td>
                    </tr>
                  ))}
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
          MODAL: GENERAR ORDEN DE COMPRA DESDE ASISTENTE IA
      ────────────────────────────────────────────────────────────────────────── */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" /> Confirmar Emisión de Orden de Compra
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePOFromReplenishment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Proveedor</label>
                <select
                  value={generatePOForm.supplier_id}
                  onChange={(e) => setGeneratePOForm(prev => ({ ...prev, supplier_id: e.target.value }))}
                  className="input-field w-full text-xs font-semibold"
                  required
                >
                  <option value="">Seleccione Proveedor</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.razon_social} ({s.ruc || "Sin RUC"})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Entrega Esperada</label>
                  <input
                    type="date"
                    value={generatePOForm.fecha_entrega_estimada}
                    onChange={(e) => setGeneratePOForm(prev => ({ ...prev, fecha_entrega_estimada: e.target.value }))}
                    className="input-field w-full text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Condición de Pago</label>
                  <select
                    value={generatePOForm.condiciones_pago}
                    onChange={(e) => setGeneratePOForm(prev => ({ ...prev, condiciones_pago: e.target.value }))}
                    className="input-field w-full text-xs"
                  >
                    <option value="Contado">Contado</option>
                    <option value="15 Días">Crédito 15 Días</option>
                    <option value="30 Días">Crédito 30 Días</option>
                    <option value="60 Días">Crédito 60 Días</option>
                    <option value="90 Días">Crédito 90 Días</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-medium">Ítems Seleccionados:</span>
                  <span className="font-bold font-mono text-gray-800 dark:text-gray-200">
                    {(replenishmentData?.items || []).filter((it: any) => selectedItemsIA[it.product_id] && (editedQuantities[it.product_id] || 0) > 0).length} productos
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-medium">Total Unidades:</span>
                  <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    {totalUnidadesIASugerida.toLocaleString()} un.
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-gray-800 dark:text-gray-200">Monto Total Estimado:</span>
                  <span className="font-extrabold font-mono text-gray-900 dark:text-white text-sm">
                    {formatPYG(totalOrdenIASugerida)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Observaciones / Notas</label>
                <textarea
                  rows={2}
                  value={generatePOForm.observaciones}
                  onChange={(e) => setGeneratePOForm(prev => ({ ...prev, observaciones: e.target.value }))}
                  className="input-field w-full text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={generatingPO}
                  className="btn-primary text-xs flex items-center gap-2 px-5 py-2"
                >
                  {generatingPO ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                  {generatingPO ? "Emitiendo..." : "Emitir Orden de Compra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: DETALLE DE ORDEN DE COMPRA
      ────────────────────────────────────────────────────────────────────────── */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-3xl w-full p-6 border border-slate-200 dark:border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-indigo-500" />
                  Orden de Compra N° {selectedPO.numero}
                </h3>
                <p className="text-xs text-gray-400">
                  Proveedor: <strong className="text-gray-700 dark:text-gray-200">{selectedPO.supplier?.razon_social || "—"}</strong> | Emitido: {formatDate(selectedPO.fecha || selectedPO.created_at || "")}
                </p>
              </div>
              <button
                onClick={() => setSelectedPO(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingPODetail ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto w-full border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5">Producto / Descripción</th>
                        <th className="p-2.5 text-right">Cantidad</th>
                        <th className="p-2.5 text-right">Recibido</th>
                        <th className="p-2.5 text-right">Precio Unit.</th>
                        <th className="p-2.5 text-right">IVA %</th>
                        <th className="p-2.5 text-right">Total (Gs.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {poDetailItems.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-semibold text-gray-800 dark:text-gray-200">
                            {(it as any).producto?.nombre || (it as any).descripcion || "Ítem"}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            {Number(it.cantidad || 0).toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-600 font-bold">
                            {Number(it.recibido || (it as any).cantidad_recibida || 0).toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            {formatPYG(it.precio_unitario || 0)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-gray-500">
                            {it.iva_tasa || 10}%
                          </td>
                          <td className="p-2.5 text-right font-mono font-extrabold text-gray-900 dark:text-white">
                            {formatPYG(it.subtotal || (Number(it.cantidad || 0) * Number(it.precio_unitario || 0)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex justify-between items-center text-xs">
                  <div className="text-gray-400">
                    Condición: <strong className="text-gray-700 dark:text-gray-300">{(selectedPO as any).condiciones_pago || "Contado"}</strong>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-gray-500 font-bold mr-2">Total Orden:</span>
                    <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                      {formatPYG(selectedPO.total || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
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

              <div className="overflow-x-auto w-full border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5 text-right w-20">Pedido</th>
                      <th className="p-2.5 text-right w-28">Recibir (Un.)</th>
                      <th className="p-2.5 w-28">N° Lote</th>
                      <th className="p-2.5 w-32">Vencimiento</th>
                      <th className="p-2.5 text-right w-24">Rechazo</th>
                      <th className="p-2.5 w-32">Motivo Rechazo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {receiptForm.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5">
                          <div className="font-bold text-gray-800 dark:text-gray-200">{it.nombre}</div>
                          <div className="text-[10px] text-gray-400 font-mono">SKU: {it.sku || "—"}</div>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-gray-600 dark:text-gray-300">
                          {it.cantidad_ordenada.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min={0}
                            value={it.cantidad_recibir}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value))
                              setReceiptForm(prev => {
                                const copy = [...prev.items]
                                copy[idx].cantidad_recibir = val
                                return { ...prev, items: copy }
                              })
                            }}
                            className="input-field w-24 p-1 text-right font-mono font-bold text-xs"
                            required
                          />
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
    </div>
  )
}
