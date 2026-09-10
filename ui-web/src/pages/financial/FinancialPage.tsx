import { useState, useEffect, useMemo } from "react"
import { api, type SupplierInvoice, type Budget, type PaymentRun, type CashFlowProjection, type FinancialDashboard, type BankAccount } from "../../api"
import { formatPYG, formatDate, getTodayAsuncion } from "../../utils/format"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import {
  Search, Plus, Loader2, DollarSign, Building2, Landmark, PiggyBank, TrendingUp,
  BarChart3, CheckCircle, XCircle, AlertTriangle, Receipt, FileText, Calendar, Clock,
  ArrowUpRight, ArrowDownRight, Eye, Trash2, CreditCard, Ban, FileSpreadsheet,
  FileDown, RefreshCw, Sparkles, Filter, ChevronRight, ChevronDown, CheckCircle2, AlertCircle,
  Layers, ShieldCheck, Check, Phone, ArrowRight, HelpCircle, Download,
  Upload, Paperclip, ExternalLink, Wallet
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, BarChart, Bar, Legend, Cell, PieChart as RechartsPie, Pie
} from "recharts"

const FALLBACK_COMPANY_ID = "00000000-0000-0000-0000-000000000010"

type Tab = "dashboard" | "ap" | "pagos" | "cashflow" | "presupuestos" | "credit_notes"

const MOTIVOS_NC = [
  { id: "devolucion_rotura", label: "Devolución por Rotura / Daño Físico", defaultImpact: "recuperacion_merma" },
  { id: "devolucion_vencimiento", label: "Devolución por Vencimiento / Caducidad", defaultImpact: "recuperacion_merma" },
  { id: "diferencia_precio", label: "Diferencia de Precio Pactado vs Facturado", defaultImpact: "otros_ingresos" },
  { id: "error_facturacion", label: "Error de Facturación / Ítems No Solicitados", defaultImpact: "otros_ingresos" },
  { id: "faltante_recepcion", label: "Faltante en Recepción de Mercadería", defaultImpact: "recuperacion_merma" },
  { id: "descuento_acordado", label: "Descuento Comercial Acordado a Posteriori", defaultImpact: "otros_ingresos" },
  { id: "flete_no_pactado", label: "Flete o Gasto No Pactado Reclamado", defaultImpact: "otros_ingresos" },
  { id: "bonificacion_volumen", label: "Bonificación / Rebaja por Volumen de Compra", defaultImpact: "otros_ingresos" },
]

const RUBROS_SUPERMERCADO = [
  { id: "carnes", label: "Carnicería & Aves", color: "#ef4444" },
  { id: "lacteos", label: "Lácteos & Fiambrería", color: "#3b82f6" },
  { id: "panificados", label: "Panadería & Confitería", color: "#f59e0b" },
  { id: "frutas", label: "Frutas & Verduras", color: "#10b981" },
  { id: "bebidas", label: "Bebidas & Licores", color: "#8b5cf6" },
  { id: "almacen", label: "Almacén Seco & Despensa", color: "#ec4899" },
  { id: "limpieza", label: "Limpieza & Perfumería", color: "#06b6d4" },
  { id: "otros", label: "Servicios & Otros", color: "#64748b" },
]

export default function FinancialPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboard, setDashboard] = useState<any>(null)
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [paymentRuns, setPaymentRuns] = useState<PaymentRun[]>([])
  const [cashFlow, setCashFlow] = useState<CashFlowProjection[]>([])
  const [cashFlowSaldoBancario, setCashFlowSaldoBancario] = useState<number | null>(null)
  const [alertConfig, setAlertConfig] = useState<{ activo: boolean; dias_horizonte: number; telefono: string | null } | null>(null)
  const [savingAlertConfig, setSavingAlertConfig] = useState(false)
  const [aging, setAging] = useState<any[]>([])
  const [creditNotes, setCreditNotes] = useState<any[]>([])
  const [supplierReturns, setSupplierReturns] = useState<any[]>([])
  const [paymentQueue, setPaymentQueue] = useState<any>(null)
  const [apApprovals, setApApprovals] = useState<any[]>([])
  const [banks, setBanks] = useState<BankAccount[]>([])

  const { user } = useAuth()
  const companyId = (user as any)?.company_id || FALLBACK_COMPANY_ID

  // Filtros y Búsqueda AP
  const [search, setSearch] = useState("")
  const [filterEstado, setFilterEstado] = useState("todos")
  const [filterRubro, setFilterRubro] = useState("todos")
  const [filterSupplier, setFilterSupplier] = useState("todos")
  const [filterFechaCorte, setFilterFechaCorte] = useState("")
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null)

  // Modales AP y Pagos
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [showPayModal, setShowPayModal] = useState<SupplierInvoice | null>(null)
  const [payForm, setPayForm] = useState({
    monto: "",
    payment_method: "transferencia",
    bank_account_id: "",
    fecha_pago: getTodayAsuncion(),
    referencia: "",
    retencion_iva: "0",
    retencion_renta: "0",
  })
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // Payment Run Builder (Lotes de Pago Masivo)
  const [showPaymentRunWizard, setShowPaymentRunWizard] = useState(false)
  const [runStep, setRunStep] = useState<1 | 2 | 3>(1)
  const [runForm, setRunForm] = useState({
    nombre: `Lote de Pago ${getTodayAsuncion()}`,
    fecha_programada: getTodayAsuncion(),
    metodo_pago: "transferencia",
    bank_account_id: "",
  })
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set())
  const [submittingRun, setSubmittingRun] = useState(false)
  const [activeRunDetail, setActiveRunDetail] = useState<any | null>(null)

  // Presupuestos
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState({
    nombre: "",
    periodo: getTodayAsuncion().slice(0, 7),
    categoria: "Almacén",
    monto_presupuestado: "",
    area: "salon",
    tipo: "egreso",
  })
  const [budgetFilterPeriodo, setBudgetFilterPeriodo] = useState(getTodayAsuncion().slice(0, 7))

  // Exportar PnL
  const [exportingPnl, setExportingPnl] = useState(false)

  // ── Notas de Crédito & Billetera a Favor (Fase 4) ──
  const [allSuppliers, setAllSuppliers] = useState<any[]>([])
  const [showNCModal, setShowNCModal] = useState(false)
  const [ncForm, setNcForm] = useState({
    supplier_id: "",
    numero: "",
    timbrado: "",
    numero_factura_origen: "",
    fecha: getTodayAsuncion(),
    monto: "",
    motivo: "",
    motivo_categoria: "devolucion_rotura",
    impacto_contable: "recuperacion_merma",
    archivo_adjunto_path: "",
    observaciones: "",
  })
  const [uploadingNCFile, setUploadingNCFile] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState("")
  const [submittingNC, setSubmittingNC] = useState(false)

  // Aplicación a Factura
  const [showApplyModal, setShowApplyModal] = useState<any | null>(null)
  const [applyForm, setApplyForm] = useState({
    invoice_id: "",
    monto: "",
    observaciones: "",
  })
  const [submittingApply, setSubmittingApply] = useState(false)

  // Historial de Aplicaciones
  const [showApplicationsModal, setShowApplicationsModal] = useState<any | null>(null)
  const [applicationsList, setApplicationsList] = useState<any[]>([])
  const [loadingApplications, setLoadingApplications] = useState(false)

  // Filtros pestaña NC
  const [ncSearch, setNcSearch] = useState("")
  const [ncFilterSupplier, setNcFilterSupplier] = useState("todos")
  const [ncFilterMotivo, setNcFilterMotivo] = useState("todos")
  const [ncFilterImpacto, setNcFilterImpacto] = useState("todos")

  const toast = useToast()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [
        dashData,
        invData,
        agingData,
        runsData,
        cfData,
        budData,
        cnData,
        retData,
        pqData,
        apprData,
        banksData,
        supsData,
      ] = await Promise.allSettled([
        api.financial.apDashboard(),
        api.financial.invoices.list({ limit: 2500 }),
        api.financial.aging().catch(() => ({ por_supplier: [] })),
        api.financial.paymentRuns.list(),
        api.financial.cashFlow.list(),
        api.financial.budgets.list(),
        api.financial.creditNotes.list ? api.financial.creditNotes.list() : api.financial.creditNotes().catch(() => []),
        api.financial.supplierReturns().catch(() => []),
        api.financial.paymentQueue().catch(() => null),
        api.financial.apApprovals.list("pendiente").catch(() => []),
        api.financial.banks.list().catch(() => []),
        api.purchases.suppliers().catch(() => []),
      ])

      if (dashData.status === "fulfilled") setDashboard(dashData.value)
      if (invData.status === "fulfilled") setInvoices(invData.value)
      if (agingData.status === "fulfilled") setAging((agingData.value as any)?.por_supplier || [])
      if (runsData.status === "fulfilled") setPaymentRuns(runsData.value)
      if (cfData.status === "fulfilled") setCashFlow(cfData.value)
      if (budData.status === "fulfilled") setBudgets(budData.value)
      if (cnData.status === "fulfilled") setCreditNotes(cnData.value)
      if (retData.status === "fulfilled") setSupplierReturns(retData.value)
      if (pqData.status === "fulfilled") setPaymentQueue(pqData.value)
      if (apprData.status === "fulfilled") setApApprovals(apprData.value)
      if (banksData.status === "fulfilled") setBanks(banksData.value)
      if (supsData.status === "fulfilled") setAllSuppliers(supsData.value || [])
    } catch {
      toast.error("Error", "No se pudieron sincronizar los datos financieros")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleUploadNCFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingNCFile(true)
    try {
      const res = await api.financial.creditNotes.uploadAttachment(file)
      setNcForm(prev => ({ ...prev, archivo_adjunto_path: res.url }))
      setUploadedFileName(file.name)
      toast.success("Archivo subido", `Comprobante adjuntado: ${file.name}`)
    } catch (err: any) {
      toast.error("Error al subir", err.message || "No se pudo subir el archivo")
    } finally {
      setUploadingNCFile(false)
    }
  }

  const handleCreateNC = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ncForm.supplier_id) return toast.error("Campo requerido", "Seleccione un proveedor")
    if (!ncForm.numero) return toast.error("Campo requerido", "Ingrese el número de la Nota de Crédito")
    if (!ncForm.monto || Number(ncForm.monto) <= 0) return toast.error("Monto inválido", "El monto debe ser mayor a 0")
    if (!ncForm.motivo) return toast.error("Campo requerido", "Ingrese la descripción del motivo")

    setSubmittingNC(true)
    try {
      await api.financial.creditNotes.create({
        supplier_id: ncForm.supplier_id,
        numero: ncForm.numero,
        timbrado: ncForm.timbrado || undefined,
        numero_factura_origen: ncForm.numero_factura_origen || undefined,
        fecha: ncForm.fecha,
        motivo: ncForm.motivo,
        motivo_categoria: ncForm.motivo_categoria,
        impacto_contable: ncForm.impacto_contable,
        archivo_adjunto_path: ncForm.archivo_adjunto_path || undefined,
        monto: Number(ncForm.monto),
        moneda: "PYG",
        observaciones: ncForm.observaciones || undefined,
      })
      toast.success("Nota de Crédito Registrada", "Se incorporó al saldo a favor de la empresa")
      setShowNCModal(false)
      setNcForm({
        supplier_id: "",
        numero: "",
        timbrado: "",
        numero_factura_origen: "",
        fecha: getTodayAsuncion(),
        monto: "",
        motivo: "",
        motivo_categoria: "devolucion_rotura",
        impacto_contable: "recuperacion_merma",
        archivo_adjunto_path: "",
        observaciones: "",
      })
      setUploadedFileName("")
      fetchAll()
    } catch (err: any) {
      toast.error("Error al registrar", err.message || "No se pudo crear la Nota de Crédito")
    } finally {
      setSubmittingNC(false)
    }
  }

  const handleOpenApplyModal = (nc: any) => {
    setShowApplyModal(nc)
    const supInvoices = invoices.filter(i => i.supplier_id === nc.supplier_id && Number(i.saldo_pendiente || 0) > 0)
    const firstInv = supInvoices[0]
    const saldoNC = Number(nc.saldo_disponible !== undefined ? nc.saldo_disponible : nc.monto)
    const initMonto = firstInv ? Math.min(saldoNC, Number(firstInv.saldo_pendiente || 0)) : saldoNC
    setApplyForm({
      invoice_id: firstInv ? firstInv.id : "",
      monto: String(initMonto),
      observaciones: `Aplicación de NC ${nc.numero} a Factura`,
    })
  }

  const handleApplyNC = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showApplyModal) return
    if (!applyForm.invoice_id) return toast.error("Campo requerido", "Seleccione una factura pendiente")
    if (!applyForm.monto || Number(applyForm.monto) <= 0) return toast.error("Monto inválido", "El monto a aplicar debe ser mayor a 0")

    setSubmittingApply(true)
    try {
      await api.financial.creditNotes.apply(showApplyModal.id, {
        invoice_id: applyForm.invoice_id,
        monto: Number(applyForm.monto),
        observaciones: applyForm.observaciones || undefined,
      })
      toast.success("Saldo Aplicado Exitosamente", "La factura ha sido amortizada con la Nota de Crédito")
      setShowApplyModal(null)
      fetchAll()
    } catch (err: any) {
      toast.error("Error al aplicar", err.message || "No se pudo aplicar la Nota de Crédito")
    } finally {
      setSubmittingApply(false)
    }
  }

  const handleViewApplications = async (nc: any) => {
    setShowApplicationsModal(nc)
    setLoadingApplications(true)
    try {
      const data = await api.financial.creditNotes.applications(nc.id)
      setApplicationsList(Array.isArray(data) ? data : [])
    } catch {
      setApplicationsList([])
    } finally {
      setLoadingApplications(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleExportPnl = async () => {
    setExportingPnl(true)
    try {
      await api.gerencial.exportPnlPdf()
      toast.success("Descargado", "Estado de Resultados generado en PDF")
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo exportar el Estado de Resultados")
    } finally {
      setExportingPnl(false)
    }
  }

  // Lista de proveedores únicos para el filtro
  const availableSuppliers = useMemo(() => {
    const map = new Map<string, string>()
    invoices.forEach(inv => {
      if (inv.supplier_id && inv.supplier_nombre) {
        map.set(inv.supplier_id, inv.supplier_nombre)
      }
    })
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [invoices])

  // Filtrado de Facturas AP
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch =
        !search ||
        inv.numero_factura?.toLowerCase().includes(search.toLowerCase()) ||
        inv.supplier_nombre?.toLowerCase().includes(search.toLowerCase()) ||
        inv.timbrado?.includes(search)

      const isPendiente = !!inv.estado && ["pendiente", "aprobada", "parcial"].includes(inv.estado) && Number(inv.saldo_pendiente ?? inv.total ?? 0) > 0
      const isVencida = isPendiente && !!inv.fecha_vencimiento && new Date(inv.fecha_vencimiento) < new Date()
      let matchEstado = true
      if (filterEstado === "pendiente") matchEstado = isPendiente
      if (filterEstado === "pagada") matchEstado = inv.estado === "pagada"
      if (filterEstado === "vencida") matchEstado = !!isVencida

      let matchSupplier = true
      if (filterSupplier !== "todos") {
        matchSupplier = inv.supplier_id === filterSupplier
      }

      let matchCorte = true
      if (filterFechaCorte && inv.fecha_emision) {
        matchCorte = String(inv.fecha_emision).slice(0, 10) <= filterFechaCorte
      }

      return matchSearch && matchEstado && matchSupplier && matchCorte
    })
  }, [invoices, search, filterEstado, filterSupplier, filterFechaCorte])

  // Métricas Clave de Proveedores (Calculadas desde el Backend Completo)
  const totalDeudaAP = useMemo(() => {
    if (dashboard?.total_pendiente != null) return Number(dashboard.total_pendiente)
    return invoices
      .filter(i => i.estado === "pendiente")
      .reduce((sum, i) => sum + Number(i.saldo_pendiente ?? i.total ?? 0), 0)
  }, [dashboard, invoices])

  const facturasVencidas = useMemo(() => {
    const today = getTodayAsuncion()
    return invoices.filter(i => i.estado === "pendiente" && i.fecha_vencimiento && i.fecha_vencimiento < today)
  }, [invoices])

  const montoVencidoAP = useMemo(() => {
    if (dashboard?.total_vencido != null) return Number(dashboard.total_vencido)
    return facturasVencidas.reduce((sum, i) => sum + Number(i.saldo_pendiente ?? i.total ?? 0), 0)
  }, [dashboard, facturasVencidas])

  const cantFacturasPendientes = useMemo(() => {
    return dashboard?.facturas_pendientes ?? invoices.filter(i => i.estado === "pendiente").length
  }, [dashboard, invoices])

  const cantFacturasVencidas = useMemo(() => {
    return dashboard?.facturas_vencidas ?? facturasVencidas.length
  }, [dashboard, facturasVencidas])

  const totalNotasCredito = useMemo(() => {
    return creditNotes.reduce((sum, c) => sum + Number(c.monto || 0), 0)
  }, [creditNotes])

  const totalSaldoDisponibleNC = useMemo(() => {
    return creditNotes.reduce((sum, c) => sum + Number(c.saldo_disponible !== undefined ? c.saldo_disponible : c.monto || 0), 0)
  }, [creditNotes])

  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter(cn => {
      const matchSearch =
        !ncSearch ||
        cn.numero?.toLowerCase().includes(ncSearch.toLowerCase()) ||
        cn.numero_factura_origen?.toLowerCase().includes(ncSearch.toLowerCase()) ||
        cn.supplier_nombre?.toLowerCase().includes(ncSearch.toLowerCase()) ||
        cn.motivo?.toLowerCase().includes(ncSearch.toLowerCase())

      const matchSupplier = ncFilterSupplier === "todos" || cn.supplier_id === ncFilterSupplier
      const matchMotivo = ncFilterMotivo === "todos" || cn.motivo_categoria === ncFilterMotivo
      const matchImpacto = ncFilterImpacto === "todos" || cn.impacto_contable === ncFilterImpacto

      return matchSearch && matchSupplier && matchMotivo && matchImpacto
    })
  }, [creditNotes, ncSearch, ncFilterSupplier, ncFilterMotivo, ncFilterImpacto])

  const weeklyDueData = useMemo(() => {
    const weeks: Record<string, number> = { "Vencidas": 0, "Semana 1": 0, "Semana 2": 0, "Semana 3": 0, "Semana 4+": 0 }
    const todayStr = getTodayAsuncion()
    const nowTime = new Date(`${todayStr}T12:00:00`).getTime()

    invoices.filter(i => i.estado === "pendiente").forEach(i => {
      const saldo = Number(i.saldo_pendiente ?? i.total ?? 0)
      if (!i.fecha_vencimiento || i.fecha_vencimiento < todayStr) {
        weeks["Vencidas"] += saldo
      } else {
        const diffDays = Math.ceil((new Date(`${i.fecha_vencimiento}T12:00:00`).getTime() - nowTime) / (1000 * 3600 * 24))
        if (diffDays <= 7) weeks["Semana 1"] += saldo
        else if (diffDays <= 14) weeks["Semana 2"] += saldo
        else if (diffDays <= 21) weeks["Semana 3"] += saldo
        else weeks["Semana 4+"] += saldo
      }
    })

    return Object.entries(weeks).map(([name, monto]) => ({ name, monto }))
  }, [invoices])

  // Manejo de Pagos Directos
  const handleOpenPayModal = (inv: SupplierInvoice) => {
    setShowPayModal(inv)
    setPayForm({
      monto: String(inv.saldo_pendiente ?? inv.total ?? ""),
      payment_method: "transferencia",
      bank_account_id: banks[0]?.id || "",
      fecha_pago: getTodayAsuncion(),
      referencia: "",
      retencion_iva: "0",
      retencion_renta: "0",
    })
  }

  const handleConfirmDirectPayment = async () => {
    if (!showPayModal) return
    setSubmittingPayment(true)
    try {
      await api.financial.invoices.pay(showPayModal.id, {
        monto: Number(payForm.monto),
        payment_method: payForm.payment_method,
        fecha_pago: payForm.fecha_pago,
        referencia: payForm.referencia || undefined,
      })
      toast.success("Pago registrado", `Pago de ${formatPYG(Number(payForm.monto))} aplicado a factura ${showPayModal.numero_factura}`)
      setShowPayModal(null)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al registrar pago", e.message)
    } finally {
      setSubmittingPayment(false)
    }
  }

  // Payment Run Wizard
  const handleToggleInvoiceSelection = (id: string) => {
    const next = new Set(selectedInvoiceIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedInvoiceIds(next)
  }

  const handleSelectAllInvoices = () => {
    if (selectedInvoiceIds.size === invoices.filter(i => i.estado === "pendiente").length) {
      setSelectedInvoiceIds(new Set())
    } else {
      setSelectedInvoiceIds(new Set(invoices.filter(i => i.estado === "pendiente").map(i => i.id)))
    }
  }

  const selectedInvoicesList = useMemo(() => {
    return invoices.filter(i => selectedInvoiceIds.has(i.id))
  }, [invoices, selectedInvoiceIds])

  const totalSelectedRun = useMemo(() => {
    return selectedInvoicesList.reduce((sum, i) => sum + Number(i.saldo_pendiente ?? i.total ?? 0), 0)
  }, [selectedInvoicesList])

  const handleCreatePaymentRun = async () => {
    if (selectedInvoiceIds.size === 0) {
      toast.error("Selección requerida", "Marcá al menos una factura para el lote de pago")
      return
    }
    setSubmittingRun(true)
    try {
      const res = await api.financial.paymentRuns.create({
        nombre: runForm.nombre,
        fecha_programada: runForm.fecha_programada,
        metodo_pago: runForm.metodo_pago,
        bank_account_id: runForm.bank_account_id || undefined,
        invoice_ids: Array.from(selectedInvoiceIds),
      })
      toast.success("Lote de pago creado", `Lote "${runForm.nombre}" generado con ${selectedInvoiceIds.size} facturas por ${formatPYG(totalSelectedRun)}`)
      setShowPaymentRunWizard(false)
      setSelectedInvoiceIds(new Set())
      setRunStep(1)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al crear lote", e.message)
    } finally {
      setSubmittingRun(false)
    }
  }

  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Landmark className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    FINANZAS & TESORERÍA · GESTIÓN INTEGRAL & CASH FLOW
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    {cantFacturasPendientes} Facturas en Cartera
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Gestión Financiera & Tesorería
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Pasivos comerciales, curvas de vencimiento, lotes de pago masivo SIPAP y proyección de flujo de caja a 90 días
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                💰 {formatPYG(totalDeudaAP)} deuda total
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🛡️ {formatPYG(totalNotasCredito)} NC a favor
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => { setRefreshing(true); fetchAll(); }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <button
              onClick={handleExportPnl}
              disabled={exportingPnl}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              {exportingPnl ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-rose-400" />}
              <span>PyG PDF</span>
            </button>
            <button
              onClick={() => { setShowPaymentRunWizard(true); setRunStep(1); }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              <Layers className="w-4 h-4" />
              <span>Nuevo Lote SIPAP</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deuda Total (AP)</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {formatPYG(totalDeudaAP)}
            </p>
            <p className="text-[11px] text-slate-400">{cantFacturasPendientes} facturas ({dashboard?.proveedores_con_deuda || aging.length || 70} prov.)</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deuda Vencida</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {formatPYG(montoVencidoAP)}
            </p>
            <p className="text-[11px] text-rose-400 font-bold font-mono">{cantFacturasVencidas} facturas vencidas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Notas de Crédito</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(totalNotasCredito)}
            </p>
            <p className="text-[11px] text-slate-400">{creditNotes.length} notas disponibles</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lotes Ejecutados</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {paymentRuns.length}
            </p>
            <p className="text-[11px] text-slate-400">Órdenes bancarias masivas</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "dashboard", label: "Torre de Control AP", icon: BarChart3 },
          { key: "ap", label: "Cuentas por Pagar (Facturas)", icon: Receipt, count: cantFacturasPendientes },
          { key: "credit_notes", label: "Notas de Crédito Proveedores", icon: FileText, count: creditNotes.length },
          { key: "pagos", label: "Lotes de Pago (Payment Runs)", icon: Layers, count: paymentRuns.length },
          { key: "cashflow", label: "Flujo de Caja (90 Días)", icon: TrendingUp },
          { key: "presupuestos", label: "Presupuestos por Sector", icon: PiggyBank, count: budgets.length },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* TAB 1: TORRE DE CONTROL AP */}
          {tab === "dashboard" && (
            <div className="space-y-6">
              {/* Gráficos de Vencimientos y Rubros */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Vencimientos Semanales */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-500" />
                        Curva de Vencimientos Semanales
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">Distribución cronológica de compromisos de pago</p>
                    </div>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyDueData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} fontSize={11} />
                        <Tooltip formatter={(v: any) => [formatPYG(Number(v)), "Monto"]} />
                        <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                          {weeklyDueData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === "Vencidas" ? "#ef4444" : entry.name === "Semana 1" ? "#f59e0b" : "#3b82f6"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Proveedores Acreedores */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        Top Proveedores con Mayor Saldo Pendiente
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">Concentración de deuda comercial</p>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {aging.slice(0, 8).map((sup: any) => (
                      <div key={sup.supplier_id} className="p-3 rounded-xl border bg-gray-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">{sup.razon_social || sup.supplier_name || "Proveedor"}</div>
                          <div className="text-gray-400 text-[11px] mt-0.5">
                            {sup.vencido > 0 ? (
                              <span className="text-red-500 font-semibold">Vencido: {formatPYG(sup.vencido)}</span>
                            ) : (
                              <span className="text-emerald-500 font-semibold">Al día</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                            {formatPYG(sup.total_pendiente || sup.saldo_total || sup.total || 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Alertas Inteligentes del Finance Agent */}
              <div className="card p-6 bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-slate-800/90 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-4">
                <Sparkles className="w-6 h-6 text-indigo-600 dark:text-amber-400 shrink-0 mt-1" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">Recomendación de Tesorería Supermercado</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Existen <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPYG(totalNotasCredito)}</span> en notas de crédito de proveedores de lácteos y carnes disponibles para compensar. Te sugerimos generar un <strong>Lote de Pago (Payment Run)</strong> para consolidar las facturas de la semana y aplicar las retenciones impositivas de IVA correspondientes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUENTAS POR PAGAR (AP) */}
          {tab === "ap" && (
            <div className="space-y-5">
              {/* Barra de Filtros y Búsqueda */}
              <div className="card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-44">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Estado</label>
                    <select className="input-field w-full text-xs" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                      <option value="todos">Todas las Facturas</option>
                      <option value="pendiente">Solo Pendientes</option>
                      <option value="vencida">Solo Vencidas</option>
                      <option value="pagada">Solo Pagadas</option>
                    </select>
                  </div>

                  <div className="w-56">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Proveedor</label>
                    <select className="input-field w-full text-xs" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
                      <option value="todos">Todos los Proveedores ({availableSuppliers.length})</option>
                      {availableSuppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-40">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Fecha de Corte</label>
                    <input
                      type="date"
                      className="input-field w-full text-xs"
                      value={filterFechaCorte}
                      onChange={e => setFilterFechaCorte(e.target.value)}
                      title="Consultar saldos acumulados emitidos hasta esta fecha"
                    />
                  </div>

                  <div className="flex-1 min-w-[220px]">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Buscar</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Proveedor, RUC, N° factura, timbrado..."
                        className="input-field pl-9 w-full text-xs"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {(filterEstado !== "todos" || filterSupplier !== "todos" || filterFechaCorte || search) && (
                    <div className="self-end">
                      <button
                        onClick={() => { setFilterEstado("todos"); setFilterSupplier("todos"); setFilterFechaCorte(""); setSearch(""); }}
                        className="btn-ghost text-xs py-2 text-gray-400 hover:text-gray-200"
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
                  <span>Mostrando <b>{filteredInvoices.length}</b> facturas de <b>{invoices.length}</b> totales</span>
                  <span>Total Saldo Pendiente Filtrado: <b className="text-gray-900 dark:text-white font-mono">{formatPYG(filteredInvoices.filter(i => !!i.estado && ["pendiente", "aprobada", "parcial"].includes(i.estado)).reduce((acc, i) => acc + Number(i.saldo_pendiente ?? i.total ?? 0), 0))}</b></span>
                </div>
              </div>

              {/* Tabla de Facturas Proveedores con Acordeón de Notas de Crédito */}
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                        <th className="p-3.5 w-10"></th>
                        <th className="p-3.5">Proveedor</th>
                        <th className="p-3.5">N° Factura</th>
                        <th className="p-3.5">Timbrado</th>
                        <th className="p-3.5">Emisión</th>
                        <th className="p-3.5">Vencimiento</th>
                        <th className="p-3.5">Monto Total</th>
                        <th className="p-3.5">Saldo Pendiente</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                      {filteredInvoices.map(inv => {
                        const isVencida = inv.estado === "pendiente" && inv.fecha_vencimiento && new Date(inv.fecha_vencimiento) < new Date()
                        const isExpanded = expandedInvoiceId === inv.id
                        // Notas de crédito vinculadas por número de factura origen o coincidencia
                        const linkedNCs = creditNotes.filter(cn => 
                          (cn.numero_factura_origen && inv.numero_factura && cn.numero_factura_origen.trim() === inv.numero_factura.trim()) ||
                          (cn.supplier_id === inv.supplier_id && cn.numero_factura_origen === inv.numero_factura)
                        )
                        const totalNCAplicadas = linkedNCs.reduce((sum, n) => sum + Number(n.monto || 0), 0)
                        const saldoResultante = Math.max(0, Number(inv.total || 0) - totalNCAplicadas)

                        return (
                          <>
                            <tr key={inv.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? "bg-slate-800/40" : ""}`}>
                              <td className="p-3.5 text-center">
                                <button
                                  onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-slate-700/50 transition"
                                  title="Ver notas de crédito y detalle"
                                >
                                  {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                              </td>
                              <td className="p-3.5 font-bold text-gray-900 dark:text-white max-w-xs truncate" title={inv.supplier_nombre}>
                                <div>{inv.supplier_nombre || "Proveedor General"}</div>
                                {linkedNCs.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                                    <FileText className="w-3 h-3" /> {linkedNCs.length} NC vinculada(s)
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 font-mono font-bold text-xs text-gray-900 dark:text-white">
                                {inv.numero_factura || "—"}
                              </td>
                              <td className="p-3.5 font-mono text-xs text-gray-500">
                                {inv.timbrado || "—"}
                              </td>
                              <td className="p-3.5 text-xs text-gray-500 font-mono">
                                {inv.fecha_emision ? new Date(inv.fecha_emision).toLocaleDateString("es-PY") : "—"}
                              </td>
                              <td className="p-3.5 text-xs font-mono">
                                <span className={isVencida ? "text-red-600 font-bold" : "text-gray-600 dark:text-gray-300"}>
                                  {inv.fecha_vencimiento ? new Date(inv.fecha_vencimiento).toLocaleDateString("es-PY") : "—"}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                                {formatPYG(inv.total)}
                              </td>
                              <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                                {formatPYG(inv.saldo_pendiente ?? inv.total)}
                              </td>
                              <td className="p-3.5">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                  inv.estado === "pagada"
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200"
                                    : isVencida
                                    ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200"
                                }`}>
                                  {inv.estado === "pagada" ? "Pagada" : isVencida ? "Vencida" : "Pendiente"}
                                </span>
                              </td>
                              <td className="p-3.5 text-right whitespace-nowrap">
                                {inv.estado === "pendiente" && (
                                  <button
                                    onClick={() => handleOpenPayModal(inv)}
                                    className="btn-primary py-1 px-2.5 text-xs"
                                  >
                                    Pagar
                                  </button>
                                )}
                              </td>
                            </tr>

                            {/* FILA ACORDEÓN: Notas de Crédito vinculadas a esta factura */}
                            {isExpanded && (
                              <tr className="bg-slate-900/70 border-b border-gray-700/60">
                                <td colSpan={10} className="p-4 pl-12">
                                  <div className="rounded-xl border border-indigo-500/20 bg-slate-950/60 p-4 space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-purple-400" />
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-white">
                                          Notas de Crédito Imputadas a la Factura N° {inv.numero_factura}
                                        </h5>
                                      </div>
                                      <div className="text-xs font-mono text-gray-400">
                                        Saldo original: <b className="text-white">{formatPYG(inv.total)}</b> · Deducciones NC: <b className="text-purple-400">{formatPYG(totalNCAplicadas)}</b> · Saldo Resultante: <b className="text-emerald-400">{formatPYG(saldoResultante)}</b>
                                      </div>
                                    </div>

                                    {linkedNCs.length === 0 ? (
                                      <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-gray-400 text-center">
                                        Sin Notas de Crédito imputadas a este comprobante.
                                      </div>
                                    ) : (
                                      <table className="w-full text-xs text-left">
                                        <thead>
                                          <tr className="text-gray-400 border-b border-gray-800 font-semibold">
                                            <th className="pb-2">N° Nota de Crédito</th>
                                            <th className="pb-2">Timbrado</th>
                                            <th className="pb-2">Fecha</th>
                                            <th className="pb-2">Motivo</th>
                                            <th className="pb-2 text-right">Importe NC</th>
                                            <th className="pb-2 text-right">Saldo Resultante</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800/60 font-mono">
                                          {linkedNCs.map((nc, idx) => (
                                            <tr key={nc.id || idx} className="text-gray-300">
                                              <td className="py-2 text-purple-300 font-bold">{nc.numero}</td>
                                              <td className="py-2 text-gray-400">{nc.timbrado || "—"}</td>
                                              <td className="py-2 text-gray-400">{nc.fecha ? new Date(nc.fecha).toLocaleDateString("es-PY") : "—"}</td>
                                              <td className="py-2 font-sans text-gray-300">{nc.motivo || "Ajuste / Bonificación"}</td>
                                              <td className="py-2 text-right text-purple-400 font-bold">-{formatPYG(nc.monto)}</td>
                                              <td className="py-2 text-right text-emerald-400 font-bold">{formatPYG(saldoResultante)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOTES DE PAGO (PAYMENT RUNS) */}
          {tab === "pagos" && (
            <div className="space-y-6">
              <div className="card p-6 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-slate-800/90 dark:to-slate-900 border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-wider block">Emisión Masiva de Pagos Bancarios</span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Lotes de Pago a Proveedores (SIPAP)</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                    Agrupá múltiples facturas para transferencias masivas vía SIPAP o cheques, con cálculo automático de retenciones y doble firma de seguridad.
                  </p>
                </div>
                <button
                  onClick={() => { setShowPaymentRunWizard(true); setRunStep(1); }}
                  className="btn-primary text-xs flex items-center gap-2 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Crear Nuevo Lote
                </button>
              </div>

              {/* Lista de Lotes Ejecutados */}
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 font-bold text-sm text-gray-900 dark:text-white">
                  Historial de Lotes de Pago ({paymentRuns.length})
                </div>

                {paymentRuns.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    No hay lotes de pago registrados. Hacé clic en "Crear Nuevo Lote" para comenzar.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                          <th className="p-3.5">Nombre del Lote</th>
                          <th className="p-3.5">Fecha Programada</th>
                          <th className="p-3.5">Método de Pago</th>
                          <th className="p-3.5">Monto Total</th>
                          <th className="p-3.5">Estado</th>
                          <th className="p-3.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                        {paymentRuns.map(run => (
                          <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                            <td className="p-3.5 font-bold text-gray-900 dark:text-white">{run.nombre}</td>
                            <td className="p-3.5 text-xs font-mono">{run.fecha_programada}</td>
                            <td className="p-3.5 text-xs capitalize">{run.metodo_pago}</td>
                            <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">{formatPYG(run.total_monto)}</td>
                            <td className="p-3.5">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                run.estado === "ejecutado" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                              }`}>
                                {run.estado}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <button onClick={() => setActiveRunDetail(run)} className="btn-outline py-1 px-2.5 text-xs">
                                Ver Detalle
                              </button>
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

          {/* TAB 4: FLUJO DE CAJA (90 DÍAS) */}
          {tab === "cashflow" && (
            <div className="space-y-6">
              <div className="card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Proyección de Flujo de Caja (Próximos 90 Días)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Estimación diaria de ingresos por ventas y egresos por pagos a proveedores y costos operativos
                    </p>
                  </div>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlow}>
                      <defs>
                        <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="fecha" fontSize={10} tickFormatter={f => f.slice(5)} />
                      <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} fontSize={10} />
                      <Tooltip formatter={(v: any) => [formatPYG(Number(v)), "Saldo Proyectado"]} />
                      <ReferenceLine y={50_000_000} stroke="#ef4444" strokeDasharray="3 3" label="Umbral de Seguridad (50M)" />
                      <Area type="monotone" dataKey="saldo_proyectado" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSaldo)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PRESUPUESTOS POR SECTOR */}
          {tab === "presupuestos" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Presupuestos Operativos de Supermercado</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Control de gastos por sector y rubro de mercaderías</p>
                </div>
                <button onClick={() => setShowBudgetForm(true)} className="btn-primary text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Asignar Presupuesto
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {RUBROS_SUPERMERCADO.map(rubro => (
                  <div key={rubro.id} className="card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">{rubro.label}</span>
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: rubro.color }} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Ejecutado vs Límite</span>
                        <span className="font-bold text-gray-900 dark:text-white">65%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: "65%" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: NOTAS DE CRÉDITO Y BILLETERA A FAVOR DE PROVEEDORES (FASE 4) */}
          {tab === "credit_notes" && (
            <div className="space-y-6">
              {/* Luxury Control Deck */}
              <div className="card p-6 bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-slate-50 dark:from-slate-800/90 dark:via-indigo-950/40 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Billetera a Favor de la Empresa
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Amortización AP
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 mt-1">
                    <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Notas de Crédito Recibidas de Proveedores
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-2xl">
                    Control exhaustivo de compensaciones comerciales, devoluciones físicas por rotura/vencimiento, y diferencias de precio con imputación contable diferenciada y billetera acumulativa de saldos aplicables a facturas.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 shrink-0">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Billetera Disponible</span>
                    <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {formatPYG(totalSaldoDisponibleNC)}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowNCModal(true)}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-indigo-500/25"
                  >
                    <Plus className="w-4 h-4" /> Registrar Nota de Crédito
                  </button>
                </div>
              </div>

              {/* Barra de Filtros */}
              <div className="card p-4 flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por N° NC, N° Factura, proveedor o motivo..."
                    value={ncSearch}
                    onChange={e => setNcSearch(e.target.value)}
                    className="input-field pl-9 text-xs"
                  />
                </div>

                <select
                  value={ncFilterSupplier}
                  onChange={e => setNcFilterSupplier(e.target.value)}
                  className="input-field md:w-56 text-xs"
                >
                  <option value="todos">Todos los Proveedores</option>
                  {allSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.razon_social}</option>
                  ))}
                </select>

                <select
                  value={ncFilterMotivo}
                  onChange={e => setNcFilterMotivo(e.target.value)}
                  className="input-field md:w-56 text-xs"
                >
                  <option value="todos">Todos los Motivos</option>
                  {MOTIVOS_NC.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>

                <select
                  value={ncFilterImpacto}
                  onChange={e => setNcFilterImpacto(e.target.value)}
                  className="input-field md:w-52 text-xs"
                >
                  <option value="todos">Todo Impacto Contable</option>
                  <option value="otros_ingresos">Otros Ingresos (Comercial)</option>
                  <option value="recuperacion_merma">Recup. Merma (Devolución)</option>
                </select>
              </div>

              {/* Tabla de Notas de Crédito */}
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">
                    Historial de Notas de Crédito ({filteredCreditNotes.length})
                  </span>
                  <div className="text-xs text-gray-500">
                    Total Emitido: <span className="font-mono font-bold text-gray-900 dark:text-white">{formatPYG(totalNotasCredito)}</span>
                  </div>
                </div>

                {filteredCreditNotes.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-sm space-y-2">
                    <FileText className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
                    <p className="font-medium">No se encontraron Notas de Crédito con los filtros seleccionados.</p>
                    <p className="text-xs text-gray-400">Podés registrar una nueva haciendo clic en "Registrar Nota de Crédito".</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                          <th className="p-3.5">Proveedor</th>
                          <th className="p-3.5">N° NC & Timbrado</th>
                          <th className="p-3.5">Factura Origen</th>
                          <th className="p-3.5">Fecha</th>
                          <th className="p-3.5">Motivo & Imputación</th>
                          <th className="p-3.5 text-right">Monto Original</th>
                          <th className="p-3.5 text-right">Saldo Disponible</th>
                          <th className="p-3.5 text-center">Adjunto</th>
                          <th className="p-3.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                        {filteredCreditNotes.map(cn => {
                          const saldo = Number(cn.saldo_disponible !== undefined ? cn.saldo_disponible : cn.monto)
                          const tieneSaldo = saldo > 0
                          const esMerma = cn.impacto_contable === "recuperacion_merma"

                          return (
                            <tr key={cn.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                                <div>{cn.supplier_nombre || "Proveedor Desconocido"}</div>
                              </td>
                              <td className="p-3.5 font-mono text-xs text-gray-900 dark:text-white">
                                <div className="font-bold">{cn.numero}</div>
                                {cn.timbrado && <div className="text-[10px] text-gray-400 font-normal">Timb: {cn.timbrado}</div>}
                              </td>
                              <td className="p-3.5 font-mono text-xs text-gray-500">
                                {cn.numero_factura_origen || "—"}
                              </td>
                              <td className="p-3.5 font-mono text-xs text-gray-500">
                                {cn.fecha ? new Date(cn.fecha).toLocaleDateString("es-PY") : "—"}
                              </td>
                              <td className="p-3.5 text-xs">
                                <div className="font-medium text-gray-800 dark:text-gray-200">{cn.motivo}</div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    esMerma
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                                      : "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300"
                                  }`}>
                                    {esMerma ? "Recuperación de Merma" : "Otros Ingresos"}
                                  </span>
                                  {cn.motivo_categoria && (
                                    <span className="text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded">
                                      {MOTIVOS_NC.find(m => m.id === cn.motivo_categoria)?.label || cn.motivo_categoria}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3.5 font-mono font-bold text-right text-gray-700 dark:text-gray-300">
                                {formatPYG(cn.monto)}
                              </td>
                              <td className="p-3.5 text-right">
                                <span className={`inline-block font-mono font-black text-xs px-2.5 py-1 rounded-full ${
                                  tieneSaldo
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                    : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400"
                                }`}>
                                  {formatPYG(saldo)}
                                </span>
                              </td>
                              <td className="p-3.5 text-center">
                                {cn.archivo_adjunto_path ? (
                                  <a
                                    href={cn.archivo_adjunto_path}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-bold p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                                    title="Ver comprobante escaneado"
                                  >
                                    <Paperclip className="w-4 h-4" />
                                    <span className="text-[10px]">Ver</span>
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-gray-400">Sin adjunto</span>
                                )}
                              </td>
                              <td className="p-3.5 text-right space-x-1.5">
                                {tieneSaldo && (
                                  <button
                                    onClick={() => handleOpenApplyModal(cn)}
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                                    title="Aplicar saldo de esta NC a una factura pendiente"
                                  >
                                    Aplicar
                                  </button>
                                )}
                                <button
                                  onClick={() => handleViewApplications(cn)}
                                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 transition"
                                  title="Ver historial de aplicaciones a facturas"
                                >
                                  Historial
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
        </>
      )}

      {/* MODAL: Pago Directo de Factura */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => setShowPayModal(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registrar Pago a Proveedor</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {showPayModal.supplier_nombre} — Factura N° {showPayModal.numero_factura}
              </p>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div>
                <label className="label-field">Monto a Transferir (₲) *</label>
                <input
                  className="input-field font-mono text-sm font-bold"
                  type="number"
                  value={payForm.monto}
                  onChange={e => setPayForm({ ...payForm, monto: e.target.value })}
                />
              </div>
              <div>
                <label className="label-field">Medio de Pago</label>
                <select
                  className="input-field"
                  value={payForm.payment_method}
                  onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                >
                  <option value="transferencia">Transferencia Bancaria (SIPAP)</option>
                  <option value="cheque">Cheque Propio</option>
                  <option value="efectivo">Efectivo de Caja Central</option>
                </select>
              </div>
              <div>
                <label className="label-field">N° Referencia / Comprobante</label>
                <input
                  className="input-field"
                  placeholder="Ej: Transf. SIPAP 981244"
                  value={payForm.referencia}
                  onChange={e => setPayForm({ ...payForm, referencia: e.target.value })}
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPayModal(null)} className="btn-ghost text-xs">Cancelar</button>
              <button
                onClick={handleConfirmDirectPayment}
                disabled={submittingPayment || !payForm.monto}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {submittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Wizard Payment Run Builder */}
      {showPaymentRunWizard && (
        <div className="modal-overlay" onClick={() => setShowPaymentRunWizard(false)}>
          <div className="modal-content max-w-4xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Asistente de Lotes de Pago Bancario (SIPAP)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Paso {runStep} de 2 — Selección y confirmación de órdenes de pago</p>
              </div>
              <button onClick={() => setShowPaymentRunWizard(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {runStep === 1 ? (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">Nombre del Lote *</label>
                      <input
                        className="input-field"
                        value={runForm.nombre}
                        onChange={e => setRunForm({ ...runForm, nombre: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label-field">Fecha de Ejecución *</label>
                      <input
                        className="input-field"
                        type="date"
                        value={runForm.fecha_programada}
                        onChange={e => setRunForm({ ...runForm, fecha_programada: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        Seleccionar Facturas de Proveedores ({selectedInvoiceIds.size} seleccionadas)
                      </span>
                      <button onClick={handleSelectAllInvoices} className="btn-ghost text-xs text-primary">
                        {selectedInvoiceIds.size === invoices.filter(i => i.estado === "pendiente").length ? "Deseleccionar Todas" : "Seleccionar Todas"}
                      </button>
                    </div>

                    <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-slate-800 text-[11px] font-bold text-gray-500 uppercase">
                            <th className="p-3 w-10"></th>
                            <th className="p-3">Proveedor</th>
                            <th className="p-3">Factura</th>
                            <th className="p-3">Vencimiento</th>
                            <th className="p-3 text-right">Saldo Pendiente</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                          {invoices.filter(i => i.estado === "pendiente").map(inv => {
                            const isSelected = selectedInvoiceIds.has(inv.id)
                            return (
                              <tr
                                key={inv.id}
                                onClick={() => handleToggleInvoiceSelection(inv.id)}
                                className={`cursor-pointer ${isSelected ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-50"}`}
                              >
                                <td className="p-3">
                                  <input type="checkbox" checked={isSelected} readOnly className="rounded text-primary" />
                                </td>
                                <td className="p-3 font-bold">{inv.supplier_nombre}</td>
                                <td className="p-3 font-mono">{inv.numero_factura}</td>
                                <td className="p-3 font-mono">{inv.fecha_vencimiento || "—"}</td>
                                <td className="p-3 font-mono font-bold text-right">{formatPYG(inv.saldo_pendiente ?? inv.total)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <span className="font-bold text-gray-700 dark:text-gray-300">Total del Lote</span>
                    <span className="text-xl font-extrabold text-primary font-mono">{formatPYG(totalSelectedRun)}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPaymentRunWizard(false)} className="btn-ghost text-xs">Cancelar</button>
              <button
                onClick={handleCreatePaymentRun}
                disabled={submittingRun || selectedInvoiceIds.size === 0}
                className="btn-primary text-xs disabled:opacity-50 flex items-center gap-2"
              >
                {submittingRun ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generar Lote de Pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🧾 MODAL: REGISTRAR NOTA DE CRÉDITO DE PROVEEDOR (FASE 4) */}
      {showNCModal && (
        <div className="modal-overlay" onClick={() => setShowNCModal(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-slate-800 dark:to-slate-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Registrar Nota de Crédito de Proveedor</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Incorporación de saldo a favor de la empresa para amortización de cuentas por pagar.
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowNCModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateNC}>
              <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                {/* Proveedor */}
                <div>
                  <label className="label-field font-bold">Proveedor Emisor *</label>
                  <select
                    className="input-field"
                    value={ncForm.supplier_id}
                    onChange={e => setNcForm({ ...ncForm, supplier_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccione un proveedor...</option>
                    {allSuppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.razon_social} (RUC: {s.ruc})</option>
                    ))}
                  </select>
                </div>

                {/* N° NC y Timbrado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label-field font-bold">N° Nota de Crédito *</label>
                    <input
                      className="input-field font-mono"
                      placeholder="001-001-0001234"
                      value={ncForm.numero}
                      onChange={e => setNcForm({ ...ncForm, numero: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field">Timbrado Fiscal</label>
                    <input
                      className="input-field font-mono"
                      placeholder="18545636"
                      value={ncForm.timbrado}
                      onChange={e => setNcForm({ ...ncForm, timbrado: e.target.value })}
                    />
                  </div>
                </div>

                {/* Factura Origen y Fecha */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label-field">N° Factura Origen (Referencia)</label>
                    <input
                      className="input-field font-mono"
                      placeholder="001-001-0009876"
                      value={ncForm.numero_factura_origen}
                      onChange={e => setNcForm({ ...ncForm, numero_factura_origen: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label-field font-bold">Fecha de Emisión *</label>
                    <input
                      type="date"
                      className="input-field font-mono"
                      value={ncForm.fecha}
                      onChange={e => setNcForm({ ...ncForm, fecha: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Monto y Categoría de Motivo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label-field font-bold">Monto Total (₲) *</label>
                    <input
                      type="number"
                      className="input-field font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400"
                      placeholder="Ej: 350000"
                      value={ncForm.monto}
                      onChange={e => setNcForm({ ...ncForm, monto: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field font-bold">Categoría del Motivo *</label>
                    <select
                      className="input-field"
                      value={ncForm.motivo_categoria}
                      onChange={e => {
                        const m = MOTIVOS_NC.find(x => x.id === e.target.value)
                        setNcForm(prev => ({
                          ...prev,
                          motivo_categoria: e.target.value,
                          impacto_contable: m ? m.defaultImpact : prev.impacto_contable
                        }))
                      }}
                    >
                      {MOTIVOS_NC.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Impacto Contable */}
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-gray-700/80 space-y-2">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                    Impacto Contable & Operativo
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                      ncForm.impacto_contable === "otros_ingresos"
                        ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-sm"
                        : "bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 opacity-70"
                    }`}>
                      <input
                        type="radio"
                        name="impacto_contable"
                        value="otros_ingresos"
                        checked={ncForm.impacto_contable === "otros_ingresos"}
                        onChange={() => setNcForm({ ...ncForm, impacto_contable: "otros_ingresos" })}
                        className="mt-0.5 text-blue-600"
                      />
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">Otros Ingresos (Comercial)</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Descuento acordado a posteriori o bonificación. No altera el costo de stock ni afecta mermas físicas.
                        </div>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                      ncForm.impacto_contable === "recuperacion_merma"
                        ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 shadow-sm"
                        : "bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 opacity-70"
                    }`}>
                      <input
                        type="radio"
                        name="impacto_contable"
                        value="recuperacion_merma"
                        checked={ncForm.impacto_contable === "recuperacion_merma"}
                        onChange={() => setNcForm({ ...ncForm, impacto_contable: "recuperacion_merma" })}
                        className="mt-0.5 text-amber-600"
                      />
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">Recuperación de Merma</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Devolución física por vencimiento o rotura. Reversa la pérdida de merma o faltante de mercadería.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Motivo Detallado */}
                <div>
                  <label className="label-field font-bold">Descripción del Motivo *</label>
                  <input
                    className="input-field"
                    placeholder="Ej: Lote de 12 unidades vencidas retiradas por preventista según acta N° 45"
                    value={ncForm.motivo}
                    onChange={e => setNcForm({ ...ncForm, motivo: e.target.value })}
                    required
                  />
                </div>

                {/* Carga de Comprobante Escaneado Directo */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Adjuntar Comprobante Escaneado (PDF o Imagen)
                  </label>
                  
                  {ncForm.archivo_adjunto_path ? (
                    <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-300 dark:border-emerald-700 text-xs">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold truncate">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span className="truncate">{uploadedFileName || "Comprobante cargado correctamente"}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={ncForm.archivo_adjunto_path}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline font-bold text-[11px]"
                        >
                          Ver
                        </a>
                        <button
                          type="button"
                          onClick={() => { setNcForm(prev => ({ ...prev, archivo_adjunto_path: "" })); setUploadedFileName("") }}
                          className="text-gray-400 hover:text-rose-500 text-[11px]"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/webp"
                        onChange={handleUploadNCFile}
                        disabled={uploadingNCFile}
                        className="text-xs file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer text-gray-500"
                      />
                      {uploadingNCFile && (
                        <div className="flex items-center gap-1.5 text-indigo-600 text-xs font-bold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo...
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400">
                    Carga directa desde tu computadora (PDF o fotos del comprobante firmado por el proveedor).
                  </p>
                </div>

                {/* Observaciones */}
                <div>
                  <label className="label-field">Observaciones Internas</label>
                  <textarea
                    rows={2}
                    className="input-field"
                    placeholder="Detalles adicionales, número de acta o referencia interna..."
                    value={ncForm.observaciones}
                    onChange={e => setNcForm({ ...ncForm, observaciones: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-850">
                <button
                  type="button"
                  onClick={() => setShowNCModal(false)}
                  className="btn-ghost text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingNC || uploadingNCFile}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {submittingNC ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Guardar Nota de Crédito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 💳 MODAL: APLICAR SALDO DE NC A FACTURA PENDIENTE (FASE 4) */}
      {showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-slate-800 dark:to-slate-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-md">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Amortizar Factura con Nota de Crédito</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Aplica el crédito disponible a una factura por pagar del mismo proveedor.
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowApplyModal(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleApplyNC}>
              <div className="p-6 space-y-4 text-xs">
                {/* Resumen NC */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">
                      Nota de Crédito N° {showApplyModal.numero}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white text-xs">
                      {showApplyModal.supplier_nombre}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 block">Saldo Disponible</span>
                    <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {formatPYG(showApplyModal.saldo_disponible !== undefined ? showApplyModal.saldo_disponible : showApplyModal.monto)}
                    </span>
                  </div>
                </div>

                {/* Selector de Factura */}
                <div>
                  <label className="label-field font-bold">Seleccionar Factura a Amortizar *</label>
                  {(() => {
                    const supInvoices = invoices.filter(i => i.supplier_id === showApplyModal.supplier_id && Number(i.saldo_pendiente || 0) > 0)
                    if (supInvoices.length === 0) {
                      return (
                        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 text-xs">
                          Este proveedor no tiene facturas pendientes de pago en el sistema actualmente.
                        </div>
                      )
                    }
                    return (
                      <select
                        className="input-field"
                        value={applyForm.invoice_id}
                        onChange={e => {
                          const selectedInv = supInvoices.find(i => i.id === e.target.value)
                          const saldoNC = Number(showApplyModal.saldo_disponible !== undefined ? showApplyModal.saldo_disponible : showApplyModal.monto)
                          const initM = selectedInv ? Math.min(saldoNC, Number(selectedInv.saldo_pendiente || 0)) : saldoNC
                          setApplyForm({
                            ...applyForm,
                            invoice_id: e.target.value,
                            monto: String(initM),
                          })
                        }}
                        required
                      >
                        <option value="">Seleccione una factura...</option>
                        {supInvoices.map(i => (
                          <option key={i.id} value={i.id}>
                            Factura {i.numero_factura} (Vence: {i.fecha_vencimiento || "—"}) — Saldo: {formatPYG(i.saldo_pendiente || 0)}
                          </option>
                        ))}
                      </select>
                    )
                  })()}
                </div>

                {/* Monto a Aplicar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label-field font-bold">Monto a Aplicar (₲) *</label>
                    {applyForm.invoice_id && (() => {
                      const selectedInv = invoices.find(i => i.id === applyForm.invoice_id)
                      const saldoNC = Number(showApplyModal.saldo_disponible !== undefined ? showApplyModal.saldo_disponible : showApplyModal.monto)
                      const saldoInv = Number(selectedInv?.saldo_pendiente || 0)
                      const maxAplicable = Math.min(saldoNC, saldoInv)
                      return (
                        <button
                          type="button"
                          onClick={() => setApplyForm({ ...applyForm, monto: String(maxAplicable) })}
                          className="text-[10px] font-bold text-emerald-600 hover:underline"
                        >
                          Aplicar Máximo ({formatPYG(maxAplicable)})
                        </button>
                      )
                    })()}
                  </div>
                  <input
                    type="number"
                    className="input-field font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400"
                    value={applyForm.monto}
                    onChange={e => setApplyForm({ ...applyForm, monto: e.target.value })}
                    required
                  />
                </div>

                {/* Observaciones */}
                <div>
                  <label className="label-field">Observaciones</label>
                  <input
                    className="input-field"
                    value={applyForm.observaciones}
                    onChange={e => setApplyForm({ ...applyForm, observaciones: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-850">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(null)}
                  className="btn-ghost text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingApply || !applyForm.invoice_id || Number(applyForm.monto) <= 0}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-md shadow-emerald-600/30 disabled:opacity-50"
                >
                  {submittingApply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirmar Amortización
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📜 MODAL: HISTORIAL DE APLICACIONES DE LA NOTA DE CRÉDITO */}
      {showApplicationsModal && (
        <div className="modal-overlay" onClick={() => setShowApplicationsModal(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">
                    Historial de Aplicaciones
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    NC N° {showApplicationsModal.numero} — {showApplicationsModal.supplier_nombre}
                  </p>
                </div>
                <button onClick={() => setShowApplicationsModal(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-3 text-xs">
              {loadingApplications ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : applicationsList.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Esta Nota de Crédito aún no ha sido aplicada a ninguna factura.
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                  {applicationsList.map(app => (
                    <div key={app.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          Factura N° {app.numero_factura}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {app.fecha ? new Date(app.fecha).toLocaleString("es-PY") : "—"}
                          {app.observaciones && ` · ${app.observaciones}`}
                        </div>
                      </div>
                      <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatPYG(app.monto_aplicado)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setShowApplicationsModal(null)} className="btn-primary text-xs">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
