import Supplier360Modal from "../purchases/Supplier360Modal"
import SupplierPaymentOrderModal from "./SupplierPaymentOrderModal"
import SupplierPaymentOrderDetailModal from "./SupplierPaymentOrderDetailModal"
import MultiSupplierPaymentModal from "./MultiSupplierPaymentModal"
import LiquidacionValesModal from "./LiquidacionValesModal"
import { useState, useEffect, useCallback, useMemo } from "react"
import {
  CreditCard, Search, Plus, Filter, Download, Eye, CheckCircle2,
  XCircle, AlertTriangle, Clock, Calendar, RefreshCw, Loader2,
  Building2, User, FileText, ArrowUpRight, DollarSign, Layers,
  Check, X, FileSpreadsheet, ShieldAlert, Sparkles, Info, ArrowRight,
  TrendingDown, CheckSquare, Square, Wallet, Printer, FileCheck, Globe, Apple
} from "lucide-react"
import { api, SupplierPaymentOrder } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, formatCurrency } from "../../utils/format"

type ApTab = "facturas" | "ordenes_pago" | "aging" | "lotes"

export default function PaymentsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState<ApTab>("facturas")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [invoices, setInvoices] = useState<any[]>([])
  const [paymentRuns, setPaymentRuns] = useState<any[]>([])
  const [paymentOrders, setPaymentOrders] = useState<SupplierPaymentOrder[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])

  // Filtros pestaña Facturas
  const [search, setSearch] = useState("")
  const [filterSupplier, setFilterSupplier] = useState("all")
  const [filterVencimiento, setFilterVencimiento] = useState("all")
  const [selected360SupplierId, setSelected360SupplierId] = useState<string | null>(null)
  const [selected360SupplierNombre, setSelected360SupplierNombre] = useState<string | null>(null)

  // Filtros pestaña Órdenes de Pago
  const [searchOrders, setSearchOrders] = useState("")
  const [filterOrderEstado, setFilterOrderEstado] = useState("all")
  const [filterOrderFormaPago, setFilterOrderFormaPago] = useState("all")
  const [filterOrderSupplier, setFilterOrderSupplier] = useState("all")
  const [exportingReportPdf, setExportingReportPdf] = useState(false)

  // Selección múltiple para Órdenes de Pago y Lotes
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [showPaymentRunModal, setShowPaymentRunModal] = useState(false)
  const [savingPaymentRun, setSavingPaymentRun] = useState(false)
  const [runForm, setRunForm] = useState({
    nombre: `Lote de Pago ${new Date().toLocaleDateString("es-PY")}`,
    fecha_programada: new Date().toISOString().split("T")[0],
    bank_account_id: "",
    metodo_pago: "transferencia_sipap",
    notas: "",
  })

  // Modales de Orden de Pago
  const [orderModalData, setOrderModalData] = useState<{
    supplier: any
    initialInvoices: any[]
    availableInvoices?: any[]
    existingOrder?: SupplierPaymentOrder | null
  } | null>(null)

  const [detailOrder, setDetailOrder] = useState<SupplierPaymentOrder | null>(null)
  const [showMultiSupplierModal, setShowMultiSupplierModal] = useState(false)
  const [showValesModal, setShowValesModal] = useState(false)
  const [valesModalSupplierId, setValesModalSupplierId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, runsRes, supRes, bnkRes, ordersRes] = await Promise.allSettled([
        api.financial.payableInvoices(),
        api.financial.paymentRuns.list(),
        api.purchases.listSuppliers(),
        api.financial.banks.list(),
        api.financial.paymentOrders.list(),
      ])

      if (invRes.status === "fulfilled" && Array.isArray(invRes.value)) setInvoices(invRes.value)
      if (runsRes.status === "fulfilled" && Array.isArray(runsRes.value)) setPaymentRuns(runsRes.value)
      if (supRes.status === "fulfilled" && Array.isArray(supRes.value)) setSuppliers(supRes.value)
      if (bnkRes.status === "fulfilled" && Array.isArray(bnkRes.value)) setBankAccounts(bnkRes.value)
      if (ordersRes.status === "fulfilled" && ordersRes.value?.items) setPaymentOrders(ordersRes.value.items)
    } catch (e: any) {
      toast.error("Error al sincronizar cuentas por pagar", e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const supplierMap = useMemo(() => {
    const map: Record<string, string> = {}
    suppliers.forEach((s: any) => { map[s.id] = s.razon_social || s.nombre || s.ruc })
    return map
  }, [suppliers])

  // Analytics de AP & Aging
  const analytics = useMemo(() => {
    let totalDeuda = 0
    let vencidasMonto = 0
    let vencidasCount = 0
    let porVencer30Monto = 0
    let porVencer30Count = 0
    let porVencer60Monto = 0
    let porVencerMayor60Monto = 0

    invoices.forEach(inv => {
      const saldo = Number(inv.saldo_pendiente || inv.total || 0)
      totalDeuda += saldo
      const diasVencido = Number(inv.dias_vencido || 0)

      if (diasVencido > 0) {
        vencidasMonto += saldo
        vencidasCount++
      } else {
        const diasRestantes = Math.abs(diasVencido)
        if (diasRestantes <= 30) {
          porVencer30Monto += saldo
          porVencer30Count++
        } else if (diasRestantes <= 60) {
          porVencer60Monto += saldo
        } else {
          porVencerMayor60Monto += saldo
        }
      }
    })

    const ordenesRegistradas = paymentOrders.filter(o => o.estado === "registrado").length
    const ordenesPagadas = paymentOrders.filter(o => o.estado === "pagado").length
    const totalPagadoMes = paymentOrders
      .filter(o => o.estado === "pagado")
      .reduce((s, o) => s + Number(o.monto_neto || 0), 0)

    return {
      totalDeuda,
      totalFacturas: invoices.length,
      vencidasMonto,
      vencidasCount,
      porVencer30Monto,
      porVencer30Count,
      porVencer60Monto,
      porVencerMayor60Monto,
      proveedoresConDeuda: new Set(invoices.map(i => i.supplier_id || i.supplier_nombre)).size,
      ordenesRegistradas,
      ordenesPagadas,
      totalPagadoMes,
    }
  }, [invoices, paymentOrders])

  // Agrupamiento por Proveedor para Matriz de Aging
  const supplierAging = useMemo(() => {
    const groups: Record<string, {
      supplier_id: string
      supplier_nombre: string
      total: number
      vencido: number
      dias_1_30: number
      dias_31_60: number
      dias_mas_60: number
      facturas_count: number
    }> = {}

    invoices.forEach(inv => {
      const supKey = inv.supplier_nombre || inv.supplier_id || "Proveedor"
      if (!groups[supKey]) {
        groups[supKey] = {
          supplier_id: inv.supplier_id,
          supplier_nombre: inv.supplier_nombre || supplierMap[inv.supplier_id] || "Proveedor",
          total: 0,
          vencido: 0,
          dias_1_30: 0,
          dias_31_60: 0,
          dias_mas_60: 0,
          facturas_count: 0
        }
      }

      const saldo = Number(inv.saldo_pendiente || inv.total || 0)
      const dias = Number(inv.dias_vencido || 0)
      groups[supKey].total += saldo
      groups[supKey].facturas_count++

      if (dias > 0) {
        groups[supKey].vencido += saldo
      } else {
        const d = Math.abs(dias)
        if (d <= 30) groups[supKey].dias_1_30 += saldo
        else if (d <= 60) groups[supKey].dias_31_60 += saldo
        else groups[supKey].dias_mas_60 += saldo
      }
    })

    return Object.values(groups).sort((a, b) => b.total - a.total)
  }, [invoices, supplierMap])

  // Filtro facturas
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = !search ||
        (inv.numero_factura || "").toLowerCase().includes(search.toLowerCase()) ||
        (inv.supplier_nombre || "").toLowerCase().includes(search.toLowerCase()) ||
        (supplierMap[inv.supplier_id] || "").toLowerCase().includes(search.toLowerCase())

      const matchesSupplier = filterSupplier === "all" || inv.supplier_id === filterSupplier
      const dias = Number(inv.dias_vencido || 0)
      const matchesVencimiento =
        filterVencimiento === "all" ||
        (filterVencimiento === "vencidas" && dias > 0) ||
        (filterVencimiento === "al_dia" && dias <= 0) ||
        (filterVencimiento === "urgente_7d" && dias <= 0 && Math.abs(dias) <= 7)

      return matchesSearch && matchesSupplier && matchesVencimiento
    })
  }, [invoices, search, filterSupplier, filterVencimiento, supplierMap])

  // Filtro órdenes de pago
  const filteredOrders = useMemo(() => {
    return paymentOrders.filter(o => {
      const matchesSearch = !searchOrders ||
        (o.numero_orden || "").toLowerCase().includes(searchOrders.toLowerCase()) ||
        (o.supplier_nombre || "").toLowerCase().includes(searchOrders.toLowerCase()) ||
        (o.recibo_proveedor || "").toLowerCase().includes(searchOrders.toLowerCase())

      const matchesEstado = filterOrderEstado === "all" || o.estado === filterOrderEstado
      const matchesSupplier = filterOrderSupplier === "all" || o.supplier_id === filterOrderSupplier
      const matchesFormaPago = filterOrderFormaPago === "all" ||
        (o.formas_pago_resumen || "").toLowerCase().includes(filterOrderFormaPago.toLowerCase())

      return matchesSearch && matchesEstado && matchesSupplier && matchesFormaPago
    })
  }, [paymentOrders, searchOrders, filterOrderEstado, filterOrderSupplier, filterOrderFormaPago])

  // Selección múltiple facturas
  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoices(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAllFiltered = () => {
    if (selectedInvoices.length === filteredInvoices.length) setSelectedInvoices([])
    else setSelectedInvoices(filteredInvoices.map(i => i.id))
  }

  const selectedInvoicesObjs = useMemo(() => {
    return invoices.filter(i => selectedInvoices.includes(i.id))
  }, [invoices, selectedInvoices])

  const selectedTotal = useMemo(() => {
    return selectedInvoicesObjs.reduce((s, i) => s + Number(i.saldo_pendiente || i.total || 0), 0)
  }, [selectedInvoicesObjs])

  // Verificar si las facturas seleccionadas son del mismo proveedor
  const sameSupplierSelected = useMemo(() => {
    if (selectedInvoicesObjs.length === 0) return null
    const firstSupId = selectedInvoicesObjs[0].supplier_id
    const isSame = selectedInvoicesObjs.every(i => i.supplier_id === firstSupId)
    if (!isSame) return null
    return {
      id: firstSupId,
      razon_social: selectedInvoicesObjs[0].supplier_nombre || supplierMap[firstSupId] || "Proveedor",
      ruc: suppliers.find((s: any) => s.id === firstSupId)?.ruc
    }
  }, [selectedInvoicesObjs, supplierMap, suppliers])

  // Abrir Modal Orden de Pago para facturas seleccionadas
  const handleOpenOrderModalForSelection = () => {
    if (!sameSupplierSelected) {
      toast.error(
        "Proveedores Múltiples",
        "Para emitir una Orden de Pago multifactura, todas las facturas seleccionadas deben ser del mismo proveedor."
      )
      return
    }

    setOrderModalData({
      supplier: sameSupplierSelected,
      initialInvoices: selectedInvoicesObjs,
      availableInvoices: invoices.filter(i => i.supplier_id === sameSupplierSelected.id),
      existingOrder: null,
    })
  }

  // Abrir Modal Orden de Pago individual
  const handleOpenIndividualOrderModal = (inv: any) => {
    const sup = {
      id: inv.supplier_id,
      razon_social: inv.supplier_nombre || supplierMap[inv.supplier_id] || "Proveedor",
      ruc: suppliers.find((s: any) => s.id === inv.supplier_id)?.ruc
    }
    setOrderModalData({
      supplier: sup,
      initialInvoices: [inv],
      availableInvoices: invoices.filter(i => i.supplier_id === inv.supplier_id),
      existingOrder: null,
    })
  }

  // Abrir Modal para Liquidar una orden previamente registrada
  const handleOpenDisburseForOrder = async (order: SupplierPaymentOrder) => {
    try {
      setLoading(true)
      const detail = await api.financial.paymentOrders.get(order.id)
      const sup = {
        id: detail.supplier_id,
        razon_social: detail.supplier_nombre,
        ruc: detail.supplier_ruc,
      }
      setOrderModalData({
        supplier: sup,
        initialInvoices: [],
        availableInvoices: [],
        existingOrder: detail,
      })
    } catch (err: any) {
      toast.error("Error al cargar orden", err.message)
    } finally {
      setLoading(false)
    }
  }

  // Ver detalle de una orden
  const handleOpenOrderDetail = async (order: SupplierPaymentOrder) => {
    try {
      const detail = await api.financial.paymentOrders.get(order.id)
      setDetailOrder(detail)
    } catch (err: any) {
      toast.error("Error al cargar detalle de orden", err.message)
    }
  }

  // Descarga directa de reporte consolidado PDF
  const handleExportReportPdf = async () => {
    setExportingReportPdf(true)
    try {
      await api.financial.paymentOrders.exportReportPdf({
        estado: filterOrderEstado !== "all" ? filterOrderEstado : undefined,
        forma_pago: filterOrderFormaPago !== "all" ? filterOrderFormaPago : undefined,
      })
      toast.success("Reporte Exportado", "Se generó el reporte consolidado oficial en PDF.")
    } catch (err: any) {
      toast.error("Error al generar PDF", err.message)
    } finally {
      setExportingReportPdf(false)
    }
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in max-w-7xl mx-auto px-2 sm:px-4">
      {/* 🌟 HERO INSTITUCIONAL EXTRA SUPERMERCADO */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/40 border border-slate-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-600/30 text-white font-black">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Módulo AP & Tesorería
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {analytics.totalFacturas} Facturas por Pagar
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {analytics.ordenesRegistradas} OPs Pendientes
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Pagos a Proveedores & Órdenes de Pago
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Flujo integral AP de 2 pasos, amortización multifactura/parcial, desembolso multimedio (Bóveda, Fondo Fijo, SIPAP, Cheques Diferidos, NC) y recibos oficiales PDF.
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-rose-300">
                💰 {formatPYG(analytics.totalDeuda)} deuda total
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                ⚠️ {analytics.vencidasCount} vencidas ({formatPYG(analytics.vencidasMonto)})
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                ✅ {formatPYG(analytics.totalPagadoMes)} amortizado
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-rose-400" : ""}`} />
            </button>
            <button
              onClick={handleExportReportPdf}
              disabled={exportingReportPdf}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
              title="Exportar Reporte Consolidado Analítico en PDF"
            >
              <Download className="w-4 h-4 text-rose-400" />
              <span>{exportingReportPdf ? "Generando..." : "Reporte Pagos PDF"}</span>
            </button>

            {/* BOTÓN LOTE BRASIL / MULTI-PROVEEDOR SIEMPRE ACCESIBLE */}
            <button
              onClick={() => setShowMultiSupplierModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-950/20"
              title="Pago agrupado multi-proveedor o compras en R$ contra un único instrumento financiero"
            >
              <Globe className="w-4 h-4 text-emerald-300" />
              <span>Lote Brasil</span>
            </button>

            {/* BOTÓN LIQUIDACIÓN DE VALES / FRUTIHORTI EN VENTANILLA */}
            <button
              onClick={() => {
                setValesModalSupplierId(null)
                setShowValesModal(true)
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-700 via-emerald-700 to-green-700 hover:from-teal-600 hover:to-green-600 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-md shadow-emerald-950/25 border border-emerald-500/30"
              title="Liquidación de notas de entrega y control interno diarias (Frutihorti / Verdulería / Panadería) con factura legal y pago en ventanilla"
            >
              <Apple className="w-4 h-4 text-emerald-300" />
              <span>Liquidar Vales / Frutihorti</span>
            </button>

            {/* BOTONES MULTIFACTURA DINÁMICOS */}
            {selectedInvoices.length > 0 && (
              sameSupplierSelected ? (
                <button
                  onClick={handleOpenOrderModalForSelection}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-rose-500/25 animate-pulse"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Generar OP Multifactura ({selectedInvoices.length})</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowMultiSupplierModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-emerald-500/25 animate-pulse"
                >
                  <Globe className="w-4 h-4" />
                  <span>Pago Lote Brasil ({selectedInvoices.length} facturas)</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deuda Total</span>
              <DollarSign className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-rose-400 truncate" title={formatPYG(analytics.totalDeuda)}>
              {formatPYG(analytics.totalDeuda)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">{analytics.totalFacturas} facturas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Vencidas</span>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-red-400">
              {analytics.vencidasCount}
            </p>
            <p className="text-[11px] text-red-400 font-mono font-bold">{formatPYG(analytics.vencidasMonto)}</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">OPs Registradas</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {analytics.ordenesRegistradas}
            </p>
            <p className="text-[11px] text-slate-400">Pendientes liquidación</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">OPs Liquidadas</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {analytics.ordenesPagadas}
            </p>
            <p className="text-[11px] text-slate-400">Comprobantes listos</p>
          </div>

          <div
            onClick={() => setTab("aging")}
            className="space-y-1 bg-slate-900/60 hover:bg-slate-850 p-3.5 rounded-2xl border border-slate-800/80 hover:border-purple-500/40 transition cursor-pointer group"
            title="Ver Matriz de Proveedores con Deudas"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 group-hover:text-purple-300 uppercase tracking-wider">Proveedores Deuda</span>
              <Building2 className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {analytics.proveedoresConDeuda}
            </p>
            <p className="text-[11px] text-slate-400 group-hover:text-purple-400 flex items-center gap-1 font-bold">
              Ver Aging AP <ArrowRight className="w-3 h-3" />
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lotes de Pago</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-indigo-300">
              {paymentRuns.length}
            </p>
            <p className="text-[11px] text-slate-400">Órdenes masivas</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-850/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "facturas", label: "Facturas Comerciales por Pagar", icon: FileText, count: invoices.length },
          { id: "ordenes_pago", label: "Órdenes de Pago & Recibos AP", icon: Wallet, count: paymentOrders.length },
          { id: "aging", label: "Matriz Aging por Proveedor", icon: Calendar, count: supplierAging.length },
          { id: "lotes", label: "Lotes Masivos SIPAP", icon: Layers, count: paymentRuns.length },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as ApTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                active
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: FACTURAS POR PAGAR ────────────────────────────────────── */}
      {tab === "facturas" && (
        <div className="space-y-4">
          {/* BARRA DE FILTROS */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por N° factura, proveedor o RUC..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
                />
              </div>

              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium max-w-[200px]"
              >
                <option value="all">Todos los Proveedores</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.razon_social || s.nombre}</option>
                ))}
              </select>

              <select
                value={filterVencimiento}
                onChange={(e) => setFilterVencimiento(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
              >
                <option value="all">Cualquier Estado</option>
                <option value="vencidas">Solo Vencidas</option>
                <option value="urgente_7d">Vencen en ≤ 7 días</option>
                <option value="al_dia">Al Día (Normal)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-mono">
                {filteredInvoices.length} facturas
              </span>
              {selectedInvoices.length > 0 && (
                <span className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-200 dark:border-rose-900/50">
                  {selectedInvoices.length} marcadas ({formatPYG(selectedTotal)})
                </span>
              )}
            </div>
          </div>

          {/* TABLA DE FACTURAS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-xs">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No hay facturas que coincidan</p>
                <p className="mt-1">Probá cambiando los filtros o el término de búsqueda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-850/80 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5 text-center w-12">
                        <button onClick={selectAllFiltered} className="p-1 hover:text-rose-600 transition" title="Seleccionar todas">
                          {selectedInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th className="p-3.5">N° Factura / Proveedor</th>
                      <th className="p-3.5">Vencimiento & Estado</th>
                      <th className="p-3.5 text-right">Saldo Pendiente</th>
                      <th className="p-3.5 text-center">Condición</th>
                      <th className="p-3.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredInvoices.slice(0, 100).map((inv: any) => {
                      const isSelected = selectedInvoices.includes(inv.id)
                      const dias = Number(inv.dias_vencido || 0)
                      const esVencida = dias > 0
                      const esUrgente = dias <= 0 && Math.abs(dias) <= 7

                      return (
                        <tr
                          key={inv.id}
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition ${
                            isSelected ? "bg-rose-50/40 dark:bg-rose-950/20" : ""
                          }`}
                        >
                          <td className="p-3.5 text-center">
                            <button onClick={() => toggleSelectInvoice(inv.id)} className="p-1">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                              )}
                            </button>
                          </td>
                          <td className="p-3.5">
                            <p className="font-extrabold text-slate-900 dark:text-white font-mono">{inv.numero_factura || "Factura S/N"}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSelected360SupplierId(inv.supplier_id)
                                setSelected360SupplierNombre(inv.supplier_nombre || supplierMap[inv.supplier_id])
                              }}
                              className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white font-bold text-[10px] transition group border border-rose-200/60 dark:border-rose-900/40"
                              title="Abrir Visión 360° del Proveedor"
                            >
                              <Building2 className="w-3 h-3" />
                              <span className="truncate max-w-[180px]">{inv.supplier_nombre || supplierMap[inv.supplier_id] || "Proveedor"}</span>
                              <span className="text-[9px] bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 group-hover:bg-white group-hover:text-rose-700 px-1 py-0.2 rounded font-black">
                                360°
                              </span>
                            </button>
                          </td>
                          <td className="p-3.5">
                            <p className="font-mono text-slate-700 dark:text-slate-300">{inv.fecha_vencimiento ? formatDate(inv.fecha_vencimiento) : "Sin fecha"}</p>
                            <span className={`inline-block mt-0.5 text-[9px] font-black uppercase px-2 py-0.2 rounded-full ${
                              esVencida
                                ? "text-red-700 bg-red-100 dark:bg-red-950/50"
                                : esUrgente
                                  ? "text-amber-700 bg-amber-100 dark:bg-amber-950/50"
                                  : "text-emerald-700 bg-emerald-100 dark:bg-emerald-950/50"
                            }`}>
                              {esVencida ? `Vencida (+${dias}d)` : esUrgente ? `Vence en ${Math.abs(dias)}d` : `Al día (${Math.abs(dias)}d rest.)`}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                            {formatCurrency(inv.saldo_pendiente || inv.total, inv.moneda)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">{inv.condicion || "Crédito"}</span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleOpenIndividualOrderModal(inv)}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-extrabold text-[11px] transition shadow-sm flex items-center gap-1 ml-auto"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>Pagar / OP</span>
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
        </div>
      )}

      {/* ── TAB 2: HISTORIAL DE ÓRDENES DE PAGO (AP) ────────────────────────── */}
      {tab === "ordenes_pago" && (
        <div className="space-y-4">
          {/* BARRA DE FILTROS DE ÓRDENES */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 flex-1 min-w-[280px] flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por N° orden, proveedor o recibo..."
                  value={searchOrders}
                  onChange={(e) => setSearchOrders(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <select
                value={filterOrderEstado}
                onChange={(e) => setFilterOrderEstado(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
              >
                <option value="all">Todos los Estados</option>
                <option value="registrado">🟡 Registrado (Pte. Pago)</option>
                <option value="pagado">🟢 Pagado (Liquidado)</option>
              </select>

              <select
                value={filterOrderFormaPago}
                onChange={(e) => setFilterOrderFormaPago(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
              >
                <option value="all">Cualquier Medio de Pago</option>
                <option value="boveda">Bóveda Central</option>
                <option value="fondo_fijo">Fondo Fijo (Caja Chica)</option>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="cheque">Cheques</option>
                <option value="nota_credito">Notas de Crédito</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportReportPdf}
                disabled={exportingReportPdf}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-rose-400" />
                <span>PDF Consolidado</span>
              </button>
            </div>
          </div>

          {/* TABLA DE ÓRDENES DE PAGO */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-xs">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No hay órdenes de pago registradas</p>
                <p className="mt-1">Seleccioná facturas en la primera pestaña para generar una orden de pago.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-850/80 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">N° Orden & Fecha</th>
                      <th className="p-3.5">Proveedor</th>
                      <th className="p-3.5 text-center">Facturas</th>
                      <th className="p-3.5">Medios de Pago Asignados</th>
                      <th className="p-3.5 text-right">Monto Neto</th>
                      <th className="p-3.5 text-center">Estado</th>
                      <th className="p-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredOrders.map((order) => {
                      const isPaid = order.estado === "pagado"
                      const isRegistrado = order.estado === "registrado"

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3.5">
                            <p className="font-mono font-black text-slate-900 dark:text-white text-xs">{order.numero_orden}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {formatDate(order.fecha_pago || order.fecha_emision)}
                            </p>
                          </td>
                          <td className="p-3.5">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{order.supplier_nombre}</p>
                            <p className="text-[10px] text-slate-400 font-mono">RUC: {order.supplier_ruc || "-"}</p>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                              {order.total_facturas || 1} fac.
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
                              {order.formas_pago_resumen || "-"}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                            {formatPYG(order.monto_neto)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                              isPaid
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            }`}>
                              {order.estado}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isRegistrado && (
                                <button
                                  onClick={() => handleOpenDisburseForOrder(order)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] transition shadow-xs flex items-center gap-1"
                                  title="Liquidar / Asignar Medios de Pago"
                                >
                                  <Wallet className="w-3 h-3" /> Liquidar
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenOrderDetail(order)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                                title="Ver Detalle de la Orden"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => api.financial.paymentOrders.downloadPdf(order.id, order.numero_orden)}
                                className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition"
                                title="Descargar Recibo / OP Oficial PDF"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

      {/* ── TAB 3: AGING POR PROVEEDOR ────────────────────────────────────── */}
      {tab === "aging" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600" /> Matriz de Antigüedad de Deuda (AP Aging)
              </h3>
              <p className="text-[11px] text-slate-400">Deuda estructurada por proveedor y tramos de vencimiento</p>
            </div>
            <button
              onClick={() => api.financial.downloadApAgingPdf()}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Descargar Aging PDF
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-850/80 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Proveedor</th>
                  <th className="p-3.5 text-center">Facturas</th>
                  <th className="p-3.5 text-right text-red-600">Vencido</th>
                  <th className="p-3.5 text-right text-amber-600">1 - 30 Días</th>
                  <th className="p-3.5 text-right text-blue-600">31 - 60 Días</th>
                  <th className="p-3.5 text-right text-slate-500">+60 Días</th>
                  <th className="p-3.5 text-right">Total General</th>
                  <th className="p-3.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {supplierAging.map((s) => (
                  <tr key={s.supplier_id || s.supplier_nombre} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-sans font-bold text-slate-900 dark:text-white">
                      {s.supplier_nombre}
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-500">
                      {s.facturas_count}
                    </td>
                    <td className="p-3.5 text-right font-black text-red-600">
                      {s.vencido > 0 ? formatPYG(s.vencido) : "-"}
                    </td>
                    <td className="p-3.5 text-right font-black text-amber-600">
                      {s.dias_1_30 > 0 ? formatPYG(s.dias_1_30) : "-"}
                    </td>
                    <td className="p-3.5 text-right font-black text-blue-500">
                      {s.dias_31_60 > 0 ? formatPYG(s.dias_31_60) : "-"}
                    </td>
                    <td className="p-3.5 text-right text-slate-400">
                      {s.dias_mas_60 > 0 ? formatPYG(s.dias_mas_60) : "-"}
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900 dark:text-white text-sm">
                      {formatPYG(s.total)}
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      <button
                        onClick={() => {
                          setSelected360SupplierId(s.supplier_id)
                          setSelected360SupplierNombre(s.supplier_nombre)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white font-bold text-[10px] transition flex items-center gap-1 mx-auto"
                        title="Abrir Visión 360° Completa"
                      >
                        <Eye className="w-3 h-3" /> 360°
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: LOTES DE PAGO MASIVO ──────────────────────────────────── */}
      {tab === "lotes" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-600" /> Lotes de Pago Masivo Programados (Payment Runs)
                </h3>
                <p className="text-[11px] text-slate-400">Agrupación de transferencias bancarias masivas para autorización y ejecución</p>
              </div>
            </div>

            {paymentRuns.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Sin lotes de pago pendientes</p>
                <p className="mt-1">Seleccioná facturas en la pestaña "Facturas por Pagar" para generar un lote masivo.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paymentRuns.map((r: any) => (
                  <div key={r.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition flex items-center justify-between text-xs">
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">{r.nombre || "Lote de Pago"}</p>
                      <p className="text-[10px] text-slate-400">Fecha: {r.fecha_programada} · Método: {r.metodo_pago?.replace(/_/g, " ")}</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-mono font-black text-rose-600">{formatPYG(r.monto_total || 0)}</p>
                        <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{r.estado || "pendiente"}</span>
                      </div>
                      <button onClick={async () => {
                        try {
                          await api.financial.paymentRuns.execute(r.id)
                          toast.success("Lote Ejecutado", "Se procesaron las transferencias bancarias.")
                          loadData()
                        } catch (e: any) {
                          toast.error("Error al ejecutar", e.message)
                        }
                      }} className="btn-primary text-[10px] px-3 py-1 bg-emerald-600 hover:bg-emerald-700">
                        Ejecutar Pago
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALES ACTIVOS */}
      {orderModalData && (
        <SupplierPaymentOrderModal
          supplier={orderModalData.supplier}
          initialInvoices={orderModalData.initialInvoices}
          availableInvoices={orderModalData.availableInvoices}
          existingOrder={orderModalData.existingOrder}
          onClose={() => setOrderModalData(null)}
          onSuccess={(order) => {
            setOrderModalData(null)
            loadData()
            setTab("ordenes_pago")
          }}
        />
      )}

      {detailOrder && (
        <SupplierPaymentOrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onDisburseRequest={(ord) => {
            setDetailOrder(null)
            handleOpenDisburseForOrder(ord)
          }}
        />
      )}

      {selected360SupplierId && (
        <Supplier360Modal
          supplierId={selected360SupplierId}
          supplierNombre={selected360SupplierNombre || undefined}
          onClose={() => {
            setSelected360SupplierId(null)
            setSelected360SupplierNombre(null)
          }}
        />
      )}

      {showMultiSupplierModal && (
        <MultiSupplierPaymentModal
          initialInvoices={selectedInvoicesObjs}
          allPayableInvoices={invoices}
          suppliers={suppliers}
          onClose={() => setShowMultiSupplierModal(false)}
          onSuccess={() => {
            setShowMultiSupplierModal(false)
            setSelectedInvoices([])
            loadData()
            setTab("ordenes_pago")
          }}
        />
      )}

      {showValesModal && (
        <LiquidacionValesModal
          suppliers={suppliers}
          initialSupplierId={valesModalSupplierId}
          onClose={() => {
            setShowValesModal(false)
            setValesModalSupplierId(null)
          }}
          onSuccess={() => {
            setShowValesModal(false)
            setValesModalSupplierId(null)
            loadData()
            setTab("ordenes_pago")
          }}
        />
      )}
    </div>
  )
}
